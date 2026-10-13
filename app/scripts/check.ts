// Automated checks for the guided app's rules engine. Run with `npm test` (Node 22+ runs TypeScript directly).
// Plays full games through the same code the app uses and fails if a rule invariant breaks or balance drifts.
import { autoTowers, canPlay as engineCanPlay, compare, cost, DEFAULT_RULES, endRound, freshDeck, newGame, playCard as enginePlay, shuffle, suggestDeck } from '../src/engine.ts'
import type { Card } from '../src/engine.ts'
import { advise, canPlay, endMyTurn, enterEnemyCard, enterTowerCard, lastStandPlay, makeGame, next, playCard, startRound } from '../src/guide.ts'
import type { Advice, GuideState } from '../src/guide.ts'

function mulberry(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

let failures = 0
function check(ok: boolean, what: string) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) failures++
}

// Every physical card is somewhere: 16 per side at every step, and elixir stays on the bar.
function invariantError(g: GuideState): string | null {
  const p = g.P.hand.length + g.P.queue.length + g.P.towers.L.length + g.P.towers.R.length + g.P.towers.K.length
    + g.units.filter(u => u.side === 'P').length + g.discard.filter(d => d.owner === 'P').length
  const e = g.E.queue.length + g.E.towers.L.length + g.E.towers.R.length + g.E.towers.K.length
    + g.units.filter(u => u.side === 'E').length + g.discard.filter(d => d.owner === 'E').length
  if (p !== 16) return `your cards add up to ${p}, not 16`
  if (e !== 16) return `enemy cards add up to ${e}, not 16`
  for (const x of [g.P.elixir, g.E.elixir]) if (x < 0 || x > g.rules.cap) return `elixir ${x} is off the bar`
  if (g.P.hand.length > 4) return `hand has ${g.P.hand.length} cards`
  for (const l of [...g.lines, ...g.why, ...g.lastAction]) if (!l || /undefined|NaN|\[object/.test(l)) return `bad instruction text: "${l}"`
  return null
}

type Player = (g: GuideState, rnd: () => number) => Advice
const suggestions: Player = g => advise(g)
const random: Player = (g, rnd) => {
  if (rnd() < 0.5) return { kind: 'wait', reason: '' }
  const ok = g.P.hand.map((_, i) => i).filter(i => canPlay(g, i))
  return ok.length ? { kind: 'play', handIndex: ok[Math.floor(rnd() * ok.length)], lane: rnd() < 0.5 ? 0 : 1, reason: '' } : { kind: 'wait', reason: '' }
}

/** Plays guided games with the real enemy cards behind the face-down ones, exactly as at the table. */
function playGuided(n: number, player: Player, seed: number) {
  Math.random = mulberry(seed)
  const rnd = mulberry(seed + 1)
  let wins = 0, unfinished = 0, rounds = 0
  let error: string | null = null
  for (let k = 0; k < n && !error; k++) {
    const d = shuffle(freshDeck())
    const my16 = d.slice(0, 16), e16 = d.slice(16, 32)
    const deck = suggestDeck(my16)
    const real = new Map<string, Card>()
    e16.forEach((c, i) => real.set(i < 8 ? `ep${i}` : `et${i - 8}`, c))
    let g = startRound(makeGame(deck, autoTowers(my16.filter(c => !deck.includes(c))), my16, DEFAULT_RULES))
    let steps = 0, playsThisTurn = 0
    while (g.stage !== 'over' && g.round < 200 && steps++ < 60000) {
      const st = g.stage
      if (st === 'my_play') {
        const a = playsThisTurn++ < 8 ? player(g, rnd) : ({ kind: 'wait', reason: '' } as Advice)
        if (a.kind === 'play') g = playCard(g, a.handIndex, a.lane)
        else { g = endMyTurn(g); playsThisTurn = 0 }
      } else if (st === 'enemy_enter' || st === 'last_stand_enter') g = enterEnemyCard(g, real.get(g.E.queue[0].tid)!)
      else if (st === 'tower_enter') {
        const u = g.units.find(x => x.uid === g.hitQueue[0])!
        const lk = u.lane === 0 ? 'L' : 'R'
        const key = g.E.towers[lk].length ? lk : 'K'
        g = enterTowerCard(g, real.get(g.E.towers[key][0].tid)!)
      } else if (st === 'my_last_stand') g = lastStandPlay(g, 0)
      else g = next(g)
      error = invariantError(g)
      if (error) { error = `game ${k}, round ${g.round}, stage ${g.stage}: ${error}`; break }
    }
    if (g.stage !== 'over') unfinished++
    else { rounds += g.round; if (g.winner === 'P') wins++ }
  }
  return { winRate: wins / n, unfinished, avgRounds: rounds / Math.max(1, n - unfinished), error }
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`

const strong = playGuided(400, suggestions, 7)
check(strong.error === null, `rules stay consistent in 400 games with the app's suggestions${strong.error ? ` (${strong.error})` : ''}`)
check(strong.unfinished === 0, `every game finishes (${strong.unfinished} unfinished)`)
check(strong.winRate >= 0.7 && strong.winRate <= 0.92, `following the suggestions wins 70–92% (got ${pct(strong.winRate)}, ${strong.avgRounds.toFixed(0)} rounds on average)`)

const weak = playGuided(400, random, 11)
check(weak.error === null, `rules stay consistent in 400 games of random play${weak.error ? ` (${weak.error})` : ''}`)
check(weak.winRate <= 0.1, `random play almost never wins (got ${pct(weak.winRate)})`)

// The plain engine (used for quick balance checks) must agree with the guided rules on the basics.
{
  const rnd = mulberry(3)
  let w = 0, unfinished = 0
  const N = 1000
  for (let i = 0; i < N; i++) {
    const d = shuffle(freshDeck(), rnd)
    const mine = d.slice(0, 16)
    const deck = suggestDeck(mine)
    let g = newGame(deck, autoTowers(mine.filter(c => !deck.includes(c))), d.slice(16, 32), DEFAULT_RULES, rnd)
    let t = 0
    while (!g.winner && t++ < 300) {
      if (rnd() < 0.5) {
        const ok = g.P.hand.map((_, j) => j).filter(j => engineCanPlay(g, j))
        if (ok.length) g = enginePlay(g, ok[Math.floor(rnd() * ok.length)], rnd() < 0.5 ? 0 : 1)
      }
      g = endRound(g)
    }
    if (!g.winner) unfinished++
    else if (g.winner === 'P') w++
  }
  check(unfinished === 0, `plain engine: every random game finishes (${unfinished} unfinished)`)
  check(w / N <= 0.1, `plain engine: random play almost never wins (got ${pct(w / N)})`)
}

check(cost(1) === 1 && cost(5) === 4 && cost(9) === 7 && cost(13) === 10, 'cost table matches the rulebook (A=1, 5=4, 9=7, K=10)')

{
  // ranks with suits that give no wheel bonus either way (♠ vs ♦), unless noted
  const c = (rank: number, suit = 0): Card => ({ id: `${rank}-${suit}`, rank, suit })
  const R = DEFAULT_RULES
  check(compare(c(1), c(11, 2), R) === 1 && compare(c(1), c(13, 2), R) === 1, 'underdog: A beats J and K')
  check(compare(c(2), c(12, 2), R) === 1 && compare(c(3), c(13, 2), R) === 1, 'underdog: 2 beats Q, 3 beats K')
  check(compare(c(2), c(11, 2), R) === -1 && compare(c(4), c(13, 2), R) === -1, 'underdog stops at 10 ranks: J beats 2, K beats 4')
  check(compare(c(13, 0), c(1, 1), R) === -1, 'underdog ignores the wheel: A♥ beats K♠ even though ♠ beats ♥')
  check(compare(c(9, 0), c(11, 1), R) === 1 && compare(c(7), c(7, 2), R) === 0, 'normal fights unchanged: 9♠ (+3 vs ♥) beats J♥, equal ranks tie')
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)

// Automated checks for the guided app's rules engine. Run with `npm test` (Node 22+ runs TypeScript directly).
// Plays full games through the same code the app uses and fails if a rule invariant breaks or balance drifts.
import { autoTowers, breaksTower, canPlay as engineCanPlay, compare, cost, fightResult, HAND_SIZE, DECK_SIZE, DEFAULT_RULES, endRound, freshDeck, newGame, PER_SIDE, playCard as enginePlay, shuffle, splitDeal, suggestDeck, suggestSetup } from '../src/engine.ts'
import type { Card } from '../src/engine.ts'
import { advise, canPlay, describe, endMyTurn, enterEnemyCard, enterTowerCard, extendBatch, fightingNext, lastStandPlay, makeGame, next, playCard, startRound, summary, switchCards, takeBack } from '../src/guide.ts'
import type { Advice, GuideState } from '../src/guide.ts'
import { TUTORIAL } from '../src/tutorial.ts'
import { current, judge } from './tutorial.ts'

function mulberry(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

let failures = 0
function check(ok: boolean, what: string) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) failures++
}

// Every physical card is somewhere: 11 per side at every step, and your turn's budget stays between 0 and 2.
function invariantError(g: GuideState): string | null {
  const p = g.P.hand.length + g.P.queue.length + g.P.towers.L.length + g.P.towers.R.length + g.P.towers.K.length
    + g.units.filter(u => u.side === 'P').length + g.discard.filter(d => d.owner === 'P').length
  const e = g.E.queue.length + g.E.towers.L.length + g.E.towers.R.length + g.E.towers.K.length
    + g.units.filter(u => u.side === 'E').length + g.discard.filter(d => d.owner === 'E').length
  if (p !== PER_SIDE) return `your cards add up to ${p}, not ${PER_SIDE}`
  if (e !== PER_SIDE) return `enemy cards add up to ${e}, not ${PER_SIDE}`
  if (g.P.elixir < 0 || g.P.elixir > g.rules.cap) return `turn budget ${g.P.elixir} is out of range`
  if (g.P.hand.length > HAND_SIZE) return `hand has ${g.P.hand.length} cards`
  for (const l of [...g.lines, ...g.why, ...g.lastAction]) if (!l || /undefined|NaN|\[object/.test(l)) return `bad instruction text: "${l}"`
  return null
}

// The events a step reports (what the screen animates) match what the step wrote in the log, and the fight winners follow the rules.
function eventError(prev: GuideState, g: GuideState): string | null {
  const added = g.log.slice(prev.log.length), ev = g.events ?? []
  const count = (re: RegExp) => added.filter(l => re.test(l)).length
  const of = (t: string) => ev.filter(e => e.type === t)
  const pairs: [string, RegExp][] = [['round', /^— Round/], ['play', /^(You play|Enemy plays|Your last stand|Enemy last stand)/], ['fight', / beats | ties /], ['tower', / breaks | holds but cracks| cracks the armored /]]
  for (const [t, re] of pairs) if (of(t).length !== count(re)) return `${of(t).length} ${t} events for ${count(re)} log lines`
  for (const e of ev) {
    const d = describe(e)
    if ((e.type === 'play' || e.type === 'fight' || e.type === 'tower') && (!d || /undefined|NaN|\[object/.test(d))) return `bad ${e.type} description: "${d}"`
    if (e.type === 'fight') {
      const r = fightResult(e.mine.card, e.theirs.card, g.rules)
      if (e.winner !== (r > 0 ? 'P' : r < 0 ? 'E' : 'tie')) return `fight event says ${e.winner} won ${e.mine.card.id} vs ${e.theirs.card.id}`
    }
    // (the board is as the step left it: when a step hits one tower twice, the last hit is the one it shows)
    const last = ev.findLast(x => x.type === 'tower' && e.type === 'tower' && x.side === e.side && x.stack === e.stack) === e
    if (e.type === 'tower' && last && e.destroyed !== ((e.side === 'P' ? g.E.towers : g.P.towers)[e.stack].length === 0)) return `tower event destroyed=${e.destroyed} disagrees with the board`
  }
  if ((g.stage === 'over') !== (of('over').length === 1) && prev.stage !== 'over') return 'game over without an over event (or the reverse)'
  return null
}

type Player = (g: GuideState, rnd: () => number) => Advice
const suggestions: Player = g => advise(g)
const random: Player = (g, rnd) => {
  if (rnd() < 0.5) return { kind: 'wait', reason: '', short: '' }
  const ok = g.P.hand.map((_, i) => i).filter(i => canPlay(g, i))
  return ok.length ? { kind: 'play', handIndex: ok[Math.floor(rnd() * ok.length)], lane: rnd() < 0.5 ? 0 : 1, reason: '', short: '' } : { kind: 'wait', reason: '', short: '' }
}

/** Plays guided games with the real enemy cards behind the face-down ones, exactly as at the table (batch: a round's fights as one checklist). */
function playGuided(n: number, player: Player, seed: number, batch = false) {
  const run = (s: GuideState) => (batch ? extendBatch(s) : s)
  Math.random = mulberry(seed)
  const rnd = mulberry(seed + 1)
  let wins = 0, unfinished = 0, rounds = 0
  let error: string | null = null
  for (let k = 0; k < n && !error; k++) {
    const { mine, theirs } = splitDeal(shuffle(freshDeck()))
    const deck = suggestDeck(mine)
    const real = new Map<string, Card>()
    theirs.forEach((c, i) => real.set(i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, c))
    let g = startRound(makeGame(deck, autoTowers(mine.filter(c => !deck.includes(c))), mine, DEFAULT_RULES))
    let steps = 0, playsThisTurn = 0
    while (g.stage !== 'over' && g.round < 200 && steps++ < 60000) {
      const st = g.stage, before = g
      if (st === 'my_play') {
        const a = playsThisTurn++ < 8 ? player(g, rnd) : ({ kind: 'wait', reason: '', short: '' } as Advice)
        if (a.kind === 'play') g = playCard(g, a.handIndex, a.lane)
        else { g = endMyTurn(g); playsThisTurn = 0 }
      } else if (st === 'enemy_enter' || st === 'last_stand_enter') g = run(enterEnemyCard(g, real.get(g.E.queue[0].tid)!))
      else if (st === 'tower_enter') {
        const u = g.units.find(x => x.uid === g.hitQueue[0])!
        const lk = u.lane === 0 ? 'L' : 'R'
        const key = g.E.towers[lk].length ? lk : 'K'
        g = run(enterTowerCard(g, real.get(g.E.towers[key][0].tid)!))
      } else if (st === 'my_last_stand') g = lastStandPlay(g, 0)
      else g = run(next(g))
      error = invariantError(g) ?? (g !== before ? eventError(before, g) : null)
      if (error) { error = `game ${k}, round ${g.round}, stage ${g.stage}: ${error}`; break }
    }
    const tip = g.stage === 'over' ? summary(g).tip : null
    if (tip && /undefined|NaN|\[object/.test(tip)) { error = `game ${k}: bad end-of-game lesson "${tip}"`; break }
    if (g.stage !== 'over') unfinished++
    else { rounds += g.round; if (g.winner === 'P') wins++ }
  }
  return { winRate: wins / n, unfinished, avgRounds: rounds / Math.max(1, n - unfinished), error }
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`

const strong = playGuided(400, suggestions, 7)
check(strong.error === null, `rules stay consistent in 400 games with the app's suggestions${strong.error ? ` (${strong.error})` : ''}`)
check(strong.unfinished === 0, `every game finishes (${strong.unfinished} unfinished)`)
check(strong.winRate >= 0.5 && strong.winRate <= 0.7, `following the suggestions wins 50–70%, about a beginner's level (got ${pct(strong.winRate)}, ${strong.avgRounds.toFixed(0)} rounds on average)`)
check(strong.avgRounds >= 7 && strong.avgRounds <= 14, `games are short: 7–14 rounds on average (got ${strong.avgRounds.toFixed(1)})`)

const batched = playGuided(400, suggestions, 7, true)
check(batched.error === null && batched.winRate === strong.winRate && batched.avgRounds === strong.avgRounds,
  `taking each round's fights as one checklist plays the same games, step for step${batched.error ? ` (${batched.error})` : ''}`)

const weak = playGuided(400, random, 11)
check(weak.error === null, `rules stay consistent in 400 games of random play${weak.error ? ` (${weak.error})` : ''}`)
check(weak.winRate <= 0.12, `random play rarely wins (got ${pct(weak.winRate)})`)

// The plain engine (used for quick balance checks) must agree with the guided rules on the basics.
{
  const rnd = mulberry(3)
  let w = 0, unfinished = 0
  const N = 1000
  for (let i = 0; i < N; i++) {
    const { mine, theirs } = splitDeal(shuffle(freshDeck(), rnd))
    const deck = suggestDeck(mine)
    let g = newGame(deck, autoTowers(mine.filter(c => !deck.includes(c))), theirs, DEFAULT_RULES, rnd)
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
  check(w / N <= 0.25, `plain engine: random play rarely wins (got ${pct(w / N)})`)
}

check([1, 5].every(r => cost(r) === 1) && [6, 10, 11, 13].every(r => cost(r) === 2) && DEFAULT_RULES.cap === 2 && DEFAULT_RULES.regen === 2,
  'turn budget matches the rulebook: 1 card, or 2 small cards (A to 5), every round, nothing carried over')
{
  const { mine, theirs } = splitDeal(shuffle(freshDeck(), mulberry(9)))
  check(mine.length === PER_SIDE && theirs.length === PER_SIDE && mine.every(c => c.suit === 0 || c.suit === 3) && theirs.every(c => c.suit === 1 || c.suit === 2),
    'the deal: 11 black cards for you, 11 red for the enemy')
}

{
  // ranks with suits that give no wheel bonus either way (♠ vs ♦), unless noted
  const c = (rank: number, suit = 0): Card => ({ id: `${rank}-${suit}`, rank, suit })
  const R = DEFAULT_RULES
  check(compare(c(1), c(13, 2), R) === 1 && compare(c(1), c(13, 0), R) === 1, 'aces beat kings: A beats K of any suit')
  check(compare(c(2), c(11, 2), R) === -1 && compare(c(1), c(10, 2), R) === -1 && compare(c(1), c(11, 2), R) === -1 && compare(c(1), c(12, 2), R) === -1, 'only aces, only against kings: J and Q beat A, 10 beats A, J beats 2')
  check(compare(c(13, 0), c(1, 1), R) === -1, 'aces ignore the wheel: A♥ beats K♠ even though ♠ beats ♥')
  check(compare(c(6, 0), c(11, 1), R) === 1 && compare(c(6, 0), c(12, 1), R) === 0 && compare(c(5, 0), c(11, 1), R) === -1, 'winning suit counts double: 6♠ beats J♥, ties Q♥; 5♠ loses to J♥')
  check(compare(c(7), c(9, 2), R) === -1 && compare(c(7), c(7, 2), R) === 0, 'no wheel between ♠ and ♦: higher rank wins, equal ranks are equal')
  check(fightResult(c(7), c(7, 2), R) === -1 && fightResult(c(6, 0), c(12, 1), R) === -1 && fightResult(c(7), c(7, 2), { ...R, enemyWinsTies: false }) === 0,
    'the enemy wins ties: your 7♠ loses to a 7♦, your 6♠ (counts 12) to a Q♥')
}

{
  // armor: every tower card takes two hits. A card that wins its hit only cracks a whole card and stays, wounded; its next hit breaks it
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  let g = newGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(PER_SIDE, 2 * PER_SIDE), DEFAULT_RULES, mulberry(5))
  g.E.towers.L = [c(3, 2)]
  g.E.queue = []
  g.units = [{ uid: 99, card: c(9), side: 'P', lane: 0, pos: DEFAULT_RULES.laneLen }]
  g = endRound(g)
  const cracked = g.E.towers.L.length === 1 && g.cracked.includes('t3-2') && g.units.some(u => u.uid === 99 && u.wounded)
  g = endRound(g)
  const broke = g.E.towers.L.length === 0 && !g.units.some(u => u.uid === 99)
  check(cracked && broke, 'armor: a 9 hitting a 3 only cracks it and stays, wounded; next round it breaks the cracked 3 and goes back to your pile')
}

{
  // armor: a card that loses its hit is shot back, but the tower card still cracks, so the next hit breaks it whatever it is
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  let g = newGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(PER_SIDE, 2 * PER_SIDE), DEFAULT_RULES, mulberry(5))
  g.E.towers.L = [c(12, 2)]
  g.E.queue = []
  g.units = [{ uid: 98, card: c(2), side: 'P', lane: 0, pos: DEFAULT_RULES.laneLen }]
  g = endRound(g)
  const shotBack = !g.units.some(u => u.uid === 98) && g.cracked.includes('t12-2')
  g.units = [{ uid: 97, card: c(3), side: 'P', lane: 0, pos: DEFAULT_RULES.laneLen }]
  g = endRound(g)
  check(shotBack && g.E.towers.L.length === 0, 'armor: a 2 hitting a Q is shot back and cracks it; a 3 then breaks the cracked Q')
}

// the rules without armor (the engine still supports them): one winning hit breaks a tower card
const NO_ARMOR = { ...DEFAULT_RULES, armor: false }
{
  // a unit that breaks a tower card stays at the tower; one that only cracks a card goes back to its pile
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  let g = newGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(PER_SIDE, 2 * PER_SIDE), NO_ARMOR, mulberry(5))
  g.E.towers.L = [c(3, 1), c(12, 1)]
  g.E.queue = [] // the enemy has nothing to play, so nothing answers the unit
  g.units = [{ uid: 99, card: c(5), side: 'P', lane: 0, pos: DEFAULT_RULES.laneLen }]
  g = endRound(g)
  const stayed = g.units.some(u => u.uid === 99 && u.wounded) && g.E.towers.L.length === 1
  g = endRound(g)
  const wentHome = !g.units.some(u => u.uid === 99) && [...g.P.hand, ...g.P.queue].some(x => x.id === 't5-0') && g.cracked.length === 1
  check(stayed && wentHome, 'without armor: a 5 that breaks a 3 stays at the tower, wounded; next round it only cracks the Q and goes back to your pile')
}

{
  // towers shoot back: even a king breaks at most 2 tower cards, then goes back to its pile
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  let g = newGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(PER_SIDE, 2 * PER_SIDE), NO_ARMOR, mulberry(7))
  g.E.towers.L = [c(3, 2), c(4, 2)]
  g.E.towers.K = [c(5, 2), c(6, 2)]
  g.E.queue = []
  g.units = [{ uid: 99, card: c(13, 0), side: 'P', lane: 0, pos: DEFAULT_RULES.laneLen }]
  for (let i = 0; i < 4; i++) g = endRound(g)
  check(g.E.towers.L.length === 0 && g.E.towers.K.length === 2 && !g.units.some(u => u.uid === 99), 'without armor: a wounded king goes back after its second break: it takes a side tower, never the king too')
}

{
  // both kings fall in the same round: more tower cards left wins, equal is a draw
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  const end = (mine: number, theirs: number) => {
    const g = newGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(PER_SIDE, 2 * PER_SIDE), DEFAULT_RULES, mulberry(8))
    g.E.towers = { L: [], R: [c(9, 2), c(10, 2)].slice(0, theirs), K: [c(2, 2)] }
    g.P.towers = { L: [c(9, 1), c(10, 1)].slice(0, mine), R: [], K: [c(2, 1)] }
    g.E.queue = []
    g.cracked = ['t2-2', 't2-1'] // both kings already cracked, so these hits break them
    g.units = [{ uid: 98, card: c(13, 0), side: 'P', lane: 0, pos: DEFAULT_RULES.laneLen }, { uid: 99, card: c(13, 3), side: 'E', lane: 1, pos: -1 }]
    return endRound(g).winner
  }
  check(end(1, 0) === 'P' && end(1, 2) === 'E' && end(2, 2) === 'draw', 'both kings fall in one round: more tower cards left wins (1 to 0 wins, 1 to 2 loses, 2 to 2 draws)')
}

{
  // a tower hit is a fight: the wheel and aces count against towers too
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const R = DEFAULT_RULES
  check(breaksTower(c(6, 0), c(11, 1), R, 'P') && !breaksTower(c(9), c(9, 2), R, 'P') && breaksTower(c(9, 2), c(9), R, 'E'),
    'towers: 6♠ wins against a J♥ (♠ beats ♥, it counts 12); a tie goes to the enemy, attacking or defending')
  check(!breaksTower(c(13, 2), c(1, 1), R, 'P') && !breaksTower(c(13, 2), c(7, 1), R, 'P') && breaksTower(c(1), c(13, 2), R, 'P') && !breaksTower(c(1), c(12, 2), R, 'P'),
    'towers: an ace on top stops a K, a 7♥ stops a K♦ (counts 14), an attacking ace breaks a K but not a Q')
}

{
  // the enemy has no budget: it plays exactly two cards per round, the first where you pushed harder, the second into the other lane
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  let g = newGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(PER_SIDE, 2 * PER_SIDE), DEFAULT_RULES, mulberry(6))
  g.E.queue = [c(13, 1), c(2, 1), c(3, 1)]
  g.units = [{ uid: 50, card: c(4, 0), side: 'P', lane: 1, pos: 0 }]
  g = endRound(g)
  const e = g.units.filter(u => u.side === 'E')
  check(e.length === 2 && e[0].card.rank === 13 && e[0].lane === 1 && e[1].card.rank === 2 && e[1].lane === 0 && g.E.queue.length === 1,
    'the enemy plays exactly two cards a round: the K into the lane you pushed (right), the 2 into the other lane; the 3 waits')
}

{
  // your turn is a draft: a card taken back is as if it was never played, and a placed card can switch lanes
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  const base: GuideState = { ...makeGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(0, PER_SIDE)), stage: 'my_play', turn: [] }
  base.P = { ...base.P, elixir: 10, hand: [c(2), c(3), c(4), c(5)], queue: [c(6), c(7), c(8), c(9)] }
  const sig = (g: GuideState) => JSON.stringify([g.P.hand.map(x => x.id), g.P.queue.map(x => x.id), g.P.elixir, g.units.map(u => [u.tid, u.lane]), g.stats.placed, g.log])
  const one = playCard(base, 0, 0), two = playCard(one, 0, 1) // the 2 left, then the 3 right
  check(sig(takeBack(two, 't2-0')) === sig(playCard(base, 1, 1)), 'taking back the first of two cards: as if only the second was played (elixir back, the drawn card back on the queue)')
  check(sig(takeBack(two, 't3-0')) === sig(one), 'taking back the last card undoes it exactly')
  const moved = takeBack(two, 't2-0', 1), done = endMyTurn(two)
  check(moved.units.every(u => u.lane === 1) && moved.P.elixir === two.P.elixir && takeBack(done, 't2-0') === done, 'a placed card moves lanes for free; after Done nothing can be taken back')
}

{
  // tap one card, then another: they switch places
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  const base: GuideState = { ...makeGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(0, PER_SIDE)), stage: 'my_play', turn: [] }
  base.P = { ...base.P, elixir: 10, hand: [c(2), c(3), c(13)], queue: [c(6), c(7), c(8), c(9), c(4)] }
  const mine = (g: GuideState) => g.units.map(u => `${u.card.rank}${u.lane ? 'R' : 'L'}`).join(' ')
  const two = playCard(playCard(base, 0, 0), 1, 1) // the 2 left, the 3 right; the 6 and 7 drawn (each new card comes in on the left of the hand)
  check(mine(switchCards(two, 't2-0', 't3-0')) === '3L 2R', 'two placed cards in different lanes switch lanes')
  const same = playCard(playCard(base, 0, 0), 1, 0)
  check(mine(switchCards(same, 't3-0', 't2-0')) === '3L 2L', 'two placed cards in one slot switch order: the one now first fights first')
  const sw = switchCards(two, 't2-0', 't6-0') // the 6 from the hand takes the 2's place; the 2 comes back (a big card uses 2 of the budget, a small one 1)
  check(mine(sw) === '6L 3R' && sw.P.elixir === two.P.elixir - 1 && sw.P.hand.some(x => x.id === 't2-0') && sw.P.hand.length === HAND_SIZE && sw.P.queue.length === two.P.queue.length,
    'a placed card and a hand card trade places, paying the difference')
  const one = playCard(base, 0, 0), poor = playCard({ ...base, P: { ...base.P, elixir: 1 } }, 0, 0) // the 2 drew the 6; then nothing left of the turn
  check(switchCards(one, 't2-0', 't6-0') === one && switchCards(poor, 't2-0', 't13-0') === poor && switchCards(poor, 't2-0', 't3-0') !== poor,
    "no switch with a card you only drew because of the other one, or that you can't afford")
}

{
  // a hit on a face-down enemy tower card shakes on the step that turns it up, not before
  const c = (rank: number, suit = 0): Card => ({ id: `t${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  const g: GuideState = { ...makeGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(0, PER_SIDE)), stage: 'move' }
  g.units = [{ uid: 1, card: c(9), side: 'P', lane: 0, pos: DEFAULT_RULES.laneLen, tid: 'x9' }]
  g.hitQueue = [1]
  const faceDown = fightingNext(g).length === 0 && fightingNext({ ...g, stage: 'tower_enter' }).join() === 'x9,tower-E-L'
  g.E.towers.L[0] = { ...g.E.towers.L[0], card: c(4) }
  check(faceDown && fightingNext(g).join() === 'x9,tower-E-L', 'a hit on a face-down tower card shakes as the card turns up; on a known card it shakes a step before')
}

{
  // one thing at a time: the front cards fight where they stand, then the card behind the loser steps up, then it fights
  const c = (rank: number, suit: number): Card => ({ id: `s${rank}-${suit}`, rank, suit })
  const d = freshDeck()
  let g: GuideState = { ...makeGame(d.slice(0, DECK_SIZE), d.slice(DECK_SIZE, PER_SIDE), d.slice(0, PER_SIDE)), stage: 'my_play', turn: [], nextUid: 3 }
  g.units = [{ uid: 1, card: c(11, 1), side: 'P', lane: 1, pos: 1, tid: 'J' }, { uid: 2, card: c(1, 0), side: 'P', lane: 1, pos: 0, tid: 'A' }]
  g.E.queue = [{ tid: 'Q', card: c(13, 1) }, { tid: 'N', card: c(9, 3) }]
  g = endMyTurn(g) // the enemy plays K♥ into the right lane, facing your J♥ (and then 9♣ into the left lane)
  const seen: string[] = []
  for (let n = 0; n < 6 && g.stage !== 'round_start'; n++) {
    g = next(g)
    seen.push(`${g.stage} ${g.units.map(u => `${u.tid}${u.pos}`).join(' ')}`)
  }
  check(seen.slice(1, 4).join(' | ') === 'fight A0 Q2 N2 | step_up Q2 N2 A1 | fight N2 A1',
    `J♥ and K♥ fight first, then A♠ steps up behind the fallen J♥ (to the end of the slot), then A♠ fights K♥ (got: ${seen.join(' | ')})`)
}

// The first game's fixed deal still teaches in order: rules or advice changes can quietly break it (re-pick with scripts/tutorial.ts).
{
  const mine = TUTORIAL.mine, all = [...mine, ...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers]
  check(new Set(all).size === 2 * PER_SIDE && TUTORIAL.enemyPile.length === DECK_SIZE && [...TUTORIAL.deck].sort().join() === [...suggestSetup(current.mine).deckIds].sort().join(),
    'first game: 22 different cards, and its deck is the suggested split of its 11')
  check(judge(current) !== null, 'first game: following the suggestions shows a plain fight, then suit ×2, then an ace beating a king, and wins a close game in 7 to 11 rounds')
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed')
process.exit(failures ? 1 : 0)

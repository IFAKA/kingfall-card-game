// Shared by the balance scripts: plays full games through the app's own rules with different kinds of player, deck choices and rule variants.
// Every setup sees the same deals for the same seed, so differences between setups come from the rule, not from the luck of the deal.
import { autoTowers, cost, DECK_SIZE, DEFAULT_RULES, freshDeck, isRed, PER_SIDE, shuffle, splitDeal, suggestDeck } from '../src/engine.ts'
import type { Card, Rules } from '../src/engine.ts'
import { advise, canPlay, endMyTurn, enterEnemyCard, enterTowerCard, lastStandPlay, makeGame, next, playCard, startRound } from '../src/guide.ts'
import type { Advice, GuideState } from '../src/guide.ts'

export function mulberry(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

export type Player = (g: GuideState, rnd: () => number) => Advice
const wait: Advice = { kind: 'wait', reason: '', short: '' }
const play = (handIndex: number, lane: 0 | 1): Advice => ({ kind: 'play', handIndex, lane, reason: '', short: '' })
export const suggestions: Player = g => advise(g)
export const random: Player = (g, rnd) => {
  if (rnd() < 0.5) return wait
  const ok = g.P.hand.map((_, i) => i).filter(i => canPlay(g, i))
  return ok.length ? play(ok[Math.floor(rnd() * ok.length)], rnd() < 0.5 ? 0 : 1) : wait
}
// the app's best play, but with chance p each step a random move instead
export const slip = (p: number): Player => (g, rnd) => (rnd() < p ? random(g, rnd) : suggestions(g, rnd))
// a typical first-timer's habit: spend all your elixir every turn, strongest affordable card first, into the lane where the enemy has cards
export const naive: Player = g => {
  const ok = g.P.hand.map((_, i) => i).filter(i => canPlay(g, i)).sort((a, b) => g.P.hand[b].rank - g.P.hand[a].rank)
  if (!ok.length) return wait
  const e = [0, 1].map(l => g.units.filter(u => u.side === 'E' && u.lane === l).length)
  return play(ok[0], e[1] > e[0] ? 1 : 0)
}

export type EnemySetup = 'random' | 'best-towers' | 'swarm' | 'heavy' | 'balanced' // swarm: its 8 cheapest cards play, the 6 best are towers; heavy: the reverse; balanced: 4 strongest + 4 cheapest play
// the enemy's 11 cards split into its pile (8) and its towers (3, in slot order L R K)
function enemySplit(theirs: Card[], how: EnemySetup) {
  if (how === 'swarm' || how === 'heavy' || how === 'balanced') {
    const s = [...theirs].sort((a, b) => b.rank - a.rank)
    const pile = how === 'heavy' ? s.slice(0, DECK_SIZE) : how === 'swarm' ? s.slice(-DECK_SIZE) : [...s.slice(0, 4), ...s.slice(-4)]
    return { pile: shuffle(pile), towers: autoTowers(s.filter(c => !pile.includes(c))) }
  }
  const s = shuffle(theirs), pile = s.slice(0, DECK_SIZE), t = s.slice(DECK_SIZE)
  return { pile, towers: how === 'best-towers' ? autoTowers(t) : t }
}

// how you split your 11 cards into a deck of 8 and 3 tower cards
export type DeckPolicy = 'suggested' | 'random' | 'all-high' | 'all-low' | 'mixed' | `top${number}` // topN: the N highest cards and the (8 - N) lowest
function mySplit(mine: Card[], how: DeckPolicy, rnd: () => number): { deck: Card[]; towers: Card[] } {
  const s = [...mine].sort((a, b) => b.rank - a.rank)
  let deck: Card[]
  if (how === 'suggested') deck = suggestDeck(mine)
  else if (how === 'random') deck = shuffle(mine, rnd).slice(0, DECK_SIZE)
  else if (how === 'all-high') deck = s.slice(0, DECK_SIZE)
  else if (how === 'all-low') deck = s.slice(-DECK_SIZE)
  else if (how.startsWith('top')) { const h = Number(how.slice(3)); deck = [...s.slice(0, h), ...s.slice(DECK_SIZE - h === 0 ? s.length : -(DECK_SIZE - h))] }
  else deck = [...s.slice(0, 4), ...s.slice(-4)]
  return { deck, towers: autoTowers(mine.filter(c => !deck.includes(c))) }
}


/** Plays a game on from any state until it ends, with `real` giving the enemy card behind each face-down tid (ep0-7 its pile, et0-2 its towers). */
export function playOut(g0: GuideState, real: Map<string, Card>, player: Player, rnd: () => number, onEvent?: (e: NonNullable<GuideState['events']>[number]) => void): GuideState {
  let g = g0, steps = 0, plays = 0
  while (g.stage !== 'over' && g.round < 200 && steps++ < 60000) {
    const st = g.stage
    if (st === 'my_play') {
      const a = plays++ < 8 ? player(g, rnd) : wait
      if (a.kind === 'play') g = playCard(g, a.handIndex, a.lane)
      else { g = endMyTurn(g); plays = 0 }
    } else if (st === 'enemy_enter' || st === 'last_stand_enter') g = enterEnemyCard(g, real.get(g.E.queue[0].tid)!)
    else if (st === 'tower_enter') {
      const u = g.units.find(x => x.uid === g.hitQueue[0])!
      const lk = u.lane === 0 ? 'L' : 'R'
      g = enterTowerCard(g, real.get(g.E.towers[g.E.towers[lk].length ? lk : 'K'][0].tid)!)
    } else if (st === 'my_last_stand') g = lastStandPlay(g, 0)
    else g = next(g)
    if (onEvent) for (const e of g.events ?? []) onEvent(e)
  }
  return g
}

export interface Setup {
  enemyMin?: number; rules?: Partial<Rules>; enemy?: EnemySetup; player?: Player; deck?: DeckPolicy
  keep?: (mine: Card[]) => boolean // on screen you may deal again: deal until your 11 cards pass this (a player hunting a hand they like)
}
export interface Result {
  n: number; wins: number; rounds: number; unfinished: number
  easy: number        // wins in 12 rounds or fewer with at least 5 of your 6 tower cards still standing
  untouched: number   // games the enemy never cracked or broke one of your tower cards
  standing: number    // your tower cards left, summed over the wins
  aceKillsP: number; aceKillsE: number
  byAces: Record<number, [number, number]> // [wins, games] by the number of aces in your 11 cards
}

export function run(n: number, setup: Setup, seed: number): Result {
  Math.random = mulberry(seed)
  const rnd = mulberry(seed + 1)
  const rules = { ...DEFAULT_RULES, ...setup.rules }
  const player = setup.player ?? suggestions
  const r: Result = { n: 0, wins: 0, rounds: 0, unfinished: 0, easy: 0, untouched: 0, standing: 0, aceKillsP: 0, aceKillsE: 0, byAces: {} }
  for (let k = 0; k < n; k++) {
    let d = shuffle(freshDeck())
    for (let tries = 0; setup.keep && !setup.keep(splitDeal(d).mine) && tries < 1000; tries++) d = shuffle(freshDeck())
    let { mine, theirs } = splitDeal(d)
    if (setup.enemyMin && setup.enemyMin > 1) { // the enemy's cards come only from this rank up (the low cards are set aside before it is dealt)
      theirs = d.filter(c => isRed(c) && c.rank >= setup.enemyMin!).slice(0, PER_SIDE)
      mine = d.filter(c => !isRed(c)).slice(0, PER_SIDE)
    }
    const { deck, towers: myTowers } = mySplit(mine, setup.deck ?? 'suggested', rnd)
    const { pile, towers } = enemySplit(theirs, setup.enemy ?? 'random')
    const real = new Map<string, Card>()
    pile.forEach((c, i) => real.set(`ep${i}`, c))
    towers.forEach((c, i) => real.set(`et${i}`, c))
    const g = playOut(startRound(makeGame(deck, myTowers, mine, rules)), real, player, rnd, e => { if (e.type === 'fight' && e.ace && e.winner === e.ace) { if (e.ace === 'P') r.aceKillsP++; else r.aceKillsE++ } })
    if (g.stage !== 'over') { r.unfinished++; continue }
    r.n++; r.rounds += g.round
    if (!g.stats.mineBroken && !g.cracked?.some(id => mine.some(c => c.id === id))) r.untouched++
    const aces = mine.filter(c => c.rank === 1).length
    const b = (r.byAces[aces] ??= [0, 0]); b[1]++
    if (g.winner === 'P') {
      r.wins++; b[0]++
      const left = g.P.towers.L.length + g.P.towers.R.length + g.P.towers.K.length
      r.standing += left
      if (g.round <= 12 && left >= 5) r.easy++
    }
  }
  return r
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`
export const ci = (w: number, n: number) => `±${(196 * Math.sqrt((w / n) * (1 - w / n) / n)).toFixed(1)}`
export const winRate = (r: Result) => r.wins / r.n
export const spread = (r: Result) => { // win% with 2+ aces minus win% with none
  const w = (ks: number[]) => ks.reduce((s, x) => s + (r.byAces[x]?.[0] ?? 0), 0) / Math.max(1, ks.reduce((s, x) => s + (r.byAces[x]?.[1] ?? 0), 0))
  return (w([2, 3, 4]) - w([0])) * 100
}
export { cost }

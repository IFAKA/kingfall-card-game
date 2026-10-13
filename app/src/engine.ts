// Game engine: mirrors sim/game.py (physical mode, lane length 2, suit wheel). Pure functions over a plain state object.

export type Side = 'P' | 'E'
export type StackKey = 'L' | 'R' | 'K'
export interface Card { id: string; rank: number; suit: number } // suit: 0♠ 1♥ 2♦ 3♣
export interface Unit { uid: number; card: Card; side: Side; lane: 0 | 1; pos: number; tid?: string; held?: boolean }
export interface Towers { L: Card[]; R: Card[]; K: Card[] } // index 0 = top card
export interface SideState {
  hand: Card[]
  queue: Card[]
  elixir: number
  towers: Towers
  revealed: Record<StackKey, boolean> // top card face-up (used for the enemy)
}
export interface Rules { regen: number; enemyRegen: number; startElixir: number; cap: number; wheel: number; laneLen: number }
export interface GameState {
  rules: Rules
  tick: number
  units: Unit[]
  P: SideState
  E: SideState
  log: string[]
  winner: null | Side | 'draw'
  nextUid: number
  cracked: string[] // tower card ids turned sideways by a failed hit; any later hit breaks them
}

export const SUITS = ['♠', '♥', '♦', '♣']
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const label = (c: Card) => `${RANKS[c.rank]}${SUITS[c.suit]}`
export const cost = (rank: number) => Math.floor((rank * 10) / 13 + 0.5)
export const isRed = (c: Card) => c.suit === 1 || c.suit === 2

export const DEFAULT_RULES: Rules = { regen: 3, enemyRegen: 5, startElixir: 5, cap: 10, wheel: 3, laneLen: 2 }

export function freshDeck(): Card[] {
  const d: Card[] = []
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ id: `${r}-${s}`, rank: r, suit: s })
  return d
}

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

/** Deal: 16 for you, 16 for the enemy. The other 20 are the two elixir bars (not modelled as cards). */
export function deal(rnd: () => number = Math.random) {
  const d = shuffle(freshDeck(), rnd)
  return { mine: d.slice(0, 16), theirs: d.slice(16, 32) }
}

/** Default tower layout: king gets the two highest cards, princesses alternate down the rest; strongest on top. */
export function autoTowers(cards: Card[]): Card[] {
  const s = [...cards].sort((a, b) => b.rank - a.rank)
  const K = s.slice(0, 2)
  const rest = s.slice(2)
  const L = rest.filter((_, i) => i % 2 === 0)
  const R = rest.filter((_, i) => i % 2 === 1)
  return [...L, ...R, ...K] // layout order: L0 L1 L2 R0 R1 R2 K0 K1
}

export function towersFromSlots(slots: Card[]): Towers {
  return { L: slots.slice(0, 3), R: slots.slice(3, 6), K: slots.slice(6, 8) }
}

/** Suggested draft: the 3 highest cards + the 5 lowest (what the simulator found best). */
export function suggestDeck(cards: Card[]): Card[] {
  const s = [...cards].sort((a, b) => b.rank - a.rank)
  return [...s.slice(0, 3), ...s.slice(-5)]
}

export function newGame(
  deck: Card[],
  towerSlots: Card[],
  enemy16: Card[],
  rules: Rules,
  rnd: () => number = Math.random,
): GameState {
  const myDeck = shuffle(deck, rnd)
  const enemyShuffled = shuffle(enemy16, rnd)
  const enemyDeck = enemyShuffled.slice(0, 8)
  const enemyTowers = towersFromSlots(enemyShuffled.slice(8))
  const mk = (hand: Card[], queue: Card[], towers: Towers): SideState => ({
    hand, queue, elixir: 0, towers, revealed: { L: false, R: false, K: false },
  })
  const P = mk(myDeck.slice(0, 4), myDeck.slice(4), towersFromSlots(towerSlots))
  const E = mk([], enemyDeck, enemyTowers)
  // round 1 starts with the regeneration already applied (same as the simulator)
  P.elixir = Math.min(rules.cap, rules.startElixir + rules.regen)
  E.elixir = Math.min(rules.cap, rules.startElixir + rules.enemyRegen)
  return {
    rules,
    tick: 0,
    units: [],
    P,
    E,
    log: ['Game start. Round 1: play cards, then press "End round".'],
    winner: null,
    nextUid: 1,
    cracked: [],
  }
}

const clone = (g: GameState): GameState => structuredClone(g)

/** +wheel rank when my suit beats the other suit (suit i beats suit (i+1)%4). */
export function effective(a: Card, b: Card, wheel: number) {
  return a.rank + (b.suit === (a.suit + 1) % 4 ? wheel : 0)
}

function refill(g: GameState) {
  while (g.P.hand.length < 4 && g.P.queue.length) g.P.hand.push(g.P.queue.shift()!)
}

function kill(g: GameState, u: Unit) {
  g.units = g.units.filter(x => x.uid !== u.uid)
  g[u.side].queue.push(u.card) // card returns to the bottom of its owner's pile
  if (u.side === 'P') refill(g)
}

export function canPlay(g: GameState, handIndex: number) {
  const c = g.P.hand[handIndex]
  return !!c && !g.winner && cost(c.rank) <= g.P.elixir
}

/** You play a hand card into a lane (slot 1). */
export function playCard(g0: GameState, handIndex: number, lane: 0 | 1): GameState {
  if (!canPlay(g0, handIndex)) return g0
  const g = clone(g0)
  const c = g.P.hand.splice(handIndex, 1)[0]
  g.P.elixir -= cost(c.rank)
  g.units.push({ uid: g.nextUid++, card: c, side: 'P', lane, pos: 0 })
  refill(g)
  g.log.push(`You play ${label(c)} (cost ${cost(c.rank)}) in the ${lane === 0 ? 'left' : 'right'} lane.`)
  return g
}

function enemyPlays(g: GameState) {
  const e = g.E
  while (e.queue.length && cost(e.queue[0].rank) <= e.elixir) {
    const c = e.queue.shift()!
    e.elixir -= cost(c.rank)
    const mine = [0, 1].map(l => g.units.filter(u => u.side === 'P' && u.lane === l).length)
    const lane: 0 | 1 = mine[0] >= mine[1] ? 0 : 1
    g.units.push({ uid: g.nextUid++, card: c, side: 'E', lane, pos: g.rules.laneLen - 1 })
    g.log.push(`Enemy plays ${label(c)} (cost ${cost(c.rank)}) in the ${lane === 0 ? 'left' : 'right'} lane.`)
  }
}

function fight(g: GameState, lane: 0 | 1) {
  for (;;) {
    const ps = g.units.filter(u => u.lane === lane && u.side === 'P')
    const es = g.units.filter(u => u.lane === lane && u.side === 'E')
    if (!ps.length || !es.length) return
    const p = ps.reduce((a, b) => (b.pos > a.pos ? b : a))
    const e = es.reduce((a, b) => (b.pos < a.pos ? b : a))
    if (p.pos < e.pos) return
    const pe = effective(p.card, e.card, g.rules.wheel)
    const ee = effective(e.card, p.card, g.rules.wheel)
    const bonus = (a: Card, b: Card) => (effective(a, b, g.rules.wheel) > a.rank ? ' (+suit)' : '')
    if (pe === ee) {
      g.log.push(`${label(p.card)}${bonus(p.card, e.card)} ties ${label(e.card)}${bonus(e.card, p.card)}: both removed.`)
      kill(g, p)
      kill(g, e)
    } else if (pe > ee) {
      g.log.push(`Your ${label(p.card)}${bonus(p.card, e.card)} beats enemy ${label(e.card)}${bonus(e.card, p.card)}.`)
      kill(g, e)
    } else {
      g.log.push(`Enemy ${label(e.card)}${bonus(e.card, p.card)} beats your ${label(p.card)}${bonus(p.card, e.card)}.`)
      kill(g, p)
    }
  }
}

function towerHits(g: GameState) {
  for (const u of [...g.units]) {
    const reached = (u.side === 'P' && u.pos >= g.rules.laneLen) || (u.side === 'E' && u.pos < 0)
    if (!reached) continue
    const target = g[u.side === 'P' ? 'E' : 'P']
    const lk: StackKey = u.lane === 0 ? 'L' : 'R'
    const k: StackKey = target.towers[lk].length ? lk : 'K'
    const stack = target.towers[k]
    kill(g, u)
    const who = u.side === 'P' ? 'Your' : 'Enemy'
    const where = k === 'K' ? 'king tower' : `${k === 'L' ? 'left' : 'right'} tower`
    if (!stack.length) continue
    if (u.side === 'P') target.revealed[k] = true
    if (u.card.rank >= stack[0].rank || g.cracked.includes(stack[0].id)) {
      g.log.push(`${who} ${label(u.card)} breaks ${label(stack[0])} on the ${where}.`)
      g.cracked = g.cracked.filter(id => id !== stack[0].id)
      stack.shift()
      if (u.side === 'P') target.revealed[k] = false
      if (k !== 'K' && !stack.length) lastStand(g, u.side === 'P' ? 'E' : 'P', u.lane)
    } else {
      g.log.push(`${who} ${label(u.card)} hits the ${where}: ${label(stack[0])} holds but cracks.`)
      g.cracked.push(stack[0].id)
      if (stack.length > 1) stack.push(stack.shift()!)
      if (u.side === 'P') target.revealed[k] = false
    }
  }
}

/** A princess stack fell: its owner places one card in that lane for free. Enemy: top of its pile. You: your strongest hand card (stand-in for your choice). */
function lastStand(g: GameState, side: Side, lane: 0 | 1) {
  const s = g[side]
  let c: Card | undefined
  if (side === 'E') c = s.queue.shift()
  else if (s.hand.length) {
    const i = s.hand.reduce((best, x, j) => (x.rank > s.hand[best].rank ? j : best), 0)
    c = s.hand.splice(i, 1)[0]
    refill(g)
  }
  if (!c) return
  g.units.push({ uid: g.nextUid++, card: c, side, lane, pos: side === 'P' ? 0 : g.rules.laneLen - 1 })
  g.log.push(`${side === 'P' ? 'Your' : 'Enemy'} last stand: ${label(c)} enters the ${lane === 0 ? 'left' : 'right'} lane for free.`)
}

function checkWinner(g: GameState) {
  const pk = g.P.towers.K.length === 0
  const ek = g.E.towers.K.length === 0
  if (pk && ek) g.winner = 'draw'
  else if (ek) g.winner = 'P'
  else if (pk) g.winner = 'E'
}

/** End your round: enemy plays, everything moves, fights, tower hits, then next round's elixir. */
export function endRound(g0: GameState): GameState {
  if (g0.winner) return g0
  const g = clone(g0)
  enemyPlays(g)
  for (const u of g.units) u.pos += u.side === 'P' ? 1 : -1
  fight(g, 0)
  fight(g, 1)
  towerHits(g)
  checkWinner(g)
  g.tick++
  if (g.winner) {
    g.log.push(g.winner === 'P' ? 'You destroyed the enemy king. YOU WIN.' : g.winner === 'E' ? 'Your king fell. You lose.' : 'Both kings fell. Draw.')
    return g
  }
  g.P.elixir = Math.min(g.rules.cap, g.P.elixir + g.rules.regen)
  g.E.elixir = Math.min(g.rules.cap, g.E.elixir + g.rules.enemyRegen)
  g.log.push(`— Round ${g.tick + 1} —`)
  return g
}

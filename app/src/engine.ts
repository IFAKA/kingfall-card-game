// Game engine: the 22-card rules (11 black cards for you, 11 red for the enemy). Pure functions over a plain state object.

export type Side = 'P' | 'E'
export type StackKey = 'L' | 'R' | 'K'
export interface Card { id: string; rank: number; suit: number } // suit: 0♠ 1♥ 2♦ 3♣
export interface Unit { uid: number; card: Card; side: Side; lane: 0 | 1; pos: number; tid?: string; held?: boolean; wounded?: boolean; free?: boolean } // wounded: broke a tower card, has one hit left; free: came in as a last stand, until its first fight or tower hit
export interface Towers { L: Card[]; R: Card[]; K: Card[] } // index 0 = top card
export interface SideState {
  hand: Card[]
  queue: Card[]
  elixir: number
  towers: Towers
  revealed: Record<StackKey, boolean> // top card face-up (used for the enemy)
}
export interface Rules {
  regen: number; startElixir: number; cap: number; wheel: number; laneLen: number; acesBeatPictures: boolean
  aceMin?: number      // lowest rank an ace beats (13 = kings only: the default; 11 = J, Q and K, the first rules)
  enemyPlays?: number  // cards the enemy plays each round (1 when missing)
  armor?: boolean      // every tower card takes two hits: a winning hit only cracks it (false when missing)
} // wheel: rank multiplier for the winning suit (1 = off)
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
// no elixir to count: each round you play 1 card, or 2 small cards (A to 5). As a turn budget of 2: a small card uses 1, any other card 2.
export const cost = (rank: number) => (rank <= 5 ? 1 : 2)
export const isSmall = (c: Card) => c.rank <= 5
export const isRed = (c: Card) => c.suit === 1 || c.suit === 2 // the enemy's colour: you play the black cards (♠ ♣)

// the budget refills to 2 every round and nothing carries over, so there is nothing to keep track of
export const DEFAULT_RULES: Rules = { regen: 2, startElixir: 2, cap: 2, wheel: 2, laneLen: 3, acesBeatPictures: true, aceMin: 13, enemyPlays: 2, armor: true }

export function freshDeck(): Card[] {
  const d: Card[] = []
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ id: `${r}-${s}`, rank: r, suit: s })
  return d
}

// a number in [0, 1) from the browser's cryptographic generator (53 random bits, like Math.random), so the app's deals can't be predicted;
// the defaults below stay Math.random because the scripts seed it to replay the same deals
export function secureRandom(): number {
  const [hi, lo] = crypto.getRandomValues(new Uint32Array(2))
  return ((hi >>> 5) * 67108864 + (lo >>> 6)) / 9007199254740992
}

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

/** Each side gets 11 cards: an 8-card deck and 3 towers of 1 card (left, right, king). */
export const PER_SIDE = 11
export const DECK_SIZE = 8

/** From a shuffled deck: the first 11 black cards are yours, the first 11 red ones the enemy's. The other 30 sit out unseen. */
export function splitDeal(d: Card[]) {
  return { mine: d.filter(c => !isRed(c)).slice(0, PER_SIDE), theirs: d.filter(isRed).slice(0, PER_SIDE) }
}

export function deal(rnd: () => number = Math.random) {
  return splitDeal(shuffle(freshDeck(), rnd))
}

/** Default tower layout: the king gets the highest card, then left and right the next two. */
export function autoTowers(cards: Card[]): Card[] {
  const s = [...cards].sort((a, b) => b.rank - a.rank)
  return [s[1], s[2], s[0]] // layout order: L R K
}

export function towersFromSlots(slots: Card[]): Towers {
  return { L: slots.slice(0, 1), R: slots.slice(1, 2), K: slots.slice(2, 3) }
}

/** Suggested draft: the 4 highest cards + the 4 lowest (what the simulator found best); the 3 in the middle are the towers. */
export function suggestDeck(cards: Card[]): Card[] {
  const s = [...cards].sort((a, b) => b.rank - a.rank)
  return [...s.slice(0, 4), ...s.slice(-4)]
}

// a random split of the 14 cards, as dealt: the player builds the deck from here (the suggestion is only on request)
export function randomSetup(cards: Card[], rnd: () => number = Math.random): { deckIds: string[]; slotIds: string[] } {
  const ids = shuffle(cards, rnd).map(c => c.id)
  return { deckIds: ids.slice(0, DECK_SIZE), slotIds: ids.slice(DECK_SIZE) }
}

// the suggested split of the 14 cards: the suggested deck, and the other 6 laid out as towers (ids, in tower-slot order)
// (sorted first, so equal ranks split the same way whatever order the cards come in)
export function suggestSetup(cards: Card[]): { deckIds: string[]; slotIds: string[] } {
  const all = [...cards].sort((a, b) => b.rank - a.rank || a.suit - b.suit)
  const deck = suggestDeck(all)
  return { deckIds: deck.map(c => c.id), slotIds: autoTowers(all.filter(c => !deck.includes(c))).map(c => c.id) }
}

export function newGame(
  deck: Card[],
  towerSlots: Card[],
  enemyCards: Card[],
  rules: Rules,
  rnd: () => number = Math.random,
): GameState {
  const myDeck = shuffle(deck, rnd)
  const enemyShuffled = shuffle(enemyCards, rnd)
  const enemyDeck = enemyShuffled.slice(0, DECK_SIZE)
  const enemyTowers = towersFromSlots(enemyShuffled.slice(DECK_SIZE))
  const mk = (hand: Card[], queue: Card[], towers: Towers): SideState => ({
    hand, queue, elixir: 0, towers, revealed: { L: false, R: false, K: false },
  })
  const P = mk(myDeck.slice(0, 4), myDeck.slice(4), towersFromSlots(towerSlots))
  const E = mk([], enemyDeck, enemyTowers) // the enemy has no elixir: it plays one card per round
  // round 1 starts with the regeneration already applied (same as the simulator)
  P.elixir = Math.min(rules.cap, rules.startElixir + rules.regen)
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

/** Rank times `wheel` when my suit beats the other suit (suit i beats suit (i+1)%4), so with wheel 2 the winning suit counts double. */
export function effective(a: Card, b: Card, wheel: number) {
  return a.rank * (b.suit === (a.suit + 1) % 4 ? wheel : 1)
}

/** Aces beat kings outright, ignoring the wheel (aceMin: the lowest rank an ace beats; 13 = kings only). */
export const aceWins = (a: Card, b: Card, rules: Rules) => rules.acesBeatPictures && a.rank === 1 && b.rank >= (rules.aceMin ?? 13)

/** Fight result for card a against card b: 1 = a wins, -1 = b wins, 0 = tie (both removed). */
export function compare(a: Card, b: Card, rules: Rules): number {
  if (aceWins(a, b, rules)) return 1
  if (aceWins(b, a, rules)) return -1
  return Math.sign(effective(a, b, rules.wheel) - effective(b, a, rules.wheel))
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

/** The enemy defends the lane where you have more cards; on a tie, the lane with your highest-ranked card; still tied, left. */
export function defendLane(count: [number, number], best: [number, number]): 0 | 1 {
  if (count[0] !== count[1]) return count[0] > count[1] ? 0 : 1
  return best[0] >= best[1] ? 0 : 1
}

export function playerLaneInfo(g: { units: Unit[] }): { count: [number, number]; best: [number, number] } {
  const mine = (l: number) => g.units.filter(u => u.side === 'P' && u.lane === l)
  const top = (l: number) => Math.max(-1, ...mine(l).map(u => u.card.rank))
  return { count: [mine(0).length, mine(1).length], best: [top(0), top(1)] }
}

/** The enemy has no budget: each round it plays the top cards of its pile (rules.enemyPlays of them), whatever they are: one into the lane you pushed harder, then one into the other. */
function enemyPlays(g: GameState) {
  let first: 0 | 1 = 0
  for (let n = 0; n < (g.rules.enemyPlays ?? 1); n++) {
    const c = g.E.queue.shift()
    if (!c) return
    const { count, best } = playerLaneInfo(g)
    // the first card defends the lane you pushed harder, the second goes into the other lane
    const lane: 0 | 1 = n === 0 ? defendLane(count, best) : first === 0 ? 1 : 0
    if (n === 0) first = lane
    g.units.push({ uid: g.nextUid++, card: c, side: 'E', lane, pos: g.rules.laneLen - 1 })
    g.log.push(`Enemy plays ${label(c)} in the ${lane === 0 ? 'left' : 'right'} lane.`)
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
    const res = compare(p.card, e.card, g.rules)
    const bonus = (a: Card, b: Card) => (aceWins(a, b, g.rules) ? ' (ace beats a king)' : effective(a, b, g.rules.wheel) > a.rank ? ' (suit ×2)' : '')
    if (res === 0) {
      g.log.push(`${label(p.card)}${bonus(p.card, e.card)} ties ${label(e.card)}${bonus(e.card, p.card)}: both removed.`)
      kill(g, p)
      kill(g, e)
    } else if (res > 0) {
      g.log.push(`Your ${label(p.card)}${bonus(p.card, e.card)} beats enemy ${label(e.card)}${bonus(e.card, p.card)}.`)
      kill(g, e)
    } else {
      g.log.push(`Enemy ${label(e.card)}${bonus(e.card, p.card)} beats your ${label(p.card)}${bonus(p.card, e.card)}.`)
      kill(g, p)
    }
  }
}

/** A unit past the last slot is at the enemy tower. Each round it hits once; see towerHits for when it stays. */
export const atTower = (g: { rules: Rules }, u: Unit) => (u.side === 'P' && u.pos >= g.rules.laneLen) || (u.side === 'E' && u.pos < 0)

/** A tower hit is a fight against the top tower card (the wheel and aces count): the attacker breaks it on a win or a tie. */
export const breaksTower = (attacker: Card, top: Card, rules: Rules) => compare(attacker, top, rules) >= 0

/** With the armor rule, a tower card that isn't cracked yet needs two hits. */
export const armored = (g: { rules: Rules; cracked?: string[] }, id: string) => !!g.rules.armor && !(g.cracked ?? []).includes(id)

/** Towers shoot back, so every attacker does limited damage: a unit that breaks a tower card stays, wounded, for one more hit;
 *  a wounded unit goes back to its pile after that hit, and so does a unit whose hit only cracks a card. At most 2 breaks per unit. */
function towerHits(g: GameState) {
  for (const u of [...g.units]) {
    if (!atTower(g, u)) continue
    const target = g[u.side === 'P' ? 'E' : 'P']
    const lk: StackKey = u.lane === 0 ? 'L' : 'R'
    const k: StackKey = target.towers[lk].length ? lk : 'K'
    const stack = target.towers[k]
    const who = u.side === 'P' ? 'Your' : 'Enemy'
    const where = k === 'K' ? 'king tower' : `${k === 'L' ? 'left' : 'right'} tower`
    if (!stack.length) continue
    if (u.side === 'P') target.revealed[k] = true
    if (armored(g, stack[0].id) && breaksTower(u.card, stack[0], g.rules)) {
      // armor: a winning hit on a whole card only cracks it, and the attacker stays, wounded, to finish it next round
      g.log.push(`${who} ${label(u.card)} cracks the armored ${label(stack[0])} on the ${where}.`)
      g.cracked.push(stack[0].id)
      if (u.side === 'P') target.revealed[k] = false
      if (u.wounded) kill(g, u)
      else u.wounded = true
      continue
    }
    if (breaksTower(u.card, stack[0], g.rules) || g.cracked.includes(stack[0].id)) {
      g.log.push(`${who} ${label(u.card)} breaks ${label(stack[0])} on the ${where}.`)
      g.cracked = g.cracked.filter(id => id !== stack[0].id)
      stack.shift()
      if (u.side === 'P') target.revealed[k] = false
      if (u.wounded) kill(g, u)
      else u.wounded = true
      if (k !== 'K' && !stack.length) lastStand(g, u.side === 'P' ? 'E' : 'P', u.lane)
    } else {
      // the tower holds and shoots back: the card cracks and the unit goes back to its pile
      kill(g, u)
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
  if (pk && ek) {
    // both kings in the same round: more tower cards left wins, equal is a draw
    const mine = g.P.towers.L.length + g.P.towers.R.length, theirs = g.E.towers.L.length + g.E.towers.R.length
    g.winner = mine > theirs ? 'P' : mine < theirs ? 'E' : 'draw'
  } else if (ek) g.winner = 'P'
  else if (pk) g.winner = 'E'
}

/** End your round: enemy plays, everything moves, fights, tower hits, then next round's elixir. */
export function endRound(g0: GameState): GameState {
  if (g0.winner) return g0
  const g = clone(g0)
  enemyPlays(g)
  for (const u of g.units) if (!atTower(g, u)) u.pos += u.side === 'P' ? 1 : -1
  fight(g, 0)
  fight(g, 1)
  towerHits(g)
  checkWinner(g)
  g.tick++
  if (g.winner) {
    if (!g.P.towers.K.length && !g.E.towers.K.length) g.log.push(g.winner === 'P' ? 'Both kings fell; you have more tower cards left. YOU WIN.' : g.winner === 'E' ? 'Both kings fell; the enemy has more tower cards left. You lose.' : 'Both kings fell with the same tower cards left. Draw.')
    else g.log.push(g.winner === 'P' ? 'You destroyed the enemy king. YOU WIN.' : 'Your king fell. You lose.')
    return g
  }
  g.P.elixir = Math.min(g.rules.cap, g.P.elixir + g.rules.regen)
  g.log.push(`— Round ${g.tick + 1} —`)
  return g
}

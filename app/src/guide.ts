// Guide engine: you play with real cards; this runs the rules and tells you what to do physically.
// The enemy's face-down cards are unknown (null) until you flip them and tell the app.
import { DECK_SIZE, DEFAULT_RULES, RANKS, SUITS, atTower, breaksTower, compare, cost, defendLane, effective, label, playerLaneInfo, shuffle, towersFromSlots, aceWins } from './engine.ts'
import type { Card, Rules, StackKey, Towers, Unit } from './engine.ts'

export type Stage =
  | 'round_start' | 'my_play' | 'enemy_enter' | 'enemy_play' | 'enemy_peek' | 'enemy_stop'
  | 'step_up' | 'fight' | 'move' | 'tower_enter' | 'tower_result' | 'my_last_stand' | 'last_stand_enter' | 'over'

// Every physical card has a stable tracking id (tid) so the board can animate it. Enemy cards are unknown until flipped.
export interface ESlot { tid: string; card: Card | null }
export interface ETowers { L: ESlot[]; R: ESlot[]; K: ESlot[] }
export interface Discarded { tid: string; card: Card; owner: 'P' | 'E' }
/** What a step did, as data, so the screen can animate it (the sentences in lines/log stay the instructions). */
export type GameEvent =
  | { type: 'round'; round: number; gain: number }
  | { type: 'play'; side: 'P' | 'E'; tid: string; card: Card; lane: 0 | 1; cost: number; free?: boolean }
  | { type: 'move'; tids: string[] } // cards that stepped one slot (a card stepping up after a fight, or the move once the fights are over)
  | { type: 'fight'; lane: 0 | 1; mine: { tid: string; card: Card; value: number }; theirs: { tid: string; card: Card; value: number }
      double: 'P' | 'E' | null; ace: 'P' | 'E' | null; winner: 'P' | 'E' | 'tie' }
  | { type: 'reveal'; tid: string; card: Card; stack: StackKey } // an enemy tower card turned face-up before a hit
  | { type: 'tower'; side: 'P' | 'E'; tid: string; card: Card; stack: StackKey; top: { tid: string; card: Card }; result: 'break' | 'crack'; wasCracked: boolean; destroyed: boolean }
  | { type: 'over'; winner: 'P' | 'E' | 'draw' }

export interface Stats {
  overkills: string[]; leakRounds: number; placed: number; mineBroken: number; theirsBroken: number; rounds: number
  // what cost you the most, for the end-of-game lesson (optional: games saved before they were kept don't have them)
  undefended?: number    // your tower cards broken by an enemy card in a lane where you had no card when you ended your turn
  wheelLosses?: string[] // fights you lost only because the enemy's suit beat yours
  aceLosses?: string[]   // your picture cards beaten by an enemy ace
}

export interface GuideState {
  rules: Rules
  stage: Stage
  round: number
  units: Unit[]
  nextUid: number
  P: { hand: Card[]; queue: Card[]; elixir: number; towers: Towers }
  E: { queue: ESlot[]; towers: ETowers } // no elixir: the enemy plays one card per round
  discard: Discarded[]
  dealt: Card[] // your 14 cards
  enemySeen: Card[]
  lines: string[]      // what to do physically right now
  why: string[]        // why (rule explanation) for this step
  lastAction: string[] // instructions for your most recent play
  log: string[]
  hitQueue: number[]
  winner: null | 'P' | 'E' | 'draw'
  cracked?: string[] // tower cards turned sideways by a failed hit (tids); any later hit breaks them
  lastStand?: { side: 'P' | 'E'; lane: 0 | 1 } | null // a princess tower just fell: its owner places one card there for free
  peek?: 'play' | 'move' // flipping the enemy's new top card face-up, then going on to your play or to the fights
  stepped?: number[] // units that already moved this round (uids)
  turn?: Placed[] // the cards you placed this turn, in order: until you end it, any of them can be taken back
  stats: Stats
  events?: GameEvent[] // what the latest step did
  openLanes?: number[] // lanes where you had no card when you ended your turn
  batched?: boolean // this step is several steps in one checklist (see extendBatch)
}

const laneName = (l: number) => (l === 0 ? 'LEFT' : 'RIGHT')
const stackName = (k: StackKey) => (k === 'K' ? 'KING tower' : k === 'L' ? 'LEFT tower' : 'RIGHT tower')
const clone = (g: GuideState): GuideState => structuredClone(g)
/** Every exported transition starts a new step: a fresh copy with no events yet. */
const step = (g0: GuideState): GuideState => ({ ...clone(g0), events: [], batched: undefined })
const emit = (g: GuideState, e: GameEvent) => { (g.events ??= []).push(e) }
const bonusNote = (a: Card, b: Card, r: Rules) =>
  aceWins(a, b, r) ? ' (ace: beats pictures)' : effective(a, b, r.wheel) > a.rank ? ` (winning suit: counts double, ${effective(a, b, r.wheel)})` : ''

export function makeGame(deck: Card[], towerSlots: Card[], dealt: Card[], rules: Rules = DEFAULT_RULES): GuideState {
  const d = shuffle(deck)
  return {
    rules,
    stage: 'round_start',
    round: 0,
    units: [],
    nextUid: 1,
    P: { hand: d.slice(0, 4), queue: d.slice(4), elixir: rules.startElixir, towers: towersFromSlots(towerSlots) },
    E: {
      queue: Array.from({ length: DECK_SIZE }, (_, i) => ({ tid: `ep${i}`, card: null })),
      towers: {
        L: [0, 1].map(i => ({ tid: `et${i}`, card: null })),
        R: [2, 3].map(i => ({ tid: `et${i}`, card: null })),
        K: [4, 5].map(i => ({ tid: `et${i}`, card: null })),
      },
    },
    discard: [],
    dealt,
    enemySeen: [],
    lines: [], why: [], lastAction: [], log: [],
    hitQueue: [],
    cracked: [],
    winner: null,
    stats: { overkills: [], leakRounds: 0, placed: 0, mineBroken: 0, theirsBroken: 0, rounds: 0 },
  }
}

export function excludedIds(g: GuideState): Set<string> {
  return new Set([...g.dealt, ...g.enemySeen].map(c => c.id))
}

// ---------- elixir marker ----------
// Each physical bar is 10 face-down cards; the one turned sideways marks the elixir (its position from the left, 0 = none).
const markerAt = (n: number) => n ? `card ${n} sideways` : 'no card sideways (straighten it)'

function gainLine(before: number, after: number, cap: number) {
  if (after === before) return `Your bar is full, the marker stays on card ${after}.`
  return `Move your marker ${after - before} to the right, to ${markerAt(after)}${after === cap ? ' (the bar is full)' : ''}. You now have ${after} elixir.`
}

function spendLine(k: number, after: number) {
  return `Move your marker ${k} to the left, to ${markerAt(after)} (${after} elixir left).`
}

// ---------- round flow ----------
export function startRound(g0: GuideState): GuideState {
  return newRound(step(g0))
}

function newRound(g: GuideState): GuideState {
  g.round += 1
  const p0 = g.P.elixir
  g.P.elixir = Math.min(g.rules.cap, g.P.elixir + g.rules.regen)
  g.stage = 'round_start'
  g.lastAction = []
  g.lines = [gainLine(p0, g.P.elixir, g.rules.cap)]
  g.why = ['Elixir is the position of the sideways card in a bar, counted from the left (no card sideways = 0). It refills a little every round, never past 10, and is what limits how much you can play.']
  g.log.push(`— Round ${g.round} —`)
  emit(g, { type: 'round', round: g.round, gain: g.P.elixir - p0 })
  return g
}

export function next(g0: GuideState): GuideState {
  const g = step(g0)
  switch (g.stage) {
    case 'round_start': return peekOr(g, 'play')
    case 'enemy_play': return peekOr(g, 'move') // one card per round: the enemy turn is over
    case 'enemy_peek': return goFight(g)
    case 'enemy_stop': return goFight(g)
    case 'step_up': return resolveNext(g)
    case 'move': return resolveNext(g)
    case 'fight': return resolveNext(g)
    case 'tower_enter': return processHit(g) // its top card was revealed as a step of its own: now the hit lands
    case 'tower_result': return g.lastStand ? lastStandStep(g) : processHit(g)
    default: return g
  }
}

// ---------- many steps in one ----------
// With real cards, an experienced player can take a round's fights, moves and tower hits as one checklist: steps that need nothing
// from you (no flipped card, no choice) run on, their instructions in order, until one does or the round ends.
const PHASE: Stage[] = ['step_up', 'fight', 'move', 'tower_result']
export function extendBatch(g0: GuideState): GuideState {
  if (!PHASE.includes(g0.stage)) return g0
  let g = g0
  const lines = [...g.lines], why = [...g.why], events = [...(g.events ?? [])]
  for (;;) {
    const n = next(g)
    if (!PHASE.includes(n.stage)) break
    g = n
    lines.push(...n.lines)
    for (const w of n.why) if (!why.includes(w)) why.push(w)
    events.push(...(n.events ?? []))
  }
  return g === g0 ? g0 : { ...g, lines, why, events, batched: true }
}

// ---------- your play ----------
export function canPlay(g: GuideState, i: number) {
  const c = g.P.hand[i]
  return g.stage === 'my_play' && !!c && cost(c.rank) <= g.P.elixir
}

function refill(g: GuideState): string[] {
  const out: string[] = []
  while (g.P.hand.length < 4 && g.P.queue.length) {
    const c = g.P.queue.shift()!
    g.P.hand.push(c)
    out.push(`Draw ${label(c)} from the top of your queue into your hand.`)
  }
  return out
}

/** A card you placed this turn: where it came from in your hand and how many cards you drew for it, so it can be taken back exactly. */
interface Placed { id: string; lane: 0 | 1; at: number; drew: number }
const playLog = (c: Card, lane: 0 | 1) => `You play ${label(c)} (cost ${cost(c.rank)}) in the ${laneName(lane).toLowerCase()} lane.`

export function playCard(g0: GuideState, i: number, lane: 0 | 1): GuideState {
  if (!canPlay(g0, i)) return g0
  const g = step(g0)
  place(g, i, lane)
  return g
}

function place(g: GuideState, i: number, lane: 0 | 1) {
  const c = g.P.hand.splice(i, 1)[0]
  const k = cost(c.rank)
  g.P.elixir -= k
  g.units.push({ uid: g.nextUid++, card: c, side: 'P', lane, pos: 0, tid: c.id })
  g.stats.placed++
  const drawn = refill(g)
  ;(g.turn ??= []).push({ id: c.id, lane, at: i, drew: drawn.length })
  g.lastAction = [
    spendLine(k, g.P.elixir),
    `Place ${label(c)} in the ${laneName(lane)} lane, slot nearest YOU.`,
    ...drawn,
  ]
  g.log.push(playLog(c, lane))
  emit(g, { type: 'play', side: 'P', tid: c.id, card: c, lane, cost: k })
}

/** Your turn is a draft until you end it: take back a card you placed this turn, as if you had never played it (its elixir comes
 *  back, and the cards you drew for it go back on top of your queue), or with a lane, move it there. Any later plays stay put. */
export function takeBack(g0: GuideState, id: string, lane?: 0 | 1): GuideState {
  const j = g0.stage === 'my_play' ? (g0.turn ?? []).findIndex(p => p.id === id) : -1
  if (j < 0 || lane === g0.turn![j].lane) return g0
  if (lane === undefined) return rework(g0, j, g0.turn!.slice(j + 1)) ?? g0
  const g = step(g0)
  const u = g.units.find(x => x.side === 'P' && x.tid === id)!
  relog(g, u.card, u.lane, lane)
  u.lane = g.turn![j].lane = lane
  g.lastAction = []
  return g
}

/** Two cards switch places during your turn (by id): two cards you placed this turn swap lanes and their places in the slot (in a
 *  slot, the card placed first fights first), or a placed card and a hand card trade: the hand card goes where the placed one was,
 *  and the placed one comes back to your hand as if never played. Returns the same state when the switch can't be made: an
 *  unaffordable card, or a hand card you only have because you played the other one. */
export function switchCards(g0: GuideState, a: string, b: string): GuideState {
  const turn = g0.stage === 'my_play' ? g0.turn ?? [] : []
  const ja = turn.findIndex(p => p.id === a), jb = turn.findIndex(p => p.id === b)
  if (a === b || (ja < 0 && jb < 0)) return g0
  if (ja >= 0 && jb >= 0) {
    const g = step(g0)
    const ia = g.units.findIndex(u => u.tid === a), ib = g.units.findIndex(u => u.tid === b)
    const ua = g.units[ia], ub = g.units[ib]
    if (ua.lane !== ub.lane) { relog(g, ua.card, ua.lane, ub.lane); relog(g, ub.card, ub.lane, ua.lane) }
    ;[ua.lane, ub.lane] = [ub.lane, ua.lane]
    g.units[ia] = ub; g.units[ib] = ua
    g.turn![ja].lane = ua.lane; g.turn![jb].lane = ub.lane
    g.lastAction = []
    return g
  }
  const [placed, hand, j] = ja >= 0 ? [a, b, ja] : [b, a, jb]
  if (!g0.P.hand.some(c => c.id === hand)) return g0
  const swapIn = { id: hand, lane: turn[j].lane }, later = turn.slice(j + 1)
  // in its turn order if it was in your hand then, or else last, once the later plays have drawn it again
  return rework(g0, j, [swapIn, ...later], { [hand]: placed }) ?? rework(g0, j, [...later, swapIn], { [hand]: placed }) ?? g0
}

const relog = (g: GuideState, c: Card, from: 0 | 1, to: 0 | 1) => {
  const k = g.log.lastIndexOf(playLog(c, from))
  if (k >= 0) g.log[k] = playLog(c, to)
}

/** Unwinds your plays from the j-th one on (cards back in hand, the cards drawn for them back on the queue, elixir back), then makes
 *  these plays instead; null if one can't be made. Cards keep their places in their slots; a card in "stands" takes another's place. */
function rework(g0: GuideState, j: number, plays: { id: string; lane: 0 | 1 }[], stands: Record<string, string> = {}): GuideState | null {
  const g = step(g0)
  const order = g.units.map(u => u.tid)
  for (const p of g.turn!.splice(j).reverse()) {
    const u = g.units.find(x => x.side === 'P' && x.tid === p.id)!
    g.units = g.units.filter(x => x !== u)
    for (let n = 0; n < p.drew; n++) g.P.queue.unshift(g.P.hand.pop()!)
    g.P.hand.splice(p.at, 0, u.card)
    g.P.elixir += cost(u.card.rank)
    g.stats.placed--
    const k = g.log.lastIndexOf(playLog(u.card, p.lane))
    if (k >= 0) g.log.splice(k, 1)
  }
  for (const p of plays) {
    const i = g.P.hand.findIndex(c => c.id === p.id)
    if (i < 0 || cost(g.P.hand[i].rank) > g.P.elixir) return null
    place(g, i, p.lane)
  }
  const rank = (u: Unit) => { const k = order.indexOf(stands[u.tid!] ?? u.tid); return k < 0 ? order.length : k }
  g.units.sort((x, y) => rank(x) - rank(y))
  g.lastAction = []
  g.events = [] // nothing new was played
  return g
}

export function endMyTurn(g0: GuideState): GuideState {
  const g = step(g0)
  if (g.P.elixir >= g.rules.cap) g.stats.leakRounds++
  g.openLanes = ([0, 1] as const).filter(l => !g.units.some(u => u.side === 'P' && u.lane === l))
  g.lastAction = []
  return enemyStep(g)
}

// ---------- enemy ----------
/** The enemy's top card is always face-up, so you always know its next play: whenever it is face-down, flip it first. */
function peekOr(g: GuideState, then: 'play' | 'move'): GuideState {
  if (g.E.queue[0]?.card === null) {
    g.stage = 'enemy_enter'
    g.peek = then
    g.lines = ['Flip the TOP card of the enemy pile face-up, leave it on top, and tell the app which card it is. That is the card the enemy plays next round.']
    g.why = ["The enemy's top card is always face-up, so you always know what it plays next. Plan around it."]
    return g
  }
  return then === 'play' ? toMyPlay(g) : goFight(g)
}

function toMyPlay(g: GuideState): GuideState {
  g.stage = 'my_play'; g.lines = []; g.why = []; g.turn = []
  return g
}

function enemyStep(g: GuideState): GuideState {
  const q = g.E.queue
  if (!q.length) {
    g.stage = 'enemy_stop'
    g.lines = ['The enemy has no cards left in its pile, so it plays nothing.']
    g.why = ['Cards on the table stay there until they die, then go to the bottom of their pile.']
    return g
  }
  if (q[0].card === null) {
    g.stage = 'enemy_enter'
    g.lines = ['Flip the TOP card of the enemy pile face-up and tell the app which card it is.']
    g.why = ['The enemy plays its pile from the top, in order. You only learn a card by flipping it.']
    return g
  }
  return enemyDecide(g)
}

export function enterEnemyCard(g0: GuideState, card: Card): GuideState {
  const g = step(g0)
  g.E.queue[0].card = card
  g.enemySeen.push(card)
  if (g.peek) { const then = g.peek; g.peek = undefined; return then === 'play' ? toMyPlay(g) : goFight(g) }
  return g.stage === 'last_stand_enter' ? enemyLastStand(g) : enemyDecide(g)
}

/** On screen, the enemy's next card is flipped after its play as a step of its own, so the cards move on the step after it. */
function peekEnemyCard(g0: GuideState, card: Card): GuideState {
  const g = step(g0)
  g.E.queue[0].card = card
  g.enemySeen.push(card)
  g.peek = undefined
  g.stage = 'enemy_peek'
  g.lines = [`The enemy's next card is ${label(card)}. It plays that card next round.`]
  g.why = []
  return g
}

/** The enemy has no elixir: it plays the top card of its pile, one card per round, whatever it costs. */
function enemyDecide(g: GuideState): GuideState {
  const slot = g.E.queue.shift()!
  const c = slot.card!
  const { count: mine, best } = playerLaneInfo(g)
  const lane = defendLane(mine, best)
  g.units.push({ uid: g.nextUid++, card: c, side: 'E', lane, pos: g.rules.laneLen - 1, tid: slot.tid })
  g.stage = 'enemy_play'
  g.lines = [
    `ENEMY PLAYS ${label(c)}.`,
    `Place ${label(c)} in the ${laneName(lane)} lane, slot nearest the ENEMY. That is its one card this round.`,
  ]
  g.why = [`The enemy has no elixir: every round it plays the top card of its pile, whatever it costs. It defends: the card goes into the lane where you have MORE units (on a tie, the lane with your highest-ranked card; still tied, left). You have ${mine[0]} on the left and ${mine[1]} on the right.`]
  g.log.push(`Enemy plays ${label(c)} in the ${laneName(lane).toLowerCase()} lane.`)
  emit(g, { type: 'play', side: 'E', tid: slot.tid, card: c, lane, cost: 0 })
  return g
}

// ---------- fight / move ----------
// After the enemy's play, one thing at a time: in each lane the front cards that face each other fight where they stand. When a
// card falls, the card behind it steps up one slot (its move this round) and fights next. When no fights are left, every card
// that hasn't moved yet steps one slot, and then cards at a tower hit it. Cards never pass through each other.

/** A side's front card in a lane (furthest advanced; in a shared slot, the one that got there first), or null. */
function front(g: GuideState, lane: 0 | 1, side: 'P' | 'E'): Unit | null {
  const us = g.units.filter(u => u.lane === lane && u.side === side)
  if (!us.length) return null
  return side === 'P' ? us.reduce((a, b) => (b.pos > a.pos ? b : a)) : us.reduce((a, b) => (b.pos < a.pos ? b : a))
}

/** Front cards in the same or neighbouring slots face each other, so they fight. */
function facing(g: GuideState, lane: 0 | 1) {
  const p = front(g, lane, 'P'), e = front(g, lane, 'E')
  return p && e && e.pos - p.pos <= 1 ? { p, e } : null
}

/** The fights begin: the cards in the front slots that face each other fight where they stand (held); nothing has moved yet. */
function beginFights(g: GuideState) {
  g.stepped = []
  for (const u of g.units) u.held = false
  for (const lane of [0, 1] as const) {
    const f = facing(g, lane)
    if (!f) continue
    for (const u of g.units) if (u.lane === lane && ((u.side === 'P' && u.pos === f.p.pos) || (u.side === 'E' && u.pos === f.e.pos))) u.held = true
  }
}

const towardEnemy = (u: Unit) => (u.side === 'P' ? 1 : -1)
/** An enemy card in this card's slot or behind it is in the way: cards never pass through each other. */
const blocked = (g: GuideState, u: Unit) => g.units.some(x => x.lane === u.lane && x.side !== u.side && (u.side === 'P' ? x.pos <= u.pos : x.pos >= u.pos))
const canStep = (g: GuideState, u: Unit) => !atTower(g, u) && !g.stepped?.includes(u.uid) && !blocked(g, u)

/** In a lane where both sides have cards, a front card that wasn't facing an enemy at the start (the card ahead of it fell) steps up
 *  one slot before it fights, with any card that shares its slot. */
function stepUps(g: GuideState): Unit[] {
  const out: Unit[] = []
  for (const lane of [0, 1] as const) {
    for (const side of ['P', 'E'] as const) {
      const f = front(g, lane, side)
      if (!f || !front(g, lane, side === 'P' ? 'E' : 'P') || f.held || !canStep(g, f)) continue
      out.push(...g.units.filter(u => u.lane === lane && u.side === side && u.pos === f.pos && !u.held && canStep(g, u)))
    }
  }
  return out
}

/** The cards that move when the fights are over: every card that hasn't moved this round and isn't at a tower. */
const movers = (g: GuideState) => g.units.filter(u => !atTower(g, u) && !g.stepped?.includes(u.uid))

/** These cards step one slot toward the other side, once a round. Each goes to the back of its new slot: it arrived last, so it
 *  fights after the cards already there and is drawn after them. (Among a side's cards in one slot, the first in g.units is the front one.) */
function stepForward(g: GuideState, moved: Unit[]) {
  for (const u of moved) { u.pos += towardEnemy(u); u.held = false }
  ;(g.stepped ??= []).push(...moved.map(u => u.uid))
  g.units = [...g.units.filter(u => !moved.includes(u)), ...moved]
}

const slotName = (g: GuideState, u: Unit) => atTower(g, u) ? `the ${u.side === 'P' ? 'enemy' : 'your'} tower` : u.pos === 0 ? 'the slot nearest YOU' : 'the slot nearest the ENEMY'
const whose = (u: Unit) => (u.side === 'P' ? 'your' : 'the enemy')

/** What meets on the very next step, so the screen can show it squaring up first: the two cards that fight next (one fight per step,
 *  left lane first, as resolveNext does), or once the fights and the move are over, the next card to hit a tower and that tower (its
 *  anchor id, "tower-E-L"). Nothing while a card is about to step up or move. Cards are named by tid. */
export function fightingNext(g0: GuideState): string[] {
  // a hit on a face-down enemy tower card squares up only on the step that turns that card up (tower_enter), so the shake and the
  // reveal come together and the hit lands next
  const hit = (g: GuideState, u: Unit | undefined, revealing = false) => {
    if (!u) return []
    const k = hitTarget(g, u)
    if (!revealing && u.side === 'P' && g.E.towers[k][0]?.card === null) return []
    return [u.tid!, `tower-${u.side === 'P' ? 'E' : 'P'}-${k}`]
  }
  if (g0.stage === 'tower_enter') return hit(g0, g0.units.find(x => x.uid === g0.hitQueue[0]), true)
  if (g0.stage === 'tower_result' && !g0.lastStand) return hit(g0, g0.units.find(x => x.uid === g0.hitQueue[0]))
  // the fights come right after the enemy's turn (once its next card is face-up)
  const before = g0.stage === 'enemy_peek' || g0.stage === 'enemy_stop' || (g0.stage === 'enemy_play' && g0.E.queue[0]?.card !== null)
  if (!before && g0.stage !== 'step_up' && g0.stage !== 'fight' && g0.stage !== 'move') return []
  const g = before ? clone(g0) : g0
  if (before) beginFights(g)
  if (stepUps(g).length) return []
  for (const lane of [0, 1] as const) {
    const f = facing(g, lane)
    if (f) return [f.p.tid!, f.e.tid!]
  }
  if (movers(g).length) return []
  // no fight or move left: the hits come next, in the order processHit takes them
  return hit(g, hitOrder(g)[0])
}

function kill(g: GuideState, u: Unit): string[] {
  g.units = g.units.filter(x => x.uid !== u.uid)
  if (u.side === 'P') {
    g.P.queue.push(u.card)
    return [`Put your ${label(u.card)} at the BOTTOM of your queue.`, ...refill(g)]
  }
  g.E.queue.push({ tid: u.tid!, card: u.card })
  return [`Put the enemy ${label(u.card)} at the BOTTOM of the enemy pile, FACE-UP (you know this card now, so you won't need to flip it again).`]
}

/** The enemy's turn is over: the fights begin. */
function goFight(g: GuideState): GuideState {
  beginFights(g)
  return resolveNext(g)
}

/** The next thing that happens, one per step: a card steps up, a fight, the move, then the tower hits. */
function resolveNext(g: GuideState): GuideState {
  const ups = stepUps(g)
  if (ups.length) {
    stepForward(g, ups)
    g.stage = 'step_up'
    g.lines = ups.map(u => {
      const f = facing(g, u.lane)
      return `${laneName(u.lane)} lane: the card in front of ${whose(u)} ${label(u.card)} fell, so it steps up: move it one slot forward, to ${slotName(g, u)}${f ? `. It fights ${f.p === u ? `the enemy ${label(f.e.card)}` : f.e === u ? `your ${label(f.p.card)}` : 'next'}` : ''}.`
    })
    g.why = ['When a card falls, the card behind it steps up one slot (that is its move this round) and fights next. Cards never pass through each other.']
    emit(g, { type: 'move', tids: ups.map(u => u.tid!) })
    return g
  }
  for (const lane of [0, 1] as const) {
    const f = facing(g, lane)
    if (!f) continue
    const { p, e } = f
    const r = compare(p.card, e.card, g.rules)
    const ace = aceWins(p.card, e.card, g.rules) || aceWins(e.card, p.card, g.rules)
    const pv = effective(p.card, e.card, g.rules.wheel), ev = effective(e.card, p.card, g.rules.wheel)
    emit(g, {
      type: 'fight', lane,
      mine: { tid: p.tid!, card: p.card, value: pv }, theirs: { tid: e.tid!, card: e.card, value: ev },
      double: pv > p.card.rank ? 'P' : ev > e.card.rank ? 'E' : null,
      ace: aceWins(p.card, e.card, g.rules) ? 'P' : aceWins(e.card, p.card, g.rules) ? 'E' : null,
      winner: r > 0 ? 'P' : r < 0 ? 'E' : 'tie',
    })
    delete p.free; delete e.free // a last-stand card is an ordinary card once it has fought
    const head = `${laneName(lane)} lane: your ${label(p.card)}${bonusNote(p.card, e.card, g.rules)} vs enemy ${label(e.card)}${bonusNote(e.card, p.card, g.rules)}.`
    let res: string[]
    if (r === 0) {
      res = ['Equal rank: BOTH cards are removed.', ...kill(g, p), ...kill(g, e)]
      g.log.push(`${label(p.card)} ties ${label(e.card)}: both removed.`)
    } else if (r > 0) {
      res = [`YOUR ${label(p.card)} WINS and stays where it is.`, ...kill(g, e)]
      g.log.push(`Your ${label(p.card)} beats enemy ${label(e.card)}.`)
      if (!ace && cost(p.card.rank) - cost(e.card.rank) >= 4) {
        g.stats.overkills.push(`In round ${g.round} your ${label(p.card)} (${cost(p.card.rank)} elixir) beat a ${label(e.card)} (${cost(e.card.rank)} elixir). A cheaper card would have won too.`)
      }
    } else {
      res = [`The ENEMY ${label(e.card)} WINS and stays where it is.`, ...kill(g, p)]
      g.log.push(`Enemy ${label(e.card)} beats your ${label(p.card)}.`)
      if (aceWins(e.card, p.card, g.rules)) {
        (g.stats.aceLosses ??= []).push(`The enemy ${label(e.card)} beat your ${label(p.card)}: aces beat J, Q and K. When the enemy's next card is an ace, meet it with a cheap card, not a picture card.`)
      } else if (ev > e.card.rank && p.card.rank > e.card.rank) {
        (g.stats.wheelLosses ??= []).push(`Your ${label(p.card)} lost to ${label(e.card)}: ${SUITS[e.card.suit]} beats ${SUITS[p.card.suit]}, so the ${RANKS[e.card.rank]} counted double. Check the wheel before you pick a card: ♠ › ♥ › ♦ › ♣ › ♠.`)
      }
    }
    g.stage = 'fight'
    g.lines = [head, ...res]
    g.why = [ace
      ? 'Aces beat picture cards (J, Q, K), whatever the suits. The winner stays and fights the next card; the loser goes to the bottom of its pile.'
      : 'The front cards fight where they stand. Higher rank wins; a card of the suit that beats the other counts double. The winner stays and fights the next card; the loser goes to the bottom of its pile.']
    return g
  }
  const ms = movers(g)
  if (ms.length) {
    // with no fight left, nothing is in the way of a card that hasn't moved yet; a blocked one (never, in practice) just stays
    const go = ms.filter(u => !blocked(g, u))
    ;(g.stepped ??= []).push(...ms.map(u => u.uid))
    stepForward(g, go)
    if (go.length) {
      g.stage = 'move'
      g.lines = [
        `MOVE ${go.map(u => `${whose(u)} ${label(u.card)}`).join(', ')} one slot toward the other side: your cards go away from you, enemy cards come toward you.`,
        'A card that moves past the last slot is now "at the tower" (the board shows it in the slot next to that tower). Cards already at a tower stay there.',
      ]
      g.why = ['When the fights are over, every card that hasn\'t moved yet this round steps one slot. A card at a tower stays there until an enemy card beats it.']
      emit(g, { type: 'move', tids: go.map(u => u.tid!) })
      return g
    }
  }
  g.hitQueue = hitOrder(g).map(u => u.uid)
  return processHit(g)
}

// ---------- tower hits ----------
/** The cards at a tower, in the order they hit: left lane first, then right; in a lane, the card that got there first. */
const hitOrder = (g: GuideState) => g.units.filter(u => atTower(g, u)).sort((a, b) => a.lane - b.lane)

function hitTarget(g: GuideState, u: Unit): StackKey {
  const targetTowers = u.side === 'P' ? g.E.towers : g.P.towers
  const lk: StackKey = u.lane === 0 ? 'L' : 'R'
  return targetTowers[lk].length ? lk : 'K'
}

function processHit(g: GuideState): GuideState {
  while (g.hitQueue.length) {
    const u = g.units.find(x => x.uid === g.hitQueue[0])
    if (!u) { g.hitQueue.shift(); continue }
    const k = hitTarget(g, u)
    const tstack = u.side === 'P' ? g.E.towers[k] : g.P.towers[k]
    if (!tstack.length) {
      // the king was already destroyed earlier this round: this unit has nothing left to hit
      g.hitQueue.shift()
      g.units = g.units.filter(x => x.uid !== u.uid)
      if (u.side === 'P') { g.P.queue.push(u.card); refill(g) } else g.E.queue.push({ tid: u.tid!, card: u.card })
      continue
    }
    if (u.side === 'P' && g.E.towers[k][0].card === null) {
      g.stage = 'tower_enter'
      g.lines = [
        `Your ${label(u.card)} is at the enemy ${stackName(k)}.`,
        `Flip the TOP card of the enemy ${stackName(k)} face-up and tell the app which card it is.`,
      ]
      g.why = ['A tower hit is a fight against the top tower card: the suit wheel and aces count. If your unit wins or ties, the card breaks. If it loses, the card cracks instead, and the next hit on it breaks it.']
      return g
    }
    return resolveHit(g, u, k)
  }
  return finishRound(g)
}

export function enterTowerCard(g0: GuideState, card: Card): GuideState {
  const g = step(g0)
  const u = g.units.find(x => x.uid === g.hitQueue[0])!
  const k = hitTarget(g, u)
  g.E.towers[k][0].card = card
  g.enemySeen.push(card)
  return resolveHit(g, u, k)
}

/** On screen, the tower card the hit is about to land on is turned face-up first, as a step of its own, so you see it before it breaks or cracks. */
export function revealTowerCard(g0: GuideState, card: Card): GuideState {
  const g = step(g0)
  const u = g.units.find(x => x.uid === g.hitQueue[0])!
  const k = hitTarget(g, u)
  const top = g.E.towers[k][0]
  top.card = card
  g.enemySeen.push(card)
  emit(g, { type: 'reveal', tid: top.tid, card, stack: k })
  g.lines = [`Your ${label(u.card)} is at the enemy ${stackName(k)}.`, `Its top card is ${label(card)}.`]
  return g
}

function resolveHit(g: GuideState, u: Unit, k: StackKey): GuideState {
  g.hitQueue.shift()
  const mineHit = u.side === 'P'
  const top: Card = mineHit ? g.E.towers[k][0].card! : g.P.towers[k][0]
  const owner = mineHit ? 'enemy' : 'your'
  const topId = mineHit ? g.E.towers[k][0].tid : g.P.towers[k][0].id
  const cracked = g.cracked ?? []
  const wasCracked = cracked.includes(topId)
  const won = breaksTower(u.card, top, g.rules)
  const broken = wasCracked || won
  const av = effective(u.card, top, g.rules.wheel), tv = effective(top, u.card, g.rules.wheel)
  const versus = aceWins(u.card, top, g.rules) || aceWins(top, u.card, g.rules)
    ? `${label(aceWins(u.card, top, g.rules) ? u.card : top)} is an ace, and aces beat picture cards`
    : `${label(u.card)}${av > u.card.rank ? ` counts ${av}` : ''} ${won ? '≥' : '<'} ${label(top)}${tv > top.rank ? ` counts ${tv}` : ''}`
  const stackLeft = (mineHit ? g.E.towers[k] : g.P.towers[k]).length - (broken ? 1 : 0)
  emit(g, { type: 'tower', side: u.side, tid: u.tid!, card: u.card, stack: k, top: { tid: topId, card: top }, result: broken ? 'break' : 'crack', wasCracked, destroyed: stackLeft === 0 })
  delete u.free
  const lines: string[] = []
  lines.push(`${mineHit ? 'Your' : 'Enemy'} ${label(u.card)} (rank ${u.card.rank}) hits ${owner} ${stackName(k)}, top card ${label(top)} (rank ${top.rank}${wasCracked ? ', CRACKED' : ''}).`)
  if (broken) {
    g.cracked = cracked.filter(id => id !== topId)
    if (mineHit) { const r = g.E.towers[k].shift()!; g.discard.push({ tid: r.tid, card: r.card!, owner: 'E' }) }
    else { const r = g.P.towers[k].shift()!; g.discard.push({ tid: r.id, card: r, owner: 'P' }) }
    lines.push(`${wasCracked && !won ? `${label(top)} was already cracked` : versus}: the tower card BREAKS. Discard ${label(top)} (set it aside).`)
    if (mineHit) g.stats.theirsBroken++; else g.stats.mineBroken++
    if (!mineHit && g.openLanes?.includes(u.lane)) g.stats.undefended = (g.stats.undefended ?? 0) + 1
    const fell = mineHit ? g.E.towers : g.P.towers
    if (k !== 'K' && !fell[k].length && g.E.towers.K.length && g.P.towers.K.length) {
      g.lastStand = { side: mineHit ? 'E' : 'P', lane: k === 'L' ? 0 : 1 }
    }
    g.log.push(`${mineHit ? 'Your' : 'Enemy'} ${label(u.card)} breaks ${label(top)} on the ${stackName(k).toLowerCase()}.`)
  } else {
    const st = mineHit ? g.E.towers[k] : g.P.towers[k]
    if (st.length > 1) (st as unknown[]).push((st as unknown[]).shift())
    g.cracked = [...cracked, topId]
    lines.push(`${versus}: the tower HOLDS, but ${label(top)} CRACKS. Turn it SIDEWAYS and move it to the BOTTOM of that tower${mineHit ? ', face-up (you know it now)' : ''}.${st.length > 1 ? ' The next card is now on top.' : ''} Any later hit breaks it.`)
    g.log.push(`${mineHit ? 'Your' : 'Enemy'} ${label(u.card)} hits the ${stackName(k).toLowerCase()}: ${label(top)} holds but cracks.`)
  }
  // towers shoot back: a unit that breaks a card stays, wounded, for one more hit; otherwise it goes back to its pile
  if (broken && !u.wounded) {
    u.wounded = true
    if (g.E.towers.K.length && g.P.towers.K.length) lines.push(`Turn ${mineHit ? 'your' : 'the enemy'} ${label(u.card)} SIDEWAYS and leave it at the tower: it is wounded, and hits once more next round (unless ${mineHit ? 'an enemy card' : 'one of your cards'} beats it first).`)
  } else {
    const gone = broken ? `${mineHit ? 'Your' : 'The enemy'} ${label(u.card)} was wounded, so that was its last hit.` : 'The tower shoots it back.'
    g.units = g.units.filter(x => x.uid !== u.uid)
    if (u.side === 'P') { g.P.queue.push(u.card); lines.push(`${gone} Put your ${label(u.card)} at the BOTTOM of your queue.`, ...refill(g)) }
    else { g.E.queue.push({ tid: u.tid!, card: u.card }); lines.push(`${gone} Put the enemy ${label(u.card)} at the BOTTOM of the enemy pile, FACE-UP (it is a known card now).`) }
  }
  if (g.lastStand) lines.push(`The ${owner} ${stackName(k)} is DESTROYED. ${mineHit ? 'The enemy gets a LAST STAND' : 'You get a LAST STAND'}: one free card in that lane (next step).`)
  g.stage = 'tower_result'
  g.lines = lines
  g.why = ['A tower hit is a fight against the top tower card (the suit wheel and aces count; a tie breaks it). Towers shoot back, so every attacker does limited damage: a unit that breaks a card stays, turned sideways (wounded), for one more hit, then goes back to its pile. A unit that loses only cracks the card (turned sideways, moved to the bottom of that tower) and goes back. Any later hit breaks a cracked card, so even small cards wear towers down. The king can only be hit after the princess tower in that lane is gone. When a princess tower falls, its owner gets a free last-stand card in that lane.']
  return g
}

// ---------- last stand ----------
// When a princess stack falls, its owner immediately places one card in that lane for free (no elixir, the marker doesn't move).
function lastStandStep(g: GuideState): GuideState {
  const { side, lane } = g.lastStand!
  if (side === 'P') {
    if (!g.P.hand.length) { g.lastStand = null; g.lines = ['Your hand is empty, so there is no last stand.']; g.why = []; return g }
    g.stage = 'my_last_stand'
    g.lines = [`LAST STAND: your ${stackName(lane === 0 ? 'L' : 'R')} fell. Pick ANY card from your hand: it goes FREE into the ${laneName(lane)} lane, slot nearest YOU. Don't move your marker.`]
    g.why = ['When a princess tower falls, its defenders fight back: the owner places one card in that lane for free. Losing a tower hurts, but it is not the end of the game.']
    return g
  }
  const q = g.E.queue
  if (!q.length) { g.lastStand = null; g.lines = ['The enemy pile is empty, so it has no last stand.']; g.why = []; return g }
  if (q[0].card === null) {
    g.stage = 'last_stand_enter'
    g.lines = ['ENEMY LAST STAND: flip the TOP card of the enemy pile face-up and tell the app which card it is.']
    g.why = ['When a princess tower falls, its owner places one card in that lane for free. The enemy always uses the top card of its pile.']
    return g
  }
  return enemyLastStand(g)
}

function enemyLastStand(g: GuideState): GuideState {
  const lane = g.lastStand!.lane
  const slot = g.E.queue.shift()!
  const c = slot.card!
  g.units.push({ uid: g.nextUid++, card: c, side: 'E', lane, pos: g.rules.laneLen - 1, tid: slot.tid, free: true })
  g.lastStand = null
  g.stage = 'tower_result'
  g.lines = [`ENEMY LAST STAND: place ${label(c)} FREE in the ${laneName(lane)} lane, slot nearest the ENEMY. Don't move its marker.`]
  g.why = ['When a princess tower falls, its owner places one card in that lane for free. The enemy always uses the top card of its pile, so a face-up top card tells you what is coming.']
  g.log.push(`Enemy last stand: ${label(c)} enters the ${laneName(lane).toLowerCase()} lane for free.`)
  emit(g, { type: 'play', side: 'E', tid: slot.tid, card: c, lane, cost: 0, free: true })
  return g
}

export function lastStandPlay(g0: GuideState, i: number): GuideState {
  if (g0.stage !== 'my_last_stand' || !g0.P.hand[i]) return g0
  const g = step(g0)
  const lane = g.lastStand!.lane
  const c = g.P.hand.splice(i, 1)[0]
  g.units.push({ uid: g.nextUid++, card: c, side: 'P', lane, pos: 0, tid: c.id, free: true })
  g.stats.placed++
  g.lastStand = null
  g.stage = 'tower_result'
  g.lines = [`Place ${label(c)} FREE in the ${laneName(lane)} lane, slot nearest YOU. Don't move your marker.`, ...refill(g)]
  g.why = []
  g.log.push(`Your last stand: ${label(c)} enters the ${laneName(lane).toLowerCase()} lane for free.`)
  emit(g, { type: 'play', side: 'P', tid: c.id, card: c, lane, cost: 0, free: true })
  return g
}

function finishRound(g: GuideState): GuideState {
  g.stats.rounds = g.round
  const pk = g.P.towers.K.length === 0
  const ek = g.E.towers.K.length === 0
  if (pk || ek) {
    g.winner = pk && ek ? 'draw' : ek ? 'P' : 'E'
    g.stage = 'over'
    g.lines = [g.winner === 'P' ? 'The enemy KING tower was destroyed.' : g.winner === 'E' ? 'Your KING tower is destroyed.' : 'Both king towers are gone.']
    g.why = []
    emit(g, { type: 'over', winner: g.winner })
    return g
  }
  return newRound(g)
}

// ---------- advice ----------
// short: the reason in a few words, for the line on the board
export type Advice = { kind: 'play'; handIndex: number; lane: 0 | 1; reason: string; short: string } | { kind: 'wait'; reason: string; short: string }

function beats(g: GuideState, a: Card, b: Card) {
  return compare(a, b, g.rules) > 0
}

export function options(g: GuideState): string[] {
  const out: string[] = []
  const threats = g.units.filter(u => u.side === 'E')
  g.P.hand.forEach((c, i) => {
    if (!canPlay(g, i)) { out.push(`${label(c)}: cost ${cost(c.rank)} — you can't afford it (you have ${g.P.elixir}).`); return }
    const beat = threats.filter(t => beats(g, c, t.card)).map(t => label(t.card))
    out.push(`${label(c)}: cost ${cost(c.rank)}.${beat.length ? ` Would beat ${beat.join(', ')} on the table.` : threats.length ? ' Would NOT beat the enemy cards on the table.' : ' No enemy cards on the table yet.'}`)
  })
  return out
}

/** Fights in a lane go front card against front card; the winner stays and meets the next one, a tie removes both. */
function laneOutcome(g: GuideState, mine: Card[], theirs: Card[]) {
  let i = 0, j = 0
  while (i < mine.length && j < theirs.length) {
    const r = compare(mine[i], theirs[j], g.rules)
    if (r >= 0) j++
    if (r <= 0) i++
  }
  return { mine: mine.slice(i), theirs: theirs.slice(j) }
}

type Play = { i: number; lane: 0 | 1 }
interface Plan { plays: Play[]; score: number; spent: number; leaks: Card[][]; pushers: Card[][]; enemyNext: { c: Card; lane: 0 | 1 } | null }

/** Predict this round's lanes if you make these plays: enemy cards that would get through (leaks) and your cards with a clear path (pushers). */
function evaluate(g: GuideState, plays: Play[]): Plan {
  const spent = plays.reduce((t, p) => t + cost(g.P.hand[p.i].rank), 0)
  const mine = [0, 1].map(l => g.units.filter(u => u.side === 'P' && u.lane === l).sort((a, b) => b.pos - a.pos).map(u => u.card))
  const theirs = [0, 1].map(l => g.units.filter(u => u.side === 'E' && u.lane === l).sort((a, b) => a.pos - b.pos).map(u => u.card))
  for (const p of plays) mine[p.lane].push(g.P.hand[p.i])
  // the enemy's face-up next card (it always plays one card) joins the lane where you have more units (it defends)
  let enemyNext: Plan['enemyNext'] = null
  const nxt = g.E.queue[0]?.card
  if (nxt) {
    const count: [number, number] = [mine[0].length, mine[1].length]
    const best: [number, number] = [Math.max(-1, ...mine[0].map(c => c.rank)), Math.max(-1, ...mine[1].map(c => c.rank))]
    const lane = defendLane(count, best)
    theirs[lane].push(nxt)
    enemyNext = { c: nxt, lane }
  }
  const out = [0, 1].map(l => laneOutcome(g, mine[l], theirs[l]))
  const leaks = out.map(o => o.theirs)
  const pushers = out.map(o => (o.theirs.length ? [] : o.mine))
  const left = g.P.elixir - spent
  const waste = Math.max(0, left + g.rules.regen - g.rules.cap)
  // stopping leaks matters most; banked elixir is worth more than a speculative push, because the enemy defends the lane you push
  let score = 0.5 * left - waste
  for (const l of [0, 1]) {
    score -= 10 * leaks[l].length
    if (pushers[l].length) score += 1
  }
  return { plays, score, spent, leaks, pushers, enemyNext }
}

const cardList = (cs: Card[]) => cs.map(label).join(' + ')

/** Looks one round ahead: tries every set of cards you can afford and picks the one that lets the fewest enemy cards through, keeping elixir in the bank otherwise. */
export function advise(g: GuideState): Advice {
  const hand = g.P.hand
  let best = evaluate(g, [])
  const base = best
  const combos = 3 ** hand.length
  for (let m = 1; m < combos; m++) {
    const plays: Play[] = []
    let x = m
    for (let i = 0; i < hand.length; i++, x = Math.floor(x / 3)) if (x % 3) plays.push({ i, lane: (x % 3 - 1) as 0 | 1 })
    if (plays.reduce((t, p) => t + cost(hand[p.i].rank), 0) > g.P.elixir) continue
    const p = evaluate(g, plays)
    if (p.score > best.score || (p.score === best.score && p.spent < best.spent)) best = p
  }
  const nextNote = (p: Plan) => (p.enemyNext ? ` The enemy's face-up next card, ${label(p.enemyNext.c)}, will probably come into the ${laneName(p.enemyNext.lane).toLowerCase()} lane (where you have more cards).` : '')
  if (!best.plays.length) {
    const leaking = [0, 1].filter(l => base.leaks[l].length)
    const why = leaking.length
      ? `Nothing you can afford stops the enemy ${leaking.map(l => `${cardList(base.leaks[l])} in the ${laneName(l).toLowerCase()} lane`).join(' and ')}. Save elixir so you can answer next round.`
      : `Every enemy card is covered by what is already on the table. Saving elixir keeps an answer ready for the cards it hasn't flipped yet.`
    return { kind: 'wait', reason: why + nextNote(base), short: leaking.length ? 'nothing you can afford stops them, so save elixir' : 'everything is covered, so save elixir' }
  }
  // defend first: start with a card for a lane that would otherwise leak
  const first = best.plays.find(p => base.leaks[p.lane].length > best.leaks[p.lane].length) ?? best.plays[0]
  const c = hand[first.i], ln = laneName(first.lane).toLowerCase()
  const stops = base.leaks[first.lane].length > best.leaks[first.lane].length
  const short = stops ? `it stops the enemy ${cardList(base.leaks[first.lane])}` : 'nothing there beats it, so it can reach a tower'
  let reason = stops
    ? `Without help, the enemy ${cardList(base.leaks[first.lane])} would get through the ${ln} lane and crack or break your tower. ${label(c)} stops ${base.leaks[first.lane].length > 1 ? 'them' : 'it'}.`
    : `${label(c)} has a clear path in the ${ln} lane: nothing the enemy has there beats it, so it should reach the enemy tower. If it breaks a card there, it stays for one more hit.`
  if (base.plays.length === 0 && g.P.elixir + g.rules.regen > g.rules.cap) reason += ` It also keeps your bar from overflowing next round.`
  if (best.plays.length > 1) reason += ` Plan for this turn: ${best.plays.map(p => `${label(hand[p.i])} → ${laneName(p.lane)}`).join(', ')}.`
  const stillLeaks = [0, 1].filter(l => best.leaks[l].length)
  if (stillLeaks.length) reason += ` You can't stop everything: ${stillLeaks.map(l => cardList(best.leaks[l])).join(', ')} will still get through.`
  return { kind: 'play', handIndex: first.i, lane: first.lane, reason: reason + nextNote(best), short }
}

/** Last stand: the card is free, so pick the one that stops the most enemy cards, spending the weakest card that does the job. */
export function adviseLastStand(g: GuideState): Advice | null {
  const lane = g.lastStand?.lane
  if (lane === undefined || !g.P.hand.length) return null
  const ln = laneName(lane).toLowerCase()
  const base = evaluate(g, [])
  let best: { i: number; plan: Plan; score: number } | null = null
  g.P.hand.forEach((c, i) => {
    const plan = evaluate(g, [{ i, lane }])
    const score = -10 * plan.leaks[lane].length + (plan.pushers[lane].length ? 1 : 0)
    if (!best || score > best.score || (score === best.score && c.rank < g.P.hand[best.i].rank)) best = { i, plan, score }
  })
  const { i, plan } = best!
  const c = g.P.hand[i]
  const was = base.leaks[lane], now = plan.leaks[lane]
  const short = was.length > now.length ? `it stops the enemy ${cardList(was)}` : plan.pushers[lane].length ? 'it has a clear path, and it is free' : 'it is the cheapest card to give up'
  const reason = was.length > now.length
    ? `The enemy ${cardList(was)} would get through the ${ln} lane. ${label(c)} stops ${was.length > 1 && !now.length ? 'them' : was.length > 1 ? 'some of them' : 'it'}${now.length ? `, but ${cardList(now)} still gets through` : ''}.`
    : plan.pushers[lane].length
      ? `${label(c)} has a clear path in the ${ln} lane, so it should reach the enemy tower. It is free, so use your weakest card that does the job.`
      : `Nothing in your hand changes the ${ln} lane much, so ${label(c)} is the cheapest card to give up.`
  return { kind: 'play', handIndex: i, lane, reason, short }
}

// ---------- events in words ----------
/** One short sentence for an event, saying WHY when a rule decided it; null for events the screen only animates. */
export function describe(e: GameEvent): string | null {
  const lane = (l: 0 | 1) => laneName(l).toLowerCase()
  switch (e.type) {
    case 'play':
      if (e.free) return `${e.side === 'P' ? 'Your' : 'Enemy'} last stand: ${label(e.card)} enters the ${lane(e.lane)} lane free.`
      return e.side === 'P' ? `You play ${label(e.card)} in the ${lane(e.lane)} lane (${e.cost} elixir).` : `Enemy plays ${label(e.card)} in the ${lane(e.lane)} lane.`
    case 'fight': {
      const { mine, theirs } = e
      const head = e.winner === 'P' ? `Your ${label(mine.card)} beats ${label(theirs.card)}` : e.winner === 'E' ? `Enemy ${label(theirs.card)} beats your ${label(mine.card)}` : `${label(mine.card)} ties ${label(theirs.card)}, both die`
      if (e.ace) return `${head}: aces beat picture cards.`
      if (e.double) {
        const [d, o] = e.double === 'P' ? [mine, theirs] : [theirs, mine]
        return `${head}: ${SUITS[d.card.suit]} beats ${SUITS[o.card.suit]}, so ${RANKS[d.card.rank]} counts double (${d.value} vs ${o.value}).`
      }
      return `${head} (${mine.value} vs ${theirs.value}).`
    }
    case 'tower': {
      const who = `${e.side === 'P' ? 'Your' : 'Enemy'} ${label(e.card)}`, where = stackName(e.stack).toLowerCase()
      if (e.result === 'crack') return `${who} is too weak for ${label(e.top.card)}: it cracks.`
      const how = e.wasCracked ? `breaks the cracked ${label(e.top.card)}` : `breaks ${label(e.top.card)}`
      return `${who} ${how} on the ${where}${e.destroyed ? `. The ${where} is DESTROYED!` : '.'}`
    }
    case 'reveal': return `The enemy ${stackName(e.stack).toLowerCase()}'s top card is ${label(e.card)}.`
    default: return null
  }
}

// ---------- end-of-game summary ----------
/** The end-of-game box: first something true that went well (or how close it was), then at most one tip. */
export interface Summary {
  broke: number; theirTotal: number   // enemy tower cards you broke, of how many
  standing: number; mineTotal: number // your tower cards still standing, of how many
  rounds: number
  close: boolean     // you lost, but their king was down to its last card
  tip: string | null // one thing to do better next game; null for a clean game
}
export function summary(g: GuideState): Summary {
  const s = g.stats
  const left = (t: Record<'L' | 'R' | 'K', unknown[]>) => t.L.length + t.R.length + t.K.length
  // the lesson that cost the most: tower cards lost to an open lane, then a fight lost to an ace or the wheel, then waste
  const open = s.undefended ?? 0
  const tip = open >= 2 ? `${open} of your tower cards broke to enemy cards in a lane where you had no card. When an enemy card is coming down a lane, put a card there to meet it.`
    : s.aceLosses?.[0] ?? s.wheelLosses?.[0]
    ?? (s.leakRounds ? `${s.leakRounds === 1 ? 'Once' : `${s.leakRounds} times`} you ended your turn with a full elixir bar, so that round's refill was lost. Spend a bit earlier.` : null)
    ?? s.overkills[0] ?? null
  return {
    broke: s.theirsBroken, theirTotal: s.theirsBroken + left(g.E.towers),
    standing: left(g.P.towers), mineTotal: s.mineBroken + left(g.P.towers),
    rounds: s.rounds, close: g.winner !== 'P' && g.E.towers.K.length === 1, tip,
  }
}

// ---------- on-screen play ----------
/** On-screen mode: the app holds the enemy's real cards (by tid) and flips them itself whenever the guide would ask you to. */
export function autoReveal(g0: GuideState, secret: Record<string, Card>): GuideState {
  let g = g0
  const events = [...(g0.events ?? [])] // flipping is part of the same step, so keep what the step already did
  for (let n = 0; n < 8; n++) {
    if (g.stage === 'enemy_enter' && g.peek === 'move') {
      // after the enemy's play, its next card flips as a step of its own; the cards move on the step after, not at the same time
      g = peekEnemyCard(g, secret[g.E.queue[0].tid])
      break
    }
    if (g.stage === 'enemy_enter' || g.stage === 'last_stand_enter') g = enterEnemyCard(g, secret[g.E.queue[0].tid])
    else if (g.stage === 'tower_enter') {
      const u = g.units.find(x => x.uid === g.hitQueue[0])!
      g = revealTowerCard(g, secret[g.E.towers[hitTarget(g, u)][0].tid])
      events.push(...(g.events ?? []))
      break // the hit lands on the next step
    } else break
    events.push(...(g.events ?? []))
  }
  return g === g0 ? g : { ...g, events }
}

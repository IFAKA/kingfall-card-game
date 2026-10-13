// Guide engine: you play with real cards; this runs the rules and tells you what to do physically.
// The enemy's face-down cards are unknown (null) until you flip them and tell the app.
import { DEFAULT_RULES, compare, cost, defendLane, effective, label, playerLaneInfo, shuffle, underdogWins } from './engine.ts'
import type { Card, Rules, StackKey, Towers, Unit } from './engine.ts'

export type Stage =
  | 'round_start' | 'my_play' | 'enemy_enter' | 'enemy_play' | 'enemy_stop'
  | 'move' | 'fight' | 'tower_enter' | 'tower_result' | 'my_last_stand' | 'last_stand_enter' | 'over'

// Every physical card has a stable tracking id (tid) so the board can animate it. Enemy cards are unknown until flipped.
export interface ESlot { tid: string; card: Card | null }
export interface ETowers { L: ESlot[]; R: ESlot[]; K: ESlot[] }
export interface Discarded { tid: string; card: Card; owner: 'P' | 'E' }
export interface Stats { overkills: string[]; leakRounds: number; placed: number; mineBroken: number; theirsBroken: number; rounds: number }

export interface GuideState {
  rules: Rules
  stage: Stage
  round: number
  units: Unit[]
  nextUid: number
  P: { hand: Card[]; queue: Card[]; elixir: number; towers: Towers }
  E: { queue: ESlot[]; elixir: number; towers: ETowers }
  discard: Discarded[]
  my16: Card[]
  enemySeen: Card[]
  lines: string[]      // what to do physically right now
  why: string[]        // why (rule explanation) for this step
  lastAction: string[] // instructions for your most recent play
  log: string[]
  hitQueue: number[]
  winner: null | 'P' | 'E' | 'draw'
  cracked?: string[] // tower cards turned sideways by a failed hit (tids); any later hit breaks them
  lastStand?: { side: 'P' | 'E'; lane: 0 | 1 } | null // a princess tower just fell: its owner places one card there for free
  stats: Stats
}

const laneName = (l: number) => (l === 0 ? 'LEFT' : 'RIGHT')
const stackName = (k: StackKey) => (k === 'K' ? 'KING tower' : k === 'L' ? 'LEFT tower' : 'RIGHT tower')
const clone = (g: GuideState): GuideState => structuredClone(g)
const bonusNote = (a: Card, b: Card, r: Rules) =>
  underdogWins(a, b, r.underdog) ? ' (underdog: wins)' : effective(a, b, r.wheel) > a.rank ? ` (+${r.wheel} suit bonus)` : ''

export function makeGame(deck: Card[], towerSlots: Card[], my16: Card[], rules: Rules = DEFAULT_RULES): GuideState {
  const d = shuffle(deck)
  return {
    rules,
    stage: 'round_start',
    round: 0,
    units: [],
    nextUid: 1,
    P: { hand: d.slice(0, 4), queue: d.slice(4), elixir: rules.startElixir, towers: { L: towerSlots.slice(0, 3), R: towerSlots.slice(3, 6), K: towerSlots.slice(6, 8) } },
    E: {
      queue: Array.from({ length: 8 }, (_, i) => ({ tid: `ep${i}`, card: null })),
      elixir: rules.startElixir,
      towers: {
        L: [0, 1, 2].map(i => ({ tid: `et${i}`, card: null })),
        R: [3, 4, 5].map(i => ({ tid: `et${i}`, card: null })),
        K: [6, 7].map(i => ({ tid: `et${i}`, card: null })),
      },
    },
    discard: [],
    my16,
    enemySeen: [],
    lines: [], why: [], lastAction: [], log: [],
    hitQueue: [],
    cracked: [],
    winner: null,
    stats: { overkills: [], leakRounds: 0, placed: 0, mineBroken: 0, theirsBroken: 0, rounds: 0 },
  }
}

export function excludedIds(g: GuideState): Set<string> {
  return new Set([...g.my16, ...g.enemySeen].map(c => c.id))
}

// ---------- elixir marker ----------
// Each physical bar is 10 face-down cards; the one turned sideways marks the elixir (its position from the left, 0 = none).
const markerAt = (n: number) => n ? `card ${n} sideways` : 'no card sideways (straighten it)'

function gainLine(who: string, its: string, before: number, after: number, cap: number) {
  if (after === before) return `${who}: ${its} bar is full, the marker stays on card ${after}.`
  return `${who}: move ${its} marker ${after - before} to the right, to ${markerAt(after)}${after === cap ? ' (the bar is full)' : ''}. ${who === 'YOU' ? 'You now have' : 'It now has'} ${after} elixir.`
}

function spendLine(its: string, k: number, after: number) {
  return `Move ${its} marker ${k} to the left, to ${markerAt(after)} (${after} elixir left).`
}

// ---------- round flow ----------
export function startRound(g0: GuideState): GuideState {
  const g = clone(g0)
  g.round += 1
  const p0 = g.P.elixir, e0 = g.E.elixir
  g.P.elixir = Math.min(g.rules.cap, g.P.elixir + g.rules.regen)
  g.E.elixir = Math.min(g.rules.cap, g.E.elixir + g.rules.enemyRegen)
  g.stage = 'round_start'
  g.lastAction = []
  g.lines = [
    gainLine('YOU', 'your', p0, g.P.elixir, g.rules.cap),
    gainLine('ENEMY', 'its', e0, g.E.elixir, g.rules.cap),
  ]
  g.why = ['Elixir is the position of the sideways card in a bar, counted from the left (no card sideways = 0). It refills a little every round, never past 10, and is what limits how much you can play.']
  g.log.push(`— Round ${g.round} —`)
  return g
}

export function next(g0: GuideState): GuideState {
  const g = clone(g0)
  switch (g.stage) {
    case 'round_start': g.stage = 'my_play'; g.lines = []; g.why = []; return g
    case 'enemy_play': return enemyStep(g)
    case 'enemy_stop': return goMove(g)
    case 'move': return resolveNext(g)
    case 'fight': return resolveNext(g)
    case 'tower_result': return g.lastStand ? lastStandStep(g) : processHit(g)
    default: return g
  }
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

export function playCard(g0: GuideState, i: number, lane: 0 | 1): GuideState {
  if (!canPlay(g0, i)) return g0
  const g = clone(g0)
  const c = g.P.hand.splice(i, 1)[0]
  const k = cost(c.rank)
  g.P.elixir -= k
  g.units.push({ uid: g.nextUid++, card: c, side: 'P', lane, pos: 0, tid: c.id })
  g.stats.placed++
  const drawn = refill(g)
  g.lastAction = [
    spendLine('your', k, g.P.elixir),
    `Place ${label(c)} in the ${laneName(lane)} lane, slot nearest YOU.`,
    ...drawn,
  ]
  g.log.push(`You play ${label(c)} (cost ${k}) in the ${laneName(lane).toLowerCase()} lane.`)
  return g
}

export function endMyTurn(g0: GuideState): GuideState {
  const g = clone(g0)
  if (g.P.elixir >= g.rules.cap) g.stats.leakRounds++
  g.lastAction = []
  return enemyStep(g)
}

// ---------- enemy ----------
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
  const g = clone(g0)
  g.E.queue[0].card = card
  g.enemySeen.push(card)
  return g.stage === 'last_stand_enter' ? enemyLastStand(g) : enemyDecide(g)
}

function enemyDecide(g: GuideState): GuideState {
  const slot = g.E.queue[0]
  const c = slot.card!
  const k = cost(c.rank)
  if (k > g.E.elixir) {
    g.stage = 'enemy_stop'
    g.lines = [
      `Enemy top card is ${label(c)}, cost ${k}. The enemy has only ${g.E.elixir} elixir, so it cannot play it yet.`,
      'Leave that card FACE-UP on top of the enemy pile. The enemy turn is over.',
    ]
    g.why = ['The enemy plays its top card whenever it can afford it. It never skips a card, so a big card blocks its pile until it has the elixir.']
    return g
  }
  g.E.queue.shift()
  g.E.elixir -= k
  const { count: mine, best } = playerLaneInfo(g)
  const lane = defendLane(mine, best)
  g.units.push({ uid: g.nextUid++, card: c, side: 'E', lane, pos: g.rules.laneLen - 1, tid: slot.tid })
  g.stage = 'enemy_play'
  g.lines = [
    `ENEMY PLAYS ${label(c)} (cost ${k}). ${spendLine('its', k, g.E.elixir)}`,
    `Place ${label(c)} in the ${laneName(lane)} lane, slot nearest the ENEMY.`,
    'Then flip the next card of the enemy pile (the app will ask).',
  ]
  g.why = [`The enemy defends: it sends its card into the lane where you have MORE units (on a tie, the lane with your highest-ranked card; still tied, left). You have ${mine[0]} on the left and ${mine[1]} on the right.`]
  g.log.push(`Enemy plays ${label(c)} (cost ${k}) in the ${laneName(lane).toLowerCase()} lane.`)
  return g
}

// ---------- move / fight ----------
/** Front units of a lane that face each other (same or neighbouring slot) clash in place instead of passing through. */
function contact(g: GuideState, lane: 0 | 1) {
  const ps = g.units.filter(u => u.lane === lane && u.side === 'P')
  const es = g.units.filter(u => u.lane === lane && u.side === 'E')
  if (!ps.length || !es.length) return null
  const p = ps.reduce((a, b) => (b.pos > a.pos ? b : a))
  const e = es.reduce((a, b) => (b.pos < a.pos ? b : a))
  return e.pos - p.pos <= 1 ? { p, e } : null
}

function goMove(g: GuideState): GuideState {
  const lines: string[] = []
  const holdSlots: { lane: number; side: 'P' | 'E'; pos: number }[] = []
  for (const lane of [0, 1] as const) {
    const c = contact(g, lane)
    if (!c) continue
    holdSlots.push({ lane, side: 'P', pos: c.p.pos }, { lane, side: 'E', pos: c.e.pos })
    lines.push(`${laneName(lane)} lane: your ${label(c.p.card)} and the enemy ${label(c.e.card)} are face to face, so they do NOT move. They clash next. Don't move them.`)
  }
  for (const u of g.units) {
    if (holdSlots.some(h => h.lane === u.lane && h.side === u.side && h.pos === u.pos)) u.held = true
    else u.pos += u.side === 'P' ? 1 : -1
  }
  g.stage = 'move'
  g.lines = [
    'MOVE every other card one slot toward the other side: your cards go away from you, enemy cards come toward you.',
    ...lines,
    'A card that moves past the last slot is now "at the tower" (the board shows it above / below the lane).',
  ]
  g.why = ['Every unit advances one slot each round, except cards that are already facing an enemy: those fight where they stand, and the winner then steps into the loser\'s slot. Cards never pass through each other.']
  return g
}

const clash = (p: Unit, e: Unit) => p.pos >= e.pos || (!!p.held && !!e.held && e.pos - p.pos <= 1)
function engaged(g: GuideState, lane: 0 | 1) {
  const ps = g.units.filter(u => u.lane === lane && u.side === 'P')
  const es = g.units.filter(u => u.lane === lane && u.side === 'E')
  if (!ps.length || !es.length) return false
  return clash(ps.reduce((a, b) => (b.pos > a.pos ? b : a)), es.reduce((a, b) => (b.pos < a.pos ? b : a)))
}

/** Held units advance into the slot the fight cleared. */
function advance(g: GuideState, lane: 0 | 1, side: 'P' | 'E') {
  for (const u of g.units) {
    if (u.lane !== lane || u.side !== side || !u.held) continue
    // enemies still sharing this slot (or behind it) block the step: cards never pass through each other
    const blocked = g.units.some(x => x.lane === lane && x.side !== side && (side === 'P' ? x.pos <= u.pos : x.pos >= u.pos))
    if (!blocked) { u.held = false; u.pos += side === 'P' ? 1 : -1 }
  }
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

function resolveNext(g: GuideState): GuideState {
  for (const lane of [0, 1] as const) {
    const ps = g.units.filter(u => u.lane === lane && u.side === 'P')
    const es = g.units.filter(u => u.lane === lane && u.side === 'E')
    if (!ps.length || !es.length) continue
    const p = ps.reduce((a, b) => (b.pos > a.pos ? b : a))
    const e = es.reduce((a, b) => (b.pos < a.pos ? b : a))
    if (!clash(p, e)) continue
    const r = compare(p.card, e.card, g.rules)
    const underdog = underdogWins(p.card, e.card, g.rules.underdog) || underdogWins(e.card, p.card, g.rules.underdog)
    const head = `${laneName(lane)} lane: your ${label(p.card)}${bonusNote(p.card, e.card, g.rules)} vs enemy ${label(e.card)}${bonusNote(e.card, p.card, g.rules)}.`
    let res: string[]
    if (r === 0) {
      res = ['Equal rank: BOTH cards are removed.', ...kill(g, p), ...kill(g, e)]
      g.log.push(`${label(p.card)} ties ${label(e.card)}: both removed.`)
    } else if (r > 0) {
      res = [`YOUR ${label(p.card)} WINS${p.held ? ' and steps forward when the slot is clear' : ' and stays where it is'}.`, ...kill(g, e)]
      g.log.push(`Your ${label(p.card)} beats enemy ${label(e.card)}.`)
      if (!underdog && cost(p.card.rank) - cost(e.card.rank) >= 4) {
        g.stats.overkills.push(`Round ${g.round}: your ${label(p.card)} (cost ${cost(p.card.rank)}) beat a ${label(e.card)} (cost ${cost(e.card.rank)}) — a cheaper card could have done it.`)
      }
    } else {
      res = [`The ENEMY ${label(e.card)} WINS${e.held ? ' and steps forward when the slot is clear' : ' and stays where it is'}.`, ...kill(g, p)]
      g.log.push(`Enemy ${label(e.card)} beats your ${label(p.card)}.`)
    }
    if (r > 0) advance(g, lane, 'P')
    else if (r < 0) advance(g, lane, 'E')
    if (!engaged(g, lane)) { advance(g, lane, 'P'); advance(g, lane, 'E') }
    g.stage = 'fight'
    g.lines = [head, ...res]
    g.why = [underdog
      ? `Underdog: a card ${g.rules.underdog} or more ranks lower wins (A beats J/Q/K, 2 beats Q/K, 3 beats K). The winner stays and keeps fighting; the loser goes to the bottom of its pile.`
      : `The front-most cards fight first. Higher rank wins; a suit that beats the other adds +${g.rules.wheel}. The winner stays and keeps fighting; the loser goes to the bottom of its pile.`]
    return g
  }
  g.hitQueue = g.units
    .filter(u => (u.side === 'P' && u.pos >= g.rules.laneLen) || (u.side === 'E' && u.pos < 0))
    .map(u => u.uid)
  return processHit(g)
}

// ---------- tower hits ----------
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
        `Your ${label(u.card)} reached the enemy ${stackName(k)}.`,
        `Flip the TOP card of the enemy ${stackName(k)} face-up and tell the app which card it is.`,
      ]
      g.why = ['To break a tower card, your unit needs rank equal to or higher than it. If it is weaker, the card cracks instead, and the next hit on it breaks it.']
      return g
    }
    return resolveHit(g, u, k)
  }
  return finishRound(g)
}

export function enterTowerCard(g0: GuideState, card: Card): GuideState {
  const g = clone(g0)
  const u = g.units.find(x => x.uid === g.hitQueue[0])!
  const k = hitTarget(g, u)
  g.E.towers[k][0].card = card
  g.enemySeen.push(card)
  return resolveHit(g, u, k)
}

function resolveHit(g: GuideState, u: Unit, k: StackKey): GuideState {
  g.hitQueue.shift()
  const mineHit = u.side === 'P'
  const top: Card = mineHit ? g.E.towers[k][0].card! : g.P.towers[k][0]
  const owner = mineHit ? 'enemy' : 'your'
  const topId = mineHit ? g.E.towers[k][0].tid : g.P.towers[k][0].id
  const cracked = g.cracked ?? []
  const wasCracked = cracked.includes(topId)
  const broken = wasCracked || u.card.rank >= top.rank
  const lines: string[] = []
  lines.push(`${mineHit ? 'Your' : 'Enemy'} ${label(u.card)} (rank ${u.card.rank}) hits ${owner} ${stackName(k)}, top card ${label(top)} (rank ${top.rank}${wasCracked ? ', CRACKED' : ''}).`)
  if (broken) {
    g.cracked = cracked.filter(id => id !== topId)
    if (mineHit) { const r = g.E.towers[k].shift()!; g.discard.push({ tid: r.tid, card: r.card!, owner: 'E' }) }
    else { const r = g.P.towers[k].shift()!; g.discard.push({ tid: r.id, card: r, owner: 'P' }) }
    lines.push(`${wasCracked && u.card.rank < top.rank ? `${label(top)} was already cracked` : `${label(u.card)} ≥ ${label(top)}`}: the tower card BREAKS. Discard ${label(top)} (set it aside).`)
    if (mineHit) g.stats.theirsBroken++; else g.stats.mineBroken++
    const fell = mineHit ? g.E.towers : g.P.towers
    if (k !== 'K' && !fell[k].length && g.E.towers.K.length && g.P.towers.K.length) {
      g.lastStand = { side: mineHit ? 'E' : 'P', lane: k === 'L' ? 0 : 1 }
    }
    g.log.push(`${mineHit ? 'Your' : 'Enemy'} ${label(u.card)} breaks ${label(top)} on the ${stackName(k).toLowerCase()}.`)
  } else {
    const st = mineHit ? g.E.towers[k] : g.P.towers[k]
    if (st.length > 1) (st as unknown[]).push((st as unknown[]).shift())
    g.cracked = [...cracked, topId]
    lines.push(`${label(u.card)} < ${label(top)}: the tower HOLDS, but ${label(top)} CRACKS. Turn it SIDEWAYS and move it to the BOTTOM of that tower${mineHit ? ', face-up (you know it now)' : ''}.${st.length > 1 ? ' The next card is now on top.' : ''} Any later hit breaks it.`)
    g.log.push(`${mineHit ? 'Your' : 'Enemy'} ${label(u.card)} hits the ${stackName(k).toLowerCase()}: ${label(top)} holds but cracks.`)
  }
  g.units = g.units.filter(x => x.uid !== u.uid)
  if (u.side === 'P') { g.P.queue.push(u.card); lines.push(`Put your ${label(u.card)} at the BOTTOM of your queue.`, ...refill(g)) }
  else { g.E.queue.push({ tid: u.tid!, card: u.card }); lines.push(`Put the enemy ${label(u.card)} at the BOTTOM of the enemy pile, FACE-UP (it is a known card now).`) }
  if (g.lastStand) lines.push(`The ${owner} ${stackName(k)} is DESTROYED. ${mineHit ? 'The enemy gets a LAST STAND' : 'You get a LAST STAND'}: one free card in that lane (next step).`)
  g.stage = 'tower_result'
  g.lines = lines
  g.why = ['A unit at a tower attacks it once and is then removed (back to the bottom of its pile). If it is too weak, the top tower card cracks (turned sideways) and moves to the bottom of that tower; any later hit breaks a cracked card, so even small cards wear towers down. The king can only be hit after the princess tower in that lane is gone. When a princess tower falls, its owner gets a free last-stand card in that lane.']
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
  g.units.push({ uid: g.nextUid++, card: c, side: 'E', lane, pos: g.rules.laneLen - 1, tid: slot.tid })
  g.lastStand = null
  g.stage = 'tower_result'
  g.lines = [`ENEMY LAST STAND: place ${label(c)} FREE in the ${laneName(lane)} lane, slot nearest the ENEMY. Don't move its marker.`]
  g.why = ['When a princess tower falls, its owner places one card in that lane for free. The enemy always uses the top card of its pile, so a face-up top card tells you what is coming.']
  g.log.push(`Enemy last stand: ${label(c)} enters the ${laneName(lane).toLowerCase()} lane for free.`)
  return g
}

export function lastStandPlay(g0: GuideState, i: number): GuideState {
  if (g0.stage !== 'my_last_stand' || !g0.P.hand[i]) return g0
  const g = clone(g0)
  const lane = g.lastStand!.lane
  const c = g.P.hand.splice(i, 1)[0]
  g.units.push({ uid: g.nextUid++, card: c, side: 'P', lane, pos: 0, tid: c.id })
  g.stats.placed++
  g.lastStand = null
  g.stage = 'tower_result'
  g.lines = [`Place ${label(c)} FREE in the ${laneName(lane)} lane, slot nearest YOU. Don't move your marker.`, ...refill(g)]
  g.why = []
  g.log.push(`Your last stand: ${label(c)} enters the ${laneName(lane).toLowerCase()} lane for free.`)
  return g
}

function finishRound(g: GuideState): GuideState {
  g.stats.rounds = g.round
  const pk = g.P.towers.K.length === 0
  const ek = g.E.towers.K.length === 0
  if (pk || ek) {
    g.winner = pk && ek ? 'draw' : ek ? 'P' : 'E'
    g.stage = 'over'
    g.lines = [g.winner === 'P' ? 'The enemy KING tower is destroyed. YOU WIN!' : g.winner === 'E' ? 'Your KING tower is destroyed. You lose.' : 'Both king towers are gone. Draw.']
    g.why = []
    return g
  }
  return startRound(g)
}

// ---------- advice ----------
export type Advice = { kind: 'play'; handIndex: number; lane: 0 | 1; reason: string } | { kind: 'wait'; reason: string }

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
  // the enemy's face-up next card, if it can pay, joins the lane where you have more units (it defends)
  let enemyNext: Plan['enemyNext'] = null
  const nxt = g.E.queue[0]?.card
  if (nxt && cost(nxt.rank) <= g.E.elixir) {
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
    return { kind: 'wait', reason: why + nextNote(base) }
  }
  // defend first: start with a card for a lane that would otherwise leak
  const first = best.plays.find(p => base.leaks[p.lane].length > best.leaks[p.lane].length) ?? best.plays[0]
  const c = hand[first.i], ln = laneName(first.lane).toLowerCase()
  let reason = base.leaks[first.lane].length > best.leaks[first.lane].length
    ? `Without help, the enemy ${cardList(base.leaks[first.lane])} would get through the ${ln} lane and crack or break your tower. ${label(c)} stops ${base.leaks[first.lane].length > 1 ? 'them' : 'it'}.`
    : `${label(c)} has a clear path in the ${ln} lane: nothing the enemy has there beats it, so it should reach the enemy tower and crack or break a card.`
  if (base.plays.length === 0 && g.P.elixir + g.rules.regen > g.rules.cap) reason += ` It also keeps your bar from overflowing next round.`
  if (best.plays.length > 1) reason += ` Plan for this turn: ${best.plays.map(p => `${label(hand[p.i])} → ${laneName(p.lane)}`).join(', ')}.`
  const stillLeaks = [0, 1].filter(l => best.leaks[l].length)
  if (stillLeaks.length) reason += ` You can't stop everything: ${stillLeaks.map(l => cardList(best.leaks[l])).join(', ')} will still get through.`
  return { kind: 'play', handIndex: first.i, lane: first.lane, reason: reason + nextNote(best) }
}

// ---------- end-of-game summary ----------
export function summary(g: GuideState): string[] {
  const s = g.stats
  const out = [
    `Rounds played: ${s.rounds}. Cards you placed: ${s.placed}.`,
    `Enemy tower cards you broke: ${s.theirsBroken}. Your tower cards broken: ${s.mineBroken}.`,
  ]
  if (s.leakRounds) out.push(`You ended your turn with a FULL elixir bar ${s.leakRounds} time(s) — refill that was wasted. Spend a bit earlier.`)
  else out.push('You never wasted elixir by sitting at a full bar. Good.')
  if (s.overkills.length) out.push('Expensive cards used on cheap enemies:', ...s.overkills.slice(0, 4))
  else out.push('You never used a much more expensive card than needed to win a fight.')
  return out
}

// ---------- on-screen play ----------
/** On-screen mode: the app holds the enemy's real cards (by tid) and flips them itself whenever the guide would ask you to. */
export function autoReveal(g0: GuideState, secret: Record<string, Card>): GuideState {
  let g = g0
  for (let n = 0; n < 8; n++) {
    if (g.stage === 'enemy_enter' || g.stage === 'last_stand_enter') g = enterEnemyCard(g, secret[g.E.queue[0].tid])
    else if (g.stage === 'tower_enter') {
      const u = g.units.find(x => x.uid === g.hitQueue[0])!
      g = enterTowerCard(g, secret[g.E.towers[hitTarget(g, u)][0].tid])
    } else break
  }
  return g
}

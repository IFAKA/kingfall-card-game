// Finds the trailer's moments in the recording (out/timeline.json) by what happened, not by hard-coded times, so a new recording
// (after a rename, or a change to the game's look) lines up by itself. A moment missing from the recording stops the render with its name.
import rec from '../out/timeline.json'

type Card = { rank: number; suit: number }
type Ev = { type: string; side?: 'P' | 'E'; lane?: 0 | 1; stack?: 'L' | 'R' | 'K'; result?: string; destroyed?: boolean; free?: boolean; winner?: string; ace?: string; double?: string; mine?: { card: Card }; theirs?: { card: Card } }
type Step = { t: number; type: 'step'; stage: string; round: number; events: Ev[] }
type Mark = { t: number; type: string }

const steps = (rec.timeline as (Step | Mark)[]).filter((e): e is Step => e.type === 'step')
const presses = (rec.timeline as Mark[]).filter(e => e.type === 'press').map(e => e.t / 1000)

// a hit is logged when its step lands; its contact (the cards meet, the sound and sparks) comes this long before (measured on the frames)
export const CONTACT = 0.38

export type Moment = { step: number; contact: number; round: number; ev: Ev }
function find(what: string, test: (e: Ev) => boolean, { last = false, after = -1, before = Infinity } = {}): Moment {
  const all = steps.filter(s => s.t / 1000 > after && s.t / 1000 < before).flatMap(s => s.events.filter(test).map(ev => ({ s, ev })))
  const hit = last ? all.at(-1) : all[0]
  if (!hit) throw new Error(`The recording has no "${what}". Re-record (capture/run.sh) or pick another moment in src/moments.ts.`)
  return { step: hit.s.t / 1000, contact: hit.s.t / 1000 - CONTACT, round: hit.s.round, ev: hit.ev }
}
const won = (e: Ev) => e.type === 'fight' && e.winner === 'P'

const firstFight = find('first fight', e => e.type === 'fight')
const ace = find('ace beating a king', e => won(e) && !!e.ace)
const x2a = find('first ×2 win', e => won(e) && e.double === 'P')
const x2b = find('last ×2 win', e => won(e) && e.double === 'P', { last: true, after: x2a.step })
const towerBreak = find('first tower card you break', e => e.type === 'tower' && e.side === 'P' && e.result === 'break' && !e.destroyed)
const towerDown = find('first enemy side tower you destroy', e => e.type === 'tower' && e.side === 'P' && !!e.destroyed && e.stack !== 'K')
const towerCrack = find('a crack after that', e => e.type === 'tower' && e.side === 'P' && e.result === 'crack', { after: towerDown.step })
const yourTowerDown = find('your first side tower falling', e => e.type === 'tower' && e.side === 'E' && !!e.destroyed)
const strike = find('a plain win just before it', e => won(e) && !e.ace && !e.double, { last: true, before: yourTowerDown.step })
const lastStand = find('your last stand', e => e.type === 'play' && e.side === 'P' && !!e.free)
const king = find('the enemy king falling', e => e.type === 'tower' && e.side === 'P' && e.stack === 'K' && !!e.destroyed)

// the first card you pick up in the round of the first ×2 (a turn with a plan: two cards played)
const roundStart = (r: number) => Math.min(...steps.filter(s => s.round === r).map(s => s.t / 1000))
const pressAfter = (t: number) => {
  const p = presses.find(x => x > t)
  if (p === undefined) throw new Error('The recording has no card picked up after ' + t.toFixed(1) + 's.')
  return p
}

export const M = {
  firstPress: pressAfter(0), firstFight, ace, x2a, x2b, towerBreak, towerDown, towerCrack, yourTowerDown, strike, lastStand, king,
  planPress: pressAfter(roundStart(x2a.round)),
  busyBoard: (ace.contact + king.contact) / 2, // somewhere in the late game, for the title's blurred background
}

// where things are on the board, in the game's CSS pixels (432 x 768)
export const LANE_X = (lane?: number) => (lane === 1 ? 342 : 90)
export const TOWER_X = (stack?: string) => (stack === 'R' ? 350 : stack === 'K' ? 216 : 90)

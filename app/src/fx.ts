// Game feel: turns the events of each fresh step into hits, pop-ups, a board shake and sounds.
// Effects are placed on board elements marked with data-anchor ("lane-0", "tower-E-L", ...) and cards marked with data-tid, so any
// board layout can use them.
//
// A fight or a tower hit is played BEFORE its step is shown (strike): the board still shows the cards that meet, so they can wind
// up, strike, freeze on contact (hit-stop) and the loser can be knocked back; only then does the step land and the loser slide to its
// pile. The sound, the shake and the sparks all come on the contact frame, the pop-up right after the freeze. Anything else (a card
// played, a new round, the end) plays once the step is shown, as before.
// The numbers follow the game-feel research: hit-stop of about 50 ms for a plain hit up to about 120 ms for a heavy one (past that it
// reads as a dropped frame), longer only for the blow that ends the game (Sakurai); each move 80-220 ms (NN/G: 100-400 ms per motion);
// the bigger effects only for the bigger hits, so they stay readable.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { GameEvent, GuideState } from './guide'
import { sfx } from './sfx'
import type { Mood, Sfx } from './sfx'
import { RANKS, SUITS } from './engine'

export interface Pop { id: number; x: number; y: number; text: string; sub?: string; kind: string; ms: number }

// A card you move yourself (dropped, or tapped into place) is already moving under your finger, so its trip is quicker than the
// board's own moves and eases out: seconds by tid, read by TCard while it flies.
export const landing = new Map<string, number>()
export function quick(tid: string | undefined, seconds: number) {
  if (tid) { landing.set(tid, seconds); setTimeout(() => landing.delete(tid), seconds * 1000 + 100) }
}

let nextId = 1
const STAGGER = 140 // ms between effects of the same step shown at once, so two fights read as two hits

// A pop-up stays long enough to read: adults read about 238 words a minute (Brysbaert 2019), plus a moment to notice it. Only the
// part of the animation where it is fully shown counts (after it pops in, before it fades: about 58% of it, see @keyframes popup).
const MS_PER_WORD = 60000 / 238, NOTICE_MS = 300, SHOWN = 0.58, MIN_MS = 1450
export const popMs = (text: string) => {
  const words = text.split(/\s+/).filter(w => /[\p{L}\p{N}\p{S}]/u.test(w)).length // a lone "·" is not a word
  return Math.max(MIN_MS, Math.round((NOTICE_MS + words * MS_PER_WORD) / SHOWN))
}

type FightEvent = Extract<GameEvent, { type: 'fight' }>
type TowerEvent = Extract<GameEvent, { type: 'tower' }>
type HitEvent = FightEvent | TowerEvent
const isHit = (e: GameEvent): e is HitEvent => e.type === 'fight' || e.type === 'tower'
type PopIn = Omit<Pop, 'id' | 'ms'>

// ---------- where things are ----------
// Board positions in the coordinates of the root (where the pop-ups and sparks are drawn).
function board(el: HTMLElement) {
  const pr = el.getBoundingClientRect()
  const rects = (name: string) => [...el.querySelectorAll(`[data-anchor~="${name}"]`)].map(e => e.getBoundingClientRect())
  const at = (name: string) => {
    const rs = rects(name)
    if (!rs.length) return null
    const l = Math.min(...rs.map(r => r.left)), r = Math.max(...rs.map(r => r.right)), t = Math.min(...rs.map(r => r.top)), b = Math.max(...rs.map(r => r.bottom))
    return { x: (l + r) / 2 - pr.left, y: (t + b) / 2 - pr.top }
  }
  // sounds sit gently left or right where they happen on screen
  const pan = (name: string) => {
    const rs = rects(name)
    return rs.length ? ((rs.reduce((x, r) => x + r.left + r.width / 2, 0) / rs.length / innerWidth) * 2 - 1) * 0.5 : 0
  }
  return { at, pan, left: pr.left, top: pr.top }
}
type Board = ReturnType<typeof board>
const towerAnchor = (e: TowerEvent) => `tower-${e.side === 'P' ? 'E' : 'P'}-${e.stack}`

// ---------- what a hit is ----------
// weight: 1 a plain fight, a tie or a crack; 2 a fight a rule decided (×2, ace) or a broken tower card; 3 a fallen tower; 4 a fallen king
type Weight = 1 | 2 | 3 | 4
interface Hit { pop: PopIn | null; sound: Sfx; mood: Mood; pan: number; weight: Weight; pitched: boolean }
const HOLD = [0, 50, 90, 120, 220] // hit-stop, ms
const TRAUMA = [0, 0.38, 0.55, 0.75, 1]

function hitOf(e: HitEvent, b: Board): Hit {
  if (e.type === 'fight') {
    const p = b.at(`lane-${e.lane}`), pan = b.pan(`lane-${e.lane}`)
    const good = e.winner === 'P' ? 'good' : e.winner === 'E' ? 'bad' : 'tie'
    // your value first, the sign pointing at the winner: "13 > 3"
    const vs = `${e.mine.value} ${e.winner === 'P' ? '>' : e.winner === 'E' ? '<' : '='} ${e.theirs.value}`
    // an ace or suit win says which rule decided it, so the rule is learned where it happens instead of from a cheat sheet
    const [win, lose] = (e.ace ?? e.double) === 'P' ? [e.mine.card, e.theirs.card] : [e.theirs.card, e.mine.card]
    if (e.ace) return { pop: p && { ...p, text: 'ACE!', sub: `A beats ${RANKS[lose.rank]}`, kind: `ace ${good}` }, sound: 'big', mood: good, pan, weight: 2, pitched: true }
    if (e.double) return { pop: p && { ...p, text: '×2!', sub: `${SUITS[win.suit]} beats ${SUITS[lose.suit]} · ${vs}`, kind: `x2 ${good}` }, sound: 'big', mood: good, pan, weight: 2, pitched: true }
    return { pop: p && { ...p, text: vs, sub: e.winner === 'tie' ? 'tie' : undefined, kind: `fight ${good}` }, sound: 'clash', mood: good, pan, weight: 1, pitched: true }
  }
  const name = towerAnchor(e), p = b.at(name), pan = b.pan(name)
  const good = e.side === 'P' ? 'good' : 'bad'
  if (e.result === 'crack') return { pop: p && { ...p, text: 'CRACK', kind: `crack ${good}` }, sound: 'crack', mood: good, pan, weight: 1, pitched: false }
  if (!e.destroyed) return { pop: p && { ...p, text: 'BREAK!', kind: `break ${good}` }, sound: 'break', mood: good, pan, weight: 2, pitched: false }
  return { pop: p && { ...p, text: e.stack === 'K' ? 'KING DOWN!' : 'TOWER DOWN!', kind: `down ${good}` }, sound: 'boom', mood: good, pan, weight: e.stack === 'K' ? 4 : 3, pitched: false }
}

// Fights in a row climb in pitch, a semitone each (as Balatro's scoring does), so a busy round builds instead of repeating one clash.
let chain = { round: -1, n: 0 }
const nextPitch = (round: number) => {
  if (chain.round !== round) chain = { round, n: 0 }
  return 2 ** (Math.min(chain.n++, 5) / 12)
}

// ---------- the board shake ----------
// "Trauma" (Eiserloh, GDC 2016): every hit adds some, it drains steadily, and the shake is its square, so a small hit stays small and
// hits in a row build up. Smooth noise moves it (not random jumps), and it turns a little as well as slides. Only the board shakes.
const MAX_PX = 12, MAX_DEG = 1.1, DRAIN = 1.7 /* per second */, NOISE_HZ = 18
let trauma = 0, shaken: HTMLElement | null = null, raf = 0
const hash = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return (x - Math.floor(x)) * 2 - 1 }
const smooth = (seed: number, t: number) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash(seed * 57 + i) * (1 - u) + hash(seed * 57 + i + 1) * u }
const still = (el: HTMLElement) => { el.style.translate = ''; el.style.rotate = '' }
function shake(el: HTMLElement | null, add: number) {
  if (!el || !add) return
  if (shaken && shaken !== el) still(shaken)
  shaken = el
  trauma = Math.min(1, trauma + add)
  if (raf) return
  let last = performance.now()
  const tick = (now: number) => {
    trauma = Math.max(0, trauma - DRAIN * (now - last) / 1000)
    last = now
    const s = trauma * trauma, t = now / 1000 * NOISE_HZ, el = shaken!
    if (s <= 0) { still(el); raf = 0; return }
    el.style.translate = `${(MAX_PX * s * smooth(1, t)).toFixed(2)}px ${(MAX_PX * s * smooth(2, t)).toFixed(2)}px`
    el.style.rotate = `${(MAX_DEG * s * smooth(3, t)).toFixed(3)}deg`
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

// ---------- sparks ----------
// A burst at the point of contact, drawn in the effects layer. A plain fight throws a few white sparks sideways; a fight the winning
// suit decided throws that suit's own (♠ slashes, ♥ a pulse, ♦ glints, ♣ a heavy ring), an ace a gold slash; a tower hit throws
// stone chips away from the attacker that fall, more of them the harder the hit.
type SparkKind = 'hit' | 'suit0' | 'suit1' | 'suit2' | 'suit3' | 'ace' | 'chips'
function sparks(layer: Element | null, kind: SparkKind, x: number, y: number, ux: number, uy: number, n: number, speed: number) {
  if (!layer) return
  const box = document.createElement('div')
  box.className = `spark ${kind}`
  box.style.left = `${x}px`; box.style.top = `${y}px`
  layer.appendChild(box)
  const ms = (t: number) => t / speed
  let longest = 0
  const throwOne = (cls: string, frames: Keyframe[], dur: number, delay = 0) => {
    const i = document.createElement('i')
    if (cls) i.className = cls
    box.appendChild(i)
    i.animate(frames, { duration: ms(dur), delay: ms(delay), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' })
    longest = Math.max(longest, ms(dur + delay))
  }
  const deg = (a: number) => a * 180 / Math.PI
  const axis = Math.atan2(uy, ux)
  if (kind === 'chips') {
    // away from the attacker in a wide cone, then down under their own weight
    for (let k = 0; k < n; k++) {
      const a = axis + (Math.random() - 0.5) * 2.2, d = 22 + Math.random() * 30, r = (Math.random() - 0.5) * 540
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d
      throwOne('', [
        { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.7}px, ${dy * 0.7 - 6}px) rotate(${r / 2}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy + 26}px) rotate(${r}deg) scale(.6)`, opacity: 0 },
      ], 520 + Math.random() * 160)
    }
  } else if (kind === 'suit1' || kind === 'suit3') {
    // ♥ a soft pulse that swells, ♣ a heavy ring that thuds out (two for the pulse, like a heartbeat)
    const beats = kind === 'suit1' ? [0, 130] : [0]
    for (const delay of beats) throwOne('ring', [{ transform: 'scale(.2)', opacity: 1 }, { transform: `scale(${kind === 'suit1' ? 2.4 : 3})`, opacity: 0 }], 420, delay)
    hitSparks(5)
  } else if (kind === 'ace') {
    // one gold stroke across the contact, drawn on, then gone
    throwOne('slash', [
      { transform: `rotate(${deg(axis) + 90 + 35}deg) scaleX(0)`, opacity: 1 },
      { transform: `rotate(${deg(axis) + 90 + 35}deg) scaleX(1)`, opacity: 1, offset: 0.35 },
      { transform: `rotate(${deg(axis) + 90 + 35}deg) scaleX(1.1)`, opacity: 0 },
    ], 460)
    hitSparks(6)
  } else {
    hitSparks(n)
  }
  // sparks fly out sideways from the hit (across the line the cards met on), in two fans
  function hitSparks(count: number) {
    for (let k = 0; k < count; k++) {
      const a = axis + (k % 2 ? Math.PI / 2 : -Math.PI / 2) + (Math.random() - 0.5) * 1.6, d = 20 + Math.random() * 26
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d, turn = deg(a)
      const cls = kind === 'suit0' ? 'line' : kind === 'suit2' ? 'glint' : ''
      throwOne(cls, [
        { transform: `translate(0, 0) rotate(${turn}deg) scale(1)`, opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${turn}deg) scale(0)`, opacity: 0.2 },
      ], 300 + Math.random() * 140)
    }
  }
  setTimeout(() => box.remove(), longest + 60)
}

// ---------- the strike ----------
// One element's resting offset while it is being moved by the strike (the moves are chained from where the last one ended).
interface Pose { x: number; y: number; r: number; s: number }
const REST: Pose = { x: 0, y: 0, r: 0, s: 1 }
const css = (p: Pose) => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.r.toFixed(1)}deg) scale(${p.s})`

/** Where two boxes meet: the direction from a to b, how far apart their facing edges are, and the point where they touch. */
function between(a: DOMRect, b: DOMRect) {
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2
  const dx = bx - ax, dy = by - ay, dist = Math.hypot(dx, dy) || 1
  const ux = dx / dist, uy = dy / dist
  const ext = (r: DOMRect) => (Math.abs(ux) * r.width + Math.abs(uy) * r.height) / 2
  const ea = ext(a), gap = dist - ea - ext(b)
  return { ux, uy, gap, dist, cx: ax, cy: ay, ea }
}

interface Run {
  cut: boolean
  anims: Animation[]
  frozen: HTMLElement[]
  poses: Map<HTMLElement, Pose>
  waits: (() => void)[]
  told: Set<HitEvent> // events whose pop-up is up
  hit: Map<HitEvent, Hit> // events whose contact has come
  commit: () => void
  g: GuideState
}

// A card the strike left out of its place (knocked back) and that leaves the board when the step lands: where it was, so its slide to
// its pile starts there. (The board's own slide would start from the slot it was last drawn in, so it would jump back first.)
interface Flight { tid: string; x: number; y: number; w: number; r: number; dark: boolean }

/**
 * `fresh` is the state the latest step produced; effects play only for it, never for undo, redo or a reloaded game.
 * `speed` speeds the strikes up (fast enemy turns).
 * strike(g, show): plays the fights and tower hits of the fresh state g on the board as it still is, then calls show() to put g on
 * screen; false (show it now yourself) when there is nothing to strike or motion is reduced.
 * striking(): a strike is playing. land(): end it now, at its end state, and show its step: a tap during a strike skips it.
 * held(g): how long g's strike took, so the step's reading time can count it.
 */
export function useFx(game: GuideState | null, fresh: GuideState | null, root: RefObject<HTMLElement | null>, speed = 1) {
  const [pops, setPops] = useState<Pop[]>([])
  const run = useRef<Run | null>(null)
  const played = useRef(new WeakSet<GameEvent>()) // fights and hits the strike already sounded and told
  const took = useRef(new WeakMap<GuideState, number>())
  const flights = useRef<{ g: GuideState; list: Flight[] } | null>(null)

  // not cancelled when the next step arrives: a pop-up always finishes and removes itself
  const later = (ms: number, f: () => void) => { window.setTimeout(f, ms) }
  const pop = (ms: number, p: PopIn | null) => {
    if (!p) return
    const id = nextId++, life = popMs(`${p.text} ${p.sub ?? ''}`)
    later(ms, () => setPops(ps => [...ps, { ...p, id, ms: life }]))
    later(ms + life + 50, () => setPops(ps => ps.filter(q => q.id !== id)))
  }
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const field = () => root.current?.querySelector<HTMLElement>('.field, .cardtable') ?? null
  const sound = (h: Hit, ms: number, round: number) => sfx(h.sound, ms, { mood: h.mood, pan: h.pan, pitch: h.pitched ? nextPitch(round) : 1 })

  // the step is shown: what the strike didn't play (a card played, a new round, the end, or a hit it couldn't reach) plays now
  useEffect(() => {
    const el = root.current
    if (!game || game !== fresh || !game.events?.length || !el) return
    const b = board(el)
    let biggest = 0
    let n = 0
    for (const e of game.events as GameEvent[]) {
      const ms = n * STAGGER
      if (isHit(e)) {
        if (played.current.has(e)) continue
        const h = hitOf(e, b)
        pop(ms, h.pop); sound(h, ms, game.round); biggest = Math.max(biggest, h.weight)
        n++
        continue
      }
      switch (e.type) {
        case 'round': sfx('round', ms); break // the round chip on the bridge rolls its number (RoundChip)
        case 'play': {
          const where = { mood: e.side === 'P' ? 'good' : 'bad', pan: b.pan(`lane-${e.lane}`) } as const
          // a last stand is a card nobody paid for, out of turn: it says so where it lands, so it never seems to come from nowhere
          if (e.free) { const p = b.at(`lane-${e.lane}`); pop(ms, p && { ...p, text: 'LAST STAND!', sub: `${e.side === 'P' ? 'your' : 'enemy'} free card`, kind: `stand ${where.mood}` }); sfx('big', ms, where); biggest = Math.max(biggest, 1) }
          else sfx('place', ms, where)
          n++
          break
        }
        case 'reveal': sfx('tap', ms, { pan: b.pan(`tower-E-${e.stack}`) }); n++; break
        case 'over': sfx(e.winner === 'P' ? 'win' : 'lose', ms + 350); break
        default: break
      }
    }
    if (biggest && !calm()) shake(field(), TRAUMA[biggest])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  // the step is drawn (not yet painted): a knocked-back card slides from where it was knocked to its new place, recovering on the way
  useLayoutEffect(() => {
    const f = flights.current, el = root.current
    if (!f || f.g !== game || !el) return
    flights.current = null
    for (const t of f.list) {
      const card = el.querySelector<HTMLElement>(`[data-tid="${t.tid}"]`)
      if (!card) continue // it went where the board doesn't show it (under a pile at the table)
      const r = card.getBoundingClientRect(), k = t.w / (card.offsetWidth || t.w)
      card.animate([
        { transform: `translate(${t.x - (r.left + r.width / 2)}px, ${t.y - (r.top + r.height / 2)}px) rotate(${t.r}deg) scale(${k})`, filter: t.dark ? 'brightness(.62) saturate(.6)' : 'none' },
        { transform: 'none', filter: 'none' },
      ], { duration: 450, easing: 'cubic-bezier(.45,0,.2,1)' }) // it is already moving: off at once, no slow start
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  const land = () => {
    const r = run.current
    if (!r) return
    r.cut = true
    for (const a of r.anims) { try { a.finish() } catch { /* an infinite or detached animation */ } }
    for (const w of r.waits.splice(0)) w()
    // a hit whose contact came but whose pop-up hadn't yet: say it now
    for (const [e, h] of r.hit) if (!r.told.has(e)) { r.told.add(e); pop(0, h.pop) }
    end(r)
  }
  // the strike is over (played out or cut): show the step, then let go of the elements it moved once the new board is drawn
  // (a beaten card keeps its knocked-back pose until then, so its slide to the pile starts where it was knocked to)
  const end = (r: Run) => {
    if (run.current !== r) return
    run.current = null
    const list: Flight[] = []
    for (const [x, p] of r.poses) {
      if (!p.x && !p.y && !p.r) continue
      const card = x.querySelector<HTMLElement>('[data-tid]'), tid = card?.dataset.tid
      if (!card || !tid) continue
      const b = card.getBoundingClientRect()
      list.push({ tid, x: b.left + b.width / 2, y: b.top + b.height / 2, w: card.offsetWidth * p.s, r: p.r, dark: true })
      quick(tid, 0.01) // the board's own slide is skipped: this one replaces it
    }
    flights.current = list.length ? { g: r.g, list } : null
    r.commit()
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const a of r.anims) a.cancel()
      for (const el of r.frozen) el.style.animation = ''
    }))
  }

  const strike = (g: GuideState, show: () => void): boolean => {
    const el = root.current
    const hits = (g.events ?? []).filter(isHit)
    if (!el || !hits.length || calm() || document.hidden) return false
    land()
    const b = board(el), layer = el.querySelector('.fxlayer')
    const r: Run = { cut: false, anims: [], frozen: [], poses: new Map(), waits: [], told: new Set(), hit: new Map(), commit: show, g }
    const t0 = performance.now()
    run.current = r
    const ms = (t: number) => t / speed
    const wait = (t: number) => new Promise<void>(res => {
      if (r.cut) return res()
      const id = window.setTimeout(() => { r.waits = r.waits.filter(w => w !== go); res() }, ms(t))
      const go = () => { clearTimeout(id); res() }
      r.waits.push(go)
    })
    // stop a card's or tower's trembling: the strike moves it now
    const freeze = (x: HTMLElement) => { if (!r.frozen.includes(x)) { r.frozen.push(x); x.style.animation = 'none' } }
    const to = (x: HTMLElement, p: Partial<Pose>, t: number, easing: string, extra?: [Keyframe, Keyframe]) => {
      const from = r.poses.get(x) ?? REST, next = { ...from, ...p }
      r.poses.set(x, next)
      const a = x.animate([{ transform: css(from), ...extra?.[0] }, { transform: css(next), ...extra?.[1] }], { duration: ms(t), easing, fill: 'forwards' })
      r.anims.push(a)
      return a.finished.then(() => undefined, () => undefined)
    }
    // the struck thing shakes in place through the hit-stop (the attacker holds still): the freeze reads as impact, not as a stall
    const jolt = (x: HTMLElement, ux: number, uy: number, t: number, amp: number) => {
      const p = r.poses.get(x) ?? REST, px = -uy * amp, py = ux * amp
      const at = (k: number) => css({ ...p, x: p.x + px * k + ux * amp * 0.5 * Math.abs(k), y: p.y + py * k + uy * amp * 0.5 * Math.abs(k) })
      r.anims.push(x.animate([{ transform: at(0) }, { transform: at(1) }, { transform: at(-1) }, { transform: at(0.6) }, { transform: at(0) }], { duration: ms(Math.max(40, t)), easing: 'linear' }))
    }
    const contact = (e: HitEvent, h: Hit, x: number, y: number, ux: number, uy: number) => {
      r.hit.set(e, h)
      played.current.add(e)
      sound(h, 0, g.round)
      shake(field(), TRAUMA[h.weight])
      const kind: SparkKind = e.type === 'tower' ? 'chips' : e.ace ? 'ace' : e.double ? `suit${(e.double === 'P' ? e.mine : e.theirs).card.suit}` as SparkKind : 'hit'
      sparks(layer, kind, x - b.left, y - b.top, ux, uy, e.type === 'tower' ? [0, 5, 9, 14, 20][h.weight] : 5, speed)
    }
    const tell = (e: HitEvent, h: Hit) => { if (!r.told.has(e)) { r.told.add(e); pop(0, h.pop) } }
    const unit = (tid: string) => el.querySelector<HTMLElement>(`[data-tid="${tid}"]`)?.closest<HTMLElement>('.unit') ?? null

    const fight = async (e: FightEvent) => {
      const h = hitOf(e, b), a = unit(e.mine.tid), z = unit(e.theirs.tid)
      if (!a || !z) { contact(e, h, b.left + (h.pop?.x ?? 0), b.top + (h.pop?.y ?? 0), 0, -1); tell(e, h); return }
      freeze(a); freeze(z)
      const m = between(a.getBoundingClientRect(), z.getBoundingClientRect())
      const { ux, uy } = m, go = Math.min(m.dist * 0.45, Math.max(5, m.gap / 2 + 3))
      // wind up: each pulls back a little, then they strike and meet in the middle
      await Promise.all([to(a, { x: -ux * 7, y: -uy * 7, s: 1.03 }, 80, 'ease-out'), to(z, { x: ux * 7, y: uy * 7, s: 1.03 }, 80, 'ease-out')])
      if (r.cut) return
      await Promise.all([to(a, { x: ux * go, y: uy * go, s: 1.06 }, 90, 'cubic-bezier(.5,0,1,.6)'), to(z, { x: -ux * go, y: -uy * go, s: 1.06 }, 90, 'cubic-bezier(.5,0,1,.6)')])
      if (r.cut) return
      contact(e, h, m.cx + ux * (m.ea + m.gap / 2), m.cy + uy * (m.ea + m.gap / 2), ux, uy)
      const hold = HOLD[h.weight]
      const losers = e.winner === 'tie' ? [a, z] : e.winner === 'P' ? [z] : [a]
      for (const x of losers) jolt(x, ux, uy, hold, 2.5)
      await wait(hold)
      if (r.cut) return
      tell(e, h)
      // the winner goes back to its place (bright for a moment when a rule won it); the loser is knocked back, turned and darkened
      const big = h.weight >= 2, dark: [Keyframe, Keyframe] = [{ filter: 'brightness(1)' }, { filter: 'brightness(.62) saturate(.6)' }]
      const flash: [Keyframe, Keyframe] = [{ filter: `brightness(${big ? 1.9 : 1.25})` }, { filter: 'brightness(1)' }]
      const knock = (x: HTMLElement, s: number) => to(x, { x: -s * ux * (go + 16), y: -s * uy * (go + 16), r: (s * ux >= 0 ? 1 : -1) * (Math.random() * 6 + 7), s: 0.96 }, 210, 'cubic-bezier(.2,.8,.3,1)', dark)
      const back = (x: HTMLElement) => to(x, REST, 220, 'cubic-bezier(.2,.8,.3,1.4)', flash)
      await Promise.all([
        e.winner === 'P' ? back(a) : knock(a, 1),
        e.winner === 'E' ? back(z) : knock(z, -1),
      ])
    }

    const tower = async (e: TowerEvent) => {
      const h = hitOf(e, b), a = unit(e.tid)
      const anchor = el.querySelector<HTMLElement>(`[data-anchor~="${towerAnchor(e)}"]`)
      const part = anchor?.querySelector<HTMLElement>('.tslot, .fc') ?? anchor
      if (!a || !anchor || !part) { contact(e, h, b.left + (h.pop?.x ?? 0), b.top + (h.pop?.y ?? 0), 0, e.side === 'P' ? -1 : 1); tell(e, h); return }
      freeze(a); freeze(anchor)
      const m = between(a.getBoundingClientRect(), part.getBoundingClientRect())
      const { ux, uy } = m, go = Math.min(m.dist * 0.7, Math.max(6, m.gap + 3))
      await to(a, { x: -ux * 9, y: -uy * 9, s: 1.04 }, 80, 'ease-out')
      if (r.cut) return
      await to(a, { x: ux * go, y: uy * go, s: 1.09 }, 90, 'cubic-bezier(.5,0,1,.6)')
      if (r.cut) return
      contact(e, h, m.cx + ux * (m.ea + m.gap), m.cy + uy * (m.ea + m.gap), ux, uy)
      const hold = HOLD[h.weight]
      jolt(part, ux, uy, hold, 2 + h.weight)
      await wait(hold)
      if (r.cut) return
      tell(e, h)
      // a broken card's attacker steps back to its place (wounded, or gone to its pile once the step lands); the tower shoots back an
      // attacker that only cracked it, which is knocked away and darkened
      if (e.result === 'crack') await to(a, { x: -ux * 18, y: -uy * 18, r: (ux >= 0 ? -1 : 1) * 9, s: 0.95 }, 220, 'cubic-bezier(.2,.8,.3,1)', [{ filter: 'brightness(1)' }, { filter: 'brightness(.62) saturate(.6)' }])
      else await to(a, REST, 200, 'cubic-bezier(.2,.8,.3,1.3)')
    }

    void (async () => {
      for (const [i, e] of hits.entries()) {
        if (r.cut) break
        if (i) await wait(60)
        await (e.type === 'fight' ? fight(e) : tower(e))
      }
      took.current.set(g, performance.now() - t0)
      end(r)
    })()
    return true
  }

  return {
    pops, strike, land,
    striking: () => run.current !== null,
    held: (g: GuideState | null) => (g && took.current.get(g)) ?? 0,
  }
}

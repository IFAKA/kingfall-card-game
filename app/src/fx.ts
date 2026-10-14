// Game feel: turns the events of each fresh step into pop-ups, a board shake and sounds.
// Effects are placed on board elements marked with data-anchor ("lane-0", "tower-E-L", ...), so any board layout can use them.
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { isRed } from './engine'
import type { GameEvent, GuideState } from './guide'
import { sfx } from './sfx'

export interface Pop { id: number; x: number; y: number; text: string; sub?: string; kind: string }
export type Shake = '' | 'shake-s' | 'shake-m' | 'shake-l'

let nextId = 1
const STAGGER = 140 // ms between effects of the same step, so two fights read as two hits

/**
 * `fresh` is the state the latest step produced; effects play only for it, never for undo, redo or a reloaded game.
 */
export function useFx(game: GuideState | null, fresh: GuideState | null, root: RefObject<HTMLElement | null>) {
  const [pops, setPops] = useState<Pop[]>([])
  const [shake, setShake] = useState<Shake>('')

  useEffect(() => {
    const el = root.current
    if (!game || game !== fresh || !game.events?.length || !el) return
    const pr = el.getBoundingClientRect()
    const width = pr.width
    // keep pop-ups (and their reason line) inside the board instead of cut off at its edge
    const inside = (x: number) => Math.min(Math.max(x, Math.min(110, width / 2)), width - Math.min(110, width / 2))
    const local = (cx: number, cy: number) => ({ x: inside(cx - pr.left), y: cy - pr.top })
    const rects = (name: string) => [...el.querySelectorAll(`[data-anchor~="${name}"]`)].map(e => e.getBoundingClientRect())
    const at = (name: string) => {
      const rs = rects(name)
      if (!rs.length) return null
      const l = Math.min(...rs.map(r => r.left)), r = Math.max(...rs.map(r => r.right)), t = Math.min(...rs.map(r => r.top)), b = Math.max(...rs.map(r => r.bottom))
      return local((l + r) / 2, (t + b) / 2)
    }
    // sounds sit gently left or right where they happen on screen
    const pan = (name: string) => {
      const rs = rects(name)
      return rs.length ? ((rs.reduce((x, r) => x + r.left + r.width / 2, 0) / rs.length / innerWidth) * 2 - 1) * 0.5 : 0
    }
    const center = { x: pr.width / 2, y: pr.height / 2 }
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    let biggest = 0
    // not cancelled when the next step arrives: a pop-up always finishes and removes itself
    const later = (ms: number, f: () => void) => { window.setTimeout(f, ms) }
    const pop = (ms: number, p: Omit<Pop, 'id'> | null) => {
      if (!p) return
      const id = nextId++
      later(ms, () => setPops(ps => [...ps, { ...p, id }]))
      later(ms + 1500, () => setPops(ps => ps.filter(q => q.id !== id)))
    }
    const hit = (size: 1 | 2 | 3) => { biggest = Math.max(biggest, size) }

    let n = 0
    for (const e of game.events as GameEvent[]) {
      const ms = n * STAGGER
      switch (e.type) {
        case 'round': pop(ms, { ...center, text: `Round ${e.round}`, kind: 'round' }); sfx('round', ms); break
        case 'play': sfx('place', ms, { mood: e.side === 'P' ? 'good' : 'bad', pan: pan(`lane-${e.lane}`) }); n++; break
        case 'fight': {
          const p = at(`lane-${e.lane}`)
          const good = e.winner === 'P' ? 'good' : e.winner === 'E' ? 'bad' : 'tie'
          const sound = { mood: good, pan: pan(`lane-${e.lane}`) } as const
          // your value first, the sign pointing at the winner: "13 > 3"
          const vs = `${e.mine.value} ${e.winner === 'P' ? '>' : e.winner === 'E' ? '<' : '='} ${e.theirs.value}`
          if (e.ace) {
            pop(ms, p && { ...p, text: 'ACE!', kind: `ace ${good}` }); sfx('big', ms, sound); hit(2)
          } else if (e.double) {
            const d = e.double === 'P' ? e.mine : e.theirs
            pop(ms, p && { ...p, text: '×2!', sub: vs, kind: `x2 ${isRed(d.card) ? 'red' : 'black'} ${good}` }); sfx('big', ms, sound); hit(2)
          } else {
            pop(ms, p && { ...p, text: vs, sub: e.winner === 'tie' ? 'tie' : undefined, kind: `fight ${good}` }); sfx('clash', ms, sound); hit(1)
          }
          n++
          break
        }
        case 'tower': {
          const p = at(`tower-${e.side === 'P' ? 'E' : 'P'}-${e.stack}`)
          const good = e.side === 'P' ? 'good' : 'bad'
          const sound = { mood: good, pan: pan(`tower-${e.side === 'P' ? 'E' : 'P'}-${e.stack}`) } as const
          if (e.result === 'crack') { pop(ms, p && { ...p, text: 'CRACK', kind: `crack ${good}` }); sfx('crack', ms, sound); hit(1) }
          else if (!e.destroyed) { pop(ms, p && { ...p, text: 'BREAK!', kind: `break ${good}` }); sfx('break', ms, sound); hit(2) }
          else { pop(ms, p && { ...p, text: e.stack === 'K' ? 'KING DOWN!' : 'TOWER DOWN!', kind: `down ${good}` }); sfx('boom', ms, sound); hit(3) }
          n++
          break
        }
        case 'over': sfx(e.winner === 'P' ? 'win' : 'lose', ms + 350); break
        default: break
      }
    }
    if (biggest && !calm) {
      later(0, () => setShake(''))
      later(30, () => setShake((['', 'shake-s', 'shake-m', 'shake-l'] as const)[biggest]))
      later(600, () => setShake(''))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  return { pops, shake }
}

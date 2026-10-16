// A piece of the recorded game (out/gameplay-av.mp4, the arena with its own sounds), with the player's finger drawn where it touched,
// and an optional push-in: the camera moves from one framing to another over the clip.
import { createContext, useContext } from 'react'
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import rec from '../out/timeline.json'

export const GAME_W = rec.width, GAME_H = rec.height // the game in CSS pixels (432 x 768); the video is 2.5x that

type Finger = { t: number; type: string; x: number; y: number; down?: boolean }
const fingers = (rec.timeline as Finger[]).filter(e => e.type === 'finger' || e.type === 'press' || e.type === 'release')

// where the finger was at a moment of the recording (seconds), and whether it was pressing; null when it wasn't moving nearby
function fingerAt(sec: number) {
  const ms = sec * 1000
  let i = fingers.findIndex(e => e.t > ms)
  if (i === -1) i = fingers.length
  const a = fingers[i - 1], b = fingers[i]
  if (!a) return null
  const idle = ms - a.t
  if (idle > 450 && (!b || b.t - ms > 300)) return null // a hand rests between moves: it lifts off screen
  const k = b && b.t > a.t ? Math.min(1, Math.max(0, (ms - a.t) / (b.t - a.t))) : 0
  const x = b ? a.x + (b.x - a.x) * k : a.x, y = b ? a.y + (b.y - a.y) * k : a.y
  const down = a.type === 'press' || (a.type === 'finger' && !!a.down)
  const fade = Math.min(1, Math.max(0, 1 - (idle - 250) / 200))
  return { x, y, down, fade }
}

// the size of the box a clip is shown in (the whole frame unless a Shot says otherwise)
export const BoxSize = createContext<{ width: number; height: number } | null>(null)

export type Framing = { scale: number; x: number; y: number } // x, y: the point of the game (CSS px) at the centre of the shot

export function GameClip({ at, speed = 1, from = { scale: 1, x: GAME_W / 2, y: GAME_H / 2 }, to, volume = 0.9, dur }: {
  at: number // where in the recording the clip starts, seconds
  speed?: number
  from?: Framing
  to?: Framing
  volume?: number
  dur: number // the clip's length on the timeline, frames
}) {
  const frame = useCurrentFrame(), video = useVideoConfig(), { fps } = video
  const { width, height } = useContext(BoxSize) ?? video
  const p = interpolate(frame, [0, dur], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const f = to ? { scale: from.scale + (to.scale - from.scale) * p, x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p } : from
  // the game fills the box's height (it is 9:16, the box may be wider); scale and centre on the framing's point, never past the game's edge
  const base = height / GAME_H, s = base * f.scale
  const gw = GAME_W * s, gh = GAME_H * s
  const left = Math.min(0, Math.max(width - gw, width / 2 - f.x * s)), top = Math.min(0, Math.max(height - gh, height / 2 - f.y * s))
  const ox = gw < width ? (width - gw) / 2 : left, oy = gh < height ? (height - gh) / 2 : top
  const finger = fingerAt(at + (frame / fps) * speed)
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: ox, top: oy, width: gw, height: gh }}>
        <OffthreadVideo src={staticFile('gameplay-av.mp4')} trimBefore={Math.round(at * fps)} playbackRate={speed} volume={volume} style={{ width: '100%', height: '100%' }} />
        {finger && (
          <div style={{
            position: 'absolute', left: finger.x * s, top: finger.y * s, width: 46 * s, height: 46 * s, marginLeft: -23 * s, marginTop: -23 * s,
            borderRadius: '50%', background: `rgba(255,255,255,${finger.down ? 0.42 : 0.22})`, border: `${3 * s}px solid rgba(255,255,255,.85)`,
            boxShadow: '0 4px 14px rgba(0,0,0,.35)', transform: `scale(${finger.down ? 0.82 : 1})`, opacity: finger.fade,
          }} />
        )}
      </div>
    </AbsoluteFill>
  )
}

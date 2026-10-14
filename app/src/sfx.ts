// Small synthesized sounds: built on the fly with Web Audio, so there are no files to load and they work offline.
// The audio context starts on the first sound after a tap (browsers block sound before any user gesture).
const MUTE_KEY = 'kingfall-muted'
let ctx: AudioContext | null = null
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } })()

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* private mode: keep it for this visit */ }
}

function audio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface Tone { freq: number; to?: number; dur: number; type?: OscillatorType; gain?: number; at?: number }
function tone(a: AudioContext, { freq, to, dur, type = 'sine', gain = 0.2, at = 0 }: Tone) {
  const t = a.currentTime + at
  const o = a.createOscillator(), g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g).connect(a.destination)
  o.start(t); o.stop(t + dur + 0.02)
}

interface Noise { dur: number; filter: BiquadFilterType; freq: number; gain?: number; at?: number }
function noise(a: AudioContext, { dur, filter, freq, gain = 0.25, at = 0 }: Noise) {
  const t = a.currentTime + at
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain()
  src.buffer = buf
  f.type = filter; f.frequency.value = freq
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  src.connect(f).connect(g).connect(a.destination)
  src.start(t)
}

export type Sfx = 'place' | 'clash' | 'big' | 'crack' | 'break' | 'boom' | 'round' | 'win' | 'lose' | 'tap'

const SOUNDS: Record<Sfx, (a: AudioContext) => void> = {
  // a card set down on the table
  place: a => { tone(a, { freq: 150, to: 70, dur: 0.12, gain: 0.35 }); noise(a, { dur: 0.05, filter: 'lowpass', freq: 900, gain: 0.2 }) },
  // two soldiers meet
  clash: a => { noise(a, { dur: 0.12, filter: 'bandpass', freq: 2600, gain: 0.35 }); tone(a, { freq: 320, to: 180, dur: 0.08, type: 'square', gain: 0.06 }) },
  // a rule decided it: ×2 or ACE
  big: a => { noise(a, { dur: 0.14, filter: 'bandpass', freq: 2200, gain: 0.35 }); tone(a, { freq: 420, to: 980, dur: 0.2, type: 'triangle', gain: 0.18, at: 0.04 }) },
  crack: a => { noise(a, { dur: 0.08, filter: 'highpass', freq: 3000, gain: 0.3 }); tone(a, { freq: 900, to: 520, dur: 0.07, type: 'square', gain: 0.05 }) },
  break: a => { noise(a, { dur: 0.28, filter: 'lowpass', freq: 1400, gain: 0.4 }); tone(a, { freq: 220, to: 80, dur: 0.25, type: 'triangle', gain: 0.25 }) },
  // a whole tower falls
  boom: a => { noise(a, { dur: 0.7, filter: 'lowpass', freq: 700, gain: 0.5 }); tone(a, { freq: 95, to: 38, dur: 0.6, gain: 0.45 }) },
  round: a => { tone(a, { freq: 660, dur: 0.07, type: 'triangle', gain: 0.08 }); tone(a, { freq: 880, dur: 0.09, type: 'triangle', gain: 0.08, at: 0.07 }) },
  win: a => [523, 659, 784, 1047].forEach((f, i) => tone(a, { freq: f, dur: i === 3 ? 0.5 : 0.14, type: 'triangle', gain: 0.18, at: i * 0.12 })),
  lose: a => [440, 370, 311, 233].forEach((f, i) => tone(a, { freq: f, dur: i === 3 ? 0.55 : 0.18, type: 'sawtooth', gain: 0.06, at: i * 0.18 })),
  tap: a => tone(a, { freq: 520, dur: 0.035, type: 'triangle', gain: 0.08 }),
}

export function sfx(name: Sfx, delayMs = 0) {
  if (muted) return
  const go = () => { try { SOUNDS[name](audio()) } catch { /* no audio on this device */ } }
  if (delayMs) setTimeout(go, delayMs)
  else go()
}

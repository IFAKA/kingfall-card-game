// Writes out/music.wav: an original 120 BPM track for the trailer, synthesized from scratch (no samples, no licences).
// A minor, chords Am F C G. Plucked strings (a lute, for the card table in a castle), war drums, bass and brass, laid out on the
// trailer's plan (src/plan.ts): a tense hook, an impact on the title, a groove under the rules, a build, a drop when the king falls.
import fs from 'node:fs'
import { BEAT, S } from '../src/plan.ts'

const SR = 48000
const LEN = Math.ceil((S.out * BEAT + 1) * SR)
const L = new Float32Array(LEN), R = new Float32Array(LEN)
const sendL = new Float32Array(LEN), sendR = new Float32Array(LEN) // into the hall reverb
const at = (beat: number) => beat * BEAT
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)
let seed = 7
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1 }

function put(i: number, v: number, pan: number, send: number) {
  if (i < 0 || i >= LEN) return
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4)
  L[i] += v * l; R[i] += v * r
  sendL[i] += v * l * send; sendR[i] += v * r * send
}

// a state-variable lowpass/bandpass/highpass, cutoff can change every sample
function svf() {
  let lo = 0, band = 0
  return (x: number, cutoff: number, q = 0.7) => {
    const f = 2 * Math.sin(Math.PI * Math.min(cutoff, SR / 6) / SR)
    lo += f * band
    const hi = x - lo - band / q
    band += f * hi
    return { lo, band, hi }
  }
}

function kick(t: number, g = 1) {
  const s = Math.floor(t * SR), n = Math.floor(0.45 * SR)
  let ph = 0
  for (let i = 0; i < n; i++) {
    const x = i / SR, f = 45 + 110 * Math.exp(-x * 28)
    ph += 2 * Math.PI * f / SR
    const click = i < 200 ? rnd() * (1 - i / 200) * 0.3 : 0
    put(s + i, (Math.sin(ph) * Math.exp(-x * 7) + click) * 0.9 * g, 0, 0.02)
  }
}
function snare(t: number, g = 1, pan = 0) {
  const s = Math.floor(t * SR), n = Math.floor(0.3 * SR), f = svf()
  let ph = 0
  for (let i = 0; i < n; i++) {
    const x = i / SR
    ph += 2 * Math.PI * 185 / SR
    const noise = f(rnd(), 3500, 0.6).band
    put(s + i, (Math.sin(ph) * Math.exp(-x * 30) * 0.5 + noise * Math.exp(-x * 14) * 1.2) * 0.55 * g, pan, 0.25)
  }
}
function hat(t: number, g = 1, open = false) {
  const s = Math.floor(t * SR), n = Math.floor((open ? 0.35 : 0.06) * SR), f = svf()
  for (let i = 0; i < n; i++) {
    const x = i / SR
    put(s + i, f(rnd(), 9000, 0.8).hi * Math.exp(-x * (open ? 9 : 60)) * 0.16 * g, 0.25, 0.1)
  }
}
// war drum: a deep pitched thump with a skin slap
function tom(t: number, f0: number, g = 1, pan = 0) {
  const s = Math.floor(t * SR), n = Math.floor(0.7 * SR), f = svf()
  let ph = 0
  for (let i = 0; i < n; i++) {
    const x = i / SR, fr = f0 * (1 + 0.6 * Math.exp(-x * 20))
    ph += 2 * Math.PI * fr / SR
    const slap = f(rnd(), 1200, 0.7).band * Math.exp(-x * 40)
    put(s + i, (Math.sin(ph) * Math.exp(-x * 5) + slap * 0.6) * 0.7 * g, pan, 0.3)
  }
}
// the impact: a sub drop, a burst of low noise and a long hall tail
function boom(t: number, g = 1) {
  const s = Math.floor(t * SR), n = Math.floor(3 * SR), f = svf()
  let ph = 0
  for (let i = 0; i < n; i++) {
    const x = i / SR, fr = 30 + 60 * Math.exp(-x * 6)
    ph += 2 * Math.PI * fr / SR
    const rumble = f(rnd(), 400 + 2500 * Math.exp(-x * 10), 0.6).lo
    put(s + i, (Math.sin(ph) * Math.exp(-x * 1.6) * 0.9 + rumble * Math.exp(-x * 3) * 1.3) * g, 0, 0.6)
  }
  kick(t, 1.1 * g)
}
function crash(t: number, g = 1) {
  const s = Math.floor(t * SR), n = Math.floor(2.5 * SR), f = svf()
  for (let i = 0; i < n; i++) {
    const x = i / SR
    put(s + i, f(rnd(), 6000, 0.5).hi * Math.exp(-x * 2.2) * 0.22 * g, -0.2, 0.4)
  }
}
// plucked string (Karplus-Strong): a lute
function pluck(t: number, midi: number, g = 1, pan = 0, dur = 1.6) {
  const s = Math.floor(t * SR), n = Math.floor(dur * SR), p = Math.round(SR / hz(midi))
  const buf = new Float32Array(p)
  for (let i = 0; i < p; i++) buf[i] = rnd()
  let prev = 0
  for (let i = 0; i < n; i++) {
    const j = i % p, v = buf[j]
    buf[j] = 0.497 * (v + prev); prev = v
    put(s + i, v * 0.32 * g * Math.min(1, (n - i) / 2000), pan, 0.3)
  }
}
function saw(ph: number) { return 2 * (ph - Math.floor(ph + 0.5)) }
function bass(t: number, midi: number, dur: number, g = 1) {
  const s = Math.floor(t * SR), n = Math.floor(dur * SR), f = svf()
  let a = 0, b = 0
  for (let i = 0; i < n; i++) {
    const x = i / SR, fr = hz(midi)
    a += fr / SR; b += fr / SR
    const env = Math.min(1, x / 0.005) * Math.exp(-x * 2.5) * Math.min(1, (n - i) / 400)
    const tone = f(saw(a), 300 + 1400 * Math.exp(-x * 12), 0.9).lo
    put(s + i, (tone * 0.5 + Math.sin(2 * Math.PI * b) * 0.5) * env * 0.5 * g, 0, 0)
  }
}
// brass: detuned saws whose filter opens as the note swells
function brass(t: number, notes: number[], dur: number, g = 1, attack = 0.06) {
  const s = Math.floor(t * SR), n = Math.floor((dur + 0.4) * SR)
  notes.forEach((m, k) => {
    for (const det of [-0.12, 0.12]) {
      const f = svf(), fr = hz(m + det)
      let ph = rnd() * 0.5
      const pan = ((k % 2) * 2 - 1) * 0.35 * (det > 0 ? 1 : -1)
      for (let i = 0; i < n; i++) {
        const x = i / SR
        ph += fr * (1 + 0.003 * Math.sin(2 * Math.PI * 5 * x)) / SR
        const env = Math.min(1, x / attack) * (x < dur ? 1 : Math.exp(-(x - dur) * 9))
        const cut = 500 + 2600 * Math.min(1, x / 0.25) * (x < dur ? 1 : Math.exp(-(x - dur) * 6))
        put(s + i, f(saw(ph), cut, 0.8).lo * env * 0.09 * g, pan, 0.35)
      }
    }
  })
}
// a soft bed under the hook and the end
function pad(t: number, notes: number[], dur: number, g = 1) {
  const s = Math.floor(t * SR), n = Math.floor(dur * SR)
  notes.forEach((m, k) => {
    const f = svf(), fr = hz(m)
    let ph = 0
    for (let i = 0; i < n; i++) {
      const x = i / SR
      ph += fr / SR
      const env = Math.min(1, x / 0.8) * Math.min(1, (n - i) / (0.8 * SR))
      put(s + i, f(saw(ph), 900, 0.7).lo * env * 0.06 * g, k % 2 ? 0.4 : -0.4, 0.5)
    }
  })
}
function riser(t0: number, t1: number, g = 1) {
  const s = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR), f = svf()
  for (let i = 0; i < n; i++) {
    const p = i / n
    put(s + i, f(rnd(), 300 + 7000 * p * p, 2).band * p * p * 0.5 * g, Math.sin(p * 20) * 0.3, 0.3)
  }
}

// --- the score ---
const CH: Record<string, number[]> = { Am: [57, 60, 64], F: [53, 57, 60], C: [48, 52, 55], G: [55, 59, 62] }
const ROOT: Record<string, number> = { Am: 33, F: 29, C: 36, G: 31 }
const PROG = ['Am', 'F', 'C', 'G']
const chordAt = (beat: number) => PROG[Math.floor((beat - S.loop) / 4) % 4]

// hook: a held low A, a heartbeat that quickens, a riser into the title
pad(at(S.hook), [45, 52, 57], at(S.title - S.hook) + 0.3, 1.2)
for (const b of [0, 1.5, 2.5, 3.25, 3.75, 4.25, 4.625]) kick(at(S.hook + b), 0.55 + b * 0.08)
riser(at(S.hook + 1), at(S.title), 0.9)

// title: the impact, the brass on Am, war drums answering
boom(at(S.title), 1.1); crash(at(S.title), 1)
brass(at(S.title), [45, 52, 57, 60, 64], at(3.5), 1.2, 0.02)
for (const [b, f] of [[2, 70], [2.5, 70], [3, 55], [3.5, 55]] as [number, number][]) tom(at(S.title + b), f, 0.9, b % 1 ? 0.3 : -0.3)

// the groove, from the rules to the build: one chord a bar
for (let b = S.loop; b < S.build; b++) {
  const inBar = (b - S.loop) % 4, ch = chordAt(b), full = b >= S.towers
  if (inBar === 0 || inBar === 2) kick(at(b), 0.9)
  if (inBar === 3) kick(at(b + 0.5), 0.6)
  if (inBar === 1 || inBar === 3) snare(at(b), full ? 1 : 0.8)
  hat(at(b), 0.8); hat(at(b + 0.5), 0.5, inBar === 3 && full)
  bass(at(b), ROOT[ch], BEAT * 0.45, 1); bass(at(b + 0.5), ROOT[ch] + (inBar === 3 ? 7 : 0), BEAT * 0.4, 0.8)
  // the lute arpeggio: chord tones up and back, eighth notes
  const tones = [...CH[ch], CH[ch][0] + 12]
  const order = [0, 1, 2, 3, 2, 1, 2, 3]
  pluck(at(b), tones[order[inBar * 2]] + 12, 0.9, -0.3)
  pluck(at(b + 0.5), tones[order[inBar * 2 + 1]] + 12, 0.7, 0.3)
  if (b >= S.suits && inBar === 0) brass(at(b), CH[ch], BEAT * 0.9, 0.8)
  if (full && inBar === 2) brass(at(b + 0.5), CH[ch].map(n => n + 12), BEAT * 0.3, 0.6)
  if (full && inBar === 3 && (b - S.loop) % 8 === 7) for (const k of [0, 0.25, 0.5, 0.75]) tom(at(b + k), 90 - k * 40, 0.6, k * 0.8 - 0.3)
}

// build: chords held, the snare rolls faster, everything rises
for (let b = S.build; b < S.drop; b++) {
  const ch = chordAt(b), inBar = (b - S.build) % 4
  if (inBar === 0) { brass(at(b), CH[ch], BEAT * 3.8, 0.7, 0.3); bass(at(b), ROOT[ch], BEAT * 3.8, 0.7) }
  kick(at(b), 0.8)
  const div = b < S.build + 4 ? 2 : b < S.build + 6 ? 4 : 8
  for (let k = 0; k < div; k++) snare(at(b + k / div), 0.3 + 0.7 * (b - S.build + k / div) / 8, (k % 2) * 0.4 - 0.2)
}
riser(at(S.build), at(S.drop), 1.2)

// drop: the king falls
boom(at(S.drop), 1.2); crash(at(S.drop), 1.2)
for (let b = S.drop; b < S.end; b++) {
  const ch = chordAt(b), inBar = (b - S.drop) % 4
  if (inBar === 0) brass(at(b), [...CH[ch], CH[ch][0] + 12], BEAT * 3.6, 1.1, 0.03)
  kick(at(b), 1); if (inBar % 2) snare(at(b), 1); else tom(at(b + 0.5), 65, 0.8)
  hat(at(b), 0.8); hat(at(b + 0.5), 0.6)
  bass(at(b), ROOT[ch], BEAT * 0.45, 1.1); bass(at(b + 0.5), ROOT[ch] + 12, BEAT * 0.4, 0.8)
  const tones = [...CH[ch], CH[ch][0] + 12]
  for (let k = 0; k < 4; k++) pluck(at(b + k / 4), tones[(inBar * 4 + k) % 4] + 12, 0.55, k % 2 ? 0.35 : -0.35)
}

// end card: the last impact, Am held under the logo, the lute plays the opening notes once more
boom(at(S.end), 1); crash(at(S.end), 0.9)
brass(at(S.end), [45, 52, 57, 60, 64, 69], at(6), 1.1, 0.04)
pad(at(S.end), [45, 52, 57, 64], at(S.out - S.end), 1.2)
bass(at(S.end), 33, at(6), 1)
for (const [k, m] of [[2, 69], [2.5, 72], [3, 76], [4, 74], [4.5, 72], [5, 69]] as [number, number][]) pluck(at(S.end + k), m, 0.8, 0.2, 2.5)
tom(at(S.end + 6), 55, 0.8); tom(at(S.end + 6.5), 55, 0.6)

// --- the hall: a Schroeder reverb (parallel combs into series allpasses) on the send ---
function hall(inp: Float32Array, spread: number) {
  const out = new Float32Array(LEN)
  for (const d of [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(d => d + spread)) {
    const buf = new Float32Array(d); let j = 0, lp = 0
    for (let i = 0; i < LEN; i++) {
      const y = buf[j]
      lp = y * 0.7 + lp * 0.3
      buf[j] = inp[i] + lp * 0.86
      out[i] += y * 0.12
      j = (j + 1) % d
    }
  }
  for (const d of [556, 441, 341, 225].map(d => d + spread)) {
    const buf = new Float32Array(d); let j = 0
    for (let i = 0; i < LEN; i++) {
      const y = buf[j], x = out[i]
      buf[j] = x + y * 0.5
      out[i] = y - x * 0.5
      j = (j + 1) % d
    }
  }
  return out
}
const wetL = hall(sendL, 0), wetR = hall(sendR, 23)

// master: reverb in, a gentle tape-like saturation, normalized to -1 dBFS, a fade at the very end
let peak = 0
for (let i = 0; i < LEN; i++) {
  L[i] = Math.tanh((L[i] + wetL[i] * 0.9) * 0.75)
  R[i] = Math.tanh((R[i] + wetR[i] * 0.9) * 0.75)
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
}
const norm = 0.89 / peak, fadeFrom = Math.floor(at(S.out - 1.5) * SR)
const pcm = Buffer.alloc(LEN * 4)
for (let i = 0; i < LEN; i++) {
  const fade = i < fadeFrom ? 1 : Math.max(0, 1 - (i - fadeFrom) / (at(1.5) * SR))
  pcm.writeInt16LE(Math.round(L[i] * norm * fade * 32767), i * 4)
  pcm.writeInt16LE(Math.round(R[i] * norm * fade * 32767), i * 4 + 2)
}
const head = Buffer.alloc(44)
head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8); head.write('fmt ', 12)
head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28)
head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40)
fs.mkdirSync(new URL('../out/', import.meta.url), { recursive: true })
fs.writeFileSync(new URL('../out/music.wav', import.meta.url), Buffer.concat([head, pcm]))
console.log(`music: ${(LEN / SR).toFixed(1)}s, peak before normalizing ${peak.toFixed(2)}`)

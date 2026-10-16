// Music: the trailer's chords (A minor: Am F C G) and its lute, played live with Web Audio like the sounds, so there are no
// files to load and it works offline. Two pieces: a slow theme for the title and the setup pages, carrying the trailer's closing
// tune, and a lighter loop to think over during a game. Once a side tower has fallen and a king stands open, war drums and brass
// join the game's loop, the way Clash Royale's music turns up for overtime.
// It starts on the first tap (browsers block sound before one), changes piece with a crossfade, goes quiet when a game ends (its
// fanfare plays alone) or the page is hidden, and has its own switch apart from the sounds.
import { audio, roomEcho, whiteNoise } from './sfx'

const OFF_KEY = 'kingfall-music-off'
let off = (() => { try { return localStorage.getItem(OFF_KEY) === '1' } catch { return false } })()

export const isMusicOff = () => off
export function setMusicOff(o: boolean) {
  off = o
  try { localStorage.setItem(OFF_KEY, o ? '1' : '0') } catch { /* private mode: keep it for this visit */ }
  update()
}

export type Scene = 'title' | 'game' | 'none'

// where a piece's notes go: dry to the speakers, wet into the hall
interface Out<N extends AudioNode = AudioNode> { a: BaseAudioContext; dry: N; wet: N; noise: AudioBuffer }

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)

// one note's level and place: through a panner into the dry mix, and `send` of it into the hall
function voice(o: Out, pan: number, send: number) {
  const g = o.a.createGain(), side = o.a.createStereoPanner(), s = o.a.createGain()
  side.pan.value = pan; s.gain.value = send
  g.gain.value = 0 // silent until the note's first change, even if its source starts a hair early (else one loud sample clicks)
  g.connect(side).connect(o.dry)
  side.connect(s).connect(o.wet)
  return g
}

// a plucked string (Karplus-Strong), worked out once per note: the trailer's lute
const strings = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>()
function string(a: BaseAudioContext, midi: number) {
  let notes = strings.get(a)
  if (!notes) strings.set(a, notes = new Map())
  let b = notes.get(midi)
  if (!b) {
    const sr = a.sampleRate, n = Math.floor(2.5 * sr), p = Math.max(2, Math.round(sr / hz(midi) - 0.5))
    b = a.createBuffer(1, n, sr)
    const d = b.getChannelData(0), ring = new Float32Array(p)
    for (let i = 0; i < p; i++) ring[i] = Math.random() * 2 - 1
    for (let i = 0; i < p; i++) ring[i] = (ring[i] + ring[(i + 1) % p]) / 2 // a softer pick than the trailer's: less scratch
    let prev = 0
    for (let i = 0; i < n; i++) {
      const j = i % p, v = ring[j]
      ring[j] = 0.497 * (v + prev); prev = v
      d[i] = v * Math.min(1, (n - i) / 4000)
    }
    notes.set(midi, b)
  }
  return b
}
function pluck(o: Out, t: number, midi: number, gain: number, pan = 0, dur = 2.5) {
  const src = o.a.createBufferSource(), g = voice(o, pan, 0.3)
  src.buffer = string(o.a, midi)
  g.gain.setValueAtTime(gain * 0.3, t)
  if (dur < 2.5) { g.gain.setValueAtTime(gain * 0.3, t + dur - 0.06); g.gain.linearRampToValueAtTime(0.0001, t + dur) }
  src.connect(g)
  src.start(t); src.stop(t + Math.min(dur, 2.5))
}

// bass: a saw and a sine through a filter that closes after the pluck
function bass(o: Out, t: number, midi: number, dur: number, gain: number) {
  const f = o.a.createBiquadFilter(), g = voice(o, 0, 0.03), end = t + dur
  f.type = 'lowpass'; f.Q.value = 0.9
  f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.3)
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.008)
  g.gain.exponentialRampToValueAtTime(gain * 0.35, end); g.gain.linearRampToValueAtTime(0.0001, end + 0.08)
  f.connect(g)
  for (const type of ['sawtooth', 'sine'] as const) {
    const osc = o.a.createOscillator()
    osc.type = type; osc.frequency.value = hz(midi)
    osc.connect(f); osc.start(t); osc.stop(end + 0.1)
  }
}

// a soft bed of held chords: detuned saws, one side each
function pad(o: Out, t: number, notes: number[], dur: number, gain: number) {
  const end = t + dur, fade = Math.min(1, dur / 3)
  for (const [pan, cents] of [[-0.5, -6], [0.5, 6]]) {
    const f = o.a.createBiquadFilter(), g = voice(o, pan, 0.5)
    f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.5
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + fade)
    g.gain.setValueAtTime(gain, end - fade); g.gain.linearRampToValueAtTime(0.0001, end)
    f.connect(g)
    for (const m of notes) {
      const osc = o.a.createOscillator()
      osc.type = 'sawtooth'; osc.frequency.value = hz(m); osc.detune.value = cents
      osc.connect(f); osc.start(t); osc.stop(end + 0.05)
    }
  }
}

// a burst of filtered noise: a shaker, a snare, the slap of a drum skin
function hiss(o: Out, t: number, freq: number, type: BiquadFilterType, dur: number, gain: number, pan = 0, send = 0.15) {
  const src = o.a.createBufferSource(), f = o.a.createBiquadFilter(), g = voice(o, pan, send)
  src.buffer = o.noise; f.type = type; f.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g)
  src.start(t, Math.random() * (o.noise.duration - dur - 0.05)); src.stop(t + dur + 0.02)
}

// a frame drum, or tuned lower a war drum: a pitched thump and the slap of the skin
function drum(o: Out, t: number, f0: number, gain: number, pan = 0) {
  const g = voice(o, pan, 0.25), osc = o.a.createOscillator()
  osc.frequency.setValueAtTime(f0 * 1.6, t); osc.frequency.exponentialRampToValueAtTime(f0, t + 0.06)
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
  osc.connect(g); osc.start(t); osc.stop(t + 0.6)
  hiss(o, t, 1200, 'bandpass', 0.05, gain * 0.5, pan)
}

// brass: detuned saws whose filter opens as the note swells
function brass(o: Out, t: number, notes: number[], dur: number, gain: number) {
  const end = t + dur
  notes.forEach((m, k) => {
    const f = o.a.createBiquadFilter(), g = voice(o, k % 2 ? 0.3 : -0.3, 0.4)
    f.type = 'lowpass'; f.Q.value = 0.8
    f.frequency.setValueAtTime(350, t); f.frequency.linearRampToValueAtTime(1800, t + 0.12); f.frequency.exponentialRampToValueAtTime(700, end)
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.06)
    g.gain.exponentialRampToValueAtTime(gain * 0.6, end); g.gain.linearRampToValueAtTime(0.0001, end + 0.15)
    f.connect(g)
    for (const cents of [-8, 8]) {
      const osc = o.a.createOscillator()
      osc.type = 'sawtooth'; osc.frequency.value = hz(m); osc.detune.value = cents
      osc.connect(f); osc.start(t); osc.stop(end + 0.2)
    }
  })
}

// --- the pieces: each writes one bar (4 beats) starting at t ---
// chords voiced close around middle C, so the lute's arpeggios move by small steps; the bass an octave or two under
const CH: Record<string, number[]> = { Am: [57, 60, 64], F: [57, 60, 65], C: [55, 60, 64], G: [55, 59, 62], Dm: [57, 62, 65], E: [56, 59, 64] }
const ROOT: Record<string, number> = { Am: 45, F: 41, C: 48, G: 43, Dm: 50, E: 40 }
const top = (ch: string) => [...CH[ch], CH[ch][0] + 12]

type Bar = (o: Out, i: number, t: number, beat: number) => void
interface Piece { bpm: number; level: number; bar: Bar; tension?: Bar }

// the title's tune: the trailer's last notes (A C E, D C A), taken up and answered; per bar [beat, note, beats long]
const TITLE_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E']
const TUNE: [number, number, number][][] = [
  [[2, 69, 0.5], [2.5, 72, 0.5], [3, 76, 1]],
  [[0, 74, 1], [1, 72, 1], [2, 69, 2]],
  [[2, 67, 0.5], [2.5, 69, 0.5], [3, 72, 1]],
  [[0, 71, 1], [1, 67, 1], [2, 74, 2]],
  [[0, 76, 2], [2, 72, 1], [3, 74, 1]],
  [[0, 72, 1], [1, 69, 1], [2, 65, 2]],
  [[0, 67, 1], [1, 71, 1], [2, 74, 2]],
  [[0, 71, 2], [2, 68, 1], [3, 71, 1]],
]
// a game's loop: the trailer's four chords twice, then a turn through D minor and E that leads back to A minor
const GAME_CHORDS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Dm', 'Am', 'F', 'E', 'Am', 'F', 'G', 'E']

const PIECES: Record<'title' | 'game', Piece> = {
  // slow, no drums: the tune over a slow arpeggio, then a pass of the lute alone in eighths, so the loop breathes
  title: {
    bpm: 72, level: 0.36,
    bar: (o, i, t, b) => {
      const ch = TITLE_CHORDS[i % 8], up = top(ch), tune = Math.floor(i / 8) % 2 === 0
      pad(o, t, CH[ch], 4 * b + 0.4, 0.05)
      bass(o, t, ROOT[ch], 3.5 * b, 0.22)
      if (tune) {
        ;[0, 1, 2, 1].forEach((k, n) => pluck(o, t + n * b, up[k], 0.5, -0.3))
        for (const [at, m, len] of TUNE[i % 8]) pluck(o, t + at * b, m, 0.9, 0.15, Math.min(2.5, len * b + 0.6))
      } else [0, 1, 2, 3, 2, 1, 2, 1].forEach((k, n) => pluck(o, t + n * b / 2, up[k], n % 2 ? 0.4 : 0.55, n % 2 ? 0.3 : -0.3))
    },
  },
  // light enough to think over: the lute in eighths, a frame drum on 1 and 3, a shaker between; the third phrase thins to one
  // note a beat, an octave up, so the loop doesn't wear
  game: {
    bpm: 92, level: 0.4,
    bar: (o, i, t, b) => {
      const k = i % 16, ch = GAME_CHORDS[k], up = top(ch)
      pad(o, t, CH[ch], 4 * b + 0.3, 0.022)
      bass(o, t, ROOT[ch], 1.5 * b, 0.2)
      bass(o, t + 2 * b, ROOT[ch] + (k % 4 === 3 ? 7 : 0), b, 0.15)
      drum(o, t, 75, 0.3); drum(o, t + 2 * b, 75, 0.18)
      if (k % 2) drum(o, t + 3.5 * b, 90, 0.1, 0.2)
      for (const n of [0.5, 1.5, 2.5, 3.5]) hiss(o, t + n * b, 7000, 'highpass', 0.04, 0.035, 0.3)
      if (k >= 8 && k < 12) [0, 2, 1, 3].forEach((j, n) => pluck(o, t + n * b, up[j] + 12, 0.45, n % 2 ? 0.3 : -0.3))
      else [0, 1, 2, 3, 2, 1, 2, 3].forEach((j, n) => pluck(o, t + n * b / 2, up[j], n % 2 ? 0.4 : 0.55, n % 2 ? 0.3 : -0.3, 1.4))
    },
    // a king stands open: war drums, a snare on 2 and 4, low brass on each chord, a drum fill every fourth bar
    tension: (o, i, t, b) => {
      const k = i % 16, ch = GAME_CHORDS[k]
      for (const [at, f, g] of [[0, 55, 0.4], [1.5, 70, 0.25], [2, 55, 0.36], [3, 70, 0.25]]) drum(o, t + at * b, f, g, at % 1 ? 0.3 : -0.3)
      if (k % 4 === 3) [3, 3.25, 3.5, 3.75].forEach((at, n) => drum(o, t + at * b, 90 - n * 12, 0.3, n * 0.2 - 0.3))
      else drum(o, t + 3.5 * b, 70, 0.22, 0.3)
      for (const at of [1, 3]) hiss(o, t + at * b, 2500, 'bandpass', 0.15, 0.08, -0.1, 0.25)
      brass(o, t, CH[ch].map(m => m - 12), 1.5 * b, 0.035)
      if (k % 2) brass(o, t + 2.5 * b, CH[ch], 0.4 * b, 0.025)
    },
  },
}

// the hall the music plays in: longer than the sounds' stone room, and only above the bass
function hallInto(a: BaseAudioContext, dest: AudioNode) {
  const hp = a.createBiquadFilter(), c = a.createConvolver()
  hp.type = 'highpass'; hp.frequency.value = 200
  c.buffer = roomEcho(a, 2.4)
  hp.connect(c).connect(dest)
  return hp
}

// --- playing: bars are written half a second ahead, so timers that run late never break the beat ---
interface Playing { scene: 'title' | 'game'; out: Out<GainNode>; tense: Out<GainNode>; tensed: boolean; next: number; i: number; until: number }
let want: Scene = 'none', wantTense = false, unlocked = false
let now: Playing | null = null, timer = 0
let room: { a: BaseAudioContext; hall: AudioNode; noise: AudioBuffer } | null = null

function begin(scene: 'title' | 'game') {
  const { a, mix } = audio()
  if (room?.a !== a) room = { a, hall: hallInto(a, mix.master), noise: whiteNoise(a, 2) }
  const piece = PIECES[scene], t = a.currentTime
  const dry = a.createGain(), wet = a.createGain(), tDry = a.createGain(), tWet = a.createGain()
  dry.connect(mix.master); wet.connect(room.hall); tDry.connect(dry); tWet.connect(wet)
  for (const g of [dry, wet]) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(piece.level, t + 2) }
  for (const g of [tDry, tWet]) g.gain.value = wantTense ? 1 : 0
  now = { scene, out: { a, dry, wet, noise: room.noise }, tense: { a, dry: tDry, wet: tWet, noise: room.noise }, tensed: wantTense, next: t + 0.1, i: 0, until: 0 }
  timer = window.setInterval(tick, 200)
  tick()
}

function end(fade: number) {
  if (!now) return
  const { a, dry, wet } = now.out, t = a.currentTime
  for (const g of [dry, wet]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade) }
  setTimeout(() => { dry.disconnect(); wet.disconnect() }, (fade + 4) * 1000) // the notes written ahead have rung out by then
  clearInterval(timer)
  now = null
}

function tick() {
  if (!now) return
  const { a } = now.out, piece = PIECES[now.scene], beat = 60 / piece.bpm
  if (a.state !== 'running') return
  if (now.next < a.currentTime) now.next = a.currentTime + 0.05 // the page slept: carry on from here
  while (now.next < a.currentTime + 0.5) {
    piece.bar(now.out, now.i, now.next, beat)
    if (piece.tension && (now.tensed || a.currentTime < now.until)) piece.tension(now.tense, now.i, now.next, beat)
    now.next += 4 * beat; now.i++
  }
}

function update() {
  try {
    const scene = off || !unlocked || document.hidden ? 'none' : want
    if ((now?.scene ?? 'none') !== scene) {
      end(document.hidden ? 0.2 : 1.5)
      if (scene !== 'none') begin(scene)
    }
    if (now && now.tensed !== wantTense) {
      // the drums come in over a couple of seconds, and leave slower while their last bars play out
      const { a, dry, wet } = now.tense
      for (const g of [dry, wet]) g.gain.setTargetAtTime(wantTense ? 1 : 0, a.currentTime, wantTense ? 0.5 : 1.5)
      if (!wantTense) now.until = a.currentTime + 6
      now.tensed = wantTense
    }
  } catch { /* no audio on this device */ }
}

/** The music for what's on screen: the title theme, a game's loop (`tense`: a king stands open), or none. */
export function music(scene: Scene, tense = false) {
  want = scene; wantTense = tense
  update()
}

// any tap or key lets the music start (and wakes the audio if the browser held it back)
if (typeof document !== 'undefined') {
  const wake = () => {
    if (unlocked && (!now || now.out.a.state === 'running')) return
    unlocked = true
    update()
    try { if (now) audio() } catch { /* no audio on this device */ }
  }
  for (const e of ['pointerdown', 'pointerup', 'keydown']) document.addEventListener(e, wake, true)
  document.addEventListener('visibilitychange', update)
}

/** Fills an audio context with a piece from time 0, bar by bar (for listening outside the game: scripts/music.ts). */
export function render(a: BaseAudioContext, scene: 'title' | 'game', tenseFrom = Infinity) {
  const piece = PIECES[scene], beat = 60 / piece.bpm, secs = a instanceof OfflineAudioContext ? a.length / a.sampleRate : 60
  const dry = a.createGain(), wet = a.createGain()
  dry.gain.value = wet.gain.value = piece.level
  dry.connect(a.destination); wet.connect(hallInto(a, a.destination))
  const out = { a, dry, wet, noise: whiteNoise(a, 2) }
  for (let i = 0; (i + 1) * 4 * beat <= secs; i++) {
    piece.bar(out, i, i * 4 * beat, beat)
    if (piece.tension && i >= tenseFrom) piece.tension(out, i, i * 4 * beat, beat)
  }
}

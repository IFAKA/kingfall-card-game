// Synthesized sounds: built on the fly with Web Audio, so there are no files to load and they work offline.
// The palette is a card table in a castle: paper and felt for cards, steel for fights, stone and rubble for towers,
// soft struck bars for the interface and horns for the big moments.
// Everything plays through one mix: a small stone-room reverb, then a limiter so stacked hits never distort.
// Each play shifts pitch and loudness a little so repeats don't sound canned, sits left or right where it happens on
// the board, and fights and tower hits end brighter when they go your way and darker when they don't.
// The audio context starts on the first sound after a tap (browsers block sound before any user gesture).
const MUTE_KEY = 'suitkeep-muted'
let ctx: AudioContext | null = null
let mix: Mix | null = null
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } })()

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* private mode: keep it for this visit */ }
}

interface Mix { master: AudioNode; room: AudioNode; noise: AudioBuffer }

export function audio() {
  if (!ctx) {
    const a = new AudioContext()
    const limit = a.createDynamicsCompressor()
    limit.threshold.value = -12; limit.knee.value = 6; limit.ratio.value = 12; limit.attack.value = 0.002; limit.release.value = 0.15
    limit.connect(a.destination)
    const master = a.createGain()
    master.gain.value = 0.9
    master.connect(limit)
    // only the mids and highs go to the room: low echoes would make everything muddy
    const roomIn = a.createBiquadFilter(), room = a.createConvolver()
    roomIn.type = 'highpass'; roomIn.frequency.value = 300
    room.buffer = roomEcho(a, 1.3)
    roomIn.connect(room).connect(master)
    ctx = a
    mix = { master, room: roomIn, noise: whiteNoise(a, 2) }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { a: ctx, mix: mix! }
}

// the reverb's echo: decaying stereo noise whose highs die first, like a small stone hall
export function roomEcho(a: BaseAudioContext, secs: number) {
  const len = Math.ceil(a.sampleRate * secs), buf = a.createBuffer(2, len, a.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let y = 0
    for (let i = 0; i < len; i++) {
      const p = i / len
      y += (Math.random() * 2 - 1 - y) * (0.7 - 0.6 * p)
      d[i] = y * Math.exp(-5 * p)
    }
  }
  return buf
}

// one shared noise buffer; each burst starts at a random point in it, so no two are the same
export function whiteNoise(a: BaseAudioContext, secs: number) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * secs), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// one playing sound: its context, output, start time and pitch shift for this play
interface S { a: BaseAudioContext; out: AudioNode; t: number; k: number; noise: AudioBuffer }

// gain rises from silence (no click) and dies away exponentially
function envelope(g: GainNode, t: number, gain: number, attack: number, dur: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gain, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
}

interface Tone { freq: number; to?: number; dur: number; type?: OscillatorType; gain?: number; at?: number; attack?: number }
function tone(s: S, { freq, to, dur, type = 'sine', gain = 0.2, at = 0, attack = 0.003 }: Tone) {
  const t = s.t + at
  const o = s.a.createOscillator(), g = s.a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq * s.k, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to * s.k, t + dur)
  envelope(g, t, gain, attack, dur)
  o.connect(g).connect(s.out)
  o.start(t); o.stop(t + dur + 0.05)
}

interface Noise { dur: number; freq: number; to?: number; filter?: BiquadFilterType; q?: number; gain?: number; at?: number; attack?: number }
function noise(s: S, { dur, freq, to, filter = 'bandpass', q = 1, gain = 0.25, at = 0, attack = 0.002 }: Noise) {
  const t = s.t + at
  const src = s.a.createBufferSource(), f = s.a.createBiquadFilter(), g = s.a.createGain()
  src.buffer = s.noise
  f.type = filter; f.Q.value = q
  f.frequency.setValueAtTime(freq * s.k, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to * s.k, t + dur)
  envelope(g, t, gain, attack, dur)
  src.connect(f).connect(g).connect(s.out)
  src.start(t, Math.random() * (s.noise.duration - dur - 0.1)); src.stop(t + dur + 0.05)
}

// a struck bar (marimba, glockenspiel): a few out-of-tune partials, the higher ones dying first
function bar(s: S, freq: number, { dur = 0.5, gain = 0.1, at = 0, bright = 1 } = {}) {
  tone(s, { freq, dur, gain, at, attack: 0.002 })
  tone(s, { freq: freq * 2.76, dur: dur * 0.35, gain: gain * 0.4 * bright, at, attack: 0.001 })
  tone(s, { freq: freq * 5.4, dur: dur * 0.15, gain: gain * 0.2 * bright, at, attack: 0.001 })
}

// steel on steel: clangy partials plus a near twin of the lowest one, which beats against it and shimmers
function steel(s: S, freq: number, { dur = 0.3, gain = 0.08, at = 0 } = {}) {
  ;[1, 1.006, 1.47, 2.09, 2.56, 3.39].forEach((r, i) => tone(s, { freq: freq * r, dur: dur / (1 + i * 0.35), gain: gain / (1 + i * 0.4), at, attack: 0.001 }))
}

// crumbling stone: many tiny ticks of noise scattered over `span` seconds, thinning out at the end
function rubble(s: S, n: number, span: number, { freq = 2500, gain = 0.2, at = 0 } = {}) {
  for (let i = 0; i < n; i++) {
    noise(s, { dur: 0.01 + Math.random() * 0.03, freq: freq * (0.6 + Math.random() * 0.8), q: 2, gain: gain * (0.4 + Math.random() * 0.6), at: at + Math.random() ** 1.6 * span })
  }
}

// a soft horn: two slightly detuned saws through a filter that opens as the note swells; `vib` adds a sad waver
function horn(s: S, freq: number, { dur = 0.3, gain = 0.06, at = 0, bright = 2400, vib = 0 } = {}) {
  const t = s.t + at, end = t + dur + 0.15
  const f = s.a.createBiquadFilter(), g = s.a.createGain()
  f.type = 'lowpass'; f.Q.value = 0.8
  f.frequency.setValueAtTime(300, t)
  f.frequency.linearRampToValueAtTime(bright, t + 0.05)
  f.frequency.exponentialRampToValueAtTime(bright * 0.5, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.03)
  g.gain.exponentialRampToValueAtTime(gain * 0.7, t + dur)
  g.gain.exponentialRampToValueAtTime(0.0001, end)
  f.connect(g).connect(s.out)
  for (const cents of [-7, 7]) {
    const o = s.a.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq * s.k
    o.detune.value = cents
    if (vib) {
      const lfo = s.a.createOscillator(), depth = s.a.createGain()
      lfo.frequency.value = 5.5
      depth.gain.setValueAtTime(0, t)
      depth.gain.linearRampToValueAtTime(freq * vib, t + dur * 0.6)
      lfo.connect(depth).connect(o.frequency)
      lfo.start(t); lfo.stop(end)
    }
    o.connect(f)
    o.start(t); o.stop(end)
  }
}

// a low drum-like knock, the weight under a card, a hit or a falling tower
const thud = (s: S, freq: number, dur: number, gain: number, at = 0) => tone(s, { freq, to: freq * 0.4, dur, gain, at })

export type Sfx = 'tap' | 'pick' | 'unpick' | 'hover' | 'deny' | 'place' | 'clash' | 'big' | 'crack' | 'break' | 'boom' | 'round' | 'win' | 'lose'
// whose way it went: 'good' for you, 'bad' for the enemy (an enemy card played, your tower hit)
export type Mood = 'good' | 'bad' | 'tie'

// `wet`: how much of the sound goes to the room; the big moments ring out, the interface stays close and dry
const SOUNDS: Record<Sfx, { wet: number; play: (s: S, mood: Mood) => void }> = {
  // any button: a soft wooden blip
  tap: { wet: 0.04, play: s => { bar(s, 740, { dur: 0.08, gain: 0.14, bright: 0.6 }); noise(s, { dur: 0.012, freq: 4000, gain: 0.08 }) } },
  // a card lifted from your hand: paper sliding up
  pick: { wet: 0.05, play: s => { noise(s, { dur: 0.07, freq: 1800, to: 4200, q: 1.2, gain: 0.22, attack: 0.02 }); bar(s, 1568, { dur: 0.15, gain: 0.045, at: 0.03 }) } },
  // a card put back: paper sliding down
  unpick: { wet: 0.05, play: s => { noise(s, { dur: 0.08, freq: 3800, to: 1500, q: 1.2, gain: 0.18, attack: 0.02 }); thud(s, 300, 0.05, 0.08, 0.04) } },
  // a dragged card over a lane it can go to
  hover: { wet: 0.1, play: s => bar(s, 1175, { dur: 0.12, gain: 0.07 }) },
  // not allowed (too expensive, deck full): two dull knocks
  deny: { wet: 0.05, play: s => { tone(s, { freq: 196, dur: 0.08, type: 'triangle', gain: 0.12 }); tone(s, { freq: 165, dur: 0.13, type: 'triangle', gain: 0.12, at: 0.09 }) } },
  // a card slapped down on the felt; the enemy's is a little lower and softer
  place: {
    wet: 0.08, play: (s, m) => {
      const v = m === 'bad' ? 0.8 : 1
      noise(s, { dur: 0.06, freq: 2800 * v, to: 1200 * v, q: 0.8, gain: 0.5 * v })
      thud(s, 140 * v, 0.1, 0.55 * v)
    },
  },
  // two soldiers meet: a steel ring, then a bright ting-ting if you won it or a deflating note if you lost it
  clash: {
    wet: 0.18, play: (s, m) => {
      noise(s, { dur: 0.04, freq: 3500, q: 1.5, gain: 0.3 })
      steel(s, 820, { gain: 0.1 })
      thud(s, 180, 0.08, 0.2)
      if (m === 'good') { bar(s, 1319, { at: 0.06, dur: 0.35, gain: 0.07 }); bar(s, 1760, { at: 0.11, dur: 0.4, gain: 0.07 }) }
      if (m === 'bad') tone(s, { freq: 220, to: 150, dur: 0.18, type: 'triangle', gain: 0.12, at: 0.05 })
    },
  },
  // a rule decided it (×2 or ACE): a whoosh into a heavy clash, then a run of notes, up for you, down against you
  big: {
    wet: 0.22, play: (s, m) => {
      noise(s, { dur: 0.08, freq: 600, to: 4000, gain: 0.2, attack: 0.06 })
      noise(s, { dur: 0.08, freq: 2800, gain: 0.3, at: 0.07 })
      steel(s, 620, { dur: 0.45, gain: 0.1, at: 0.07 })
      thud(s, 120, 0.15, 0.2, 0.07)
      if (m === 'good') [1047, 1319, 1568, 2093].forEach((f, i) => bar(s, f, { at: 0.12 + i * 0.05, dur: 0.45, gain: 0.07 }))
      if (m === 'bad') [784, 622, 523].forEach((f, i) => bar(s, f, { at: 0.12 + i * 0.07, dur: 0.45, gain: 0.07, bright: 0.5 }))
    },
  },
  // a tower card cracks: a stony snap; a ting when it's theirs, a heavier knock when it's yours
  crack: {
    wet: 0.2, play: (s, m) => {
      rubble(s, 7, 0.07, { freq: 3200, gain: 0.3 })
      noise(s, { dur: 0.05, freq: 2500, filter: 'highpass', gain: 0.25 })
      thud(s, 160, 0.08, 0.3)
      if (m === 'good') bar(s, 1568, { at: 0.05, dur: 0.25, gain: 0.05 })
      if (m === 'bad') thud(s, 110, 0.15, 0.2, 0.03)
    },
  },
  // a tower card breaks: a crunch with stones falling; chimes when it's theirs, a low dull horn when it's yours
  break: {
    wet: 0.28, play: (s, m) => {
      noise(s, { dur: 0.4, freq: 3000, to: 400, filter: 'lowpass', gain: 0.4 })
      rubble(s, 14, 0.3, { freq: 1800, gain: 0.2 })
      thud(s, 150, 0.3, 0.45)
      if (m === 'good') { bar(s, 1047, { at: 0.08, dur: 0.4, gain: 0.06 }); bar(s, 1568, { at: 0.13, dur: 0.45, gain: 0.06 }) }
      if (m === 'bad') horn(s, 147, { at: 0.08, dur: 0.35, gain: 0.05, bright: 900 })
    },
  },
  // a whole tower falls: a deep boom and a long rumble of rubble, then horns that rise for you or sink against you
  boom: {
    wet: 0.35, play: (s, m) => {
      noise(s, { dur: 0.06, freq: 2000, filter: 'highpass', gain: 0.35 })
      thud(s, 90, 0.9, 0.6)
      noise(s, { dur: 1.1, freq: 1200, to: 150, filter: 'lowpass', gain: 0.5, attack: 0.005 })
      rubble(s, 24, 0.8, { freq: 1200, gain: 0.18, at: 0.05 })
      if (m === 'good') { horn(s, 262, { at: 0.15, dur: 0.18 }); horn(s, 392, { at: 0.3, dur: 0.45 }); horn(s, 523, { at: 0.3, dur: 0.45, gain: 0.04 }) }
      if (m === 'bad') { horn(s, 196, { at: 0.15, dur: 0.2, bright: 1000 }); horn(s, 156, { at: 0.33, dur: 0.5, bright: 1000 }) }
    },
  },
  // a new round: two bell notes, then the elixir filling up with a couple of liquid bloops
  round: {
    wet: 0.3, play: s => {
      bar(s, 659, { dur: 0.6, gain: 0.09 }); bar(s, 880, { at: 0.09, dur: 0.6, gain: 0.09 })
      tone(s, { freq: 300, to: 700, dur: 0.08, gain: 0.06, at: 0.22 }); tone(s, { freq: 380, to: 860, dur: 0.08, gain: 0.05, at: 0.3 })
    },
  },
  // you won: a horn fanfare (ta-ta-ta-taaa) on a drum hit and a cymbal, with sparkles on top
  win: {
    wet: 0.3, play: s => {
      ;[0, 0.12, 0.24].forEach(at => horn(s, 392, { at, dur: 0.09 }))
      ;[523, 659, 784].forEach((f, i) => horn(s, f, { at: 0.38, dur: 0.8, gain: i ? 0.04 : 0.06 }))
      thud(s, 110, 0.25, 0.3, 0.38)
      noise(s, { dur: 0.9, freq: 6000, filter: 'highpass', gain: 0.07, at: 0.38 })
      ;[2093, 2637, 3136, 4186].forEach((f, i) => bar(s, f, { at: 0.45 + i * 0.07, dur: 0.5, gain: 0.035 }))
    },
  },
  // you lost: three soft, dark horn notes falling into a minor chord that wavers; gentle, so one more game feels fine
  lose: {
    wet: 0.35, play: s => {
      horn(s, 330, { dur: 0.28, bright: 1100 })
      horn(s, 262, { at: 0.3, dur: 0.28, bright: 1100 })
      horn(s, 220, { at: 0.6, dur: 1, bright: 1000, vib: 0.012 })
      bar(s, 110, { at: 0.6, dur: 1.2, gain: 0.12, bright: 0.3 })
    },
  },
}

/** Plays a sound after `delayMs`. `pan`: -1 (left) to 1 (right), where on the board it happens; `pitch`: a shift on top of the random one. */
export function sfx(name: Sfx, delayMs = 0, { mood = 'tie', pan = 0, pitch = 1 }: { mood?: Mood; pan?: number; pitch?: number } = {}) {
  if (muted) return
  const go = () => {
    try {
      const { a, mix } = audio(), { wet, play } = SOUNDS[name]
      const bus = a.createGain(), side = a.createStereoPanner(), send = a.createGain()
      bus.gain.value = 0.85 + Math.random() * 0.15
      side.pan.value = Math.max(-1, Math.min(1, pan))
      send.gain.value = wet
      bus.connect(side).connect(mix.master)
      side.connect(send).connect(mix.room)
      play({ a, out: bus, t: a.currentTime + 0.005, k: (0.96 + Math.random() * 0.08) * pitch, noise: mix.noise }, mood)
    } catch { /* no audio on this device */ }
  }
  if (delayMs) setTimeout(go, delayMs)
  else go()
}

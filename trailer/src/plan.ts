// The trailer's timing, shared by the music (music/make-music.ts) and the edit (src/Trailer.tsx), so every cut lands on the beat.
// 120 BPM: a beat is half a second, a bar (4 beats) two seconds.
export const BPM = 120
export const FPS = 30
export const BEAT = 60 / BPM

// sections, in beats from the start
export const S = {
  hook: 0, // the ace strikes the king: the twist first, before any title
  title: 5, // impact: KINGFALL slams in
  loop: 9, // groove starts: how a round plays
  suits: 21, // the suit wheel doubles a card
  towers: 29, // towers crack, break, fall
  build: 41, // faster cuts, a riser
  drop: 49, // the king falls
  end: 57, // end card
  out: 67, // silence
} as const

export const seconds = (beats: number) => beats * BEAT
export const frames = (beats: number) => Math.round(beats * BEAT * FPS)
export const TOTAL_FRAMES = frames(S.out)

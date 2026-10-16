// The moments of the recorded game each section shows, in seconds of out/gameplay.mp4 (see `node capture/moments.mjs`).
// A hit's contact comes about 0.38 s before its step is logged; framings are points of the game in CSS pixels (432 x 768):
// lanes at x 80 (left) and 350 (right), the river at y 286, enemy towers near y 80, yours near y 460.
import type { Framing } from './GameClip'

type Clip = { at: number; beats: number; speed?: number; from?: Framing; to?: Framing; flash?: number; volume?: number }
const F = (scale: number, x: number, y: number): Framing => ({ scale, x, y })

const ACE = 114.05 // A♣ meets K♦ in the left lane (round 7)
const X2A = 60.65, X2B = 161.37 // 6♣ doubles against 8♠ (round 4); J♣ doubles against 8♠ (round 10)
const KING = 170.3 // 6♣ breaks the cracked 10♦: the enemy king falls

export const CUTS: { titleBack: number; hook: Clip[]; hookContact: number; loop: Clip[]; loopSplit: number; suits: Clip[]; towers: Clip[]; build: Clip[]; drop: Clip[] } = {
  titleBack: 128.5, // under the title: a busy board (round 8), blurred
  // the ace steps up to the king and strikes on beat 3; the contact plays again at half speed
  hook: [
    { at: ACE - 1.5, beats: 3, from: F(1.35, 120, 300), to: F(1.6, 90, 280) },
    { at: ACE, beats: 2, speed: 0.5, from: F(1.7, 90, 270), to: F(2, 90, 260), flash: 0.6, volume: 0.6 },
  ],
  hookContact: 3,
  // round 1: you drag the J♣ into the left lane, the enemy answers, the two meet and the higher card wins
  loop: [
    { at: 2.0, beats: 5, from: F(1, 216, 384), to: F(1.12, 216, 420) },
    { at: 6.4, beats: 7, from: F(1.12, 216, 330), to: F(1.55, 100, 280) },
  ],
  loopSplit: 5,
  suits: [
    { at: X2A - 1.5, beats: 4, from: F(1.3, 120, 300), to: F(1.7, 90, 275), volume: 1 },
    { at: X2B - 1.5, beats: 4, from: F(1.3, 120, 300), to: F(1.7, 90, 275), volume: 1 },
  ],
  // your cards at the enemy towers: a break (round 2), the left tower down (round 3), the right tower shoots back and cracks (round 3)
  towers: [
    { at: 25.3, beats: 4, from: F(1.2, 150, 250), to: F(1.7, 90, 120) },
    { at: 40.3, beats: 4, from: F(1.15, 170, 250), to: F(1.4, 170, 140), flash: 0.25 },
    { at: 46.6, beats: 4, from: F(1.2, 290, 250), to: F(1.7, 350, 120) },
  ],
  // one second each, one word each: a card dragged in, a fight, your tower falls to the enemy, your last stand
  build: [
    { at: 53.0, beats: 2, from: F(1, 216, 500), to: F(1.15, 216, 520) },
    { at: 92.3, beats: 2, from: F(1.4, 330, 290), to: F(1.7, 340, 285) },
    { at: 96.7, beats: 2, from: F(1.05, 216, 420), to: F(1.15, 216, 440) },
    { at: 101.75, beats: 2, from: F(1.3, 120, 330), to: F(1.5, 100, 320) },
  ],
  // the king falls on the drop's first beat, close; then again, slowly, the whole board (cut before the result panel comes up)
  drop: [
    { at: KING - 0.12, beats: 3, from: F(1.3, 216, 220), to: F(1.7, 216, 130), flash: 0.7, volume: 1 },
    { at: KING - 0.05, beats: 5, speed: 0.4, from: F(1, 216, 384), to: F(1.12, 216, 300), flash: 0.35, volume: 0.5 },
  ],
}

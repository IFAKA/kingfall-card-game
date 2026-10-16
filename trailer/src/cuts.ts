// The clips each section shows: moments found in the recording (src/moments.ts) plus how long before them a clip starts and how the
// camera frames them. Framings are points of the game in CSS pixels (432 x 768): the river at y 286, enemy towers near y 80, yours near y 460.
import type { Framing } from './GameClip'
import { LANE_X, M, TOWER_X } from './moments'

type Clip = { at: number; beats: number; speed?: number; from?: Framing; to?: Framing; flash?: number; volume?: number }
const F = (scale: number, x: number, y: number): Framing => ({ scale, x, y })
const lane = (m: { ev: { lane?: number } }) => LANE_X(m.ev.lane)
const tower = (m: { ev: { stack?: string } }) => TOWER_X(m.ev.stack)
const towerWide = (m: { ev: { stack?: string } }) => (TOWER_X(m.ev.stack) + 216) / 2 // keeps the wide TOWER DOWN! pop-up in the shot

export const CUTS: { titleBack: number; hook: Clip[]; hookContact: number; loop: Clip[]; loopSplit: number; suits: Clip[]; towers: Clip[]; build: Clip[]; drop: Clip[] } = {
  titleBack: M.busyBoard, // under the title: a busy board, blurred
  // the ace steps up to the king and strikes on beat 3; the contact plays again at half speed
  hook: [
    { at: M.ace.contact - 1.5, beats: 3, from: F(1.35, lane(M.ace) + 30, 300), to: F(1.6, lane(M.ace), 280) },
    { at: M.ace.contact, beats: 2, speed: 0.5, from: F(1.7, lane(M.ace), 270), to: F(2, lane(M.ace), 260), flash: 0.6, volume: 0.6 },
  ],
  hookContact: 3,
  // round 1: you drag a card into a lane, the enemy answers, the two meet and the higher card wins
  loop: [
    { at: M.firstPress - 0.02, beats: 5, from: F(1, 216, 384), to: F(1.12, 216, 420) },
    { at: M.firstFight.contact - 1.24, beats: 7, from: F(1.12, 216, 330), to: F(1.55, lane(M.firstFight) + 10, 280) },
  ],
  loopSplit: 5,
  suits: [M.x2a, M.x2b].map(m => ({ at: m.contact - 1.5, beats: 4, from: F(1.3, lane(m) + 30, 300), to: F(1.7, lane(m), 275), volume: 1 })),
  // your cards at the enemy towers: a break, a side tower down, a tower that shoots back and cracks
  towers: [
    { at: M.towerBreak.contact - 1.2, beats: 4, from: F(1.2, (tower(M.towerBreak) + 216) / 2, 250), to: F(1.7, tower(M.towerBreak), 120) },
    { at: M.towerDown.contact - 1.14, beats: 4, from: F(1.15, towerWide(M.towerDown), 250), to: F(1.4, towerWide(M.towerDown), 140), flash: 0.25 },
    { at: M.towerCrack.contact - 1.1, beats: 4, from: F(1.2, (tower(M.towerCrack) + 216) / 2, 250), to: F(1.7, tower(M.towerCrack), 120) },
  ],
  // one second each, one word each: a card dragged in, a fight, your own tower falls, your last stand
  build: [
    { at: M.planPress + 0.32, beats: 2, from: F(1, 216, 500), to: F(1.15, 216, 520) },
    { at: M.strike.contact - 0.44, beats: 2, from: F(1.4, lane(M.strike) - 10, 290), to: F(1.7, lane(M.strike), 285) },
    { at: M.yourTowerDown.contact - 0.47, beats: 2, from: F(1.05, 216, 420), to: F(1.15, 216, 440) },
    { at: M.lastStand.step - 1.03, beats: 2, from: F(1.3, lane(M.lastStand) + 30, 330), to: F(1.5, lane(M.lastStand) + 10, 320) },
  ],
  // the king falls on the drop's first beat, close; then again, slowly, the whole board (cut before the result panel comes up)
  drop: [
    { at: M.king.contact - 0.12, beats: 3, from: F(1.3, 216, 220), to: F(1.7, 216, 130), flash: 0.7, volume: 1 },
    { at: M.king.contact - 0.05, beats: 5, speed: 0.4, from: F(1, 216, 384), to: F(1.12, 216, 300), flash: 0.35, volume: 0.5 },
  ],
}

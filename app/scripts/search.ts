// Search for hand-playable rule changes that make a player at your brother's level win about half the time.
// Stage 1: every combination, best play only (cheap). Stage 2: the shortlist across the whole skill ladder.
// Run: node scripts/search.ts   (about 10 minutes)
import { pct, run, slip, naive, random, suggestions, winRate, spread } from './sim.ts'
import type { Player, Setup } from './sim.ts'

const TUNE = 7
interface Combo { aceMin: number; cap: number; regen: number; start: number; enemyMin: number }
const label = (c: Combo) => [c.aceMin === 0 ? 'no ace rule' : c.aceMin === 11 ? 'first rules' : c.aceMin === 12 ? 'aces>Q,K' : 'aces>K', c.cap < 10 ? `cap ${c.cap}` : '', c.regen < 3 ? `regen ${c.regen}` : '', c.start < 5 ? `start ${c.start}` : '', c.enemyMin > 1 ? `enemy ${c.enemyMin}+` : ''].filter(Boolean).join(', ') || 'shipped'
const changes = (c: Combo) => (c.aceMin !== 11 ? 1 : 0) + (c.cap < 10 ? 1 : 0) + (c.regen < 3 ? 1 : 0) + (c.start < 5 ? 1 : 0) + (c.enemyMin > 1 ? 1 : 0)
const setup = (c: Combo, player?: Player): Setup => ({ player, enemyMin: c.enemyMin, rules: { acesBeatPictures: c.aceMin !== 0, aceMin: c.aceMin || 11, cap: c.cap, regen: c.regen, startElixir: c.start } })

const all: Combo[] = []
for (const aceMin of [11, 12, 13, 0]) for (const cap of [10, 9, 8]) for (const regen of [3, 2]) for (const start of [5, 3]) for (const enemyMin of [1, 2, 3, 4, 5]) all.push({ aceMin, cap, regen, start, enemyMin })

console.log(`stage 1: ${all.length} combinations, best play, 600 games each`)
const short = all.filter(c => { const w = winRate(run(600, setup(c), TUNE)); return w >= 0.47 && w <= 0.68 })
console.log(`${short.length} land between 47% and 68%\n`)

// the skill levels your brother could be at, weighted by how likely two easy first-time wins are at each (from backtest.ts)
const brother: [string, Player, number][] = [['best play', suggestions, 0.495], ['slips 15%', slip(0.15), 0.28], ['slips 30%', slip(0.3), 0.156], ['slips 50%', slip(0.5), 0.055]]
const rest: [string, Player][] = [['naive', naive], ['random', random]]
console.log('stage 2 (1000 games per cell). b = brother-like expected win; the rest are win% for slips 50% | naive | random')
console.log('rule changes'.padEnd(44), 'b'.padStart(6), 'best'.padStart(6), 's30'.padStart(6), 's50'.padStart(6), 'naive'.padStart(6), 'rand'.padStart(6), 'aceSp'.padStart(6), 'easy%'.padStart(6), 'rnds'.padStart(5), ' ok')
const rows = short.sort((a, b) => changes(a) - changes(b)).map(c => {
  const r = brother.map(([, p]) => run(1000, setup(c, p), TUNE))
  const b = brother.reduce((s, x, i) => s + x[2] * winRate(r[i]), 0)
  const [nv, rd] = rest.map(([, p]) => run(1000, setup(c, p), TUNE))
  const easy = brother.reduce((s, x, i) => s + x[2] * (r[i].easy / r[i].n), 0)
  const ok = b >= 0.47 && b <= 0.6 && spread(r[0]) <= 15 && winRate(r[3]) >= 0.28 && winRate(nv) >= 0.12 && winRate(rd) <= 0.16 && winRate(r[0]) - winRate(r[3]) >= 0.15
  console.log(label(c).padEnd(44), pct(b).padStart(6), pct(winRate(r[0])).padStart(6), pct(winRate(r[2])).padStart(6), pct(winRate(r[3])).padStart(6), pct(winRate(nv)).padStart(6), pct(winRate(rd)).padStart(6), spread(r[0]).toFixed(0).padStart(6), pct(easy).padStart(6), (r[0].rounds / r[0].n).toFixed(1).padStart(5), ok ? '  ✓' : '')
  return { c, ok }
})
console.log('\npassing all targets:', rows.filter(r => r.ok).map(r => label(r.c)).join(' | ') || 'none')

// Hold-out validation of the shortlisted rule changes: different deals than the search used, 3x the games, nothing re-tuned.
// Then the deck split that is best under the finalist. Run: node scripts/validate.ts
import { ci, pct, run, slip, naive, random, suggestions, winRate, spread } from './sim.ts'
import type { Player, Setup } from './sim.ts'

const HOLD = 1001, N = 3000
const cands: [string, Setup][] = [
  ['first rules', { rules: { aceMin: 11 } }],
  ['aces beat K only + elixir cap 9', { rules: { aceMin: 13, cap: 9 } }],
  ['aces beat K only + enemy 3+', { rules: { aceMin: 13 }, enemyMin: 3 }],
  ['no ace rule', { rules: { acesBeatPictures: false } }],
  ['no ace rule + elixir cap 9', { rules: { acesBeatPictures: false, cap: 9 } }],
]
const skills: [string, Player, number][] = [['best play', suggestions, 0.495], ['slips 15%', slip(0.15), 0.28], ['slips 30%', slip(0.3), 0.156], ['slips 50%', slip(0.5), 0.055], ['naive', naive, 0], ['random', random, 0]]
console.log(`HOLD-OUT: deals seed ${HOLD}, ${N} games per cell\n`)
console.log('rule changes'.padEnd(34), ...skills.map(([n]) => n.padStart(15)), 'brother-like'.padStart(14), 'ace spread'.padStart(11), 'easy%'.padStart(7))
for (const [name, s] of cands) {
  const r = skills.map(([, p]) => run(N, { ...s, player: p }, HOLD))
  const b = skills.reduce((t, x, i) => t + x[2] * winRate(r[i]), 0)
  const easy = skills.reduce((t, x, i) => t + x[2] * (r[i].easy / r[i].n), 0)
  console.log(name.padEnd(34), ...r.map(x => `${pct(winRate(x))} ${ci(x.wins, x.n)}`.padStart(15)), pct(b).padStart(14), `${spread(r[0]).toFixed(0)} pts`.padStart(11), pct(easy).padStart(7))
}
console.log('\nBEST DECK SPLIT under aces beat K only + cap 9 (N highest cards + the rest lowest), deals seed 7')
for (const [who, p] of [['best play', suggestions], ['slips 30%', slip(0.3)]] as [string, Player][])
  console.log(who.padEnd(10), [0, 1, 2, 3, 4, 5, 6].map(h => `${h}:${pct(winRate(run(1500, { rules: { aceMin: 13, cap: 9 }, player: p, deck: `top${h}` }, 7)))}`).join('  '))

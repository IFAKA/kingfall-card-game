// Balance backtest, first pass: how the rules and a few rule changes move the win rate for a player who follows the app's suggestions.
// Run: node scripts/balance.ts [games per setup, default 1000]
import { ci, pct, run, slip, winRate, spread } from './sim.ts'
import type { Setup } from './sim.ts'

const N = Number(globalThis.process?.argv[2] ?? 1000)
const rows: [string, Setup][] = [
  ['first rules (aces beat J, Q, K)', { rules: { aceMin: 11 } }],
  ['current rules (aces beat K only)', {}],
  ['aces beat Q and K', { rules: { aceMin: 12 } }],
    ['aces beat nothing', { rules: { acesBeatPictures: false } }],
  ['no suit doubling', { rules: { wheel: 1 } }],
  ['elixir cap 8', { rules: { cap: 8 } }],
  ['you start with 2 elixir less', { rules: { startElixir: 3 } }],
  ['enemy lays its towers best', { enemy: 'best-towers' }],
]
console.log(`${N} games each. columns: best play | slips 30% | ace spread (2+ aces vs none, best play)`)
for (const [name, s] of rows) {
  const a = run(N, s, 7), b = run(N, { ...s, player: slip(0.3) }, 7)
  console.log(`  ${name.padEnd(30)} ${pct(winRate(a))} ${ci(a.wins, a.n)} | ${pct(winRate(b))} | ${spread(a).toFixed(0).padStart(3)} pts`)
}

// Backtest for the ace rule, with your brother (a first-timer who won easily) as the beginner baseline.
// 1. where does his result put him on the skill ladder? 2. what do the candidate rules do to a player of that level?
// 3. what else do they change? 4. does the choice hold on deals it was not chosen on?
// Run: node scripts/backtest.ts [games per cell, default 1500]
import { ci, pct, run, slip, naive, random, suggestions, winRate, spread } from './sim.ts'
import type { Player, Result, DeckPolicy } from './sim.ts'

const N = Number(globalThis.process?.argv[2] ?? 1500)
const TUNE = 7, HOLD = 1001 // the deals the rule is chosen on, and different deals it is then checked on
const rules = { 'first rules': { aceMin: 11 }, 'aces beat Q,K': { aceMin: 12 }, 'aces beat K only': { aceMin: 13 } } as const // the last is what the game now plays
const ladder: [string, Player][] = [['best play', suggestions], ['slips 15%', slip(0.15)], ['slips 30%', slip(0.3)], ['slips 50%', slip(0.5)], ['slips 75%', slip(0.75)], ['naive spender', naive], ['random', random]]
const line = (...c: string[]) => console.log(c.map((x, i) => (i ? x.padStart(14) : x.padEnd(26))).join(''))

// 1. the beginner baseline: how likely are two easy wins at each skill level, under the rules he played?
console.log('1. WHERE DOES THE BROTHER SIT? (first rules; "easy" = won in 12 rounds or fewer, at most 1 of your 6 tower cards lost)')
line('skill', 'win%', 'easy win%', 'P(2 easy wins)', 'posterior')
const base = ladder.map(([name, p]) => [name, run(N, { rules: { aceMin: 11 }, player: p }, TUNE)] as [string, Result])
const like = base.map(([, r]) => (r.easy / r.n) ** 2), total = like.reduce((a, b) => a + b, 0)
base.forEach(([name, r], i) => line(name, pct(winRate(r)), pct(r.easy / r.n), pct(like[i]), pct(like[i] / total)))
const post = like.map(l => l / total) // flat prior over the skill levels above

// 2. the candidate rules against that baseline
console.log('\n2. WIN% BY SKILL AND RULE (deals seed ' + TUNE + ')')
line('skill', ...Object.keys(rules))
const grid: Record<string, Result[]> = {}
for (const [name, p] of ladder) { grid[name] = Object.values(rules).map(r => run(N, { rules: r, player: p }, TUNE)); line(name, ...grid[name].map(r => pct(winRate(r)))) }
const expected = Object.keys(rules).map((_, j) => ladder.reduce((s, [name], i) => s + post[i] * winRate(grid[name][j]), 0))
line('brother-like (posterior)', ...expected.map(pct))
line('ace spread (best play)', ...grid['best play'].map(r => spread(r).toFixed(0) + ' pts'))

// 3. what else the ace rule moves, at a beginner's level (slips 30%) and at best play
console.log('\n3. SECOND-ORDER EFFECTS')
for (const [label, p] of [['beginner (slips 30%)', slip(0.3)], ['best play', suggestions]] as [string, Player][]) {
  console.log(`  ${label}`)
  line('    deck you build', ...Object.keys(rules))
  for (const d of ['suggested', 'random', 'mixed', 'all-high', 'all-low'] as DeckPolicy[]) line('    ' + d, ...Object.values(rules).map(r => pct(winRate(run(N, { rules: r, player: p, deck: d }, TUNE)))))
  const rs = Object.values(rules).map(r => run(N, { rules: r, player: p }, TUNE))
  line('    rounds per game', ...rs.map(r => (r.rounds / r.n).toFixed(1)))
  line('    easy wins', ...rs.map(r => pct(r.easy / r.n)))
  line('    ace kills you:enemy', ...rs.map(r => `${(r.aceKillsP / r.n).toFixed(2)}:${(r.aceKillsE / r.n).toFixed(2)}`))
  line('    unfinished games', ...rs.map(r => String(r.unfinished)))
}

// 4. hold-out: different deals, more games, nothing re-tuned
console.log('\n4. HOLD-OUT (deals seed ' + HOLD + ', ' + 2 * N + ' games per cell)')
line('skill', ...Object.keys(rules))
for (const [name, p] of ladder.filter(([n]) => ['best play', 'slips 30%', 'slips 50%', 'naive spender'].includes(n))) {
  line(name, ...Object.values(rules).map(r => { const x = run(2 * N, { rules: r, player: p }, HOLD); return `${pct(winRate(x))} ${ci(x.wins, x.n)}` }))
}

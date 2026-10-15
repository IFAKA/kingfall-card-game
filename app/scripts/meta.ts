// Is there a meta? Your deck type against each kind of enemy deck. Rows: your deck; columns: the enemy's. Best play, current rules.
// A rock-paper-scissors meta would show one deck type beating another and losing to a third. Run: node scripts/meta.ts [games, default 1500]
import { pct, run, slip, suggestions } from './sim.ts'
import type { DeckPolicy, EnemySetup } from './sim.ts'
const N = Number(globalThis.process?.argv[2] ?? 1500)
const mine: [string, DeckPolicy][] = [['cheap (8 lowest)', 'all-low'], ['balanced (4+4)', 'mixed'], ['heavy (8 highest)', 'all-high']]
const theirs: [string, EnemySetup][] = [['cheap', 'swarm'], ['balanced', 'balanced'], ['heavy', 'heavy'], ['random', 'random']]
for (const [who, p] of [['best play', suggestions], ['slips 30%', slip(0.3)]] as const) {
  console.log(`\n${who}, ${N} games per cell. rows: your deck. columns: the enemy's deck`)
  console.log(''.padEnd(20), ...theirs.map(([n]) => n.padStart(10)))
  for (const [name, deck] of mine) console.log(name.padEnd(20), ...theirs.map(([, e]) => pct(run(N, { player: p, deck, enemy: e }, 7).wins / N).padStart(10)))
}

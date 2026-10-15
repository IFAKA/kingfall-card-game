// Which deck split is best under a rule: the N highest cards plus the lowest (8 - N). Run: node scripts/decks.ts [games, default 1500]
import { pct, run, slip, suggestions, winRate } from './sim.ts'
const N = Number(globalThis.process?.argv[2] ?? 1500)
console.log('highest cards in the deck of 8 (the rest are the lowest) | win%')
for (const [name, rules] of [['first rules', { aceMin: 11 }], ['aces beat K only', { aceMin: 13 }]] as const) {
  for (const [who, p] of [['best play', suggestions], ['slips 30%', slip(0.3)]] as const) {
    console.log(`${name.padEnd(18)} ${who.padEnd(10)}`, [0, 1, 2, 3, 4, 5, 6].map(h => `${h}:${pct(winRate(run(N, { rules, player: p, deck: `top${h}` }, 7)))}`).join('  '))
  }
}

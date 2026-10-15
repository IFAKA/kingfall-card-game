// Is there skill left above the app's own suggestions? A stronger player tries every legal move at each decision, plays the game out K times
// (the enemy's hidden cards sampled from the ones it has not seen; it never peeks) and plays the move that wins most.
// If it beats the suggestions by a lot, skill pays beyond what a first-timer reaches; if not, the game is already "solved" by that heuristic.
// Run: node scripts/headroom.ts [games, default 200] [rollouts per move, default 6] [aceMin, default 13: the current rules; 11 = the first rules]
import { freshDeck, shuffle } from '../src/engine.ts'
import type { Card } from '../src/engine.ts'
import { canPlay, endMyTurn, playCard } from '../src/guide.ts'
import type { Advice, GuideState } from '../src/guide.ts'
import { ci, pct, playOut, run, suggestions } from './sim.ts'
import type { Player } from './sim.ts'

const arg = (i: number, d: number) => Number(globalThis.process?.argv[i] ?? d)
const N = arg(2, 200), K = arg(3, 6), ACE = arg(4, 13)

// every enemy tid whose card we have not seen, given a card each from the cards still unseen
function sample(g: GuideState, rnd: () => number): Map<string, Card> {
  const known = new Set<string>()
  const mark = (tid: string, c: Card | null) => { if (c) known.add(tid) }
  g.E.queue.forEach(s => mark(s.tid, s.card)); for (const k of ['L', 'R', 'K'] as const) g.E.towers[k].forEach(s => mark(s.tid, s.card))
  g.units.forEach(u => { if (u.side === 'E' && u.tid) known.add(u.tid) }); g.discard.forEach(d => { if (d.owner === 'E') known.add(d.tid) })
  const seen = new Set([...g.dealt, ...g.enemySeen].map(c => c.id))
  const pool = shuffle(freshDeck().filter(c => !seen.has(c.id)), rnd)
  const real = new Map<string, Card>()
  let i = 0
  for (let p = 0; p < 8; p++) if (!known.has(`ep${p}`)) real.set(`ep${p}`, pool[i++])
  for (let t = 0; t < 6; t++) if (!known.has(`et${t}`)) real.set(`et${t}`, pool[i++])
  return real
}

const lookahead: Player = (g, rnd) => {
  const base = suggestions(g, rnd)
  const cands: Advice[] = [{ kind: 'wait', reason: '', short: '' }]
  g.P.hand.forEach((_, i) => { if (canPlay(g, i)) for (const l of [0, 1] as const) cands.push({ kind: 'play', handIndex: i, lane: l, reason: '', short: '' }) })
  if (cands.length === 2) return cands[0] // nothing affordable but one lane choice is moot
  const worlds = Array.from({ length: K }, () => sample(g, rnd))
  let best = cands[0], bestScore = -1
  for (const c of cands) {
    let w = 0
    for (const real of worlds) {
      const after = c.kind === 'play' ? playCard(g, c.handIndex, c.lane) : endMyTurn(g)
      if (playOut(after, real, suggestions, rnd).winner === 'P') w++
    }
    // a small bonus for the suggestion keeps ties from changing the plan for nothing
    const score = w + (c.kind === base.kind && (c.kind === 'wait' || (base.kind === 'play' && c.handIndex === base.handIndex && c.lane === base.lane)) ? 0.5 : 0)
    if (score > bestScore) { best = c; bestScore = score }
  }
  return best
}

const rules = { aceMin: ACE }
const a = run(N, { rules, player: suggestions }, 7)
const t0 = Date.now()
const b = run(N, { rules, player: lookahead }, 7)
console.log(`aceMin ${ACE}, ${N} games on the same deals, ${K} rollouts per move (${((Date.now() - t0) / 1000 / N).toFixed(1)}s a game)`)
console.log(`the app's suggestions : ${pct(a.wins / a.n)} ${ci(a.wins, a.n)}   easy wins ${pct(a.easy / a.n)}`)
console.log(`lookahead player      : ${pct(b.wins / b.n)} ${ci(b.wins, b.n)}   easy wins ${pct(b.easy / b.n)}`)

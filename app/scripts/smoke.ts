import { deal, newGame, autoTowers, suggestDeck, playCard, endRound, canPlay, DEFAULT_RULES, shuffle, cost } from '../src/engine.ts'
function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function play(seed: number, smart: boolean) {
  const rnd = mulberry(seed)
  const { mine, theirs } = deal(rnd)
  let deck, towers
  if (smart) { deck = suggestDeck(mine); towers = autoTowers(mine.filter(c => !deck.includes(c))) }
  else { const s = shuffle(mine, rnd); deck = s.slice(0, 8); towers = s.slice(8) }
  let g = newGame(deck, towers, theirs, DEFAULT_RULES, rnd)
  let n = 0
  while (!g.winner && n++ < 300) {
    if (smart) {
      for (let k = 0; k < 4; k++) {
        let played = false
        for (const lane of [0, 1] as const) {
          const front = g.units.filter(u => u.side === 'E' && u.lane === lane).sort((a, b) => a.pos - b.pos)[0]
          if (!front || g.units.some(u => u.side === 'P' && u.lane === lane && u.card.rank > front.card.rank)) continue
          const opts = g.P.hand.map((c, i) => ({ c, i })).filter(({ c, i }) => canPlay(g, i) && c.rank > front.card.rank).sort((a, b) => cost(a.c.rank) - cost(b.c.rank))
          if (opts.length) { g = playCard(g, opts[0].i, lane); played = true; break }
        }
        if (!played) break
      }
      if (g.P.elixir >= 9) {
        const opts = g.P.hand.map((c, i) => ({ c, i })).filter(({ i }) => canPlay(g, i)).sort((a, b) => b.c.rank - a.c.rank)
        if (opts.length) g = playCard(g, opts[0].i, rnd() < 0.5 ? 0 : 1)
      }
    } else if (rnd() < 0.5) {
      const ok = g.P.hand.map((_, i) => i).filter(i => canPlay(g, i))
      if (ok.length) g = playCard(g, ok[Math.floor(rnd() * ok.length)], rnd() < 0.5 ? 0 : 1)
    }
    g = endRound(g)
  }
  return { w: g.winner === 'P' ? 1 : g.winner === 'draw' ? 0.5 : 0, t: g.tick }
}
for (const smart of [false, true]) {
  let w = 0, t = 0; const N = 3000
  for (let i = 0; i < N; i++) { const r = play(i + 1, smart); w += r.w; t += r.t }
  console.log(smart ? 'rule-follower' : 'random', 'win', (w / N).toFixed(3), 'avg rounds', (t / N).toFixed(1))
}

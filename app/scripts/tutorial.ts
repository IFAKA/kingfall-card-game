// Picks the first game's fixed deal: the one every new player gets, so the tips teach the rules in the same order every time.
// Plays each candidate deal through the app's own steps (autoReveal flips the enemy's cards, so the suggestions see what the app shows)
// and keeps deals where following the suggestions shows each rule on its own, in teaching order, and ends in a close win.
// Run: node scripts/tutorial.ts [candidates]   (prints the best deals as ids for src/tutorial.ts, and checks the current one)
import { DECK_SIZE, DEFAULT_RULES, freshDeck, label, shuffle, splitDeal, suggestSetup } from '../src/engine.ts'
import type { Card } from '../src/engine.ts'
import { advise, adviseLastStand, autoReveal, endMyTurn, lastStandPlay, makeGame, next, playCard, startRound } from '../src/guide.ts'
import type { GameEvent, GuideState } from '../src/guide.ts'
import { mulberry, naive, random, slip } from './sim.ts'
import type { Player } from './sim.ts'
import { TUTORIAL, tutorialSecret } from '../src/tutorial.ts'

export interface Deal { mine: Card[]; deck: Card[]; slots: Card[]; secret: Record<string, Card> }
const byId = (id: string) => freshDeck().find(c => c.id === id)!

function dealFrom(seed: number): Deal {
  const rnd = mulberry(seed)
  const d = shuffle(freshDeck(), rnd)
  const { mine, theirs } = splitDeal(d), enemy = shuffle(theirs, rnd)
  const s = suggestSetup(mine)
  const deck = shuffle(mine.filter(c => s.deckIds.includes(c.id)), rnd)
  return { mine, deck, slots: s.slotIds.map(byId), secret: Object.fromEntries(enemy.map((c, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, c])) }
}

type Timed = GameEvent & { round: number }
/** Plays the deal the way the app does on screen. player null: follow every suggestion (the game a new player sees by tapping what glows). */
function play(deal: Deal, player: Player | null, rnd: () => number) {
  const settle = (g: GuideState) => autoReveal(g, deal.secret)
  let g = settle(startRound(makeGame(deal.deck, deal.slots, deal.mine, DEFAULT_RULES, true)))
  const events: Timed[] = []
  let plays = 0, trap = Infinity // the first round the suggestion steers you off your strongest card, because an enemy card beats it
  for (let n = 0; g.stage !== 'over' && n < 20000; n++) {
    if (g.stage === 'my_play') {
      const a = plays++ < 8 ? (player ? player(g, rnd) : advise(g)) : { kind: 'wait' as const }
      if (!player && plays === 1 && trap === Infinity && a.kind === 'play' && a.short.startsWith('not your ')) trap = g.round
      if (a.kind === 'play') g = playCard(g, a.handIndex, a.lane)
      else { g = endMyTurn(g); plays = 0 }
    } else if (g.stage === 'my_last_stand') {
      const a = adviseLastStand(g)
      g = lastStandPlay(g, a?.kind === 'play' ? a.handIndex : 0)
    } else g = next(g)
    g = settle(g)
    for (const e of g.events ?? []) events.push({ ...e, round: g.round })
  }
  return { g, events, trap }
}

// the moments the first game should teach, each the first time it happens
function lessons(events: Timed[]) {
  const first = (f: (e: Timed) => boolean) => events.find(f)?.round ?? Infinity
  const fights = events.filter(e => e.type === 'fight') as (Timed & { type: 'fight' })[]
  return {
    firstFight: fights[0],
    plainWin: first(e => e.type === 'fight' && !e.double && !e.ace && e.winner === 'P'),
    suit: first(e => e.type === 'fight' && !!e.double),
    suitFirstMine: fights.find(e => e.double)?.double === 'P' && fights.find(e => e.double)?.winner === 'P',
    ace: first(e => e.type === 'fight' && !!e.ace),
    aceMine: fights.find(e => e.ace)?.ace === 'P' && fights.find(e => e.ace)?.winner === 'P',
    enemyAceKills: fights.filter(e => e.ace === 'E' && e.winner === 'E').length,
    myBreak: first(e => e.type === 'tower' && e.side === 'P' && e.result === 'break'),
    crack: first(e => e.type === 'tower' && e.result === 'crack'),
    stand: first(e => e.type === 'play' && !!e.free),
    myStand: first(e => e.type === 'play' && e.side === 'P' && !!e.free), // your own last stand
    run: first(e => e.type === 'move' && !!e.ran?.some(r => r.side === 'P')), // one of your small cards runs 2 slots
  }
}

/** null if the suggested line breaks a must-have, else a score (higher is better). */
export function judge(deal: Deal) {
  const { g, events, trap } = play(deal, null, Math.random)
  if (g.winner !== 'P') return null
  const L = lessons(events), r = g.round, lost = g.stats.mineBroken
  const enemyFirst = deal.secret.ep0
  const must = [
    r >= 6 && r <= 11,                                         // long enough to see every rule, short enough to want another
    enemyFirst.rank >= 3 && enemyFirst.rank <= 9,               // its first card is plain: no ace, no picture
    !!L.firstFight && !L.firstFight.double && !L.firstFight.ace && L.firstFight.winner === 'P' && L.firstFight.round <= 2, // the first fight is just "higher wins", and you win it
    L.suit > L.plainWin && L.suit <= 5 && L.suitFirstMine,      // then the suit rule, on your side
    L.ace > L.suit && L.aceMine && L.enemyAceKills === 0,       // then your ace beats a king; theirs never beats yours
    L.myBreak <= 5, L.crack < r, L.stand < r,                   // a tower breaks early, a card cracks, a last stand comes before the end
    L.myStand < r,                                              // one of them yours: you lose a side tower and hold on (the trailer cuts to it too)
    L.run <= 4,                                                 // early on, one of your small cards runs
    trap <= 3,                                                  // early on, your strongest card is the wrong play and the suggestion says why
    lost >= 1 && lost <= 3,                                     // the enemy hurts you, so the win feels earned
  ]
  if (must.some(x => !x)) return null
  // the rules arrive one per round, not piled into one step
  const rounds = [L.plainWin, L.suit, L.ace, L.run, L.myBreak, L.crack, L.stand]
  const spread = new Set(rounds).size
  return { r, lost, L, spread }
}

// how forgiving the deal is when the player doesn't follow every suggestion
function robustness(deal: Deal, n = 300) {
  const rate = (p: Player, seed: number) => {
    const rnd = mulberry(seed); let w = 0
    for (let i = 0; i < n; i++) if (play(deal, p, rnd).g.winner === 'P') w++
    return w / n
  }
  return { slip25: rate(slip(0.25), 1), slip50: rate(slip(0.5), 2), naive: rate(naive, 3), random: rate(random, 4) }
}

function describeDeal(deal: Deal) {
  const ids = (cs: Card[]) => `[${cs.map(c => `'${c.id}'`).join(', ')}]`
  const enemy = Object.keys(deal.secret).sort((a, b) => (a[1] === b[1] ? Number(a.slice(2)) - Number(b.slice(2)) : a < b ? -1 : 1)).map(k => deal.secret[k])
  return [
    `  mine: ${ids(deal.mine)},`,
    `  deck: ${ids(deal.deck)}, // ${deal.deck.map(label).join(' ')}`,
    `  towers: ${ids(deal.slots)}, // ${deal.slots.map(label).join(' ')}`,
    `  enemyPile: ${ids(enemy.slice(0, DECK_SIZE))}, // ${enemy.slice(0, DECK_SIZE).map(label).join(' ')}`,
    `  enemyTowers: ${ids(enemy.slice(DECK_SIZE))}, // ${enemy.slice(DECK_SIZE).map(label).join(' ')}`,
  ].join('\n')
}

function report(name: string, deal: Deal) {
  const j = judge(deal), rb = robustness(deal)
  const { g, events, trap } = play(deal, null, Math.random)
  console.log(`\n${name}: suggested line ${g.winner === 'P' ? 'wins' : 'does not win'} in ${g.round} rounds, ${g.stats.mineBroken} of your tower cards lost${j ? '' : ' (FAILS a must-have)'}`)
  const L = lessons(events)
  console.log(`  rounds: plain win ${L.plainWin}, suit ×2 ${L.suit}, ace ${L.ace}, your first run ${L.run}, best card is a trap ${trap}, your first break ${L.myBreak}, crack ${L.crack}, last stand ${L.stand}`)
  console.log(`  win rate: slip 25% ${(rb.slip25 * 100).toFixed(0)}%, slip 50% ${(rb.slip50 * 100).toFixed(0)}%, naive ${(rb.naive * 100).toFixed(0)}%, random ${(rb.random * 100).toFixed(0)}%`)
  console.log(describeDeal(deal))
  return { j, rb }
}

export const current: Deal = (() => {
  const mine = TUTORIAL.mine.map(byId), s = suggestSetup(mine)
  return { mine, deck: TUTORIAL.deck.map(byId), slots: s.slotIds.map(byId), secret: tutorialSecret() }
})()

const N = import.meta.main ? Number(process.argv[2] ?? 0) : 0
if (N > 0) {
  Math.random = mulberry(99)
  const passing: { seed: number; deal: Deal; score: number }[] = []
  for (let seed = 1; seed <= N; seed++) {
    const deal = dealFrom(seed), j = judge(deal)
    if (j) passing.push({ seed, deal, score: j.spread })
  }
  console.log(`${passing.length} of ${N} deals pass every must-have`)
  // the most forgiving of the well-spread deals: a first game shouldn't need perfect play
  const top = passing.filter(p => p.score >= 5)
  const ranked = top.map(p => ({ ...p, rb: robustness(p.deal, 200) })).sort((a, b) => b.rb.slip25 + b.rb.slip50 - (a.rb.slip25 + a.rb.slip50))
  for (const p of ranked.slice(0, 3)) report(`seed ${p.seed}`, p.deal)
}
if (import.meta.main && TUTORIAL.mine.length) { const cur = report('current first game', current); if (!cur.j) process.exitCode = 1 }

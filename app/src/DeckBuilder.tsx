import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CircleHelp, Shuffle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DECK_SIZE, PER_SIDE, cost, randomSetup, suggestSetup } from './engine'
import type { Card } from './engine'
import { RulesSheet } from './Menu'
import { CastleArt, TCard } from './Pieces'
import { useViewport } from '@/hooks/use-viewport'
import { sfx } from './sfx'

// The deck screen: your 14 cards are always split 8 + 6, the deck (soldiers you play) and the towers (armor).
// Every change is a swap: tap a card, then another. A deck card and a tower card trade places; two tower cards trade
// places too, which reorders the armor (the front card is hit first). So the screen can never be left half-built.

const TOWERS = [
  { k: 'L', name: 'Left', slots: [0, 1] },
  { k: 'K', name: 'King', slots: [4, 5] },
  { k: 'R', name: 'Right', slots: [2, 3] },
] as const
// how much of each card behind the front one peeks out above it, as a share of the card's height: enough for its corner, rank over suit
const PEEK = 0.5
// dealing again, timed to watch but not to wait for: the 14 cards gather into a pile, then fly out one by one
const GATHER_MS = 420, DEAL_MS = 55, FLY = 0.35

// the rules of thumb, and the one thing worth knowing before you worry about them; how cards fight is in How to play
const GUIDE = <>
  <ul>
    <li><b>Mix your costs.</b> Strong cards break towers but cost a lot, and you get only 3 elixir a round: keep enough cheap ones (cost 1 to 3) to play something every round.</li>
    <li><b>Put an ace on top of a tower:</b> it beats any King that reaches it.</li>
    <li><b>Mix your suits,</b> so the suit wheel can work for you whatever the enemy plays.</li>
    <li><b>Leave some strong cards out.</b> The 6 cards that aren't in your deck are your towers' armor.</li>
  </ul>
  <p><b>Any kind of deck can win.</b> In thousands of simulated games, most mixes of cheap and strong cards win within about 10 points of each other: how you play decides the game.</p>
</>

// set once the suggestion's why has been read: it is told only the first time Suggest is used
const WHY_KEY = 'kingfall-suggest-why-seen'

type Spot = { zone: 'deck'; id: string } | { zone: 'tower'; i: number }

// onRedeal (on-screen play only): shuffle all 52 cards and deal 14 to you and 14 to the enemy again, split at random, as often as you like before starting
export default function DeckBuilder({ mine, deckIds, slotIds, onChange, onRedeal, title, bar, start }: {
  mine: Card[]; deckIds: string[]; slotIds: string[]; onChange: (deckIds: string[], slotIds: string[]) => void; onRedeal?: () => void
  title: string; bar: (title: ReactNode) => ReactNode; start: ReactNode
}) {
  const [pick, setPick] = useState<Spot | null>(null)
  // a deal in progress: 'gather' while the old cards fly into the pile, then 'deal' with n new cards already placed
  const [dealing, setDealing] = useState<{ phase: 'gather' | 'deal'; n: number } | null>(null)
  const [gotIt, setGotIt] = useState(() => localStorage.getItem(WHY_KEY) === '1') // the suggestion's why is told once, the first time Suggest is used
  useEffect(() => {
    if (!dealing) return
    if (dealing.phase === 'deal' && dealing.n >= PER_SIDE) return setDealing(null)
    const t = dealing.phase === 'gather'
      ? setTimeout(() => { onRedeal?.(); setDealing({ phase: 'deal', n: 0 }) }, GATHER_MS)
      : setTimeout(() => { sfx('hover'); setDealing({ phase: 'deal', n: dealing.n + 1 }) }, DEAL_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealing])
  const view = useViewport()
  const valid = deckIds.length === DECK_SIZE && slotIds.length === PER_SIDE - DECK_SIZE
  const suggested = suggestSetup(mine)
  // a hand saved by an older version or half-built starts from a random split like a fresh deal
  useEffect(() => { if (!valid) { const r = randomSetup(mine); onChange(r.deckIds, r.slotIds) } })
  if (!valid) return null
  // on the suggestion, the screen says why it is built that way (Suggest has nothing left to do)
  const onSuggestion = suggested.deckIds.every(id => deckIds.includes(id)) && suggested.slotIds.every((id, i) => slotIds[i] === id)

  const byId = (id: string) => mine.find(c => c.id === id)!
  const deck = mine.filter(c => deckIds.includes(c.id)) // strongest first, like the hand you were dealt

  const tap = (s: Spot) => {
    const same = pick?.zone === 'deck' ? s.zone === 'deck' && s.id === pick.id : pick?.zone === 'tower' && s.zone === 'tower' && s.i === pick.i
    if (same) { sfx('unpick'); return setPick(null) }
    // nothing picked yet, or another deck card: (re)pick it; two deck cards have nothing to trade
    if (!pick || (pick.zone === 'deck' && s.zone === 'deck')) { sfx('pick'); return setPick(s) }
    const slots = [...slotIds]
    let ids = deckIds
    if (pick.zone === 'tower' && s.zone === 'tower') [slots[pick.i], slots[s.i]] = [slots[s.i], slots[pick.i]]
    else {
      const [d, t] = (pick.zone === 'deck' ? [pick, s] : [s, pick]) as [Extract<Spot, { zone: 'deck' }>, Extract<Spot, { zone: 'tower' }>]
      ids = deckIds.map(x => (x === d.id ? slotIds[t.i] : x))
      slots[t.i] = d.id
    }
    onChange(ids, slots)
    sfx('place', 0, { mood: 'good' }); setPick(null)
  }
  const suggest = () => { setPick(null); onChange(suggested.deckIds, suggested.slotIds) }
  const deal = () => { setPick(null); sfx('unpick'); setDealing({ phase: 'gather', n: 0 }) }
  // the dealing order: the deck slots, then each tower from its back card to its front card, as you'd stack them
  const order = [...deck.map(c => c.id), ...TOWERS.flatMap(t => [...t.slots].reverse().map(i => slotIds[i]))]
  const placed = (id: string) => !dealing || (dealing.phase === 'deal' && order.indexOf(id) < dealing.n)
  const pile = order.filter(id => !placed(id))

  // card size follows the window, like the arena: the deck (4 + 4 on phones, one row of 8 when wide), the three towers
  // with their cards peeking out under each castle, and the start bar all fit without scrolling
  const w = Math.min(view.sw, 900) - 24
  const wide = w >= 620
  const rows = wide ? 1 : 2, cols = 8 / rows
  const byWidth = (w - 24 - 10 * (cols - 1)) / cols / 0.714
  // the towers row is as tall as its tallest column: every tower has two cards, so it's the king's bigger castle;
  // each deck row also leaves room under it for the cards' elixir balls
  const byHeight = (view.sh - 302) / (rows + 0.84 + 1 + PEEK + rows * 0.23)
  const ch = Math.max(60, Math.min(byWidth, byHeight, 150))
  const vars = { '--cw': `${ch * 0.714}px`, '--ch': `${ch}px`, '--peek': `${ch * PEEK}px` } as CSSProperties

  const avg = deck.reduce((a, c) => a + cost(c.rank), 0) / DECK_SIZE
  const heavy = deck.filter(c => cost(c.rank) >= 7).length
  const cheap = deck.filter(c => cost(c.rank) <= 3).length
  const speed = avg < 3.5 ? 'fast' : avg <= 5.5 ? 'balanced' : 'heavy'
  // while a card is picked, the cards it can swap with glow
  const target = (zone: Spot['zone']) => !!pick && (pick.zone === 'tower' || zone === 'tower')

  return (
    <div className={`deckb${wide ? ' wide' : ''}`} style={vars}>
      {bar(<>
        <h1>{title}</h1>
        <RulesSheet title="Building a deck" rules={GUIDE}><Button variant="secondary" size="icon-lg" aria-label="How to build a good deck" title="How to build a good deck"><CircleHelp /></Button></RulesSheet>
      </>)}
      <div className="dbody">
        {/* the pile in the middle while dealing: cards fly in face-down and out to their places, turning face-up */}
        {pile.length > 0 && <div className="dpile" aria-hidden>{pile.map((id, j) => (
          <div key={id} style={{ translate: `${Math.min(j, 8)}px ${-Math.min(j, 8)}px`, zIndex: 20 - j }}><TCard tid={`deck-${id}`} card={byId(id)} down fly={FLY} /></div>
        ))}</div>}
        <section className="dpanel deck">
          <header><h2>Your deck</h2><span>the 8 soldiers you play</span>
            <span className="ml-auto" />
            {onRedeal && <Button variant="secondary" size="sm" disabled={!!dealing} onClick={deal} title="Shuffle all 52 cards and deal new hands to you and the enemy"><Shuffle /> Deal</Button>}
            <Button variant="secondary" size="sm" disabled={onSuggestion || !!dealing} onClick={suggest} title={onSuggestion ? 'This is the suggested split' : 'Set a good deck and towers for these cards'}><Sparkles /> Suggest</Button>
          </header>
          {onSuggestion && !dealing && !gotIt && (
            <div className="coach dcoach" role="dialog" aria-label="Why this split">
              <p>Your 3 strongest cards break towers, your 5 cheapest let you play every round. The towers get the rest, the 2 strongest on the king, each tower's stronger card in front.</p>
              <div className="row"><button className="big" onClick={() => { localStorage.setItem(WHY_KEY, '1'); setGotIt(true) }}>Got it</button></div>
            </div>
          )}
          <div className="dcards">
            {deck.map(c => {
              const on = pick?.zone === 'deck' && pick.id === c.id
              if (!placed(c.id)) return <div key={c.id} className="dc empty" />
              return <div key={c.id} className={`dc${target('deck') && !on ? ' target' : ''}`}><TCard tid={`deck-${c.id}`} card={c} down={false} showCost fly={FLY} selected={on} onClick={dealing ? undefined : () => tap({ zone: 'deck', id: c.id })} /></div>
            })}
          </div>
        </section>
        <section className="dpanel towers">
          <header><h2>Your towers</h2><span>the other 6 are armor · the front card is hit first</span></header>
          <div className="dtowers">
            {TOWERS.map(t => (
              <div key={t.k} className={`dtower castle mine${t.k === 'K' ? ' king' : ''}`}>
                <CastleArt king={t.k === 'K'} />
                {/* the front card at the bottom, the ones behind it peeking out above */}
                <div className="dstack" style={{ height: `calc(var(--ch) + ${t.slots.length - 1} * var(--peek))` }}>
                  {t.slots.map((i, n) => {
                    const on = pick?.zone === 'tower' && pick.i === i
                    if (!placed(slotIds[i])) return null
                    return (
                      <div key={slotIds[i]} className={`dc${target('tower') && !on ? ' target' : ''}`} style={{ top: `calc(${t.slots.length - 1 - n} * var(--peek))`, zIndex: 10 - n }}>
                        <TCard tid={`deck-${slotIds[i]}`} card={byId(slotIds[i])} down={false} fly={FLY} selected={on} onClick={dealing ? undefined : () => tap({ zone: 'tower', i })} />
                      </div>
                    )
                  })}
                </div>
                <div className="cname">{t.name}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="dtray">
        <div className="dstats" title="Average elixir cost of your deck">
          <span className="edrop">{avg.toFixed(1)}</span>
          <div>
            <div className="dmeter"><span className="avgbar"><i style={{ transform: `translateX(${avg * 10 - 100}%)` }} /></span><b>{speed}</b></div>
            <small title="heavy: cost 7 or more · cheap: cost 1 to 3">{heavy} heavy · {cheap} cheap</small>
          </div>
        </div>
        {start}
      </div>
    </div>
  )
}

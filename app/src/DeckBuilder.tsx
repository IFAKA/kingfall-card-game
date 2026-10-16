import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CircleHelp, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DECK_SIZE, PER_SIDE, cost, randomSetup, secureRandom, suggestSetup } from './engine'
import type { Card } from './engine'
import { RulesSheet } from './Menu'
import { CastleArt, TCard } from './Pieces'
import { useViewport } from '@/hooks/use-viewport'
import { sfx } from './sfx'

// The deck screen: your 11 cards are always split 8 + 3, the deck (soldiers you play) and the towers (one card each).
// Every change is a swap: tap a card, then another. A deck card and a tower card trade places; two tower cards trade
// places too, which moves a card to another tower. So the screen can never be left half-built.

const TOWERS = [
  { k: 'L', name: 'Left', slots: [0] },
  { k: 'K', name: 'King', slots: [2] },
  { k: 'R', name: 'Right', slots: [1] },
] as const
// how much of each card behind the front one peeks out above it, as a share of the card's height: enough for its corner, rank over suit
const PEEK = 0.5
// how long a swapped card takes to fly to its new place
const FLY = 0.35

// the rules of thumb, and the one thing worth knowing before you worry about them; how cards fight is in How to play
const GUIDE = <>
  <ul>
    <li><b>Keep your strong cards.</b> A big card takes your whole turn, but it wins fights and pushes towers.</li>
    <li><b>But keep some small ones too</b> (A to 5): two of them fit in one turn, so you can answer both lanes in a round.</li>
    <li><b>Put an ace on a tower:</b> it beats any King that hits it.</li>
    <li><b>Mix your suits:</b> ♠ beats the enemy's ♥, ♣ fears its ♦.</li>
  </ul>
  <p><b>A deck of only small cards loses.</b> In thousands of simulated games, decks with 4 to 6 strong cards win most; with all strong cards you can't answer both lanes.</p>
</>

// set once the suggestion's why has been read: it is told only the first time Suggest is used
const WHY_KEY = 'suitkeep-suggest-why-seen'

type Spot = { zone: 'deck'; id: string } | { zone: 'tower'; i: number }

// One deal per game, as at the table where you can't shuffle again until you like your cards: building is all there is to do here.
export default function DeckBuilder({ mine, deckIds, slotIds, onChange, title, bar, start }: {
  mine: Card[]; deckIds: string[]; slotIds: string[]; onChange: (deckIds: string[], slotIds: string[]) => void
  title: string; bar: (title: ReactNode) => ReactNode; start: ReactNode
}) {
  const [pick, setPick] = useState<Spot | null>(null)
  const [gotIt, setGotIt] = useState(() => localStorage.getItem(WHY_KEY) === '1') // the suggestion's why is told once, the first time Suggest is used
  const view = useViewport()
  const valid = deckIds.length === DECK_SIZE && slotIds.length === PER_SIDE - DECK_SIZE
  const suggested = suggestSetup(mine)
  // a hand saved by an older version or half-built starts from a random split like a fresh deal
  useEffect(() => { if (!valid) { const r = randomSetup(mine, secureRandom); onChange(r.deckIds, r.slotIds) } })
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

  // card size follows the window, like the arena: the deck (4 + 4 on phones, one row of 8 when wide), the three towers
  // with their cards peeking out under each castle, and the start bar all fit without scrolling
  const w = Math.min(view.sw, 900) - 24
  const wide = w >= 620
  const rows = wide ? 1 : 2, cols = 8 / rows
  const byWidth = (w - 24 - 10 * (cols - 1)) / cols / 0.714
  // the towers row is as tall as its tallest column: every tower has one card, so it's the king's bigger castle;
  // each deck row also leaves room under it for the cards' cost balls
  const byHeight = (view.sh - 302) / (rows + 0.84 + 1 + rows * 0.23)
  const ch = Math.max(60, Math.min(byWidth, byHeight, 150))
  const vars = { '--cw': `${ch * 0.714}px`, '--ch': `${ch}px`, '--peek': `${ch * PEEK}px` } as CSSProperties

  // how much of a turn the deck's cards use: 1 when all are small (two a round), 2 when all are big (one a round)
  const avg = deck.reduce((a, c) => a + cost(c.rank), 0) / DECK_SIZE
  const big = deck.filter(c => cost(c.rank) >= 2).length
  const small = DECK_SIZE - big
  const speed = big < 3 ? 'too light' : big <= 6 ? 'balanced' : 'heavy'
  // while a card is picked, the cards it can swap with glow
  const target = (zone: Spot['zone']) => !!pick && (pick.zone === 'tower' || zone === 'tower')

  return (
    <div className={`deckb${wide ? ' wide' : ''}`} style={vars}>
      {bar(<>
        <h1>{title}</h1>
        <RulesSheet title="Building a deck" rules={GUIDE}><Button variant="secondary" size="icon-lg" aria-label="How to build a good deck" title="How to build a good deck"><CircleHelp /></Button></RulesSheet>
      </>)}
      <div className="dbody">
        <section className="dpanel deck">
          <header><h2>Your deck</h2><span>the 8 soldiers you play</span>
            <span className="ml-auto" />
            <Button variant="secondary" size="sm" disabled={onSuggestion} onClick={suggest} title={onSuggestion ? 'This is the suggested split' : 'Set a good deck and towers for these cards'}><Sparkles /> Suggest</Button>
          </header>
          {onSuggestion && !gotIt && (
            <div className="coach dcoach" role="dialog" aria-label="Why this split">
              <p>Your 4 strongest cards win fights and break towers; your 4 smallest go two to a turn. The 3 in the middle are your towers, the strongest on the king.</p>
              <div className="row"><button className="big" onClick={() => { localStorage.setItem(WHY_KEY, '1'); setGotIt(true) }}>Got it</button></div>
            </div>
          )}
          <div className="dcards">
            {deck.map(c => {
              const on = pick?.zone === 'deck' && pick.id === c.id
              return <div key={c.id} className={`dc${target('deck') && !on ? ' target' : ''}`}><TCard tid={`deck-${c.id}`} card={c} down={false} showCost fly={FLY} selected={on} onClick={() => tap({ zone: 'deck', id: c.id })} /></div>
            })}
          </div>
        </section>
        <section className="dpanel towers">
          <header><h2>Your towers</h2><span>the other 3 cards, one each · each takes two hits</span></header>
          <div className="dtowers">
            {TOWERS.map(t => (
              <div key={t.k} className={`dtower castle mine${t.k === 'K' ? ' king' : ''}`}>
                <CastleArt king={t.k === 'K'} />
                {/* the front card at the bottom, the ones behind it peeking out above */}
                <div className="dstack" style={{ height: `calc(var(--ch) + ${t.slots.length - 1} * var(--peek))` }}>
                  {t.slots.map((i, n) => {
                    const on = pick?.zone === 'tower' && pick.i === i
                    return (
                      <div key={slotIds[i]} className={`dc${target('tower') && !on ? ' target' : ''}`} style={{ top: `calc(${t.slots.length - 1 - n} * var(--peek))`, zIndex: 10 - n }}>
                        <TCard tid={`deck-${slotIds[i]}`} card={byId(slotIds[i])} down={false} fly={FLY} selected={on} onClick={() => tap({ zone: 'tower', i })} />
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
        <div className="dstats" title="How much of a turn your deck's cards use on average: 1 = all small (two a round), 2 = all big (one a round)">
          <span className="edrop">{avg.toFixed(1)}</span>
          <div>
            <div className="dmeter"><span className="avgbar"><i style={{ transform: `translateX(${(avg - 1) * 100 - 100}%)` }} /></span><b>{speed}</b></div>
            <small title="big: 6 to K (your whole turn) · small: A to 5 (two a turn)">{big} big · {small} small</small>
          </div>
        </div>
        {start}
      </div>
    </div>
  )
}

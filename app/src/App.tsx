import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { DEFAULT_RULES, RANKS, SUITS, autoTowers, cost, deal, freshDeck, isRed, label, shuffle, suggestDeck } from './engine'
import type { Card, Unit } from './engine'
import {
  advise, adviseLastStand, autoReveal, canPlay, describe, endMyTurn, enterEnemyCard, enterTowerCard, excludedIds, lastStandPlay, makeGame, next, options, playCard, startRound, summary,
} from './guide'
import type { ESlot, GuideState } from './guide'
import { useFx } from './fx'
import type { Pop } from './fx'
import { isMuted, setMuted, sfx } from './sfx'
import { Lightbulb, Redo2, Undo2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CardText, Choice, GameMenu, RulesSheet } from './Menu'

type Help = 'off' | 'explain' | 'suggest'
type Screen = 'title' | 'deal' | 'enter' | 'draft' | 'table' | 'play'
interface Saved { mode?: 'guide' | 'play'; secret?: Record<string, Card>; screen: Screen; my16: string[]; deckIds: string[]; slotIds: string[]; help: Help; pre: GuideState | null; game: GuideState | null; history: GuideState[] }

const ALL = freshDeck()
const byId = (id: string) => ALL.find(c => c.id === id)!
export const STORAGE_KEY = 'solo-clash-guide-v4' // bump when the rules change, so old saved games don't load into new rules

function load(): Saved | null {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? (JSON.parse(s) as Saved) : null } catch { return null }
}

// ---------- small components ----------
function CardView({ card, down, showCost, selected, dim, small, onClick }: {
  card?: Card | null; down?: boolean; showCost?: boolean; selected?: boolean; dim?: boolean; small?: boolean; onClick?: () => void
}) {
  if (!card || down) return <div className={`card back ${small ? 'small' : ''}`} onClick={onClick} />
  return (
    <div className={`card face ${isRed(card) ? 'red' : 'black'} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''} ${small ? 'small' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="corner">{RANKS[card.rank]}<br />{SUITS[card.suit]}</div>
      <div className="pip">{SUITS[card.suit]}</div>
      {showCost && <div className="cost" title="elixir cost">{cost(card.rank)}</div>}
    </div>
  )
}

// A card on the board: it has a stable id (tid), so when it changes place it SLIDES there instead of jumping.
// A card that is revealed (face-down -> face-up) FLIPS while it moves.
const faceMemory = new Map<string, boolean>()
// the 3D flip makes browsers snapshot the card's back, so drag a flat copy of the face instead
function makeGhost(el: HTMLElement, x: number, y: number) {
  const card = el.querySelector('.tcard') as HTMLElement | null
  if (!card) return null
  const w = card.offsetWidth, h = card.offsetHeight
  const ghost = card.cloneNode(true) as HTMLElement
  const flip = ghost.querySelector('.flip') as HTMLElement | null
  if (flip) Object.assign(flip.style, { transform: 'none', transition: 'none', transformStyle: 'flat' })
  ghost.querySelector('.backside')?.remove()
  ghost.querySelectorAll<HTMLElement>('.cf').forEach(f => { f.style.backfaceVisibility = 'visible'; f.style.setProperty('-webkit-backface-visibility', 'visible') })
  Object.assign(ghost.style, { position: 'absolute', left: '0', top: '0', width: `${w}px`, height: `${h}px`, pointerEvents: 'none', zIndex: '9999', opacity: '1', filter: 'none', boxShadow: '0 8px 18px rgba(0,0,0,.5)' })
  const play = el.closest('.arena') as HTMLElement
  const pr = play.getBoundingClientRect()
  // screen point -> the arena's own coordinates
  const local = (px: number, py: number) => [px - pr.left, py - pr.top]
  // keep the card under the pointer where it was grabbed, not centred on it
  const cr = card.getBoundingClientRect()
  const [gx, gy] = local(x, y), [cx, cy] = local(cr.left + cr.width / 2, cr.top + cr.height / 2)
  const ox = gx - cx, oy = gy - cy
  ghost.style.transformOrigin = `${w / 2 + ox}px ${h / 2 + oy}px` // lift around the grab point
  const place = (px: number, py: number, scale: number, grabbed: boolean) => {
    const [lx, ly] = local(px, py)
    ghost.style.transform = `translate(${lx - w / 2 - (grabbed ? ox : 0)}px, ${ly - h / 2 - (grabbed ? oy : 0)}px) scale(${scale})`
  }
  const move = (px: number, py: number) => place(px, py, 1.08, true)
  move(x, y)
  play.appendChild(ghost) // inside the arena, so it inherits the card size variables
  // a drop that didn't land: glide back to the card's slot in the hand, then vanish
  const glideBack = (done: () => void) => {
    const r = card.getBoundingClientRect()
    ghost.style.transition = 'transform .2s cubic-bezier(.23, 1, .32, 1)'
    place(r.left + r.width / 2, r.top + r.height / 2, 1, false)
    setTimeout(() => { ghost.remove(); done() }, 210)
  }
  return { move, remove: () => ghost.remove(), glideBack }
}

// Confetti bursts from both sides for a few seconds; mounts only while the win dialog is up.
function WinConfetti() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const end = Date.now() + 2500
    const opts = { particleCount: 6, spread: 70, startVelocity: 55, zIndex: 10000 }
    const id = setInterval(() => {
      confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.8 } })
      confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.8 } })
      if (Date.now() > end) clearInterval(id)
    }, 120)
    return () => { clearInterval(id); confetti.reset() }
  }, [])
  return null
}

function TCard({ tid, card, down, selected, dim, showCost, onClick }: {
  tid: string; card: Card | null; down: boolean; selected?: boolean; dim?: boolean; showCost?: boolean; onClick?: () => void
}) {
  const [shown, setShown] = useState<boolean>(faceMemory.get(tid) ?? down)
  useEffect(() => {
    faceMemory.set(tid, down)
    // flip on the next frame, so a card that just moved here starts from the face it had before
    const f = requestAnimationFrame(() => setShown(down))
    return () => cancelAnimationFrame(f)
  }, [tid, down])
  return (
    <motion.div
      layoutId={tid} layout
      transition={{ layout: { duration: 0.5, ease: [0.77, 0, 0.175, 1] } }}
      className={`tcard ${selected ? 'selected' : ''} ${dim ? 'dim' : ''} ${onClick ? 'clickable' : ''}`}
      style={{ zIndex: 5 }} onClick={onClick} data-tid={tid}
    >
      <div className={`flip ${shown ? 'down' : ''}`}>
        <div className={`cf front ${card && isRed(card) ? 'red' : 'black'}`}>
          {card && <>
            <div className="corner">{RANKS[card.rank]}<br />{SUITS[card.suit]}</div>
            <div className="pip">{SUITS[card.suit]}</div>
            {showCost && <div className="cost" title="elixir cost">{cost(card.rank)}</div>}
          </>}
        </div>
        <div className="cf backside" />
      </div>
    </motion.div>
  )
}

// Pop-ups from the latest step (see fx.ts), drawn over the board.
function FxLayer({ pops }: { pops: Pop[] }) {
  return (
    <div className="fxlayer" aria-hidden>
      {pops.map(p => (
        <div key={p.id} className={`pop ${p.kind}`} style={{ left: p.x, top: p.y }}>
          {p.text}{p.sub && <small>{p.sub}</small>}
        </div>
      ))}
    </div>
  )
}

// ---------- the arena (on-screen play): upright like Clash, enemy on top, you at the bottom ----------
const STACK_NAME = { L: 'Left', R: 'Right', K: 'King' } as const

// A tower drawn as a castle: one armor pip per card left (a cracked card shows cracked), and the armor to beat on its top card when it is known (an empty slot until then).
function Castle({ k, items, own, cracked }: { k: 'L' | 'R' | 'K'; items: ESlot[]; own: boolean; cracked: string[] }) {
  const top = items[0]
  const known = top?.card
  return (
    <div className={`castle ${own ? 'mine' : 'theirs'} ${k === 'K' ? 'king' : ''} ${items.length ? '' : 'fallen'}`} data-anchor={`tower-${own ? 'P' : 'E'}-${k}`}
      title={`${own ? 'Your' : 'Enemy'} ${STACK_NAME[k].toLowerCase()} tower: ${items.length} card${items.length === 1 ? '' : 's'} of armor${known ? `; a soldier needs rank ${RANKS[known.rank]} or more to break the top one` : ''}`}>
      <svg className="cart" viewBox={k === 'K' ? '0 0 64 56' : '0 16 64 40'} aria-hidden>
        {k === 'K'
          ? <path d="M6 54V22h8v6h8V14h8v6h4v-6h8v14h8v-6h8v32z" />
          : <path d="M12 54V18h8v6h6v-6h12v6h6v-6h8v36z" />}
        {k === 'K' && <path className="crown" d="M21 10l1-8 5 5 5-6 5 6 5-5 1 8z" />}
        <path className="door" d="M27 54V42a5 5 0 0 1 10 0v12z" />
      </svg>
      <div className="armor">{items.map(it => <i key={it.tid} className={cracked.includes(it.tid) ? 'crk' : ''} />)}</div>
      <div className="tslot">{known
        ? <div className={`topcard ${isRed(known) ? 'red' : ''}`}>{RANKS[known.rank]}{SUITS[known.suit]}</div>
        : items.length ? <div className="topcard empty" /> : <div className="cname">Fallen</div>}</div>
    </div>
  )
}

// With real cards, a tower is drawn as the cards on the table: a fan, top card (hit first) in front. Yours face-up, the enemy's face-down until flipped.
function TowerFan({ k, items, own, cracked, flip }: { k: 'L' | 'R' | 'K'; items: ESlot[]; own: boolean; cracked: string[]; flip?: boolean }) {
  const n = items.length
  return (
    <div className={`tfan ${own ? 'mine' : 'theirs'} ${k === 'K' ? 'king' : ''} ${n ? '' : 'fallen'} ${flip ? 'flipme' : ''}`} data-anchor={`tower-${own ? 'P' : 'E'}-${k}`}
      title={`${own ? 'Your' : 'Enemy'} ${STACK_NAME[k].toLowerCase()} tower: ${n} card${n === 1 ? '' : 's'}; the front card is hit first. A cracked card (sideways at the table) breaks on any hit.`}>
      <div className="fancards" style={{ width: `calc(var(--cw) + ${Math.max(0, n - 1)} * var(--toff))` }}>
        {items.map((it, i) => (
          <div key={it.tid} className={`fc ${cracked.includes(it.tid) ? 'cracked' : ''}`} style={{ left: `calc(${i} * var(--toff))`, zIndex: n - i }}>
            <TCard tid={it.tid} card={it.card} down={!it.card} />
          </div>
        ))}
      </div>
      <div className="cname">{n ? STACK_NAME[k] : `${STACK_NAME[k]} · fallen`}</div>
    </div>
  )
}

// With real cards, elixir is drawn like the bar on the table: 10 face-down cards in a row, overlapping so each number shows, the marker turned sideways.
// A card you pick frames the cards it would spend.
function CardBar({ n, spend = 0, who }: { n: number; spend?: number; who: 'Your' | 'Enemy' }) {
  const [a, b] = spendRange(n, spend)
  return (
    <div className={`cbar ${who === 'Enemy' ? 'theirs' : 'mine'}`} role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={n} aria-label={`${who} elixir`} title={`${who} elixir bar: ${n ? `the sideways card is number ${n}` : 'no card sideways'}, so ${n} elixir`}>
      <div className="drop">{n}</div>
      <div className="cslots">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className={`bc ${i === n - 1 ? 'mark' : ''} ${spend > 0 && i >= a && i < b ? (spend > n ? 'short' : 'spend') : ''}`}><span>{i + 1}</span></div>
        ))}
      </div>
    </div>
  )
}

// A pile squared up on the table: the top card shows face-up only where it is face-up at the table, with the count under it.
// The top card keeps its id, so a card played from the pile, drawn from it or thrown on it slides there.
function TablePile({ top, down, n, name, flip, discard }: { top?: ESlot; down: boolean; n: number; name: string; flip?: boolean; discard?: boolean }) {
  return (
    <div className={`tpile ${flip ? 'flipme' : ''}`}>
      <div className="pcards">
        {Array.from({ length: Math.min(3, Math.max(0, n - 1)) }, (_, i) => <div key={i} className={`pback ${discard ? 'face' : ''}`} style={{ translate: `${(i + 1) * 2}px ${(i + 1) * 2}px` }} />)}
        {top && <TCard key={top.tid} tid={top.tid} card={top.card} down={down} />}
        <span className="pcount" aria-label={`${n} cards`}>{n}</span>
      </div>
      <div className="cname">{name}</div>
    </div>
  )
}

// Elixir as one bar that fills smoothly; hovering or dragging a card shows what it would cost.
function ElixirBar({ n, spend }: { n: number; spend: number }) {
  const [a, b] = spendRange(n, spend)
  return (
    <div className="ebar" role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={n} aria-label="Your elixir">
      <div className="drop">{n}</div>
      <div className="segs">
        <div className="fill" style={{ transform: `translateX(${(n - 10) * 10}%)` }} />
        {spend > 0 && <div className={`spend ${spend > n ? 'short' : ''}`} style={{ left: `${a * 10}%`, width: `${(b - a) * 10}%` }} />}
        {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${(i + 1) * 10}%` }} />)}
      </div>
    </div>
  )
}

// One lane, top to bottom: your soldiers hitting the enemy tower, the enemy's slot, the river, your slot, enemy soldiers hitting your tower.
function ArenaLane({ idx, units, laneLen, dragging, hint, suggested, over, onPlace }: { idx: 0 | 1; units: Unit[]; laneLen: number; dragging: boolean; hint: boolean; suggested: boolean; over: boolean; onPlace: () => void }) {
  const here = (pred: (u: Unit) => boolean) => units.filter(u => u.lane === idx && pred(u)).map(u => (
    <div key={u.uid} className={`unit ${u.side}`}><TCard tid={u.tid!} card={u.card} down={false} /></div>
  ))
  return (
    <div className="alane">
      <div className="spot atk">{here(u => u.side === 'P' && u.pos >= laneLen)}</div>
      <div className="spot slot" data-anchor={`lane-${idx}`}>{here(u => u.pos === laneLen - 1)}</div>
      <div className="river" />
      <div className={`spot slot mine ${dragging || hint || suggested ? 'droppable' : ''} ${dragging && over ? 'over' : ''} ${suggested ? 'suggested' : ''}`} data-lane={idx} data-anchor={`lane-${idx}`} onClick={hint || suggested ? onPlace : undefined}>
        {here(u => u.pos === 0)}
        {(dragging || hint || suggested) && <span className="droptag">{suggested && '★ '}{idx === 0 ? 'LEFT' : 'RIGHT'}</span>}
      </div>
      <div className="spot atk">{here(u => u.side === 'E' && u.pos < 0)}</div>
    </div>
  )
}

// ---------- setup at the real table: one step per screen, each with a picture ----------
// Mini cards for the pictures: face-down by default, or a known card face-up; "side" is a marker turned sideways.
function Mc({ card, side, hot }: { card?: Card; side?: boolean; hot?: boolean }) {
  return <span className={`mc${card ? ' face' : ''}${card && isRed(card) ? ' red' : ''}${side ? ' side' : ''}${hot ? ' hot' : ''}`}>{card && <>{RANKS[card.rank]}{SUITS[card.suit]}</>}</span>
}
const backs = (n: number, gapAfter?: number, sideAt?: number) => Array.from({ length: n }, (_, i) => <Fragment key={i}>{i === gapAfter && <span className="mgap" />}<Mc side={i === sideAt} hot={i === sideAt} /></Fragment>)

interface SetupStep { title: string; pic: ReactNode; body: ReactNode }
function Stepper({ steps, at, setAt, done }: { steps: SetupStep[]; at: number; setAt: (n: number) => void; done: ReactNode }) {
  const st = steps[Math.min(at, steps.length - 1)]
  return (
    <div className="stepper">
      <div className="dots" aria-label={`Step ${at + 1} of ${steps.length}`}>{steps.map((_, i) => <i key={i} className={i === at ? 'on' : i < at ? 'past' : ''} />)}</div>
      <h2>{st.title}</h2>
      <div className="pic">{st.pic}</div>
      <div className="stepbody">{st.body}</div>
      <div className="row">
        {at > 0 && <button onClick={() => setAt(at - 1)}>Back</button>}
        {at < steps.length - 1 ? <button className="big" onClick={() => setAt(at + 1)}>Next</button> : done}
      </div>
    </div>
  )
}

// Slots [from, to) a card's cost covers: back from the marker, or from the start when it costs more than you have.
function spendRange(n: number, spend: number): [number, number] {
  const from = Math.max(0, n - spend)
  return [from, Math.min(10, from + spend)]
}

// The window size: the arena sizes its cards from it.
function useViewport() {
  const read = () => ({ sw: innerWidth, sh: innerHeight })
  const [v, setV] = useState(read)
  useEffect(() => {
    const f = () => setV(read())
    addEventListener('resize', f); addEventListener('orientationchange', f)
    return () => { removeEventListener('resize', f); removeEventListener('orientationchange', f) }
  }, [])
  return v
}

// The table instructions shout their key words (BOTTOM, FACE-UP, LEFT); on the panel they read as bold words in a normal sentence, card names as little cards.
function Said({ text }: { text: string }) {
  let before = ''
  return text.split(/(\b[A-Z]{2,}(?:[ -][A-Z]{2,})*\b)/).map((part, i) => {
    const prev = before
    before += part
    if (i % 2 === 0) return <CardText key={i} text={part} />
    const low = part.toLowerCase()
    return <b key={i}>{!prev.trim() || /[.:!]\s*$/.test(prev) ? low[0].toUpperCase() + low.slice(1) : low}</b>
  })
}

// Telling the app a card you flipped at the table: tap its rank and its suit, in either order. Cards already known are greyed out.
function FlipPicker({ known, onPick }: { known: Set<string>; onPick: (c: Card) => void }) {
  const [rank, setRank] = useState<number | null>(null)
  const [suit, setSuit] = useState<number | null>(null)
  const has = (r: number, s: number) => known.has(`${r}-${s}`)
  const choose = (r: number | null, s: number | null) => {
    if (r !== null && s !== null) { onPick(byId(`${r}-${s}`)); return }
    setRank(r); setSuit(s)
  }
  const ranks = Array.from({ length: 13 }, (_, i) => i + 1)
  return (
    <div className="flippick">
      <div className="franks">
        {ranks.map(r => (
          <button key={r} className={`fkey ${rank === r ? 'sel' : ''}`} disabled={suit !== null ? has(r, suit) : [0, 1, 2, 3].every(s => has(r, s))}
            onClick={() => choose(rank === r ? null : r, suit)}>{RANKS[r]}</button>
        ))}
      </div>
      <div className="fsuits">
        {[0, 1, 2, 3].map(s => (
          <button key={s} className={`fkey suit ${s === 1 || s === 2 ? 'red' : ''} ${suit === s ? 'sel' : ''}`} aria-label={['spades', 'hearts', 'diamonds', 'clubs'][s]}
            disabled={rank !== null ? has(rank, s) : ranks.every(r => has(r, s))} onClick={() => choose(rank, suit === s ? null : s)}>{SUITS[s]}</button>
        ))}
      </div>
    </div>
  )
}

function CardPicker({ disabled, onPick, selected }: { disabled: Set<string>; onPick: (c: Card) => void; selected?: Set<string> }) {
  return (
    <div className="picker">
      {[0, 1, 2, 3].map(s => (
        <div className="prow" key={s}>
          {ALL.filter(c => c.suit === s).map(c => (
            <button key={c.id} disabled={disabled.has(c.id)} className={`pbtn ${isRed(c) ? 'red' : ''} ${selected?.has(c.id) ? 'sel' : ''}`} onClick={() => onPick(c)}>
              {RANKS[c.rank]}{SUITS[c.suit]}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

const TITLES: Record<string, string> = {
  round_start: 'Start of the round', my_play: 'Your turn', enemy_enter: 'Enemy turn: flip its top card', enemy_play: 'Enemy plays a card',
  enemy_stop: 'Enemy turn ends', move: 'Move the cards', fight: 'Fight', tower_enter: 'A tower is hit: flip its top card',
  tower_result: 'Tower hit', my_last_stand: 'Last stand: place a free card', last_stand_enter: 'Enemy last stand: flip its top card', over: 'Game over',
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className={`logo${small ? ' small' : ''}`}>
      <svg className="crown" viewBox="0 0 64 40" aria-hidden><path d="M6 36 L2 8 L18 20 L32 2 L46 20 L62 8 L58 36 Z" /><circle cx="2" cy="8" r="4" /><circle cx="32" cy="3" r="4" /><circle cx="62" cy="8" r="4" /></svg>
      <span>KINGFALL</span>
    </div>
  )
}

const RULES_60 = (
  <ul>
    <li><b>Goal:</b> destroy the enemy's <b>king tower</b> (a stack of 2 cards) before it destroys yours.</li>
    <li><b>Cards</b> are soldiers. Higher rank wins a fight (A=1 … K=13). A card of the suit that beats the other counts <b>double</b>: ♠→♥, ♥→♦, ♦→♣, ♣→♠.</li>
    <li><b>Aces beat picture cards</b> (J, Q, K) in a fight, whatever the suits. Watch out: it works for the enemy too.</li>
    <li><b>Elixir</b> pays for soldiers: a card costs about its rank (A=1, 5=4, 8=6, K=10). You get 3 more each round, max 10.</li>
    <li>Each round: <b>you play</b> cards into a lane, then the <b>enemy</b> plays from its pile into the lane where you have <b>more</b> cards (it defends; on a tie, where your highest-ranked card is, then left), then <b>everything moves</b> one slot and <b>fights</b>. Cards that face each other don't pass through: they clash where they stand, and the winner steps into the slot it cleared. Survivors reaching the other end hit a tower.</li>
    <li><b>A tower card breaks</b> if the attacking soldier's rank ≥ the tower's top card. A tower stack has 2–3 cards; each break removes one. If the soldier is too weak, the tower holds but its top card <b>cracks</b>: turn it sideways and move it to the bottom of that tower. Any later hit breaks a cracked card. The king can only be hit after the princess tower in that lane is gone.</li>
    <li><b>Last stand:</b> when a left or right tower is destroyed, its owner immediately places one card in that lane for free (the enemy uses the top card of its pile).</li>
    <li>A fighting card that dies goes to the <b>bottom of its owner's pile</b>, and you draw it again later. So your 8 cards just keep cycling.</li>
  </ul>
)

// First games teach by playing: one tip at a time, each shown the first time its situation comes up (on screen, the enemy waits while it is open).
type TipId = 'drag' | 'elixir' | 'enemy' | 'fight' | 'tower'
const TIPS: Record<TipId, string> = {
  drag: 'Drag a card from your hand onto one of your lane slots, the bottom half of the field. The purple number is its elixir cost.',
  elixir: 'Elixir pays for cards. You get 3 more every round, up to 10. Play another card, or press the ✓ button next to your hand to end your turn and let the enemy move.',
  enemy: 'The enemy defends: it plays into the lane where you have more cards.',
  fight: 'When two cards meet, the higher rank wins. A card of the suit that beats the other counts double (♠ › ♥ › ♦ › ♣ › ♠), and aces beat J, Q and K.',
  tower: "The crowned castle in the middle is the king; the two beside it guard the left and right lanes. A card that reaches a tower breaks its top card if its rank is at least that card's (shown under your castles). If not, the tower card cracks, and any later hit breaks it. Break both king cards to win.",
}
// with real cards the towers are the fanned cards on the table, not castles
const TABLE_TIPS: Partial<Record<TipId, string>> = {
  tower: "The fan in the middle is your king; the two beside it guard the left and right lanes. A card that reaches a tower breaks its front card if its rank is at least that card's. If not, the tower card cracks (turn it sideways at the table), and any later hit breaks it. Break both enemy king cards to win.",
}
const TIPS_KEY = 'kingfall-tips-seen'
const PULSES = ['droppulse', 'suggestglow', 'suggestring', 'flipglow']
const readJSON = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback } }
const writeJSON = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage full or blocked */ } }

const AUTO_STAGES = ['round_start', 'enemy_play', 'enemy_stop', 'move', 'fight', 'tower_result']
// hold each step longer the more it shows (one line per event), so busy fights can be followed
const autoDelay = (events: number) => Math.min(4000, 700 + 600 * events)

export default function App() {
  const saved = useMemo(() => load(), [])
  const [screen, setScreen] = useState<Screen>(saved?.screen ?? 'title')
  const [my16, setMy16] = useState<string[]>(saved?.my16 ?? [])
  const [deckIds, setDeckIds] = useState<string[]>(saved?.deckIds ?? [])
  const [slotIds, setSlotIds] = useState<string[]>(saved?.slotIds ?? [])
  const [mode, setMode] = useState<'guide' | 'play'>(saved?.mode ?? 'guide')
  const [secret, setSecret] = useState<Record<string, Card>>(saved?.secret ?? {})
  const [bad, setBad] = useState<number | null>(null) // a card tapped that costs more than you have
  const [swapFrom, setSwapFrom] = useState<number | null>(null)
  const [explainOn, setExplainOn] = useState(saved ? saved.help === 'explain' : false)
  const [suggestOn, setSuggestOn] = useState(saved ? saved.help === 'suggest' : false)
  const help: Help = suggestOn ? 'suggest' : explainOn ? 'explain' : 'off'
  const [pre, setPre] = useState<GuideState | null>(saved?.pre ?? null)
  const [game, setGame] = useState<GuideState | null>(saved?.game ?? null)
  const [history, setHistory] = useState<GuideState[]>(saved?.history ?? [])
  const [future, setFuture] = useState<GuideState[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [overLane, setOverLane] = useState<0 | 1 | null>(null)
  const justDragged = useRef(false)
  const [hov, setHov] = useState<number | null>(null)
  const view = useViewport()
  const [overSeen, setOverSeen] = useState(false)
  const [resultViewed, setResultViewed] = useState(false) // the win confetti only throws the first time the result opens
  const [doSeen, setDoSeen] = useState(-1)
  const [setupStep, setSetupStep] = useState(0)
  useEffect(() => { setSetupStep(0) }, [screen])
  const [muted, setMutedState] = useState(isMuted)
  const toggleMute = () => { setMuted(!muted); setMutedState(!muted); if (muted) sfx('tap') }
  // the hint and drop-target pulses beat together: every one is pinned to the page clock, whenever it appeared
  useEffect(() => {
    for (const a of document.getAnimations()) if (a instanceof CSSAnimation && PULSES.includes(a.animationName) && a.startTime !== 0) a.startTime = 0
  })
  // every button answers with a soft click
  useEffect(() => {
    const click = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('button:not(:disabled)')) sfx('tap') }
    document.addEventListener('click', click, true)
    return () => document.removeEventListener('click', click, true)
  }, [])
  // tapping anywhere that isn't a card, a lane or a button lets go of the picked card
  useEffect(() => {
    const away = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('.hdrag, .spot.slot, button')) { if (sel !== null || bad !== null) sfx('unpick'); setSel(null); setBad(null) } }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [sel, bad])
  // the state the latest step produced: only it gets effects (not undo, redo or a reloaded game)
  const fresh = useRef<GuideState | null>(null)
  const advance = (g: GuideState) => { fresh.current = g; setGame(g) }
  const playRef = useRef<HTMLDivElement>(null)
  const { pops, shake } = useFx(game, fresh.current, playRef)
  const [tipsSeen, setTipsSeen] = useState<TipId[]>(() => readJSON(TIPS_KEY, []))
  const [tip, setTip] = useState<TipId | null>(null)
  const seeTip = (ids: TipId[]) => { const n = [...new Set([...tipsSeen, ...ids])]; setTipsSeen(n); writeJSON(TIPS_KEY, n); setTip(null) }
  useEffect(() => {
    if (screen !== 'play' || !game) return
    const doneNow: TipId[] = tip === 'drag' && game.stats.placed > 0 ? ['drag'] : [] // done by doing it
    if (doneNow.length) seeTip(doneNow)
    else if (tip) return
    const ev = game.events ?? [], isFresh = game === fresh.current
    const wants = (id: TipId) => !tipsSeen.includes(id) && !doneNow.includes(id)
    const happened = (f: (e: NonNullable<GuideState['events']>[number]) => boolean) => isFresh && ev.some(f)
    const next: TipId | undefined = ([
      ['drag', game.stage === 'my_play' && game.stats.placed === 0],
      ['elixir', happened(e => e.type === 'play' && e.side === 'P')],
      ['enemy', happened(e => e.type === 'play' && e.side === 'E')],
      ['fight', happened(e => e.type === 'fight')],
      ['tower', happened(e => e.type === 'tower')],
    ] as [TipId, boolean][]).find(([id, now]) => now && wants(id))?.[0]
    if (next) setTip(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, screen])
  // the arena's "what happened" line keeps the last thing worth saying until something new happens
  const [said, setSaid] = useState<string[]>([])
  useEffect(() => {
    if (!game || game !== fresh.current) return
    const d = (game.events ?? []).flatMap(e => { const s = describe(e); return s ? [{ s, special: e.type === 'fight' && !!(e.ace || e.double) }] : [] })
    // a ×2 or ace pop-up doesn't say why, so its sentence stays even when later events would push it out
    const sp = d.filter(x => x.special).at(-1), last = d.slice(-2)
    if (d.length) setSaid((sp && !last.includes(sp) ? [sp, d[d.length - 1]] : last).map(x => x.s))
    else if (game.stage === 'my_play') setSaid([])
  }, [game])
  const browsing = useRef(false) // undo/redo after the end is the player studying the game, so the result stays dismissed
  useEffect(() => { if (game?.stage !== 'over' && !browsing.current) { setOverSeen(false); setResultViewed(false) } browsing.current = false }, [game?.stage])

  useEffect(() => {
    const s: Saved = { mode, secret, screen, my16, deckIds, slotIds, help, pre, game, history: history.slice(-60) }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* storage full: ignore */ }
  }, [mode, secret, screen, my16, deckIds, slotIds, help, pre, game, history])

  // on screen, informational steps advance by themselves, slowly enough to follow what happens; not recorded for undo
  useEffect(() => {
    if (mode !== 'play' || screen !== 'play' || !game || tip || !AUTO_STAGES.includes(game.stage)) return
    const t = setTimeout(() => advance(settle(next(game))), autoDelay(game.lines.length))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, screen, game, tip])

  const mine = my16.map(byId).sort((a, b) => b.rank - a.rank || a.suit - b.suit)
  const deck = mine.filter(c => deckIds.includes(c.id))

  const reset = () => {
    setTip(null)
    setScreen('title'); setMy16([]); setDeckIds([]); setSlotIds([]); setPre(null); setGame(null); setHistory([]); setFuture([]); setSel(null); setMode('guide'); setSecret({})
  }
  const settle = (g: GuideState) => (mode === 'play' ? autoReveal(g, secret) : g)
  const commit = (g: GuideState) => { setHistory(h => [...h, game!]); setFuture([]); advance(settle(g)); setSel(null); setBad(null) }
  const undo = () => { if (!history.length || !game) return; browsing.current = true; setFuture(f => [...f, game]); setGame(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setSel(null); setBad(null) }
  const redo = () => { if (!future.length || !game) return; browsing.current = true; setHistory(h => [...h, game]); setGame(future[future.length - 1]); setFuture(f => f.slice(0, -1)); setSel(null); setBad(null) }

  const pickDeck = (ids: string[]) => {
    setDeckIds(ids)
    const r = mine.filter(c => !ids.includes(c.id))
    setSlotIds(ids.length === 8 ? autoTowers(r).map(c => c.id) : [])
    setSwapFrom(null)
  }
  const toggleDeck = (c: Card) => {
    const has = deckIds.includes(c.id)
    sfx(has ? 'unpick' : deckIds.length < 8 ? 'pick' : 'deny')
    pickDeck(has ? deckIds.filter(x => x !== c.id) : deckIds.length < 8 ? [...deckIds, c.id] : deckIds)
  }
  const swapClick = (i: number) => {
    if (swapFrom === null) { sfx('pick'); return setSwapFrom(i) }
    if (swapFrom !== i) { sfx('place', 0, { mood: 'good' }); setSlotIds(s => { const x = [...s];[x[swapFrom], x[i]] = [x[i], x[swapFrom]]; return x }) }
    else sfx('unpick')
    setSwapFrom(null)
  }
  // on-screen play: deal both hands at random; the enemy's cards stay hidden inside the app (tid ep0-7 = pile, et0-7 = towers)
  const startOnScreen = () => {
    const d = deal()
    const enemy = shuffle(d.theirs)
    setSecret(Object.fromEntries(enemy.map((c, i) => [i < 8 ? `ep${i}` : `et${i - 8}`, c])))
    // start from the suggested deck so "Start the game" is one tap; the player can still change it
    const deck = suggestDeck(d.mine)
    setMode('play'); setMy16(d.mine.map(c => c.id)); setDeckIds(deck.map(c => c.id)); setSlotIds(autoTowers(d.mine.filter(c => !deck.includes(c))).map(c => c.id)); setScreen('draft')
  }
  // straight into the next game of the same kind, skipping the title screen
  const playAgain = () => {
    const m = mode
    reset()
    if (m === 'play') startOnScreen()
    else { setMode('guide'); setScreen('deal') }
  }
  const reshuffle = () => setPre(makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES))

  // the setup pages' top bar: where you are and one menu for everything else (in a game, the field's corners hold these)
  const bar = () => (
    <div className="topbar">
      <Logo small />
      <span className="modechip">{mode === 'play' ? 'On screen' : 'Real cards'}</span>
      <span className="spacer" />
      <GameMenu rules={RULES_60} muted={muted} toggleMute={toggleMute} onLeave={reset} />
    </div>
  )

  // ---------- title ----------
  if (screen === 'title') {
    const fan = ['1-0', '13-1', '12-2'].map(byId)
    return (
      <div className="title">
        <div className="titlefan" aria-hidden>{fan.map(c => <CardView key={c.id} card={c} />)}</div>
        <Logo />
        <p className="tagline">A lane battle for one player and a deck of cards</p>
        <div className="menu">
          <button className="big xl" onClick={startOnScreen}>Play<small>the app deals and plays the enemy</small></button>
          <button className="xl" onClick={() => { setMode('guide'); setScreen('deal') }}>Play with real cards<small>you play at the table, the app guides you</small></button>
          <RulesSheet rules={RULES_60}><Button variant="success" size="xl">How to play</Button></RulesSheet>
        </div>
      </div>
    )
  }

  // ---------- setup screens ----------
  if (screen === 'deal') {
    const sample = ['13-1', '7-0', '1-2', '10-3', '4-1'].map(byId)
    const steps: SetupStep[] = [
      { title: 'Shuffle a deck', pic: <div className="mstack">{backs(6)}</div>,
        body: <p>Take a standard 52-card deck, <b>no jokers</b>, and <b>shuffle it well</b>.</p> },
      { title: 'Deal 16 cards each', pic: <div className="mcols"><div><div className="mfan">{sample.map(c => <Mc key={c.id} card={c} />)}<span className="more">+11</span></div><span className="mlbl">You: 16, face-up in your hand</span></div><div><div className="mstack">{backs(6)}</div><span className="mlbl">Enemy: 16, face-down</span></div></div>,
        body: <p>Deal <b>16 cards to yourself</b> and look at them. Deal <b>16 face-down to the enemy</b> and don't look at them.</p> },
      { title: 'Lay out two elixir bars', pic: <div className="mbars"><span className="mlbl">Enemy elixir</span><div className="mrow">{backs(10, 5)}</div><span className="mlbl">Your elixir</span><div className="mrow">{backs(10, 5)}</div></div>,
        body: <p>Deal <b>10 face-down in a row</b> for your elixir bar and <b>10</b> for the enemy's, with a small gap after the 5th card. That uses all 52 cards.</p> },
      { title: 'Set the markers at 5', pic: <div className="mbars"><span className="mlbl">Enemy elixir: 5</span><div className="mrow">{backs(10, 5, 4)}</div><span className="mlbl">Your elixir: 5</span><div className="mrow">{backs(10, 5, 4)}</div></div>,
        body: <>
          <p>In each bar, turn the <b>5th card sideways</b>, still face-down. That's the <b>marker</b>: its position is the elixir, so both start at 5. Spending or gaining just moves the marker left or right.</p>
          <details className="help"><summary>The rules in 60 seconds</summary>{RULES_60}</details>
        </> },
    ]
    return (
      <div className="page">{bar()}
        <h1>1. Deal the cards</h1>
        <Stepper steps={steps} at={setupStep} setAt={setSetupStep} done={<button className="big" onClick={() => setScreen('enter')}>Done — I have my 16 cards</button>} />
      </div>
    )
  }

  if (screen === 'enter') {
    const set = new Set(my16)
    return (
      <div className="page">{bar()}
        <h1>2. Tell me your 16 cards</h1>
        <p className="help">Tap each card you were dealt. <b>{my16.length}/16</b> selected. Tap again to deselect.</p>
        <CardPicker disabled={new Set()} selected={set} onPick={c => setMy16(a => a.includes(c.id) ? a.filter(x => x !== c.id) : a.length < 16 ? [...a, c.id] : a)} />
        <div className="row">
          <button className="big" disabled={my16.length !== 16} onClick={() => { pickDeck(suggestDeck(mine).map(c => c.id)); setScreen('draft') }}>Next: build my deck</button>
          <button onClick={() => setMy16([])}>Clear</button>
        </div>
      </div>
    )
  }

  if (screen === 'draft') {
    const avg = deck.length ? (deck.reduce((a, c) => a + cost(c.rank), 0) / deck.length).toFixed(1) : '–'
    const heavy = deck.filter(c => cost(c.rank) >= 7).length
    const cheap = deck.filter(c => cost(c.rank) <= 3).length
    const slotName = ['Left (top)', 'Left 2', 'Left 3', 'Right (top)', 'Right 2', 'Right 3', 'King (top)', 'King 2']
    return (
      <div className="page">{bar()}
        <h1>{mode === 'play' ? 'Your 16 cards: build your deck' : '3. Build your deck'}</h1>
        <p className="help">Pick <b>8 cards to play with</b>; the other 8 become your <b>towers</b>. A good deck is already picked for you: start now, or tap cards to change it.</p>
        <details className="help">
          <summary>How to build a good deck</summary>
          <b>First: what a card is.</b> Cards have <u>no special abilities</u>. A card is just a soldier with one number, its <b>rank</b> (2 … 10, J=11, Q=12, K=13, A=1). Higher rank wins fights. The only extra rules:
          <ul>
            <li><b>Cost:</b> stronger cards cost more elixir to play (the purple number: 2→2, 6→5, 10→8, K→10).</li>
            <li><b>Suit wheel:</b> ♠ beats ♥, ♥ beats ♦, ♦ beats ♣, ♣ beats ♠ — a card of the winning suit counts double in that fight (a 6♠ fights a J♥ as 12).</li>
            <li><b>Aces beat picture cards:</b> an ace wins any fight against a J, Q or K, whatever the suits. Only in fights, not against towers.</li>
            <li><b>Towers:</b> a card in a tower is armor; a soldier must have rank ≥ the tower's top card to break it; a failed hit cracks the top card (turn it sideways, move it to the bottom of that tower), and any later hit breaks a cracked card.</li>
          </ul>
          <b>How to build your deck, step by step:</b>
          <ol>
            <li>You have 16 cards. Choose <b>8 as your deck</b> (soldiers you play). The other 8 automatically become your towers.</li>
            <li>It's a trade-off: <b>strong cards are great soldiers but cost a lot</b>. Your elixir is only 3 per round, so a deck of all kings can barely play anything.</li>
            <li>Good recipe (from thousands of simulated games): <b>a mix</b>, for example 2–5 heavy cards (cost 7+) to win fights and break towers plus <b>cheap cards</b> (cost 1–3). All-cheap and all-heavy decks are only a little behind: aces kill picture cards for 1 elixir, and the wheel lets a mid card beat a big one. Watch out: an enemy ace can kill your king. Try "Suggest a deck" for an example, then change it.</li>
            <li>Don't put <i>all</i> your best cards in the deck — the cards you leave out are your tower armor. Also try to have a mix of suits so the wheel helps you.</li>
          </ol>
        </details>
        <div className="row">
          <button onClick={() => pickDeck(suggestDeck(mine).map(c => c.id))}>Suggest a deck</button>
          <button onClick={() => pickDeck([])}>Clear</button>
        </div>
        {/* the deck as 8 slots on top, the other cards below: tapping moves a card between them */}
        <div className="deckbox">
          <div className="deckhead"><b>Your deck</b> <span className="muted">{deck.length}/8 · tap a card to take it out</span>
            <div className="avgcost" title="Average elixir cost of your deck"><span className="edrop">{avg}</span><span className="avgbar"><i style={{ transform: `translateX(${deck.length ? Number(avg) * 10 - 100 : -100}%)` }} /></span><span className="avglbl">{!deck.length ? '' : Number(avg) < 3.5 ? 'fast' : Number(avg) <= 5.5 ? 'balanced' : 'heavy'}</span></div>
          </div>
          <div className="deckslots">
            {Array.from({ length: 8 }, (_, i) => deck[i]
              ? <motion.div key={deck[i].id} layoutId={`pick-${deck[i].id}`} className="dslot"><CardView card={deck[i]} showCost onClick={() => toggleDeck(deck[i])} /></motion.div>
              : <div key={`empty${i}`} className="dslot empty" />)}
          </div>
        </div>
        {deck.length === 8 && slotIds.length === 8
          ? <>
            <h3 className="towerhead">Your towers <small>the other 8 cards are their armor · tap two to swap them; the top card is hit first</small></h3>
            <div className="towerrow">
              {[[0, 1, 2], [3, 4, 5], [6, 7]].map((idxs, gi) => (
                <div key={gi} className="tgroup"><div className="tname">{['Left tower', 'Right tower', 'King tower'][gi]}</div>
                  <div className="row">{idxs.map(i => <motion.div key={slotIds[i]} layoutId={`pick-${slotIds[i]}`} className="slotpick"><CardView card={byId(slotIds[i])} selected={swapFrom === i} onClick={() => swapClick(i)} /><div className="picktag">{slotName[i]}</div></motion.div>)}</div>
                </div>
              ))}
            </div>
          </>
          : <>
            <h3 className="towerhead">Other cards <small>tap one to put it in your deck; the ones left out become your towers</small></h3>
            <div className="pickgrid">
              {mine.filter(c => !deckIds.includes(c.id)).map(c => (
                <motion.div key={c.id} layoutId={`pick-${c.id}`} className="pick"><CardView card={c} showCost onClick={() => toggleDeck(c)} /></motion.div>
              ))}
            </div>
          </>}
        {/* stays at the bottom of the window while scrolling, so starting never needs a scroll */}
        <div className="draftbar">
          <div className="summary">
            Deck {deck.length}/8 · average cost <b>{avg}</b> · heavy (7+): <b>{heavy}</b> · cheap (1–3): <b>{cheap}</b>
            {deck.length === 8 && heavy === 0 && <span className="warn"> — all-cheap decks work (aces beat picture cards, and the wheel doubles your cards), but tests won a bit more with 2–5 heavy cards.</span>}
          </div>
          {deck.length !== 8 || slotIds.length !== 8
            ? <button className="big" disabled>Pick {8 - deck.length} more card{8 - deck.length === 1 ? '' : 's'}</button>
            : mode === 'play'
              ? <button className="big" onClick={() => { advance(settle(startRound(makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES)))); setHistory([]); setScreen('play') }}>Start the game</button>
              : <button className="big" onClick={() => { reshuffle(); setScreen('table') }}>Next: set up the table</button>}
        </div>
      </div>
    )
  }

  if (screen === 'table') {
    const g = pre ?? makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES)
    const stack = (name: string, cards: Card[]) => <div className="mtower"><div className="mrow">{cards.map((c, i) => <Mc key={c.id} card={c} hot={i === 0} />)}</div><span className="mlbl">{name}</span></div>
    const eStack = (name: string, n: number) => <div className="mtower"><div className="mrow">{backs(n)}</div><span className="mlbl">{name}</span></div>
    const steps: SetupStep[] = [
      { title: 'Build your three towers', pic: <div className="mcols">{stack('Left', g.P.towers.L)}{stack('King', g.P.towers.K)}{stack('Right', g.P.towers.R)}</div>,
        body: <p>Make three stacks <b>face-up</b> in a row in front of you, the <b>top card first</b> (gold above): <b>Left</b> {g.P.towers.L.map(label).join(' · ')}, <b>King</b> {g.P.towers.K.map(label).join(' · ')} in the middle, <b>Right</b> {g.P.towers.R.map(label).join(' · ')}. Fan each stack so you can see every card.</p> },
      { title: 'Your hand and your queue', pic: <div className="mbars"><span className="mlbl">Hand, face-up</span><div className="row">{g.P.hand.map(c => <CardView key={c.id} card={c} showCost />)}</div><span className="mlbl">Queue, face-down, top card first</span><div className="mrow">{g.P.queue.map(c => <Mc key={c.id} card={c} />)}</div></div>,
        body: <>
          <p>I shuffled your 8 deck cards. Take the <b>4 hand cards</b> into your hand and stack the other <b>4 face-down</b> as your queue, in this order, top card first.</p>
          <button onClick={reshuffle}>Shuffle again</button>
        </> },
      { title: "The enemy's side", pic: <div className="mcols"><div className="mtower"><div className="mstack">{backs(6)}</div><span className="mlbl">Pile: 8</span></div>{eStack('Left', 3)}{eStack('King', 2)}{eStack('Right', 3)}</div>,
        body: <p>Shuffle the enemy's 16 cards <b>without looking</b>. Put <b>8</b> face-down as its <b>pile</b>. With the other 8, make its towers across the table, all <b>face-down</b>: <b>Left 3</b>, <b>King 2</b>, <b>Right 3</b>.</p> },
      { title: 'The table', pic: (
          <div className="mtable">
            <span className="mt-bar">Enemy elixir bar</span>
            <span>Enemy pile</span><span className="mt-them">Enemy Left</span><span className="mt-them">Enemy King</span><span className="mt-them">Enemy Right</span><span>Enemy discard</span>
            <span className="mt-lane l">Left lane<br />2 slots</span><span className="mt-lane r">Right lane<br />2 slots</span>
            <span>Your queue</span><span className="mt-me">Your Left</span><span className="mt-me">Your King</span><span className="mt-me">Your Right</span><span>Your discard</span>
            <span className="mt-bar">Your elixir bar</span>
          </div>),
        body: <p>Your towers in a row in front of you, the enemy's across the table. Between them, <b>two lanes of 2 slots</b>: slot 1 next to you, slot 2 next to the enemy. The screen shows the table the same way, the enemy at the top.</p> },
    ]
    return (
      <div className="page">{bar()}
        <h1>4. Set up the table</h1>
        <Stepper steps={steps} at={setupStep} setAt={setSetupStep} done={<button className="big" onClick={() => { advance(startRound(g)); setHistory([]); setPre(null); setScreen('play') }}>Start the game</button>} />
      </div>
    )
  }

  // ---------- play: the same arena on screen and with real cards ----------
  const g = game!
  const stage = g.stage
  const advice = help !== 'suggest' ? null : stage === 'my_play' ? advise(g) : stage === 'my_last_stand' ? adviseLastStand(g) : null
  const hitEnemy = stage === 'tower_enter'
  const flipping = stage === 'enemy_enter' || stage === 'last_stand_enter' || hitEnemy
  const standing = stage === 'my_last_stand'
  const previewCard = standing ? undefined : g.P.hand[drag ?? sel ?? bad ?? hov ?? -1]
  const badCard = bad !== null ? g.P.hand[bad] : undefined
  const note = badCard && !standing ? `${label(badCard)} costs ${cost(badCard.rank)} elixir but you only have ${g.P.elixir}. Pick a card whose purple number is ${g.P.elixir} or less.` : null
  const spend = previewCard ? cost(previewCard.rank) : 0
  const side = stage === 'my_play' || standing ? 'me' : stage.startsWith('enemy_') || stage === 'last_stand_enter' ? 'enemy' : null
  // with real cards, every step that moves cards on the table waits on a panel over the tray until the player taps Done;
  // after one of your own plays that is paying, placing and drawing, then the hand is free again
  const doNow = mode === 'guide' && stage === 'my_play' && g.lastAction.length > 0 && doSeen !== g.log.length
  const atTable = mode === 'guide' && (doNow || flipping || AUTO_STAGES.includes(stage))
  const stepTitle = doNow ? 'Now at the table' : stage === 'round_start' ? `Round ${g.round}` : g.events?.some(e => e.type === 'play' && e.free) ? 'Last stand' : TITLES[stage]
  // the card to turn face-up glows on the field: the enemy's next card, or the top of the tower being hit
  const hitUnit = hitEnemy ? g.units.find(u => u.uid === g.hitQueue[0]) : undefined
  const flipTower = hitUnit ? (g.E.towers[hitUnit.lane === 0 ? 'L' : 'R'].length ? (hitUnit.lane === 0 ? 'L' : 'R') : 'K') : null
  const mineSlots = (k: 'L' | 'R' | 'K'): ESlot[] => g.P.towers[k].map(c => ({ tid: c.id, card: c }))
  // pointer-based drag: one code path for mouse, touch and pen (HTML5 drag-and-drop never fires on touch screens)
  const startDrag = (e: React.PointerEvent<HTMLElement>, i: number) => {
    if ((!standing && !canPlay(g, i)) || (e.pointerType === 'mouse' && e.button !== 0)) return
    const el = e.currentTarget, x0 = e.clientX, y0 = e.clientY
    let ghost: ReturnType<typeof makeGhost> = null, lane: 0 | 1 | null = null
    const laneAt = (x: number, y: number) => {
      const t = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('.droppable[data-lane]') as HTMLElement | null
      return t?.dataset.lane === undefined ? null : (Number(t.dataset.lane) as 0 | 1)
    }
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return
        ghost = makeGhost(el, x0, y0); setBad(null); setSel(null); setDrag(i); sfx('pick')
      }
      ev.preventDefault()
      ghost?.move(ev.clientX, ev.clientY)
      const l = laneAt(ev.clientX, ev.clientY)
      if (l !== lane) { lane = l; setOverLane(l); if (l !== null) sfx('hover') }
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end)
      if (!ghost) return
      setOverLane(null)
      justDragged.current = true; setTimeout(() => { justDragged.current = false }, 0)
      const l = ev.type === 'pointerup' ? laneAt(ev.clientX, ev.clientY) : null
      if (l === null) { sfx('unpick'); ghost.glideBack(() => setDrag(null)); return }
      ghost.remove(); setDrag(null)
      commit(standing ? lastStandPlay(g, i) : playCard(g, i, l))
    }
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
  }

  const tapHand = (i: number) => {
    if (justDragged.current) return
    if (standing) return commit(lastStandPlay(g, i))
    const off = sel === i || bad === i
    sfx(off ? 'unpick' : canPlay(g, i) ? 'pick' : 'deny')
    if (off) setHov(null)
    setSel(!off && canPlay(g, i) ? i : null); setBad(!off && !canPlay(g, i) ? i : null)
  }
  // the suggestion is shown on the board itself: the card and its lane glow, or the ✓ button does
  const suggested = advice?.kind === 'play' ? advice : null
  const handCards = g.P.hand.map((c, i) => (
    <div key={c.id} data-i={i} className={`hdrag ${drag === i ? 'lifted' : ''} ${!standing && !canPlay(g, i) ? 'off' : ''} ${suggested?.handIndex === i && drag === null ? 'suggested' : ''}`} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onPointerDown={e => startDrag(e, i)}>
      <TCard tid={c.id} card={c} down={false} showCost selected={sel === i} dim={!standing && !canPlay(g, i)} onClick={() => tapHand(i)} />
    </div>
  ))
  // the Hints page of the menu: two switches, then only what they say about this turn
  const hints = (close: () => void) => (
    <>
      <Choice id="explain" title="Explain my options" description="List every card you can play and where" checked={explainOn} onChange={setExplainOn} />
      <Choice id="suggest" title="Suggest moves" description="The suggested card and lane glow green, or the ✓ button does" checked={suggestOn} onChange={setSuggestOn} />
      <div className="mt-2 font-heading text-sm tracking-widest text-muted-foreground uppercase">This turn</div>
      {stage !== 'my_play' ? <p className="m-0 text-muted-foreground">Hints show here on your turn.</p>
        : help === 'off' && <p className="m-0 text-muted-foreground">Turn on a switch above and its hint shows here.</p>}
      {advice && (
        <Alert className="border-(--gold-d) bg-black/25 px-3 py-2.5 text-base">
          <Lightbulb className="text-primary" />
          <AlertTitle className="font-heading text-lg font-normal tracking-wide">
            {advice.kind === 'play' ? <>Play <CardText text={label(g.P.hand[advice.handIndex])} /> in the {advice.lane === 0 ? 'left' : 'right'} lane</> : 'End your turn'}
          </AlertTitle>
          <AlertDescription className="text-base text-foreground/90">
            <p className="m-0"><CardText text={advice.reason} /></p>
            <p className="m-0 mt-1 text-sm text-muted-foreground">It looks one round ahead at what's on the table; it can't see the enemy's face-down cards.</p>
          </AlertDescription>
        </Alert>
      )}
      {explainOn && stage === 'my_play' && (
        <ul className="m-0 list-none rounded-xl border bg-black/25 px-3 py-1">
          {options(g).map((o, i) => { const [card, ...rest] = o.split(': '); return (
            <li key={i} className={`flex items-start gap-2.5 border-t border-white/10 py-2 leading-snug first:border-t-0 ${o.includes("can't afford") ? 'opacity-50' : ''}`}><span className="w-11 shrink-0"><CardText text={card} /></span><span>{rest.join(': ')}</span></li>
          ) })}
        </ul>
      )}
      {help !== 'off' && g.why.length > 0 && <p className="m-0 text-sm text-muted-foreground"><b className="text-foreground">Why:</b> <CardText text={g.why.join(' ')} /></p>}
      <Button variant="link" className="mt-2 self-center text-base text-muted-foreground" onClick={() => { setTipsSeen([]); writeJSON(TIPS_KEY, []); close() }}>Show the first-game tips again</Button>
    </>
  )
  const overlays = (
    <>
      <FxLayer pops={pops} />
      {stage === 'over' && !overSeen && (
        <div className="modal-backdrop">
          <div className={`gameover ${g.winner === 'P' ? 'won' : g.winner === 'E' ? 'lost' : 'drawn'}`}>
            {g.winner === 'P' && !resultViewed && <WinConfetti />}
            <h2>{g.winner === 'P' ? 'You win!' : g.winner === 'E' ? 'You lose' : 'Draw'}</h2>
            <p>{g.lines[0]}</p>
            <ul className="todo">{summary(g).map((l, i) => <li key={i}>{l}</li>)}</ul>
            <div className="row">
              <button className="big" onClick={playAgain}>Play again</button>
              <button onClick={() => { setResultViewed(true); setOverSeen(true) }}>View board</button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // one tip at a time, pointing down at the tray (or at the table panel over it)
  const coach = tip && (
    <div className="coach" role="dialog" aria-label="Tip">
      <p>{(mode === 'guide' && TABLE_TIPS[tip]) || TIPS[tip]}</p>
      <div className="row">
        <button className="big" onClick={() => seeTip([tip])}>Got it</button>
        <button className="linkish" onClick={() => seeTip(Object.keys(TIPS) as TipId[])}>Skip all tips</button>
      </div>
    </div>
  )
  // with real cards: what to do on the table now, over the tray (the hand is idle on these steps); the field above stays in view
  const tableStep = atTable && (
    <div className="tablestep">
      {coach}
      <div className="tsbody" key={history.length}>
        <div className="tshead">
          <h3>{stepTitle}</h3>
          {!flipping && <button className="big" title="Done at the table" onClick={doNow ? () => setDoSeen(g.log.length) : () => commit(next(g))}>Done
            <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 6.5" /></svg></button>}
        </div>
        <ul className="tslist">{(doNow ? g.lastAction : g.lines).map((l, i) => <li key={i}><Said text={l} /></li>)}</ul>
        {help !== 'off' && !doNow && g.why.length > 0 && <p className="tswhy"><b>Why:</b> <CardText text={g.why.join(' ')} /></p>}
        {flipping && <FlipPicker known={excludedIds(g)} onPick={c => commit(hitEnemy ? enterTowerCard(g, c) : enterEnemyCard(g, c))} />}
      </div>
    </div>
  )

  // the arena; card size follows the window so the whole field, the bar and the hand always fit
  const arena = () => {
    const aw = Math.min(view.sw, 640)
    // with real cards every card is the same size, as on the table: five card columns across (pile, three tower fans, discard) and six card rows down.
    // A wide window puts the instructions and the hand in a column beside the table; otherwise they get a fixed space under it.
    const wide = mode === 'guide' && view.sw >= 860 && view.sw >= view.sh * 1.3
    const ch = mode === 'guide'
      ? wide
        ? Math.max(44, Math.min((view.sh - 160) / 6.9, (Math.min(view.sw - 420, 760) - 60) / 7.4 / 0.714, 128))
        : Math.max(44, Math.min((view.sh - 300) / 7.84, (aw - 60) / 7.4 / 0.714, 128))
      : Math.max(52, Math.min((view.sh - 196) / 6.9, (aw - 72) / 4.75 / 0.714, 128))
    const vars = { '--cw': `${ch * 0.714}px`, '--ch': `${ch}px` } as CSSProperties
    const prompt = stage === 'my_play' ? 'Your turn: drag a card onto a lane, then tap ✓.' : standing ? TITLES[stage] : stage === 'round_start' ? `Round ${g.round}: you get ${g.rules.regen} more elixir.` : 'Enemy turn…'
    const lines = note ? [note] : said.length ? said : [prompt]
    // the suggested lane glows only while no other card is picked up; tapping it with nothing picked plays the suggestion
    const lane = (l: 0 | 1) => ({
      dragging: drag !== null && (!standing || g.lastStand?.lane === l), hint: standing ? g.lastStand?.lane === l : sel !== null,
      suggested: suggested?.lane === l && (drag ?? sel ?? suggested.handIndex) === suggested.handIndex,
      over: overLane === l, onPlace: () => { if (standing) return; const i = sel ?? suggested?.handIndex; if (i !== undefined) commit(playCard(g, i, l)) },
    })
    const eNext = g.E.queue[0]
    const undoRedo = <>
      <Button variant="secondary" size="icon-lg" aria-label="Undo" title="Undo" onClick={undo} disabled={!history.length}><Undo2 /></Button>
      <Button variant="secondary" size="icon-lg" aria-label="Redo" title="Redo" onClick={redo} disabled={!future.length}><Redo2 /></Button>
    </>
    const menu = <GameMenu rules={RULES_60} muted={muted} toggleMute={toggleMute} onLeave={reset} log={g.log} hints={hints} />
    const rules = <>
      <div className="round">Round {g.round}</div>
      <div className="rule" title="Aces beat picture cards in a fight, whatever the suits"><b>A</b> beats <b>J Q K</b></div>
      <div className="rule wheelmini" title="Each suit beats the next one; the winning suit counts double">{['♠', '♥', '♦', '♣', '♠'].map((x, k) => <Fragment key={k}>{k > 0 && <em>›</em>}<i className={x === '♥' || x === '♦' ? 'r' : ''}>{x}</i></Fragment>)}<span>×2</span></div>
    </>
    const discard = (owner: 'P' | 'E') => {
      const d = g.discard.filter(x => x.owner === owner)
      return <TablePile top={d.at(-1)} down={false} n={d.length} name="Discard" discard />
    }
    // with real cards the screen is the table as you sit at it: every card where it lies, all the same size
    const table = (
      <>
        <div className="tbar"><span className="undoredo">{undoRedo}</span><span className="modechip">Real cards</span><span className="tmenu">{menu}</span></div>
        <div className={`cardtable ${shake}`}>
          <CardBar n={g.E.elixir} who="Enemy" />
          <div className="trow theirs">
            <TablePile top={eNext} down={!eNext?.card} n={g.E.queue.length} name="Pile" flip={stage === 'enemy_enter' || stage === 'last_stand_enter'} />
            {(['L', 'K', 'R'] as const).map(k => <TowerFan key={k} k={k} items={g.E.towers[k]} own={false} cracked={g.cracked ?? []} flip={flipTower === k} />)}
            {discard('E')}
          </div>
          <div className="lanes">
            <span />
            <ArenaLane idx={0} units={g.units} laneLen={g.rules.laneLen} {...lane(0)} />
            <div className="mid">{rules}</div>
            <ArenaLane idx={1} units={g.units} laneLen={g.rules.laneLen} {...lane(1)} />
            <span />
          </div>
          <div className="trow mine">
            <TablePile top={g.P.queue[0] && { tid: g.P.queue[0].id, card: g.P.queue[0] }} down n={g.P.queue.length} name="Queue" />
            {(['L', 'K', 'R'] as const).map(k => <TowerFan key={k} k={k} items={mineSlots(k)} own cracked={g.cracked ?? []} />)}
            {discard('P')}
          </div>
          <CardBar n={g.P.elixir} spend={spend} who="Your" />
        </div>
      </>
    )
    const field = (
      <div className={`field ${shake}`}>
        <span className="undoredo corner left">{undoRedo}</span>
        <span className="corner right">{menu}</span>
        <div className="castles theirs">
          {(['L', 'K', 'R'] as const).map(k => <Castle key={k} k={k} items={g.E.towers[k]} own={false} cracked={g.cracked ?? []} />)}
        </div>
        <div className="lanes">
          <ArenaLane idx={0} units={g.units} laneLen={g.rules.laneLen} {...lane(0)} />
          <div className="mid">
            <div className="sidechip enemy" title="Enemy elixir and the next card of its pile (face-down until you have seen it)">
              <span className="edrop">{g.E.elixir}</span>
              {eNext && <div className="nextcard"><TCard key={eNext.tid} tid={eNext.tid} card={eNext.card} down={!eNext.card} showCost /></div>}
            </div>
            {rules}
          </div>
          <ArenaLane idx={1} units={g.units} laneLen={g.rules.laneLen} {...lane(1)} />
        </div>
        <div className="castles mine">
          {(['L', 'K', 'R'] as const).map(k => <Castle key={k} k={k} items={mineSlots(k)} own cracked={g.cracked ?? []} />)}
        </div>
      </div>
    )
    return (
      <div ref={playRef} className={`arena${mode === 'guide' ? ' guide' : ''}${wide ? ' wide' : ''}${side ? ' turn-' + side : ''}`} style={vars}>
        {mode === 'guide' ? table : field}
        <div className="tray">
          {stage === 'over' && overSeen
            ? <div className="overbtns"><button className="big" onClick={playAgain}>Play again</button><button onClick={() => setOverSeen(false)}>Result</button></div>
            : <div className={`feed ${note ? 'warn' : ''}`} aria-live="polite">
              {lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>}
          {mode === 'play' && <div className="elixrow"><ElixirBar n={g.P.elixir} spend={spend} /></div>}
          <div className="handrow">
            {mode === 'play' && <div className="nextcard mine" title="Your next card: it comes into your hand when you play one"><span>Next</span>{g.P.queue[0] && <TCard key={g.P.queue[0].id} tid={g.P.queue[0].id} card={g.P.queue[0]} down={false} showCost />}</div>}
            {handCards}
            <div className="nextcard mine endwrap"><span>Done</span>
              <button className={`big done endturn ${advice?.kind === 'wait' ? 'suggested' : ''}`} title={advice?.kind === 'wait' ? advice.reason : 'End turn'} disabled={stage !== 'my_play'} aria-label="End turn" onClick={() => commit(endMyTurn(g))}><svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 6.5" /></svg></button>
            </div>
          </div>
          {tableStep || coach}
        </div>
        {overlays}
      </div>
    )
  }

  return arena()
}

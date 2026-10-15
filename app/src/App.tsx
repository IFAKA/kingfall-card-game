import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import confetti from 'canvas-confetti'
import { DECK_SIZE, DEFAULT_RULES, PER_SIDE, RANKS, SUITS, aceWins, cost, deal, effective, freshDeck, isRed, label, randomSetup, shuffle, suggestSetup } from './engine'
import type { Card, Unit } from './engine'
import {
  advise, adviseLastStand, autoReveal, canPlay, describe, endMyTurn, extendBatch, fightingNext, enterEnemyCard, enterTowerCard, excludedIds, lastStandPlay, makeGame, next, options, playCard, startRound, summary, switchCards, takeBack,
} from './guide'
import type { ESlot, GuideState } from './guide'
import { quick, useFx } from './fx'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import type { Pop } from './fx'
import { isMuted, setMuted, sfx } from './sfx'
import { FastForward, Lightbulb, ListChecks, Redo2, Swords, Undo2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CardText, Choice, GameMenu, InstallLink, RulesSheet } from './Menu'
import { CastleArt, PlayingCard, TCard } from './Pieces'
import { useViewport } from '@/hooks/use-viewport'
import DeckBuilder from './DeckBuilder'
import { tutorialCards, tutorialSecret } from './tutorial'

type Help = 'off' | 'explain' | 'suggest'
type Screen = 'title' | 'deal' | 'enter' | 'draft' | 'table' | 'play'
interface Saved { mode?: 'guide' | 'play'; secret?: Record<string, Card>; screen: Screen; dealt: string[]; deckIds: string[]; slotIds: string[]; help: Help; pre: GuideState | null; game: GuideState | null; history: GuideState[]; intro?: Intro | null; counted?: boolean }

const ALL = freshDeck()
const byId = (id: string) => ALL.find(c => c.id === id)!
export const STORAGE_KEY = 'solo-clash-guide-v9' // bump when the rules change, so old saved games don't load into new rules

function load(): Saved | null {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? (JSON.parse(s) as Saved) : null } catch { return null }
}

// ---------- small components ----------
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
  // a drop that landed: put the real card where the ghost is, so its move to the slot (or back to the hand) starts from the drop point,
  // not from where it was picked up; it is moved for that one measurement only
  const land = (seconds: number) => {
    const g = ghost.getBoundingClientRect(), r = card.getBoundingClientRect()
    quick(card.dataset.tid, seconds)
    Object.assign(el.style, { transform: `translate(${g.left + g.width / 2 - r.left - r.width / 2}px, ${g.top + g.height / 2 - r.top - r.height / 2}px)`, opacity: '1' })
    ghost.remove()
    setTimeout(() => Object.assign(el.style, { transform: '', opacity: '' }), 0)
  }
  return { move, remove: () => ghost.remove(), glideBack, land }
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

// Pop-ups from the latest step (see fx.ts), drawn over the board.
function FxLayer({ pops }: { pops: Pop[] }) {
  return (
    <div className="fxlayer" aria-hidden>
      {pops.map(p => <PopView key={p.id} p={p} />)}
    </div>
  )
}

// A pop-up fits inside the board, whole for all of its animation (it grows to 125% and floats up): too wide shrinks it, near an edge slides it in.
function PopView({ p }: { p: Pop }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ x: number; y: number; size?: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current, layer = el?.parentElement
    if (!el || !layer) return
    const pad = 6, W = layer.clientWidth, H = layer.clientHeight
    const k = Math.min(1, (W - 2 * pad) / (el.offsetWidth * 1.25))
    const w = el.offsetWidth * k * 1.25, h = el.offsetHeight * k
    const clamp = (v: number, lo: number, hi: number) => lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi)
    setFit({
      x: clamp(p.x, w / 2 + pad, W - w / 2 - pad),
      y: clamp(p.y, h * 0.85 + pad, H - h * 0.625 - pad),
      size: k < 1 ? parseFloat(getComputedStyle(el).fontSize) * k : undefined,
    })
  }, [p])
  return (
    <div ref={ref} className={`pop ${p.kind}`} style={{ left: fit?.x ?? p.x, top: fit?.y ?? p.y, fontSize: fit?.size, animationDuration: `${p.ms}ms`, visibility: fit ? undefined : 'hidden' }}>
      {p.text}{p.sub && <small>{p.sub}</small>}
    </div>
  )
}

// ---------- the arena (on-screen play): upright like Clash, enemy on top, you at the bottom ----------
const STACK_NAME = { L: 'Left', R: 'Right', K: 'King' } as const

// What just happened to a tower's top card: turned face-up, or hit (it breaks and falls to the discard, or cracks and goes under).
type TowerFx = 'reveal' | 'break' | 'crack' | undefined
const CHIP: Variants = {
  enter: (fx: TowerFx) => ({ rotateY: 90, scale: fx === 'reveal' ? 1.8 : 1 }),
  show: (fx: TowerFx) => ({ rotateY: 0, scale: 1, transition: { duration: fx === 'reveal' ? 0.5 : 0.3, ease: 'easeOut' } }),
  leave: (fx: TowerFx) => fx === 'break' ? { y: 34, rotate: 40, opacity: 0, transition: { duration: 0.7, delay: 0.2, ease: 'easeIn' } }
    : fx === 'crack' ? { rotate: 90, scale: 0.4, opacity: 0, transition: { duration: 0.5, delay: 0.2 } }
    : { opacity: 0, transition: { duration: 0 } },
}

// The numbers behind a fight between the card you hold and a card on the table: yours (blue chip) against theirs, the bigger one wins.
// A suit bonus doubles a number (an enemy card's rank is struck out and its doubled value written beside it); an ace beating a king reads ∞.
type Verdict = { mine: string; theirs: string; mineBonus: boolean; theirsBonus: boolean; rank: string }
type Verdicts = Record<string, Verdict>
function VerdictTag({ v, compact }: { v?: Verdict; compact?: boolean }) {
  if (!v) return null
  return (
    <>
      {v.theirsBonus && <span className="duel theirs bonus" title={`This card hits as ${v.theirs}`} aria-hidden>{!compact && <s>{v.rank}</s>}{v.theirs}</span>}
      <span className="duel mine" title={`Your card hits as ${v.mine}`} aria-hidden><Swords />{v.mine}</span>
    </>
  )
}

// A tower drawn as a castle: one armor pip per card left (a cracked card shows cracked), and the armor to beat on its top card when it is known (an empty slot until then).
function Castle({ k, items, own, cracked, fx, shake, verdicts }: { k: 'L' | 'R' | 'K'; items: ESlot[]; own: boolean; cracked: string[]; fx?: TowerFx; shake?: boolean; verdicts?: Verdicts }) {
  const top = items[0]
  const known = top?.card
  return (
    <div className={`castle ${own ? 'mine' : 'theirs'} ${k === 'K' ? 'king' : ''} ${items.length ? '' : 'fallen'} ${shake ? 'tremble' : ''}`} data-anchor={`tower-${own ? 'P' : 'E'}-${k}`}
      title={!items.length ? `${own ? 'Your' : 'Enemy'} ${STACK_NAME[k].toLowerCase()} tower has fallen` : `${own ? 'Your' : 'Enemy'} ${STACK_NAME[k].toLowerCase()} tower: ${items.length} card${items.length === 1 ? '' : 's'} of armor${known ? `; a soldier must win or tie a fight against its top card, ${label(known)}, to break it` : ''}`}>
      <CastleArt king={k === 'K'} fallen={!items.length} />
      <div className="armor"><AnimatePresence initial={false}>{items.map(it => <motion.i key={it.tid} layout className={cracked.includes(it.tid) ? 'crk' : ''}
        exit={{ scale: 0, opacity: 0, transition: { duration: 0.3, delay: 0.2 } }} />)}</AnimatePresence></div>
      <div className="tslot"><AnimatePresence initial={false} mode="popLayout" custom={fx}>{top
        ? <motion.div key={top.tid + (known ? '' : '?')} custom={fx} variants={CHIP} initial="enter" animate="show" exit="leave"
          className={`topcard ${known ? (isRed(known) ? 'red' : '') : 'empty'}`}>{known && <><span>{RANKS[known.rank]}</span><span>{SUITS[known.suit]}</span></>}</motion.div>
        : null}</AnimatePresence>{top && <VerdictTag v={verdicts?.[top.tid]} compact />}</div>
    </div>
  )
}

// With real cards, a tower is drawn as the cards on the table: a fan, top card (hit first) in front. Yours face-up, the enemy's face-down until flipped.
function TowerFan({ k, items, own, cracked, flip, shake, verdicts }: { k: 'L' | 'R' | 'K'; items: ESlot[]; own: boolean; cracked: string[]; flip?: boolean; shake?: boolean; verdicts?: Verdicts }) {
  const n = items.length
  return (
    <div className={`tfan ${own ? 'mine' : 'theirs'} ${k === 'K' ? 'king' : ''} ${n ? '' : 'fallen'} ${flip ? 'flipme' : ''} ${shake ? 'tremble' : ''}`} data-anchor={`tower-${own ? 'P' : 'E'}-${k}`}
      title={`${own ? 'Your' : 'Enemy'} ${STACK_NAME[k].toLowerCase()} tower: ${n} card${n === 1 ? '' : 's'}; the front card is hit first. A cracked card (sideways at the table) breaks on any hit.`}>
      <div className="fancards" style={{ width: `calc(var(--cw) + ${Math.max(0, n - 1)} * var(--toff))` }}>
        {items.map((it, i) => (
          <div key={it.tid} className={`fc ${cracked.includes(it.tid) ? 'cracked' : ''}`} style={{ left: `calc(${i} * var(--toff))`, zIndex: n - i }}>
            <TCard tid={it.tid} card={it.card} down={!it.card} side={own ? 'P' : 'E'} />
            {i === 0 && <VerdictTag v={verdicts?.[it.tid]} />}
          </div>
        ))}
      </div>
      <div className="cname">{n ? STACK_NAME[k] : `${STACK_NAME[k]} · fallen`}</div>
    </div>
  )
}

// With real cards, elixir is drawn like the bar on the table: 10 face-down cards in a row, overlapping so each number shows, the marker turned sideways.
// A card you pick frames the cards it would spend.
function CardBar({ n, spend = 0 }: { n: number; spend?: number }) {
  const [a, b] = spendRange(n, spend)
  return (
    <div className="cbar mine" role="meter" aria-valuemin={0} aria-valuemax={10} aria-valuenow={n} aria-label="Your elixir" title={`Your elixir bar: ${n ? `the sideways card is number ${n}` : 'no card sideways'}, so ${n} elixir`}>
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
function TablePile({ top, down, side, n, name, flip, discard, verdict }: { top?: ESlot; down: boolean; side?: 'P' | 'E'; n: number; name: string; flip?: boolean; discard?: boolean; verdict?: Verdict }) {
  return (
    <div className={`tpile ${flip ? 'flipme' : ''}`}>
      <div className="pcards">
        {Array.from({ length: Math.min(3, Math.max(0, n - 1)) }, (_, i) => <div key={i} className={`pback ${discard ? 'face' : ''}`} style={{ translate: `${(i + 1) * 2}px ${(i + 1) * 2}px` }} />)}
        {top && <TCard key={top.tid} tid={top.tid} card={top.card} down={down} side={side} />}
        {top && <VerdictTag v={verdict} />}
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
// A soldier at a tower is drawn smaller, against that tower; a wounded one (it broke a card, one hit left) leans like a cracked card.
// The two cards that fight next tremble a little, so you see who meets whom before one of them is gone.
// A card at a tower is drawn in the lane slot next to that tower, first in the slot: new cards in that lane
// fight it there. A wounded one (it broke a tower card, one hit left) leans like a cracked card.
// On screen, the cards you placed this turn (grabbable) can be dragged out of their slot again until you end your turn.
// Tapped, one of them is picked (picked): tapping another card then switches the two.
function ArenaLane({ idx, units, fighting, laneLen, verdicts, blocked, dragging, hint, suggested, over, onPlace, grabbable = [], lifted, picked, onGrab, onTap }: { idx: 0 | 1; units: Unit[]; fighting: string[]; laneLen: number; verdicts?: Verdicts; blocked?: boolean; dragging: boolean; hint: boolean; suggested: boolean; over: boolean; onPlace: () => void; grabbable?: string[]; lifted?: string | null; picked?: string | null; onGrab?: (e: React.PointerEvent<HTMLElement>, tid: string) => void; onTap?: (tid: string) => void }) {
  const atTower = (u: Unit) => (u.side === 'P' && u.pos >= laneLen) || (u.side === 'E' && u.pos < 0)
  const here = (pred: (u: Unit) => boolean) => units.filter(u => u.lane === idx && pred(u)).sort((a, b) => +atTower(b) - +atTower(a)).map(u => (
    <div key={u.uid} className={`unit ${u.side} ${atTower(u) ? 'atk' : ''} ${u.wounded ? 'wounded' : ''} ${u.free ? 'free' : ''} ${fighting.includes(u.tid!) ? 'tremble' : ''} ${grabbable.includes(u.tid!) ? 'grab' : ''} ${lifted === u.tid ? 'lifted' : ''}`}
      title={atTower(u) ? `${u.side === 'P' ? 'Your' : 'Enemy'} card at the tower: ${u.wounded ? 'wounded, it hits once more, then goes back to its pile' : 'it hits the tower this round'}` : u.free ? `${u.side === 'P' ? 'Your' : 'Enemy'} last stand: a tower in this lane fell, so this card came in free. It fights in the next round.` : grabbable.includes(u.tid!) ? 'Changed your mind? Drag it back to your hand or onto the other lane, or tap it, then tap another card to switch them' : undefined}
      onPointerDown={grabbable.includes(u.tid!) ? e => onGrab?.(e, u.tid!) : undefined}
      onClick={grabbable.includes(u.tid!) ? e => { e.stopPropagation(); onTap?.(u.tid!) } : undefined}>
      <TCard tid={u.tid!} card={u.card} down={false} side={u.side} selected={picked === u.tid} />
      {u.side === 'E' && <VerdictTag v={verdicts?.[u.tid!]} />}
    </div>
  ))
  return (
    <div className="alane">
      <div className="spot atk" />
      <div className="spot slot" data-anchor={`lane-${idx}`}>{here(u => u.pos === laneLen - 1 || (u.side === 'P' && u.pos >= laneLen))}</div>
      <div className="river" />
      <div className={`spot slot mine ${blocked ? 'blocked' : ''} ${dragging || hint || suggested ? 'droppable' : ''} ${dragging && over ? 'over' : ''} ${suggested ? 'suggested' : ''}`} data-lane={idx} data-anchor={`lane-${idx}`} onClick={hint || suggested ? onPlace : undefined}>
        {here(u => u.pos === 0 || (u.side === 'E' && u.pos < 0))}
        {(dragging || hint || suggested) && <span className="droptag">{suggested && '★ '}{idx === 0 ? 'LEFT' : 'RIGHT'}</span>}
      </div>
      <div className="spot atk" />
    </div>
  )
}

// ---------- setup at the real table: one step per screen, each with a picture ----------
// Mini cards for the pictures: face-down by default, or a known card face-up; "side" is a marker turned sideways.
function Mc({ card, side, hot }: { card?: Card; side?: boolean; hot?: boolean }) {
  return <PlayingCard card={card} className={`mc${side ? ' side' : ''}${hot ? ' hot' : ''}`} />
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
  round_start: 'Start of the round', my_play: 'Your turn', enemy_enter: "Flip the enemy's top card", enemy_play: 'Enemy plays a card', enemy_peek: "The enemy's next card",
  enemy_stop: 'Enemy turn ends', step_up: 'A card steps up', fight: 'Fight', move: 'Move the cards', tower_enter: 'A tower is hit: flip its top card',
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

// Every rule is drawn as a real fight between cards. Suits: same rank, so only the wheel decides (the winner counts double).
const WHEEL: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0]]
const Beats = ({ win, lose, winText, loseText }: { win: ReactNode; lose: ReactNode; winText?: ReactNode; loseText?: ReactNode }) => (
  <div className="fight">
    <span className="side win">{win}{winText && <em>{winText}</em>}</span><i>&gt;</i><span className="side"><span className="lose">{lose}</span>{loseText && <em>{loseText}</em>}</span>
  </div>
)
// Examples come from the game in progress: cards on the field first, then any card seen so far, and only then an invented one.
type Pools = Card[][]
// each pool adds to the one before: the field, then the hand you can play, then your whole hand, then the enemy cards face-up on the table
const gamePools = (g: GuideState): Pools => {
  const field = g.units.map(u => u.card)
  const playable = g.P.hand.filter((_, i) => canPlay(g, i))
  const enemy = [...g.E.queue.slice(0, 1), ...g.E.towers.L.slice(0, 1), ...g.E.towers.R.slice(0, 1), ...g.E.towers.K.slice(0, 1)].flatMap(x => x.card ? [x.card] : [])
  const tiers = [field, playable, g.P.hand, enemy]
  return tiers.map((_, i) => tiers.slice(0, i + 1).flat())
}
// a pair where the suit bonus is what decides: the winner's plain rank is lower, doubled it is higher. Inside a pool that kind comes first, then any pair of the two suits.
const wheelPair = (w: number, l: number, wheel: number, pools: Pools): [Card, Card] => {
  for (const pool of pools) {
    const ws = pool.filter(c => c.suit === w && c.rank > 1), ls = pool.filter(c => c.suit === l && c.rank > 1)
    const pairs = ws.flatMap(a => ls.map(b => [a, b] as [Card, Card]))
    const decisive = pairs.filter(([a, b]) => a.rank < b.rank && a.rank * wheel > b.rank)
    if (decisive.length) return decisive.sort((x, y) => (x[0].rank * wheel - x[1].rank) - (y[0].rank * wheel - y[1].rank))[0]
    if (pairs.length) return pairs[0]
  }
  return [{ id: `m6-${w}`, rank: 6, suit: w }, { id: `m11-${l}`, rank: 11, suit: l }]
}
const show = (c: Card) => <PlayingCard card={c} />
// the numbers are written under the cards: a 6 beating a J only makes sense once you see 6 × 2 = 12 against 11
const SuitWheel = ({ wheel = 2, pools = [] }: { wheel?: number; pools?: Pools }) => (
  <div className="suitwheel" role="img" aria-label="Spades beat hearts, hearts beat diamonds, diamonds beat clubs, clubs beat spades; the winning suit counts double">
    {WHEEL.map(([w, l]) => {
      const [a, b] = wheelPair(w, l, wheel, pools)
      return <Beats key={w} win={show(a)} lose={show(b)} winText={<>{a.rank} ×{wheel} = <b>{a.rank * wheel}</b></>} loseText={b.rank > 10 ? `${RANKS[b.rank]} = ${b.rank}` : `${b.rank}`} />
    })}
  </div>
)
// an ace and a king for the ace rule, seen ones first
const acePair = (pools: Pools): [Card, Card[]] => {
  const find = (rank: number, suit: number) => pools.flat().find(c => c.rank === rank) ?? { id: `m${rank}-${suit}`, rank, suit }
  const field = pools[0]?.find(c => c.rank === 1)
  return [field ?? find(1, 0), [13].map((r, i) => (pools[0] ?? []).find(c => c.rank === r) ?? find(r, i + 1))]
}

// The round chip on the bridge: when the round changes, the chip first glows gold with a gentle swell to catch the eye,
// and only once the glow peaks (the old number is readable) does each digit roll like a wheel (down going forward: the
// new digit drops in from above; up on undo). Columns are keyed from the right, so 9 → 10 rolls the ones digit 9 → 0
// while the new tens digit rolls in.
const roll: Variants = {
  enter: (dir: number) => ({ y: `${dir * -100}%` }),
  still: { y: '0%', transition: { type: 'spring', stiffness: 150, damping: 18 } },
  leave: (dir: number) => ({ y: `${dir * 100}%`, transition: { duration: 0.4, ease: 'easeIn' } }),
}
const ROLL_AFTER = 250 // ms: when the glow peaks, the wheel turns
function RoundChip({ n }: { n: number }) {
  // the number on the wheel lags n by ROLL_AFTER; `from` is the number before it, so the leaving digit knows its direction
  const [shown, setShown] = useState(n)
  const [from, setFrom] = useState(n)
  const d = shown >= from ? 1 : -1
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const calm = useReducedMotion()
  const digits = String(shown).split('')
  useEffect(() => {
    if (n === shown) return
    const turn = () => { setFrom(shown); setShown(n) }
    if (calm) { turn(); return }
    animate(scope.current, { scale: [1, 1.06, 1.06, 1], boxShadow: ['0 0 0 0 rgba(255,200,60,0)', '0 0 0 4px rgba(255,200,60,.95), 0 0 28px 8px rgba(255,200,60,.7)', '0 0 0 3px rgba(255,200,60,.7), 0 0 18px 4px rgba(255,200,60,.4)', '0 0 0 0 rgba(255,200,60,0)'] }, { duration: 0.9, times: [0, 0.22, 0.5, 1], ease: 'easeInOut' })
    const t = setTimeout(turn, ROLL_AFTER)
    return () => clearTimeout(t)
  }, [n, shown, calm, animate, scope])
  return (
    <div ref={scope} className="round" aria-live="polite" aria-label={`Round ${n}`}>
      <span aria-hidden="true">Round</span>
      <span className="odo" aria-hidden="true">
        {digits.map((x, i) => (
          <span key={digits.length - i} className="dial">
            <AnimatePresence initial={digits.length - i > String(from).length} custom={d}>{/* a column that wasn't there before (9 → 10) rolls in */}
              <motion.span key={x} custom={d} variants={calm ? undefined : roll} initial="enter" animate="still" exit="leave">{x}</motion.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
    </div>
  )
}

// the one thing you look up mid-game, without going through the menu
const R = ({ c }: { c: string }) => <span className="rs">{c}</span>
// three short pages, one rule each: the cards say it, the words only name it
const CHEAT_PAGES = ['Suit ×2', 'Higher', 'Ace'] as const
function Cheat({ g }: { g: GuideState }) {
  const [page, setPage] = useState(0)
  const pools = gamePools(g), [ace, pics] = acePair(pools)
  const [x, y] = [0, 1].map(i => wheelPair(WHEEL[i][0], WHEEL[i][1], g.rules.wheel, pools))
  return (<div className="cheat">
    <div className="cheat-tabs" role="tablist">{CHEAT_PAGES.map((t, i) => <button key={t} role="tab" aria-selected={page === i} onClick={() => setPage(i)}>{t}</button>)}</div>
    {page === 1 && <>
      <p><b>Higher number wins.</b></p>
      <div className="fights"><Beats win={show({ id: 'h9', rank: 9, suit: 0 })} lose={show({ id: 'h4', rank: 4, suit: 3 })} winText="9" loseText="4" /></div>
      <p><small>A=1 · J=11 · Q=12 · K=13. Same number: both lost.</small></p>
    </>}
    {page === 0 && <>
      <p className="loop" role="img" aria-label="Spades beat hearts, hearts beat diamonds, diamonds beat clubs, clubs beat spades">♠ → <R c="♥" /> → <R c="♦" /> → ♣ ↺</p>
      <p><b>The winning suit counts ×2.</b></p>
      <div className="suitwheel">{[x, y].map(([p, q], i) => <Beats key={i} win={show(p)} lose={show(q)} winText={<>{p.rank} ×{g.rules.wheel} = <b>{p.rank * g.rules.wheel}</b></>} loseText={q.rank} />)}</div>
    </>}
    {page === 2 && <>
      <p><b>Ace beats King.</b></p>
      <div className="fights"><Beats win={show(ace)} lose={<>{pics.map(c => <Fragment key={c.id}>{show(c)}</Fragment>)}</>} /></div>
      <p><small>Even at towers, and for the enemy too.</small></p>
    </>}
  </div>)
}
const cheatSheet = (g: GuideState) => <Cheat g={g} />

const RULES_60 = (<>
  <p><b>Goal:</b> break the enemy's <b>king tower</b> before it breaks yours.</p>
  <p><b>Fights:</b> your cards are soldiers. Send them down a lane: when two cards meet, the higher rank wins.</p>
  <p><b>Elixir</b> pays for cards: stronger cards cost more, and you get 3 more each round.</p>
  <details className="help"><summary>All the rules</summary><ul>
    <li><b>Goal:</b> destroy the enemy's <b>king tower</b> (a stack of 2 cards) before it destroys yours. If both fall in the same round, the side with more tower cards left wins.</li>
    <li><b>Cards</b> are soldiers. Higher rank wins a fight (A=1 … K=13). A card of the suit that beats the other counts <b>double</b>: ♠→♥, ♥→♦, ♦→♣, ♣→♠.<SuitWheel /></li>
    <li><b>Aces beat Kings</b> in a fight, whatever the suits, and against towers too. Watch out: it works for the enemy as well.</li>
    <li><b>Elixir</b> pays for your soldiers: a card costs about its rank (A=1, 5=4, 8=6, K=10). You get 3 more each round, max 10. The enemy has no elixir: it plays <b>one card per round</b>, the top of its pile.</li>
    <li>Each round: <b>you play</b> cards into a lane, then the <b>enemy</b> plays its top card into the lane where you have <b>more</b> cards (it defends; on a tie, where your highest-ranked card is, then left), then the front cards <b>fight</b> where they stand. When one falls, the card behind it <b>steps up</b> one slot and fights the winner. Then every card that hasn't moved <b>moves</b> one slot. Survivors reaching the other end hit a tower.</li>
    <li><b>A tower hit is a fight</b> against the tower's top card (the wheel and aces count). Win or tie, and the tower card <b>breaks</b>: your soldier stays, turned sideways (<b>wounded</b>), hits <b>once more</b> next round, then goes back to its pile. Lose, and the tower shoots it back: it goes back to its pile and the tower card <b>cracks</b> (turn it sideways, move it to the bottom of that tower). Any later hit breaks a cracked card. Each tower has 2 cards. The king can only be hit after the princess tower in that lane is gone.</li>
    <li><b>Last stand:</b> when a left or right tower is destroyed, its owner immediately places one card in that lane for free (the enemy uses the top card of its pile).</li>
    <li>A fighting card that dies goes to the <b>bottom of its owner's pile</b>, and you draw it again later. So your 8 cards just keep cycling.</li>
  </ul></details>
</>)

// First games teach by playing: one tip at a time, each shown the first time its situation comes up (on screen, the enemy waits while it is open).
// The goal comes first, so every rule after it has something to serve; each tip says one thing. The fight rules come one at a time,
// each when it first decides a fight (the first game's fixed deal shows them in this order: rank, then suit, then ace).
type TipId = 'goal' | 'drag' | 'elixir' | 'change' | 'enemy' | 'rank' | 'suit' | 'ace' | 'tower' | 'crack' | 'next' | 'stand'
const TIPS: Record<TipId, string> = {
  goal: "Goal: break the enemy's king, the crowned castle at the top. Your cards are soldiers.",
  drag: 'Drag a card onto a lane at the bottom. The purple number is its cost.',
  elixir: 'Elixir pays for cards: +3 every round. Done? Press ✓ and the enemy moves.',
  change: 'Changed your mind? Before ✓, drag a placed card back to your hand or to the other lane.',
  enemy: 'The enemy defends the lane where you have more cards. Its Next card is what it plays next.',
  rank: 'Cards fight where they meet: the higher rank wins. The loser goes back to its pile.',
  suit: 'Suits beat each other in a circle: ♠ beats ♥ beats ♦ beats ♣ beats ♠. The winning suit counts ×2. The ⚔ button, top left, shows it again.',
  ace: 'Aces beat Kings! A 1-elixir ace kills a 10-elixir King.',
  tower: 'A card at a tower fights its top card. Win or tie: the tower card breaks. The king is safe until its side tower falls.',
  crack: 'Lost at a tower? The card goes back to its pile, but the tower card cracks: the next hit breaks it.',
  next: 'The Next card, between your lanes, joins your hand when you play. Cards that die come back later.',
  stand: 'LAST STAND! When a side tower falls, its owner puts one card into that lane for free.',
}
// with real cards the towers are the fanned cards on the table, not castles
const TABLE_TIPS: Partial<Record<TipId, string>> = {
  goal: "Goal: break the enemy's king, the middle tower across the table. Your cards are soldiers.",
  drag: 'Drag a card onto a lane at the bottom. The purple number is its cost.',
  enemy: 'The enemy defends the lane where you have more cards.',
  change: 'Wrong card? Undo, top left, takes back any step.',
  tower: 'A card at a tower fights its front card. Win or tie: the tower card breaks. The king is safe until its side tower falls.',
  crack: 'Lost at a tower? The card goes back to its pile; turn the tower card sideways and move it to the bottom. The next hit breaks it.',
  next: 'When you play a card, draw the top of your queue. Cards that die go to the bottom of it.',
}
const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')
const TIPS_KEY = 'kingfall-tips-seen'
const PLAYED_KEY = 'kingfall-games-played' // games finished, per mode: a player who has finished none gets a ready-made deck and help on
type Played = { play: number; guide: number }
// what a player's first game did for them, so its end can say so and the next game can turn the help off again
interface Intro { deck: boolean; help: boolean }
const PULSES = ['droppulse', 'suggestglow', 'suggestring', 'flipglow']
const readJSON = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback } }
const writeJSON = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage full or blocked */ } }

const AUTO_STAGES = ['round_start', 'enemy_play', 'enemy_peek', 'enemy_stop', 'step_up', 'fight', 'move', 'tower_enter', 'tower_result']
// hold each step longer the more it shows (one line per event), so busy fights can be followed; fast halves it
const autoDelay = (events: number, fast = false) => Math.min(4000, 700 + 600 * events) * (fast ? 0.5 : 1)
const FAST_KEY = 'kingfall-fast'
const BATCH_KEY = 'kingfall-batch' // real cards: a round's fights and moves as one checklist (unset: on after 2 games at the table)
const RECORD_KEY = 'kingfall-record'
// your own results, every mode together: shown on the title and at the end of a game, never as a streak to keep
interface GameRecord { games: number; wins: number; best?: number } // best: fewest rounds to a win

export default function App() {
  const saved = useMemo(() => load(), [])
  const [screen, setScreen] = useState<Screen>(saved?.screen ?? 'title')
  const [dealt, setDealt] = useState<string[]>(saved?.dealt ?? [])
  const [deckIds, setDeckIds] = useState<string[]>(saved?.deckIds ?? [])
  const [slotIds, setSlotIds] = useState<string[]>(saved?.slotIds ?? [])
  const [mode, setMode] = useState<'guide' | 'play'>(saved?.mode ?? 'guide')
  const [secret, setSecret] = useState<Record<string, Card>>(saved?.secret ?? {})
  const [bad, setBad] = useState<number | null>(null) // a card tapped that costs more than you have
  const [explainOn, setExplainOn] = useState(saved ? saved.help === 'explain' : false)
  const [suggestOn, setSuggestOn] = useState(saved ? saved.help === 'suggest' : false)
  const help: Help = suggestOn ? 'suggest' : explainOn ? 'explain' : 'off'
  const [pre, setPre] = useState<GuideState | null>(saved?.pre ?? null)
  const [game, setGame] = useState<GuideState | null>(saved?.game ?? null)
  const [history, setHistory] = useState<GuideState[]>(saved?.history ?? [])
  // (a player from before games were counted, who has seen tips past the first turn, has played: count one game)
  const [played, setPlayed] = useState<Played>(() => readJSON(PLAYED_KEY, readJSON<string[]>(TIPS_KEY, []).length >= 3 ? { play: 1, guide: 0 } : { play: 0, guide: 0 }))
  const novice = played.play + played.guide === 0 // has never finished a game: the first one comes with its deck built
  const [intro, setIntro] = useState<Intro | null>(saved?.intro ?? null)
  const [counted, setCounted] = useState(saved?.counted ?? false)
  const [record, setRecord] = useState<GameRecord>(() => readJSON(RECORD_KEY, { games: 0, wins: 0 }))
  const [newBest, setNewBest] = useState(false)
  const [fast, setFastState] = useState<boolean>(() => readJSON(FAST_KEY, false))
  const setFast = (on: boolean) => { setFastState(on); writeJSON(FAST_KEY, on) }
  const [batchPref, setBatchPref] = useState<boolean | null>(() => readJSON<boolean | null>(BATCH_KEY, null))
  const batchOn = batchPref ?? played.guide >= 2
  const setBatch = (on: boolean) => { setBatchPref(on); writeJSON(BATCH_KEY, on) }
  const batch = (g: GuideState) => (mode === 'guide' && batchOn ? extendBatch(g) : g)
  const [future, setFuture] = useState<GuideState[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [lift, setLift] = useState<string | null>(null) // a card placed this turn, being dragged out of its slot again
  const [pick, setPick] = useState<string | null>(null) // a card placed this turn, tapped: tap another card to switch them
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
    const away = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('.hdrag, .spot.slot, button')) { if (sel !== null || bad !== null || pick !== null) sfx('unpick'); setSel(null); setBad(null); setPick(null) } }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [sel, bad, pick])
  // the state the latest step produced: only it gets effects (not undo, redo or a reloaded game)
  const fresh = useRef<GuideState | null>(null)
  const advance = (g: GuideState) => { fresh.current = g; setGame(g) }
  const playRef = useRef<HTMLDivElement>(null)
  const { pops, shake } = useFx(game, fresh.current, playRef)
  const [tipsSeen, setTipsSeen] = useState<string[]>(() => readJSON(TIPS_KEY, []))
  const [tip, setTip] = useState<TipId | null>(null)
  // a tip told differently at the table is seen separately there, so switching modes still teaches the table's version
  const seenId = (id: TipId) => (mode === 'guide' && TABLE_TIPS[id] ? `table:${id}` : id)
  const seeTip = (ids: TipId[]) => { const n = [...new Set([...tipsSeen, ...ids.map(seenId)])]; setTipsSeen(n); writeJSON(TIPS_KEY, n); setTip(null) }
  useEffect(() => {
    if (screen !== 'play' || !game) return
    const doneNow: TipId[] = tip === 'drag' && game.stats.placed > 0 ? ['drag'] : [] // done by doing it
    if (doneNow.length) seeTip(doneNow)
    else if (tip) return
    const ev = game.events ?? [], isFresh = game === fresh.current
    // 'fight' was one tip for all three fight rules: whoever saw it has seen them
    const wants = (id: TipId) => !tipsSeen.includes(seenId(id)) && !doneNow.includes(id) && !(['rank', 'suit', 'ace'].includes(id) && tipsSeen.includes('fight'))
    const happened = (f: (e: NonNullable<GuideState['events']>[number]) => boolean) => isFresh && ev.some(f)
    const firstPlay = game.stage === 'my_play' && game.stats.placed === 0
    const next: TipId | undefined = ([
      ['stand', game.stage === 'my_last_stand' || happened(e => e.type === 'play' && !!e.free)],
      ['goal', firstPlay],
      ['drag', firstPlay],
      ['elixir', happened(e => e.type === 'play' && e.side === 'P')],
      ['change', happened(e => e.type === 'play' && e.side === 'P') && game.stats.placed >= 2],
      ['enemy', happened(e => e.type === 'play' && e.side === 'E')],
      ['rank', happened(e => e.type === 'fight')],
      ['suit', happened(e => e.type === 'fight' && !!e.double)],
      ['ace', happened(e => e.type === 'fight' && !!e.ace)],
      ['tower', happened(e => e.type === 'tower')],
      ['crack', happened(e => e.type === 'tower' && e.result === 'crack')],
      ['next', game.stage === 'my_play' && game.round >= 2],
    ] as [TipId, boolean][]).find(([id, now]) => now && wants(id))?.[0]
    if (next) setTip(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, screen, tip]) // when a tip closes, the next one the same step called for comes up
  // the arena's "what happened" line keeps the last thing worth saying until something new happens
  const [said, setSaid] = useState<string[]>([])
  useEffect(() => {
    if (!game || game !== fresh.current) return
    const d = (game.events ?? []).flatMap(e => { const s = describe(e); return s ? [{ s, special: e.type === 'fight' && !!(e.ace || e.double) }] : [] })
    // a ×2 or ace pop-up doesn't say why, so its sentence stays even when later events would push it out
    const sp = d.filter(x => x.special).at(-1)
    if (d.length) setSaid([(sp ?? d[d.length - 1]).s])
    else if (game.stage === 'my_play') setSaid([])
  }, [game])
  const browsing = useRef(false) // undo/redo after the end is the player studying the game, so the result stays dismissed
  useEffect(() => { if (game?.stage !== 'over' && !browsing.current) { setOverSeen(false); setResultViewed(false) } browsing.current = false }, [game?.stage])

  useEffect(() => {
    const s: Saved = { mode, secret, screen, dealt, deckIds, slotIds, help, pre, game, history: history.slice(-60), intro, counted }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* storage full: ignore */ }
  }, [mode, secret, screen, dealt, deckIds, slotIds, help, pre, game, history, intro, counted])
  // a finished game counts once (not again when undo and redo pass the end)
  useEffect(() => {
    if (screen !== 'play' || game?.stage !== 'over' || counted) return
    const n = { ...played, [mode]: played[mode] + 1 }
    setCounted(true); setPlayed(n); writeJSON(PLAYED_KEY, n)
    const won = game.winner === 'P', best = won && (record.best === undefined || game.round < record.best)
    const rec: GameRecord = { games: record.games + 1, wins: record.wins + (won ? 1 : 0), best: best ? game.round : record.best }
    setRecord(rec); writeJSON(RECORD_KEY, rec); setNewBest(best && record.wins > 0) // a first win is its own news
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.stage, screen])

  // on screen, informational steps advance by themselves, slowly enough to follow what happens; not recorded for undo
  useEffect(() => {
    if (mode !== 'play' || screen !== 'play' || !game || tip || !AUTO_STAGES.includes(game.stage)) return
    const t = setTimeout(() => advance(settle(next(game))), autoDelay(game.lines.length, fast))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, screen, game, tip, fast])
  // when no card in hand is affordable, ending the turn is the only move, so it ends by itself; not recorded for undo,
  // so undo goes back past it to your last real choice instead of landing here and ending again
  useEffect(() => {
    if (screen !== 'play' || !game || tip || game.stage !== 'my_play' || game.P.hand.some((_, i) => canPlay(game, i))) return
    if (mode === 'guide' && game.lastAction.length > 0 && doSeen !== game.log.length) return // still placing at the table
    if (mode === 'play' && game.turn?.length) return // you played: your turn is a draft until you tap Done, so you can still take a card back
    const t = setTimeout(() => advance(settle(endMyTurn(game))), autoDelay(game.lines.length))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, screen, game, tip, doSeen])

  const mine = dealt.map(byId).sort((a, b) => b.rank - a.rank || a.suit - b.suit)
  const deck = mine.filter(c => deckIds.includes(c.id))

  const reset = () => {
    setTip(null)
    setScreen('title'); setDealt([]); setDeckIds([]); setSlotIds([]); setPre(null); setGame(null); setHistory([]); setFuture([]); setSel(null); setMode('guide'); setSecret({}); setIntro(null)
  }
  // the game begins. A player's first game: on screen, suggestions are on (a first game is hard to win, and each suggestion says
  // why); with real cards for the first time, every step says why. Their next game turns that off again.
  const begin = (g: GuideState, m: 'play' | 'guide') => {
    const help = m === 'play' ? novice : played.guide === 0
    if (help) { if (m === 'play') setSuggestOn(true); else setExplainOn(true) }
    setIntro(novice || help ? { deck: novice, help } : null)
    advance(startRound(g)); setHistory([]); setFuture([]); setPre(null); setCounted(false); setScreen('play')
  }
  const deckOf = (cards: Card[], ids: string[]) => cards.filter(c => ids.includes(c.id))
  const settle = (g: GuideState) => (mode === 'play' ? autoReveal(g, secret) : g)
  const commit = (g: GuideState) => { setHistory(h => [...h, game!]); setFuture([]); advance(settle(g)); setSel(null); setBad(null); setPick(null) }
  const undo = () => { if (!history.length || !game) return; browsing.current = true; setFuture(f => [...f, game]); setGame(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setSel(null); setBad(null) }
  const redo = () => { if (!future.length || !game) return; browsing.current = true; setHistory(h => [...h, game]); setGame(future[future.length - 1]); setFuture(f => f.slice(0, -1)); setSel(null); setBad(null) }

  const setSplit = ({ deckIds, slotIds }: { deckIds: string[]; slotIds: string[] }) => { setDeckIds(deckIds); setSlotIds(slotIds) }
  // on-screen play: deal both hands at random; the enemy's cards stay hidden inside the app (tid ep0-7 = pile, et0-5 = towers)
  const startOnScreen = () => {
    if (novice) return startTutorial()
    const d = deal()
    const enemy = shuffle(d.theirs)
    setSecret(Object.fromEntries(enemy.map((c, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, c])))
    setMode('play'); setDealt(d.mine.map(c => c.id))
    setSplit(randomSetup(d.mine)); setScreen('draft')
  }
  // a first game on screen is always the same deal (src/tutorial.ts), so the tips teach the rules in the same order for everyone.
  // It skips the deck screen, whose choices mean nothing before you know the rules: it starts on the suggested split.
  const startTutorial = () => {
    const { mine, deck } = tutorialCards()
    setSecret(tutorialSecret())
    setMode('play'); setDealt(mine.map(c => c.id))
    const s = suggestSetup(mine)
    setSplit(s); begin(makeGame(deck, s.slotIds.map(byId), mine, DEFAULT_RULES, true), 'play')
  }
  // straight into the next game of the same kind, skipping the title screen
  const playAgain = () => {
    const m = mode
    if (intro?.help) { if (m === 'play') setSuggestOn(false); else setExplainOn(false) }
    reset()
    if (m === 'play') startOnScreen()
    else { setMode('guide'); setScreen('deal') }
  }
  const reshuffle = () => setPre(makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES))

  // the setup pages' top bar: where you are and one menu for everything else (in a game, the field's corners hold these)
  const bar = (mid?: ReactNode) => (
    <div className="topbar">
      <Logo small />
      <span className="modechip">{mode === 'play' ? 'On screen' : 'Real cards'}</span>
      {mid}
      <span className="spacer" />
      <GameMenu rules={RULES_60} muted={muted} toggleMute={toggleMute} onLeave={reset} />
    </div>
  )

  // ---------- title ----------
  if (screen === 'title') {
    const fan = ['1-0', '13-1', '12-2'].map(byId)
    return (
      <div className="title">
        <div className="titlefan" aria-hidden>{fan.map(c => <PlayingCard key={c.id} card={c} />)}</div>
        <Logo />
        <p className="tagline">A lane battle for one player and a deck of cards</p>
        {record.games > 0 && <p className="record">{record.wins} {record.wins === 1 ? 'win' : 'wins'} in {record.games} {record.games === 1 ? 'game' : 'games'}{record.best !== undefined && ` · fastest win: ${record.best} rounds`}</p>}
        <div className="menu">
          <button className="big xl" onClick={startOnScreen}>Play<small>the app deals and plays the enemy</small></button>
          <button className="xl" onClick={() => { setMode('guide'); setScreen('deal') }}>Play with real cards<small>you play at the table, the app guides you</small></button>
          <RulesSheet rules={RULES_60}><Button variant="success" size="xl">How to play</Button></RulesSheet>
          <InstallLink />
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
      { title: 'Deal 14 cards each', pic: <div className="mcols"><div><div className="mfan">{sample.map(c => <Mc key={c.id} card={c} />)}<span className="more">+9</span></div><span className="mlbl">You: 14, face-up in your hand</span></div><div><div className="mstack">{backs(6)}</div><span className="mlbl">Enemy: 14, face-down</span></div></div>,
        body: <p>Deal <b>14 cards to yourself</b> and look at them. Deal <b>14 face-down to the enemy</b> and don't look at them.</p> },
      { title: 'Lay out your elixir bar', pic: <div className="mbars"><span className="mlbl">Your elixir</span><div className="mrow">{backs(10, 5)}</div><span className="mlbl">Back in the box, unseen</span><div className="mstack">{backs(6)}</div></div>,
        body: <p>Deal <b>10 face-down in a row</b> for your elixir bar, with a small gap after the 5th card. Put the <b>other 14 cards back in the box</b> without looking: they sit this game out. The enemy has no elixir bar: it plays one card per round.</p> },
      { title: 'Set the marker at 5', pic: <div className="mbars"><span className="mlbl">Your elixir: 5</span><div className="mrow">{backs(10, 5, 4)}</div></div>,
        body: <>
          <p>Turn the <b>5th card sideways</b>, still face-down. That's the <b>marker</b>: its position is your elixir, so you start at 5. Spending or gaining just moves the marker left or right.</p>
          <details className="help"><summary>The rules in 60 seconds</summary>{RULES_60}</details>
        </> },
    ]
    return (
      <div className="page">{bar()}
        <h1>1. Deal the cards</h1>
        {played.play === 0 && setupStep === 0 && (
          <Alert className="mx-auto mt-2.5 max-w-[680px] border-(--gold-d) bg-black/25 text-base">
            <Lightbulb className="text-primary" />
            <AlertTitle className="font-heading text-lg font-normal tracking-wide">New to Kingfall?</AlertTitle>
            <AlertDescription className="text-base text-foreground/90">
              <p className="m-0">One game on screen (about 5 minutes) teaches the rules. Then the table only adds the cards.</p>
              <Button variant="secondary" className="mt-2" onClick={startOnScreen}>Play on screen first</Button>
            </AlertDescription>
          </Alert>
        )}
        <Stepper steps={steps} at={setupStep} setAt={setSetupStep} done={<button className="big" onClick={() => setScreen('enter')}>Done — I have my 14 cards</button>} />
      </div>
    )
  }

  if (screen === 'enter') {
    const set = new Set(dealt)
    return (
      <div className="page">{bar()}
        <h1>2. Tell me your {PER_SIDE} cards</h1>
        <p className="help">Tap each card you were dealt. <b>{dealt.length}/{PER_SIDE}</b> selected. Tap again to deselect.</p>
        <CardPicker disabled={new Set()} selected={set} onPick={c => setDealt(a => a.includes(c.id) ? a.filter(x => x !== c.id) : a.length < PER_SIDE ? [...a, c.id] : a)} />
        <div className="row">
          <button className="big" disabled={dealt.length !== PER_SIDE} onClick={() => {
            if (!novice) { setSplit(randomSetup(mine)); setScreen('draft'); return }
            // a first game skips the deck screen: the app picks a good split, and the table steps say which card goes where
            const s = suggestSetup(mine)
            setSplit(s); setPre(makeGame(deckOf(mine, s.deckIds), s.slotIds.map(byId), mine, DEFAULT_RULES)); setScreen('table')
          }}>{novice ? 'Next: set up the table' : 'Next: build my deck'}</button>
          <button onClick={() => setDealt([])}>Clear</button>
        </div>
      </div>
    )
  }

  if (screen === 'draft') {
    const go = mode === 'play'
      ? <button className="big" onClick={() => begin(makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES), 'play')}>Start the game</button>
      : <button className="big" onClick={() => { reshuffle(); setScreen('table') }}>Next: set up the table</button>
    return <DeckBuilder mine={mine} deckIds={deckIds} slotIds={slotIds} onChange={(d, t) => { setDeckIds(d); setSlotIds(t) }} onRedeal={mode === 'play' ? startOnScreen : undefined}
      title={mode === 'play' ? 'Build your deck' : '3. Build your deck'} bar={bar} start={go} />
  }

  if (screen === 'table') {
    const g = pre ?? makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES)
    const stack = (name: string, cards: Card[]) => <div className="mtower"><div className="mrow">{cards.map((c, i) => <Mc key={c.id} card={c} hot={i === 0} />)}</div><span className="mlbl">{name}</span></div>
    const eStack = (name: string, n: number) => <div className="mtower"><div className="mrow">{backs(n)}</div><span className="mlbl">{name}</span></div>
    const steps: SetupStep[] = [
      { title: 'Build your three towers', pic: <div className="mcols">{stack('Left', g.P.towers.L)}{stack('King', g.P.towers.K)}{stack('Right', g.P.towers.R)}</div>,
        body: <p>{novice && <>For your first game I picked your deck and towers; next game you build your own. </>}Make three stacks <b>face-up</b> in a row in front of you, the <b>top card first</b> (gold above): <b>Left</b> {g.P.towers.L.map(label).join(' · ')}, <b>King</b> {g.P.towers.K.map(label).join(' · ')} in the middle, <b>Right</b> {g.P.towers.R.map(label).join(' · ')}. Fan each stack so you can see every card.</p> },
      { title: 'Your hand and your queue', pic: <div className="mbars"><span className="mlbl">Hand, face-up</span><div className="row">{g.P.hand.map(c => <PlayingCard key={c.id} card={c} showCost />)}</div><span className="mlbl">Queue, face-down, top card first</span><div className="mrow">{g.P.queue.map(c => <Mc key={c.id} card={c} />)}</div></div>,
        body: <>
          <p>I shuffled your 8 deck cards. Take the <b>4 hand cards</b> into your hand and stack the other <b>4 face-down</b> as your queue, in this order, top card first.</p>
          <button onClick={reshuffle}>Shuffle again</button>
        </> },
      { title: "The enemy's side", pic: <div className="mcols"><div className="mtower"><div className="mstack">{backs(6)}</div><span className="mlbl">Pile: 8</span></div>{eStack('Left', 2)}{eStack('King', 2)}{eStack('Right', 2)}</div>,
        body: <p>Shuffle the enemy's 14 cards <b>without looking</b>. Put <b>8</b> face-down as its <b>pile</b>. With the other 6, make its towers across the table, all <b>face-down</b>: <b>Left 2</b>, <b>King 2</b>, <b>Right 2</b>.</p> },
      { title: 'The table', pic: (
          <div className="mtable">
            <span>Enemy pile</span><span className="mt-them">Enemy Left</span><span className="mt-them">Enemy King</span><span className="mt-them">Enemy Right</span><span>Enemy discard</span>
            <span className="mt-lane l">Left lane<br />2 slots</span><span className="mt-lane r">Right lane<br />2 slots</span>
            <span>Your queue</span><span className="mt-me">Your Left</span><span className="mt-me">Your King</span><span className="mt-me">Your Right</span><span>Your discard</span>
            <span className="mt-bar">Your elixir bar</span>
          </div>),
        body: <p>Your towers in a row in front of you, the enemy's across the table. Between them, <b>two lanes of 2 slots</b>: slot 1 next to you, slot 2 next to the enemy. The screen shows the table the same way, the enemy at the top.</p> },
    ]
    return (
      <div className="page">{bar()}
        <h1>{novice ? 3 : 4}. Set up the table</h1>
        <Stepper steps={steps} at={setupStep} setAt={setSetupStep} done={<button className="big" onClick={() => begin(g, 'guide')}>Start the game</button>} />
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
  const previewCard = g.P.hand[drag ?? sel ?? bad ?? hov ?? -1]
  const spend = previewCard && !standing ? cost(previewCard.rank) : 0 // a last stand card is free
  const side = stage === 'my_play' || standing ? 'me' : stage.startsWith('enemy_') || stage === 'last_stand_enter' ? 'enemy' : null
  // with real cards, every step that moves cards on the table waits on a panel over the tray until the player taps Done;
  // after one of your own plays that is paying, placing and drawing, then the hand is free again
  const doNow = mode === 'guide' && stage === 'my_play' && g.lastAction.length > 0 && doSeen !== g.log.length
  const atTable = mode === 'guide' && (doNow || flipping || AUTO_STAGES.includes(stage))
  const stepTitle = doNow ? 'Now at the table' : stage === 'round_start' ? `Round ${g.round}` : g.batched ? 'Fights and moves, in order' : g.events?.some(e => e.type === 'play' && e.free) ? 'Last stand' : TITLES[stage]
  // the card to turn face-up glows on the field: the enemy's next card, or the top of the tower being hit
  const hitUnit = hitEnemy ? g.units.find(u => u.uid === g.hitQueue[0]) : undefined
  const flipTower = hitUnit ? (g.E.towers[hitUnit.lane === 0 ? 'L' : 'R'].length ? (hitUnit.lane === 0 ? 'L' : 'R') : 'K') : null
  const mineSlots = (k: 'L' | 'R' | 'K'): ESlot[] => g.P.towers[k].map(c => ({ tid: c.id, card: c }))
  // pointer-based drag: one code path for mouse, touch and pen (HTML5 drag-and-drop never fires on touch screens).
  // It picks up a card from your hand (i), or on screen a card you placed this turn (tid): dropped off the lanes it goes back to your hand.
  const startDrag = (e: React.PointerEvent<HTMLElement>, i: number | null, tid?: string) => {
    if ((i !== null && !standing && !canPlay(g, i)) || (e.pointerType === 'mouse' && e.button !== 0)) return
    const from = tid ? g.units.find(u => u.tid === tid)?.lane : undefined
    const el = e.currentTarget, x0 = e.clientX, y0 = e.clientY
    let ghost: ReturnType<typeof makeGhost> = null, lane: 0 | 1 | null = null
    const laneAt = (x: number, y: number) => {
      const t = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest(tid ? '.spot.mine[data-lane]' : '.droppable[data-lane]') as HTMLElement | null
      return t?.dataset.lane === undefined ? null : (Number(t.dataset.lane) as 0 | 1)
    }
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return
        ghost = makeGhost(el, x0, y0); setBad(null); setSel(null); if (tid) setLift(tid); else setDrag(i); sfx('pick')
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
      if (tid) {
        // back where it was (or a cancelled drag): nothing changes; anywhere else: it moves lanes or goes back to your hand
        if (ev.type !== 'pointerup' || l === from) { ghost.glideBack(() => setLift(null)); return }
        ghost.land(l === null ? 0.32 : 0.26); setLift(null); sfx(l === null ? 'unpick' : 'tap') // back to the hand is the longer trip
        return commit(takeBack(g, tid, l ?? undefined))
      }
      if (l === null) { sfx('unpick'); ghost.glideBack(() => setDrag(null)); return }
      ghost.land(0.26); setDrag(null)
      commit(standing ? lastStandPlay(g, i!) : playCard(g, i!, l))
    }
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
  }

  // two cards switch places by tapping one, then the other: both fly at once, as quick as a card you move yourself
  const trySwitch = (a: string, b: string) => {
    const n = switchCards(g, a, b)
    if (n === g) return false
    quick(a, 0.32); quick(b, 0.32); sfx('tap'); commit(n)
    return true
  }
  const tapHand = (i: number) => {
    if (justDragged.current) return
    if (pick) { if (trySwitch(pick, g.P.hand[i].id)) return; setPick(null) } // a card the picked one can't switch with: pick it instead
    const off = sel === i || bad === i
    const ok = standing || canPlay(g, i)
    sfx(off ? 'unpick' : ok ? 'pick' : 'deny')
    if (off) setHov(null)
    setSel(!off && ok ? i : null); setBad(!off && !ok ? i : null)
  }
  // the suggestion is shown on the board itself: the card and its lane glow, or the ✓ button does
  const suggested = advice?.kind === 'play' ? advice : null
  // a card placed this turn, tapped: tap another of yours to switch them, the other lane to move it there, its own lane to let go
  const tapUnit = (tid: string) => {
    if (justDragged.current) return
    if (pick === tid) { sfx('unpick'); setPick(null); return }
    const other = pick ?? (sel !== null ? g.P.hand[sel]?.id : undefined)
    if (other && trySwitch(other, tid)) return
    sfx('pick'); setSel(null); setBad(null); setPick(tid)
  }
  // while a placed card is picked, the hand cards it can switch with stand out (its elixir would come back first)
  const open = (i: number) => (pick ? switchCards(g, pick, g.P.hand[i].id) !== g : standing || canPlay(g, i))
  const handCards = g.P.hand.map((c, i) => (
    <div key={c.id} data-i={i} className={`hdrag ${drag === i ? 'lifted' : ''} ${!open(i) ? 'off' : ''} ${suggested?.handIndex === i && drag === null ? 'suggested' : ''}`} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onPointerDown={e => startDrag(e, i)}>
      <TCard tid={c.id} card={c} down={false} side="P" showCost selected={sel === i} dim={!open(i)} onClick={() => tapHand(i)} />
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
      <Button variant="secondary" size="xl" className="mt-2" onClick={() => { setTipsSeen([]); writeJSON(TIPS_KEY, []); close() }}><Lightbulb /> Show the first-game tips again</Button>
    </>
  )
  // the whole log as a text file, to keep or send
  const exportLog = () => {
    const cards = (ids: string[]) => ids.map(id => label(byId(id))).join(' ')
    const help = mode === 'play' ? (suggestOn ? 'suggestions on' : 'suggestions off') : (explainOn ? 'explanations on' : 'explanations off')
    const head = [
      'Kingfall game log', new Date().toLocaleString(), `Mode: ${mode === 'guide' ? 'real cards' : 'on screen'} (${help}${intro?.deck ? ', first game' : ''})`,
      `Rules: aces beat kings${g.rules.aceMin === 13 ? ' only' : ''}, elixir cap ${g.rules.cap}`,
      stage === 'over' ? `Result: ${g.winner === 'P' ? 'you won' : g.winner === 'E' ? 'you lost' : 'draw'} after ${g.round} rounds` : `Unfinished: round ${g.round}`,
      `Your 14 cards: ${g.dealt.map(label).join(' ')} (${g.dealt.filter(c => c.rank === 1).length} aces)`,
      deckIds.length ? `Your deck: ${cards(deckIds)}` : '', slotIds.length ? `Your towers (left, left, right, right, king, king): ${cards(slotIds)}` : '',
      g.enemySeen.length ? `Enemy cards seen: ${g.enemySeen.map(label).join(' ')}` : '',
      `Your record before this log: ${record.wins} wins in ${record.games} games`, '']
    const url = URL.createObjectURL(new Blob([[...head.filter(l => l !== '' || l === head.at(-1)), ...g.log].join('\n') + '\n'], { type: 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `kingfall-log-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt` })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const cheat = (
    <RulesSheet title="Who beats who" rules={cheatSheet(g)}>
      <Button variant="secondary" size="icon-lg" aria-label="Who beats who" title="Who beats who"><Swords /></Button>
    </RulesSheet>
  )
  const sum = stage === 'over' ? summary(g) : null
  const gameSummary = sum && (
    <>
      <div className="gostats">
        <div><b>{sum.broke}<small>/{sum.theirTotal}</small></b><span>enemy tower cards broken</span></div>
        <div><b>{sum.rounds}</b><span>rounds</span></div>
        <div><b>{sum.standing}<small>/{sum.mineTotal}</small></b><span>of your tower cards standing</span></div>
      </div>
      {sum.close && <p className="goclose">So close! Their king had one card left.</p>}
      <p className="gorecord">{newBest ? `Your fastest win yet: ${sum.rounds} rounds! ` : ''}{record.wins} {record.wins === 1 ? 'win' : 'wins'} in {record.games} {record.games === 1 ? 'game' : 'games'}.</p>
      {intro?.deck && g.winner !== 'P' && <p className="goclose">This first game was for learning the rules. Following the glowing suggestions wins it.</p>}
      <div className="gotip"><Lightbulb aria-hidden /><p>{sum.tip ? <CardText text={sum.tip} /> : 'Clean game: no elixir wasted and no expensive cards spent on cheap enemies.'}</p></div>
      {intro && (
        <p className="gonext">
          {intro.deck && 'Next game you build your own deck from the cards you are dealt. '}
          {intro.help && (mode === 'play' ? 'Suggestions were on for your first game; ' : 'Every step said why in your first game; ')}
          {intro.help && 'Menu → Hints turns that on again.'}
        </p>
      )}
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
            {gameSummary}
            <div className="row">
              <button className="big" onClick={playAgain}>Play again</button>
              <button onClick={() => { setResultViewed(true); setOverSeen(true) }}>View board</button>
              <button onClick={exportLog}>Save log</button>
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
          {!flipping && <button className="big" title="Done at the table" onClick={doNow ? () => setDoSeen(g.log.length) : () => commit(batch(next(g)))}>Done
            <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 6.5" /></svg></button>}
        </div>
        <ul className="tslist">{(doNow ? g.lastAction : g.lines).map((l, i) => <li key={i}><Said text={l} /></li>)}</ul>
        {help !== 'off' && !doNow && g.why.length > 0 && <p className="tswhy"><b>Why:</b> <CardText text={g.why.join(' ')} /></p>}
        {flipping && <FlipPicker known={excludedIds(g)} onPick={c => commit(batch(hitEnemy ? enterTowerCard(g, c) : enterEnemyCard(g, c)))} />}
      </div>
    </div>
  )

  // the arena; card size follows the window so the whole field, the bar and the hand always fit
  const arena = () => {
    const aw = Math.min(view.sw, 640)
    // with real cards every card is the same size, as on the table: five card columns across (pile, three tower fans, discard) and five card rows down (the enemy has no elixir bar).
    // A wide window puts the instructions and the hand in a column beside the table; otherwise they get a fixed space under it.
    const wide = mode === 'guide' && view.sw >= 860 && view.sw >= view.sh * 1.3
    const ch = mode === 'guide'
      ? wide
        ? Math.max(44, Math.min((view.sh - 160) / 5.9, (Math.min(view.sw - 420, 760) - 60) / 7.4 / 0.714, (380 - 40) / 5 / 0.714, 128)) // the hand (4 cards + Done) fits the 380px column
        : Math.max(44, Math.min((view.sh - 300) / 6.84, (aw - 60) / 7.4 / 0.714, 128))
      : Math.max(52, Math.min((view.sh - 218) / 6.9, (aw - 72) / 4.75 / 0.714, 128))
    const vars = { '--cw': `${ch * 0.714}px`, '--ch': `${ch}px` } as CSSProperties
    const prompt = stage === 'my_play' ? 'Your turn: drag a card onto a lane, then tap ✓.' : standing ? TITLES[stage] : stage === 'round_start' ? `Round ${g.round}: you get ${g.rules.regen} more elixir.` : 'Enemy turn…'
    // the enemy's last-stand card came in during its turn: your turn still says where it came from, until it has fought
    const stood = stage === 'my_play' && g.units.find(u => u.side === 'E' && u.free)
    // with suggestions on, your turn's line says what they suggest and, in a few words, why (the whole reason is in Menu → Hints)
    const suggestion = advice && (advice.kind === 'play'
      ? `${label(g.P.hand[advice.handIndex])}${standing ? '' : ` in the ${advice.lane === 0 ? 'left' : 'right'} lane`}: ${advice.short}.`
      : `End your turn: ${advice.short}.`)
    const standSide = g.lastStand?.lane === 0 ? 'left' : 'right'
    const standMsg = `Your ${standSide} tower fell: drag a card onto the ${standSide} lane, it joins free.`
    const stoodMsg = stood ? `Enemy ${label(stood.card)} came in free (its ${stood.lane === 0 ? 'left' : 'right'} tower fell).` : ''
    // at most two lines: one sentence, or the suggestion when suggestions are on
    const lines = standing ? [suggestion ?? standMsg] : stood ? [suggestion ?? stoodMsg]
      : suggestion ? [suggestion] : said.length ? said : [prompt]
    // the suggested lane glows only while no other card is picked up; tapping it with nothing picked plays the suggestion
    const fighting = fightingNext(g)
    const towerFx = (side: 'P' | 'E', k: 'L' | 'R' | 'K'): TowerFx => {
      for (const e of g.events ?? []) {
        if (e.type === 'tower' && e.side !== side && e.stack === k) return e.result
        if (e.type === 'reveal' && side === 'E' && e.stack === k) return 'reveal'
      }
    }
    const grabbable = mode === 'play' && stage === 'my_play' ? (g.turn ?? []).map(p => p.id) : []
    const lane = (l: 0 | 1) => ({
      grabbable, lifted: lift, picked: pick, onGrab: (e: React.PointerEvent<HTMLElement>, tid: string) => startDrag(e, null, tid), onTap: tapUnit,
      dragging: (drag !== null && (!standing || g.lastStand?.lane === l)) || (lift !== null && g.units.find(u => u.tid === lift)?.lane !== l), hint: standing ? g.lastStand?.lane === l : sel !== null || pick !== null, blocked: standing && g.lastStand?.lane !== l,
      suggested: suggested?.lane === l && (drag ?? sel ?? suggested.handIndex) === suggested.handIndex,
      over: overLane === l, onPlace: () => {
        if (standing) { const i = sel ?? suggested?.handIndex; if (i !== undefined && g.lastStand?.lane === l) { quick(g.P.hand[i].id, 0.32); commit(lastStandPlay(g, i)) } return }
        if (pick) { const n = takeBack(g, pick, l); if (n === g) { sfx('unpick'); setPick(null) } else { quick(pick, 0.26); commit(n) } return }
        const i = sel ?? suggested?.handIndex; if (i !== undefined) { quick(g.P.hand[i].id, 0.32); commit(playCard(g, i, l)) } },
    })
    // what the card in your hand (picked, dragged or hovered) is worth against every enemy card on the table
    const verdicts: Verdicts = {}
    if (previewCard) {
      const add = (tid: string | undefined, c: Card | null | undefined) => {
        if (!tid || !c) return
        const w = g.rules.wheel, mv = effective(previewCard, c, w), tv = effective(c, previewCard, w)
        const mineAce = aceWins(previewCard, c, g.rules), theirAce = aceWins(c, previewCard, g.rules)
        verdicts[tid] = { mine: mineAce ? '∞' : String(mv), theirs: theirAce ? '∞' : String(tv), mineBonus: mineAce || mv > previewCard.rank, theirsBonus: theirAce || tv > c.rank, rank: RANKS[c.rank] }
      }
      for (const u of g.units) if (u.side === 'E') add(u.tid, u.card)
      add(g.E.queue[0]?.tid, g.E.queue[0]?.card) // the card the enemy plays next
      for (const k of ['L', 'R', 'K'] as const) add(g.E.towers[k][0]?.tid, g.E.towers[k][0]?.card)
    }
    const eNext = g.E.queue[0]
    const undoRedo = <>
      <Button variant="secondary" size="icon-lg" aria-label="Undo" title="Undo" onClick={undo} disabled={!history.length}><Undo2 /></Button>
      <Button variant="secondary" size="icon-lg" aria-label="Redo" title="Redo" onClick={redo} disabled={!future.length}><Redo2 /></Button>
    </>
    const settings = mode === 'play'
      ? <Choice id="fast" icon={<FastForward />} title="Fast enemy turns" description="Its steps go by twice as quickly. Tapping the field skips ahead any time." checked={fast} onChange={setFast} />
      : <Choice id="batch" icon={<ListChecks />} title="Fights in one list" description="A round's fights, moves and tower hits as one checklist with one Done" checked={batchOn} onChange={setBatch} />
    const menu = <GameMenu rules={RULES_60} muted={muted} toggleMute={toggleMute} onLeave={reset} log={g.log} onExport={exportLog} hints={hints} settings={settings} />
    const round = <RoundChip n={g.round} />
    const discard = (owner: 'P' | 'E') => {
      const d = g.discard.filter(x => x.owner === owner)
      return <TablePile top={d.at(-1)} down={false} n={d.length} name="Discard" discard />
    }
    // with real cards the screen is the table as you sit at it: every card where it lies, all the same size
    const table = (
      <>
        <div className="tbar"><span className="undoredo">{undoRedo}</span>{cheat}<span className="modechip">Real cards</span><span className="tmenu">{menu}</span></div>
        <div className={`cardtable ${shake}`}>
          <div className="trow theirs">
            <TablePile top={eNext} down={!eNext?.card} side="E" n={g.E.queue.length} name="Pile" verdict={eNext && verdicts[eNext.tid]} flip={stage === 'enemy_enter' || stage === 'last_stand_enter'} />
            {(['L', 'K', 'R'] as const).map(k => <TowerFan key={k} k={k} items={g.E.towers[k]} own={false} verdicts={verdicts} cracked={g.cracked ?? []} flip={flipTower === k} shake={fighting.includes(`tower-E-${k}`)} />)}
            {discard('E')}
          </div>
          <div className="lanes">
            <span />
            <ArenaLane idx={0} units={g.units} fighting={fighting} laneLen={g.rules.laneLen} {...lane(0)} verdicts={verdicts} />
            <div className="mid">{round}</div>
            <ArenaLane idx={1} units={g.units} fighting={fighting} laneLen={g.rules.laneLen} {...lane(1)} verdicts={verdicts} />
            <span />
          </div>
          <div className="trow mine">
            <TablePile top={g.P.queue[0] && { tid: g.P.queue[0].id, card: g.P.queue[0] }} down side="P" n={g.P.queue.length} name="Queue" />
            {(['L', 'K', 'R'] as const).map(k => <TowerFan key={k} k={k} items={mineSlots(k)} own cracked={g.cracked ?? []} shake={fighting.includes(`tower-P-${k}`)} />)}
            {discard('P')}
          </div>
          <CardBar n={g.P.elixir} spend={spend} />
        </div>
      </>
    )
    // on screen, a tap on the field while a step plays out goes straight to the next one
    const skippable = mode === 'play' && !tip && AUTO_STAGES.includes(stage)
    const skip = (e: React.PointerEvent) => { if (!(e.target as Element).closest('button')) advance(settle(next(g))) }
    const field = (
      <div className={`field ${shake}${skippable ? ' skippable' : ''}`} onPointerDown={skippable ? skip : undefined}>
        <span className="corner left undoredo">{cheat}{DEBUG && undoRedo}</span> {/* undo/redo: debugging aid, dev server or any build opened with ?debug=1 */}
        <span className="corner right">{menu}</span>
        <div className="castles theirs">
          {(['L', 'K', 'R'] as const).map(k => <Castle key={k} k={k} items={g.E.towers[k]} own={false} verdicts={verdicts} cracked={g.cracked ?? []} fx={towerFx('E', k)} shake={fighting.includes(`tower-E-${k}`)} />)}
        </div>
        <div className="lanes">
          <ArenaLane idx={0} units={g.units} fighting={fighting} laneLen={g.rules.laneLen} {...lane(0)} verdicts={verdicts} />
          <div className="mid rows">
            <div className="sidechip enemy" title="The next card of the enemy pile (face-down until you have seen it). The enemy plays one card per round.">
              {eNext && <div className="nextcard"><div className="ncard"><TCard key={eNext.tid} tid={eNext.tid} card={eNext.card} down={!eNext.card} side="E" /><VerdictTag v={verdicts[eNext.tid]} /></div><span>Next</span></div>}
            </div>
            {round}
            <div className="sidechip mine" title="Your next card: it comes into your hand when you play one">
              {g.P.queue[0] && <div className="nextcard"><span>Next</span><TCard key={g.P.queue[0].id} tid={g.P.queue[0].id} card={g.P.queue[0]} down={false} side="P" showCost /></div>}
            </div>
          </div>
          <ArenaLane idx={1} units={g.units} fighting={fighting} laneLen={g.rules.laneLen} {...lane(1)} verdicts={verdicts} />
        </div>
        <div className="castles mine">
          {(['L', 'K', 'R'] as const).map(k => <Castle key={k} k={k} items={mineSlots(k)} own cracked={g.cracked ?? []} fx={towerFx('P', k)} shake={fighting.includes(`tower-P-${k}`)} />)}
        </div>
      </div>
    )
    return (
      <div ref={playRef} className={`arena${mode === 'guide' ? ' guide' : ''}${wide ? ' wide' : ''}${side ? ' turn-' + side : ''}`} style={vars}>
        {mode === 'guide' ? table : field}
        <div className="tray">
          {stage === 'over' && overSeen
            ? <div className="overbtns"><button className="big" onClick={playAgain}>Play again</button><button onClick={() => setOverSeen(false)}>Result</button></div>
            : <div className="feed" aria-live="polite">
              {lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>}
          <div className="handwrap">
            <div className="handrow">
              {handCards}
              <button className={`big done endturn ${advice?.kind === 'wait' ? 'suggested' : ''}`} title={advice?.kind === 'wait' ? advice.reason : 'End turn'} disabled={stage !== 'my_play'} aria-label="End turn" onClick={() => commit(endMyTurn(g))}><svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 6.5" /></svg></button>
            </div>
            {mode === 'play' && <div className="elixrow"><ElixirBar n={g.P.elixir} spend={spend} /></div>}
          </div>
          {tableStep || coach}
        </div>
        {overlays}
      </div>
    )
  }

  return arena()
}

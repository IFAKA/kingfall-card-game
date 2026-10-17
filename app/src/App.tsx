import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import confetti from 'canvas-confetti'
import { DECK_SIZE, DEFAULT_RULES, HAND_SIZE, PER_SIDE, RANKS, SUITS, aceWins, compare, cost, deal, effective, fightResult, freshDeck, isRed, label, randomSetup, secureRandom, shuffle, suggestSetup } from './engine'
import type { Card, Rules, Unit } from './engine'
import {
  advise, adviseLastStand, autoReveal, canPlay, describe, endMyTurn, extendBatch, fightingNext, enterEnemyCard, enterTowerCard, excludedIds, lastStandPlay, makeGame, next, options, playCard, startRound, summary, switchCards, takeBack,
} from './guide'
import type { ESlot, GuideState } from './guide'
import { quick, useFx, usePops } from './fx'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import type { Pop } from './fx'
import { isMusicOff, music, setMusicOff } from './music'
import { isMuted, setMuted, sfx } from './sfx'
import { Castle as CastleIcon, Crown, FastForward, Hand, Layers, Lightbulb, ListChecks, Redo2, Repeat, Shield, Swords, Undo2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CardText, Choice, GameMenu, HowToPlay, InstallLink, RulesSheet, Section } from './Menu'
import type { Topic } from './Menu'
import { CastleArt, PlayingCard, TCard } from './Pieces'
import { BoardTick } from './board-tick'
import { useViewport } from '@/hooks/use-viewport'
import DeckBuilder from './DeckBuilder'
import { tutorialCards, tutorialSecret } from './tutorial'
import { track } from './stats'
import { addGame, downloadText, logName, readHistory } from './history'
import type { PastGame } from './history'

type Help = 'off' | 'explain' | 'suggest'
type Screen = 'title' | 'deal' | 'enter' | 'draft' | 'table' | 'play'
interface Saved { mode?: 'guide' | 'play'; secret?: Record<string, Card>; screen: Screen; dealt: string[]; deckIds: string[]; slotIds: string[]; help: Help; order?: string[]; game: GuideState | null; history: GuideState[]; intro?: Intro | null; counted?: boolean }

const ALL = freshDeck()
const byId = (id: string) => ALL.find(c => c.id === id)!
export const STORAGE_KEY = 'solo-clash-guide-v10' // bump when the rules change, so old saved games don't load into new rules

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
    // its own canvas, drawn in a worker (where the browser can), so the confetti never takes frames from the page
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10000'
    document.body.appendChild(canvas)
    const fire = confetti.create(canvas, { resize: true, useWorker: true })
    const end = Date.now() + 2500
    const opts = { particleCount: 6, spread: 70, startVelocity: 55 }
    const id = setInterval(() => {
      void fire({ ...opts, angle: 60, origin: { x: 0, y: 0.8 } })
      void fire({ ...opts, angle: 120, origin: { x: 1, y: 0.8 } })
      if (Date.now() > end) clearInterval(id)
    }, 120)
    return () => { clearInterval(id); fire.reset(); canvas.remove() }
  }, [])
  return null
}

// Pop-ups from the latest step (see fx.ts), drawn over the board.
function FxLayer() {
  const pops = usePops()
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
  // the hit has already struck by the time the step lands (see fx.ts), so the card goes at once
  leave: (fx: TowerFx) => fx === 'break' ? { y: 34, rotate: 40, opacity: 0, transition: { duration: 0.7, ease: 'easeIn' } }
    : fx === 'crack' ? { rotate: 90, scale: 0.4, opacity: 0, transition: { duration: 0.5 } }
    : { opacity: 0, transition: { duration: 0 } },
}

// The fight between the card you hold and an enemy card, in words for the line under the field:
// why it goes that way (an ace, the suit that counts double, or just the ranks), then who wins.
function fightLine(m: Card, t: Card, rules: Rules) {
  const res = fightResult(m, t, rules)
  const who = res > 0 ? 'you win' : res < 0 ? `${label(t)} wins${compare(m, t, rules) === 0 ? ' (tie: enemy wins)' : ''}` : 'a tie, both are removed'
  const mv = effective(m, t, rules.wheel), tv = effective(t, m, rules.wheel)
  const why = aceWins(m, t, rules) || aceWins(t, m, rules) ? 'Aces beat Kings'
    : mv > m.rank ? `${SUITS[m.suit]} beats ${SUITS[t.suit]}: ${label(m)} = ${mv} vs ${tv}`
    : tv > t.rank ? `${SUITS[t.suit]} beats ${SUITS[m.suit]}: ${label(t)} = ${tv} vs ${mv}`
    : `${label(m)} vs ${label(t)}${[m, t].some(c => c.rank === 1 || c.rank > 10) ? ` is ${mv} vs ${tv}` : ''}` // an ace or a picture's number isn't on the card
  return `${why}, ${who}.`
}

function Castle({ k, items, own, cracked, fx, shake }: { k: 'L' | 'R' | 'K'; items: ESlot[]; own: boolean; cracked: string[]; fx?: TowerFx; shake?: boolean }) {
  const top = items[0]
  const known = top?.card
  return (
    <div className={`castle ${own ? 'mine' : 'theirs'} ${k === 'K' ? 'king' : ''} ${items.length ? '' : 'fallen'} ${shake ? 'tremble' : ''}`} data-anchor={`tower-${own ? 'P' : 'E'}-${k}`}
      title={!items.length ? `${own ? 'Your' : 'Enemy'} ${STACK_NAME[k].toLowerCase()} tower has fallen` : `${own ? 'Your' : 'Enemy'} ${STACK_NAME[k].toLowerCase()} tower${top && cracked.includes(top.tid) ? ' (cracked: the next hit breaks it)' : ''}${known ? `; a soldier must win a fight against its card, ${label(known)}, to stay for the hit that breaks it` : ''}`}>
      <div className="cwrap">{/* the tower's card is written on the castle, above its door; the castle itself shows its state: whole, cracked, or fallen */}
      <CastleArt king={k === 'K'} fallen={!items.length} hurt={!!top && cracked.includes(top.tid)} />
      <div className="guard">
        <div className="tslot"><AnimatePresence initial={false} mode="popLayout" custom={fx}>{top
          ? <motion.div key={top.tid + (known ? '' : '?')} custom={fx} variants={CHIP} initial="enter" animate="show" exit="leave"
            className={`topcard ${known ? (isRed(known) ? 'red' : '') : 'empty'}`}>{known && <><span>{RANKS[known.rank]}</span><span>{SUITS[known.suit]}</span></>}</motion.div>
          : null}</AnimatePresence></div>
      </div>
      </div>
    </div>
  )
}

// With real cards, a tower is drawn as the cards on the table: a fan, top card (hit first) in front. Yours face-up, the enemy's face-down until flipped.
// The front card (hit first) on the right, each card behind it peeking out on the left, so every card's rank and suit show.
function TowerFan({ k, items, own, cracked, flip, shake }: { k: 'L' | 'R' | 'K'; items: ESlot[]; own: boolean; cracked: string[]; flip?: boolean; shake?: boolean }) {
  const n = items.length
  return (
    <div className={`tfan ${own ? 'mine' : 'theirs'} ${k === 'K' ? 'king' : ''} ${n ? '' : 'fallen'} ${flip ? 'flipme' : ''} ${shake ? 'tremble' : ''}`} data-anchor={`tower-${own ? 'P' : 'E'}-${k}`}
      title={`${own ? 'Your' : 'Enemy'} ${STACK_NAME[k].toLowerCase()} tower card: it takes two hits. A cracked card (sideways at the table) breaks on any hit.`}>
      <div className="fancards" style={{ width: `calc(var(--cw) + ${Math.max(0, n - 1)} * var(--toff))` }}>
        {items.map((it, i) => (
          <div key={it.tid} className={`fc ${cracked.includes(it.tid) ? 'cracked' : ''}`} style={{ left: `calc(${n - 1 - i} * var(--toff))`, zIndex: n - i }}>
            <TCard tid={it.tid} card={it.card} down={!it.card} side={own ? 'P' : 'E'} />
          </div>
        ))}
      </div>
      <div className="cname">{n ? STACK_NAME[k] : `${STACK_NAME[k]} · fallen`}</div>
    </div>
  )
}

// A pile squared up on the table: the top card shows face-up only where it is face-up at the table, with the count under it.
// The top card keeps its id, so a card played from the pile, drawn from it or thrown on it slides there.
function TablePile({ top, down, side, n, name, flip, faces }: { top?: ESlot; down: boolean; side?: 'P' | 'E'; n: number; name: string; flip?: boolean; faces?: boolean }) {
  return (
    <div className={`tpile ${flip ? 'flipme' : ''}`}>
      <div className="pcards">
        {Array.from({ length: Math.min(3, Math.max(0, n - 1)) }, (_, i) => <div key={i} className={`pback ${faces ? 'face' : ''}`} style={{ translate: `${(i + 1) * 2}px ${(i + 1) * 2}px` }} />)}
        {top && <TCard key={top.tid} tid={top.tid} card={top.card} down={down} side={side} />}
        <span className="pcount" aria-label={`${n} cards`}>{n}</span>
      </div>
      <div className="cname">{name}</div>
    </div>
  )
}

// What is left of your turn, as a bar of 2 that fills up again every round: a small card (A to 5) uses 1, any other card both.
// Hovering or dragging a card shows what it would use.
function TurnBar({ n, spend, max }: { n: number; spend: number; max: number }) {
  const [a, b] = spendRange(n, spend, max)
  const left = n === max ? 'play 1 card, or 2 small cards (A to 5)' : n > 0 ? 'you may still play 1 small card (A to 5)' : 'your play is done'
  return ( // a bar of two halves under the ✓ button, one piece while both halves share a state (full, or both red for a card you can't afford): the first half is used first (a small card), the other one next; a big card uses both
    <div className={`turncard${n === max || (spend >= max && spend > n) ? ' full' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={n} aria-label={`Your turn: ${left}`} title={`Your turn: ${left}`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={`tp${i < n ? ' on' : ''}${spend > 0 && i >= a && i < b ? (spend > n ? ' short' : ' spend') : ''}`} />)}
    </div>
  )
}

// One lane, top to bottom: your soldiers hitting the enemy tower, the enemy's slot, the river, your slot, enemy soldiers hitting your tower.
// Each slot is one shared space, as on the table: the colour says whose card it is (yours black, the enemy's red).
// A soldier at a tower is drawn smaller, against that tower; a wounded one (it broke a card, one hit left) leans like a cracked card.
// The two cards that fight next tremble a little, so you see who meets whom before one of them is gone.
// A card at a tower is drawn in the lane slot next to that tower, first in the slot: new cards in that lane
// fight it there. A wounded one (it broke a tower card, one hit left) leans like a cracked card.
// On screen, the cards you placed this turn (grabbable) can be dragged out of their slot again until you end your turn.
// Tapped, one of them is picked (picked): tapping another card then switches the two.
// x2: while you hold a hand card, an enemy card it counts double against glows green ('good'), one that counts double against it red ('bad')
function ArenaLane({ idx, units, fighting, laneLen, blocked, dragging, hint, suggested, over, onPlace, grabbable = [], lifted, picked, onGrab, onTap, x2 }: { idx: 0 | 1; units: Unit[]; fighting: string[]; laneLen: number; blocked?: boolean; dragging: boolean; hint: boolean; suggested: boolean; over: boolean; onPlace: () => void; grabbable?: string[]; lifted?: string | null; picked?: string | null; onGrab?: (e: React.PointerEvent<HTMLElement>, tid: string) => void; onTap?: (tid: string) => void; x2?: (c: Card) => X2 }) {
  const atTower = (u: Unit) => (u.side === 'P' && u.pos >= laneLen) || (u.side === 'E' && u.pos < 0)
  const cards = (pred: (u: Unit) => boolean) => units.filter(u => u.lane === idx && pred(u)).sort((a, b) => +atTower(b) - +atTower(a))
  const card = (u: Unit, i: number) => (
    <div key={u.uid} style={{ '--i': i } as CSSProperties} className={`unit ${u.side} ${atTower(u) ? 'atk' : ''} ${u.wounded ? 'wounded' : ''} ${u.free ? 'free' : ''} ${fighting.includes(u.tid!) ? 'tremble' : ''} ${grabbable.includes(u.tid!) ? 'grab' : ''} ${lifted === u.tid ? 'lifted' : ''} ${u.side === 'E' && x2?.(u.card) ? `x2${x2(u.card)}` : ''}`}
      title={atTower(u) ? `${u.side === 'P' ? 'Your' : 'Enemy'} card at the tower: ${u.wounded ? 'wounded, it hits once more, then goes back to its pile' : 'it hits the tower this round'}` : u.free ? `${u.side === 'P' ? 'Your' : 'Enemy'} last stand: a tower in this lane fell, so this card came in free. It fights in the next round.` : grabbable.includes(u.tid!) ? 'Changed your mind? Drag it back to your hand or onto the other lane, or tap it, then tap another card to switch them' : undefined}
      onPointerDown={grabbable.includes(u.tid!) ? e => onGrab?.(e, u.tid!) : undefined}
      onClick={grabbable.includes(u.tid!) ? e => { e.stopPropagation(); onTap?.(u.tid!) } : undefined}>
      <TCard tid={u.tid!} card={u.card} down={false} side={u.side} selected={picked === u.tid} />
    </div>
  )
  // one shared space per slot: the colour says whose card it is (yours black, the enemy's red); yours first, then the enemy's
  // the cards of a slot are stacked, each shifted right so its rank and suit show; a crowded slot spreads them less
  const here = (pred: (u: Unit) => boolean) => {
    const list = [...cards(u => u.side === 'P' && pred(u)), ...cards(u => u.side === 'E' && pred(u))]
    return <div className="half" style={{ '--n': list.length } as CSSProperties}>{list.map(card)}</div>
  }
  return (
    <div className="alane">
      <div className="spot atk" />
      <div className="spot slot" data-anchor={`lane-${idx}`}>{here(u => u.pos === laneLen - 1 || (u.side === 'P' && u.pos >= laneLen))}</div>
      <div className="river" />
      {/* the slots between the two ends (one, in lanes of 3), drawn over the river */}
      {Array.from({ length: Math.max(0, laneLen - 2) }, (_, k) => laneLen - 2 - k).map(pos => (
        <div key={pos} className="spot slot middle" data-anchor={`lane-${idx}`}>{here(u => u.pos === pos)}</div>
      ))}
      <div className={`spot slot mine ${blocked ? 'blocked' : ''} ${dragging || hint || suggested ? 'droppable' : ''} ${dragging && over ? 'over' : ''} ${suggested ? 'suggested' : ''}`} data-lane={idx} data-anchor={`lane-${idx}`} onClick={hint || suggested ? onPlace : undefined}>
        {here(u => u.pos === 0 || (u.side === 'E' && u.pos < 0))}
      </div>
      <div className="spot atk" />
    </div>
  )
}

// A side's pile between its lanes: the Next card on top, the rest of the pile stacked out of sight under it.
// So a card that goes back to its pile slides there over the lanes (the middle column is drawn above them) and tucks in under the top card.
function ArenaPile({ slots, side }: { slots: { tid: string; card: Card | null }[]; side: 'P' | 'E' }) {
  return (
    <div className="ncard">
      {slots.map((x, i) => ({ x, i })).reverse().map(({ x, i }) => ( // the top card last, so it covers the others
        <div key={x.tid} className={i ? 'pileunder' : undefined}><TCard tid={x.tid} card={x.card} down={!x.card} side={side} showCost={side === 'P' && !i} /></div>
      ))}
    </div>
  )
}

// One side's Next card with its pile under it and the label below: the same component for the enemy (between the lanes) and for you (beside your hand), only the cards differ.
type X2 = 'good' | 'bad' | undefined
function NextPile({ slots, side, x2 }: { slots: { tid: string; card: Card | null }[]; side: 'P' | 'E'; x2?: X2 }) {
  return (
    <div className={`nextcard${side === 'P' ? ' mine' : ''}${x2 ? ` x2${x2}` : ''}`} title={side === 'P' ? 'Your next card: it comes into your hand when you play one' : undefined}>
      {slots.length ? <ArenaPile slots={slots} side={side} /> : <div className="cardph" />}
      {/* the enemy's next card is a runner: it says so before it comes, so its run never seems to come from nowhere */}
      <span>Next{side === 'E' && (slots[0]?.card?.rank ?? 99) <= 5 && <b className="run" title="A small card: it runs 2 slots a round"> »</b>}</span>
    </div>
  )
}

// ---------- setup at the real table: one step per screen, each with a picture ----------
// Mini cards for the pictures: face-down by default, or a known card face-up.
function Mc({ card, hot }: { card?: Card; hot?: boolean }) {
  return <PlayingCard card={card} className={`mc${hot ? ' hot' : ''}`} />
}
const backs = (n: number, gapAfter?: number, flipAt?: number) => Array.from({ length: n }, (_, i) => <Fragment key={i}>{i === gapAfter && <span className="mgap" />}<Mc card={i === flipAt ? { id: 'mk', rank: i + 1, suit: 0 } : undefined} hot={i === flipAt} /></Fragment>)

interface SetupStep { title: string; pic: ReactNode; body: ReactNode; ready?: boolean }
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
        {at < steps.length - 1 ? <button className="big" disabled={st.ready === false} onClick={() => setAt(at + 1)}>Next</button> : done}
      </div>
    </div>
  )
}

// Slots [from, to) a card would use: back from the end of what is left, or from the start when it needs more than is left.
function spendRange(n: number, spend: number, max: number): [number, number] {
  const from = Math.max(0, n - spend)
  return [from, Math.min(max, from + spend)]
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
// the enemy plays the red cards, you the black ones
// your deck at the table: the hand's places, then the queue's (top card first)
const HANDS = Array.from({ length: HAND_SIZE }, (_, i) => i), QUEUE = Array.from({ length: DECK_SIZE - HAND_SIZE }, (_, i) => HAND_SIZE + i)
const RED = [1, 2], BLACK = [0, 3]
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
          <button key={r} className={`fkey ${rank === r ? 'sel' : ''}`} disabled={suit !== null ? has(r, suit) : RED.every(s => has(r, s))}
            onClick={() => choose(rank === r ? null : r, suit)}>{RANKS[r]}</button>
        ))}
      </div>
      <div className="fsuits">
        {RED.map(s => (
          <button key={s} className={`fkey suit ${s === 1 || s === 2 ? 'red' : ''} ${suit === s ? 'sel' : ''}`} aria-label={['spades', 'hearts', 'diamonds', 'clubs'][s]}
            disabled={rank !== null ? has(rank, s) : ranks.every(r => has(r, s))} onClick={() => choose(rank, suit === s ? null : s)}>{SUITS[s]}</button>
        ))}
      </div>
    </div>
  )
}

function CardPicker({ disabled, onPick, selected, suits = [0, 1, 2, 3] }: { disabled: Set<string>; onPick: (c: Card) => void; selected?: Set<string>; suits?: number[] }) {
  return (
    <div className="picker">
      {suits.map(s => (
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
  enemy_stop: 'Enemy turn ends', step_up: 'A card steps up', fight: 'Fight', move: 'Move the cards', tower_enter: 'A tower is hit: flip its card',
  tower_result: 'Tower hit', my_last_stand: 'Last stand: place a free card', last_stand_enter: 'Enemy last stand: flip its top card', over: 'Game over',
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className={`logo${small ? ' small' : ''}`}>
      <svg className="crown" viewBox="0 0 64 40" aria-hidden><path d="M6 36 L2 8 L18 20 L32 2 L46 20 L62 8 L58 36 Z" /><circle cx="2" cy="8" r="4" /><circle cx="32" cy="3" r="4" /><circle cx="62" cy="8" r="4" /></svg>
      <span>SUITKEEP</span>
    </div>
  )
}

// Every rule is drawn as a real fight between cards. Suits: same rank, so only the wheel decides (the winner counts double).
// you play black and the enemy red, so only two of the four suit matchups ever happen: your ♠ over its ♥, its ♦ over your ♣
const WHEEL: [number, number][] = [[0, 1], [2, 3]]
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

// three short pages, one rule each: the cards say it, the words only name it
const CHEAT_PAGES = ['Suit ×2', 'Higher', 'Ace'] as const
// g: the game in progress, for examples from its cards; without one (How to play on the title screen), invented ones
function Cheat({ g }: { g?: GuideState }) {
  const [page, setPage] = useState(0)
  const pools = g ? gamePools(g) : [], [ace, pics] = acePair(pools), wheel = g?.rules.wheel ?? DEFAULT_RULES.wheel
  const x = wheelPair(WHEEL[0][0], WHEEL[0][1], wheel, pools)
  return (<div className="cheat">
    <div className="cheat-tabs" role="tablist">{CHEAT_PAGES.map((t, i) => <button key={t} role="tab" aria-selected={page === i} onClick={() => setPage(i)}>{t}</button>)}</div>
    {page === 1 && <>
      <p><b>Higher number wins.</b></p>
      <div className="fights"><Beats win={show({ id: 'h9', rank: 9, suit: 0 })} lose={show({ id: 'h4', rank: 4, suit: 3 })} winText="9" loseText="4" /></div>
      <p><small>A=1 · J=11 · Q=12 · K=13. Same number: the enemy wins.</small></p>
    </>}
    {page === 0 && <>
      <div className="loop" role="img" aria-label="Your spades beat the enemy's hearts, the enemy's diamonds beat your clubs">
        {WHEEL.map(([w, l]) => <span key={w}><b className={isRed({ id: '', rank: 1, suit: w }) ? 'rs' : ''}>{SUITS[w]}</b> beats <b className={isRed({ id: '', rank: 1, suit: l }) ? 'rs' : ''}>{SUITS[l]}</b><small>{isRed({ id: '', rank: 1, suit: w }) ? 'theirs' : 'yours'}</small></span>)}
      </div>
      <p><b>The suit that beats the other doubles its number.</b></p>
      <div className="suitwheel"><Beats win={show(x[0])} lose={show(x[1])} winText={<>{x[0].rank} ×{wheel} = <b>{x[0].rank * wheel}</b></>} loseText={x[1].rank} /></div>
      <p><small>{SUITS[x[0].suit]} beats {SUITS[x[1].suit]}, so the {RANKS[x[0].rank]} counts {x[0].rank * wheel}. {x[0].rank * wheel} is more than {x[1].rank}, so the {SUITS[x[0].suit]} wins.</small></p>
    </>}
    {page === 2 && <>
      <p><b>Ace beats King.</b></p>
      <div className="fights"><Beats win={show(ace)} lose={<>{pics.map(c => <Fragment key={c.id}>{show(c)}</Fragment>)}</>} /></div>
      <p><small>Even at towers, and for the enemy too.</small></p>
    </>}
  </div>)
}
const cheatSheet = (g: GuideState) => <Cheat g={g} />

// How to play: one topic per rule. The lines alone are the whole game in short; each page says the rest, with cards where it can.
const towerFight = (win: Card, winText: string, lose: Card, loseText: string) => <div className="fights"><Beats win={show(win)} lose={show(lose)} winText={winText} loseText={loseText} /></div>
const RULES: Topic[] = [
  { id: 'goal', icon: <Crown />, title: 'Goal', line: "Break the enemy's king tower before it breaks yours.", body: <>
    <p>Each side has three towers of 1 card: one on the left, one on the right, and the <b>king</b> in the middle, the crowned one.</p>
    <p>The king can only be hit through a lane whose side tower is gone.</p>
    <p>If both kings fall in the same round, the side with more side towers left wins. It's a draw only when that's equal too.</p>
  </> },
  { id: 'fights', icon: <Swords />, title: 'Fights', line: 'Higher rank wins, the winning suit counts ×2, aces beat Kings.', body: <>
    <p>Your cards are soldiers. When two meet in a lane, they fight, and the loser goes back to its pile.</p>
    <Cheat />
  </> },
  { id: 'turn', icon: <Hand />, title: 'Your turn', line: 'Play 1 card a round, or 2 small cards (A to 5).', body: <>
    <p>Each round you play <b>1 card</b>, or <b>2 small cards</b> (A to 5). You may also play nothing.</p>
    <p>The dots on a card say how much of your turn it uses: a small card <b>one dot</b>, any other card <b>two</b>, your whole turn. The bar under the ✓ button, right of your hand, shows what is left of your turn: two halves, a small card uses one, any other card both. Nothing carries over to the next round.</p>
    <p>The enemy plays <b>2 cards every round</b>, the top two of its pile, whatever they are.</p>
  </> },
  { id: 'round', icon: <Repeat />, title: 'A round', line: 'You play, the enemy defends, the front cards fight, all move up: small cards run 2.', body: <ol className="m-0 list-decimal pl-5">
    <li><b>You play</b> cards into a lane.</li>
    <li>The <b>enemy</b> plays 2 cards: the first into the lane where you have <b>more</b> cards (on a tie, where your highest card is, then left), the second into the <b>other</b> lane.</li>
    <li>The front cards <b>fight</b> where they stand. When one falls, the card behind it steps up and fights the winner.</li>
    <li>Every card that hasn't moved <b>moves</b> one slot, and small cards (A to 5) <b>run</b> two. A card that reaches the other end hits a tower.</li>
  </ol> },
  { id: 'towers', icon: <CastleIcon />, title: 'Towers', line: 'Every tower card takes two hits: the first cracks it, the next breaks it.', body: <>
    <p>A tower card is <b>armored</b>: the first hit only <b>cracks</b> it (turn it sideways), and the next hit <b>breaks</b> it, whatever card hits it.</p>
    <p>A hit is still a fight against the tower card, and suit ×2 and aces count here too. It decides what happens to your soldier:</p>
    {towerFight({ id: 't9-0', rank: 9, suit: 0 }, 'soldier: stays', { id: 't7-2', rank: 7, suit: 2 }, 'tower: cracks')}
    <p><b>Win:</b> your soldier stays, turned sideways (wounded), and hits once more next round: that hit breaks the cracked card. Then it goes back to its pile.</p>
    {towerFight({ id: 't12-2', rank: 12, suit: 2 }, 'tower: cracks', { id: 't5-0', rank: 5, suit: 0 }, 'soldier: shot back')}
    <p><b>Lose or tie</b> (ties go to the enemy): the tower shoots it back to its pile, but the tower card cracks anyway, so the next hit breaks it.</p>
  </> },
  { id: 'stand', icon: <Shield />, title: 'Last stand', line: 'Lose a side tower, and you place one card there for free.', body: <>
    <p>When a left or right tower falls, its owner immediately places one card in that lane for free: it isn't part of anyone's turn.</p>
    <p>The enemy uses the top card of its pile.</p>
  </> },
  { id: 'pile', icon: <Layers />, title: 'Your pile', line: 'Cards that die come back later: your 8 keep cycling.', body: <>
    <p>A card that dies goes to the <b>bottom of its owner's pile</b>, and comes back to the hand later.</p>
    <p>Nothing is lost for good: a small card you lose now is back in a few rounds.</p>
  </> },
]

// First games teach by playing: one tip at a time, each shown the first time its situation comes up (on screen, the enemy waits while it is open).
// The goal comes first, so every rule after it has something to serve; each tip says one thing. The fight rules come one at a time,
// each when it first decides a fight (the first game's fixed deal shows them in this order: rank, then suit, then ace).
// (the turn, enemy and armor tips are new with the 22-card rules: their ids are new too, so players who saw the old ones see them)
type TipId = 'goal' | 'drag' | 'turn' | 'change' | 'enemy2' | 'rank' | 'suit' | 'x2' | 'ace' | 'run' | 'armor' | 'crack' | 'next' | 'stand'
const TIPS: Record<TipId, string> = {
  goal: "Goal: break the enemy's king, the crowned castle at the top. Your cards are soldiers.",
  drag: 'Drag a card from your hand onto a lane. Each round: 1 card, or 2 small ones (A to 5).',
  turn: 'The dots on a card show how much of your turn it uses: a small card one, a big card two. The bar under ✓ shows what is left. Done? Press ✓ and the enemy moves.',
  change: 'Changed your mind? Before ✓, drag a placed card back to your hand or to the other lane.',
  enemy2: 'The enemy plays 2 cards a round: the first defends the lane where you have more cards, the second goes into the other lane. Its Next card, at the top, is the first it plays.',
  rank: 'Cards fight where they meet: the higher number wins (J is 11, Q 12, K 13). Equal? The enemy wins. The loser goes back to its pile.',
  suit: 'Suits beat each other in a circle:\n♠ beats ♥ beats ♦ beats ♣ beats ♠. The winning suit counts ×2. The ⚔ button, top right, shows it again.',
  ace: 'Aces beat Kings! The smallest card beats the biggest, whatever the suits.',
  x2: 'Holding a card? A green glow: your card counts ×2 against that enemy card (♠ beats ♥). A red glow: that card counts ×2 against yours (♦ beats ♣).',
  run: 'Small cards (A to 5) run »: they move 2 slots a round, so they reach a tower fast. The enemy\'s small cards run too: » on its Next card warns you.',
  armor: 'Tower cards are armored: the first hit cracks them, the next breaks them. A card that wins its hit stays for that next hit. The king is safe until its side tower falls.',
  crack: 'Lost at a tower? The card goes back to its pile, but the tower card still cracks: the next hit breaks it.',
  next: 'Your Next card, left of your hand, comes into your hand each time you play one. Cards that die go to the bottom of their pile and come back later.',
  stand: 'LAST STAND! When a side tower falls, its owner puts one card into that lane for free.',
}
// with real cards the towers are the fanned cards on the table, not castles
const TABLE_TIPS: Partial<Record<TipId, string>> = {
  goal: "Goal: break the enemy's king, the middle tower across the table. Your cards are soldiers.",
  drag: 'Drag a card onto a lane at the bottom. Each round: 1 card, or 2 small ones (A to 5).',
  enemy2: 'The enemy plays 2 cards a round: the first defends the lane where you have more cards, the second goes into the other lane.',
  change: 'Wrong card? Undo, top right, takes back any step.',
  armor: 'Tower cards are armored: the first hit cracks them (turn it sideways), the next breaks them. A card that wins its hit stays for that next hit. The king is safe until its side tower falls.',
  crack: 'Lost at a tower? The card goes back to its pile, but turn the tower card sideways anyway: the next hit breaks it.',
  run: 'Small cards (A to 5) run: move them 2 slots instead of 1, yours and the enemy\'s, unless an enemy card is in their slot after the first.',
  next: 'When you play a card, draw the top of your pile. Cards that die go to the bottom of it.',
}
const DEBUG = import.meta.env.DEV || new URLSearchParams(location.search).has('debug')
const TIPS_KEY = 'suitkeep-tips-seen'
const PLAYED_KEY = 'suitkeep-games-played' // games finished, per mode: a player who has finished none gets a ready-made deck and help on
type Played = { play: number; guide: number }
// what a player's first game did for them, so its end can say so and the next game can turn the help off again
interface Intro { deck: boolean; help: boolean }
const PULSES = ['pulseop', 'pulsedone', 'flipglow']
// what a game state works out to (a suggestion, the cards about to fight) is worked out once per state, not on every render
const caches = new WeakMap<(g: GuideState) => unknown, WeakMap<GuideState, unknown>>()
function cached<T>(f: (g: GuideState) => T, g: GuideState): T {
  let c = caches.get(f)
  if (!c) caches.set(f, c = new WeakMap())
  if (!c.has(g)) c.set(g, f(g))
  return c.get(g) as T
}
const whenIdle = (f: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 1500 }) : window.setTimeout(f, 300))
const cancelIdle = (id: number) => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id))
const readJSON = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback } }
const writeJSON = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* storage full or blocked */ } }

const AUTO_STAGES = ['round_start', 'enemy_play', 'enemy_peek', 'enemy_stop', 'step_up', 'fight', 'move', 'tower_enter', 'tower_result']
// hold each step longer the more it shows (one line per event), so busy fights can be followed; fast halves it
const autoDelay = (events: number, fast = false) => Math.min(4000, 700 + 600 * events) * (fast ? 0.5 : 1)
const FAST_KEY = 'suitkeep-fast'
const BATCH_KEY = 'suitkeep-batch' // real cards: a round's fights and moves as one checklist (unset: on after 2 games at the table)
const RECORD_KEY = 'suitkeep-record'
const DEAL_KEY = 'suitkeep-deal' // on screen: the deal you were given and haven't played yet
const STARTED_KEY = 'suitkeep-games-started' // games begun, every mode together: the stats count first and second games
const modeName = (m: 'guide' | 'play') => (m === 'play' ? 'screen' : 'cards')
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
  const [bad, setBad] = useState<number | null>(null) // a card tapped that doesn't fit in what is left of your turn
  const [explainOn, setExplainOn] = useState(saved ? saved.help === 'explain' : false)
  const [suggestOn, setSuggestOn] = useState(saved ? saved.help === 'suggest' : false)
  const help: Help = suggestOn ? 'suggest' : explainOn ? 'explain' : 'off'
  // with real cards the player shuffles their own deck and taps its 8 cards here as they come: the hand cards, then the queue top first
  const [order, setOrder] = useState<string[]>(saved?.order ?? [])
  const [game, setGame] = useState<GuideState | null>(saved?.game ?? null)
  const [history, setHistory] = useState<GuideState[]>(saved?.history ?? [])
  // (a player from before games were counted, who has seen tips past the first turn, has played: count one game)
  const [played, setPlayed] = useState<Played>(() => readJSON(PLAYED_KEY, readJSON<string[]>(TIPS_KEY, []).length >= 3 ? { play: 1, guide: 0 } : { play: 0, guide: 0 }))
  const novice = played.play + played.guide === 0 // has never finished a game: the first one comes with its deck built
  const [intro, setIntro] = useState<Intro | null>(saved?.intro ?? null)
  const [counted, setCounted] = useState(saved?.counted ?? false)
  // a finished game can be looked through with undo and redo (View board), but not changed: no move, step or Done goes through
  const reviewing = screen === 'play' && counted
  const [record, setRecord] = useState<GameRecord>(() => readJSON(RECORD_KEY, { games: 0, wins: 0 }))
  const [newBest, setNewBest] = useState(false)
  const [fast, setFastState] = useState<boolean>(() => readJSON(FAST_KEY, false))
  const setFast = (on: boolean) => { setFastState(on); writeJSON(FAST_KEY, on) }
  const [batchPref, setBatchPref] = useState<boolean | null>(() => readJSON<boolean | null>(BATCH_KEY, null))
  const batchOn = batchPref ?? false // one thing to do at a time, until you ask for the whole round as a list
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
  const [musicOff, setMusicOffState] = useState(isMusicOff)
  const toggleMusic = () => { setMusicOff(!musicOff); setMusicOffState(!musicOff) }
  // the title theme on the title and setup pages, a game's loop while playing (louder once a king stands open: a side tower has
  // fallen), and quiet once the game is over, so its fanfare plays alone
  const scene = screen !== 'play' || !game ? 'title' : game.stage === 'over' ? 'none' : 'game'
  const kingOpen = !!game && (['L', 'R'] as const).some(k => !game.P.towers[k].length || !game.E.towers[k].length)
  useEffect(() => { music(scene, kingOpen) }, [scene, kingOpen])
  // the hint and drop-target pulses beat together: every one is pinned to the page clock, whenever it appeared
  // (document.getAnimations() makes the browser work out every style, so only when something that pulses may have come or gone)
  useEffect(() => {
    const f = requestAnimationFrame(() => {
      for (const a of document.getAnimations()) if (a instanceof CSSAnimation && PULSES.includes(a.animationName) && a.startTime !== 0) a.startTime = 0
    })
    return () => cancelAnimationFrame(f)
  }, [game, screen, sel, drag, lift, pick, suggestOn])
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
  const playRef = useRef<HTMLDivElement>(null)
  const fx = useFx(game, fresh.current, playRef, mode === 'play' && fast ? 1.6 : 1)
  // a step with fights or tower hits is shown once they have struck on the board as it was (see fx.ts). Anything done during a
  // strike was meant for the step before it, so it only skips the strike to its end.
  const [striking, setStriking] = useState(false) // real cards: the table panel stays away while the board plays a step
  const advance = (g: GuideState) => {
    if (fx.striking()) return fx.land()
    fresh.current = g
    if (fx.strike(g, () => { setStriking(false); setGame(g) })) setStriking(true)
    else setGame(g)
  }
  // real cards: a fresh step plays out on the board first, and only then asks for your hands (the panel waits a beat for the cards to settle)
  const [openFor, setOpenFor] = useState<GuideState | null>(null)
  useEffect(() => {
    if (mode !== 'guide' || !game || game !== fresh.current) return
    const t = setTimeout(() => setOpenFor(game), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 550)
    return () => clearTimeout(t)
  }, [mode, game])
  const settled = mode !== 'guide' || game !== fresh.current || game === openFor
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
    // the card you hold makes an enemy card glow (the suit wheel, before you play): the x2 tip says what the glow means
    const holding = drag ?? sel, held = holding !== null ? game.P.hand[holding] : undefined
    const doubles = (a: Card, b: Card) => effective(a, b, game.rules.wheel) > a.rank
    const glowing = !!held && [...game.units.filter(u => u.side === 'E').map(u => u.card), game.E.queue[0]?.card].some(c => !!c && (doubles(held, c) || doubles(c, held)))
    const next: TipId | undefined = ([
      ['stand', game.stage === 'my_last_stand' || happened(e => e.type === 'play' && !!e.free)],
      ['goal', firstPlay],
      ['drag', firstPlay],
      ['turn', happened(e => e.type === 'play' && e.side === 'P')],
      ['change', happened(e => e.type === 'play' && e.side === 'P') && game.stats.placed >= 2],
      ['enemy2', happened(e => e.type === 'play' && e.side === 'E')],
      ['rank', happened(e => e.type === 'fight')],
      ['suit', happened(e => e.type === 'fight' && !!e.double)],
      ['ace', happened(e => e.type === 'fight' && !!e.ace)],
      ['x2', game.stage === 'my_play' && glowing],
      ['run', happened(e => e.type === 'move' && !!e.ran?.length)],
      ['armor', happened(e => e.type === 'tower')],
      ['crack', happened(e => e.type === 'tower' && e.result === 'crack' && !e.armor)],
      ['next', game.stage === 'my_play' && game.round >= 2],
    ] as [TipId, boolean][]).find(([id, now]) => now && wants(id))?.[0]
    if (next) setTip(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, screen, tip, sel, drag]) // when a tip closes, the next one the same step called for comes up; holding a card can call one
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

  // saved when the browser is idle, not in the middle of a step's animations (the history makes it a big write), and always before the page goes away
  const toSave = useRef<Saved | null>(null)
  useEffect(() => {
    // looking back through a finished game saves its end, so a reload can't pick the game up again at an earlier step
    const end = reviewing && future.length ? { game: future[0], history: [...history, game!, ...future.slice(1).reverse()] } : { game, history }
    toSave.current = { mode, secret, screen, dealt, deckIds, slotIds, help, order, game: end.game, history: end.history.slice(-60), intro, counted }
    const id = whenIdle(saveNow)
    return () => cancelIdle(id)
  }, [mode, secret, screen, dealt, deckIds, slotIds, help, order, game, history, future, intro, counted, reviewing])
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') saveNow() }
    // closing the tab mid-game: the stats see where it stopped (the game is saved, so it may still be picked up again)
    const close = () => {
      const s = toSave.current
      if (s?.screen === 'play' && s.game && s.game.stage !== 'over') track('game-close', { mode: modeName(s.mode ?? 'guide'), round: s.game.round })
    }
    addEventListener('pagehide', saveNow); addEventListener('pagehide', close); document.addEventListener('visibilitychange', flush)
    return () => { removeEventListener('pagehide', saveNow); removeEventListener('pagehide', close); document.removeEventListener('visibilitychange', flush) }
  }, [])
  function saveNow() {
    const s = toSave.current
    if (!s) return
    toSave.current = null
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* storage full: ignore */ }
  }
  // the whole log as text, to keep or send: what was dealt and built, the result, then every line of the game
  const logText = (g: GuideState) => {
    const cards = (ids: string[]) => ids.map(id => label(byId(id))).join(' ')
    const help = mode === 'play' ? (suggestOn ? 'suggestions on' : 'suggestions off') : (explainOn ? 'explanations on' : 'explanations off')
    const head = [
      'Suitkeep game log', new Date().toLocaleString(), `Mode: ${mode === 'guide' ? 'real cards' : 'on screen'} (${help}${intro?.deck ? ', first game' : ''})`,
      `Rules: 22 cards, aces beat kings${g.rules.aceMin === 13 ? ' only' : ''}, the enemy plays ${g.rules.enemyPlays ?? 1} a round${g.rules.armor ? ', armored towers' : ''}${g.rules.runners ? ', small cards run 2 slots' : ''}, lanes of ${g.rules.laneLen}`,
      g.stage === 'over' ? `Result: ${g.winner === 'P' ? 'you won' : g.winner === 'E' ? 'you lost' : 'draw'} after ${g.round} rounds` : `Unfinished: round ${g.round}`,
      `Your ${g.dealt.length} cards: ${g.dealt.map(label).join(' ')} (${g.dealt.filter(c => c.rank === 1).length} aces)`,
      deckIds.length ? `Your deck: ${cards(deckIds)}` : '', slotIds.length ? `Your towers (left, right, king): ${cards(slotIds)}` : '',
      g.enemySeen.length ? `Enemy cards seen: ${g.enemySeen.map(label).join(' ')}` : '',
      `Your record before this log: ${record.wins} wins in ${record.games} games`, '']
    return [...head.filter(l => l !== '' || l === head.at(-1)), ...g.log].join('\n') + '\n'
  }
  const [past, setPast] = useState<PastGame[]>(readHistory)
  // a finished game counts once (not again when undo and redo pass the end)
  useEffect(() => {
    if (screen !== 'play' || game?.stage !== 'over' || counted) return
    const n = { ...played, [mode]: played[mode] + 1 }
    setCounted(true); setPlayed(n); writeJSON(PLAYED_KEY, n)
    const won = game.winner === 'P', best = won && (record.best === undefined || game.round < record.best)
    const rec: GameRecord = { games: record.games + 1, wins: record.wins + (won ? 1 : 0), best: best ? game.round : record.best }
    setPast(addGame({ at: new Date().toISOString(), mode, result: won ? 'win' : game.winner === 'E' ? 'loss' : 'draw', rounds: game.round, runners: !!game.rules.runners, text: logText(game) }))
    setRecord(rec); writeJSON(RECORD_KEY, rec); setNewBest(best && record.wins > 0) // a first win is its own news
    track('game-end', { mode: modeName(mode), result: won ? 'win' : game.winner === 'E' ? 'loss' : 'draw', rounds: game.round, runs: game.stats.runs ?? 0, runHits: game.stats.runHits ?? 0, enemyRunHits: game.stats.enemyRunHits ?? 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.stage, screen])
  // every round a game reaches counts once (not again when undo and redo pass it), so the stats show the round where games stop
  const reached = useRef(game?.round ?? 0)
  useEffect(() => {
    if (screen !== 'play' || !game || game.round <= reached.current) return
    reached.current = game.round
    track('round', { mode: modeName(mode), n: game.round })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.round, screen])

  // on screen, informational steps advance by themselves, slowly enough to follow what happens; not recorded for undo
  useEffect(() => {
    if (mode !== 'play' || screen !== 'play' || !game || tip || reviewing || !AUTO_STAGES.includes(game.stage)) return
    // the strike that showed this step counts toward its time
    const t = setTimeout(() => advance(settle(next(game))), Math.max(400, autoDelay(game.lines.length, fast) - fx.held(game)))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, screen, game, tip, fast, reviewing])
  // with real cards too, a new round goes straight to your turn: nothing moves on the table at its start, so a Done there would be a tap
  // for nothing (the round chip counts it, as on screen); the enemy card to flip, if any, still waits for you
  useEffect(() => {
    if (mode !== 'guide' || screen !== 'play' || !game || tip || reviewing || game.stage !== 'round_start') return
    advance(batch(next(game)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, screen, game, tip, reviewing])
  // when no card in hand fits in what is left of your turn, ending it is the only move, so it ends by itself; not recorded for undo,
  // so undo goes back past it to your last real choice instead of landing here and ending again
  useEffect(() => {
    if (screen !== 'play' || !game || tip || reviewing || game.stage !== 'my_play' || game.P.hand.some((_, i) => canPlay(game, i))) return
    if (mode === 'guide' && game.lastAction.length > 0 && doSeen !== game.log.length) return // still placing at the table
    if (mode === 'play' && game.turn?.length) return // you played: your turn is a draft until you tap Done, so you can still take a card back
    const t = setTimeout(() => advance(settle(endMyTurn(game))), autoDelay(game.lines.length))
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, screen, game, tip, doSeen, reviewing])

  const mine = dealt.map(byId).sort((a, b) => b.rank - a.rank || a.suit - b.suit)
  const deck = mine.filter(c => deckIds.includes(c.id))

  const reset = () => {
    if (screen === 'play' && game && game.stage !== 'over') track('game-leave', { mode: modeName(mode), round: game.round })
    else if (screen !== 'title' && screen !== 'play') track('setup-leave', { mode: modeName(mode), step: screen })
    fx.land()
    setTip(null)
    setScreen('title'); setDealt([]); setDeckIds([]); setSlotIds([]); setOrder([]); setGame(null); setHistory([]); setFuture([]); setSel(null); setMode('guide'); setSecret({}); setIntro(null)
  }
  // the game begins. A player's first game: on screen, suggestions are on (a first game is hard to win, and each suggestion says
  // why); with real cards for the first time, every step says why. Their next game turns that off again.
  const begin = (g: GuideState, m: 'play' | 'guide') => {
    if (m === 'play') writeJSON(DEAL_KEY, null) // the deal is played: the next game deals anew
    const help = m === 'play' ? novice : played.guide === 0
    if (help) { if (m === 'play') setSuggestOn(true); else setExplainOn(true) }
    setIntro(novice || help ? { deck: novice, help } : null)
    const n = readJSON(STARTED_KEY, 0) + 1
    writeJSON(STARTED_KEY, n); reached.current = 0
    track('game-start', { mode: modeName(m), game: n < 6 ? String(n) : '6+', first: novice })
    if (n <= 2) track(n === 1 ? 'first-game' : 'second-game', { mode: modeName(m) })
    fx.land()
    advance(startRound(g)); setHistory([]); setFuture([]); setOrder([]); setCounted(false); setScreen('play')
  }
  const settle = (g: GuideState) => (mode === 'play' ? autoReveal(g, secret) : g)
  const commit = (g: GuideState) => { if (reviewing) return; if (fx.striking()) return fx.land(); setHistory(h => [...h, game!]); setFuture([]); advance(settle(g)); setSel(null); setBad(null); setPick(null) }
  const undo = () => { if (fx.striking()) return fx.land(); if (!history.length || !game) return; browsing.current = true; fresh.current = null; if (history[history.length - 1].stage === 'over') { setOverSeen(true); setResultViewed(true) } setFuture(f => [...f, game]); setGame(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setSel(null); setBad(null) }
  const redo = () => { if (fx.striking()) return fx.land(); if (!future.length || !game) return; browsing.current = true; fresh.current = null; if (future[future.length - 1].stage === 'over') { setOverSeen(true); setResultViewed(true) } setHistory(h => [...h, game]); setGame(future[future.length - 1]); setFuture(f => f.slice(0, -1)); setSel(null); setBad(null) }

  const setSplit = ({ deckIds, slotIds }: { deckIds: string[]; slotIds: string[] }) => { setDeckIds(deckIds); setSlotIds(slotIds) }
  // on-screen play: deal both hands at random; the enemy's cards stay hidden inside the app (tid ep0-7 = pile, et0-2 = towers)
  // One deal per game, as at the table: a deal you leave without playing is still yours next time you tap Play, so dealing
  // again until you like your cards isn't a way to win (it was, and the players who found it stopped meeting the real game).
  const startOnScreen = () => {
    if (novice) return startTutorial()
    const kept = readJSON<{ mine: string[]; secret: Record<string, Card> } | null>(DEAL_KEY, null)
    const d = kept ?? (() => {
      const { mine, theirs } = deal(secureRandom)
      const enemy = shuffle(theirs, secureRandom)
      return { mine: mine.map(c => c.id), secret: Object.fromEntries(enemy.map((c, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, c])) }
    })()
    if (!kept) writeJSON(DEAL_KEY, d)
    setSecret(d.secret)
    setMode('play'); setDealt(d.mine)
    setSplit(randomSetup(d.mine.map(byId), secureRandom)); setScreen('draft')
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

  // the setup pages' top bar: where you are and one menu for everything else (in a game, the field's corners hold these)
  const bar = (mid?: ReactNode) => (
    <div className="topbar">
      <Logo small />
      <span className="modechip">{mode === 'play' ? 'On screen' : 'Real cards'}</span>
      {mid}
      <span className="spacer" />
      <GameMenu topics={RULES} muted={muted} toggleMute={toggleMute} musicOff={musicOff} toggleMusic={toggleMusic} onLeave={reset} past={past} />
    </div>
  )

  // ---------- title ----------
  if (screen === 'title') {
    const fan = ['1-0', '13-1', '12-2'].map(byId)
    return (
      <div className="title">
        <span className="titlemenu"><GameMenu muted={muted} toggleMute={toggleMute} musicOff={musicOff} toggleMusic={toggleMusic} past={past} /></span>
        <div className="titlefan" aria-hidden>{fan.map(c => <PlayingCard key={c.id} card={c} />)}</div>
        <Logo />
        <p className="tagline">A solo card battle, one deck</p>
        {record.games > 0 && <p className="record">{record.wins} {record.wins === 1 ? 'win' : 'wins'} in {record.games} {record.games === 1 ? 'game' : 'games'}{record.best !== undefined && ` · fastest win: ${record.best} rounds`}</p>}
        <div className="menu">
          <button className="big xl" onClick={startOnScreen}>Play<small>the app deals and plays the enemy</small></button>
          <button className="xl" onClick={() => { track('cards-open'); setMode('guide'); setScreen('deal') }}>Play with real cards<small>you play at the table, the app guides you</small></button>
          <HowToPlay topics={RULES}><Button variant="success" size="xl">How to play</Button></HowToPlay>
          <InstallLink />
        </div>
      </div>
    )
  }

  // ---------- setup screens ----------
  if (screen === 'deal') {
    const blacks = ['13-0', '7-3', '1-0', '10-3', '4-0'].map(byId), reds = ['12-1', '3-2', '9-1', '1-2', '6-2'].map(byId)
    const steps: SetupStep[] = [
      { title: 'Split the deck by colour', pic: <div className="mcols"><div><div className="mfan">{blacks.map(c => <Mc key={c.id} card={c} />)}</div><span className="mlbl">Black: ♠ ♣</span></div><div><div className="mfan">{reds.map(c => <Mc key={c.id} card={c} />)}</div><span className="mlbl">Red: ♥ ♦</span></div></div>,
        body: <p>Take a standard 52-card deck, <b>no jokers</b>, and sort it into two piles: the <b>black</b> cards (♠ ♣) are yours, the <b>red</b> cards (♥ ♦) are the enemy's.</p> },
      { title: 'Deal 11 cards each', pic: <div className="mcols"><div><div className="mfan">{blacks.map(c => <Mc key={c.id} card={c} />)}<span className="more">+6</span></div><span className="mlbl">You: 11 black, face-up in your hand</span></div><div><div className="mstack">{backs(6)}</div><span className="mlbl">Enemy: 11 red, face-down</span></div></div>,
        body: <p><b>Shuffle the black pile</b> and take the top <b>11</b>: look at them. Turn the red pile face-down, <b>shuffle it</b> and deal <b>11 face-down to the enemy</b> without looking. Put the <b>other 30 cards back in the box</b> without looking: they sit this game out, so you never know which red cards the enemy has.</p> },
    ]
    return (
      <div className="page">{bar()}
        <h1>1. Deal the cards</h1>
        {played.play === 0 && setupStep === 0 && (
          <Alert className="mx-auto mt-2.5 max-w-[680px] border-(--gold-d) bg-black/25 text-base">
            <Lightbulb className="text-primary" />
            <AlertTitle className="font-heading text-lg font-normal tracking-wide">New to Suitkeep?</AlertTitle>
            <AlertDescription className="text-base text-foreground/90">
              <p className="m-0">One game on screen (about 5 minutes) teaches the rules. Then the table only adds the cards.</p>
              <Button variant="secondary" className="mt-2" onClick={startOnScreen}>Play on screen first</Button>
            </AlertDescription>
          </Alert>
        )}
        <Stepper steps={steps} at={setupStep} setAt={setSetupStep} done={<button className="big" onClick={() => setScreen('enter')}>Done — I have my 11 cards</button>} />
      </div>
    )
  }

  if (screen === 'enter') {
    const set = new Set(dealt)
    return (
      <div className="page">{bar()}
        <h1>2. Tell me your {PER_SIDE} cards</h1>
        <p className="help">Tap each card you were dealt. <b>{dealt.length}/{PER_SIDE}</b> selected. Tap again to deselect.</p>
        <CardPicker disabled={new Set()} suits={BLACK} selected={set} onPick={c => setDealt(a => a.includes(c.id) ? a.filter(x => x !== c.id) : a.length < PER_SIDE ? [...a, c.id] : a)} />
        <div className="row">
          <button className="big" disabled={dealt.length !== PER_SIDE} onClick={() => {
            if (!novice) { setSplit(randomSetup(mine, secureRandom)); setScreen('draft'); return }
            // a first game skips the deck screen: the app picks a good split, and the table steps say which card goes where
            const s = suggestSetup(mine)
            setSplit(s); setOrder([]); setScreen('table')
          }}>{novice ? 'Next: set up the table' : 'Next: build my deck'}</button>
          <button onClick={() => setDealt([])}>Clear</button>
        </div>
      </div>
    )
  }

  if (screen === 'draft') {
    const go = mode === 'play'
      ? <button className="big" onClick={() => begin(makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES), 'play')}>Start the game</button>
      : <button className="big" onClick={() => { setOrder([]); setScreen('table') }}>Next: set up the table</button>
    return <DeckBuilder mine={mine} deckIds={deckIds} slotIds={slotIds} onChange={(d, t) => { setDeckIds(d); setSlotIds(t) }}
      title={mode === 'play' ? 'Build your deck' : '3. Build your deck'} bar={bar} start={go} />
  }

  if (screen === 'table') {
    const g = makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES, true)
    const tapped = order.filter(id => deckIds.includes(id))
    const n = tapped.length
    const tap = (id: string) => setOrder(tapped.includes(id) ? tapped.filter(x => x !== id) : n < DECK_SIZE ? [...tapped, id] : tapped)
    const stack = (name: string, cards: Card[]) => <div className="mtower"><div className="mrow">{cards.map((c, i) => <Mc key={c.id} card={c} hot={i === 0} />)}</div><span className="mlbl">{name}</span></div>
    const eStack = (name: string, n: number) => <div className="mtower"><div className="mrow">{backs(n)}</div><span className="mlbl">{name}</span></div>
    const steps: SetupStep[] = [
      { title: 'Build your three towers', pic: <div className="mcols">{stack('Left', g.P.towers.L)}{stack('King', g.P.towers.K)}{stack('Right', g.P.towers.R)}</div>,
        body: <p>{novice && <>For your first game I picked your deck and towers; next game you build your own. </>}Put three cards <b>face-up</b> in a row in front of you: <b>Left</b> {g.P.towers.L.map(label).join(' · ')}, <b>King</b> {g.P.towers.K.map(label).join(' · ')} in the middle, <b>Right</b> {g.P.towers.R.map(label).join(' · ')}. Each one is a tower.</p> },
      { title: 'Your hand and your pile', ready: n === DECK_SIZE,
        pic: <div className="mbars"><span className="mlbl">Hand, face-up</span><div className="row">{HANDS.map(i => <PlayingCard key={i} card={tapped[i] ? byId(tapped[i]) : undefined} showCost={!!tapped[i]} className={tapped[i] ? '' : 'mtodo'} />)}</div>
          <span className="mlbl">Pile, face-up stack, top card first</span><div className="mrow">{QUEUE.map(i => <PlayingCard key={i} card={tapped[i] ? byId(tapped[i]) : undefined} className={`mc${tapped[i] ? '' : ' mtodo'}`} />)}</div></div>,
        body: <>
          <p><b>Shuffle your 8 deck cards</b> and take the top <b>{HAND_SIZE} into your hand</b>. Put the other <b>{DECK_SIZE - HAND_SIZE} face-up</b> in a stack: that's your pile, and its top card is the one you draw next.</p>
          <p>{n < HAND_SIZE ? <>Tap your <b>{HAND_SIZE} hand cards</b> here ({n}/{HAND_SIZE}).</>
            : n < DECK_SIZE ? <>Now fan your queue and tap its cards, <b>top card first</b> ({n - HAND_SIZE}/{DECK_SIZE - HAND_SIZE}). Then square it again.</>
            : <>Got it: I know your hand and the order of your queue.</>}</p>
          <div className="picker"><div className="prow">{deck.map(c => (
            <button key={c.id} disabled={!tapped.includes(c.id) && n >= DECK_SIZE} className={`pbtn ${isRed(c) ? 'red' : ''} ${tapped.includes(c.id) ? 'sel' : ''}`} onClick={() => tap(c.id)}>{RANKS[c.rank]}{SUITS[c.suit]}</button>
          ))}</div></div>
          {n > 0 && <button onClick={() => setOrder([])}>Start over</button>}
        </> },
      { title: "The enemy's side", pic: <div className="mcols"><div className="mtower"><div className="mstack">{backs(6)}</div><span className="mlbl">Pile: 8</span></div>{eStack('Left', 1)}{eStack('King', 1)}{eStack('Right', 1)}</div>,
        body: <p>Shuffle the enemy's 11 cards <b>without looking</b>. Put <b>8</b> face-down as its <b>pile</b>. With the other 3, make its towers across the table, <b>face-down</b>, one card each: <b>Left</b>, <b>King</b>, <b>Right</b>.</p> },
      { title: 'The table', pic: (
          <div className="mtable">
            <span>Enemy pile</span><span className="mt-them">Enemy Left</span><span className="mt-them">Enemy King</span><span className="mt-them">Enemy Right</span><span>Enemy discard</span>
            <span className="mt-lane l"><i>yours ↑<br />enemy's ↓</i></span><span className="mt-lane r"><i>yours ↑<br />enemy's ↓</i></span>
            <span>Your queue</span><span className="mt-me">Your Left</span><span className="mt-me">Your King</span><span className="mt-me">Your Right</span><span>Your discard</span>
          </div>),
        body: <p>Your towers in a row in front of you, the enemy's across the table. Between them, <b>two lanes of 3 slots</b>: slot 1 next to you, slot 2 in the middle, slot 3 next to the enemy. Your cards and the enemy's share the slots: the colour says whose a card is, <b>black yours</b>, <b>red the enemy's</b>. The screen shows the table the same way, the enemy at the top.</p> },
    ]
    return (
      <div className="page">{bar()}
        <h1>{novice ? 3 : 4}. Set up the table</h1>
        <Stepper steps={steps} at={setupStep} setAt={setSetupStep} done={<button className="big" disabled={n !== DECK_SIZE} onClick={() => begin(makeGame(tapped.map(byId), slotIds.map(byId), mine, DEFAULT_RULES, true), 'guide')}>Start the game</button>} />
      </div>
    )
  }

  // ---------- play: the same arena on screen and with real cards ----------
  const g = game!
  const stage = g.stage
  const advice = help !== 'suggest' || reviewing ? null : stage === 'my_play' ? cached(advise, g) : stage === 'my_last_stand' ? cached(adviseLastStand, g) : null
  const hitEnemy = stage === 'tower_enter'
  const flipping = stage === 'enemy_enter' || stage === 'last_stand_enter' || hitEnemy
  const standing = stage === 'my_last_stand'
  const previewCard = g.P.hand[drag ?? sel ?? bad ?? hov ?? -1]
  const spend = previewCard && !standing ? cost(previewCard.rank) : 0 // a last stand card is free
  const side = stage === 'my_play' || standing ? 'me' : stage.startsWith('enemy_') || stage === 'last_stand_enter' ? 'enemy' : null
  // with real cards, every step that moves cards on the table waits on a panel over the tray until the player taps Done;
  // after one of your own plays that is paying, placing and drawing, then the hand is free again
  const doNow = mode === 'guide' && stage === 'my_play' && g.lastAction.length > 0 && doSeen !== g.log.length
  const atTable = mode === 'guide' && !striking && settled && (doNow || flipping || AUTO_STAGES.includes(stage))
  const stepTitle = doNow ? 'Now at the table' : stage === 'round_start' ? `Round ${g.round}` : g.batched ? 'Fights and moves, in order' : g.events?.some(e => e.type === 'play' && e.free) ? 'Last stand' : TITLES[stage]
  // the card to turn face-up glows on the field: the enemy's next card, or the top of the tower being hit
  const hitUnit = hitEnemy ? g.units.find(u => u.uid === g.hitQueue[0]) : undefined
  const flipTower = hitUnit ? (g.E.towers[hitUnit.lane === 0 ? 'L' : 'R'].length ? (hitUnit.lane === 0 ? 'L' : 'R') : 'K') : null
  const mineSlots = (k: 'L' | 'R' | 'K'): ESlot[] => g.P.towers[k].map(c => ({ tid: c.id, card: c }))
  // pointer-based drag: one code path for mouse, touch and pen (HTML5 drag-and-drop never fires on touch screens).
  // It picks up a card from your hand (i), or on screen a card you placed this turn (tid): dropped off the lanes it goes back to your hand.
  const startDrag = (e: React.PointerEvent<HTMLElement>, i: number | null, tid?: string) => {
    if (reviewing || (i !== null && !standing && !canPlay(g, i)) || (e.pointerType === 'mouse' && e.button !== 0)) return
    const from = tid ? g.units.find(u => u.tid === tid)?.lane : undefined
    const el = e.currentTarget, x0 = e.clientX, y0 = e.clientY
    let ghost: ReturnType<typeof makeGhost> = null, lane: 0 | 1 | null = null
    const laneAt = (x: number, y: number) => {
      const t = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest(tid ? '.spot.mine[data-lane]' : '.droppable[data-lane]') as HTMLElement | null
      return t?.dataset.lane === undefined ? null : (Number(t.dataset.lane) as 0 | 1)
    }
    // a pointer can report many moves a frame (120Hz+ touch screens): the ghost follows, and the lane under it is looked up, once a frame
    let at: [number, number] | null = null, frame = 0
    const follow = () => {
      frame = 0
      if (!ghost || !at) return
      ghost.move(at[0], at[1])
      const l = laneAt(at[0], at[1])
      if (l !== lane) { lane = l; setOverLane(l); if (l !== null) sfx('hover') }
    }
    const move = (ev: PointerEvent) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return
        ghost = makeGhost(el, x0, y0); setBad(null); setSel(null); if (tid) setLift(tid); else setDrag(i); sfx('pick')
      }
      ev.preventDefault()
      at = [ev.clientX, ev.clientY]
      if (!frame) frame = requestAnimationFrame(follow)
    }
    const end = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end)
      cancelAnimationFrame(frame); frame = 0
      if (!ghost) return
      if (at) ghost.move(at[0], at[1]) // where the pointer let go, not a frame behind it
      setOverLane(null)
      justDragged.current = true; setTimeout(() => { justDragged.current = false }, 0)
      const l = ev.type === 'pointerup' ? laneAt(ev.clientX, ev.clientY) : null
      if (tid) {
        // back where it was (or a cancelled drag): nothing changes; anywhere else: it moves lanes or goes back to your hand
        if (ev.type !== 'pointerup' || l === from) { ghost.glideBack(() => setLift(null)); return }
        ghost.land(l === null ? 0.32 : 0.26); setLift(null); sfx(l === null ? 'unpick' : 'slide') // back to the hand is the longer trip
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
    quick(a, 0.32); quick(b, 0.32); sfx('slide'); commit(n)
    return true
  }
  const tapHand = (i: number) => {
    if (justDragged.current || reviewing) return
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
    if (justDragged.current || reviewing) return
    if (pick === tid) { sfx('unpick'); setPick(null); return }
    const other = pick ?? (sel !== null ? g.P.hand[sel]?.id : undefined)
    if (other && trySwitch(other, tid)) return
    sfx('pick'); setSel(null); setBad(null); setPick(tid)
  }
  // while a placed card is picked, the hand cards it can switch with stand out (its share of your turn would come back first)
  const open = (i: number) => (pick ? switchCards(g, pick, g.P.hand[i].id) !== g : standing || canPlay(g, i))
  const handCards = g.P.hand.map((c, i) => (
    <div key={c.id} data-i={i} className={`hdrag ${drag === i ? 'lifted' : ''} ${sel === i && drag === null && open(i) ? 'picked' : ''} ${reviewing ? 'static' : !open(i) ? 'off' : ''} ${suggested?.handIndex === i && drag === null ? 'suggested' : ''}`} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onPointerDown={e => startDrag(e, i)} onClick={() => tapHand(i)}>
      <TCard tid={c.id} card={c} down={false} side="P" showCost selected={sel === i} dim={!open(i)} />
    </div>
  ))
  // the Hints page of the menu: what the hints say about this turn, then the two switches that turn them on
  const hints = () => (
    <>
      <Section title="This turn">
        {stage !== 'my_play' ? <p className="m-0 text-muted-foreground">Hints show here on your turn.</p>
          : help === 'off' && <p className="m-0 text-muted-foreground">Turn on a switch below and its hint shows here.</p>}
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
              <li key={i} className={`flex items-start gap-2.5 border-t border-white/10 py-2 leading-snug first:border-t-0 ${o.includes('already played') ? 'opacity-50' : ''}`}><span className="w-11 shrink-0"><CardText text={card} /></span><span>{rest.join(': ')}</span></li>
            ) })}
          </ul>
        )}
        {help !== 'off' && g.why.length > 0 && <p className="m-0 text-sm text-muted-foreground"><b className="text-foreground">Why:</b> <CardText text={g.why.join(' ')} /></p>}
      </Section>
      <Section title="Turn on">
        <Choice id="explain" title="Explain my options" description="List every card you can play and where" checked={explainOn} onChange={setExplainOn} />
        <Choice id="suggest" title="Suggest moves" description="The suggested card and lane glow green, or the ✓ button does" checked={suggestOn} onChange={setSuggestOn} />
      </Section>
    </>
  )
  const exportLog = () => downloadText(logName(new Date()), logText(g))
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
      {sum.runHits > 0 && <p className="goruns">Your small cards ran » and hit a tower {sum.runHits === 1 ? 'once' : `${sum.runHits} times`}.</p>}
      <p className="gorecord">{newBest ? `Your fastest win yet: ${sum.rounds} rounds! ` : ''}{record.wins} {record.wins === 1 ? 'win' : 'wins'} in {record.games} {record.games === 1 ? 'game' : 'games'}.</p>
      {intro?.deck && g.winner !== 'P' && <p className="goclose">This first game was for learning the rules. Following the glowing suggestions wins it.</p>}
      <div className="gotip"><Lightbulb aria-hidden /><p>{sum.tip ? <CardText text={sum.tip} /> : 'Clean game: no turn wasted and no big cards spent on small enemies.'}</p></div>
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
      <FxLayer />
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

  // one tip at a time, pointing down at the tray (or at the table panel over it); it says what the board shows right now where that
  // differs (what is left of your turn, the green suggestion, whose last stand), and steps aside while a card is dragged, since it
  // covers the slots nearest you
  const tipText = (id: TipId) => {
    const table = mode === 'guide' && TABLE_TIPS[id]
    if (table) return table
    if (id === 'drag' && suggestOn) return `${TIPS.drag} Not sure? The card and lane glowing green are a good pick.`
    if (id === 'turn' && game?.stage === 'my_play') return game.P.elixir > 0
      ? 'The dots on a card show how much of your turn it uses: a small card one, a big card two. You have one left (the bar under ✓): play one more small card (A to 5), or press ✓ and the enemy moves.'
      : 'The dots on a card show how much of your turn it uses: a small card one, a big card two. Your turn is used up: the bar under ✓ is empty and your other cards are grey. Press ✓ and the enemy moves.'
    if (id === 'stand' && game?.stage === 'my_last_stand') return 'LAST STAND! Your side tower fell: drag any card from your hand into that lane. It is free: it doesn\'t use your turn.'
    if (id === 'stand' && game?.events?.some(e => e.type === 'play' && e.side === 'E' && e.free)) return 'LAST STAND! The enemy\'s side tower fell, so it puts its Next card into that lane for free. When one of yours falls, you get one too.'
    return TIPS[id]
  }
  const coach = tip && drag === null && lift === null && (
    <div className="coach" role="dialog" aria-label="Tip">
      <p>{tipText(tip)}</p>
      <div className="row">
        <button className="big" onClick={() => seeTip([tip])}>Got it</button>
        <button className="linkish" onClick={() => { seeTip(Object.keys(TIPS) as TipId[]); setSuggestOn(false); setExplainOn(false) }}>Skip all tips</button>
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

  const HAND_BIG = 1.5 // your hand's cards are this much bigger than the cards on the field, so the two are easy to tell apart
  const HAND_MIN = 1.15 // the hand's cards stay at least this much bigger than the field's, even when the field could grow more
  const SMALL = 0.78 // the Next cards and the piles under them are this much of a normal card (the cards in the lanes); your hand's cards are the big size
  const FIELD_K = 276 // the window height kept for everything but the field's rows of cards and the hand's cards (castles, status line, margins)
  const handFit = (Math.min(view.sw, 640, 470) - 65) / 3.57 // the tallest hand card whose row fits the width: Next, 3 cards and done are 5 cards wide, plus the gaps and a margin at each side (65px; the turn bar sits under Done, in its column)

  // the arena; card size follows the window so the whole field, the bar and the hand always fit
  const arena = () => {
    const aw = Math.min(view.sw, 640)
    // with real cards every card is the same size, as on the table: about nine card widths across (pile, three towers, discard; each lane two cards wide) and six card rows down (two tower rows, three lane slots, the hand).
    // A wide window puts the instructions and the hand in a column beside the table; otherwise they get a fixed space under it.
    const wide = mode === 'guide' && view.sw >= 860 && view.sw >= view.sh * 1.3
    // your hand is the same on screen and with real cards: as big as its row fits (in the column beside the table, inside its 16px padding, when wide)
    const col = view.sw >= 1200 ? 500 : 420
    const fit = wide ? (col - 32 - 65) / 3.57 : handFit
    const ch = mode === 'guide'
      ? wide
        ? Math.max(44, Math.min((view.sh - 168) / 6.9, (Math.min(view.sw - col - 40, 760) - 60) / 8.9 / 0.714, 128))
        : Math.max(44, Math.min((view.sh - 308 - fit) / 6.34, (aw - 60) / 8.9 / 0.714, 128))
      : Math.max(48, Math.min(Math.max((view.sh - FIELD_K) / (4.54 + HAND_BIG), (view.sh - FIELD_K - handFit) / 4.54), handFit / HAND_MIN, (aw - 72) / 4.75 / 0.714, 128)) // the field grows to fill the height, but never past the point where the hand (HAND_BIG times its cards, or as big as its row fits) is only HAND_MIN times them
    const hch = mode === 'guide' ? fit : Math.min(ch * HAND_BIG, handFit) // your hand's card height
    const vars = { '--tcol': `${col}px`, '--cw': `${ch * 0.714}px`, '--ch': `${ch}px`, '--fcw': `${ch * 0.714}px`, '--fch': `${ch}px`, '--hcw': `${hch * 0.714}px`, '--hch': `${hch}px`, '--scw': `${ch * SMALL * 0.714}px`, '--sch': `${ch * SMALL}px` } as CSSProperties
    // the tips teach how to play a card, what ✓ does and what a turn holds, and the river shows the round: the line only says whose turn it is
    const prompt = stage === 'my_play' ? 'Your turn: 1 card, or 2 small ones.' : standing ? TITLES[stage] : stage === 'round_start' ? 'New round.' : 'Enemy turn…'
    // the enemy's last-stand card came in during its turn: your turn still says where it came from, until it has fought
    const stood = stage === 'my_play' && g.units.find(u => u.side === 'E' && u.free)
    // with suggestions on, your turn's line says what they suggest and, in a few words, why (the whole reason is in Menu → Hints)
    const suggestion = advice && (advice.kind === 'play'
      ? `${label(g.P.hand[advice.handIndex])}${standing ? '' : ` in the ${advice.lane === 0 ? 'left' : 'right'} lane`}: ${advice.short}.`
      : `End your turn: ${advice.short}.`)
    const standSide = g.lastStand?.lane === 0 ? 'left' : 'right'
    const standMsg = `Your ${standSide} tower fell: drag a card onto the ${standSide} lane, it joins free.`
    const stoodMsg = stood ? `Enemy ${label(stood.card)} came in free (its ${stood.lane === 0 ? 'left' : 'right'} tower fell).` : ''
    // the card in your hand (picked, dragged or hovered) against what it would meet: each lane's front enemy card (only the lane it is
    // dragged over), or the enemy's Next card when no enemy is in those lanes and it is face-up
    const fights: string[] = []
    if (previewCard && (stage === 'my_play' || standing)) {
      const front = (l: 0 | 1) => g.units.filter(u => u.side === 'E' && u.lane === l).sort((a, b) => a.pos - b.pos)[0]
      for (const l of [0, 1] as const) {
        const e = front(l)
        if (e && (overLane === null || overLane === l)) fights.push(`${l === 0 ? 'Left' : 'Right'}: ${fightLine(previewCard, e.card, g.rules)}`)
      }
      const next = g.E.queue[0]?.card
      if (!fights.length && next) fights.push(`Enemy Next: ${fightLine(previewCard, next, g.rules)}`)
    }
    // at most two lines: the fights of the card you hold, one sentence, or the suggestion when suggestions are on
    const lines = fights.length ? fights : standing ? [suggestion ?? standMsg] : stood ? [suggestion ?? stoodMsg]
      : suggestion ? [suggestion] : said.length ? said : [prompt]
    // the suggested lane glows only while no other card is picked up; tapping it with nothing picked plays the suggestion
    const fighting = cached(fightingNext, g)
    const towerFx = (side: 'P' | 'E', k: 'L' | 'R' | 'K'): TowerFx => {
      for (const e of g.events ?? []) {
        if (e.type === 'tower' && e.side !== side && e.stack === k) return e.result
        if (e.type === 'reveal' && side === 'E' && e.stack === k) return 'reveal'
      }
    }
    const grabbable = mode === 'play' && !reviewing && stage === 'my_play' ? (g.turn ?? []).map(p => p.id) : []
    // the hand card you hold (tapped or dragged): enemy cards it counts double against glow green, those that count double against it red
    const holding = drag ?? sel, held = holding !== null ? g.P.hand[holding] : undefined
    const x2 = (c: Card | null | undefined): X2 => !held || !c ? undefined
      : effective(held, c, g.rules.wheel) > held.rank ? 'good' : effective(c, held, g.rules.wheel) > c.rank ? 'bad' : undefined
    const lane = (l: 0 | 1) => ({
      grabbable, lifted: lift, picked: pick, x2, onGrab: (e: React.PointerEvent<HTMLElement>, tid: string) => startDrag(e, null, tid), onTap: tapUnit,
      dragging: (drag !== null && (!standing || g.lastStand?.lane === l)) || (lift !== null && g.units.find(u => u.tid === lift)?.lane !== l), hint: standing ? g.lastStand?.lane === l : sel !== null || pick !== null, blocked: standing && g.lastStand?.lane !== l,
      suggested: suggested?.lane === l && (drag ?? sel ?? suggested.handIndex) === suggested.handIndex,
      over: overLane === l, onPlace: () => {
        if (standing) { const i = sel ?? suggested?.handIndex; if (i !== undefined && g.lastStand?.lane === l) { quick(g.P.hand[i].id, 0.32); commit(lastStandPlay(g, i)) } return }
        if (pick) { const n = takeBack(g, pick, l); if (n === g) { sfx('unpick'); setPick(null) } else { quick(pick, 0.26); commit(n) } return }
        const i = sel ?? suggested?.handIndex; if (i !== undefined) { quick(g.P.hand[i].id, 0.32); commit(playCard(g, i, l)) } },
    })
    const eNext = g.E.queue[0]
    const undoRedo = <>
      <Button variant="secondary" size="icon-lg" aria-label="Undo" title="Undo" onClick={undo} disabled={!history.length}><Undo2 /></Button>
      <Button variant="secondary" size="icon-lg" aria-label="Redo" title="Redo" onClick={redo} disabled={!future.length}><Redo2 /></Button>
    </>
    const settings = mode === 'play'
      ? <Choice id="fast" icon={<FastForward />} title="Fast enemy turns" checked={fast} onChange={setFast} />
      : <Choice id="batch" icon={<ListChecks />} title="Fights in one list" description="Each round's fights and tower hits as one checklist" checked={batchOn} onChange={setBatch} />
    const tipsAgain = () => { setTipsSeen([]); writeJSON(TIPS_KEY, []) }
    const menu = <GameMenu topics={RULES} muted={muted} toggleMute={toggleMute} musicOff={musicOff} toggleMusic={toggleMusic} onLeave={reset} log={g.log} onExport={exportLog} past={past}
      hints={hints} hintsOn={help !== 'off'} settings={settings} onTipsAgain={tipsAgain} />
    const round = <RoundChip n={g.round} />
    const discard = (owner: 'P' | 'E') => {
      const d = g.discard.filter(x => x.owner === owner)
      return <TablePile top={d.at(-1)} down={false} n={d.length} name="Discard" faces />
    }
    // with real cards the screen is the table as you sit at it: every card where it lies, all the same size
    const table = (
      <>
        <div className="tbar">{round}<span className="modechip">Real cards</span><span className="tmenu">{cheat}<span className="undoredo">{undoRedo}</span>{menu}</span></div> {/* the same bar as on screen: round at the left, then the buttons in the same order */}
        <div className={`cardtable${striking ? ' striking' : ''}`} onPointerDown={striking ? () => fx.land() : undefined}> {/* a tap while a step plays out skips to its end */}
          <div className="trow theirs">
            <TablePile top={eNext} down={!eNext?.card} side="E" n={g.E.queue.length} name="Pile" flip={stage === 'enemy_enter' || stage === 'last_stand_enter'} />
            {(['L', 'K', 'R'] as const).map(k => <TowerFan key={k} k={k} items={g.E.towers[k]} own={false} cracked={g.cracked ?? []} flip={flipTower === k} shake={fighting.includes(`tower-E-${k}`)} />)}
            {discard('E')}
          </div>
          <div className="lanes">
            <span />
            <ArenaLane idx={0} units={g.units} fighting={fighting} laneLen={g.rules.laneLen} {...lane(0)} />
            <div className="mid" />
            <ArenaLane idx={1} units={g.units} fighting={fighting} laneLen={g.rules.laneLen} {...lane(1)} />
            <span />
          </div>
          <div className="trow mine">
            <TablePile top={g.P.queue[0] && { tid: `pile-${g.P.queue[0].id}`, card: g.P.queue[0] }} down={false} side="P" n={g.P.queue.length} name="Pile" faces /> {/* its own id: the same card is also the Next card beside your hand, and two cards with one id show only once */}
            {(['L', 'K', 'R'] as const).map(k => <TowerFan key={k} k={k} items={mineSlots(k)} own cracked={g.cracked ?? []} shake={fighting.includes(`tower-P-${k}`)} />)}
            {discard('P')}
          </div>
        </div>
      </>
    )
    // on screen, a tap on the field while a step plays out goes straight to the next one
    const skippable = mode === 'play' && !tip && !reviewing && AUTO_STAGES.includes(stage)
    const skip = (e: React.PointerEvent) => { if (!(e.target as Element).closest('button')) advance(settle(next(g))) }
    const field = (
      <div className={`field${skippable ? ' skippable' : ''}`} onPointerDown={skippable ? skip : undefined}>
        <span className="corner left">{round}</span>
        <span className="corner right">{cheat}{(DEBUG || reviewing) && undoRedo}{menu}</span> {/* undo/redo: looking back through a finished game, or a debugging aid (dev server or any build opened with ?debug=1) */}
        <div className="castles theirs">
          {(['L', 'K', 'R'] as const).map(k => <Castle key={k} k={k} items={g.E.towers[k]} own={false} cracked={g.cracked ?? []} fx={towerFx('E', k)} shake={fighting.includes(`tower-E-${k}`)} />)}
        </div>
        <div className="lanes">
          <ArenaLane idx={0} units={g.units} fighting={fighting} laneLen={g.rules.laneLen} {...lane(0)} />
          <div className="mid rows">
            <div className="sidechip enemy" title="The next card of the enemy pile (face-down until you have seen it). The enemy plays two cards per round: this one first.">
              <NextPile slots={eNext ? g.E.queue : []} side="E" x2={x2(eNext?.card)} />
            </div>
          </div>
          <ArenaLane idx={1} units={g.units} fighting={fighting} laneLen={g.rules.laneLen} {...lane(1)} />
        </div>
        <div className="castles mine">
          {(['L', 'K', 'R'] as const).map(k => <Castle key={k} k={k} items={mineSlots(k)} own cracked={g.cracked ?? []} fx={towerFx('P', k)} shake={fighting.includes(`tower-P-${k}`)} />)}
        </div>
      </div>
    )
    return (
      <BoardTick.Provider value={g}>
      <div ref={playRef} className={`arena${mode === 'guide' ? ' guide' : ''}${wide ? ' wide' : ''}${side ? ' turn-' + side : ''}`} style={vars}>
        {mode === 'guide' ? table : field}
        <div className="tray">
          {stage === 'over' && overSeen
            ? <div className="overbtns"><button className="big" onClick={playAgain}>Play again</button><button onClick={() => setOverSeen(false)}>Result</button></div>
            : <div className="feed" aria-live="polite">
              {lines.map((l, i) => <div key={i}>{l}</div>)}
            </div>}
          <div className="handwrap">
            <div className={`handrow${doNow && !atTable ? ' wait' : ''}`}>
              <div className="handgroup">
                <NextPile slots={g.P.queue.map(c => ({ tid: c.id, card: c }))} side="P" />
                {handCards}
                {Array.from({ length: Math.max(0, 3 - g.P.hand.length) }, (_, i) => <div key={`ph${i}`} className="cardph hand" />)}
              </div>
              <div className="donecol"><button className={`big done endturn ${advice?.kind === 'wait' ? 'suggested' : ''}`} title={advice?.kind === 'wait' ? advice.reason : 'End turn'} disabled={stage !== 'my_play' || reviewing} aria-label="End turn" onClick={() => commit(endMyTurn(g))}><svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 6.5" /></svg></button><TurnBar n={g.P.elixir} spend={spend} max={g.rules.cap} /></div>
            </div>
          </div>
          {!reviewing && (tableStep || coach)}
        </div>
        {overlays}
      </div>
      </BoardTick.Provider>
    )
  }

  return arena()
}

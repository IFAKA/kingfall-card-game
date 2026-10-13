import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import './App.css'
import { DEFAULT_RULES, RANKS, SUITS, autoTowers, cost, deal, freshDeck, isRed, label, shuffle, suggestDeck } from './engine'
import type { Card, Unit } from './engine'
import {
  advise, autoReveal, canPlay, endMyTurn, enterEnemyCard, enterTowerCard, excludedIds, lastStandPlay, makeGame, next, options, playCard, startRound, summary,
} from './guide'
import type { Discarded, ESlot, GuideState } from './guide'

type Help = 'off' | 'explain' | 'suggest'
type Screen = 'deal' | 'enter' | 'draft' | 'table' | 'play'
interface Saved { mode?: 'guide' | 'play'; secret?: Record<string, Card>; screen: Screen; my16: string[]; deckIds: string[]; slotIds: string[]; help: Help; pre: GuideState | null; game: GuideState | null; history: GuideState[] }

const ALL = freshDeck()
const byId = (id: string) => ALL.find(c => c.id === id)!
export const STORAGE_KEY = 'solo-clash-guide-v2' // bump when the rules change, so old saved games don't load into new rules

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
function faceDragImage(e: React.DragEvent<HTMLElement>) {
  const card = e.currentTarget.querySelector('.tcard') as HTMLElement | null
  if (!card) return
  const r = card.getBoundingClientRect()
  const ghost = card.cloneNode(true) as HTMLElement
  const flip = ghost.querySelector('.flip') as HTMLElement | null
  if (flip) Object.assign(flip.style, { transform: 'none', transition: 'none', transformStyle: 'flat' })
  ghost.querySelector('.backside')?.remove()
  ghost.querySelectorAll<HTMLElement>('.cf').forEach(f => { f.style.backfaceVisibility = 'visible'; f.style.setProperty('-webkit-backface-visibility', 'visible') })
  Object.assign(ghost.style, { position: 'fixed', top: '-1000px', left: '-1000px', width: `${r.width}px`, height: `${r.height}px`, transform: 'none', opacity: '1', filter: 'none', zIndex: '9999' })
  e.currentTarget.appendChild(ghost) // inside the hand, so it inherits the same card size variables and styles
  e.dataTransfer.setDragImage(ghost, e.clientX - r.left, e.clientY - r.top)
  setTimeout(() => ghost.remove(), 0)
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
      transition={{ layout: { duration: 0.75, ease: [0.4, 0, 0.2, 1] } }}
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

// Slots [from, to) a card's cost covers: back from the marker, or from the start when it costs more than you have.
function spendRange(n: number, spend: number): [number, number] {
  const from = Math.max(0, n - spend)
  return [from, Math.min(10, from + spend)]
}

// An elixir bar: a row of 10 face-down cards; the one flipped face-up is the marker, its position = elixir.
function BarRow({ n, who, spend = 0 }: { n: number; who: string; spend?: number }) {
  return (
    <div className="hbar">
      <span className="hlabel">{who} · elixir {n}/10</span>
      {Array.from({ length: 10 }, (_, i) => {
        const slot = (j: number) => <span key={j} className={`bslot${j === n - 1 ? ' marker' : ''}${j === 5 ? ' gap' : ''}`}>{j + 1}</span>
        const [from, to] = spendRange(n, spend)
        if (i === from && to > from) return <span key={i} className="sgroup">{Array.from({ length: to - from }, (_, k) => slot(from + k))}</span>
        return i > from && i < to ? null : slot(i)
      })}
    </div>
  )
}

// The same bar as 10 board cells, one per column, so it lines up with the table below it.
function BarCells({ n, who, row, at, spend = 0 }: { n: number; who: string; row: number; at: At; spend?: number }) {
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="cell ecell" style={at(i + 1, row)}>
          {i === 0 && <span className="clabel">{who} · elixir {n}/10</span>}
          <span className="eslot"><span className={`eflip${i === n - 1 ? ' up' : ''}`}><span className="ef efront">{i + 1}</span><span className="ef eback">{i + 1}</span></span></span>
        </div>
      ))}
      {spend > 0 && <div className="sgroup cells" style={at(`${spendRange(n, spend)[0] + 1} / ${spendRange(n, spend)[1] + 1}`, row)} />}
    </>
  )
}

// A tower: cards fanned sideways so every rank/suit shows. The TOP card (hit first) is the one nearest the lanes.
function HStack({ items, own, mirror, cracked }: { items: ESlot[]; own: boolean; mirror: boolean; cracked: string[] }) {
  const n = items.length
  return (
    <div className="hstack" style={{ width: `calc(var(--cw) + ${Math.max(0, n - 1)} * var(${mirror ? '--poff' : '--hoff'}))` }}>
      {n === 0 && <div className="destroyed">destroyed</div>}
      {items.map((it, i) => {
        // player: fanned, top card on the right (nearest the lanes). enemy: cards are hidden, so a tight stack with the top card in front.
        const slot = mirror ? i : n - 1 - i
        return (
          <div key={it.tid} className="hcard" style={{ left: `calc(${slot} * var(${mirror ? '--poff' : '--hoff'}))`, zIndex: mirror ? n - i : slot }}>
            <div className={cracked.includes(it.tid) ? 'crk' : undefined} title={cracked.includes(it.tid) ? 'cracked: any hit breaks it' : undefined}><TCard tid={it.tid} card={it.card} down={!it.card && !own} /></div>
          </div>
        )
      })}
    </div>
  )
}

// Face-up where the card is known (all of yours); the enemy's is down only where unknown.
function Pile({ items, spread }: { items: ESlot[]; spread?: boolean }) {
  const step = `calc((var(--ch) + 22px) / ${Math.max(1, items.length - 1)})`
  return (
    <div className={`spile ${spread ? 'spread' : ''}`}>
      {items.map((it, i) => (
        <div key={it.tid} className="hcard" style={spread ? { left: 0, top: `calc(${items.length - 1 - i} * ${step})`, zIndex: items.length - 1 - i } : { left: `calc(${i} * var(--poff))`, top: `calc(${i} * var(--poff))`, zIndex: items.length - i }}>
          <TCard tid={it.tid} card={it.card} down={!it.card} />
        </div>
      ))}
    </div>
  )
}

function Discard({ items }: { items: Discarded[] }) {
  const step = items.length > 1 ? Math.min(0.3, 0.85 / (items.length - 1)) : 0
  return (
    <div className="dpile">
      {items.length === 0 && <div className="destroyed">empty</div>}
      {items.map((d, i) => <div key={d.tid} className="hcard" style={{ left: `calc(${i * step} * var(--cw))`, zIndex: i }}><TCard tid={d.tid} card={d.card} down={false} /></div>)}
    </div>
  )
}

// Board cells are placed for the wide layout: 10 columns run from you (1) to the enemy (10), rows are enemy elixir / left lane / right lane / your elixir.
// On phones the board turns upright like Clash Royale: enemy on top, you at the bottom, lanes running vertically (the elixir bars sit above the board).
type Span = number | string
type At = (col: Span, row: Span) => CSSProperties
const atFor = (portrait: boolean): At => (col, row) => {
  if (!portrait) return { gridColumn: col, gridRow: row }
  const [a, b] = typeof col === 'number' ? [col, col + 1] : col.split(' / ').map(Number)
  const [r1, r2] = typeof row === 'number' ? [row, row + 1] : row.split(' / ').map(Number)
  return { gridColumn: `${r1 - 1} / ${r2 - 1}`, gridRow: `${11 - b} / ${11 - a}` }
}
const PORTRAIT = '(max-width: 760px)'
function usePortrait() {
  const [p, setP] = useState(() => matchMedia(PORTRAIT).matches)
  useEffect(() => {
    const m = matchMedia(PORTRAIT)
    const f = () => setP(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return p
}

function LaneCells({ idx, units, laneLen, row, at, dragging, hint, onDropCard }: { hint?: boolean; idx: 0 | 1; units: Unit[]; laneLen: number; row: number; at: At; dragging?: boolean; onDropCard?: (lane: 0 | 1) => void }) {
  const [over, setOver] = useState(false)
  const defs: { label: string; pred: (u: Unit) => boolean; cls: string }[] = [
    { label: 'your tower', pred: u => u.side === 'E' && u.pos < 0, cls: 'attack' },
    { label: `${idx === 0 ? 'LEFT' : 'RIGHT'}: your slot`, pred: u => u.pos === 0, cls: '' },
    { label: 'enemy slot', pred: u => u.pos === laneLen - 1, cls: '' },
    { label: 'enemy tower', pred: u => u.side === 'P' && u.pos >= laneLen, cls: 'attack' },
  ]
  return (
    <>
      {defs.map((d, k) => (
        <div key={k} className={`cell lanecell ${d.cls} ${(dragging || hint) && k === 1 ? 'droppable' : ''} ${dragging && k === 1 && over ? 'over' : ''}`} style={at(4 + k, row)}
          onDragOver={dragging && k === 1 ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true) } : undefined}
          onDragEnter={dragging && k === 1 ? () => setOver(true) : undefined}
          onDragLeave={dragging && k === 1 ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) } : undefined}
          onDrop={dragging && k === 1 ? e => { e.preventDefault(); setOver(false); onDropCard?.(idx) } : undefined}>
          <span className="clabel">{d.label}</span>
          <div className="cellbody">
            {units.filter(u => u.lane === idx && d.pred(u)).map(u => (
              <div key={u.uid} className={`unit ${u.side}`}><TCard tid={u.tid!} card={u.card} down={false} /></div>
            ))}
          </div>
        </div>
      ))}
    </>
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
  tower_result: 'Tower hit', my_last_stand: 'LAST STAND: place a free card', last_stand_enter: 'Enemy LAST STAND: flip its top card', over: 'Game over',
}

const RULES_60 = (
  <ul>
    <li><b>Goal:</b> destroy the enemy's <b>king tower</b> (a stack of 2 cards) before it destroys yours.</li>
    <li><b>Cards</b> are soldiers. Higher rank wins a fight (A=1 … K=13). A suit that beats the other adds +3: ♠→♥, ♥→♦, ♦→♣, ♣→♠.</li>
    <li><b>Elixir</b> pays for soldiers: a card costs about its rank (A=1, 5=4, 8=6, K=10). You get 3 more each round, max 10.</li>
    <li>Each round: <b>you play</b> cards into a lane, then the <b>enemy</b> plays from its pile into the lane where you have <b>more</b> cards (it defends; on a tie, where your highest-ranked card is, then left), then <b>everything moves</b> one slot and <b>fights</b>. Cards that face each other don't pass through: they clash where they stand, and the winner steps into the slot it cleared. Survivors reaching the other end hit a tower.</li>
    <li><b>A tower card breaks</b> if the attacking soldier's rank ≥ the tower's top card. A tower stack has 2–3 cards; each break removes one. If the soldier is too weak, the tower holds but its top card <b>cracks</b>: turn it sideways and move it to the bottom of that tower. Any later hit breaks a cracked card. The king can only be hit after the princess tower in that lane is gone.</li>
    <li><b>Last stand:</b> when a left or right tower is destroyed, its owner immediately places one card in that lane for free (the enemy uses the top card of its pile).</li>
    <li>A fighting card that dies goes to the <b>bottom of its owner's pile</b>, and you draw it again later. So your 8 cards just keep cycling.</li>
  </ul>
)

export default function App() {
  const saved = useMemo(() => load(), [])
  const [screen, setScreen] = useState<Screen>(saved?.screen ?? 'deal')
  const [my16, setMy16] = useState<string[]>(saved?.my16 ?? [])
  const [deckIds, setDeckIds] = useState<string[]>(saved?.deckIds ?? [])
  const [slotIds, setSlotIds] = useState<string[]>(saved?.slotIds ?? [])
  const [mode, setMode] = useState<'guide' | 'play'>(saved?.mode ?? 'guide')
  const [secret, setSecret] = useState<Record<string, Card>>(saved?.secret ?? {})
  const [epile, setEpile] = useState(false)
  const [qpile, setQpile] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [swapFrom, setSwapFrom] = useState<number | null>(null)
  const [help, setHelp] = useState<Help>(saved?.help ?? 'suggest')
  const [pre, setPre] = useState<GuideState | null>(saved?.pre ?? null)
  const [game, setGame] = useState<GuideState | null>(saved?.game ?? null)
  const [history, setHistory] = useState<GuideState[]>(saved?.history ?? [])
  const [sel, setSel] = useState<number | null>(null)
  const helpRef = useRef<HTMLDialogElement>(null)
  const rulesRef = useRef<HTMLDialogElement>(null)
  const logDlgRef = useRef<HTMLDialogElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const [hov, setHov] = useState<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const portrait = usePortrait()

  useEffect(() => {
    const s: Saved = { mode, secret, screen, my16, deckIds, slotIds, help, pre, game, history: history.slice(-60) }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* storage full: ignore */ }
  }, [mode, secret, screen, my16, deckIds, slotIds, help, pre, game, history])
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }) }, [game?.log.length])

  const mine = my16.map(byId).sort((a, b) => b.rank - a.rank || a.suit - b.suit)
  const deck = mine.filter(c => deckIds.includes(c.id))

  const reset = () => {
    setScreen('deal'); setMy16([]); setDeckIds([]); setSlotIds([]); setPre(null); setGame(null); setHistory([]); setSel(null); setMode('guide'); setSecret({})
  }
  const settle = (g: GuideState) => (mode === 'play' ? autoReveal(g, secret) : g)
  const commit = (g: GuideState) => { setHistory(h => [...h, game!]); setGame(settle(g)); setSel(null); setNote(null) }
  const undo = () => { if (!history.length) return; setGame(history[history.length - 1]); setHistory(h => h.slice(0, -1)); setSel(null) }

  const pickDeck = (ids: string[]) => {
    setDeckIds(ids)
    const r = mine.filter(c => !ids.includes(c.id))
    setSlotIds(ids.length === 8 ? autoTowers(r).map(c => c.id) : [])
    setSwapFrom(null)
  }
  const toggleDeck = (c: Card) => {
    pickDeck(deckIds.includes(c.id) ? deckIds.filter(x => x !== c.id) : deckIds.length < 8 ? [...deckIds, c.id] : deckIds)
  }
  const swapClick = (i: number) => {
    if (swapFrom === null) return setSwapFrom(i)
    if (swapFrom !== i) setSlotIds(s => { const x = [...s];[x[swapFrom], x[i]] = [x[i], x[swapFrom]]; return x })
    setSwapFrom(null)
  }
  // on-screen play: deal both hands at random; the enemy's cards stay hidden inside the app (tid ep0-7 = pile, et0-7 = towers)
  const startOnScreen = () => {
    const d = deal()
    const enemy = shuffle(d.theirs)
    setSecret(Object.fromEntries(enemy.map((c, i) => [i < 8 ? `ep${i}` : `et${i - 8}`, c])))
    setMode('play'); setMy16(d.mine.map(c => c.id)); setDeckIds([]); setSlotIds([]); setScreen('draft')
  }
  const reshuffle = () => setPre(makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES))

  const header = (
    <div className="topbar">
      <b>Solo Clash — {mode === 'play' ? 'on screen' : 'table guide'}</b>
      <span className="muted">{mode === 'play' ? 'The app deals, plays the enemy and runs the rules.' : 'You play with real cards; this page runs the rules and tells you what to do.'}</span>
      <button onClick={() => { if (confirm('Start over? This discards the current game.')) reset() }}>Start over</button>
    </div>
  )

  // ---------- setup screens ----------
  if (screen === 'deal') {
    return (
      <div className="page">{header}
        <div className="row">
          <button className="big" onClick={startOnScreen}>Play here on screen</button>
          <span className="muted">or play with real cards and let this page guide you ↓</span>
        </div>
        <h1>1. Deal the cards</h1>
        <ol className="steps">
          <li>Take a standard 52-card deck (no jokers) and <b>shuffle it well</b>.</li>
          <li>Deal <b>16 cards to yourself</b> (keep them in your hand, look at them) and <b>16 face-down to the enemy</b> (don't look).</li>
          <li>Deal <b>10 face-down in a row</b> for YOUR elixir bar and <b>10 face-down in a row</b> for the ENEMY's elixir bar, with a small gap after the 5th card. (That's all 52 cards.)</li>
          <li>In each bar, turn the <b>5th card sideways</b> (still face-down). That's the <b>marker</b>: its position from the left is the elixir, so both start at 5. Spending or gaining just moves the marker left or right.</li>
        </ol>
        <div className="help"><b>The rules in 60 seconds</b>{RULES_60}</div>
        <div className="row"><button className="big" onClick={() => setScreen('enter')}>Done — I have my 16 cards</button></div>
      </div>
    )
  }

  if (screen === 'enter') {
    const set = new Set(my16)
    return (
      <div className="page">{header}
        <h1>2. Tell me your 16 cards</h1>
        <p className="help">Tap each card you were dealt. <b>{my16.length}/16</b> selected. Tap again to deselect.</p>
        <CardPicker disabled={new Set()} selected={set} onPick={c => setMy16(a => a.includes(c.id) ? a.filter(x => x !== c.id) : a.length < 16 ? [...a, c.id] : a)} />
        <div className="row">
          <button className="big" disabled={my16.length !== 16} onClick={() => { pickDeck([]); setScreen('draft') }}>Next: build my deck</button>
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
      <div className="page">{header}
        <h1>{mode === 'play' ? 'Your 16 cards: build your deck' : '3. Build your deck'}</h1>
        <div className="help">
          <b>First: what a card is.</b> Cards have <u>no special abilities</u>. A card is just a soldier with one number, its <b>rank</b> (2 … 10, J=11, Q=12, K=13, A=1). Higher rank wins fights. The only extra rules:
          <ul>
            <li><b>Cost:</b> stronger cards cost more elixir to play (the purple number: 2→2, 6→5, 10→8, K→10).</li>
            <li><b>Suit wheel:</b> ♠ beats ♥, ♥ beats ♦, ♦ beats ♣, ♣ beats ♠ — the winning suit gets +3 rank in that fight.</li>
            <li><b>Towers:</b> a card in a tower is armor; a soldier must have rank ≥ the tower's top card to break it; a failed hit cracks the top card (turn it sideways, move it to the bottom of that tower), and any later hit breaks a cracked card.</li>
          </ul>
          <b>How to build your deck, step by step:</b>
          <ol>
            <li>You have 16 cards. Choose <b>8 as your deck</b> (soldiers you play). The other 8 automatically become your towers.</li>
            <li>It's a trade-off: <b>strong cards are great soldiers but cost a lot</b>. Your elixir is only 3 per round, so a deck of all kings can barely play anything.</li>
            <li>Good recipe (from thousands of simulated games): <b>some heavy cards</b> (cost 7+) to win fights and break towers, for example 2–4 heavy plus <b>cheap cards</b> (cost 1–3), or even mostly heavy. An all-cheap deck struggles, because the enemy defends the lane you push. Try "Suggest a deck" for an example, then change it.</li>
            <li>Don't put <i>all</i> your best cards in the deck — the cards you leave out are your tower armor. Also try to have a mix of suits so the wheel helps you.</li>
          </ol>
        </div>
        <div className="row">
          <button onClick={() => pickDeck(suggestDeck(mine).map(c => c.id))}>Suggest a deck</button>
          <button onClick={() => pickDeck([])}>Clear</button>
        </div>
        <div className="grid">
          {mine.map(c => {
            const inDeck = deckIds.includes(c.id)
            return <div key={c.id} className={`pick ${inDeck ? 'indeck' : ''}`}><CardView card={c} showCost selected={inDeck} onClick={() => toggleDeck(c)} /><div className="picktag">{inDeck ? 'DECK' : 'TOWER'}</div></div>
          })}
        </div>
        <div className="summary">
          Deck {deck.length}/8 · average cost <b>{avg}</b> · heavy (7+): <b>{heavy}</b> · cheap (1–3): <b>{cheap}</b>
          {deck.length === 8 && heavy < 2 && <span className="warn"> — tests liked decks with at least 2 heavy cards: with fewer you may lose fights.</span>}
        </div>
        {deck.length === 8 && slotIds.length === 8 && (
          <>
            <h3>Your towers <small>(tap two cards to swap; "top" is hit first; default gives the king your two strongest)</small></h3>
            <div className="towerrow">
              {[[0, 1, 2], [3, 4, 5], [6, 7]].map((idxs, g) => (
                <div key={g} className="tgroup"><div className="tname">{['Left tower', 'Right tower', 'King tower'][g]}</div>
                  <div className="row">{idxs.map(i => <div key={i} className="slotpick"><CardView card={byId(slotIds[i])} selected={swapFrom === i} onClick={() => swapClick(i)} /><div className="picktag">{slotName[i]}</div></div>)}</div>
                </div>
              ))}
            </div>
            {mode === 'play'
              ? <button className="big" onClick={() => { setGame(settle(startRound(makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES)))); setHistory([]); setScreen('play') }}>Start the game</button>
              : <button className="big" onClick={() => { reshuffle(); setScreen('table') }}>Next: set up the table</button>}
          </>
        )}
      </div>
    )
  }

  if (screen === 'table') {
    const g = pre ?? makeGame(deck, slotIds.map(byId), mine, DEFAULT_RULES)
    return (
      <div className="page">{header}
        <h1>4. Set up the table</h1>
        <div className="cols">
          <div>
            <h3>Your side</h3>
            <ol className="steps">
              <li>Build your three tower stacks <b>face-up</b>, top card first: <b>Left</b> {g.P.towers.L.map(label).join(' · ')} — <b>Right</b> {g.P.towers.R.map(label).join(' · ')} — <b>King</b> {g.P.towers.K.map(label).join(' · ')}.</li>
              <li>Take your 8 deck cards in this order (I shuffled for you). <b>Hand</b> (face-up): {g.P.hand.map(label).join(', ')}. <b>Queue</b> pile, face-down, TOP card first: {g.P.queue.map(label).join(', ')}.</li>
            </ol>
            <div className="row">{g.P.hand.map(c => <CardView key={c.id} card={c} showCost />)}</div>
            <div className="row"><span className="muted">queue (top → bottom):</span>{g.P.queue.map(c => <CardView key={c.id} card={c} small />)}</div>
            <button onClick={reshuffle}>Shuffle again</button>
          </div>
          <div>
            <h3>The enemy's side (don't look at its cards)</h3>
            <ol className="steps">
              <li>Take the enemy's 16 face-down cards, <b>shuffle</b> them without looking. Put <b>8</b> as its <b>pile</b> (face-down, one stack).</li>
              <li>With the other 8, make its towers, all <b>face-down</b>: <b>Left 3</b>, <b>Right 3</b>, <b>King 2</b>.</li>
              <li>Lanes: leave room for two lanes (left and right) between the towers, each with 2 slots.</li>
            </ol>
          </div>
        </div>
        <div className="row"><button className="big" onClick={() => { setGame(startRound(g)); setHistory([]); setPre(null); setScreen('play') }}>Start the game</button></div>
      </div>
    )
  }

  // ---------- play ----------
  const g = game!
  const stage = g.stage
  const advice = stage === 'my_play' && help === 'suggest' ? advise(g) : null
  const hitEnemy = stage === 'tower_enter'
  const picker = stage === 'enemy_enter' || stage === 'last_stand_enter' || hitEnemy
  const standing = stage === 'my_last_stand'
  const previewCard = standing ? undefined : g.P.hand[drag ?? sel ?? hov ?? -1]
  const spend = previewCard ? cost(previewCard.rank) : 0
  const side = stage === 'my_play' || standing ? 'me' : stage.startsWith('enemy_') || stage === 'last_stand_enter' ? 'enemy' : null
  const inform = ['round_start', 'enemy_play', 'enemy_stop', 'move', 'fight', 'tower_result'].includes(stage)
  const bottomKnown = g.E.queue.filter(x => x.card).length
  const mineSlots = (k: 'L' | 'R' | 'K'): ESlot[] => g.P.towers[k].map(c => ({ tid: c.id, card: c }))
  const at = atFor(portrait)

  return (
    <div className={`play${portrait ? ' portrait' : ''}${side ? ' turn-' + side : ''}`}>
      <div className="top">{header}
        <button onClick={() => helpRef.current?.showModal()}>Help &amp; actions</button>
        <button onClick={() => logDlgRef.current?.showModal()}>What happened</button>
        <button onClick={() => rulesRef.current?.showModal()}>Rules</button>
      </div>
      {portrait && <div className="elixrow"><BarRow n={g.P.elixir} who="YOU" spend={spend} /><BarRow n={g.E.elixir} who="ENEMY" /></div>}
      <div className="board">
        {/* columns: 1 queue/discard · 2 king · 3 tower · 4-7 lane · 8 tower · 9 king · 10 pile/discard; rows: enemy elixir · left lane · right lane · your elixir */}
        {!portrait && <BarCells n={g.E.elixir} who="ENEMY" row={1} at={at} />}
        <div className={`cell epilecell ${qpile ? 'open' : ''}`} style={at(1, 2)} onMouseEnter={() => setQpile(true)} onMouseLeave={() => setQpile(false)}><span className="clabel">your queue (next on top)</span><Pile items={g.P.queue.map(c => ({ tid: c.id, card: c }))} spread={qpile} /></div>
        <div className="cell kingcell" style={at(2, '2 / 4')}>
          <span className="clabel">YOUR KING tower · {g.P.towers.K.length}</span>
          <HStack items={mineSlots('K')} own mirror={false} cracked={g.cracked ?? []} />
        </div>
        {(['L', 'R'] as const).map((k, r) => (
          <div key={'pt' + k} className="cell" style={at(3, r + 2)}>
            <span className="clabel">YOUR {k === 'L' ? 'LEFT' : 'RIGHT'} tower · {g.P.towers[k].length}</span>
            <HStack items={mineSlots(k)} own mirror={false} cracked={g.cracked ?? []} />
          </div>
        ))}

        <LaneCells idx={0} units={g.units} laneLen={g.rules.laneLen} row={2} at={at} dragging={drag !== null && (!standing || g.lastStand?.lane === 0)} hint={standing && g.lastStand?.lane === 0} onDropCard={lane => { const h = drag; setDrag(null); if (h !== null) commit(standing ? lastStandPlay(g, h) : playCard(g, h, lane)) }} />
        <LaneCells idx={1} units={g.units} laneLen={g.rules.laneLen} row={3} at={at} dragging={drag !== null && (!standing || g.lastStand?.lane === 1)} hint={standing && g.lastStand?.lane === 1} onDropCard={lane => { const h = drag; setDrag(null); if (h !== null) commit(standing ? lastStandPlay(g, h) : playCard(g, h, lane)) }} />
        <div className="cell" style={at(1, 3)}><span className="clabel">your discard · {g.discard.filter(d => d.owner === 'P').length}</span><Discard items={g.discard.filter(d => d.owner === 'P')} /></div>
        <div className="cell" style={at(10, 3)}><span className="clabel">enemy discard · {g.discard.filter(d => d.owner === 'E').length}</span><Discard items={g.discard.filter(d => d.owner === 'E')} /></div>

        {(['L', 'R'] as const).map((k, r) => (
          <div key={'et' + k} className="cell" style={at(8, r + 2)}>
            <span className="clabel">ENEMY {k === 'L' ? 'LEFT' : 'RIGHT'} tower · {g.E.towers[k].length}</span>
            <HStack items={g.E.towers[k]} own={false} mirror cracked={g.cracked ?? []} />
          </div>
        ))}
        <div className="cell kingcell" style={at(9, '2 / 4')}>
          <span className="clabel">ENEMY KING tower · {g.E.towers.K.length}</span>
          <HStack items={g.E.towers.K} own={false} mirror cracked={g.cracked ?? []} />
        </div>
        <div className={`cell epilecell ${epile ? 'open' : ''}`} style={at(10, 2)} onMouseEnter={() => setEpile(true)} onMouseLeave={() => setEpile(false)}><span className="clabel">enemy pile ({g.E.queue.length}; {bottomKnown} known)</span><Pile items={g.E.queue} spread={epile} /></div>
        {!portrait && <BarCells n={g.P.elixir} who="YOU" row={4} at={at} spend={spend} />}
      </div>

      <div className="hand">
        <span className="clabel">your hand</span>
        {g.P.hand.map((c, i) => (
<div key={c.id} className={`hdrag ${drag === i ? 'lifted' : ''} ${!standing && !canPlay(g, i) ? 'off' : ''}`} draggable={standing || canPlay(g, i)} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} onDragStart={e => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; faceDragImage(e); setNote(null); setSel(null); setDrag(i) }} onDragEnd={() => setDrag(null)}>
  <TCard tid={c.id} card={c} down={false} showCost selected={sel === i} dim={!standing && !canPlay(g, i)} onClick={() => standing ? commit(lastStandPlay(g, i)) : canPlay(g, i) ? (setNote(null), setSel(sel === i ? null : i)) : (setSel(null), setNote(`${label(c)} costs ${cost(c.rank)} elixir but you only have ${g.P.elixir}. Pick a card whose purple number is ${g.P.elixir} or less.`))} />
          </div>
        ))}
        {!g.P.hand.length && <span className="muted">no cards in hand</span>}
        <div className="wheel" title="Suit wheel: each suit beats the next (+3 rank in a fight)"><span>beats →</span>{['♠', '♥', '♦', '♣'].map((x, k) => <Fragment key={x}>{k > 0 && '›'}<i className={`wcard ${k === 1 || k === 2 ? 'r' : ''}`}>{x}</i></Fragment>)}›<span>↺</span></div>
      </div>

      <dialog ref={helpRef} className="modal" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close() }}>
        <button className="close" onClick={() => helpRef.current?.close()}>✕</button>
        <div className="pcol">
        <div className="row"><b>Help:</b>
          {(['off', 'explain', 'suggest'] as Help[]).map(h => <button key={h} className={help === h ? 'on' : ''} onClick={() => setHelp(h)}>{h}</button>)}
          <button onClick={undo} disabled={!history.length}>↶ Undo</button>
        </div>
        <div className="donow">
          <div className="dntitle">{TITLES[stage]}</div>
          {stage !== 'my_play' && <ul className="todo">{g.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
          {stage === 'my_play' && (
            <>
              {g.lastAction.length > 0 && <div className="lastaction"><b>Do now:</b><ul className="todo">{g.lastAction.map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
              <p>Choose a card from your hand (or none), then where it goes. Faded cards cost more elixir than you have.</p>
              {portrait && <div className="row">{g.P.hand.map((c, i) => <button key={c.id} className={sel === i ? 'on' : ''} disabled={!canPlay(g, i)} onClick={() => { setNote(null); setSel(sel === i ? null : i) }}>{label(c)} · {cost(c.rank)}</button>)}</div>}
              {note && <p className="warn">{note}</p>}
              {sel !== null && (
                <div className="row">Place {label(g.P.hand[sel])} in:
                  <button className="big" onClick={() => commit(playCard(g, sel, 0))}>LEFT lane</button>
                  <button className="big" onClick={() => commit(playCard(g, sel, 1))}>RIGHT lane</button>
                </div>
              )}
              {help === 'explain' && <div className="explain"><b>Your options</b><ul>{options(g).map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
              {advice && (
                <div className="advice"><b>Suggestion:</b> {advice.reason}
                  {advice.kind === 'play' && <div><button onClick={() => commit(playCard(g, advice.handIndex, advice.lane))}>Do it: {label(g.P.hand[advice.handIndex])} → {advice.lane === 0 ? 'LEFT' : 'RIGHT'}</button></div>}
                  <div className="muted">It looks one round ahead using only what you can see on the table; it can't know the enemy's face-down cards. The plan can change as you draw new cards.</div>
                </div>
              )}
              <div className="row"><button className="big" onClick={() => commit(endMyTurn(g))}>I'm done — enemy turn →</button></div>
            </>
          )}
          {standing && <div className="row">{g.P.hand.map((c, i) => <button key={c.id} className="big" onClick={() => commit(lastStandPlay(g, i))}>{label(c)} → {g.lastStand?.lane === 0 ? 'LEFT' : 'RIGHT'}</button>)}</div>}
          {picker && (
            <>
              <p className="muted">Cards already known are greyed out.</p>
              <CardPicker disabled={excludedIds(g)} onPick={c => commit(hitEnemy ? enterTowerCard(g, c) : enterEnemyCard(g, c))} />
            </>
          )}
          {inform && <div className="row"><button className="big" onClick={() => commit(next(g))}>Done — next →</button></div>}
          {stage === 'over' && (
            <>
              <ul className="todo">{summary(g).map((l, i) => <li key={i}>{l}</li>)}</ul>
              <div className="row"><button className="big" onClick={reset}>New game</button></div>
            </>
          )}
          {help !== 'off' && g.why.length > 0 && <div className="why"><b>Why:</b> {g.why.join(' ')}</div>}
        </div>
        </div>
      </dialog>
      <dialog ref={logDlgRef} className="modal" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close() }}>
        <button className="close" onClick={() => logDlgRef.current?.close()}>✕</button>
        <div className="pcol">
        <h3>What happened</h3>
        <div className="log" ref={logRef}>{g.log.map((l, i) => <div key={i} className={l.startsWith('—') ? 'sep' : ''}>{l}</div>)}</div>
        </div>
      </dialog>
      <dialog ref={rulesRef} className="modal" onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close() }}>
        <button className="close" onClick={() => rulesRef.current?.close()}>✕</button>
        <h3>Rules</h3>
        <div className="legend">{RULES_60}</div>
      </dialog>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RANKS, SUITS, cost, isRed } from './engine'
import { landing } from './fx'
import type { Card } from './engine'

// Pieces shared by the deck screen and the arena.

// The face of a playing card, the same on every card in the game: rank over suit in the top-left corner like a real card,
// and (on a card you can play) its elixir cost on a ball at the middle of the bottom edge.
// Everything is sized from the card's width (--cw), so a small card is the same picture shrunk.
function Face({ card, showCost }: { card: Card; showCost?: boolean }) {
  return <>
    <div className="corner">{RANKS[card.rank]}<br />{SUITS[card.suit]}</div>
    {showCost && <div className="cost" title="elixir cost">{cost(card.rank)}</div>}
  </>
}

// A card that stays put (the title, the rules and the setup pictures): the same card as TCard, without the moves.
// Its size comes from --cw set by the place it is shown in (.scard's default otherwise).
export function PlayingCard({ card, down, showCost, selected, dim, className, onClick }: {
  card?: Card | null; down?: boolean; showCost?: boolean; selected?: boolean; dim?: boolean; className?: string; onClick?: () => void
}) {
  const up = !!card && !down
  return (
    <div className={`tcard scard ${className ?? ''} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className={`flip ${up ? '' : 'down'}`}>
        <div className={`cf front ${card && isRed(card) ? 'red' : 'black'}`}>{up && <Face card={card} showCost={showCost} />}</div>
        <div className="cf backside" />
      </div>
    </div>
  )
}

// A card on the board: it has a stable id (tid), so when it changes place it SLIDES there instead of jumping.
// A card that is revealed (face-down -> face-up) FLIPS while it moves.
const faceMemory = new Map<string, boolean>()
// fly: seconds a move takes (the board's moves are slow enough to follow; the deck screen's quicker)
// side: whose card it is ('P' you, 'E' the enemy), drawn as a ring and a wash of that side's colour
export function TCard({ tid, card, down, side, selected, dim, showCost, fly = 0.5, onClick }: {
  tid: string; card: Card | null; down: boolean; side?: 'P' | 'E'; selected?: boolean; dim?: boolean; showCost?: boolean; fly?: number; onClick?: () => void
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
      transition={{ layout: landing.has(tid) ? { duration: landing.get(tid), ease: [0.23, 1, 0.32, 1] } : { duration: fly, ease: [0.77, 0, 0.175, 1] } }}
      className={`tcard ${side ?? ''} ${selected ? 'selected' : ''} ${dim ? 'dim' : ''} ${onClick ? 'clickable' : ''}`}
      style={{ zIndex: 5 }} onClick={onClick} data-tid={tid}
    >
      <div className={`flip ${shown ? 'down' : ''}`}>
        <div className={`cf front ${card && isRed(card) ? 'red' : 'black'}`}>
          {card && <Face card={card} showCost={showCost} />}
        </div>
        <div className="cf backside" />
      </div>
    </motion.div>
  )
}

// The picture of a tower: a crowned keep for the king, a smaller one for the left and right towers (coloured by the .castle around it).
// A fallen tower is drawn as a ruin: its walls broken off, a crack, rubble at its foot (the king's crown lying beside it).
export function CastleArt({ king, fallen = false }: { king: boolean; fallen?: boolean }) {
  return (
    <svg className="cart" viewBox={king ? '0 0 64 56' : '0 16 64 40'} aria-hidden>
      {fallen
        ? king
          ? <path d="M6 54V22h8v6h8V14h8v6L34 26L31 31L37 34L42 30L47 35L52 32L58 38V54z" />
          : <path d="M12 54V18h8v6h6L30 30L27 34L34 33L39 36L45 34L49 39L52 37V54z" />
        : king
          ? <path d="M6 54V22h8v6h8V14h8v6h4v-6h8v14h8v-6h8v32z" />
          : <path d="M12 54V18h8v6h6v-6h12v6h6v-6h8v36z" />}
      {king && !fallen && <path className="crown" d="M21 10l1-8 5 5 5-6 5 6 5-5 1 8z" />}
      <path className="door" d="M27 54V42a5 5 0 0 1 10 0v12z" />
      {fallen && <>
        <path className="crack" d={king ? 'M14 31l3 5-2 4 3 6' : 'M18 30l3 5-2 4 3 6'} />
        <path d="M44 54l2-4 4-1 2 5z M53 54l1-4 4 1 1 3z" />
        {king && <path className="crown" transform="translate(50 50) rotate(24) scale(.45) translate(-34 -6)" d="M21 10l1-8 5 5 5-6 5 6 5-5 1 8z" />}
      </>}
    </svg>
  )
}

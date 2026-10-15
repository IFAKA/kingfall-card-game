import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { RANKS, SUITS, cost, isRed } from './engine'
import { landing } from './fx'
import type { Card } from './engine'

// Pieces shared by the deck screen and the arena.

// A card on the board: it has a stable id (tid), so when it changes place it SLIDES there instead of jumping.
// A card that is revealed (face-down -> face-up) FLIPS while it moves.
const faceMemory = new Map<string, boolean>()
// fly: seconds a move takes (the board's moves are slow enough to follow; the deck screen's quicker)
export function TCard({ tid, card, down, selected, dim, showCost, fly = 0.5, onClick }: {
  tid: string; card: Card | null; down: boolean; selected?: boolean; dim?: boolean; showCost?: boolean; fly?: number; onClick?: () => void
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

// The picture of a tower: a crowned keep for the king, a smaller one for the left and right towers (coloured by the .castle around it).
export function CastleArt({ king }: { king: boolean }) {
  return (
    <svg className="cart" viewBox={king ? '0 0 64 56' : '0 16 64 40'} aria-hidden>
      {king
        ? <path d="M6 54V22h8v6h8V14h8v6h4v-6h8v14h8v-6h8v32z" />
        : <path d="M12 54V18h8v6h6v-6h12v6h6v-6h8v36z" />}
      {king && <path className="crown" d="M21 10l1-8 5 5 5-6 5 6 5-5 1 8z" />}
      <path className="door" d="M27 54V42a5 5 0 0 1 10 0v12z" />
    </svg>
  )
}

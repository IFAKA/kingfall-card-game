import { createContext } from 'react'

// The board's moves happen when the game changes: every board card (TCard) re-renders, so framer-motion measures it and slides it, only then.
// Anything else (a hover, a drag, a pop-up) leaves the cards alone, so they aren't measured again for nothing.
export const BoardTick = createContext<unknown>(null)

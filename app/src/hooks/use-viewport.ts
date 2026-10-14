import { useEffect, useState } from 'react'

// The window size: the arena and the deck screen size their cards from it.
export function useViewport() {
  const read = () => ({ sw: innerWidth, sh: innerHeight })
  const [v, setV] = useState(read)
  useEffect(() => {
    const f = () => setV(read())
    addEventListener('resize', f); addEventListener('orientationchange', f)
    return () => { removeEventListener('resize', f); removeEventListener('orientationchange', f) }
  }, [])
  return v
}

import { useEffect, useState } from 'react'

// The room the cards are sized from: the window minus the top and bottom safe areas (a phone's notch, the home bar or Android's gesture/touch bar when the page is drawn
// under them, as in an installed app), which the arena's padding keeps clear. Without this the field would be sized for the whole window and overlap the bar.
function safeAreas() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'
  document.body.appendChild(probe)
  const s = getComputedStyle(probe)
  const px = (parseFloat(s.paddingTop) || 0) + (parseFloat(s.paddingBottom) || 0)
  probe.remove()
  return px
}

export function useViewport() {
  const read = () => ({ sw: innerWidth, sh: innerHeight - safeAreas() })
  const [v, setV] = useState(read)
  useEffect(() => {
    const f = () => setV(read())
    addEventListener('resize', f); addEventListener('orientationchange', f)
    return () => { removeEventListener('resize', f); removeEventListener('orientationchange', f) }
  }, [])
  return v
}

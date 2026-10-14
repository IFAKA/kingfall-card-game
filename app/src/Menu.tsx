import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { Switch } from '@base-ui/react/switch'

export type MenuPage = 'main' | 'rules' | 'log' | 'hints' | 'leave'

const wideQuery = '(min-width: 760px)'
function useWide() {
  const [wide, setWide] = useState(() => matchMedia(wideQuery).matches)
  useEffect(() => {
    const m = matchMedia(wideQuery), on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}

export const Toggle = ({ on, set, children }: { on: boolean; set: (on: boolean) => void; children: ReactNode }) => (
  <label className="gm-toggle"><span className="gm-label">{children}</span><Switch.Root className="gm-switch" checked={on} onCheckedChange={set}><Switch.Thumb className="gm-thumb" /></Switch.Root></label>
)

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
const ICONS = { menu: 'M4 6h16M4 12h16M4 18h16', undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3', redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3', back: 'm15 18-6-6 6-6', close: 'M6 6l12 12M18 6 6 18' }
export const IconButton = ({ icon, label, ...rest }: { icon: keyof typeof ICONS; label: string; onClick?: () => void; disabled?: boolean; className?: string }) => (
  <button {...rest} className={`iconbtn ${rest.className ?? ''}`} aria-label={label} title={label}><Icon d={ICONS[icon]} /></button>
)

// One menu for every screen: a bottom sheet on phones (swipe it down), a side panel on wide screens.
// On a turned table (upright phone, real-cards mode) it turns with the table and comes in from the table's right edge.
export function GameMenu({ open, page, setOpen, setPage, turned, rules, log, hints, muted, toggleMute, onLeave }: {
  open: boolean; page: MenuPage; setOpen: (open: boolean) => void; setPage: (p: MenuPage) => void
  turned?: CSSProperties; rules: ReactNode; log?: string[]; hints?: ReactNode; muted: boolean; toggleMute: () => void; onLeave?: () => void
}) {
  const wide = useWide()
  const [leaving, setLeaving] = useState(false) // leave only once the sheet has slid away, so the screen doesn't change under it
  const side = !!turned || wide
  const titles: Record<MenuPage, string> = { main: 'Menu', rules: 'How to play', log: 'What happened', hints: 'Hints', leave: 'Leave this game?' }
  const item = (p: MenuPage, icon: string, text: string, sub: string) => (
    <button className="gm-item" onClick={() => setPage(p)}><span className="gm-ic" aria-hidden>{icon}</span><span><b>{text}</b><small>{sub}</small></span><span className="gm-go" aria-hidden>›</span></button>
  )
  return (
    // a turned table swipes "down" on the glass, which is toward the table's right edge
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection={side && !turned ? 'right' : 'down'} onOpenChangeComplete={o => { if (o) return; setPage('main'); if (leaving) { setLeaving(false); onLeave?.() } }}>
      <Drawer.Portal>
        <Drawer.Backdrop className="gm-backdrop" />
        <Drawer.Viewport className={`gm-viewport ${turned ? 'turned' : side ? 'side' : 'sheet'}`} style={turned}>
          <Drawer.Popup className="gm-popup">
            {!side && <div className="gm-handle" />}
            <Drawer.Content className="gm-content">
              <div className="gm-head">
                {page !== 'main' && <IconButton icon="back" label="Back" onClick={() => setPage('main')} />}
                <Drawer.Title className="gm-title">{titles[page]}</Drawer.Title>
                <Drawer.Close className="iconbtn" aria-label="Close" title="Close"><Icon d={ICONS.close} /></Drawer.Close>
              </div>
              {page === 'main' && <div className="gm-list">
                {item('rules', '📖', 'How to play', 'The rules in 60 seconds')}
                {log && item('log', '📜', 'What happened', 'Every play and fight so far')}
                {hints && item('hints', '💡', 'Hints', 'Explain options, suggest moves, tips')}
                <Toggle on={!muted} set={toggleMute}><span className="gm-ic" aria-hidden>{muted ? '🔇' : '🔊'}</span><b>Sound</b></Toggle>
                {onLeave && <button className="red gm-leave" onClick={() => setPage('leave')}>Leave game</button>}
              </div>}
              {page === 'rules' && <div className="legend">{rules}</div>}
              {page === 'log' && log && <div className="log" ref={el => el?.scrollTo({ top: el.scrollHeight })}>{log.map((l, i) => <div key={i} className={l.startsWith('—') ? 'sep' : ''}>{l}</div>)}</div>}
              {page === 'hints' && hints}
              {page === 'leave' && onLeave && <>
                <p>The game will be discarded and you go back to the title screen.</p>
                <div className="gm-confirm">
                  <Drawer.Close className="green">Keep playing</Drawer.Close>
                  <button className="red" onClick={() => { setLeaving(true); setOpen(false) }}>Leave game</button>
                </div>
              </>}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

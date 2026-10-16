// The game's look, for the trailer's own pictures: its fonts, colours, logo and playing cards (same shapes as app/src).
import type { CSSProperties, ReactNode } from 'react'
import '@fontsource/lilita-one'
import '@fontsource-variable/baloo-2'
import config from '../trailer.config.json'

// the game's name and web address: change them in trailer.config.json, every card and caption reads them from here
export const NAME = config.name
export const URL_TEXT = config.url

export const C = { gold: '#ffcf3a', goldD: '#e39a00', ink: '#3a2300', navy: '#0e1838', blue: '#1d3474', sky: '#2c4a9a', green: '#4cc263', red: '#c0262d' }
export const DISPLAY = "'Lilita One', 'Baloo 2 Variable', sans-serif"
export const BODY = "'Baloo 2 Variable', sans-serif"

export const backdrop: CSSProperties = { background: `radial-gradient(ellipse at 50% 0%, ${C.sky} 0%, ${C.blue} 45%, ${C.navy} 100%)` }

// gold letters with a dark brown outline and a drop, like the game's title screen logo
export const goldText = (size: number): CSSProperties => ({
  fontFamily: DISPLAY, fontSize: size, lineHeight: 0.95, letterSpacing: '.03em', color: C.gold,
  background: `linear-gradient(#fff2b0, ${C.gold} 45%, ${C.goldD})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
  WebkitTextStroke: `${size * 0.045}px ${C.ink}`, paintOrder: 'stroke fill',
  filter: `drop-shadow(0 ${size * 0.06}px 0 ${C.ink}) drop-shadow(0 ${size * 0.12}px ${size * 0.1}px rgba(0,0,0,.5))`,
})
export const whiteText = (size: number): CSSProperties => ({
  fontFamily: DISPLAY, fontSize: size, lineHeight: 1.05, color: '#fff', letterSpacing: '.02em',
  textShadow: `0 ${size * 0.07}px 0 rgba(0,0,0,.55), 0 0 ${size * 0.3}px rgba(0,0,0,.45)`,
})

export function Crown({ width, style }: { width: number; style?: CSSProperties }) {
  return (
    <svg viewBox="-4 -4 72 46" width={width} style={{ overflow: 'visible', filter: `drop-shadow(0 ${width * 0.05}px 0 ${C.ink})`, ...style }}>
      <g fill={C.gold} stroke={C.ink} strokeWidth={3} strokeLinejoin="round">
        <path d="M6 36 L2 8 L18 20 L32 2 L46 20 L62 8 L58 36 Z" /><circle cx="2" cy="8" r="4" /><circle cx="32" cy="3" r="4" /><circle cx="62" cy="8" r="4" />
      </g>
    </svg>
  )
}

// the name in gold under a crown. A long name of several words goes on two lines; a line longer than 8 letters (SUITKEEP's)
// gets smaller type, so the logo keeps about the same width whatever the name
function lines(name: string) {
  const words = name.split(' ')
  if (name.length <= 10 || words.length < 2) return [name]
  // the split whose longer line is shortest
  const splits = words.slice(1).map((_, i) => [words.slice(0, i + 1).join(' '), words.slice(i + 1).join(' ')])
  return splits.reduce((a, b) => (Math.max(...b.map(l => l.length)) < Math.max(...a.map(l => l.length)) ? b : a))
}
const NAME_LINES = lines(NAME)
export function Logo({ size, style }: { size: number; style?: CSSProperties }) {
  const fit = size * Math.min(1, 8 / Math.max(1, ...NAME_LINES.map(l => l.length)))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: style?.alignItems ?? 'center', ...style }}>
      <Crown width={size * 1.05} style={{ marginBottom: -size * 0.08 }} />
      {NAME_LINES.map(l => <div key={l} style={{ ...goldText(fit), whiteSpace: 'nowrap', textAlign: 'center' }}>{l.toUpperCase()}</div>)}
    </div>
  )
}

const SUITS = ['♠', '♥', '♦', '♣']
// a playing card face as the game draws it: rank over suit in the top-left corner, a big suit at the bottom right
export function Card({ rank, suit, width, style }: { rank: string; suit: number; width: number; style?: CSSProperties }) {
  const red = suit === 1 || suit === 2
  return (
    <div style={{
      width, height: width * 1.4, borderRadius: width * 0.1, background: '#fbfbf6', border: `${Math.max(1, width * 0.015)}px solid #999`,
      boxShadow: `0 ${width * 0.04}px ${width * 0.1}px rgba(0,0,0,.45)`, position: 'relative', color: red ? C.red : '#1b1b1b', boxSizing: 'border-box', ...style,
    }}>
      <div style={{ position: 'absolute', left: width * 0.09, top: width * 0.05, fontFamily: DISPLAY, fontSize: width * 0.28, lineHeight: 1, textAlign: 'center' }}>{rank}<br />{SUITS[suit]}</div>
      <div style={{ position: 'absolute', right: width * 0.08, bottom: width * 0.02, fontSize: width * 0.55, lineHeight: 1 }}>{SUITS[suit]}</div>
    </div>
  )
}

export const Row = ({ children, gap, style }: { children: ReactNode; gap: number; style?: CSSProperties }) =>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap, ...style }}>{children}</div>

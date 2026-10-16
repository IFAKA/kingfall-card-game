// The trailer: hook (an ace kills a king), title, how a round plays, the suit wheel, towers, a build, the king falls, end card.
// Every section starts on a beat of the music (src/plan.ts); the moments of the game it shows are picked in src/cuts.ts.
import type { CSSProperties, ReactNode } from 'react'
import { AbsoluteFill, Audio, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY, C, Card, Logo, Row, URL_TEXT, backdrop, goldText, whiteText } from './brand'
import { CUTS } from './cuts'
import { BoxSize, GameClip } from './GameClip'
import type { Framing } from './GameClip'
import { S, frames } from './plan'

export type Layout = 'tall' | 'wide'

// a caption pops in (a quick overshoot) and stays; `big` lines are gold, the others white
function Caption({ lines, size, align = 'center', delay = 0 }: { lines: { text: ReactNode; big?: boolean }[]; size: number; align?: 'center' | 'left'; delay?: number }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'left' ? 'flex-start' : 'center', gap: size * 0.12, textAlign: align }}>
      {lines.map((l, i) => {
        const s = spring({ frame: frame - delay - i * 3, fps, config: { damping: 11, stiffness: 220, mass: 0.6 } })
        return <div key={i} style={{ ...(l.big ? goldText(size) : whiteText(size * 0.62)), transform: `scale(${0.6 + 0.4 * s})`, opacity: Math.min(1, s * 2), transformOrigin: align === 'left' ? 'left center' : 'center', textWrap: 'balance' }}>{l.text}</div>
      })}
    </div>
  )
}

// a cut lands with a small push (the frame settles from 104%) and, on the big hits, a white flash
function Punch({ children, flash = 0 }: { children: ReactNode; flash?: number }) {
  const frame = useCurrentFrame()
  const z = interpolate(frame, [0, 7], [1.04, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  const white = flash ? interpolate(frame, [0, 2, 9], [flash, flash, 0], { extrapolateRight: 'clamp' }) : 0
  return (
    <AbsoluteFill style={{ transform: `scale(${z})` }}>
      {children}
      {white > 0 && <AbsoluteFill style={{ background: '#fff', opacity: white }} />}
    </AbsoluteFill>
  )
}

// the screen the game plays on, and the space for the words: a band above it (tall) or the left half (wide)
function Shot({ layout, caption, children }: { layout: Layout; caption?: ReactNode; children: ReactNode }) {
  const { width, height } = useVideoConfig()
  const box: CSSProperties = layout === 'tall'
    ? { position: 'absolute', left: (width - (height - 330) * 9 / 16) / 2, top: 330, width: (height - 330) * 9 / 16, height: height - 330 }
    : { position: 'absolute', left: width / 2, top: 0, width: height * 9 / 16, height } // its left edge on the center line
  return (
    <AbsoluteFill style={backdrop}>
      <div style={{ ...box, borderRadius: layout === 'tall' ? '34px 34px 0 0' : 0, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <BoxSize.Provider value={{ width: box.width as number, height: box.height as number }}>{children}</BoxSize.Provider>
      </div>
      {layout === 'tall'
        ? <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 330, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{caption}</div>
        : <>
          <div style={{ position: 'absolute', left: 130, top: 0, bottom: 0, width: width / 2 - 130 - 60, display: 'flex', alignItems: 'center' }}>{caption}</div>
          <Logo size={54} style={{ position: 'absolute', left: 130, top: 60, alignItems: 'flex-start' }} />
        </>}
    </AbsoluteFill>
  )
}

// a section of the game: one or more clips cut back to back, each `beats` long, under one caption
type Clip = { at: number; beats: number; speed?: number; from?: Framing; to?: Framing; flash?: number; volume?: number }
function Section({ layout, clips, caption }: { layout: Layout; clips: Clip[]; caption?: ReactNode }) {
  let t = 0
  return (
    <Shot layout={layout} caption={caption}>
      {clips.map((c, i) => {
        const start = frames(t), dur = frames(t + c.beats) - start
        t += c.beats
        return (
          <Sequence key={i} from={start} durationInFrames={dur}>
            <Punch flash={c.flash}><GameClip at={c.at} speed={c.speed} from={c.from} to={c.to} volume={c.volume} dur={dur} /></Punch>
          </Sequence>
        )
      })}
    </Shot>
  )
}

function Title({ layout }: { layout: Layout }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig()
  const slam = spring({ frame, fps, config: { damping: 9, stiffness: 160, mass: 0.7 } })
  const shake = frame < 12 ? Math.sin(frame * 2.7) * (12 - frame) * 1.6 : 0
  const sub = spring({ frame: frame - 14, fps, config: { damping: 14 } })
  const white = interpolate(frame, [0, 2, 12], [1, 0.9, 0], { extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ ...backdrop, alignItems: 'center', justifyContent: 'center' }}>
      {/* the board, blurred and dark, so the title sits on the game */}
      <AbsoluteFill style={{ filter: 'blur(14px) brightness(.38) saturate(.8)', transform: 'scale(1.1)' }}><GameClip at={CUTS.titleBack} dur={frames(S.loop - S.title)} volume={0} from={{ scale: layout === 'tall' ? 1.2 : 3.2, x: 216, y: 330 }} to={{ scale: layout === 'tall' ? 1.3 : 3.4, x: 216, y: 330 }} /></AbsoluteFill>
      <div style={{ transform: `translate(${shake}px, ${shake * 0.6}px) scale(${2.2 - 1.2 * slam})`, opacity: Math.min(1, slam * 3) }}>
        <Logo size={layout === 'tall' ? 190 : 200} />
      </div>
      <div style={{ ...whiteText(layout === 'tall' ? 58 : 54), marginTop: 40, opacity: sub, transform: `translateY(${(1 - sub) * 30}px)` }}>A solo card battle</div>
      <AbsoluteFill style={{ background: '#fff', opacity: white }} />
    </AbsoluteFill>
  )
}

function EndCard({ layout }: { layout: Layout }) {
  const frame = useCurrentFrame(), { fps } = useVideoConfig()
  const pop = (d: number) => spring({ frame: frame - d, fps, config: { damping: 12, stiffness: 180 } })
  const tall = layout === 'tall'
  const white = interpolate(frame, [0, 2, 12], [1, 0.9, 0], { extrapolateRight: 'clamp' })
  const fan = (
    <Row gap={0} style={{ transform: `scale(${pop(24)})`, opacity: pop(24) }}>
      {[['A', 0, -14], ['K', 1, 0], ['Q', 2, 14]].map(([r, s, a]) => (
        <Card key={r as string} rank={r as string} suit={s as number} width={tall ? 120 : 96} style={{ transform: `rotate(${a}deg) translateY(${Math.abs(a as number) * 1.4}px)`, margin: '0 -10px' }} />
      ))}
    </Row>
  )
  return (
    <AbsoluteFill style={{ ...backdrop, alignItems: 'center', justifyContent: 'center', gap: tall ? 54 : 34 }}>
      <div style={{ transform: `scale(${pop(0)})` }}><Logo size={tall ? 160 : 130} /></div>
      <div style={{ transform: `scale(${pop(8)})`, opacity: pop(8) }}>
        <div style={goldText(tall ? 120 : 104)}>PLAY FREE</div>
        <div style={{ ...whiteText(tall ? 60 : 52), textAlign: 'center', marginTop: 10 }}>in your browser</div>
      </div>
      <div style={{
        transform: `scale(${pop(16)})`, opacity: pop(16), fontFamily: BODY, fontWeight: 800, fontSize: tall ? 50 : 44, color: C.navy,
        background: `linear-gradient(${C.gold}, ${C.goldD})`, padding: tall ? '18px 40px' : '14px 36px', borderRadius: 999, boxShadow: `inset 0 3px 0 rgba(255,255,255,.55), 0 6px 0 #6e4300`,
      }}>{URL_TEXT}</div>
      {fan}
      <div style={{ ...whiteText(tall ? 44 : 38), opacity: pop(30), textAlign: 'center', maxWidth: tall ? 900 : 1400 }}>or play it with a real deck of cards</div>
      <AbsoluteFill style={{ background: '#fff', opacity: white }} />
    </AbsoluteFill>
  )
}

export function Trailer({ layout }: { layout: Layout }) {
  const tall = layout === 'tall', size = tall ? 112 : 120, align = tall ? 'center' : 'left'
  const sec = (from: number, to: number, el: ReactNode) => <Sequence from={frames(from)} durationInFrames={frames(to) - frames(from)}>{el}</Sequence>
  const half = (a: ReactNode, b: ReactNode, beats: number) => <><Sequence durationInFrames={frames(beats)} layout="none">{a}</Sequence><Sequence from={frames(beats)} layout="none">{b}</Sequence></>
  const cap = (lines: { text: ReactNode; big?: boolean }[]) => <Caption lines={lines} size={size} align={align} />
  return (
    <AbsoluteFill style={{ background: C.navy }}>
      <Audio src={staticFile('music.wav')} volume={0.85} />
      {sec(S.hook, S.title, <Section layout={layout} clips={CUTS.hook} caption={half(cap([{ text: 'An ace…' }, { text: 'VS A KING', big: true }]), cap([{ text: 'The ace' }, { text: 'WINS!', big: true }]), CUTS.hookContact)} />)}
      {sec(S.title, S.loop, <Title layout={layout} />)}
      {sec(S.loop, S.suits, <Section layout={layout} clips={CUTS.loop} caption={half(cap([{ text: 'Every card is a soldier' }, { text: 'SEND THEM IN', big: true }]), cap([{ text: 'Where they meet,' }, { text: 'HIGHER WINS', big: true }]), CUTS.loopSplit)} />)}
      {sec(S.suits, S.towers, <Section layout={layout} clips={CUTS.suits} caption={cap([{ text: '♠ › ♥ › ♦ › ♣ › ♠' }, { text: 'SUIT WINS ×2', big: true }])} />)}
      {sec(S.towers, S.build, <Section layout={layout} clips={CUTS.towers} caption={cap([{ text: 'Every hit counts' }, { text: 'TAKE THE TOWERS', big: true }])} />)}
      {sec(S.build, S.drop, <Section layout={layout} clips={CUTS.build} caption={
        <>{['PLAN.', 'STRIKE.', 'BREAK.', 'HOLD.'].map((w, i) => <Sequence key={w} from={frames(i * 2)} durationInFrames={frames(2)} layout="none"><Caption lines={[{ text: w, big: true }]} size={size * 1.15} align={align} /></Sequence>)}</>
      } />)}
      {sec(S.drop, S.end, <Section layout={layout} clips={CUTS.drop} caption={cap([{ text: 'Bring down' }, { text: 'THE KING', big: true }])} />)}
      {sec(S.end, S.out, <EndCard layout={layout} />)}
    </AbsoluteFill>
  )
}

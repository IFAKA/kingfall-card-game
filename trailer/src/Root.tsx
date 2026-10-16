import { Composition, continueRender, delayRender } from 'remotion'
import { Trailer } from './Trailer'
import { FPS, TOTAL_FRAMES } from './plan'

// the fonts load before any frame is drawn, so no frame shows a fallback font
const fonts = delayRender('fonts')
Promise.all(['400 100px "Lilita One"', '800 100px "Baloo 2 Variable"'].map(f => document.fonts.load(f))).then(() => continueRender(fonts))

export const Root = () => (
  <>
    {/* TikTok, Reels, Shorts, Reddit on phones */}
    <Composition id="Tall" component={Trailer} defaultProps={{ layout: 'tall' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1080} height={1920} />
    {/* YouTube, itch.io, the web */}
    <Composition id="Wide" component={Trailer} defaultProps={{ layout: 'wide' as const }} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
  </>
)

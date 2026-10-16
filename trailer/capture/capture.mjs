// Plays the first-game deal (src/tutorial.ts) by itself, following the app's own suggestions, and records it frame by frame:
// out/gameplay.mp4 (the arena, 1080x1920), out/gameplay.wav (the game's own synthesized sounds, in sync) and
// out/timeline.json (when each step happened and where the finger was, for the edit).
// Runs inside the Linux container (see run.sh): Chrome only renders frame by frame on demand there, not on macOS.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { capture, launch, PuppeteerCaptureFormat } from 'puppeteer-capture'
import { advise, adviseLastStand } from '../../app/src/guide.ts'

const ROOT = new URL('..', import.meta.url).pathname
const BUILD = path.join(ROOT, 'app-build'), OUT = path.join(ROOT, 'out')
const FPS = 60, W = 432, H = 768, SCALE = Number(process.env.SCALE ?? 2.5) // a phone screen in CSS pixels; 2.5x makes 1080x1920
const MAX_ROUNDS = Number(process.env.MAX_ROUNDS ?? 99)
// the app's saved-game and first-game keys, read from its source so a rename of the game (or a new save version) can't break the script
const APP = fs.readFileSync(new URL('../../app/src/App.tsx', import.meta.url), 'utf8')
const appConst = name => {
  const m = APP.match(new RegExp(`const ${name} = '([^']+)'`))
  if (!m) throw new Error(`app/src/App.tsx no longer defines ${name}: update capture/capture.mjs`)
  return m[1]
}
const STORAGE_KEY = appConst('STORAGE_KEY'), TIPS_KEY = appConst('TIPS_KEY'), PLAYED_KEY = appConst('PLAYED_KEY')
// every first-game tip, marked seen so none covers the board
const ALL_TIPS = [...(APP.match(/type TipId = ([^\n]+)/)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map(m => m[1])
if (!ALL_TIPS.length) throw new Error('app/src/App.tsx no longer defines type TipId: update capture/capture.mjs')
fs.mkdirSync(OUT, { recursive: true })

// the built game, served locally (module scripts don't load from file://)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }
const server = http.createServer((req, res) => {
  const p = path.join(BUILD, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  const f = fs.existsSync(p) && fs.statSync(p).isFile() ? p : path.join(BUILD, 'index.html')
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' })
  fs.createReadStream(f).pipe(res)
}).listen(4173)

// The game's sounds go into an offline audio context instead of the speakers. Its clock is the page's (virtual) clock, so every
// sound lands in the track exactly when it happened in the video. Sounds made before recording starts land in the pre-roll and are cut.
const PRE = 5, LEN = 420, SR = 48000
const audioHook = `(() => {
  let ctx = null
  window.__audio = { t0: null }
  const Offline = OfflineAudioContext
  window.AudioContext = window.webkitAudioContext = function () {
    if (!ctx) ctx = new Offline(2, ${SR} * ${PRE + LEN}, ${SR})
    window.__audio.ctx = ctx
    return new Proxy(ctx, { get(t, p) {
      if (p === 'currentTime') { const t0 = window.__audio.t0; return t0 === null ? 0.01 : ${PRE} + (performance.now() - t0) / 1000 }
      if (p === 'state') return 'running'
      if (p === 'resume' || p === 'suspend') return () => Promise.resolve()
      const v = Reflect.get(t, p, t)
      return typeof v === 'function' ? v.bind(t) : v
    } })
  }
})()`

const browser = await launch({
  executablePath: '/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell',
  args: ['--no-sandbox', '--font-render-hinting=none', `--force-device-scale-factor=${SCALE}`],
})
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE, isMobile: true, hasTouch: false })
const recorder = await capture(page, {
  fps: FPS,
  format: PuppeteerCaptureFormat.MP4('slow'),
  customFfmpegConfig: async ff => { ff.outputOptions(['-crf 12', '-pix_fmt yuv420p']) },
})
await page.evaluateOnNewDocument(audioHook)
// The recorder runs the page's requestAnimationFrame callbacks itself, so Chrome sees no frame callback and skips the main-thread
// animation update on frames where only composited animations move: element.animate(...).finished would never resolve (the fights'
// strike awaits it). One real, empty frame callback keeps that update running every frame.
await page.evaluateOnNewDocument(`(() => {
  const raf = window.__PuppeteerCaptureViaHeadlessExperimental?.window_requestAnimationFrame
  if (raf) { const loop = () => raf(loop); raf(loop) }
})()`)
page.on('pageerror', e => console.error('page error:', e.message))

// a first-time player (so the app deals the fixed first game) who has seen every tip (so none covers the board)
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' })
await page.evaluate((tips, tipsKey, playedKey) => { localStorage.clear(); localStorage.setItem(tipsKey, JSON.stringify(tips)); localStorage.setItem(playedKey, '{"play":0,"guide":0}') }, ALL_TIPS, TIPS_KEY, PLAYED_KEY)
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Play') && !b.textContent.includes('real'))?.click())
await page.waitForSelector('.arena .handrow')
// suggestions off: the trailer shows the game, not its hints (the script still follows them, so the game plays out as designed)
await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.help = 'off'; localStorage.setItem(k, JSON.stringify(s)) }, STORAGE_KEY)
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForSelector('.arena .handrow')

const timeline = []
const now = () => page.evaluate(() => performance.now() - window.__audio.t0)
const game = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).game, STORAGE_KEY)
const wait = ms => recorder.waitForTimeout(ms)
const center = sel => page.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
let finger = { x: W / 2, y: H * 0.9 }
const point = async (x, y, down) => { finger = { x, y }; await page.mouse.move(x, y); timeline.push({ t: await now(), type: 'finger', x, y, down }) }

// a hand moves a card the way a person does: a short reach, a press, an eased arc to the lane, a release
async function drag(from, to) {
  const a = await center(from), b = await center(to)
  const reach = 14
  for (let i = 1; i <= reach; i++) { const e = 1 - (1 - i / reach) ** 3; await point(finger.x + (a.x - finger.x) * e, finger.y + (a.y - finger.y) * e, false); await wait(1000 / FPS) }
  await page.mouse.down(); timeline.push({ t: await now(), type: 'press', x: a.x, y: a.y })
  await wait(120)
  const steps = 30
  for (let i = 1; i <= steps; i++) {
    const p = i / steps, e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2
    await point(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e - Math.sin(Math.PI * p) * 18, true)
    await wait(1000 / FPS)
  }
  await wait(60)
  await page.mouse.up(); timeline.push({ t: await now(), type: 'release', x: b.x, y: b.y })
}
async function tap(sel) {
  const a = await center(sel)
  for (let i = 1; i <= 14; i++) { const e = 1 - (1 - i / 14) ** 3; await point(finger.x + (a.x - finger.x) * e, finger.y + (a.y - finger.y) * e, false); await wait(1000 / FPS) }
  await page.mouse.down(); timeline.push({ t: await now(), type: 'press', x: a.x, y: a.y })
  await wait(90)
  await page.mouse.up(); timeline.push({ t: await now(), type: 'release', x: a.x, y: a.y })
}
const key = g => `${g.stage}|${g.round}|${g.log.length}|${g.units.length}|${g.P.hand.length}|${g.P.elixir}`
async function settled(before) {
  for (let i = 0; i < 60; i++) { await wait(50); const g = await game(); if (key(g) !== before) return g }
  return game()
}

// the frame clock starts at the machine's monotonic time: from 0, Chrome ignores it and CSS animations run on the real clock
recorder._frameTimeTicks = Number(process.hrtime.bigint() / 1000n) / 1000
await recorder.start(path.join(OUT, 'gameplay.mp4'))
await page.evaluate(() => { window.__audio.t0 = performance.now() })
const t0 = Date.now()
let last = '', acted = false
for (;;) {
  const g = await game()
  const k = `${g.stage}|${g.round}|${g.log.length}`
  if (k !== last) {
    last = k
    timeline.push({ t: await now(), type: 'step', stage: g.stage, round: g.round, events: g.events ?? [], lines: g.lines, winner: g.winner })
    console.log(`${((await now()) / 1000).toFixed(1)}s round ${g.round} ${g.stage} ${(g.events ?? []).map(e => e.type + (e.double ? 'x2' : '') + (e.ace ? 'ace' : '') + (e.destroyed ? '!' : '')).join(' ')}  (${((Date.now() - t0) / 1000).toFixed(0)}s real)`)
  }
  if (g.stage === 'over') { await wait(7000); break }
  if (g.round > MAX_ROUNDS) break
  if (g.stage === 'my_play' || g.stage === 'my_last_stand') {
    const a = g.stage === 'my_play' ? advise(g) : adviseLastStand(g)
    await wait(acted ? 380 : 750) // a moment to look at the board first
    if (a?.kind === 'play') {
      const lane = g.stage === 'my_last_stand' ? g.lastStand.lane : a.lane
      await drag(`.hdrag[data-i="${a.handIndex}"]`, `.spot.slot.mine[data-lane="${lane}"]`)
      acted = true
    } else {
      await tap('.endturn')
      acted = false
    }
    await settled(key(g))
    continue
  }
  acted = false
  await wait(100)
  if (process.env.DEBUG && (await now()) - timeline.findLast(x => x.type === 'step').t > 2600) {
    console.log(JSON.stringify(await page.evaluate(() => ({ tl: document.timeline.currentTime, now: performance.now(), anims: document.getAnimations().map(a => ({ name: a.animationName ?? a.constructor.name, state: a.playState, t: a.currentTime, start: a.startTime, pending: a.pending, dur: a.effect?.getComputedTiming().endTime })) }))))
    break
  }
}
const seconds = (await now()) / 1000
await recorder.stop()
await recorder.detach()
console.log(`video: ${seconds.toFixed(1)}s in ${((Date.now() - t0) / 1000).toFixed(0)}s real`)

// render the sound track for the recorded span and save it as 16-bit stereo WAV
const frames = Math.ceil(seconds * SR)
await page.evaluate(async () => { const c = window.__audio.ctx; if (c) window.__audio.buf = await c.startRendering() })
const pcm = Buffer.alloc(frames * 4)
const CHUNK = SR * 10
for (let s = 0; s < frames; s += CHUNK) {
  const b64 = await page.evaluate((from, n) => {
    const b = window.__audio.buf, out = new Int16Array(n * 2)
    if (b) {
      const l = b.getChannelData(0), r = b.getChannelData(1)
      for (let i = 0; i < n; i++) { out[2 * i] = Math.max(-1, Math.min(1, l[from + i] ?? 0)) * 32767; out[2 * i + 1] = Math.max(-1, Math.min(1, r[from + i] ?? 0)) * 32767 }
    }
    let s = ''; const u = new Uint8Array(out.buffer)
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
    return btoa(s)
  }, PRE * SR + s, Math.min(CHUNK, frames - s))
  Buffer.from(b64, 'base64').copy(pcm, s * 4)
}
const head = Buffer.alloc(44)
head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8); head.write('fmt ', 12)
head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28)
head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40)
fs.writeFileSync(path.join(OUT, 'gameplay.wav'), Buffer.concat([head, pcm]))
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ fps: FPS, width: W, height: H, scale: SCALE, seconds, timeline }, null, 1))
console.log('done')
await browser.close()
server.close()

// Renders the music to WAV files, to listen to outside the game, and prints how loud each piece is:
//   node scripts/music.ts   →   $TMPDIR/suitkeep-music/title.wav, game.wav, game-tense.wav (a minute each)
// src/music.ts runs in Chrome (Web Audio has no Node version), served by Vite.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { createServer } from 'vite'

const server = await createServer({ root: path.resolve(import.meta.dirname, '..'), server: { port: 0 }, logLevel: 'silent' })
await server.listen()
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.goto(server.resolvedUrls!.local[0])
const dir = path.join(os.tmpdir(), 'suitkeep-music')
fs.mkdirSync(dir, { recursive: true })
for (const [name, scene, tenseFrom] of [['title', 'title', -1], ['game', 'game', -1], ['game-tense', 'game', 0]] as const) {
  const r = await page.evaluate(async ([scene, tenseFrom]) => {
    const { render } = await import('/src/music.ts')
    const sr = 48000, a = new OfflineAudioContext(2, sr * 60, sr)
    render(a, scene, tenseFrom < 0 ? Infinity : tenseFrom)
    const buf = await a.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1)
    let peak = 0, sum = 0
    const pcm = new Int16Array(L.length * 2)
    for (let i = 0; i < L.length; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); sum += L[i] * L[i] + R[i] * R[i]
      pcm[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767
    }
    const bytes = new Uint8Array(pcm.buffer)
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return { peak, rms: Math.sqrt(sum / (L.length * 2)), sr, pcm: btoa(bin) }
  }, [scene, tenseFrom] as const)
  const pcm = Buffer.from(r.pcm, 'base64'), head = Buffer.alloc(44)
  head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVE', 8); head.write('fmt ', 12)
  head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22); head.writeUInt32LE(r.sr, 24); head.writeUInt32LE(r.sr * 4, 28)
  head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40)
  fs.writeFileSync(path.join(dir, `${name}.wav`), Buffer.concat([head, pcm]))
  const db = (x: number) => (20 * Math.log10(x)).toFixed(1)
  console.log(`${name.padEnd(11)} peak ${db(r.peak)} dBFS, loudness (RMS) ${db(r.rms)} dBFS`)
}
console.log(`written to ${dir}`)
await browser.close()
await server.close()

// Suitkeep's driver for trailer-kit: plays the first-game deal (../app/src/tutorial.ts) by itself, following the app's own suggestions.
// It is the only code that touches the game's source. It marks every step of the game on the timeline (the edit's moments.ts reads them).
import fs from 'node:fs'
import { advise, adviseLastStand } from '../app/src/guide.ts'

// the app's saved-game and first-game keys, read from its source so a rename of the game (or a new save version) can't break the script
const APP = fs.readFileSync(new URL('../app/src/App.tsx', import.meta.url), 'utf8')
const appConst = name => {
  const m = APP.match(new RegExp(`const ${name} = '([^']+)'`))
  if (!m) throw new Error(`app/src/App.tsx no longer defines ${name}: update trailer/driver.mjs`)
  return m[1]
}
const STORAGE_KEY = appConst('STORAGE_KEY'), TIPS_KEY = appConst('TIPS_KEY'), PLAYED_KEY = appConst('PLAYED_KEY')
// every first-game tip, marked seen so none covers the board
const ALL_TIPS = [...(APP.match(/type TipId = ([^\n]+)/)?.[1] ?? '').matchAll(/'([a-z0-9]+)'/g)].map(m => m[1])
if (!ALL_TIPS.length) throw new Error('app/src/App.tsx no longer defines type TipId: update trailer/driver.mjs')
const MAX_ROUNDS = Number(process.env.MAX_ROUNDS ?? 99)

export async function setup({ page, url }) {
  // a first-time player (so the app deals the fixed first game) who has seen every tip (so none covers the board)
  await page.evaluate((tips, tipsKey, playedKey) => { localStorage.clear(); localStorage.setItem(tipsKey, JSON.stringify(tips)); localStorage.setItem(playedKey, '{"play":0,"guide":0}') }, ALL_TIPS, TIPS_KEY, PLAYED_KEY)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Play') && !b.textContent.includes('real'))?.click())
  await page.waitForSelector('.arena .handrow')
  // suggestions off: the trailer shows the game, not its hints (the script still follows them, so the game plays out as designed)
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.help = 'off'; localStorage.setItem(k, JSON.stringify(s)) }, STORAGE_KEY)
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('.arena .handrow')
}

export async function play({ page, wait, now, mark, drag, tap, progress, t0 }) {
  const game = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)).game, STORAGE_KEY)
  const key = g => `${g.stage}|${g.round}|${g.log.length}|${g.units.length}|${g.P.hand.length}|${g.P.elixir}`
  async function settled(before) {
    for (let i = 0; i < 60; i++) { await wait(50); const g = await game(); if (key(g) !== before) return g }
    return game()
  }
  let last = '', acted = false, lastStep = 0
  for (;;) {
    const g = await game()
    const k = `${g.stage}|${g.round}|${g.log.length}`
    if (k !== last) {
      last = k
      lastStep = await mark('step', { stage: g.stage, round: g.round, events: g.events ?? [], lines: g.lines, winner: g.winner })
      const what = (g.events ?? []).map(e => e.type + (e.double ? 'x2' : '') + (e.ace ? 'ace' : '') + (e.destroyed ? '!' : '')).join(' ')
      console.log(`${(lastStep / 1000).toFixed(1)}s round ${g.round} ${g.stage} ${what}  (${((Date.now() - t0) / 1000).toFixed(0)}s real)`)
      progress({ round: g.round, gameStage: g.stage, detail: `Round ${g.round} · ${g.stage.replace(/_/g, ' ')}${what ? ' · ' + what : ''}` })
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
  }
}

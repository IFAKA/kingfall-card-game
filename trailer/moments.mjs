// Lists the moments worth cutting to, from out/timeline.json: each step that had a fight, a tower hit or a free card, with its time.
// A step is logged when it lands; its strike (wind-up, contact, pop-up) plays just before that.
import fs from 'node:fs'
const { timeline } = JSON.parse(fs.readFileSync(new URL('./out/timeline.json', import.meta.url)))
const name = c => c ? `${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][c.rank]}${'♠♥♦♣'[c.suit]}` : '?'
for (const s of timeline.filter(e => e.type === 'step')) {
  const what = (s.events ?? []).flatMap(e =>
    e.type === 'fight' ? [`fight L${e.lane} ${name(e.mine.card)}(${e.mine.value}) vs ${name(e.theirs.card)}(${e.theirs.value}) → ${e.winner}${e.ace ? ' ACE' : ''}${e.double ? ' ×2' : ''}`]
    : e.type === 'tower' ? [`tower ${e.side}→${e.stack} ${e.result}${e.destroyed ? ' DOWN' : ''}`]
    : e.type === 'play' ? [`play ${e.side} L${e.lane}${e.free ? ' FREE (last stand)' : ''}`]
    : e.type === 'over' ? [`OVER winner ${e.winner}`] : [])
  if (what.length || s.stage === 'over') console.log(`${(s.t / 1000).toFixed(2).padStart(7)}s r${s.round} ${s.stage.padEnd(12)} ${what.join(' | ')}`)
}

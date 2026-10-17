// Anonymous play counts (Umami: no cookies, no names, no ads), so we can see whether strangers finish a game and come back.
// Off until UMAMI_ID is set, and only on the real site (and an itch.io embed): local tests never count.
// The tracker loads and reports through suitkeep.vercel.app (rewrites in vercel.json), so fewer ad blockers drop it.
// Open the site once with ?nostats and that browser stops counting (?stats turns it back on): for your own plays.
// Every event carries `visit`, a random id for this page load (never stored): Umami sees our proxy, not the player, so it splits
// one player's events across sessions; the visit id puts a game's events back together, and a reload starts a new one.
import { DEFAULT_RULES } from './engine'

const UMAMI_ID = '6ffc9650-8a7b-425d-a355-29114394dc9f'
const HOST = 'https://suitkeep.vercel.app/stats'
const counts = (host: string) => host === 'suitkeep.vercel.app' || host.endsWith('.itch.zone')

type Data = Record<string, string | number | boolean>
declare global { interface Window { umami?: { track: (name: string, data?: Data) => void } } }

const queue: [string, Data | undefined][] = [] // events from before the tracker has loaded
let on = false
const visit = Math.random().toString(36).slice(2, 10)
const rules = DEFAULT_RULES.runners ? 2 : 1 // which rules the events come from: 2 since small cards run (2026-10-17), missing before

export function startStats() {
  try {
    const q = new URLSearchParams(location.search)
    if (q.has('nostats')) localStorage.setItem('umami.disabled', '1')
    if (q.has('stats')) localStorage.removeItem('umami.disabled')
  } catch { /* storage blocked */ }
  if (!UMAMI_ID || !counts(location.hostname)) return
  on = true
  const s = document.createElement('script')
  s.defer = true
  s.src = `${HOST}/script.js`
  s.dataset.websiteId = UMAMI_ID
  s.dataset.hostUrl = HOST
  s.onload = () => { for (const [name, data] of queue.splice(0)) track(name, data) }
  document.head.append(s)
}

export function track(name: string, data?: Data) {
  if (!on) return
  data = { ...data, visit, rules }
  try {
    if (window.umami) window.umami.track(name, data)
    else queue.push([name, data])
  } catch { /* stats must never break the game */ }
}

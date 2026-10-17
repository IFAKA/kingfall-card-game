// finished games, newest first, each with its whole log as text: the menu's Past games page lists them to download one by one.
// Kept in this browser only, and only the last MAX, so storage stays small (a log is a few KB).
// runners: played with small cards running 2 slots (2026-10-17 on); missing on games played under the rules before
export interface PastGame { at: string; mode: 'guide' | 'play'; result: 'win' | 'loss' | 'draw'; rounds: number; runners?: boolean; text: string }

const HISTORY_KEY = 'suitkeep-history'
const MAX = 50

export function readHistory(): PastGame[] {
  try { const v = localStorage.getItem(HISTORY_KEY); return v ? (JSON.parse(v) as PastGame[]) : [] } catch { return [] }
}

export function addGame(p: PastGame): PastGame[] {
  const all = [p, ...readHistory()].slice(0, MAX)
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(all)) } catch { /* storage full or blocked: the list keeps it for this visit */ }
  return all
}

// a file name from a time: suitkeep-log-2026-10-16-18-05.txt
export const logName = (at: string | Date) => `suitkeep-log-${new Date(at).toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Rebuilds the printable rulebook, ../print/Suitkeep-Rulebook.pdf, from ../RULEBOOK.md: run `npm run rulebook` after every rules change.
// The markdown is laid out as an A4 page in headless Chrome: green headings over a gold rule, serif text, the cost table with a green header.
// Uses the installed Google Chrome; without it, run `npx playwright install chromium` once and it uses that instead.
import { readFileSync } from 'node:fs'
import { marked } from 'marked'
import { chromium } from 'playwright-core'

const root = new URL('../../', import.meta.url)
const src = new URL('RULEBOOK.md', root), out = new URL('print/Suitkeep-Rulebook.pdf', root)

const css = `
@page { size: A4; margin: 14mm 16mm; }
body { font: 10pt/1.42 Georgia, serif; color: #2b2b2b; margin: 0; }
h1, h2, h3, th { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #0f3d2e; }
h1 { font-size: 22pt; line-height: 1.15; margin: 0 0 8pt; }
h2 { font-size: 13pt; margin: 12pt 0 5pt; padding-bottom: 3pt; border-bottom: 2px solid #d08a0a; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 10pt 0 3pt; break-after: avoid; }
p { margin: 0 0 6pt; }
strong { color: #0f3d2e; }
ul, ol { margin: 0 0 6pt; padding-left: 20pt; } li { margin: 2pt 0; break-inside: avoid; } li > ul { margin-top: 3pt; }
table { border-collapse: collapse; margin: 4pt 0 8pt; font: 9.5pt -apple-system, "Helvetica Neue", Arial, sans-serif; }
th, td { border: 1px solid #999; padding: 2pt 6pt; text-align: center; }
th { background: #0f3d2e; color: #fff; } td:first-child { font-weight: 600; }`
const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${await marked.parse(readFileSync(src, 'utf8'))}</body>`

const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
const pdf = await page.pdf({ path: out.pathname, format: 'A4', preferCSSPageSize: true, printBackground: true })
await browser.close()
console.log(`print/Suitkeep-Rulebook.pdf: ${(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length} pages`)

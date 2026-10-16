import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactElement, ReactNode, Ref } from 'react'
import { BookOpen, Download as SaveIcon, Castle, ChevronRight, Download, Hand, Lightbulb, LogOut, Menu as MenuIcon, Music, ScrollText, Share, Shield, SquarePlus, Swords, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Switch } from '@/components/ui/switch'
import { useIsMobile } from '@/hooks/use-mobile'
import { useInstall } from './pwa'

// every drawer of the menu: up from the bottom on phones, in from the right on wide screens
type SheetProps = ComponentProps<typeof Drawer>
function Sheet(props: SheetProps) {
  const mobile = useIsMobile()
  return <Drawer swipeDirection={mobile ? 'down' : 'right'} showSwipeHandle={mobile} {...props} />
}

// a blue panel with a gold rim, like the game's other boxes.
// turn: the drawer just changed page, and the new page fades in
function Panel({ title, description, footer, children, turn, pageRef }: {
  title: ReactNode; description?: ReactNode; footer?: ReactNode; children?: ReactNode; turn?: { key: string }; pageRef?: Ref<HTMLDivElement>
}) {
  return (
    <DrawerContent
      className="border-(--gold-d) bg-linear-to-b from-[#24408c] to-[#172a5e] text-base [--drawer-bleed-background:#172a5e] data-[swipe-direction=down]:border-t-3 data-[swipe-direction=right]:border-l-3">
      <div key={turn?.key} ref={pageRef} tabIndex={-1} className={`flex min-h-0 flex-1 flex-col outline-none ${turn ? 'animate-in duration-300 fade-in' : ''}`}>
        <DrawerHeader>
          <DrawerTitle className="font-heading text-2xl font-normal tracking-wide text-primary [text-shadow:0_3px_0_rgb(0_0_0/45%)]">{title}</DrawerTitle>
          {description && <DrawerDescription className="text-base">{description}</DrawerDescription>}
        </DrawerHeader>
        {children && <div className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 *:shrink-0">{children}</div>}
        {footer && <DrawerFooter className="pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</DrawerFooter>}
      </div>
    </DrawerContent>
  )
}

const row = 'min-h-14 bg-black/25 text-left hover:bg-black/35'
const rowTitle = 'font-heading text-lg font-normal tracking-wide'

// a menu row that turns the menu to one of its pages; status: what's set inside it ("On"), shown before the arrow
function PageRow({ icon, title, description, status, onOpen }: { icon: ReactNode; title: string; description?: string; status?: string; onOpen: () => void }) {
  return (
    <Item variant="outline" className={row} render={<button onClick={onOpen} />}>
      <ItemMedia variant="icon" className="h-7 translate-y-px! text-primary [&_svg]:size-5!">{icon}</ItemMedia>
      <ItemContent><ItemTitle className={rowTitle}>{title}</ItemTitle>{description && <ItemDescription>{description}</ItemDescription>}</ItemContent>
      <ItemActions>{status && <span className="text-sm text-muted-foreground">{status}</span>}<ChevronRight className="size-5 opacity-60" /></ItemActions>
    </Item>
  )
}

// a few rows under a small heading: the menu's groups, the Hints page's parts
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 not-first:mt-2">
      <h3 className="m-0 font-heading text-sm font-normal tracking-widest text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

// a setting that is on or off: a switch on a card that is tappable as a whole, laid out like the menu rows
export function Choice({ id, icon, title, description, checked, onChange }: {
  id: string; icon?: ReactNode; title: string; description?: string; checked: boolean; onChange: (checked: boolean) => void
}) {
  return (
    <Item variant="outline" render={<label htmlFor={id} />}
      className={`${row} cursor-pointer has-data-checked:border-primary/20 has-data-checked:bg-primary/10 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50`}>
      {icon && <ItemMedia variant="icon" className="h-7 translate-y-px! text-primary [&_svg]:size-5!">{icon}</ItemMedia>}
      <ItemContent><ItemTitle className={rowTitle}>{title}</ItemTitle>{description && <ItemDescription className="line-clamp-none">{description}</ItemDescription>}</ItemContent>
      <ItemActions><Switch id={id} size="lg" checked={checked} onCheckedChange={onChange} /></ItemActions>
    </Item>
  )
}

// card names in a sentence ("A♦", "10♣") drawn as little cards, like the labels under the castles
export function CardText({ text }: { text: string }) {
  return text.split(/((?:10|[2-9AJQK])[♠♥♦♣])/).map((part, i) => i % 2
    ? <span key={i} className={`mx-px inline-block rounded-md bg-white px-1 font-heading leading-snug tracking-wide shadow-[0_2px_0_rgb(0_0_0/35%)] ${'♥♦'.includes(part.slice(-1)) ? 'text-red-600' : 'text-slate-900'}`}>{part}</span>
    : part)
}

// the log, newest round first; each line says what kind of thing happened and whose it was (blue you, red the enemy)
function LogView({ log }: { log: string[] }) {
  const rounds: { title: string; lines: string[] }[] = []
  for (const l of log) {
    if (l.startsWith('—')) rounds.push({ title: l.replace(/—/g, '').trim(), lines: [] })
    else (rounds.at(-1) ?? rounds[rounds.push({ title: '', lines: [] }) - 1]).lines.push(l)
  }
  const shown = rounds.filter(r => r.lines.length).reverse()
  if (!shown.length) return <p className="py-6 text-center text-muted-foreground">Nothing has happened yet. Plays, fights and tower hits show up here, newest round first.</p>
  const Icon = (l: string) => /\bplays? /.test(l) ? Hand : /last stand/.test(l) ? Shield : /breaks|cracks/.test(l) ? Castle : Swords
  const tint = (l: string) => /^Your?\b/.test(l) ? 'text-sky-300' : /^Enemy\b/.test(l) ? 'text-red-300' : 'text-muted-foreground'
  return shown.map((r, i) => (
    <section key={r.title + i} className="rounded-xl border bg-black/25 px-3 py-2">
      <h3 className="m-0 font-heading text-base font-normal tracking-wide text-primary">{r.title}{i === 0 && <span className="ml-2 text-xs text-muted-foreground uppercase">latest</span>}</h3>
      <ul className="m-0 list-none p-0">
        {r.lines.map((l, j) => { const I = Icon(l); return (
          <li key={j} className="flex items-start gap-2.5 border-t border-white/10 py-2 leading-snug first:border-t-0">
            <I className={`mt-0.5 size-4 shrink-0 ${tint(l)}`} /><span><CardText text={l} /></span>
          </li>
        ) })}
      </ul>
    </section>
  ))
}

const Rules = ({ rules }: { rules: ReactNode }) => <div className="leading-relaxed [&_li]:my-2 [&_ul]:list-disc [&_ul]:pl-5">{rules}</div>

// one rule of the game: its row in How to play says it in a line (all the rows together are the whole game), its page says the rest
export type Topic = { id: string; icon: ReactNode; title: string; line: string; body: ReactNode }
const HOW_TO_PLAY = 'The whole game, one rule per line. Tap a rule for the details.'
function TopicList({ topics, onOpen }: { topics: Topic[]; onOpen: (id: string) => void }) {
  return <ItemGroup className="gap-3">{topics.map(t => <PageRow key={t.id} icon={t.icon} title={t.title} description={t.line} onOpen={() => onOpen(t.id)} />)}</ItemGroup>
}

// How to play on its own, opened by any button (the title screen's, the table setup's): the rules' rows, each opening its page
export function HowToPlay({ topics, children }: { topics: Topic[]; children: ReactElement }) {
  const { open, page, go, panel, onOpenChange, reset } = usePages(() => null)
  const t = topics.find(t => t.id === page)
  return (
    <Sheet open={open} onOpenChange={onOpenChange} onOpenChangeComplete={o => { if (!o) reset() }}>
      <DrawerTrigger render={children} />
      {t ? <Panel title={t.title} {...panel} footer={<Button variant="secondary" size="xl" onClick={() => go(null)}>Back</Button>}><Rules rules={t.body} /></Panel>
        : <Panel title="How to play" description={HOW_TO_PLAY} {...panel} footer={<DrawerClose render={<Button variant="secondary" size="xl" />}>Close</DrawerClose>}><TopicList topics={topics} onOpen={go} /></Panel>}
    </Sheet>
  )
}

// one page of reading on its own, opened by any button: the deck screen's guide, who beats who
export function RulesSheet({ title = 'How to play', rules, children }: { title?: string; rules: ReactNode; children: ReactElement }) {
  return (
    <Sheet>
      <DrawerTrigger render={children} />
      <Panel title={title} footer={<DrawerClose render={<Button variant="secondary" size="xl" />}>Close</DrawerClose>}><Rules rules={rules} /></Panel>
    </Sheet>
  )
}

// installing the game as an app: one tap where the browser can do it, the Share-menu steps on iPhone and iPad
const iosSteps = (
  <ol className="m-0 flex list-none flex-col gap-3 p-0 text-base leading-snug">
    <li className="flex items-center gap-3"><Share className="size-6 shrink-0 text-primary" /><span>Tap <b>Share</b> in Safari's toolbar.</span></li>
    <li className="flex items-center gap-3"><SquarePlus className="size-6 shrink-0 text-primary" /><span>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
    <li className="flex items-center gap-3"><Castle className="size-6 shrink-0 text-primary" /><span>Open Kingfall from its icon: full screen, and it plays without a connection.</span></li>
  </ol>
)
// the title screen's quiet offer under the big buttons
export function InstallLink() {
  const { how, install } = useInstall()
  const link = (onClick?: () => void) => <Button variant="link" size="lg" className="self-center text-base text-muted-foreground" onClick={onClick}><Download /> Install the app</Button>
  if (how === 'prompt') return link(install)
  if (how === 'ios') return <RulesSheet title="Install the app" rules={iosSteps}>{link()}</RulesSheet>
  return null
}

// a drawer that turns pages: the new page fades in, and the drawer eases from the old page's height to the new one's.
// up: the page that Back, Escape or the phone's back gesture return to (null: the first page)
function usePages(up: (page: string) => string | null) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<string | null>(null)
  const [turn, setTurn] = useState<{ key: string; from?: number }>() // unset until the first page turn, so opening the drawer doesn't fade
  const pageRef = useRef<HTMLDivElement>(null)
  const sheet = () => pageRef.current?.closest<HTMLElement>('[data-slot=drawer-popup]')
  const go = (p: string | null) => { setPage(p); setTurn({ key: p ?? 'menu', from: sheet()?.offsetHeight }) }
  // the row that was tapped is gone after a turn: put focus on the new page
  useEffect(() => { if (turn) pageRef.current?.focus({ preventScroll: true }) }, [turn])
  // the sheet fits its page (height auto), which CSS can't animate: grow or shrink it from the old page's height to the new one's
  useLayoutEffect(() => {
    const el = sheet(), from = turn?.from
    if (!el || from === undefined) return
    el.style.transition = 'none' // measure the new page's height without a running transition in the way
    el.style.height = ''
    const to = el.offsetHeight
    el.style.height = `${from}px`
    void el.offsetHeight // apply the old height before setting the new one, so the change transitions
    el.style.transition = ''
    el.style.height = `${to}px`
    const t = setTimeout(() => { el.style.height = '' }, 500)
    return () => clearTimeout(t)
  }, [turn])
  const onOpenChange: SheetProps['onOpenChange'] = (o, d) => {
    if (!o && page && (d.reason === 'escape-key' || d.reason === 'close-watcher')) { d.cancel(); go(up(page)); return }
    setOpen(o)
  }
  const reset = () => { setPage(null); setTurn(undefined) } // once the drawer has slid away: it opens on its first page next time
  return { open, close: () => setOpen(false), page, go, panel: { turn, pageRef }, onOpenChange, reset }
}

// One menu for every screen, behind the ☰ button, in two groups: Game (the rules, and while playing the log and the hints) and
// Settings (music, sounds and the switches of this kind of game). Its pages open inside the same drawer: Back (or Escape, or the
// phone's back gesture) returns to the page above. Closing it is the big button; leaving the game is a quiet one, and asks first.
// settings: the switches that belong to this kind of game (on screen, fast enemy turns; with real cards, the fights in one list)
// hintsOn: whether a hint switch is on, shown on the Hints row; onTipsAgain: bring the first-game tips back (under the rules)
export function GameMenu({ topics = [], log, onExport, hints, hintsOn, settings, muted, toggleMute, musicOff, toggleMusic, onLeave, onTipsAgain }: {
  topics?: Topic[]; log?: string[]; onExport?: () => void; hints?: () => ReactNode; hintsOn?: boolean; settings?: ReactNode
  muted: boolean; toggleMute: () => void; musicOff: boolean; toggleMusic: () => void; onLeave?: () => void; onTipsAgain?: () => void
}) {
  const { open, close, page, go, panel, onOpenChange, reset } = usePages(p => p.startsWith('rule:') ? 'rules' : null)
  const [leaving, setLeaving] = useState(false) // leave only once the menu has slid away, so the screen doesn't change under it
  const back = <Button variant="secondary" size="xl" onClick={() => go(null)}>Back</Button>
  const tipsAgain = onTipsAgain && <Button variant="link" size="lg" className="self-center text-base text-muted-foreground" onClick={() => { onTipsAgain(); close() }}><Lightbulb /> Show the first-game tips again</Button>
  const pages: Record<string, { title: string; description?: string; body?: ReactNode; footer: ReactNode }> = {
    rules: { title: 'How to play', description: HOW_TO_PLAY, body: <><TopicList topics={topics} onOpen={id => go(`rule:${id}`)} />{tipsAgain}</>, footer: back },
    ...Object.fromEntries(topics.map(t => [`rule:${t.id}`, { title: t.title, body: <Rules rules={t.body} />, footer: <Button variant="secondary" size="xl" onClick={() => go('rules')}>Back</Button> }])),
    log: { title: 'What happened', body: <LogView log={log ?? []} />, footer: <>{onExport && <Button variant="success" size="xl" onClick={onExport}><SaveIcon /> Save log as a file</Button>}{back}</> },
    hints: { title: 'Hints', body: hints?.(), footer: back },
    leave: { title: 'Leave this game?', description: 'It will be discarded.', footer: <>
      <Button variant="success" size="xl" onClick={() => go(null)}>Keep playing</Button>
      <Button variant="destructive" size="xl" onClick={() => { setLeaving(true); close() }}>Leave game</Button>
    </> },
  }
  const shown = page && pages[page]
  const footer = <>
    <DrawerClose render={<Button variant="success" size="xl" />}>Keep playing</DrawerClose>
    {onLeave && <Button variant="outline" size="xl" onClick={() => go('leave')}><LogOut /> Leave game</Button>}
  </>
  return (
    <Sheet open={open} onOpenChange={onOpenChange}
      onOpenChangeComplete={o => {
        if (o) return
        reset()
        if (leaving) { setLeaving(false); onLeave?.() }
      }}>
      <DrawerTrigger render={<Button variant="secondary" size="icon-lg" aria-label="Menu" title="Menu" />}><MenuIcon /></DrawerTrigger>
      {shown ? <Panel title={shown.title} description={shown.description} footer={shown.footer} {...panel}>{shown.body}</Panel> : (
        <Panel title="Menu" {...panel} footer={footer}>
          {(topics.length > 0 || log || hints) && <Section title="Game">
            <ItemGroup className="gap-3">
              {topics.length > 0 && <PageRow icon={<BookOpen />} title="How to play" onOpen={() => go('rules')} />}
              {log && <PageRow icon={<ScrollText />} title="What happened" onOpen={() => go('log')} />}
              {hints && <PageRow icon={<Lightbulb />} title="Hints" status={hintsOn ? 'On' : 'Off'} onOpen={() => go('hints')} />}
            </ItemGroup>
          </Section>}
          <Section title="Settings">
            <div className="grid grid-cols-2 gap-3">
              <Choice id="music" icon={<Music />} title="Music" checked={!musicOff} onChange={toggleMusic} />
              <Choice id="sound" icon={muted ? <VolumeX /> : <Volume2 />} title="Sound" checked={!muted} onChange={toggleMute} />
            </div>
            {settings}
          </Section>
        </Panel>
      )}
    </Sheet>
  )
}

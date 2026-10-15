import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactElement, ReactNode, Ref } from 'react'
import { BookOpen, Download as SaveIcon, Castle, ChevronRight, Download, Hand, Lightbulb, LogOut, Menu as MenuIcon, ScrollText, Share, Shield, SquarePlus, Swords, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Switch } from '@/components/ui/switch'
import { useIsMobile } from '@/hooks/use-mobile'
import { useInstall } from './pwa'

// every drawer of the menu: up from the bottom on phones, in from the right on wide screens
function Sheet(props: ComponentProps<typeof Drawer>) {
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

// a menu row that turns the menu to one of its pages
function PageRow({ icon, title, description, onOpen }: { icon: ReactNode; title: string; description: string; onOpen: () => void }) {
  return (
    <Item variant="outline" className={row} render={<button onClick={onOpen} />}>
      <ItemMedia variant="icon" className="h-7 translate-y-px! text-primary [&_svg]:size-5!">{icon}</ItemMedia>
      <ItemContent><ItemTitle className={rowTitle}>{title}</ItemTitle><ItemDescription>{description}</ItemDescription></ItemContent>
      <ItemActions><ChevronRight className="size-5 opacity-60" /></ItemActions>
    </Item>
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

// one page of reading on its own, opened by any button: the title screen's "How to play", the deck screen's guide
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
function InstallRow({ onOpen }: { onOpen: () => void }) {
  const { how, install } = useInstall()
  if (how === 'prompt') return (
    <Item variant="outline" className={row} render={<button onClick={install} />}>
      <ItemMedia variant="icon" className="h-7 translate-y-px! text-primary [&_svg]:size-5!"><Download /></ItemMedia>
      <ItemContent><ItemTitle className={rowTitle}>Install the app</ItemTitle><ItemDescription>On your home screen, plays offline</ItemDescription></ItemContent>
    </Item>
  )
  if (how === 'ios') return <PageRow icon={<Download />} title="Install the app" description="On your home screen, plays offline" onOpen={onOpen} />
  return null
}
// the title screen's quiet offer under the big buttons
export function InstallLink() {
  const { how, install } = useInstall()
  const link = (onClick?: () => void) => <Button variant="link" size="lg" className="self-center text-base text-muted-foreground" onClick={onClick}><Download /> Install the app</Button>
  if (how === 'prompt') return link(install)
  if (how === 'ios') return <RulesSheet title="Install the app" rules={iosSteps}>{link()}</RulesSheet>
  return null
}

type PageId = 'rules' | 'log' | 'hints' | 'install' | 'leave'

// One menu for every screen, behind the ☰ button: rules, the log and hints while playing, sound, and leaving the game.
// Its pages open inside the same drawer: Back (or Escape, or the phone's back gesture) returns to the menu.
// settings: the switches that belong to this kind of game (on screen, fast enemy turns; with real cards, the fights in one list)
export function GameMenu({ rules, log, onExport, hints, settings, muted, toggleMute, onLeave }: {
  rules: ReactNode; log?: string[]; onExport?: () => void; hints?: (close: () => void) => ReactNode; settings?: ReactNode; muted: boolean; toggleMute: () => void; onLeave?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false) // leave only once the menu has slid away, so the screen doesn't change under it
  const [page, setPage] = useState<PageId | null>(null)
  const [turn, setTurn] = useState<{ key: string; from?: number }>() // unset until the first page turn, so opening the menu doesn't fade
  const pageRef = useRef<HTMLDivElement>(null)
  const sheet = () => pageRef.current?.closest<HTMLElement>('[data-slot=drawer-popup]')
  const close = () => setOpen(false)
  const go = (p: PageId | null) => { setPage(p); setTurn({ key: p ?? 'menu', from: sheet()?.offsetHeight }) }
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
  const back = <Button variant="secondary" size="xl" onClick={() => go(null)}>Back</Button>
  const pages: Record<PageId, { title: string; description?: string; body?: ReactNode; footer: ReactNode }> = {
    rules: { title: 'How to play', body: <Rules rules={rules} />, footer: back },
    log: { title: 'What happened', body: <LogView log={log ?? []} />, footer: <>{onExport && <Button variant="success" size="xl" onClick={onExport}><SaveIcon /> Save log as a file</Button>}{back}</> },
    hints: { title: 'Hints', body: hints?.(close), footer: back },
    install: { title: 'Install the app', body: iosSteps, footer: back },
    leave: { title: 'Leave this game?', description: 'The game will be discarded and you go back to the title screen.', footer: <>
      <Button variant="success" size="xl" onClick={() => go(null)}>Keep playing</Button>
      <Button variant="destructive" size="xl" onClick={() => { setLeaving(true); close() }}>Leave game</Button>
    </> },
  }
  const shown = page && pages[page]
  return (
    <Sheet open={open}
      onOpenChange={(o, d) => {
        if (!o && page && (d.reason === 'escape-key' || d.reason === 'close-watcher')) { d.cancel(); go(null); return }
        setOpen(o)
      }}
      onOpenChangeComplete={o => {
        if (o) return
        setPage(null)
        setTurn(undefined)
        if (leaving) { setLeaving(false); onLeave?.() }
      }}>
      <DrawerTrigger render={<Button variant="secondary" size="icon-lg" aria-label="Menu" title="Menu" />}><MenuIcon /></DrawerTrigger>
      {shown ? <Panel title={shown.title} description={shown.description} footer={shown.footer} turn={turn} pageRef={pageRef}>{shown.body}</Panel> : (
        <Panel title="Menu" turn={turn} pageRef={pageRef} footer={onLeave && <Button variant="destructive" size="xl" onClick={() => go('leave')}><LogOut /> Leave game</Button>}>
          <ItemGroup className="gap-3">
            <PageRow icon={<BookOpen />} title="How to play" description="The rules in 60 seconds" onOpen={() => go('rules')} />
            {log && <PageRow icon={<ScrollText />} title="What happened" description="Every play and fight so far" onOpen={() => go('log')} />}
            {hints && <PageRow icon={<Lightbulb />} title="Hints" description="Explain options, suggest moves, tips" onOpen={() => go('hints')} />}
          </ItemGroup>
          <InstallRow onOpen={() => go('install')} />
          {settings}
          <Choice id="sound" icon={muted ? <VolumeX /> : <Volume2 />} title="Sound" description="Plays, fights and falling towers" checked={!muted} onChange={toggleMute} />
        </Panel>
      )}
    </Sheet>
  )
}

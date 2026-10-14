import { createContext, useContext, useState } from 'react'
import type { ComponentProps, CSSProperties, ReactElement, ReactNode } from 'react'
import { BookOpen, Castle, ChevronRight, Hand, Lightbulb, LogOut, Menu as MenuIcon, ScrollText, Shield, Swords, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Switch } from '@/components/ui/switch'
import { useIsMobile } from '@/hooks/use-mobile'

// the style that turns the table a quarter turn (upright phone, real cards): the menu turns with it
const Turned = createContext<CSSProperties | undefined>(undefined)

// every drawer of the menu: up from the bottom on phones, in from the right on wide screens and on a turned table
function Sheet(props: ComponentProps<typeof Drawer>) {
  const turned = useContext(Turned), mobile = useIsMobile()
  return <Drawer swipeDirection={mobile || turned ? 'down' : 'right'} showSwipeHandle={mobile && !turned} {...props} />
}

// a blue panel with a gold rim, like the game's other boxes
function Panel({ title, description, footer, children }: { title: ReactNode; description?: ReactNode; footer?: ReactNode; children?: ReactNode }) {
  const turned = useContext(Turned)
  return (
    <DrawerContent viewport={turned && { className: 'turned', style: turned }}
      className="border-(--gold-d) bg-linear-to-b from-[#24408c] to-[#172a5e] text-base [--drawer-bleed-background:#172a5e] data-[swipe-direction=down]:border-t-3 data-[swipe-direction=right]:border-l-3">
      <DrawerHeader>
        <DrawerTitle className="font-heading text-2xl font-normal tracking-wide text-primary [text-shadow:0_3px_0_rgb(0_0_0/45%)]">{title}</DrawerTitle>
        {description && <DrawerDescription className="text-base">{description}</DrawerDescription>}
      </DrawerHeader>
      {children && <div className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 *:shrink-0">{children}</div>}
      {footer && <DrawerFooter className="pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</DrawerFooter>}
    </DrawerContent>
  )
}

const back = <DrawerClose render={<Button variant="secondary" size="xl" />}>Back</DrawerClose>
const row = 'min-h-14 bg-black/25 text-left hover:bg-black/35'
const rowTitle = 'font-heading text-lg font-normal tracking-wide'

// a menu row that opens its page over the menu (a nested drawer); Back closes the page again
function PageRow({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <Sheet>
      <DrawerTrigger render={<Item variant="outline" className={row} render={<button />} />}>
        <ItemMedia variant="icon" className="h-7 translate-y-px! text-primary [&_svg]:size-5!">{icon}</ItemMedia>
        <ItemContent><ItemTitle className={rowTitle}>{title}</ItemTitle><ItemDescription>{description}</ItemDescription></ItemContent>
        <ItemActions><ChevronRight className="size-5 opacity-60" /></ItemActions>
      </DrawerTrigger>
      <Panel title={title} footer={back}>{children}</Panel>
    </Sheet>
  )
}

// a setting that is on or off: a switch on a card that is tappable as a whole
export function Choice({ id, icon, title, description, checked, onChange }: {
  id: string; icon?: ReactNode; title: string; description?: string; checked: boolean; onChange: (checked: boolean) => void
}) {
  return (
    <FieldLabel htmlFor={id} className={`${row} rounded-lg border`}>
      <Field orientation="horizontal" className="items-center! p-3">
        {icon && <span className="text-primary [&_svg]:size-5">{icon}</span>}
        <FieldContent><FieldTitle className={rowTitle}>{title}</FieldTitle>{description && <FieldDescription>{description}</FieldDescription>}</FieldContent>
        <Switch id={id} size="lg" checked={checked} onCheckedChange={onChange} />
      </Field>
    </FieldLabel>
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

// the title screen's "How to play": the rules page on its own
export function RulesSheet({ rules, children }: { rules: ReactNode; children: ReactElement }) {
  return (
    <Sheet>
      <DrawerTrigger render={children} />
      <Panel title="How to play" footer={<DrawerClose render={<Button variant="secondary" size="xl" />}>Close</DrawerClose>}><Rules rules={rules} /></Panel>
    </Sheet>
  )
}

// One menu for every screen, behind the ☰ button: rules, the log and hints while playing, sound, and leaving the game.
export function GameMenu({ turned, rules, log, hints, muted, toggleMute, onLeave }: {
  turned?: CSSProperties; rules: ReactNode; log?: string[]; hints?: (close: () => void) => ReactNode; muted: boolean; toggleMute: () => void; onLeave?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false) // leave only once the menu has slid away, so the screen doesn't change under it
  const close = () => setOpen(false)
  return (
    <Turned.Provider value={turned}>
      <Sheet open={open} onOpenChange={setOpen} onOpenChangeComplete={o => { if (!o && leaving) { setLeaving(false); onLeave?.() } }}>
        <DrawerTrigger render={<Button variant="secondary" size="icon-lg" aria-label="Menu" title="Menu" />}><MenuIcon /></DrawerTrigger>
        <Panel title="Menu" footer={onLeave && (
          <Sheet>
            <DrawerTrigger render={<Button variant="destructive" size="xl" />}><LogOut /> Leave game</DrawerTrigger>
            <Panel title="Leave this game?" description="The game will be discarded and you go back to the title screen." footer={<>
              <DrawerClose render={<Button variant="success" size="xl" />}>Keep playing</DrawerClose>
              <Button variant="destructive" size="xl" onClick={() => { setLeaving(true); close() }}>Leave game</Button>
            </>} />
          </Sheet>
        )}>
          <ItemGroup className="gap-3">
            <PageRow icon={<BookOpen />} title="How to play" description="The rules in 60 seconds"><Rules rules={rules} /></PageRow>
            {log && <PageRow icon={<ScrollText />} title="What happened" description="Every play and fight so far">
              <LogView log={log} />
            </PageRow>}
            {hints && <PageRow icon={<Lightbulb />} title="Hints" description="Explain options, suggest moves, tips">{hints(close)}</PageRow>}
          </ItemGroup>
          <Choice id="sound" icon={muted ? <VolumeX /> : <Volume2 />} title="Sound" checked={!muted} onChange={toggleMute} />
        </Panel>
      </Sheet>
    </Turned.Provider>
  )
}

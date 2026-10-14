import { useEffect, useState } from 'react'

// Installing the game as an app: the service worker (written by the build, see vite.config.ts) keeps it playable offline,
// and the browser's install offer is held back so the menu can make it at the right moment.

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let offer: InstallEvent | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach(f => f())

export const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
// iPhone and iPad Safari never offer an install: the player adds it from the Share menu
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function registerPwa() {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); offer = e as InstallEvent; changed() })
  addEventListener('appinstalled', () => { offer = null; changed() })
  if (import.meta.env.PROD && 'serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* offline play just isn't available */ }) })
}

// 'prompt': the browser can install it now; 'ios': tell the player how; null: installed already, or not possible here
export function useInstall() {
  const [, render] = useState(0)
  useEffect(() => { const f = () => render(n => n + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  const how: 'prompt' | 'ios' | null = standalone() ? null : offer ? 'prompt' : isIOS() ? 'ios' : null
  const install = async () => {
    if (!offer) return
    await offer.prompt()
    await offer.userChoice
    offer = null; changed()
  }
  return { how, install }
}

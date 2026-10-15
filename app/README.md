# Kingfall: web app

The web app for [Kingfall](../README.md), a one-player lane battle card game. Live at **https://kingfall-card-game.vercel.app**.

It has two modes:

- **On screen:** the app deals, runs the enemy and animates every fight in an upright arena. The first game skips deck building (the app picks a good deck), turns suggestions on, and teaches one rule at a time, starting with the goal.
- **With real cards:** you play with a real 52-card deck. The app runs the enemy automaton and draws your table as you sit at it, every card where it lies and all the same size (your elixir bar as 10 cards with a sideways marker, piles, tower fans, discards), and a panel over the hand tells you, step by step, what to move.

It saves the game in the browser. With real cards it has undo and redo; on screen your turn stays open until you tap Done, so you can take a card back or switch two. On screen, a tap on the field skips ahead while the enemy plays; with real cards, the menu can put a round's fights in one checklist.

## Commands

```sh
npm install        # once
npm run dev        # local development server
npm test           # rules checks: plays hundreds of full games through the app's engine (Node 22+)
npm run check      # lint + build + tests: run this before every release
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

## Releasing

`npm run build` produces a static site in `dist/` with relative paths, so it runs from any folder or static host:

- **itch.io (HTML game):** zip the *contents* of `dist/` (not the folder itself) and upload it as an HTML project.
- **Vercel (the live site):** the Vercel project `kingfall` builds from this `app/` folder; every push to `main` deploys to production.
- **Netlify / Cloudflare Pages / GitHub Pages:** publish the `dist/` folder; there is no server code.

It is also an installable app (PWA): `public/manifest.webmanifest` and the icons in `public/` describe it, and the build writes `dist/sw.js`, a service worker that saves every file the game needs so it plays offline after one visit (see `vite.config.ts`; it registers only in production builds). Each build gets a new cache name, so a deploy replaces the old copy.

It is also an installable app (PWA): `public/manifest.webmanifest` and the icons in `public/` describe it, and the build writes `dist/sw.js`, a service worker that saves every file of the game on the first visit so it then starts and plays offline. Each release gets a new cache, so players get the new version on their next visit. `npm run dev` doesn't register it; try it with `npm run build && npm run preview`.

The SEO tags (title, description, preview image, structured data) are in `index.html`; `public/robots.txt`, `public/sitemap.xml` and `public/og.png` go with them. Update the URLs there if the site moves to another domain.

When the rules change in a way that makes old saved games invalid, bump `STORAGE_KEY` in `src/App.tsx`.

## Code map

- `src/engine.ts`: cards, costs, deal and a compact rules engine (used by the quick balance checks).
- `src/guide.ts`: the guided rules engine the app runs: every step of a round, the instructions shown for the physical cards, the events each step reports for the screen to animate (`GameEvent`, with `describe` putting each one into words), and the suggestion lookahead.
- `src/App.tsx`: title, setup screens, the arena both modes play in (with the real-cards table panel and card picker) and the first-game tips; `src/ErrorBoundary.tsx` recovers from an unreadable saved game.
- `src/fx.ts`: turns each step's events into pop-ups, board shake and sounds, placed on board elements marked `data-anchor`; `src/sfx.ts` synthesizes the sounds with Web Audio (no audio files) and keeps the mute setting.
- `scripts/check.ts`: the automated rules and balance checks behind `npm test`.

The rules themselves live in `../RULEBOOK.md`; keep the rulebook, `guide.ts` and `engine.ts` in sync.

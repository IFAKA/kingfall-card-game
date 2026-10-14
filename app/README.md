# Kingfall — table guide (web app)

Companion app for Kingfall. You play with a real 52-card deck; the app runs the enemy automaton and tells you, step by step, what to move on the table. It works on phones (upright board) and desktops (wide board), saves the game in the browser, and has undo.

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
- **Netlify / Vercel / Cloudflare Pages / GitHub Pages:** publish the `dist/` folder; there is no server code.

When the rules change in a way that makes old saved games invalid, bump `STORAGE_KEY` in `src/App.tsx`.

## Code map

- `src/engine.ts`: cards, costs, deal and a compact rules engine (used by the quick balance checks).
- `src/guide.ts`: the guided rules engine the app runs: every step of a round, the instructions shown for the physical cards, and the suggestion lookahead.
- `src/App.tsx`: setup screens and the play screen; `src/ErrorBoundary.tsx` recovers from an unreadable saved game.
- `scripts/check.ts`: the automated rules and balance checks behind `npm test`.

The rules themselves live in `../RULEBOOK.md`; keep the rulebook, `guide.ts` and `engine.ts` in sync.

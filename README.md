# Kingfall: a solo card game with a standard 52-card deck

**Kingfall is a free one-player lane battle card game.** Spend elixir, send your cards down two lanes, clash with the enemy's cards in the middle, crack its towers and take down its king. It's inspired by real-time lane games like Clash Royale, but it's turn-based and needs nothing but a deck of playing cards.

### ▶ [Play Kingfall in your browser](https://kingfall-card-game.vercel.app)

Free, no sign-up, works on phones and desktops.

<p align="center">
  <img src="docs/screenshots/arena.png" alt="Kingfall on a phone: red enemy castles at the top, blue castles at the bottom, two lanes with a river, a ×2 suit bonus pop-up and the hand of cards below" width="300" />
  &nbsp;
  <img src="docs/screenshots/title.png" alt="Kingfall title screen with a gold crown logo and the Play, Play with real cards and How to play buttons" width="520" />
</p>

## Two ways to play

- **On screen.** The app deals, runs the enemy and animates every fight. Your first game teaches you as you play, one tip at a time.
- **With real cards.** Shuffle a real 52-card deck and play at the table. The app is your companion: it runs the enemy automaton and tells you exactly what to move at each step. The [rulebook](RULEBOOK.md) is complete without the app, so it also works as a print-and-play solitaire game.

## How to play in one minute

- **Goal:** destroy the enemy's king tower (a stack of 2 cards) before it destroys yours.
- **Cards are soldiers.** Higher rank wins a fight (A=1 … K=13).
- **Suit wheel:** a card of the suit that beats the other counts **double** in a fight: ♠ beats ♥, ♥ beats ♦, ♦ beats ♣, ♣ beats ♠.
- **Aces beat picture cards** (J, Q, K) in a fight, whatever the suits.
- **Elixir** pays for cards. A card costs about its rank (A=1, 5=4, K=10), and you get 3 more each round, up to 10.
- **Each round:** you play cards into a lane, the enemy defends the lane where you pushed harder, everything moves, and the front cards fight. Cards that get through hit a tower.
- **Towers:** a soldier breaks the top tower card if its rank is at least that card's. If not, the tower card cracks, and any later hit breaks it.

Full rules: [RULEBOOK.md](RULEBOOK.md) · Printable rulebook (2 pages, A4): [print/Kingfall-Rulebook.pdf](print/Kingfall-Rulebook.pdf)

## Features

- **Game feel:** "×2!", "ACE!", "CRACK" and "TOWER DOWN!" pop-ups, board shake and sound effects. Every fight also says in plain words why it was won.
- **Arena view** on screen: castles with armor pips, two lanes with a river, an elixir bar and your hand with the next card.
- **Deck building:** pick 8 of your 16 cards with an average-cost meter. A good deck is picked for you, so you can start in one tap.
- **Real-cards setup in pictures:** one step per screen, from shuffling to laying out the table.
- **Undo and redo**, game saved in the browser, an optional suggested move, and a log of everything that happened.
- **Balanced by simulation:** thousands of simulated games tuned the rules. Random play wins about 4%, a careful player about 85–90%.

<p align="center">
  <img src="docs/screenshots/deck.png" alt="Kingfall deck building screen: 8 deck slots with an average elixir cost meter, and the other cards below" width="420" />
  &nbsp;
  <img src="docs/screenshots/real-cards-setup.png" alt="Kingfall real-cards setup step: two rows of face-down cards as elixir bars with the 5th card turned sideways as the marker" width="420" />
</p>

## Run it locally

You need Node.js 22 or newer.

```sh
cd app
npm install
npm run dev      # local server at http://localhost:5173
npm run check    # lint + build + rules tests (plays hundreds of full games)
```

`npm run build` writes a static site to `app/dist/` that runs from any host (Vercel, Netlify, GitHub Pages, itch.io). More in [app/README.md](app/README.md).

## What's in this repository

| Path | What it is |
|---|---|
| [`RULEBOOK.md`](RULEBOOK.md) | The complete rules: the game itself |
| [`app/`](app) | The web app (React, TypeScript, Vite): on-screen play and the real-cards companion |
| [`print/`](print) | The printable rulebook PDF, generated with `python3 tools/rulebook_pdf.py` (needs Google Chrome) |
| [`PLAYTEST.md`](PLAYTEST.md) | Playtest sheet and log template for testing the rules with real players |
| [`sim/`](sim) | Python balance simulator: bots, deck curves and rule variants used to tune the game (`sim_v1_backup/` is an older copy) |

## Feedback

Found a rule that confuses you, or a bug? [Open an issue](https://github.com/IFAKA/kingfall-card-game/issues). Playtest reports are very welcome.

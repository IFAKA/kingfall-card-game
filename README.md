# Suitkeep: a solo card game with a standard 52-card deck

**Suitkeep is a free one-player lane battle card game.** Play your black cards against the enemy's red ones, send them down two lanes, clash with the enemy's cards in the middle, crack its towers and take down its king. It's inspired by real-time lane games like Clash Royale, but it's turn-based and needs nothing but a deck of playing cards: 22 of them are in play.

### ▶ [Play Suitkeep in your browser](https://suitkeep.vercel.app)

Free, no sign-up, works on phones and desktops.

<p align="center">
  <img src="docs/screenshots/arena.png?v=4" alt="Suitkeep on screen in round 4: red enemy castles at the top, the left one cracked with its 4♥ showing, your black cards in both lanes of 3 slots, the enemy's face-up next card K♦ between the lanes, your blue castles with their tower cards, and below them your next card on the left, your hand of 3 big cards, and the Done button with the turn bar under it" width="300" />
  &nbsp;
  <img src="docs/screenshots/title.png?v=4" alt="Suitkeep title screen with a gold crown logo and the tagline "A solo card battle, one deck" and the Play, Play with real cards and How to play buttons" width="520" />
</p>

## Two ways to play

- **On screen.** The app deals, runs the enemy and animates every fight. Your first game teaches you as you play: the app builds your deck, suggests moves, and explains one rule at a time, starting with the goal.
- **With real cards.** Take a real 52-card deck, deal 11 black cards to yourself and 11 red to the enemy, and play at the table. The app is your companion: it runs the enemy automaton and tells you exactly what to move at each step. Your first game at the table also says why at every step. The [rulebook](RULEBOOK.md) is complete without the app, so it also works as a print-and-play solitaire game.

## How to play in one minute

- **Goal:** destroy the enemy's king tower before it destroys yours. Each side has three towers of 1 card.
- **Cards are soldiers.** Higher rank wins a fight (A=1 … K=13); equal, and the enemy wins.
- **Suit wheel:** a card of the suit that beats the other counts **double** in a fight: ♠ beats ♥, ♥ beats ♦, ♦ beats ♣, ♣ beats ♠.
- **Aces beat Kings** in a fight, whatever the suits.
- **Your turn:** play 1 card, or 2 small cards (A to 5), from a hand of 3. Nothing to count, nothing carries over. Small cards run: they move 2 slots a round, straight at a tower.
- **The enemy** plays 2 cards a round, the top of its pile: the first defends the lane where you pushed harder, the second goes into the other lane. Its top card is always face-up, so you know its next play.
- **Each round:** you play, the enemy plays, the front cards fight (when one falls, the card behind it steps up and fights next), then every card that hasn't moved steps forward through the 3 slots of its lane. Cards that get through hit a tower.
- **Towers are armored:** every tower card takes two hits, the first cracks it, the next breaks it. A hit is a fight against the tower card (the wheel and aces count): win and your card stays, wounded, for that next hit; lose or tie and it goes home.

Full rules: [RULEBOOK.md](RULEBOOK.md) · Printable rulebook (3 pages, A4): [print/Suitkeep-Rulebook.pdf](print/Suitkeep-Rulebook.pdf)

## Features

- **Game feel:** "×2!", "ACE!", "CRACK" and "TOWER DOWN!" pop-ups, board shake and sound effects. Every fight also says in plain words why it was won.
- **Music:** a slow theme on the title and a lighter loop during a game, on the trailer's chords and lute; war drums and brass join once a king stands open. Music and sounds each have a switch in the menu.
- **Arena view** on screen: castles that show their state (whole, cracked after the first hit, rubble once fallen) with the tower card beneath, two lanes of 3 slots across a river with each side's Next card between them, and a slim two-half bar under the ✓ button, right of your hand (what is left of your turn). The dots on a gold pill (one dot for a small card, two for any other) show how much of your turn a card uses, only where you need it: your hand and your next card. Cards already in the lanes stay clean. The cards about to fight tremble first, and a card attacking a tower waits in the slot next to it.
- **Deck building:** your 11 cards arrive split at random into a deck of 8 and three towers of 1; building a good deck is up to you. Tap two cards to swap them and watch the big/small meter. **Suggest** sets a good split and says why. One deal per game, as at the table: a deal you leave unplayed is still yours next time.
- **Installable app:** add it to your home screen (Install the app on the title screen, or Share → Add to Home Screen on iPhone). After one visit it plays offline.
- **Real-cards setup in pictures:** one step per screen, from shuffling to laying out the table.
- **Change your mind until you tap Done:** drag a card you placed back to your hand or onto the other lane, or tap two cards to switch them. With real cards, undo and redo fix entry mistakes.
- **Your pace:** on screen, tap the field to skip ahead while the enemy plays, or turn on fast enemy turns. With real cards, a round's fights, moves and tower hits can come as one checklist with one Done (on by default after two games at the table).
- **Learn from each game:** the end of a game names the one thing that cost you most (an open lane, an enemy ace, the suit wheel, a wasted turn), and keeps your record: wins, games and fastest win.
- Game saved in the browser, an optional suggested move, and a log of everything that happened.
- **Anonymous play counts** (Umami: no cookies, no names), so we can see whether players finish a game and come back. Open the site with `?nostats` to stop counting in your browser.
- **Balanced by simulation and real games:** thousands of simulated games, checked against a first-time player's playtests, tuned the rules. Games last about 6 rounds. A first-time player who thinks wins a bit more than half, a careless one about 4 in 10, and decks with 4 to 6 big cards win about as often: skill is in the playing. One deal per game, as at the table.

<p align="center">
  <img src="docs/screenshots/deck.png?v=4" alt="Suitkeep deck building screen: the 8 deck cards on top, each with a one- or two-dot turn badge, the three towers of one card each under blue castles, and the big/small meter with Start the game at the bottom" width="420" />
  &nbsp;
  <img src="docs/screenshots/real-cards-setup.png?v=4" alt="Suitkeep real-cards setup, first step: split the deck by colour, black cards for you and red cards for the enemy" width="420" />
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
| [`sim/`](sim) | Python balance simulator of the earlier rules (elixir, towers of 2 cards), kept for reference (`sim_v1_backup/` is an older copy). The current rules are tuned with `app/scripts/` (`sim.ts`, `balance.ts`) |

## Feedback

Found a rule that confuses you, or a bug? [Open an issue](https://github.com/IFAKA/suitkeep/issues). Playtest reports are very welcome.

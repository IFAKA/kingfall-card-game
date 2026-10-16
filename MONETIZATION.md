# From zero to money: the step-by-step path

_Written 2026-10-16 for this game as it is today. Update it when a step is done or the facts change._

## Where you are today

- The game works and is live at suitkeep.vercel.app (on screen + with real cards).
- The printable rulebook exists (`print/Suitkeep-Rulebook.pdf`).
- The trailer is finished: `trailer/out/suitkeep-trailer-tall.mp4` (vertical) and `trailer/out/suitkeep-trailer-wide.mp4` (wide), 33 seconds each.
- **Nobody else has played it yet**, and you don't know anyone to test with.
- **The stats are built into the game but switched off** until you make the free Umami account (step 5).
- **The posts, the itch.io page text, its cover and the upload file are ready** (see [Ready-to-post texts](#ready-to-post-texts) at the end). Nothing has been posted.
- **The game is called Suitkeep** (renamed 2026-10-16, because a card game called "Kingfall" was announced on Steam on 2026-10-01 by an established studio). The repo is github.com/IFAKA/suitkeep, and the old kingfall-card-game.vercel.app link forwards to suitkeep.vercel.app.

## How to use this file

- Do the steps **in order**. Each step needs what the step before it made.
- Every step says what it **needs**, what to **do**, and when it's **done**.
- 🚦 steps are checkpoints: the numbers decide whether you go forward or go back and fix something.
- **You** = things only you can do (accounts, payments, posting, photos). **Claude** = things Claude does.
- Tick the box when a step is done.

**➡️ Next step: 5.8** (play one game, check Umami Events), then 5.9. Steps 1, 2, 4 and 6 are done; step 3 is optional for now.

### While you wait (do these now, they make later steps work)

- [ ] **Reddit account.** If you don't have one, make it now and use it normally for 1–2 weeks: comment on other people's games in r/WebGames, r/playmygame, r/cardgames and r/soloboardgaming. Reddit often hides posts from new accounts that have never commented.
- [ ] **Read each subreddit's rules** (the "About" or "Rules" tab on the right, or under the name on the phone). Claude can't open Reddit's pages; the rule notes below come from a rules index read in October 2026.
- [ ] **Watch both trailers** (`trailer/out/`) and tell Claude if anything should change.
- [ ] **Take the table photo** for step 9 (see [Photo for the tabletop posts](#photo-for-the-tabletop-posts)).

---

## Phase 1: A name you can keep

You can't post, print or build a brand on a name another card game uses.

- [x] **1. Get a shortlist of names.** _Claude._
  Needs: nothing. Do: suggest 10 names and check each one on Steam, itch.io, BoardGameGeek, the app stores, the US trademark search and web search.
  Done when: you have 3 names that nobody else uses for a game.
  ✅ Done 2026-10-16: Suitkeep and Suitguard were clear everywhere; Crownsplit and Pipcastle mostly clear.

- [x] **2. Pick the name.** _You._
  Needs: the shortlist from step 1.
  Done when: one name is chosen.
  ✅ Done 2026-10-16: **Suitkeep**.

- [ ] **3. Buy the website address.** _You buy it, Claude guides._ ⏸️ **Optional for now.**
  Needs: the name from step 2. Do: buy suitkeep.com (it was free on 2026-10-16) for about $10–15 a year and connect it to Vercel.
  Done when: the game opens at the new address.
  For now the game lives at **suitkeep.vercel.app**, which is free and enough for Phases 2–3. If you buy the .com later, suitkeep.vercel.app will forward to it, so links you post now keep working. Do it before step 18 at the latest.

- [x] **4. Rename everything.** _Claude._
  Needs: the name + address from steps 2–3. Do: change the game, the rulebook + PDF, the README and the screenshots, and keep the old vercel.app link working.
  Done when: the old name appears nowhere and the new PDF is built.
  ✅ Done 2026-10-16: game, rulebook + PDF, READMEs, screenshots, share image, GitHub repo (IFAKA/suitkeep) and Vercel project (suitkeep.vercel.app; the old link forwards).

## Phase 2: See what players do

Without stats, posting the game teaches you nothing.

- [ ] **5. Add anonymous stats.** _Claude builds it, you make the account._
  Needs: the renamed game from step 4. Uses **Umami**: free, no cookies (so no cookie pop-up), no names, no ads. Vercel's free stats only count page visits, not games, so they aren't used.
  - [x] **5.1 You:** sign up at **cloud.umami.is** with your email and pick the free plan. If it asks for a card, stop and tell Claude.
  - [x] **5.2 You:** click **Add website**. Name: `Suitkeep`. Domain: `suitkeep.vercel.app`.
  - [x] **5.3 You:** open that website's settings, copy the **Website ID** (looks like `a1b2c3d4-…`) and paste it to Claude.
  - [x] **5.4 Claude:** the stats code (`app/src/stats.ts`). It only counts on suitkeep.vercel.app and the itch.io version, never on test copies. ✅ 2026-10-16
  - [x] **5.5 Claude:** the stats load through suitkeep.vercel.app (`app/vercel.json`), so fewer ad blockers hide players. ✅ 2026-10-16
  - [x] **5.6 Claude:** what it counts: page visits, `cards-open` (real-cards mode opened), `game-start` (mode, which game number), `first-game`, `second-game`, `round` (every round a game reaches), `game-end` (win/loss/draw and rounds), `game-leave` (left from the menu, which round), `setup-leave` (left during setup, which step). ✅ 2026-10-16, tested offline.
  - [x] **5.7 Claude:** ID set in `app/src/stats.ts`, checked, pushed, itch.io file rebuilt. ✅ 2026-10-16
  - [ ] **5.8 You:** play one whole game on suitkeep.vercel.app, then open Umami → your website → **Events**. Your game should be there.
  - [ ] **5.9 You:** so your own games stop counting, open **suitkeep.vercel.app/?nostats** once on each phone and computer you play on (open **suitkeep.vercel.app/?stats** to count again).
  Done when: 5.8 shows your game. How to read it at Checkpoint A: **finish rate** = people with `game-end` ÷ people with `game-start`. **Come-back rate** = `second-game` ÷ `first-game`. **Where people stop** = the `n` values of the `round` event.

- [x] **6. Finish the trailer with the new name.** _Claude._
  Needs: the renamed game (step 4). Do: run the trailer's rebuild command.
  Done when: you have watched both videos and like them.
  ✅ Done 2026-10-16: `trailer/out/suitkeep-trailer-tall.mp4` and `suitkeep-trailer-wide.mp4`, 33 seconds each. After the game changes a lot, rebuild them with `cd trailer && npm run rebuild` (about an hour). If only the name or address changes, edit `trailer/trailer.config.json` and run `npm run master` (about 2 minutes).

## Phase 3: First strangers (no money yet, this is the practice round)

This round finds the problems for free. CrazyGames (Phase 4) only gives you one real chance, so fix things here first.

- [ ] **7. itch.io page.** _You make the account, Claude writes the page._
  Needs: the trailer (6), the PDF (4) and the stats (5). Do: the web game playable on the page plus the rulebook PDF as "pay what you want."
  ✍️ **Ready:** the page text is in [itch.io page](#itchio-page), the cover is `docs/itch-cover.png`, the screenshots are in `docs/screenshots/`, and `cd app && npm run itch` makes the upload file `app/suitkeep-itch.zip` (Claude rebuilds it in 5.7 so the itch version counts too).
  How:
  1. Sign up at **itch.io** (free). Top-right menu → **Upload new project**.
  2. **Title** `Suitkeep`, **Project URL** `suitkeep`, **Short description** and **Description** from [itch.io page](#itchio-page). **Kind of project:** HTML.
  3. **Pricing:** "$0 or donate", suggested donation $2.
  4. **Uploads:** `app/suitkeep-itch.zip` and tick **"This file will be played in the browser"**. Then `print/Suitkeep-Rulebook.pdf` as a download.
  5. **Embed options:** viewport 480 × 860, tick **Mobile friendly** (orientation: portrait) and **Fullscreen button**.
  6. **Cover image:** `docs/itch-cover.png`. **Screenshots:** `docs/screenshots/arena.png`, `deck.png`, `title.png`, `real-cards-setup.png`.
  7. **Genre:** Card Game. **Tags:** from [itch.io page](#itchio-page). **Visibility:** Draft. Save, open the page, play one game on it, then switch to **Public**.
  Done when: the page is public.

- [ ] **8. Post to web game players.** _Claude writes, you post._
  Needs: the itch page (7) and the vertical trailer (6). Where: r/WebGames, r/playmygame, then TikTok / YouTube Shorts. Check each subreddit's self-promotion rules first.
  ✍️ **Ready:** the texts are in [Posts for web game players](#posts-for-web-game-players).
  Order (spread out, so the stats show what each post did):
  1. **Day 1: r/playmygame.** The friendliest place for feedback: if something is broken, you hear it here first.
  2. **Day 3–4: r/WebGames**, after fixing anything found on day 1.
  3. **Same week: TikTok and YouTube Shorts** with the vertical trailer.
  How to post on Reddit (computer): open reddit.com/r/NAME → **Create Post** → pick the tab the text says (Text or Link) → paste the title and the body → add a **flair** if it asks for one → **Post**. Stay 1–2 hours after posting to answer comments: early replies keep a post alive.
  When: Tuesday to Thursday, around 14:00–16:00 UTC (morning in the US, where most Reddit users are).
  Done when: posted in all of them.

- [ ] **9. Post to tabletop players.** _You take the photo, Claude writes._
  Needs: the PDF (4) and the itch page (7). Do: a photo of a real game on a table, posted on r/soloboardgaming and r/cardgames, and a free BoardGameGeek listing.
  ✍️ **Ready:** the texts are in [Posts for tabletop players](#posts-for-tabletop-players), the photo list in [Photo for the tabletop posts](#photo-for-the-tabletop-posts).
  Order: r/soloboardgaming, then r/cardgames 3–4 days later, then the BoardGameGeek listing (its approval takes days to weeks, so it can start the same week).
  Done when: posted and listed.

- [ ] **10. Answer every comment for one week.** _You, with Claude._
  Needs: the posts (8–9). Do: paste the comments to Claude, and Claude helps you reply and notes what people didn't like.
  ✍️ Starting replies for the usual comments: [Replies](#replies).
  Done when: one week has passed and the list of complaints is written down.

- [ ] **11. 🚦 Checkpoint A (about 2 weeks after posting).** _You + Claude look at the stats._
  These are rough targets, not industry rules:
  - **Fewer than ~100 games started:** not enough people saw it. Post in more places, then back to **8**.
  - **Fewer than ~40% finish a game, or fewer than ~20% start a second one:** the game loses people. Claude fixes what the stats + comments show, post "I updated it based on your feedback," then back to **10**.
  - **Targets reached:** go to **12**.

## Phase 4: First money (CrazyGames)

CrazyGames brings the players and the ads, and pays you a share. It's free and non-exclusive.

How it works (checked 2026-10-16):
1. **Basic Launch:** a 7–21 day test with a small audience, ending after about 500 plays. There's **no money in this stage**. They measure playtime, how many people start playing, and how many come back.
2. **If your numbers are good enough:** Full Launch, with ads on and money paid monthly.
3. **If most numbers are bad:** the game can't continue, and you have to resubmit it as a new game with big changes. That's why Phase 3 comes first.

- [ ] **12. Prepare the CrazyGames version.** _Claude._
  Needs: passing Checkpoint A (11). Do: remove links to other sites and any shop button, no other ads, keep it under 50 MB, and make the cover images + description from the trailer.
  Done when: the build and images are ready.

- [ ] **13. Submit to CrazyGames.** _You make the developer account, Claude helps with the form._
  Needs: the build from step 12.
  Done when: Basic Launch is live.

- [ ] **14. 🚦 Checkpoint B (CrazyGames result, 1–3 weeks).**
  - **Invited to Full Launch:** go to **15**.
  - **Mixed:** improve the game, ask for another Basic Launch, then back to **13**.
  - **Rejected:** go back to Phase 3 with big changes (step **10**).

- [ ] **15. Add the CrazyGames SDK (their ad + tracking code).** _Claude._
  Needs: the Full Launch invitation (14). Do: ads only at natural breaks (between games), start/stop events, players land straight in a game, and it still works with ad blockers.
  Done when: CrazyGames accepts it.

- [ ] **16. Set up payouts.** _You._
  Needs: Full Launch accepted (15). Do: fill in the payment + tax details. They pay monthly through Tipalti, once you have at least €100, around the 10th of the next month.
  Done when: the payment details are approved.

- [ ] **17. 💰 First money.**
  Needs: steps 15–16. Expect roughly a few dollars per 1,000 plays. That's a rough estimate, since CrazyGames doesn't publish its share.

## Phase 5: Grow

- [ ] **18. Rules page for Google.** _Claude._
  Needs: your own address (3) and a game that passed Checkpoint B (14). Do: a page on your site about "a solo card game you can play with a regular deck," linking to the game and the PDF. It brings players slowly, for years.
  Done when: Google shows the page (check with Google Search Console).

- [ ] **19. Monthly check.** _You + Claude, once a month._
  Needs: income (17). Do: read the CrazyGames + site stats, then make one improvement to the game.

- [ ] **20. 🚦 Checkpoint C: do you have fans?**
  Signs: people come back every week, people ask "is there a printed deck?", and comments mention playing with real cards.
  - **Yes:** go to **21**.
  - **Not yet:** keep doing **19**.

## Phase 6: The deck

- [ ] **21. Design the deck.** _Claude._
  Needs: Checkpoint C (20). Do: draw it in code, in the game's own style, not AI-painted pictures, which tabletop players dislike. That covers the faces, the 12 picture cards, the back, the tower/king markers, a rules card and a quick-reference card. The same art also upgrades the web game.
  Done when: print-ready files (63.5 × 88.9 mm, 300 dpi).

- [ ] **22. Order one test deck.** _You._
  Needs: the files from step 21. Do: order from MakePlayingCards, about $10–17 per deck plus shipping.
  Done when: the deck arrives.

- [ ] **23. Play it and take photos.** _You._
  Needs: the test deck (22). Do: fix anything that looks wrong, then reorder if needed (back to **22**).
  Done when: you're happy with it and have good photos.

- [ ] **24. Open the deck shop.** _You make the account, Claude sets it up._
  Needs: the final files (23). Do: print-on-demand (The Game Crafter or DriveThruCards). They print and ship each order, so you have no stock and no upfront cost.
  Done when: the deck can be bought.

- [ ] **25. "Get the deck" button + posts.** _Claude adds the button, you post photos._
  Needs: the shop (24). Put the button on your own site only, not the CrazyGames version.

- [ ] **26. 🚦 Checkpoint D: do decks sell every month?**
  - **Yes:** consider a Kickstarter for a bulk-printed edition, which makes each deck much cheaper.
  - **No:** keep the print-on-demand deck. It costs nothing to leave it up.

## Phase 7: Steam (only if Phase 4 or 6 is clearly working)

The Steam fee is $100 per game. Only worth it once the numbers say people pay or play a lot.

---

## Money to expect (honest)

| Source | Typical result |
|---|---|
| itch.io pay-what-you-want | a few dollars here and there |
| CrazyGames, game does OK | $20–100 / month |
| CrazyGames, game does well | $200–2,000 / month |
| Printed deck (print-on-demand) | a few dollars profit per deck |
| Small Steam indie (median) | $5–15k over its whole life |

It takes months, not weeks. The thing that decides everything is whether strangers play a second game.

## Don't

- Don't post anything before the stats are in (step 5): posting without them teaches you nothing.
- Don't submit to CrazyGames before Checkpoint A: you get one real chance there.
- Don't print or sell a deck before Checkpoint C.
- Don't pay for ads. With no proof that people stay, it's money lost.

---

## Ready-to-post texts

Written 2026-10-16 by Claude, nothing posted yet. Copy them as they are or change anything that doesn't sound like you. If a subreddit's rules ask about AI, answer honestly: the rules are your design, the code was written with an AI assistant, and there are no AI-generated images.

Rule notes (from a rules index read October 2026; check the real rules tab before posting):
- **r/playmygame:** the game must be free to play now, the post needs a description and a direct link, one post per game a month, and pure trailers get removed.
- **r/WebGames:** a link post straight to the browser game, the title starts with the game's name.
- **r/cardgames:** self-promotion allowed.
- **r/soloboardgaming:** not in the index. Read its rules first.
- **Don't post in** r/tabletopgamedesign ("do not market your game here"), r/BoardgameDesign (no promotion) or r/boardgames (promotion only for active members).

### Posts for web game players

#### r/playmygame (Text post)

**Title:**
> Suitkeep: a free turn-based lane battle where every soldier is a playing card (browser, phone + desktop)

**Body** (add `docs/screenshots/arena.png` with the image button under the link):
> Play (free, no sign-up, works on phone): https://suitkeep.vercel.app
>
> Suitkeep is a solo card battle inspired by lane games like Clash Royale, but turn-based. You spend elixir to send cards down two lanes, they fight the enemy's cards in the middle, and whatever gets through hits the towers. Take down the enemy's king tower to win.
>
> A few rules make it more than "high card wins":
> - Suit wheel: ♠ beats ♥ beats ♦ beats ♣ beats ♠, and a card counts double against the suit it beats.
> - Aces beat Kings.
> - The enemy plays one card a round, and its next card is always face-up, so you can plan around it.
> - Towers fight back: hitting a tower is a fight against its top card.
>
> Your first game teaches the rules one at a time as you play. A game takes 10–20 minutes.
>
> It also works with a real deck: "Play with real cards" runs the enemy for you while you play at the table.
>
> What I'd love feedback on:
> 1. Did the first game make the rules clear, or did you get lost somewhere?
> 2. Did you want to play a second game? If not, what stopped you?
> 3. Anything that felt unfair or confusing?
>
> Thanks for playing!

#### r/WebGames (Link post)

**Title:**
> Suitkeep - a turn-based lane battle card game: send your cards down two lanes and take the enemy's king tower (free, no sign-up, phone + desktop)

**Link:** `https://suitkeep.vercel.app`

**Your first comment** (post it right after):
> I made this. Short version: higher card wins a fight, a suit wheel (♠ > ♥ > ♦ > ♣ > ♠) doubles a card against the suit it beats, aces beat kings, and the enemy's next card is always face-up so you can plan around it. The first game teaches you as you go. Any feedback is welcome, especially if something was confusing.

#### TikTok

**Video:** `trailer/out/suitkeep-trailer-tall.mp4`

**Caption:**
> A lane battle you can play with a normal deck of cards 🃏 Free in your browser: suitkeep.vercel.app #cardgame #indiegame #solitaire #strategygame #gamedev #playingcards

Links in TikTok captions can't be tapped; the trailer's last frame shows the address, which is enough for now.

#### YouTube Shorts

**Video:** `trailer/out/suitkeep-trailer-tall.mp4`

**Title:**
> A lane battle you play with a normal deck of cards #shorts

**Description:**
> Suitkeep: spend elixir, send your cards down two lanes, crack the enemy's towers and take down its king. Free in your browser, on phone or desktop, or with a real deck at the table: https://suitkeep.vercel.app

**Pinned comment:**
> Play free here: https://suitkeep.vercel.app

### Posts for tabletop players

#### Photo for the tabletop posts

One good photo does most of the work:
- A real game in the middle of play, shot from above or at a slight angle, on a plain table.
- Both lanes with cards in them, the towers fanned out, and the row of 10 elixir cards visible.
- Daylight from a window, no flash. Landscape. No clutter, nothing personal in the shot.
- Optional second photo: your phone next to the cards showing the app's real-cards screen.

#### r/soloboardgaming (Image post: the photo, then the text in the body)

**Title:**
> I designed a solo game for a standard 52-card deck: a lane battle against a simple automaton (free print-and-play rules)

**Body:**
> Suitkeep is a one-player duel you play with any standard deck: no jokers, no pen, no dice, no counters. About 10–20 minutes.
>
> How it plays:
> - You and the enemy get 14 cards each; 14 more stay in the box, so you never know exactly what the enemy has. A row of 10 face-down cards is your elixir bar, with a face-up marker.
> - From your 14 you choose a deck of 8 and three towers of 2 cards: left, king, right.
> - Each round you spend elixir to send cards down two lanes. The enemy plays the face-up top card of its pile into the lane where you pushed harder, so you always know its next play.
> - Front cards fight: higher rank wins, a suit wheel (♠ > ♥ > ♦ > ♣ > ♠) doubles a card against the suit it beats, and aces beat kings.
> - Cards that get through hit the towers, and the towers fight back. Take the enemy's king tower to win.
>
> Rules (3-page PDF, free): https://github.com/IFAKA/suitkeep/raw/main/print/Suitkeep-Rulebook.pdf
> Optional companion app that runs the enemy for you: https://suitkeep.vercel.app ("Play with real cards")
>
> I balanced it with thousands of simulated games, but what I'm missing is real people at a real table. If you try it, I'd love to hear:
> - Was setup clear from the PDF alone?
> - Was running the enemy easy, or fiddly?
> - How long did your game take, and did you win?

#### r/cardgames (Image post: the photo, then the text in the body)

**Title:**
> Suitkeep: a new solo game for a standard deck. A lane battle where a suit wheel doubles cards and aces beat kings

**Body:**
> I made a one-player card game you play with a normal 52-card deck. It's a lane battle against an automaton: you spend elixir to send cards down two lanes, the enemy answers with one card a round (always face-up, so you can plan), the front cards fight, and survivors attack three towers of 2 cards each. Take the enemy's king tower to win.
>
> The fights: higher rank wins, a suit wheel (♠ > ♥ > ♦ > ♣ > ♠) makes a card count double against the suit it beats, and aces beat kings. Towers fight back, so even a king can only break two tower cards before it's sent home.
>
> Free 3-page rules: https://github.com/IFAKA/suitkeep/raw/main/print/Suitkeep-Rulebook.pdf
> Or play it on screen: https://suitkeep.vercel.app
>
> Feedback very welcome, especially on anything in the rules that was unclear.

#### BoardGameGeek listing

1. Make a free account at **boardgamegeek.com**.
2. Find the page for submitting a new game (in the site menu, or search BGG's help for "submit a new game" if it moved).
3. Fill it in:
   - **Name:** Suitkeep. **Year:** 2026. **Players:** 1 to 1. **Playing time:** 10–20 minutes. **Age:** 10+.
   - **Designer:** your name. **Publisher:** (Web published).
   - **Categories:** Card Game, Print & Play. **Mechanisms:** Solo / Solitaire Game, Hand Management.
   - **Description:**
     > Suitkeep is a solo lane battle for one standard 52-card deck. Spend elixir to send your cards down two lanes against a simple automaton, clash in the middle, crack the enemy's towers and take down its king. A suit wheel doubles a card against the suit it beats, aces beat kings, and the enemy's next card is always face-up. Free 3-page print-and-play rules; an optional free web app runs the enemy for you or plays the whole game on screen at suitkeep.vercel.app.
4. Submit. BGG staff approve new games by hand, which takes days to weeks.
5. Once approved, upload `print/Suitkeep-Rulebook.pdf` under **Files** and your table photo under **Images**.

### itch.io page

**Short description:**
> A turn-based lane battle where every soldier is a playing card. Play in your browser or with a real deck.

**Description:**
> Spend elixir, send your cards down two lanes, clash with the enemy's cards in the middle, crack its towers and take down its king.
>
> Suitkeep is a free solo lane battle inspired by games like Clash Royale, but turn-based, and it needs nothing but a standard 52-card deck.
>
> **Play two ways**
> - **On screen:** the game deals, runs the enemy and animates every fight. Your first game teaches the rules one at a time.
> - **With real cards:** shuffle a real deck and play at the table. The game runs the enemy and tells you what to move. Or print the free 3-page rulebook and play with no screen at all.
>
> **The rules in one minute**
> - Higher rank wins a fight.
> - Suit wheel: ♠ beats ♥ beats ♦ beats ♣ beats ♠. A card counts double against the suit it beats.
> - Aces beat Kings.
> - The enemy plays one card a round, and its next card is always face-up.
> - Towers fight back. Take the enemy's king tower to win.
>
> 1 player · 10–20 minutes · phone and desktop · plays offline after the first visit
>
> The rulebook PDF is free. If you enjoy the game, a small donation helps me keep improving it.

**Tags** (up to 10): `card-game`, `solitaire`, `strategy`, `turn-based`, `tabletop`, `print-and-play`, `singleplayer`, `minimalist`, `casual`, `mobile`

### Replies

Starting points for step 10. Paste the real comments to Claude for anything else.

- **"Is this like Clash Royale?"**
  > Yes, that's the inspiration: lanes, elixir, towers and a king. But it's turn-based, there's nothing to buy, and you can play it with a real deck of cards.
- **Someone found a bug:**
  > Thanks for telling me! Which phone or browser were you on, and what were you doing when it happened? I'll fix it.
- **Someone was confused by a rule:**
  > Thanks, that's exactly what I need to know. Which part lost you? I'll make it clearer.
- **Someone liked it:**
  > Thank you, that means a lot! Did you play a second game?
- **A harsh comment:** don't argue. Thank them, and ask one specific question about what they didn't like. The useful part goes on the complaints list.
- **"Did you use AI?"**
  > I designed the rules and used an AI assistant to help write the code. The art is drawn in code, no AI images.

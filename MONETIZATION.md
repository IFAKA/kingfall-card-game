# From zero to money: the step-by-step path

_Written 2026-10-16 for this game as it is today. Update it when a step is done or the facts change._

## Where you are today

- The game works and is live at suitkeep.vercel.app (on screen + with real cards).
- The printable rulebook exists (`print/Suitkeep-Rulebook.pdf`).
- The trailer is finished: `trailer/out/suitkeep-trailer-tall.mp4` (vertical) and `trailer/out/suitkeep-trailer-wide.mp4` (wide), 33 seconds each.
- **Nobody else has played it yet**, and you don't know anyone to test with.
- **There are no stats** in the game, so you can't see what players do.
- **The game is called Suitkeep** (renamed 2026-10-16, because a card game called "Kingfall" was announced on Steam on 2026-10-01 by an established studio). The repo is github.com/IFAKA/suitkeep, and the old kingfall-card-game.vercel.app link forwards to suitkeep.vercel.app.

## How to use this file

- Do the steps **in order**. Each step needs what the step before it made.
- Every step says what it **needs**, what to **do**, and when it's **done**.
- 🚦 steps are checkpoints: the numbers decide whether you go forward or go back and fix something.
- **You** = things only you can do (accounts, payments, posting, photos). **Claude** = things Claude does.
- Tick the box when a step is done.

**➡️ Next step: 5** (add anonymous stats). Steps 1, 2, 4 and 6 are done; step 3 is optional for now.

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

- [ ] **5. Add anonymous stats.** _Claude._
  Needs: the renamed game from step 4. Do: count games started, games finished (won or lost), second games started, the round where people quit, and real-cards mode started. Use a free, privacy-friendly counter. No names, no tracking ads.
  Done when: you play one game and see it in the stats page.

- [x] **6. Finish the trailer with the new name.** _Claude._
  Needs: the renamed game (step 4). Do: run the trailer's rebuild command.
  Done when: you have watched both videos and like them.
  ✅ Done 2026-10-16: `trailer/out/suitkeep-trailer-tall.mp4` and `suitkeep-trailer-wide.mp4`, 33 seconds each. After the game changes a lot, rebuild them with `cd trailer && npm run rebuild` (about an hour). If only the name or address changes, edit `trailer/trailer.config.json` and run `npm run master` (about 2 minutes).

## Phase 3: First strangers (no money yet, this is the practice round)

This round finds the problems for free. CrazyGames (Phase 4) only gives you one real chance, so fix things here first.

- [ ] **7. itch.io page.** _You make the account, Claude writes the page._
  Needs: the trailer (6) and the PDF (4). Do: the web game playable on the page plus the rulebook PDF as "pay what you want."
  Done when: the page is public.

- [ ] **8. Post to web game players.** _Claude writes, you post._
  Needs: the itch page (7) and the vertical trailer (6). Where: r/WebGames, r/playmygame, then TikTok / YouTube Shorts. Check each subreddit's self-promotion rules first.
  Done when: posted in all of them.

- [ ] **9. Post to tabletop players.** _You take the photo, Claude writes._
  Needs: the PDF (4) and the itch page (7). Do: a photo of a real game on a table, posted on r/soloboardgaming and r/cardgames, and a free BoardGameGeek listing.
  Done when: posted and listed.

- [ ] **10. Answer every comment for one week.** _You, with Claude._
  Needs: the posts (8–9). Do: paste the comments to Claude, and Claude helps you reply and notes what people didn't like.
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

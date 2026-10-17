# Playtest sheet (NOT the final rules)

Solo. One standard 52-card deck, nothing else; 22 cards are in play. Goal: find out if it is fun, how long it takes, and where the rules confuse you. The full rules are in [RULEBOOK.md](RULEBOOK.md); this is the short version.

**Current test (2026-10-17): small cards run.** Play **5 games**: 3 with real cards (Play with real cards), then 2 on screen. Fill in the log after each. Stop early and report if the run rule confuses you at the table. When done, open ☰ → Past games → **Save all in one file** and send it: games from before the change say "old rules" there, and their logs lack "small cards run 2 slots" in the Rules line.

Rank: A=1, 2–10 face value, J=11, Q=12, K=13. Suits only matter for the wheel.

## Suit wheel
In a fight, a card **counts double** against the suit it beats (6♠ vs J♥ fights as 12 and wins):
♠ beats ♥ · ♥ beats ♦ · ♦ beats ♣ · ♣ beats ♠. Between black and red only two count: your ♠ beats its ♥, its ♦ beats your ♣.

## Aces beat Kings
In a fight, an **ace beats a K** (suits don't matter; J and Q beat an ace). Both sides use it, and it counts against towers too (a tower hit is a fight).

## Setup (52 cards = 11 + 11 + 30 back in the box)
1. Sort the deck into black (♠ ♣) and red (♥ ♦). Shuffle the black and take **11** for you. Shuffle the red face-down and deal **11** to the enemy without looking. The other 30 go back in the box unseen.
2. **Your 11:** pick **8 for your deck**. The other 3 are your towers, one card each: **left**, **right**, **king**.
3. Shuffle your 8 deck cards. Take 3 as your **hand**; the other 5 are your **queue** (face-up stack, top card drawn next).
4. **Enemy 11:** without looking, 8 are its **pile** (face-down), 3 its towers (left, right, king), face-down. Turn the pile's **top card face-up**: the enemy's top card is always face-up.
5. Table: two lanes (left, right) between the tower rows. Each lane has **3 slots**: slot 1 next to you, slot 2 in the middle, slot 3 next to the enemy. Your cards and the enemy's share the slots; the colour says whose a card is.

## Each round
1. **You play** 1 card, or 2 small cards (A to 5), or nothing: into slot 1 of a lane, then refill your hand to 3 from your queue. Nothing carries over.
2. **Enemy plays 2 cards** from the top of its pile into slot 3: the first into the lane where **you have more units** (tie: your highest card, then left), the second into the **other** lane. Then turn its next top card face-up.
3. **Fight.** In each lane, the front-most units of both sides fight where they stand if they are in the same or neighbouring slots. Higher wins (doubled for the winning suit, an ace beats a K); the loser goes to the bottom of its owner's pile. Equal: the enemy wins. The card behind the loser steps up one slot and fights the winner, until one side has no units in that lane.
4. **Move.** Every unit that hasn't moved this round steps one slot forward. **Small cards (A to 5) run: they step two**, yours and the enemy's, unless an enemy card is in their slot after the first. Cards never pass through each other. A unit that steps off the last slot is "at the tower".
5. **Tower hits.** Left lane first. Each unit at the tower hits that lane's side tower (or the king if the side tower is gone). **Every tower card takes two hits:** the first cracks it (turn it sideways), the next breaks it. The hit is still a fight: if the unit **wins**, it stays, wounded (sideways), and hits once more next round, then goes home; if it **loses or ties** (ties go to the enemy), it goes home at once (the card still cracks).
   - **Last stand:** when a side tower falls, its owner places one card in that lane for free. Not for the king.
6. **End check.** Enemy king gone = you win. Yours gone = you lose. Both in the same round = more side towers left wins (equal = draw).

## What to look for (from the bot simulator)
- Expected strength: a first-time player who thinks ≈ 58% wins (the app's suggestions play at about that level), careless 3 moves in 10 ≈ 42%, always the strongest card ≈ 29%. Play the first deal, don't deal again.
- Decks with 4 to 6 big cards (6 to K) win about as often (≈ 55–58%); all big ≈ 50%; a deck of only small cards loses (≈ 27%).
- Estimated length: about 6 rounds. Time yourself.

## Log (copy per game)
- Your deck (how many big cards): __  Result: __
- Minutes: __  Rounds (rough): __
- Moments where I really had to think: __
- Moments that were pure bookkeeping/boring: __
- Rules I got wrong or didn't understand: __
- "1 card, or 2 small ones": did it feel like a real choice each round, or obvious? Did you miss elixir (saving up for a big push)? __
- Did the enemy's 2 cards a round (one each lane) feel fair, or overwhelming? Was knowing only its first card enough to plan? __
- Did armored towers (two hits each) feel tense, or slow? Did a single card ever feel unstoppable? __
- Did a last stand ever turn a game around? __
- Did an ace killing a king feel fair, or cheap? __
- Was doubling for the winning suit quick in your head? With black vs red, did the wheel come up often enough to matter? __
- Could you always tell your lane cards from the enemy's by colour alone? __
- Was the game too short, too long, or right? __
- Small cards run: did you ever stop to choose between sending a runner and playing a big card? __
- Did you forget to move a runner two (yours or the enemy's)? How often? __
- Did the enemy's runners feel like a threat you had to answer? __
- Did small cards still feel useless? __
- Would I play again right now? (y/n) __  One thing I'd change: __

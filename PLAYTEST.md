# Playtest sheet (NOT the final rules)

Solo. One standard 52-card deck, nothing else. Goal: find out if it is fun, how long it takes, and where the rules confuse you.

Rank: A=1, 2–10 face value, J=11, Q=12, K=13. Suits only matter for the wheel.

## Cost table (elixir)
| Rank | A | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | J | Q | K |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cost | 1 | 2 | 2 | 3 | 4 | 5 | 5 | 6 | 7 | 8 | 8 | 9 | 10 |

## Suit wheel
In a fight, a card gets **+3 rank** against the suit it beats:
♠ beats ♥ · ♥ beats ♦ · ♦ beats ♣ · ♣ beats ♠

## Setup (52 cards = 16 + 16 + 10 + 10)
1. Shuffle. Deal **16 to you**, **16 to the enemy** (face-down, do not look), then **10 face-down row for you** (your elixir bar) and **10 face-down row for the enemy** (its bar).
2. **Your 16:** look at them. Pick **8 for your deck**. The other 8 are your towers: build 3 stacks — **left princess (3 cards)**, **right princess (3)**, **king (2)**. You choose each stack's order; the top card is the one that gets hit first.
3. Shuffle your 8 deck cards. Take 4 as your **hand**; the other 4 are your **queue** (face-down pile).
4. **Enemy 16:** without looking, take 8 as its **pile** (shuffle, face-down). The other 8 are its towers: 3 / 3 / 2, face-down.
5. Elixir: lay each bar as a horizontal row of 10 face-down cards, with a small gap after the 5th. Turn the **5th card sideways** (still face-down): that is the **marker**. Elixir = the marker's position counted from the left (1–10); no card sideways = 0. To gain or spend, straighten the marker and turn the card that many places right or left sideways. Never more than 10. Tip: work out the sum in your head and move each marker once per round.
6. Table: two lanes (left, right) between the tower rows. Each lane has **2 slots**: slot 1 next to you, slot 2 next to the enemy. Units are cards lying in a slot (several can share a slot).

## Each round (called a tick)
1. **Elixir.** Your marker moves **3** to the right. The enemy's moves **5**. Cap 10.
2. **You play** as many cards from your hand as you like and can afford: move your marker left by the cost, put the card in slot 1 of a lane, then refill your hand to 4 from the top of your queue.
3. **Enemy plays.** Turn its top pile card face-up. While its cost ≤ enemy elixir: it pays (its marker moves left by the cost), the card goes to slot 2 of the lane where **you have more units** (tie: left): it defends against your biggest push, then turn up the next top card. When it can't afford the face-up top card, stop; that card stays face-up (its known next play).
4. **Move.** Every unit steps one slot toward the other side, **except** the front units that already face each other (same slot, or neighbouring slots): those do not move, they clash in place. Cards never pass through each other. A unit that steps off the last slot is "at the tower".
5. **Fight.** In each lane that has units from both sides: your front-most unit fights the enemy's front-most (front-most = furthest advanced; tie: placed first). Compare rank (+3 wheel bonus if it applies). **Higher wins; loser goes to the bottom of its owner's pile/queue.** Equal: both go. The winner steps forward into the slot it cleared (if no other enemy card is still in its way), then fights the next enemy card, until one side has no units in that lane. Refill your hand to 4 whenever a card returns to your queue.
6. **Tower hits.** Each unit still at the tower hits that lane's princess stack (or the king stack if that princess stack is empty). The unit goes to the bottom of its owner's pile. Turn the top tower card face-up. If the unit's rank ≥ that card's rank, **or the card is already cracked (sideways)**, discard the tower card. **Otherwise the tower holds, but the card cracks: turn it sideways and move it to the BOTTOM of that tower** (face-up if it is an enemy card: you now know it), so the next card is on top. Any later hit breaks a cracked card, so small cards can wear any tower down.
   - **Last stand:** when a left or right tower loses its last card, its owner immediately places one card in that lane for free (marker doesn't move). You: any card from your hand into slot 1, then refill. Enemy: the top card of its pile (normally already face-up) into slot 2. Not for the king.
7. **End check.** Enemy king stack empty = you win. Yours empty = you lose. Both = draw.

Enemy moves in the same way against your towers (it hits your stacks; you know your cards).

## What to look for (from the bot simulator)
- Bots say decks with heavy cards do best (strong player: mixed ≈ 80%, all-high ≈ 80%), all-cheap struggles (≈ 30%) because the enemy defends the lane you push. Try them and see if you feel it.
- Expected strength: random play ≈ 1% wins, a simple rule-follower ≈ 40%, a strong player ≈ 80–85%. Expect to lose your first games.
- Estimated length: ~20–25 rounds. Time yourself.

## Log (copy per game)
- Your draft (how many high cards): __  Result: __
- Minutes: __  Rounds (rough): __
- Moments where I really had to think: __
- Moments that were pure bookkeeping/boring: __
- Rules I got wrong or didn't understand: __
- Did the visible enemy next-card make it too easy? __
- Did the enemy defending your pushed lane feel smart, or predictable/exploitable? __
- Did the sideways elixir marker feel quick, or still like bookkeeping? __
- Did a last stand ever turn a game around? __
- Did cracking (sideways tower cards) feel natural? Did any tower feel impossible? __
- Would I play again right now? (y/n) __  One thing I'd change: __

# Playtest sheet (NOT the final rules)

Solo. One standard 52-card deck, nothing else. Goal: find out if it is fun, how long it takes, and where the rules confuse you.

Rank: A=1, 2–10 face value, J=11, Q=12, K=13. Suits only matter for the wheel.

## Cost table (elixir)
| Rank | A | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | J | Q | K |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cost | 1 | 2 | 2 | 3 | 4 | 5 | 5 | 6 | 7 | 8 | 8 | 9 | 10 |

## Suit wheel
In a fight, a card **counts double** against the suit it beats (6♠ vs J♥ fights as 12 and wins):
♠ beats ♥ · ♥ beats ♦ · ♦ beats ♣ · ♣ beats ♠

## Aces beat Kings
In a fight, an **ace beats a K** (suits don't matter; J and Q beat an ace). Both sides use it, and it counts against towers too (a tower hit is a fight).

## Setup (52 cards = 14 + 14 + 10 + 14 back in the box)
1. Shuffle. Deal **14 to you**, **14 to the enemy** (face-down, do not look), then a **10 face-down row for you** (your elixir bar). Put the other **14 back in the box** without looking.
2. **Your 14:** look at them. Pick **8 for your deck**. The other 6 are your towers: build 3 stacks — **left princess (2 cards)**, **right princess (2)**, **king (2)**. You choose each stack's order; the top card is the one that gets hit first.
3. Shuffle your 8 deck cards. Take 4 as your **hand**; the other 4 are your **queue** (face-down pile).
4. **Enemy 14:** without looking, take 8 as its **pile** (shuffle, face-down). The other 6 are its towers: 2 / 2 / 2, face-down. Turn the pile's **top card face-up**: the enemy's top card is always face-up.
5. Elixir: lay your bar as a horizontal row of 10 face-down cards, with a small gap after the 5th. Turn the **5th card sideways** (still face-down): that is the **marker**. Elixir = the marker's position counted from the left (1–10); no card sideways = 0. To gain or spend, straighten the marker and turn the card that many places right or left sideways. Never more than 10. Tip: work out the sum in your head and move the marker once per round. The enemy has no bar.
6. Table: two lanes (left, right) between the tower rows. Each lane has **2 slots**: slot 1 next to you, slot 2 next to the enemy. Units are cards lying in a slot (several can share a slot).

## Each round (called a tick)
1. **Elixir.** Your marker moves **3** to the right. Cap 10.
2. **You play** as many cards from your hand as you like and can afford: move your marker left by the cost, put the card in slot 1 of a lane, then refill your hand to 4 from the top of your queue.
3. **Enemy plays exactly one card:** its face-up top card, whatever it costs. It goes to slot 2 of the lane where **you have more units** (tie: left): it defends against your biggest push. Then turn its next top card face-up (its known next play).
4. **Fight.** In each lane that has units from both sides: your front-most unit fights the enemy's front-most where they stand (front-most = furthest advanced; in a shared slot, the one that got there first). Nothing has moved yet. Compare rank, doubled for the winning suit (an ace against a picture card always wins). **Higher wins; loser goes to the bottom of its owner's pile/queue.** Equal: both go. The winner stays where it is; the next unit behind the loser steps up one slot (its move this round; it stays if an enemy card is in its own slot) and fights the winner, until one side has no units in that lane. Refill your hand to 4 whenever a card returns to your queue.
5. **Move.** Every unit that hasn't moved this round steps one slot toward the other side. Cards never pass through each other. A unit that steps off the last slot is "at the tower". Units already at a tower stay there.
6. **Tower hits.** Left lane first, then right. Each unit at the tower hits that lane's princess stack (or the king stack if that princess stack is empty). Turn the top tower card face-up: **the hit is a fight** against it (wheel and aces count). If the unit **wins or ties**, **or the card is already cracked (sideways)**, discard the tower card, and the unit stays at the tower **turned sideways (wounded)**: it hits **once more** next round, unless an enemy unit beats it first (new enemy cards in that lane fight it first), then goes to the bottom of its owner's pile. **If it loses, the tower holds and shoots it back: the unit goes to the bottom of its owner's pile, and the card cracks: turn it sideways and move it to the BOTTOM of that tower** (face-up if it is an enemy card: you now know it), so the next card is on top. Any later hit breaks a cracked card, so small cards can wear any tower down.
   - **Last stand:** when a left or right tower loses its last card, its owner immediately places one card in that lane for free (marker doesn't move). You: any card from your hand into slot 1, then refill. Enemy: its face-up top card into slot 2, then turn the next one face-up. Not for the king.
7. **End check.** Enemy king stack empty = you win. Yours empty = you lose. Both in the same round = more tower cards left wins (equal = draw).

Enemy moves in the same way against your towers (it hits your stacks; you know your cards).

## What to look for (from the bot simulator)
- Bots say most deck mixes win within about 10 points of each other (about 67–77% for a strong bot): skill is in the playing. Try an all-cheap and an all-heavy deck and see if that feels true.
- Expected strength: random play ≈ 11% wins, the app's suggestions ≈ 72%, a player who thinks ahead ≈ 90%. Expect to lose some of your first games.
- Estimated length: ~12–17 rounds (about 1 game in 10 goes past 22). Time yourself.

## Log (copy per game)
- Your draft (how many high cards): __  Result: __
- Minutes: __  Rounds (rough): __
- Moments where I really had to think: __
- Moments that were pure bookkeeping/boring: __
- Rules I got wrong or didn't understand: __
- Did the visible enemy next-card make it too easy? __
- Did the enemy defending your pushed lane feel smart, or predictable/exploitable? __
- Did the sideways elixir marker feel quick, or still like bookkeeping? Did the enemy feel fine with no bar (one card per round)? __
- Did a last stand ever turn a game around? __
- Did a card sitting at a tower feel exciting to push or to clear, or unfair? Did a single enemy card ever feel unstoppable? Did stacking your towers (suits, an ace on top) matter? Were there still rounds where nothing happened? __
- Did an ace killing a king feel fair, or cheap? __
- Was doubling for the winning suit quick in your head, or did you have to stop and count? __
- Did cracking (sideways tower cards) feel natural? Did any tower feel impossible? __
- Would I play again right now? (y/n) __  One thing I'd change: __

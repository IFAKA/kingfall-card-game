# Kingfall: a one-player lane duel with a standard deck

**Players:** 1 · **Time:** 20–40 minutes · **You need:** one standard 52-card deck (no jokers). No pen, no counters, no dice.

**Goal:** destroy the enemy's king tower before it destroys yours. You play against an automaton: a simple, fixed set of rules runs the enemy, so you never have to make decisions for it.

Every card is a soldier. You spend elixir to send soldiers down two lanes, the enemy sends its own, they clash in the middle, and survivors attack the towers. Skill gives a big edge; luck still decides some games. A careful player wins most games, but not all.

**Companion app (optional):** the table guide runs the enemy for you and tells you exactly what to move each step. The rules below are complete without it.

**Rank:** A=1, 2–10 face value, J=11, Q=12, K=13. Suits only matter for the wheel (below).

## Cost table (elixir)
| Rank | A | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | J | Q | K |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cost | 1 | 2 | 2 | 3 | 4 | 5 | 5 | 6 | 7 | 8 | 8 | 9 | 10 |

## Suit wheel
In a fight, a card **counts double** against the suit it beats:
♠ beats ♥ · ♥ beats ♦ · ♦ beats ♣ · ♣ beats ♠.
Example: 6♠ against J♥ fights as 12 and wins; against Q♥ it ties. Between ♠ and ♦ (or ♥ and ♣) nobody doubles.

## Aces beat picture cards
In a fight, an **ace beats a J, Q or K**, whatever the suits.
It works both ways: an enemy ace kills your king. Fights only, not tower hits.

## Setup (52 = 16 + 16 + 10 + 10)
1. Shuffle. Deal **16 to you**, **16 to the enemy** (face-down, don't look), then **10 face-down in a row for your elixir bar** and **10 face-down in a row for the enemy's bar**.
2. **Your 16:** look at them. Choose **8 as your deck**; the other 8 are your **towers**: **left princess (3 cards)**, **right princess (3)**, **king (2)**. You choose the order of each stack; the top card is hit first.
   - Tip: mixed decks do best in testing: 2–5 heavy cards (cost 7+) plus cheap cards. All-cheap and all-heavy decks are only a little behind: aces take down picture cards, and the wheel lets a mid card beat a big one.
3. Shuffle your 8 deck cards. Take 4 as your **hand**; the other 4 are your **queue** (face-down pile).
4. **Enemy 16:** without looking, shuffle them. 8 form its **pile** (face-down); 8 form its towers (**3 / 3 / 2**), face-down.
5. **Elixir:** lay each bar as a row of 10 face-down cards with a small gap after the 5th, so positions read at a glance. Turn the **5th card sideways** (still face-down) in each bar. That sideways card is the **marker**: elixir = its position, counted from the left (1–10). No card sideways = 0 elixir.
   - To gain or spend elixir, straighten the marker and turn the card that many places right or left sideways instead. Never past 10.
   - Tip: do the sums in your head and move each marker **once per round**: your new elixir = min(10, old + 3) − what you spent.
6. **Table:** two lanes (left, right) between the tower rows. Each lane has **2 slots**: slot 1 next to you, slot 2 next to the enemy. Several cards may share a slot. Cards in a lane are **units**.

## Each round
1. **Elixir.** Your marker moves **3** to the right. The enemy's moves **5**. Max 10 each.
2. **You play.** As many cards as you like and can afford: move your marker left by the cost, put the card in **slot 1** of a lane, refill your hand to 4 from the top of your queue. You may play nothing.
3. **Enemy plays (automaton).** Turn the top card of its pile face-up. While its cost ≤ the enemy's elixir: it pays (its marker moves left by the cost), the card goes to **slot 2 of the lane where you have more units** (tie: left), so the enemy always defends against your biggest push. Then turn up the next top card. When it can't afford the face-up top card, stop; that card stays face-up, so you know its next play.
4. **Move.** Every unit steps one slot toward the other side, **except** front units that already face each other (same slot or neighbouring slots): they don't move, they clash in place. Cards never pass through each other. A unit that steps past the last slot is **at the tower**.
5. **Fight.** In each lane with units from both sides, your front-most unit fights the enemy's front-most (front-most = furthest advanced; tie: placed first). Compare rank, doubled for the winning suit (an ace against a picture card always wins).
   - **Higher wins; the loser goes to the bottom of its owner's pile** (the enemy's goes face-up: you know it now). **Equal:** both go.
   - The winner steps forward into the slot it cleared (if no other enemy card is still in the way) and fights the next enemy card, until one side has no units left in that lane.
   - Whenever one of your cards returns to your queue, refill your hand to 4.
6. **Tower hits.** Every unit at the tower hits that lane's princess stack, or the king stack if that princess stack is empty. **The king can only be hit once that lane's princess stack is gone.** The unit goes to the bottom of its owner's pile. Turn the top tower card face-up:
   - Unit rank ≥ that card's rank, **or the card is already cracked (sideways)**: **the tower card is destroyed** (discard it).
   - Otherwise the tower holds, but the card **cracks**: turn it **sideways** and move it to the **bottom of that tower** (face-up if it is an enemy card). The next card is now on top. Any later hit breaks a cracked card, so every tower can be worn down, even by small cards.
   - The enemy hits your towers the same way. You know your own cards.
   - **Last stand:** when a left or right tower loses its last card, its owner immediately places **one card in that lane for free** (the marker doesn't move). You pick any card from your hand, put it in slot 1 and refill your hand. The enemy puts the top card of its pile (normally already face-up) in slot 2. The king has no last stand.
7. **End.** Enemy king stack empty = **you win**. Yours empty = **you lose**. Both in the same round = draw. Otherwise start the next round.

## Designer's notes (from thousands of simulated games)
- Expect to lose your first games. Random play wins about 4%, a simple rule-follower about 40–45%, a strong player about 85–90%. Thoughtless play loses; thinking wins.
- What wins: stop every enemy card before it reaches your towers, keep elixir in the bank, and let the cards that survive your defence counterattack.
- Games last about 20–25 rounds.
- Every game is winnable: cracked tower cards mean no deck is ever stuck against towers it can't break.
- Deck types (strong player): mixed about 88%, all-cheap about 84%, all-heavy about 82%. Every kind of deck can win: aces kill picture cards, and the wheel lets a mid card beat a big one.
- No numbers to memorise: the wheel doubles, aces beat pictures.
- Last stand makes comebacks more common: about half of a strong player's losses are near misses (the enemy was down to its last couple of tower cards).
- Dead cards return to the bottom of their owner's pile, so your 8 cards keep cycling and you will face the enemy's cards again.

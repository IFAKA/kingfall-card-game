# Kingfall: a one-player lane duel with a standard deck

**Players:** 1 · **Time:** 10–20 minutes · **You need:** one standard 52-card deck (no jokers). No pen, no counters, no dice.

**Goal:** destroy the enemy's king tower before it destroys yours. You play against an automaton: a simple, fixed set of rules runs the enemy, so you never have to make decisions for it.

Every card is a soldier. You spend elixir to send soldiers down two lanes, the enemy sends one card a round, they clash in the middle, and survivors attack the towers. Skill gives a big edge; luck still decides some games. A careful player wins most games, but not all.

**Companion app (optional):** the table guide runs the enemy for you and tells you exactly what to move each step. The rules below are complete without it.

**Rank:** A=1, 2–10 face value, J=11, Q=12, K=13. Suits only matter for the wheel (below).

## Cost table (elixir)
| Rank | A | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | J | Q | K |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cost | 1 | 2 | 2 | 3 | 4 | 5 | 5 | 6 | 7 | 8 | 8 | 9 | 10 |

## Suit wheel
In a fight (and a tower hit, which is a fight too), a card **counts double** against the suit it beats:
♠ beats ♥ · ♥ beats ♦ · ♦ beats ♣ · ♣ beats ♠.
Example: 6♠ against J♥ fights as 12 and wins; against Q♥ it ties. Between ♠ and ♦ (or ♥ and ♣) nobody doubles.

## Aces beat picture cards
In a fight, an **ace beats a J, Q or K**, whatever the suits.
It works both ways: an enemy ace kills your king. It counts against towers too: an ace on top of a tower stops any picture card.

## Setup (52 = 14 + 14 + 10 + 14 in the box)
1. Shuffle. Deal **14 to you**, **14 to the enemy** (face-down, don't look), then **10 face-down in a row for your elixir bar**. Put the **other 14 back in the box without looking**: they sit this game out, so you can never be sure which cards the enemy has.
2. **Your 14:** look at them. Choose **8 as your deck**; the other 6 are your **towers**: **left princess (2 cards)**, **right princess (2)**, **king (2)**. You choose the order of each stack; the top card is hit first.
   - Tip: any kind of deck can win. In testing, all-cheap, mixed and all-heavy decks win about as often; how you play decides the game.
3. Shuffle your 8 deck cards. Take 4 as your **hand**; the other 4 are your **queue** (face-down pile).
4. **Enemy 14:** without looking, shuffle them. 8 form its **pile** (face-down); 6 form its towers (**2 / 2 / 2**), face-down. Turn the **top card of its pile face-up**: the enemy's top card is always face-up, so you always know its next play.
5. **Elixir:** lay your bar as a row of 10 face-down cards with a small gap after the 5th, so positions read at a glance. Turn the **5th card sideways** (still face-down). That sideways card is the **marker**: elixir = its position, counted from the left (1–10). No card sideways = 0 elixir.
   - To gain or spend elixir, straighten the marker and turn the card that many places right or left sideways instead. Never past 10.
   - Tip: do the sums in your head and move the marker **once per round**: your new elixir = min(10, old + 3) − what you spent.
   - The enemy has **no elixir bar**: it plays one card per round.
6. **Table:** two lanes (left, right) between the tower rows. Each lane has **2 slots**: slot 1 next to you, slot 2 next to the enemy. Several cards may share a slot. Cards in a lane are **units**.

## Each round
1. **Elixir.** Your marker moves **3** to the right. Max 10.
2. **You play.** As many cards as you like and can afford: move your marker left by the cost, put the card in **slot 1** of a lane, refill your hand to 4 from the top of your queue. You may play nothing.
3. **Enemy plays (automaton).** It plays **exactly one card**: its face-up top card, whatever it costs. The card goes to **slot 2 of the lane where you have more units** (tie: left), so the enemy always defends against your biggest push. Then turn its next top card face-up: that is its play next round.
4. **Fight.** In each lane with units from both sides, your front-most unit fights the enemy's front-most where they stand (front-most = furthest advanced; in a shared slot, the one that got there first). Nothing has moved yet. Compare rank, doubled for the winning suit (an ace against a picture card always wins).
   - **Higher wins; the loser goes to the bottom of its owner's pile** (the enemy's goes face-up: you know it now). **Equal:** both go.
   - The winner stays where it is. The next unit behind the loser **steps up one slot** (that is its move this round; if an enemy card is in its own slot, it stays) and fights the winner, and so on until one side has no units left in that lane.
   - Whenever one of your cards returns to your queue, refill your hand to 4.
5. **Move.** Every unit that hasn't moved this round steps one slot toward the other side. Cards never pass through each other. A unit that steps past the last slot is **at the tower**. Units already at a tower stay there.
6. **Tower hits.** Left lane first, then right. Every unit at the tower hits that lane's princess stack, or the king stack if that princess stack is empty. **The king can only be hit once that lane's princess stack is gone.** Turn the top tower card face-up: **a tower hit is a fight** against that card, with the same rules (the wheel doubles, an ace beats a picture card).
   - The unit **wins or ties**, **or the card is already cracked (sideways)**: **the tower card is destroyed** (discard it). The unit stays at the tower, **turned sideways: it is wounded**. It hits **once more** next round (unless an enemy unit beats it first: it is the front-most unit in its lane, so new enemy cards fight it first), then goes to the bottom of its owner's pile whatever happens. So one card breaks at most 2 tower cards.
   - The unit **loses**: the tower holds and **shoots it back**: the unit goes to the bottom of its owner's pile, and the tower card **cracks**: turn it **sideways** and move it to the **bottom of that tower** (face-up if it is an enemy card). The next card is now on top. Any later hit breaks a cracked card, so every tower can be worn down, even by small cards.
   - The enemy hits your towers the same way. You know your own cards.
   - **Last stand:** when a left or right tower loses its last card, its owner immediately places **one card in that lane for free** (the marker doesn't move). You pick any card from your hand, put it in slot 1 and refill your hand. The enemy puts its face-up top card in slot 2, then turns its next top card face-up. The king has no last stand.
7. **End.** Enemy king stack empty = **you win**. Yours empty = **you lose**. Both in the same round = draw. Otherwise start the next round.

## Designer's notes (from thousands of simulated games)
- Expect to lose your first games. Random play wins about 10%, a simple rule-follower about 50%, the companion app's suggestions about 80%. Thoughtless play mostly loses; thinking wins.
- What wins: clear enemy cards from your towers fast, push a lane when the enemy's face-up next card can't beat what you send, and stack your towers with care: a tower's top card fights back, so a heart on top stops diamonds and an ace on top stops picture cards.
- No single card decides a game: towers shoot back, so even a king breaks at most 2 tower cards before it goes home. Taking a king tower always needs a second attacker.
- Games last about 12–17 rounds; a long one runs to about 22.
- Every game is winnable: cracked tower cards mean no deck is ever stuck against towers it can't break.
- Skill is in the playing, not the deck: with a strong bot every deck type (all-cheap, mixed, all-heavy) wins about 70–82%, and a simple player copying the best deck wins less than a strong player with the worst one. Aces kill picture cards, and the wheel lets a mid card beat a big one.
- No numbers to memorise: the wheel doubles, aces beat pictures.
- Last stand makes comebacks more common: when a side tower falls, its owner gets a free card in that lane.
- Dead cards return to the bottom of their owner's pile, so your 8 cards keep cycling and you will face the enemy's cards again. A card holding a tower is out of that cycle until it dies.

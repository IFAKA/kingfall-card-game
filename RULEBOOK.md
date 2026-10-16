# Suitkeep: a one-player lane duel with a standard deck

**Players:** 1 · **Time:** 10–20 minutes · **You need:** one standard 52-card deck (no jokers). No pen, no counters, no dice.

You play against an automaton: a simple, fixed set of rules runs the enemy, so you never have to make decisions for it.

Every card is a soldier. You spend elixir to send soldiers down two lanes, the enemy sends one card a round, they clash in the middle, and survivors attack the towers. Skill gives a big edge; luck still decides some games. A careful player wins most games, but not all.

**Companion app (optional):** the table guide runs the enemy for you and tells you exactly what to move each step. The rules below are complete without it.

The sections are named like the topics of the app's How to play: **Goal, Fights, Elixir, A round, Towers, Last stand, Your pile**.

## Goal
Destroy the enemy's **king tower** before it destroys yours. Each side has three towers of 2 cards: the **left princess**, the **right princess** and the **king**. The king can only be hit through a lane whose princess tower is gone.
If both kings fall in the same round, count the cards left in your left and right towers against the enemy's: **more cards left wins**, equal is a draw.

## Fights
**Rank:** A=1, 2–10 face value, J=11, Q=12, K=13. When two cards fight, the **higher rank wins** and the loser goes to the bottom of its owner's pile (see **Your pile**). **Equal:** both go. Suits only matter for the wheel, and aces only against Kings.

### Suit wheel
In a fight (and a tower hit, which is a fight too), a card **counts double** against the suit it beats:
♠ beats ♥ · ♥ beats ♦ · ♦ beats ♣ · ♣ beats ♠.
Example: 6♠ against J♥ fights as 12 and wins; against Q♥ it ties. Between ♠ and ♦ (or ♥ and ♣) nobody doubles.

### Aces beat Kings
In a fight, an **ace beats a K**, whatever the suits. (J and Q are ordinary cards: they beat an ace.)
It works both ways: an enemy ace kills your king. It counts against towers too: an ace on top of a tower stops a K.

## Elixir
Elixir pays for your cards. You start with **5**, gain **3** each round, max **10** (your bar and its marker: **Setup**, step 5).

| Rank | A | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | J | Q | K |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cost | 1 | 2 | 2 | 3 | 4 | 5 | 5 | 6 | 7 | 8 | 8 | 9 | 10 |

The enemy has **no elixir**: it plays exactly one card per round, whatever it costs.

## Setup (52 = 14 + 14 + 10 + 14 in the box)
1. Shuffle. Deal **14 to you**, **14 to the enemy** (face-down, don't look), then **10 face-down in a row for your elixir bar**. Put the **other 14 back in the box without looking**: they sit this game out, so you can never be sure which cards the enemy has.
2. **Your 14:** look at them. Choose **8 as your deck**; the other 6 are your **towers**: **left princess (2 cards)**, **right princess (2)**, **king (2)**. You choose the order of each stack; the top card is hit first.
   - Tip: any kind of deck can win. In testing, all-cheap, mixed and all-heavy decks win about as often; how you play decides the game.
3. Shuffle your 8 deck cards. Take 4 as your **hand**; the other 4 are your **queue**, a face-up stack: its top card is the next one you draw.
4. **Enemy 14:** without looking, shuffle them. 8 form its **pile** (face-down); 6 form its towers (**2 / 2 / 2**), face-down. Turn the **top card of its pile face-up**: the enemy's top card is always face-up, so you always know its next play.
5. **Elixir:** lay your bar as a row of 10 face-down cards with a small gap after the 5th, so positions read at a glance. Flip the **5th card face-up**. That face-up card is the **marker**: elixir = its position, counted from the left (1–10). No card face-up = 0 elixir.
   - To gain or spend elixir, flip the card that many places right or left face-up, then flip the old marker face-down. Never past 10.
   - Tip: do the sums in your head and move the marker **once per round**: your new elixir = min(10, old + 3) − what you spent.
6. **Table:** your towers in a row in front of you (left, king, right), your queue on their left and your discard on their right; the enemy's the same way across the table (its pile on your left, its discard on your right). Two lanes (left, right) between the tower rows. Each lane has **2 slots**: slot 1 next to you, slot 2 next to the enemy. Several cards may share a slot. Cards in a lane are **units**.
   - Each lane has **two halves**: the **left half is yours**, the **right half is the enemy's**. A card always stays on its owner's half, also when it moves, so where it lies tells you whose it is.

## A round
1. **Elixir.** Your marker moves **3** to the right: flip the card 3 places right face-up, then the old one face-down. Max 10.
2. **You play.** As many cards as you like and can afford: move your marker left by the cost (flip the card that many places left face-up, then the old one face-down), put the card in **slot 1** of a lane, on your (left) half, refill your hand to 4 from the top of your queue. You may play nothing.
3. **Enemy plays (automaton).** It plays **exactly one card**: its face-up top card, whatever it costs. The card goes to **slot 2 of the lane where you have more units**, on its (right) half (tie: the lane with your highest-ranked unit, an ace counting as the lowest rank; still tied, left), so the enemy always defends against your biggest push. Then turn its next top card face-up: that is its play next round.
4. **Fight.** In each lane with units from both sides, your front-most unit fights the enemy's front-most where they stand (front-most = furthest advanced; in a shared slot, the one that got there first). Nothing has moved yet. They fight as in **Fights**.
   - The winner stays where it is. The next unit behind the loser **steps up one slot** (that is its move this round; if an enemy card is in its own slot, it stays) and fights the winner, and so on until one side has no units left in that lane.
5. **Move.** Every unit that hasn't moved this round steps one slot toward the other side, staying on its own half. Cards never pass through each other. A unit that steps past the last slot is **at the tower**. Units already at a tower stay there.
6. **Tower hits.** Left lane first, then right. Every unit at the tower hits that lane's princess stack, or the king stack if that princess stack is empty. **The king can only be hit once that lane's princess stack is gone.** Each hit is resolved as in **Towers**; a side tower that loses its last card gets a **Last stand**.
7. **End.** A king stack empty ends the game (see **Goal**). Otherwise start the next round.

## Towers
Turn the top tower card face-up: **a tower hit is a fight** against that card, with the same rules as **Fights** (the wheel doubles, an ace beats a K).
- The unit **wins or ties**, **or the card is already cracked (sideways)**: **the tower card is destroyed** (discard it). The unit stays at the tower, **turned sideways: it is wounded**. It hits **once more** next round (unless an enemy unit beats it first: it is the front-most unit in its lane, so new enemy cards fight it first), then goes to the bottom of its owner's pile whatever happens. So one card breaks at most 2 tower cards.
- The unit **loses**: the tower holds and **shoots it back**: the unit goes to the bottom of its owner's pile, and the tower card **cracks**: turn it **sideways** and move it to the **bottom of that tower** (face-up if it is an enemy card). The next card is now on top. Any later hit breaks a cracked card, so every tower can be worn down, even by small cards.
- The enemy hits your towers the same way. You know your own cards.

## Last stand
When a left or right tower loses its last card, its owner immediately places **one card in that lane for free** (the marker doesn't move). You pick any card from your hand, put it in slot 1 (your half) and refill your hand. The enemy puts its face-up top card in slot 2 (its half), then turns its next top card face-up. The king has no last stand.

## Your pile
A card that loses a fight, is shot back by a tower, or is a wounded unit after its second hit goes to the **bottom of its owner's pile** (the enemy's goes face-up: you know it now). Whenever one of your cards returns to your queue, refill your hand to 4.
So your 8 cards keep cycling, and you will face the enemy's cards again. A card holding a tower is out of that cycle until it dies.

## Designer's notes (from thousands of simulated games)
- Expect to lose some of your first games. Measured over thousands of simulated games: random play wins about 11%, following the companion app's suggestions about 72%, and a player who thinks several moves ahead about 90%. Thoughtless play mostly loses; thinking wins, and thinking harder keeps winning more.
- What wins: clear enemy cards from your towers fast, push a lane when the enemy's face-up next card can't beat what you send, and stack your towers with care: a tower's top card fights back, so a heart on top stops diamonds and an ace on top stops a king.
- No single card decides a game: towers shoot back, so even a king breaks at most 2 tower cards before it goes home. Taking a king tower always needs a second attacker.
- Games last about 12–17 rounds; a long one runs to about 22.
- Every game is winnable: cracked tower cards mean no deck is ever stuck against towers it can't break.
- Skill is in the playing, not the deck: with a strong bot most mixes of cheap and strong cards win within about 10 points of each other (about 67–77%), and the best split changes with the rules. The deal matters little: a deal with two aces wins about 10 points more than one with none. Aces kill kings, and the wheel lets a mid card beat a big one.
- No numbers to memorise: the wheel doubles, aces beat kings.
- Last stand makes comebacks more common: when a side tower falls, its owner gets a free card in that lane.

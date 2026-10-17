// The first game on screen is always this deal, so the tips teach the rules in the same order for every new player.
// Picked by scripts/tutorial.ts: on your very first turn your strongest card, Q♣, is the wrong play (the enemy's next card, 6♦,
// counts double against clubs and ties go to it), and the suggestion says so; then the first fight is plain "higher wins", the suit
// ×2 decides one for you, one of your small cards runs 2 slots, your ace beats a king; a tower card cracks, then breaks, a last
// stand comes, and you win a close game.
import { DECK_SIZE, freshDeck } from './engine.ts'
import type { Card } from './engine.ts'

export const TUTORIAL = {
  mine: ['2-0', '1-3', '9-3', '7-0', '10-0', '12-3', '6-3', '7-3', '3-0', '10-3', '3-3'], // your 11 cards (the first game skips the deck screen: the usual suggested split)
  deck: ['10-0', '12-3', '9-3', '1-3', '3-3', '3-0', '2-0', '10-3'], // 10♠ Q♣ 9♣ A♣ 3♣ 3♠ 2♠ 10♣: your deck in draw order, the first 3 are your opening hand
  enemyPile: ['6-2', '5-1', '9-1', '13-1', '1-2', '11-1', '3-2', '2-1'], // 6♦ 5♥ 9♥ K♥ A♦ J♥ 3♦ 2♥: the order it plays them
  enemyTowers: ['4-2', '4-1', '1-1'], // 4♦ 4♥ A♥: slot order L R K
}

const byId = (id: string): Card => freshDeck().find(c => c.id === id)!
export const tutorialCards = () => ({ mine: TUTORIAL.mine.map(byId), deck: TUTORIAL.deck.map(byId) })
/** The enemy's cards by tracking id, as on-screen play keeps them (ep0-7 its pile, et0-2 its towers). */
export const tutorialSecret = (): Record<string, Card> =>
  Object.fromEntries([...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers].map((id, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, byId(id)]))

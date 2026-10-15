// The first game on screen is always this deal, so the tips teach the rules in the same order for every new player.
// Picked by scripts/tutorial.ts: following the suggestions, the first fight is plain "higher wins", then the suit ×2 decides one
// for you, then your ace beats a king; a tower breaks early, a card cracks, a last stand comes, and you win a close game.
import { DECK_SIZE, freshDeck } from './engine.ts'
import type { Card } from './engine.ts'

export const TUTORIAL = {
  mine: ['12-1', '6-0', '9-3', '9-0', '7-0', '9-2', '4-0', '7-2', '1-1', '1-3', '11-3', '2-0', '6-3', '12-3'], // your 14 cards (the first game skips the deck screen: the usual suggested split)
  deck: ['11-3', '6-3', '1-3', '12-1', '1-1', '2-0', '12-3', '4-0'], // J♣ 6♣ A♣ Q♥ A♥ 2♠ Q♣ 4♠: your deck in draw order, the first 4 are your opening hand
  enemyPile: ['8-3', '4-3', '5-1', '8-0', '9-1', '1-2', '3-2', '13-2'], // 8♣ 4♣ 5♥ 8♠ 9♥ A♦ 3♦ K♦: the order it plays them
  enemyTowers: ['11-0', '5-3', '8-1', '3-1', '4-2', '10-2'], // J♠ 5♣ 8♥ 3♥ 4♦ 10♦: slot order L0 L1 R0 R1 K0 K1
}

const byId = (id: string): Card => freshDeck().find(c => c.id === id)!
export const tutorialCards = () => ({ mine: TUTORIAL.mine.map(byId), deck: TUTORIAL.deck.map(byId) })
/** The enemy's cards by tracking id, as on-screen play keeps them (ep0-7 its pile, et0-5 its towers). */
export const tutorialSecret = (): Record<string, Card> =>
  Object.fromEntries([...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers].map((id, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, byId(id)]))

// The first game on screen is always this deal, so the tips teach the rules in the same order for every new player.
// Picked by scripts/tutorial.ts: following the suggestions, the first fight is plain "higher wins", then the suit ×2 decides one
// for you, then your ace beats a king; a tower breaks early, a card cracks, a last stand comes, and you win a close game.
import { DECK_SIZE, freshDeck } from './engine.ts'
import type { Card } from './engine.ts'

export const TUTORIAL = {
  mine: ['13-1', '2-2', '5-1', '3-3', '2-3', '5-3', '8-3', '6-2', '9-2', '1-2', '4-2', '4-3', '1-0', '12-0'], // your 14 cards (the first game skips the deck screen: the usual suggested split)
  deck: ['1-0', '2-2', '2-3', '9-2', '3-3', '13-1', '12-0', '1-2'], // A♠ 2♦ 2♣ 9♦ 3♣ K♥ Q♠ A♦: your deck in draw order, the first 4 are your opening hand
  enemyPile: ['5-2', '13-3', '8-2', '13-0', '1-3', '6-1', '4-1', '4-0'], // 5♦ K♣ 8♦ K♠ A♣ 6♥ 4♥ 4♠: the order it plays them
  enemyTowers: ['7-2', '3-2', '12-2', '6-3', '10-2', '2-0'], // 7♦ 3♦ Q♦ 6♣ 10♦ 2♠: slot order L0 L1 R0 R1 K0 K1
}

const byId = (id: string): Card => freshDeck().find(c => c.id === id)!
export const tutorialCards = () => ({ mine: TUTORIAL.mine.map(byId), deck: TUTORIAL.deck.map(byId) })
/** The enemy's cards by tracking id, as on-screen play keeps them (ep0-7 its pile, et0-5 its towers). */
export const tutorialSecret = (): Record<string, Card> =>
  Object.fromEntries([...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers].map((id, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, byId(id)]))

// The first game on screen is always this deal, so the tips teach the rules in the same order for every new player.
// Picked by scripts/tutorial.ts: following the suggestions, the first fight is plain "higher wins", then the suit ×2 decides one
// for you, then your ace beats a king; a tower card cracks, then breaks, a last stand comes, and you win a close game.
import { DECK_SIZE, freshDeck } from './engine.ts'
import type { Card } from './engine.ts'

export const TUTORIAL = {
  mine: ['3-3', '9-0', '8-0', '6-0', '5-3', '12-0', '1-0', '7-3', '5-0', '2-0', '9-3'], // your 11 cards (the first game skips the deck screen: the usual suggested split)
  deck: ['1-0', '9-3', '8-0', '12-0', '2-0', '5-3', '3-3', '9-0'], // A♠ 9♣ 8♠ Q♠ 2♠ 5♣ 3♣ 9♠: your deck in draw order, the first 3 are your opening hand
  enemyPile: ['7-2', '9-1', '1-2', '2-2', '10-2', '8-1', '13-2', '6-2'], // 7♦ 9♥ A♦ 2♦ 10♦ 8♥ K♦ 6♦: the order it plays them
  enemyTowers: ['4-1', '12-1', '5-1'], // 4♥ Q♥ 5♥: slot order L R K
}

const byId = (id: string): Card => freshDeck().find(c => c.id === id)!
export const tutorialCards = () => ({ mine: TUTORIAL.mine.map(byId), deck: TUTORIAL.deck.map(byId) })
/** The enemy's cards by tracking id, as on-screen play keeps them (ep0-7 its pile, et0-2 its towers). */
export const tutorialSecret = (): Record<string, Card> =>
  Object.fromEntries([...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers].map((id, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, byId(id)]))

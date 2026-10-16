// The first game on screen is always this deal, so the tips teach the rules in the same order for every new player.
// Picked by scripts/tutorial.ts: following the suggestions, the first fight is plain "higher wins", then the suit ×2 decides one
// for you, then your ace beats a king; a tower card cracks, then breaks, a last stand comes, and you win a close game.
import { DECK_SIZE, freshDeck } from './engine.ts'
import type { Card } from './engine.ts'

export const TUTORIAL = {
  mine: ['11-3', '8-0', '11-0', '4-0', '12-3', '1-0', '6-0', '10-0', '7-0', '1-3', '2-3'], // your 11 cards (the first game skips the deck screen: the usual suggested split)
  deck: ['10-0', '2-3', '11-3', '12-3', '1-3', '11-0', '1-0', '4-0'], // 10♠ 2♣ J♣ Q♣ A♣ J♠ A♠ 4♠: your deck in draw order, the first 4 are your opening hand
  enemyPile: ['6-2', '2-2', '10-1', '13-1', '3-1', '5-1', '4-1', '12-2'], // 6♦ 2♦ 10♥ K♥ 3♥ 5♥ 4♥ Q♦: the order it plays them
  enemyTowers: ['9-2', '11-1', '7-2'], // 9♦ J♥ 7♦: slot order L R K
}

const byId = (id: string): Card => freshDeck().find(c => c.id === id)!
export const tutorialCards = () => ({ mine: TUTORIAL.mine.map(byId), deck: TUTORIAL.deck.map(byId) })
/** The enemy's cards by tracking id, as on-screen play keeps them (ep0-7 its pile, et0-2 its towers). */
export const tutorialSecret = (): Record<string, Card> =>
  Object.fromEntries([...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers].map((id, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, byId(id)]))

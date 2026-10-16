// The first game on screen is always this deal, so the tips teach the rules in the same order for every new player.
// Picked by scripts/tutorial.ts: following the suggestions, the first fight is plain "higher wins", then the suit ×2 decides one
// for you, then your ace beats a king; a tower card cracks, then breaks, a last stand comes, and you win a close game.
import { DECK_SIZE, freshDeck } from './engine.ts'
import type { Card } from './engine.ts'

export const TUTORIAL = {
  mine: ['6-0', '10-0', '3-3', '12-3', '11-3', '5-0', '2-0', '12-0', '13-0', '1-3', '4-3'], // your 11 cards (the first game skips the deck screen: the usual suggested split)
  deck: ['12-3', '11-3', '12-0', '1-3', '4-3', '3-3', '2-0', '13-0'], // Q♣ J♣ Q♠ A♣ 4♣ 3♣ 2♠ K♠: your deck in draw order, the first 3 are your opening hand
  enemyPile: ['3-1', '11-2', '12-1', '7-2', '13-1', '4-1', '5-1', '7-1'], // 3♥ J♦ Q♥ 7♦ K♥ 4♥ 5♥ 7♥: the order it plays them
  enemyTowers: ['6-1', '10-2', '4-2'], // 6♥ 10♦ 4♦: slot order L R K
}

const byId = (id: string): Card => freshDeck().find(c => c.id === id)!
export const tutorialCards = () => ({ mine: TUTORIAL.mine.map(byId), deck: TUTORIAL.deck.map(byId) })
/** The enemy's cards by tracking id, as on-screen play keeps them (ep0-7 its pile, et0-2 its towers). */
export const tutorialSecret = (): Record<string, Card> =>
  Object.fromEntries([...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers].map((id, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, byId(id)]))

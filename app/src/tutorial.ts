// The first game on screen is always this deal, so the tips teach the rules in the same order for every new player.
// Picked by scripts/tutorial.ts: following the suggestions, the first fight is plain "higher wins", then the suit ×2 decides one
// for you, then one of your small cards runs 2 slots, then your ace beats a king; a tower card cracks, then breaks, a last stand
// comes, and you win a close game.
import { DECK_SIZE, freshDeck } from './engine.ts'
import type { Card } from './engine.ts'

export const TUTORIAL = {
  mine: ['7-0', '8-3', '2-3', '6-0', '12-0', '8-0', '10-3', '9-0', '1-0', '13-0', '3-0'], // your 11 cards (the first game skips the deck screen: the usual suggested split)
  deck: ['3-0', '13-0', '6-0', '10-3', '9-0', '12-0', '2-3', '1-0'], // 3♠ K♠ 6♠ 10♣ 9♠ Q♠ 2♣ A♠: your deck in draw order, the first 3 are your opening hand
  enemyPile: ['3-2', '9-1', '8-1', '13-2', '5-1', '6-1', '10-1', '8-2'], // 3♦ 9♥ 8♥ K♦ 5♥ 6♥ 10♥ 8♦: the order it plays them
  enemyTowers: ['12-2', '7-1', '4-1'], // Q♦ 7♥ 4♥: slot order L R K
}

const byId = (id: string): Card => freshDeck().find(c => c.id === id)!
export const tutorialCards = () => ({ mine: TUTORIAL.mine.map(byId), deck: TUTORIAL.deck.map(byId) })
/** The enemy's cards by tracking id, as on-screen play keeps them (ep0-7 its pile, et0-2 its towers). */
export const tutorialSecret = (): Record<string, Card> =>
  Object.fromEntries([...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers].map((id, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, byId(id)]))

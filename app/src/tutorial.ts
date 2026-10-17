// The first game on screen is always this deal, so the tips teach the rules in the same order for every new player.
// Picked by scripts/tutorial.ts: following the suggestions, the first fight is plain "higher wins", then the suit ×2 decides one
// for you, one of your small cards runs 2 slots, and on turn 3 your strongest card, K♣, is the wrong play (the enemy's next card is
// an ace) and the suggestion says so; later ♦ doubling against ♣ makes it wrong twice more. Your ace beats a king, a tower card
// cracks, then breaks, you lose a side tower and get your own last stand, and you win a close game.
import { DECK_SIZE, freshDeck } from './engine.ts'
import type { Card } from './engine.ts'

export const TUTORIAL = {
  mine: ['1-0', '9-3', '2-0', '8-0', '10-3', '13-3', '11-0', '13-0', '10-0', '6-0', '1-3'], // your 11 cards (the first game skips the deck screen: the usual suggested split)
  deck: ['11-0', '10-0', '1-3', '13-0', '13-3', '6-0', '2-0', '1-0'], // J♠ 10♠ A♣ K♠ K♣ 6♠ 2♠ A♠: your deck in draw order, the first 3 are your opening hand
  enemyPile: ['9-2', '7-2', '12-1', '2-1', '1-2', '13-2', '4-2', '10-1'], // 9♦ 7♦ Q♥ 2♥ A♦ K♦ 4♦ 10♥: the order it plays them
  enemyTowers: ['6-1', '3-1', '6-2'], // 6♥ 3♥ 6♦: slot order L R K
}

const byId = (id: string): Card => freshDeck().find(c => c.id === id)!
export const tutorialCards = () => ({ mine: TUTORIAL.mine.map(byId), deck: TUTORIAL.deck.map(byId) })
/** The enemy's cards by tracking id, as on-screen play keeps them (ep0-7 its pile, et0-2 its towers). */
export const tutorialSecret = (): Record<string, Card> =>
  Object.fromEntries([...TUTORIAL.enemyPile, ...TUTORIAL.enemyTowers].map((id, i) => [i < DECK_SIZE ? `ep${i}` : `et${i - DECK_SIZE}`, byId(id)]))

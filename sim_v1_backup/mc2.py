import copy, random, sys
from game import *
from bots import RandomBot, HeavyBot
from mc import MCBot

def determinize(g, rng, mine16):
    """Replace the enemy's unseen deck order with a random one consistent with what the player has seen."""
    h = copy.deepcopy(g)
    e = h.side[E]
    seen = list(h.seen_enemy)
    if len(seen) >= 8:
        order = seen[-8:]            # cycle fully known
    else:
        pool = [(r, s) for r in range(1, 14) for s in range(4) if (r, s) not in mine16 and (r, s) not in seen]
        rng.shuffle(pool)
        unplayed = pool[:8 - len(seen)]
        order = unplayed + seen      # unplayed cards come first in cycle, played ones at the back
    e.hand, e.queue = order[:4], order[4:]
    for k, stack in e.towers.items():
        for i in range(len(stack)):
            if not (i == 0 and h.revealed[k]):
                stack[i] = rng.randint(1, 13)
    return h

class HiddenMC(MCBot):
    def __init__(self, heavy=4, horizon=8, samples=4):
        super().__init__(heavy, 1, horizon)
        self.samples, self.name = samples, f"hmc-h{heavy}-H{horizon}-S{samples}"
        self.mine16 = set()

    def draft(self, cards16, rules, rng):
        self.mine16 = set(cards16)
        return super().draft(cards16, rules, rng)

    def act(self, g, rng):
        s = g.side[P]
        for _ in range(4):
            worlds = [determinize(g, rng, self.mine16) for _ in range(self.samples)]
            options = [None] + [(i, l) for i in range(len(s.hand)) if g.can_play(P, i) for l in (0, 1)]
            best, bs = None, None
            for o in options:
                tot = 0
                for w in worlds:
                    h = copy.deepcopy(w)
                    if o: h.play(P, o[0], o[1])
                    tot += self.rollout(h, rng)
                if bs is None or tot > bs + 1e-9:
                    best, bs = o, tot
            if best is None: return
            g.play(P, best[0], best[1])

if __name__ == "__main__":
    from stats import run
    r = Rules(lane_len=3, regen=2, start_elixir=5, max_ticks=60)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    for b in (HiddenMC(4), HiddenMC(2), HiddenMC(6), HiddenMC(8), HiddenMC(0)):
        print(b.name, run(b, r, n=n, seed=5), flush=True)

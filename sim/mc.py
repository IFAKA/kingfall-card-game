import copy, random, sys
from game import *
from bots import RandomBot, HeavyBot, Smart2

class MCBot(HeavyBot):
    """Perfect-information lookahead: tries each play now, rolls forward with the smart policy."""
    def __init__(self, heavy=4, rollouts=1, horizon=8):
        super().__init__(heavy, "smart")
        self.horizon, self.name = horizon, f"mc-h{heavy}-H{horizon}"
        self.pol = HeavyBot(heavy)

    def score(self, g):
        w = g.winner()
        if w is not None:
            return 100 * (w - 0.5)
        return (8 - g.tower_total(E)) - (8 - g.tower_total(P)) + 0.01*(g.side[P].elixir)

    def rollout(self, g, rng):
        enemy_act(g); g.step_world()
        for _ in range(self.horizon):
            if g.winner() is not None: break
            g.regen(); self.pol.act(g, rng); enemy_act(g); g.step_world()
        return self.score(g)

    def act(self, g, rng):
        s = g.side[P]
        for _ in range(4):
            options = [None] + [(i, l) for i in range(len(s.hand)) if g.can_play(P, i) for l in (0, 1)]
            best, bs = None, None
            for o in options:
                h = copy.deepcopy(g)
                if o: h.play(P, o[0], o[1])
                sc = self.rollout(h, rng)
                if bs is None or sc > bs + 1e-9:
                    best, bs = o, sc
            if best is None: return
            g.play(P, best[0], best[1])

if __name__ == "__main__":
    from stats import run
    r = Rules(lane_len=3, regen=2, start_elixir=5, max_ticks=60)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 150
    for b in (HeavyBot(4), MCBot(4)):
        print(b.name, run(b, r, n=n, seed=5), flush=True)

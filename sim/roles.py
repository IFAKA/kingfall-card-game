import sys, game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1])
game.set_curve("linear")
en=RandomBot()
base = dict(lane_len=2, regen=3, enemy_regen=4, start_elixir=5, max_ticks=200)
class MCRole(MCBot):
    def __init__(self, target):
        super().__init__(4)
        self.rb = RoleBot(target); self.name = self.rb.name + "-mc"
        self.pol = HeavyBot(4)
    def draft(self, c, r, rng): return self.rb.draft(c, r, rng)
print("no roles   (rank-only h4):", run(MCBot(4), Rules(**base), n=n, enemy=en)['win'])
r = Rules(roles=True, **base)
print("roles on, random player:", run(RandomBot(), r, n=n*2, enemy=en)['win'], " heuristic h4:", run(HeavyBot(4), r, n=n*2, enemy=en)['win'])
for t in [(2,2,2,2),(3,2,3,0),(1,1,2,4),(1,1,5,1),(1,5,1,1),(5,1,1,1),(4,0,4,0),(0,0,4,4),(0,4,4,0),(0,0,8,0),(0,0,0,8)]:
    x = run(MCRole(t), r, n=n, enemy=en)
    print(f"mix soldier/guard/charger/spell={t}: win {x['win']:.2f} ko {x['ko']:.2f} ticks {x['ticks']}", flush=True)

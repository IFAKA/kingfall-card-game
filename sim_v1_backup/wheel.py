import sys, game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1])
game.set_curve("linear")
en=RandomBot()
base = dict(lane_len=2, regen=3, enemy_regen=4, start_elixir=5, max_ticks=200)
class MCS(MCBot):
    def __init__(self, target):
        super().__init__(4); self.rb = RoleBot(target); self.name="wheel-mc"+"".join(map(str,target)); self.pol=HeavyBot(4)
    def draft(self,c,r,rng): return self.rb.draft(c,r,rng)
for B in (0,2,3,4):
    r = Rules(wheel=B, **base)
    a=run(RandomBot(), r, n=n*2, enemy=en)['win']; b=run(HeavyBot(4), r, n=n*2, enemy=en)['win']; c=run(MCBot(4), r, n=n, enemy=en)
    print(f"wheel +{B}: random {a:.2f} heuristic {b:.2f} MC(rank-draft h4) {c['win']:.2f}  ko {c['ko']:.2f} ticks {c['ticks']}", flush=True)
r = Rules(wheel=3, **base)
print("draft composition under wheel+3 (MC bot, suit counts):")
for t in [(2,2,2,2),(4,4,0,0),(4,0,4,0),(8,0,0,0),(3,3,1,1),(5,1,1,1),(3,1,3,1)]:
    x=run(MCS(t), r, n=n, enemy=en); print(" ", t, f"win {x['win']:.2f} ticks {x['ticks']}", flush=True)

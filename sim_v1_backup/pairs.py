import sys, game, itertools
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1]); er=int(sys.argv[2])
game.set_curve("linear")
en=RandomBot()
r = Rules(lane_len=2, regen=3, enemy_regen=er, start_elixir=5, max_ticks=200, wheel=3)
class MCS(MCBot):
    def __init__(self, target):
        super().__init__(4); self.rb = RoleBot(target); self.name="mc"+"".join(map(str,target)); self.pol=HeavyBot(4)
    def draft(self,c,r,rng): return self.rb.draft(c,r,rng)
print("rank-only h4:", run(MCBot(4), r, n=n, enemy=en)['win'])
for a,b in itertools.combinations(range(4),2):
    t=[0]*4; t[a]=4; t[b]=4
    print("pair", a,b, run(MCS(tuple(t)), r, n=n, enemy=en)['win'], flush=True)
for a in range(4):
    t=[0]*4; t[a]=8
    print("mono", a, run(MCS(tuple(t)), r, n=n, enemy=en)['win'], flush=True)

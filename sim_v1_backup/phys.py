import sys, game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
from mc2 import HiddenMC
n=int(sys.argv[1])
game.set_curve("linear")
for er in (2,3):
    r = Rules(lane_len=3, regen=2, enemy_regen=er, start_elixir=5, max_ticks=60)
    en = RandomBot()   # enemy deck/towers are face-down random: table-executable
    out=[f"random={run(RandomBot(), r, n=n*2, enemy=en)['win']:.2f}", f"heuristic={run(HeavyBot(4), r, n=n*2, enemy=en)['win']:.2f}"]
    for h in (2,4,6):
        x=run(HiddenMC(h), r, n=n, enemy=en)
        out.append(f"fair-lookahead h{h}={x['win']:.2f}(ko {x['ko']:.2f}, ticks {x['ticks']})")
    print(f"enemy_regen={er}", *out, flush=True)

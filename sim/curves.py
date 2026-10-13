import sys, game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1])
for curve in ("linear","convex","steep","concave"):
    for wounds in (False, True):
        game.set_curve(curve)
        r = Rules(lane_len=3, regen=2, start_elixir=5, max_ticks=60, wounds=wounds)
        row=[f"{run(MCBot(h), r, n=n)['win']:.2f}" for h in (0,2,4,6,8)]
        rnd=run(RandomBot(), r, n=n*2)['win']; heu=run(HeavyBot(4), r, n=n*2)['win']
        print(f"{curve:8s} wounds={wounds!s:5s} mc by h[0,2,4,6,8]={row}  random={rnd:.2f} heuristic={heu:.2f}", flush=True)

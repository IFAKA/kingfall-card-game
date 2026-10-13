import sys, game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1])
for curve in ("linear","convex"):
  game.set_curve(curve)
  for er in (2,3):
    r = Rules(lane_len=3, regen=2, enemy_regen=er, start_elixir=5, max_ticks=60, wounds=True)
    en = HeavyBot(4)   # enemy now drafts a balanced heavy deck
    row=[f"{run(MCBot(h), r, n=n, enemy=en)['win']:.2f}" for h in (0,2,4,6,8)]
    rnd=run(RandomBot(), r, n=n*2, enemy=en)['win']; heu=run(HeavyBot(4), r, n=n*2, enemy=en)['win']
    print(f"{curve:7s} enemy_regen={er} mc by h[0,2,4,6,8]={row} random={rnd:.2f} heuristic={heu:.2f}", flush=True)

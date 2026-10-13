import sys, game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1])
game.set_curve("linear")
en=RandomBot()
for phys in (False, True):
    for er in (4,5,6):
        r = Rules(lane_len=2, regen=3, enemy_regen=er, start_elixir=5, max_ticks=200, wheel=3, physical=phys)
        a=run(RandomBot(), r, n=n*2, enemy=en); b=run(HeavyBot(4), r, n=n*2, enemy=en); c=run(MCBot(4), r, n=n, enemy=en)
        print(f"physical={phys!s:5s} enemy_regen={er}: random {a['win']:.2f} heuristic {b['win']:.2f} MC {c['win']:.2f} | MC ko {c['ko']:.2f} ticks {c['ticks']}", flush=True)

import sys, game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1])
game.set_curve("linear")
en=RandomBot()
for er in (5,6):
    r = Rules(lane_len=2, regen=3, enemy_regen=er, start_elixir=5, max_ticks=200, wheel=3)
    print("enemy regen", er, "MC win by # of high cards in deck (rest are the lowest):",
          [f"h{h}={run(MCBot(h), r, n=n, enemy=en)['win']:.2f}" for h in range(0,9)], flush=True)

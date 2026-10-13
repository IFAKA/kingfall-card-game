import sys, itertools, game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1])
game.set_curve("linear")
en=RandomBot()
print("lane regen enemy squeeze | random heuristic perfect-info-MC | ko ticks")
for lane, (rg, er), sq in itertools.product((2,3), ((2,3),(3,4),(3,5)), (False, True)):
    r = Rules(lane_len=lane, regen=rg, enemy_regen=er, start_elixir=5, max_ticks=200, squeeze=sq)
    a=run(RandomBot(), r, n=n*2, enemy=en)['win']; b=run(HeavyBot(4), r, n=n*2, enemy=en)['win']; c=run(MCBot(4), r, n=n, enemy=en)
    print(f"{lane}   {rg}    {er}     {sq!s:5s}   | {a:.2f}   {b:.2f}      {c['win']:.2f}   | {c['ko']:.2f} {c['ticks']}", flush=True)

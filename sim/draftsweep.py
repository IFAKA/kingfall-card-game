import sys
from game import Rules
from stats import run
from bots import *
from mc import MCBot
n=int(sys.argv[1])
for label, kw in [("no-wounds", {}), ("wounds", dict(wounds=True))]:
    r = Rules(lane_len=3, regen=2, start_elixir=5, max_ticks=60, **kw)
    print(label)
    print("  random", run(RandomBot(), r, n=n)['win'])
    for h in (0,2,4,6,8):
        print("  heuristic h",h, run(HeavyBot(h), r, n=n)['win'], " mc(perfect info) ", run(MCBot(h), r, n=n//2)['win'], flush=True)

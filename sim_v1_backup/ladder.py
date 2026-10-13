import random
from game import Rules
from stats import run
from bots import *
r = Rules(lane_len=3, regen=2, start_elixir=5, max_ticks=60)
for b in (RandomBot(), HeavyBot(4,"greedy"), HeavyBot(4), Smart2(4,punish=False,cycle=False), Smart2(4,cycle=False), Smart2(4), Smart2(6), Smart2(2)):
    print(b.name, run(b, r, n=1500))

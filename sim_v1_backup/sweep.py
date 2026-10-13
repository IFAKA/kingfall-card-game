from stats import run
from game import Rules
from bots import RandomBot, HeavyBot
import itertools
rows=[]
for lane, regen, start, split in itertools.product((3,4), (2,3), (5,8), ((3,3,2),(2,2,2))):
    r = Rules(lane_len=lane, regen=regen, start_elixir=start, tower_split=split, max_ticks=60)
    a = run(RandomBot(), r, n=600); b = run(HeavyBot(4), r, n=600)
    print(f"lane{lane} regen{regen} start{start} split{split}: random {a['win']} smart {b['win']} ko {b['ko']} ticks {b['ticks']}")

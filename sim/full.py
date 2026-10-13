import game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
game.set_curve("linear")
en=RandomBot()
for grp in (0,2):
  for er in (4,5,6):
    r=Rules(lane_len=2,regen=3,enemy_regen=er,start_elixir=5,max_ticks=200,wheel=3,physical=True,rotate_fail=True,group=grp)
    a=run(RandomBot(),r,n=600,enemy=en,seed=11); b=run(HeavyBot(4),r,n=600,enemy=en,seed=11); c=run(MCBot(3),r,n=200,enemy=en,seed=11)
    print(f"group={grp} enemy_regen={er} random {a['win']} (ko {a['ko']}, ticks {a['ticks']}) heur {b['win']} (ko {b['ko']}) look {c['win']} (ko {c['ko']}, ticks {c['ticks']})",flush=True)

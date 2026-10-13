import game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
game.set_curve("linear")
en=RandomBot()
for rot in (0,1,2):  # rot = group fight
    r=Rules(lane_len=2,regen=3,enemy_regen=5,start_elixir=5,max_ticks=200,wheel=3,physical=True,rotate_fail=True,group=rot)
    print("group",rot,"random %.2f heur %.2f look %.2f"%(run(RandomBot(),r,n=300,enemy=en)['win'],run(HeavyBot(4),r,n=300,enemy=en)['win'],run(MCBot(3),r,n=150,enemy=en)['win']),flush=True)

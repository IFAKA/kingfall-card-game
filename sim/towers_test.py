import game
from game import Rules
from stats import run
from bots import *
from mc import MCBot
game.set_curve("linear")
en=RandomBot()
r = Rules(lane_len=2, regen=3, enemy_regen=5, start_elixir=5, max_ticks=200, wheel=3, physical=True)
for order in ("random","high_top","king_high","king_low"):
    class B(MCBot):
        def __init__(s): super().__init__(3); s.tower_order=order; s.name="mc-"+order
    class H(HeavyBot):
        pass
    h=run(HeavyBot(3,"smart",order), r, n=600, enemy=en)['win']
    m=run(B(), r, n=200, enemy=en)['win']
    print(f"tower arrangement {order:10s}: heuristic {h:.2f}  lookahead {m:.2f}", flush=True)

import random, game
from game import *
from stats import run
from bots import *
from mc import MCBot
game.set_curve("linear")
en=RandomBot()
r = Rules(lane_len=2, regen=3, enemy_regen=5, start_elixir=5, max_ticks=200, wheel=3, physical=True)
print("deck curve (physical, enemy 5):", [f"h{h}={run(MCBot(h), r, n=200, enemy=en)['win']:.2f}" for h in range(0,9)], flush=True)

# handling per game: card placements, fights, tower hits per game
orig_play = Game.play; orig_kill = Game.kill
cnt = {"play":0, "kill":0}
def p(self,*a,**k): cnt["play"]+=1; return orig_play(self,*a,**k)
def k(self,*a,**kw): cnt["kill"]+=1; return orig_kill(self,*a,**kw)
Game.play=p; Game.kill=k
rng=random.Random(11); N=150; tk=0; res=[]
bot=MCBot(3)
for _ in range(N):
    w,t = play_match(rng, bot, en, r); tk+=t; res.append(w)
print("per game (lookahead bot): ticks %.1f, card placements %.1f (both sides), units removed %.1f, win %.2f" % (tk/N, cnt["play"]/N, cnt["kill"]/N, sum(res)/N))
cnt["play"]=cnt["kill"]=0; tk=0
bot=HeavyBot(4)
for _ in range(N):
    w,t = play_match(rng, bot, en, r); tk+=t
print("per game (heuristic bot):  ticks %.1f, card placements %.1f, units removed %.1f" % (tk/N, cnt["play"]/N, cnt["kill"]/N))

import random, sys
from game import *
from bots import RandomBot, HeavyBot
import game

def run(bot, rules, n=1500, seed=3, enemy=None):
    rng = random.Random(seed)
    en = enemy or RandomBot()
    ko = to = 0; w = 0.0; dmg = 0; ticks=0
    for _ in range(n):
        pd, pt, ed, et = deal_and_draft(rng, bot, en, rules)
        g = Game(rules, pd, pt, ed, et)
        res = None
        for t in range(rules.max_ticks):
            g.tick = t; g.regen(); bot.act(g, rng); enemy_act(g); g.step_world()
            res = g.winner()
            if res is not None: ko += 1; break
        if res is None:
            res = g.timeout_result(); to += 1
        w += res; ticks += t
        dmg += 8 - g.tower_total(E)
    return dict(win=round(w/n,3), ko=round(ko/n,3), avg_enemy_cards_lost=round(dmg/n,2), ticks=round(ticks/n,1))

if __name__ == "__main__":
    base = Rules()
    for label, kw in [("base", {}), ("regen2", dict(regen=2)), ("no_geq", dict(tower_needs_geq=False)),
                      ("lane4", dict(lane_len=4)), ("lane4+regen2", dict(lane_len=4, regen=2)),
                      ("lane4+nogeq", dict(lane_len=4, tower_needs_geq=False)),
                      ("lane4+regen2+nogeq", dict(lane_len=4, regen=2, tower_needs_geq=False))]:
        r = Rules(**kw)
        print(label)
        for b in (RandomBot(), HeavyBot(4)):
            print("  ", b.name, run(b, r))

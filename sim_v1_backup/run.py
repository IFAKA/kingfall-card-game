import random, sys
from game import Rules, play_match
from bots import RandomBot, HeavyBot


def evaluate(p_bot, rules, n=2000, seed=1):
    rng = random.Random(seed)
    enemy = RandomBot()
    w = 0.0
    ticks = 0
    for _ in range(n):
        r, t = play_match(rng, p_bot, enemy, rules)
        w += r
        ticks += t
    return w / n, ticks / n


if __name__ == "__main__":
    rules = Rules()
    print("rules", rules)
    for bot in [RandomBot()] + [HeavyBot(h, "greedy") for h in (0, 4, 8)] + [HeavyBot(h) for h in range(0, 9, 2)]:
        wr, t = evaluate(bot, rules)
        print(f"{bot.name:14s} winrate={wr:.3f} avg_ticks={t:.1f}")

import random
from game import cost, P, E


def split_towers(cards, rules, order="random", rng=None):
    ranks = [c[0] for c in cards]
    if order == "random":
        rng.shuffle(ranks)
    elif order == "high_top":
        ranks.sort(reverse=True)
    elif order == "low_top":
        ranks.sort()
    nl, nr, nk = rules.tower_split
    # king gets the highest cards when smart, else whatever order says
    L, R, K = ranks[:nl], ranks[nl:nl + nr], ranks[nl + nr:]
    return {'L': L, 'R': R, 'K': K}


class RandomBot:
    name = "random"

    def draft(self, cards16, rules, rng):
        c = list(cards16)
        rng.shuffle(c)
        return c[:8], split_towers(c[8:], rules, "random", rng)

    def act(self, g, rng):
        if rng.random() < 0.5:
            return
        s = g.side[P]
        ok = [i for i in range(len(s.hand)) if g.can_play(P, i)]
        if ok:
            g.play(P, rng.choice(ok), rng.randint(0, 1))


class HeavyBot:
    """Parametrised draft + simple tactical play. heavy = how many of the top cards go in the deck."""

    def __init__(self, heavy=4, tactics="smart", tower_order="high_top"):
        self.heavy = heavy
        self.tactics = tactics
        self.tower_order = tower_order
        self.name = f"{tactics}-h{heavy}"

    def draft(self, cards16, rules, rng):
        c = sorted(cards16, key=lambda x: x[0])
        h = self.heavy
        lowcount = 8 - h
        deck = c[len(c) - h:] + c[:lowcount] if h else c[:8]
        # keep a middle spread instead of extremes: take evenly spaced when h is None
        rest = [x for x in c if x not in deck]
        deck = list(deck)
        rng.shuffle(deck)
        return deck, split_towers(rest, rules, self.tower_order, rng)

    def act(self, g, rng):
        s = g.side[P]
        if self.tactics == "greedy":
            while True:
                ok = [i for i in range(len(s.hand)) if g.can_play(P, i)]
                if not ok:
                    return
                i = max(ok, key=lambda i: s.hand[i][0])
                lane = 0 if len([u for u in g.units if u.side == P and u.lane == 0]) <= len(
                    [u for u in g.units if u.side == P and u.lane == 1]) else 1
                g.play(P, i, lane)
        else:
            self.smart(g, rng)

    def smart(self, g, rng):
        s = g.side[P]
        L = g.r.lane_len
        for _ in range(4):
            # threats: enemy units not yet answered by a stronger friendly unit in the lane
            best = None
            for lane in (0, 1):
                es = [u for u in g.units if u.side == E and u.lane == lane]
                ps = [u for u in g.units if u.side == P and u.lane == lane]
                if not es:
                    continue
                front = min(es, key=lambda u: u.pos)
                guard = max([u.rank for u in ps if u.pos < front.pos] or [0])
                if guard > front.rank:
                    continue
                ok = [i for i in range(len(s.hand)) if g.can_play(P, i) and (g.eff(s.hand[i][0], s.hand[i][1], front.rank, front.suit) > g.eff(front.rank, front.suit, s.hand[i][0], s.hand[i][1]) or (g.r.roles and s.hand[i][1] == 3 and s.hand[i][0] >= front.rank))]
                if not ok:
                    continue
                i = min(ok, key=lambda i: cost(s.hand[i][0]))
                urgency = L - front.pos if False else front.pos  # closer to our side = lower pos
                key = (urgency, cost(s.hand[i][0]))
                if best is None or key < best[0]:
                    best = (key, i, lane)
            if best:
                g.play(P, best[1], best[2])
                continue
            # counter-push or bank: only spend when near cap
            if s.elixir >= g.r.cap - 1:
                ok = [i for i in range(len(s.hand)) if g.can_play(P, i) and not (g.r.roles and s.hand[i][1] in (1, 3))]
                if ok:
                    i = max(ok, key=lambda i: s.hand[i][0])
                    mine = [sum(u.rank for u in g.units if u.side == P and u.lane == l) for l in (0, 1)]
                    lane = 0 if mine[0] >= mine[1] else 1
                    g.play(P, i, lane)
                    continue
            return


class Smart2(HeavyBot):
    """Adds the Clash-style reads: punish low enemy elixir, hold elixir when the known next enemy card is big."""

    def __init__(self, heavy=4, punish=True, cycle=True, hold=True):
        super().__init__(heavy, "smart")
        self.punish, self.cycle, self.hold = punish, cycle, hold
        self.name = f"smart2-h{heavy}" + ("" if punish else "-nopunish") + ("" if cycle else "-nocycle")

    def act(self, g, rng):
        s, e = g.side[P], g.side[E]
        # 1. efficient answers to present threats (same as smart)
        self.smart(g, rng)
        # 2. read the enemy cycle: after one lap the next enemy card is known
        nxt = None
        if self.cycle and len(g.seen_enemy) >= 8:
            nxt = g.seen_enemy[-8]
        else:
            nxt = None
        # 3. punish: enemy is low on elixir, so a push is safe
        if self.punish:
            can_next = nxt is not None and cost(nxt[0]) <= e.elixir + g.r.regen
            lowE = e.elixir <= 3 if nxt is None else not can_next
            if lowE and s.elixir >= 6:
                ok = [i for i in range(len(s.hand)) if g.can_play(P, i)]
                if ok:
                    # best value: highest rank per cost
                    i = max(ok, key=lambda i: (s.hand[i][0] / max(1, cost(s.hand[i][0])), s.hand[i][0]))
                    cnt = [len([u for u in g.units if u.side == E and u.lane == l]) for l in (0, 1)]
                    lane = 0 if cnt[0] <= cnt[1] else 1
                    g.play(P, i, lane)


class RoleBot(HeavyBot):
    """Draft by target suit counts (soldier, guard, charger, spell), highest ranks within each suit."""

    def __init__(self, target, tactics="smart"):
        super().__init__(4, tactics)
        self.target = target
        self.name = "roles" + "".join(map(str, target))

    def draft(self, cards16, rules, rng):
        by = {s: sorted([c for c in cards16 if c[1] == s], key=lambda c: -c[0]) for s in range(4)}
        deck = []
        for s in range(4):
            deck += by[s][:self.target[s]]
        rest = sorted([c for c in cards16 if c not in deck], key=lambda c: -c[0])
        deck += rest[:8 - len(deck)]
        deck = deck[:8]
        towers = [c for c in cards16 if c not in deck]
        rng.shuffle(deck)
        return deck, split_towers(towers, rules, self.tower_order, rng)

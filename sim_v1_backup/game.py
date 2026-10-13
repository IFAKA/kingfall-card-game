"""Lane-push duel on a standard 52-card deck. Rules as parameters so they can be tuned."""
import random
from dataclasses import dataclass, field

P, E = 0, 1


@dataclass
class Rules:
    lane_len: int = 6        # slots per lane; units spawn at the ends
    start_elixir: int = 5
    regen: int = 1           # elixir cards flipped up per tick
    max_ticks: int = 80
    cap: int = 10
    tower_split: tuple = (3, 3, 2)   # left princess, right princess, king
    survivor_keeps: bool = True      # winner of a fight stays on the table
    tower_needs_geq: bool = True     # unit must be >= tower top card to remove it
    wheel: int = 0                   # suit wheel bonus: suit i beats suit (i+1)%4, +wheel rank in fights
    roles: bool = False              # suit roles: 0 soldier, 1 guard(static), 2 charger(x2 move), 3 spell
    squeeze: bool = False            # each enemy deck lap removes one card from the player's elixir bar
    squeeze_min: int = 4
    enemy_lane_by_rank: bool = False  # False = count of player units (table-friendly)
    enemy_regen: int = 0             # 0 = same as regen
    wounds: bool = False             # winner is wounded if loser rank*2 >= winner rank; wounded winner dies


CURVES = {
    # rank 1..13 -> elixir cost
    "linear": lambda r: int(r * 10 / 13 + 0.5),
    "convex": lambda r: max(1, int((r / 13) ** 1.7 * 10 + 0.5)),
    "steep": lambda r: max(1, int((r / 13) ** 2.4 * 10 + 0.5)),
    "concave": lambda r: max(1, int((r / 13) ** 0.7 * 10 + 0.5)),
}
_curve = CURVES["linear"]


def set_curve(name):
    global _curve
    _curve = CURVES[name]


def cost(rank, rules=None):
    return _curve(rank)


@dataclass
class Unit:
    rank: int
    suit: int
    side: int
    lane: int
    pos: int
    wounded: bool = False


@dataclass
class Side:
    queue: list          # cycle: 4 in hand + rest in queue
    towers: dict         # 'L','R','K' -> list of ranks, index 0 is the top
    elixir: int
    hand: list = field(default_factory=list)

    def deal(self):
        self.hand = self.queue[:4]
        self.queue = self.queue[4:]


class Game:
    def __init__(self, rules, p_deck, p_towers, e_deck, e_towers):
        self.r = rules
        self.units = []
        self.tick = 0
        self.side = [
            Side(list(p_deck), p_towers, rules.start_elixir),
            Side(list(e_deck), e_towers, rules.start_elixir),
        ]
        for s in self.side:
            s.deal()
        self.seen_enemy = []   # enemy cards revealed so far, in order
        self.enemy_plays = 0
        self.cap = [rules.cap, rules.cap]
        self.revealed = {'L': False, 'R': False, 'K': False}   # enemy tower tops flipped face-up

    # ---- actions
    def can_play(self, side, i):
        c = self.side[side].hand[i]
        return cost(c[0]) <= self.side[side].elixir

    def play(self, side, i, lane):
        s = self.side[side]
        c = s.hand[i]
        s.elixir -= cost(c[0])
        spawn = 0 if side == P else self.r.lane_len - 1
        if self.r.roles and c[1] == 3:
            foes = [u for u in self.units if u.side != side and u.lane == lane and u.rank <= c[0]]
            if foes:
                tgt = (max if side == E else min)(foes, key=lambda u: u.pos)
                # spells hit the unit nearest the caster's tower
                front = (max if side == E else min)([u for u in self.units if u.side != side and u.lane == lane], key=lambda u: u.pos)
                if tgt is front:
                    self.units.remove(tgt)
        else:
            self.units.append(Unit(c[0], c[1], side, lane, spawn))
        s.hand.pop(i)
        s.hand.append(s.queue.pop(0))
        s.queue.append(c)
        if side == E:
            self.seen_enemy.append(c)
            self.enemy_plays += 1
            if self.r.squeeze and self.enemy_plays % 8 == 0:
                self.cap[P] = max(self.r.squeeze_min, self.cap[P] - 1)
                self.side[P].elixir = min(self.side[P].elixir, self.cap[P])

    # ---- world
    def step_world(self):
        for u in self.units:
            if self.r.roles and u.suit == 1:
                continue            # guards stay put
            u.pos += 1 if u.side == P else -1
        for lane in (0, 1):
            self.fight(lane)
        if self.r.roles:
            for u in self.units:
                if u.suit == 2:
                    u.pos += 1 if u.side == P else -1
            for lane in (0, 1):
                self.fight(lane)
        self.tower_hits()

    def eff(self, rank, suit, orank, osuit):
        return rank + (self.r.wheel if self.r.wheel and osuit == (suit + 1) % 4 else 0)

    def fight(self, lane):
        while True:
            ps = [u for u in self.units if u.lane == lane and u.side == P]
            es = [u for u in self.units if u.lane == lane and u.side == E]
            if not ps or not es:
                return
            p = max(ps, key=lambda u: u.pos)
            e = min(es, key=lambda u: u.pos)
            if p.pos < e.pos:
                return
            pe, ee = self.eff(p.rank, p.suit, e.rank, e.suit), self.eff(e.rank, e.suit, p.rank, p.suit)
            if pe == ee:
                self.units.remove(p)
                self.units.remove(e)
            else:
                win, lose = (p, e) if pe > ee else (e, p)
                self.units.remove(lose)
                if not self.r.survivor_keeps:
                    self.units.remove(win)

    def tower_hits(self):
        for u in list(self.units):
            reached = (u.side == P and u.pos >= self.r.lane_len) or (u.side == E and u.pos < 0)
            if not reached:
                continue
            tgt = self.side[1 - u.side].towers
            key = 'L' if u.lane == 0 else 'R'
            stack = tgt[key] if tgt[key] else tgt['K']
            self.units.remove(u)
            k = key if tgt[key] else 'K'
            if u.side == P and stack:
                self.revealed[k] = True
            if stack and (u.rank >= stack[0] or not self.r.tower_needs_geq):
                stack.pop(0)
                if u.side == P:
                    self.revealed[k] = False

    # ---- tick
    def regen(self):
        for i, s in enumerate(self.side):
            rg = self.r.regen if (i == P or not self.r.enemy_regen) else self.r.enemy_regen
            s.elixir = min(self.cap[i], s.elixir + rg)

    def winner(self):
        pk, ek = not self.side[P].towers['K'], not self.side[E].towers['K']
        if pk and ek:
            return 0.5
        if ek:
            return 1.0
        if pk:
            return 0.0
        return None

    def tower_total(self, side):
        return sum(len(v) for v in self.side[side].towers.values())

    def timeout_result(self):
        a, b = self.tower_total(P), self.tower_total(E)
        return 1.0 if a > b else 0.0 if a < b else 0.5


def enemy_act(g):
    """Fixed, learnable rule: play the next hand card in cycle order if affordable,
    into the lane where the player has the least rank on the table."""
    s = g.side[E]
    while True:
        # cycle order == hand[0] is always the oldest card
        if not s.hand or cost(s.hand[0][0]) > s.elixir:
            return
        c = s.hand[0]
        if g.r.roles and c[1] == 3:
            fronts = []
            for l in (0, 1):
                pl = [u for u in g.units if u.side == P and u.lane == l]
                if pl:
                    f = max(pl, key=lambda u: u.pos)
                    if f.rank <= c[0]:
                        fronts.append(f)
            tg = fronts
            if not tg:
                # no target: spell is skipped to the back of the cycle for free
                s.hand.pop(0); s.hand.append(s.queue.pop(0)); s.queue.append(c)
                g.seen_enemy.append(c); g.enemy_plays += 1
                continue
            u = max(tg, key=lambda u: u.pos)
            g.play(E, 0, u.lane)
            continue
        threat = [0, 0]
        for u in g.units:
            if u.side == P:
                threat[u.lane] += (u.rank if g.r.enemy_lane_by_rank else 1)
        lane = 0 if threat[0] <= threat[1] else 1
        g.play(E, 0, lane)


def deal_and_draft(rng, p_bot, e_bot, rules):
    deck = [(r, s) for r in range(1, 14) for s in range(4)]
    rng.shuffle(deck)
    # 16 each, 20 left over are the elixir bars (not modelled as cards)
    p16, e16 = deck[:16], deck[16:32]
    pd, pt = p_bot.draft(p16, rules, rng)
    ed, et = e_bot.draft(e16, rules, rng)
    return pd, pt, ed, et


def play_match(rng, p_bot, e_bot, rules):
    pd, pt, ed, et = deal_and_draft(rng, p_bot, e_bot, rules)
    g = Game(rules, pd, pt, ed, et)
    for t in range(rules.max_ticks):
        g.tick = t
        g.regen()
        p_bot.act(g, rng)
        enemy_act(g)
        g.step_world()
        w = g.winner()
        if w is not None:
            return w, t
    return g.timeout_result(), rules.max_ticks

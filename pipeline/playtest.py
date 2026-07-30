"""Bot playtests over real cards — measures how binding the bankroll actually is.

Two bots draft 8 slots from 8 random team-season cards (one card per slot,
matching the spin structure with owner/stadium spins removed):

  war-greedy   ignores cost entirely, takes the best WAR every time
  cost-aware   same, but never signs a player it can't afford

If war-greedy routinely lands under the league-average bankroll ($160M), the
budget never binds and the game is too easy. Run: uv run python -m pipeline.playtest
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from statistics import mean, quantiles

DATA = Path(__file__).resolve().parent.parent / "data"
SLOT_ORDER = ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"]
AVG_BUDGET = 112.1  # league-average top-4-contract bankroll, display $M
MONEYBALL_BUDGET = 82.9  # 2002 OAK top-4 bankroll


def eligible(slot: str, p: dict) -> bool:
    pitcher = p["pos"].startswith(("SP", "RP")) or p["pos"] == "P"
    two_way = "/" in p["pos"]
    if slot == "C":
        return p["posG"]["c"] >= 10
    if slot == "IF":
        return p["posG"]["if"] >= 10
    if slot == "OF":
        return p["posG"]["of"] >= 10
    if slot == "FLEX":
        return two_way or not pitcher
    if slot == "SP":
        return p["pos"].startswith("SP")
    return p["pos"] == "RP"


def draft(cards: list[dict], budget: float | None) -> tuple[float, float, int]:
    """Returns (total WAR, total cost, count of sub-$5M 'bargain' signings)."""
    war = cost = 0.0
    bargains = 0
    for slot, card in zip(SLOT_ORDER, cards):
        pool = [p for p in card["players"] if eligible(slot, p)]
        if budget is not None:
            pool = [p for p in pool if cost + p["cost"] <= budget]
        if not pool:
            continue
        pick = max(pool, key=lambda p: p["war"])
        war += pick["war"]
        cost += pick["cost"]
        bargains += pick["cost"] < 5.0
    return war, cost, bargains


def main() -> None:
    all_cards = [json.loads(p.read_text()) for p in sorted((DATA / "cards").glob("*.json"))]
    rng = random.Random(1905)
    trials = 5000

    greedy_war, greedy_cost, greedy_bargains, under = [], [], [], 0
    aware_war = []
    for _ in range(trials):
        cards = rng.sample(all_cards, len(SLOT_ORDER))
        w, c, b = draft(cards, budget=None)
        greedy_war.append(w)
        greedy_cost.append(c)
        greedy_bargains.append(b)
        under += c <= AVG_BUDGET
        aware_war.append(draft(cards, budget=MONEYBALL_BUDGET)[0])

    q_cost = quantiles(greedy_cost, n=10)
    q_war = quantiles(greedy_war, n=10)
    print(f"war-greedy (cost-blind), {trials} drafts:")
    print(f"  WAR    mean {mean(greedy_war):5.1f}   p10 {q_war[0]:5.1f}   p50 {q_war[4]:5.1f}   p90 {q_war[8]:5.1f}")
    print(f"  cost   mean ${mean(greedy_cost):5.1f}M  p10 ${q_cost[0]:5.1f}M  p50 ${q_cost[4]:5.1f}M  p90 ${q_cost[8]:5.1f}M")
    print(f"  under avg budget (${AVG_BUDGET}M) while ignoring cost: {100 * under / trials:.0f}%")
    print(f"  bargain (<$5M) signings per 8-man draft: {mean(greedy_bargains):.1f}")
    print(f"\ncost-aware at moneyball budget (${MONEYBALL_BUDGET}M):")
    print(f"  WAR mean {mean(aware_war):.1f}  (greedy gap: {mean(greedy_war) - mean(aware_war):.1f} WAR)")


if __name__ == "__main__":
    main()

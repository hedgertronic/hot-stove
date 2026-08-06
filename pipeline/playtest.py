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

from pipeline import scoring

DATA = Path(__file__).resolve().parent.parent / "data"
SLOT_ORDER = ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"]
AVG_BUDGET = 76.4  # league-average bankroll after widening + scaling, display $M
MONEYBALL_BUDGET = 51.5  # 2002 OAK top-4 bankroll (widened + scaled)


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


def draft(cards: list[dict], budget: float | None) -> list[dict]:
    """Returns the drafted players (one best-WAR pick per slot, if any fit)."""
    picks: list[dict] = []
    cost = 0.0
    for slot, card in zip(SLOT_ORDER, cards):
        pool = [p for p in card["players"] if eligible(slot, p)]
        if budget is not None:
            pool = [p for p in pool if cost + p["cost"] <= budget]
        if not pool:
            continue
        pick = max(pool, key=lambda p: p["war"])
        picks.append(pick)
        cost += pick["cost"]
    return picks


def total_score(picks: list[dict], budget: float) -> float:
    """Full game score for a drafted roster (no manager hire, no scout hits)."""
    return scoring.score(
        total_war=sum(p["war"] for p in picks),
        spend_m=sum(p["cost"] for p in picks),
        budget_m=budget,
        award_lists=[p["awards"] for p in picks],
        rings=sum(p["ws"] for p in picks),
        pennants=sum(p["pen"] for p in picks),
        # IDs, never POINTS: the card field is a discriminant (2 gold /
        # 1 silver). Comparing against the point values happened to work at
        # round 5's 2/1 pricing and silently counted zero medals for every
        # retune since.
        wbc_champions=sum(
            p.get("wbc") == scoring.WBC_CHAMPION_ID for p in picks),
        wbc_runners_up=sum(
            p.get("wbc") == scoring.WBC_RUNNERUP_ID for p in picks),
    )["total"]


def wbc_points(picks: list[dict]) -> int:
    """Ring-chasing points a roster draws from the Classic alone.

    The card field is a DISCRIMINANT (2 gold / 1 silver), not a price — it is
    mapped through the scoring constants here, the same multiplication the
    game performs. Summing the raw field only measured points while round 5's
    2/1 pricing made the two scales coincide. `.get` because the field is
    sparse: it is present only on the player-seasons that medaled.
    """
    return sum(
        scoring.WBC_CHAMPION_POINTS if p.get("wbc") == scoring.WBC_CHAMPION_ID
        else scoring.WBC_RUNNERUP_POINTS if p.get("wbc") == scoring.WBC_RUNNERUP_ID
        else 0
        for p in picks)


def main() -> None:
    all_cards = [json.loads(p.read_text()) for p in sorted((DATA / "cards").glob("*.json"))]
    rng = random.Random(1905)
    trials = 5000

    greedy_war, greedy_cost, greedy_bargains, under = [], [], [], 0
    greedy_total, aware_war, aware_total = [], [], []
    # Classic exposure, three numbers because they answer three questions.
    # `offers` is how many of the 8 spins land on a card that has a medalist
    # in the slot at all — the chance the axis is even on the table. `landings`
    # and `pts` are what the cost-blind bot actually takes, and it is not
    # chasing medals: it takes the best WAR in the slot and collects a medal
    # only by accident. `chase` is the other end, the most a player who always
    # preferred the biggest medal in the slot could bank — the ceiling on how
    # far this axis can tilt a game.
    wbc_offers, wbc_landings, wbc_pts, wbc_chase = [], [], [], []
    for _ in range(trials):
        cards = rng.sample(all_cards, len(SLOT_ORDER))
        picks = draft(cards, budget=None)
        w = sum(p["war"] for p in picks)
        c = sum(p["cost"] for p in picks)
        greedy_war.append(w)
        greedy_cost.append(c)
        greedy_bargains.append(sum(p["cost"] < 5.0 for p in picks))
        under += c <= AVG_BUDGET
        greedy_total.append(total_score(picks, AVG_BUDGET))
        wbc_landings.append(sum("wbc" in p for p in picks))
        wbc_pts.append(wbc_points(picks))
        best = [max((p.get("wbc", 0) for p in card["players"] if eligible(slot, p)),
                    default=0)
                for slot, card in zip(SLOT_ORDER, cards)]
        wbc_offers.append(sum(b > 0 for b in best))
        wbc_chase.append(sum(best))
        aware = draft(cards, budget=MONEYBALL_BUDGET)
        aware_war.append(sum(p["war"] for p in aware))
        aware_total.append(total_score(aware, MONEYBALL_BUDGET))

    q_cost = quantiles(greedy_cost, n=10)
    q_war = quantiles(greedy_war, n=10)
    print(f"war-greedy (cost-blind), {trials} drafts:")
    print(f"  WAR    mean {mean(greedy_war):5.1f}   p10 {q_war[0]:5.1f}   p50 {q_war[4]:5.1f}   p90 {q_war[8]:5.1f}")
    print(f"  cost   mean ${mean(greedy_cost):5.1f}M  p10 ${q_cost[0]:5.1f}M  p50 ${q_cost[4]:5.1f}M  p90 ${q_cost[8]:5.1f}M")
    print(f"  under avg budget (${AVG_BUDGET}M) while ignoring cost: {100 * under / trials:.0f}%")
    print(f"  bargain (<$5M) signings per 8-man draft: {mean(greedy_bargains):.1f}")
    any_wbc = 100 * sum(n > 0 for n in wbc_landings) / trials
    any_offer = 100 * sum(n > 0 for n in wbc_offers) / trials
    print(f"  WBC medalists offered per 8-spin draft: {mean(wbc_offers):.2f} slots  "
          f"({any_offer:.0f}% of drafts see at least one)")
    print(f"  WBC medalists signed per 8-man draft: {mean(wbc_landings):.2f}  "
          f"({any_wbc:.0f}% of drafts sign at least one)")
    print(f"  WBC ring-chasing points per draft: {mean(wbc_pts):.2f}  "
          f"(max seen {max(wbc_pts)})")
    print(f"  ceiling if every spin took the biggest medal on offer: "
          f"{mean(wbc_chase):.2f} pts  (max seen {max(wbc_chase)})")
    print(f"\ncost-aware at moneyball budget (${MONEYBALL_BUDGET}M):")
    print(f"  WAR mean {mean(aware_war):.1f}  (greedy gap: {mean(greedy_war) - mean(aware_war):.1f} WAR)")

    # Total game score (no manager hire, no scout hits) vs the 162-point
    # stretch goal. Greedy is scored against the avg bankroll (its overspend
    # becomes luxury tax); aware against the budget it drafted under.
    for label, totals in (("war-greedy vs avg budget", greedy_total),
                          ("cost-aware vs moneyball budget", aware_total)):
        q = quantiles(totals, n=10)
        clear = 100 * sum(t >= 162 for t in totals) / trials
        print(f"\ntotal score, {label}:")
        print(f"  mean {mean(totals):5.1f}   p10 {q[0]:5.1f}   p50 {q[4]:5.1f}   "
              f"p90 {q[8]:5.1f}   >=162: {clear:.1f}%")


if __name__ == "__main__":
    main()

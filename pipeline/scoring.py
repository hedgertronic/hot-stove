"""Reference scoring implementation — the single source of truth for game math.

The frontend ports these functions to JS; this module exists so balance changes
can be playtested in Python against real cards before touching UI code.
All dollar amounts are normalized display millions (league-avg slot-8 = $160M).
"""

from __future__ import annotations

REPLACEMENT_WINS = 47.7
GAMES = 162

# MVP2/CY2 are award-vote runners-up (finished 2nd on their league's ballot).
AWARD_POINTS = {"MVP": 5, "CY": 4, "MVP2": 2, "CY2": 2, "ROY": 2, "GG": 1, "SS": 1}
RING_POINTS = 2      # per player whose team won the World Series that season
PENNANT_POINTS = 1   # per player whose team won the pennant but lost the Series
SKIPPER_PER_NET_WIN = 0.1  # hired manager: (team W - team L) x this, negative allowed
SCOUT_HIT_POINTS = 1.0  # per drafted player who's in the WAR-optimal roster

LUXURY_TAX_PER_M = 1.0
BUDGET_BONUS_MAX = 10.0


def expected_wins(total_war: float) -> float:
    return min(REPLACEMENT_WINS + total_war, GAMES)


def luxury_tax(spend_m: float, budget_m: float) -> float:
    return max(0.0, spend_m - budget_m) * LUXURY_TAX_PER_M


def budget_bonus(spend_m: float, budget_m: float) -> float:
    """Front-office bonus: Price-is-Right with teeth.

    Linear from -10 (empty payroll) through 0 (half the cap) to +10 (right at
    the cap); 0 when over (the luxury tax takes it from there). Drastically
    underusing the bankroll COSTS points — an all-cheap-stars team on a rich
    owner leaves real score on the table.

    DESIGN KNOB — counterweight to the pre-arb-superstar exploit (2012 Trout:
    $510K, 10.5 WAR). Playtest alternatives: convex near the cap, or a flat
    dead zone between 70-100%.
    """
    if spend_m > budget_m or budget_m <= 0:
        return 0.0
    return BUDGET_BONUS_MAX * (2 * spend_m / budget_m - 1)


def award_points(award_lists: list[list[str]]) -> int:
    return sum(AWARD_POINTS.get(code, 0) for awards in award_lists for code in awards)


def display_record(exp_wins: float) -> tuple[int, int]:
    """Displayed record: expected wins, rounded.

    Deliberately deterministic — the headline W-L must match the
    "Expected wins" ledger row exactly (a simulated record read as a bug:
    it never reconciled with the visible math).
    """
    wins = round(exp_wins)
    return wins, GAMES - wins


def score(
    total_war: float,
    spend_m: float,
    budget_m: float,
    award_lists: list[list[str]],
    rings: int = 0,
    pennants: int = 0,
    skipper_record: tuple[int, int] | None = None,
    scout_hits: int = 0,
) -> dict[str, float]:
    wins = expected_wins(total_war)
    parts = {
        "expectedWins": round(wins, 1),
        "budgetBonus": round(budget_bonus(spend_m, budget_m), 1),
        "awardPoints": award_points(award_lists),
        "ringPoints": rings * RING_POINTS + pennants * PENNANT_POINTS,
        "skipperPoints": round(
            (skipper_record[0] - skipper_record[1]) * SKIPPER_PER_NET_WIN, 1
        ) if skipper_record else 0.0,
        "scoutBonus": round(scout_hits * SCOUT_HIT_POINTS, 1),
        "luxuryTax": round(luxury_tax(spend_m, budget_m), 1),
    }
    parts["total"] = round(
        parts["expectedWins"] + parts["budgetBonus"] + parts["awardPoints"]
        + parts["ringPoints"] + parts["skipperPoints"] + parts["scoutBonus"]
        - parts["luxuryTax"], 1
    )
    return parts

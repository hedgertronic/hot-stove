"""Reference scoring implementation — the single source of truth for game math.

The frontend ports these functions to JS; this module exists so balance changes
can be playtested in Python against real cards before touching UI code.
All dollar amounts are normalized display millions (league-avg slot-8 = $160M).
"""

from __future__ import annotations

REPLACEMENT_WINS = 50.0
GAMES = 162

# MVP2/CY2 (MVP3/CY3) are award-vote 2nd (3rd) place finishers on their
# league's ballot; AS is an All-Star selection.
AWARD_POINTS = {"MVP": 3, "CY": 3, "MVP2": 2, "CY2": 2, "MVP3": 1, "CY3": 1,
                "ROY": 2, "AS": 1, "GG": 1, "SS": 1}
RING_POINTS = 3      # per player whose team won the World Series that season
PENNANT_POINTS = 1   # per player whose team won the pennant but lost the Series
# World Baseball Classic medals, on the same Ring-chasing axis as the October
# hardware above. The Classic is played in March of the same calendar year as
# the card season, so a medal and a ring describe the same player-season and
# BOTH count. 2017 Alex Bregman won the Classic with the United States and the
# World Series with Houston: that one season is worth WBC_CHAMPION_POINTS +
# RING_POINTS = 5. The stacking is a true fact about the player, not a
# double-count to suppress — they are two different tournaments and he won
# both. Nine 2017 seasons stack this way (Bregman, Clippard and Gregerson at
# +5; Correa and Beltran at +4 as pennant winners; five more at +2).
#
# The values sit below RING_POINTS deliberately. Only five Classics land inside
# the 1985-2025 card window, and the 2006 and 2009 champions (Japan) were
# rosters of NPB players with almost no MLB seasons, so WBC points are far
# scarcer than rings. Pricing a gold medal at a ring's value would let the
# handful of eligible card years own the axis outright.
WBC_CHAMPION_POINTS = 2   # per player on the World Baseball Classic winner that year
WBC_RUNNERUP_POINTS = 1   # per player on the Classic's losing finalist
# Hired manager: (team W - team L) x this, negative allowed. 0.2 makes the
# hire a real decision (policy-aware bot sweep: 0.1 -> 116+ on-field 0.1%,
# 0.2 -> 2.8% "rare but chaseable", 162+ 0.2% -> 0.75%; bots chase better
# skippers and spend Prime on them at 0.2).
MANAGER_PER_NET_WIN = 0.2
# Hired manager won the BBWAA Manager of the Year that season. Hardware, not
# wins: it joins the awardPoints (trophy case) sum, never the managerWins term.
MANAGER_MOTY_POINTS = 2
SCOUT_HIT_POINTS = 1.0  # per drafted player who's in the WAR-optimal roster

LUXURY_TAX_PER_M = 1.0
BUDGET_BONUS_MAX = 10.0


def expected_wins(total_war: float, manager_wins: float = 0.0) -> float:
    """Replacement level + roster WAR + hired-manager net wins, capped at 162."""
    return min(REPLACEMENT_WINS + total_war + manager_wins, GAMES)


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
    manager_record: tuple[int, int] | None = None,
    scout_hits: int = 0,
    manager_moty: bool = False,
    wbc_champions: int = 0,
    wbc_runners_up: int = 0,
) -> dict[str, float]:
    # Manager net wins fold into expected wins UNrounded; managerWins is an
    # informational part (already inside expectedWins, never added to total).
    mw = (
        (manager_record[0] - manager_record[1]) * MANAGER_PER_NET_WIN
        if manager_record else 0.0
    )
    wins = expected_wins(total_war, mw)
    parts = {
        "expectedWins": round(wins, 1),
        "managerWins": round(mw, 1),
        "budgetBonus": round(budget_bonus(spend_m, budget_m), 1),
        # The skipper's MotY is hardware like any player award — trophy case.
        "awardPoints": award_points(award_lists)
        + (MANAGER_MOTY_POINTS if manager_moty else 0),
        # One Ring-chasing row carries every tournament a player won that
        # season — October rings and pennants plus March's Classic medals.
        # They share a row because they answer one question ("what did this
        # club win?"); a separate ledger line would imply a separate axis.
        "ringPoints": rings * RING_POINTS + pennants * PENNANT_POINTS
        + wbc_champions * WBC_CHAMPION_POINTS
        + wbc_runners_up * WBC_RUNNERUP_POINTS,
        "scoutBonus": round(scout_hits * SCOUT_HIT_POINTS, 1),
        "luxuryTax": round(luxury_tax(spend_m, budget_m), 1),
    }
    parts["total"] = round(
        parts["expectedWins"] + parts["budgetBonus"] + parts["awardPoints"]
        + parts["ringPoints"] + parts["scoutBonus"]
        - parts["luxuryTax"], 1
    )
    return parts

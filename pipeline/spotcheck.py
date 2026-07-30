"""Sanity checks against known team-seasons. Run after build:
uv run python -m pipeline.spotcheck
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline import scoring

DATA = Path(__file__).resolve().parent.parent / "data"


def card(team: str, year: int) -> dict:
    return json.loads((DATA / "cards" / f"{team}_{year}.json").read_text())


def show(team: str, year: int, top: int = 6) -> dict:
    c = card(team, year)
    print(f"\n{c['year']} {c['name']} ({c['team']})  {c['wins']}-{c['losses']}  "
          f"park: {c['park']}  att pct: {c['attendancePct']} (mult {c['stadiumMult']})")
    print(f"  budget ${c['budget']}M (raw ${c['budgetRaw']:,})  "
          f"prorated x{c['prorated']}  players: {len(c['players'])}")
    for p in c["contracts"]:
        print(f"    {p['name']:24} ${p['salary']:,}{' (est)' if p['est'] else ''}")
    for p in c["players"][:top]:
        aw = f"  {'/'.join(p['awards'])}" if p["awards"] else ""
        print(f"  {p['war']:5.1f} WAR  ${p['cost']:6.1f}M  {p['pos']:6} {p['name']}{aw}")
    return c


def main() -> None:
    show("CHC", 2016)   # World Series team, Bryant MVP
    show("OAK", 2002)   # moneyball baseline budget
    show("NYY", 2005)   # inherited-contract flavor check
    show("LAA", 2018)   # Ohtani two-way season
    show("LAD", 2020)   # short-season proration
    show("ANA", 2000)   # franchise code churn (ANA/LAA)

    # A plausible drafted team: 2016 Cubs owner + best affordable picks.
    c = card("CHC", 2016)
    team = c["players"][:3]
    spend = sum(p["cost"] for p in team)
    result = scoring.score(
        total_war=sum(p["war"] for p in team),
        spend_m=spend, budget_m=c["budget"],
        award_lists=[p["awards"] for p in team],
    )
    print(f"\n3-player toy score vs {c['year']} {c['team']} budget: {result}")
    w, l = scoring.display_record(result["expectedWins"])
    print(f"display record: {w}-{l}")


if __name__ == "__main__":
    main()

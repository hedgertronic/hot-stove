"""Emits the static game data: one JSON card per team-season, plus index/meta.

Run from the project root:  uv run python -m pipeline.build
Output layout (all consumed by the static frontend):
  data/index.json        every rollable team-season (the wheel + Time Machine)
  data/meta.json         constants + per-year normalization tables
  data/cards/{BR}_{year}.json   full card, fetched on demand at spin time
  data/owners.json       owner names by franchise (hand-curated, flavor only)
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline import fetch
from pipeline.transform import (
    DISPLAY_AVG_M, MIN_GS, MIN_PA, MIN_RELIEF_IP, SLOTS,
    YEAR_MAX, YEAR_MIN, GameData, _i,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
REPLACEMENT_WINS = 47.7

# DESIGN KNOB — optional "asking price": a player costs
# max(contract, ASKING_PER_WAR x season WAR) in display $M. Set to 0: bargain
# hunting for pre-arb stars IS the game (players cost their real contracts),
# and budget pressure comes from TOP_N_CONTRACTS bankrolls instead. Nonzero
# values (4 = half market rate) remain available for a future "market mode";
# see the sweep tables in pipeline/playtest.py history.
ASKING_PER_WAR = 0.0

LAHMAN_TABLES = ["People", "Teams", "Appearances", "Pitching", "Salaries",
                 "AwardsPlayers", "Managers"]


def load_raw() -> dict:
    raw = {f"war_{k}": fetch.load_war(k) for k in ("bat", "pitch")}
    for table in LAHMAN_TABLES:
        raw[table] = fetch.load_lahman(table)
    return raw


def display_pos(gd: GameData, lahman_id: str, year: int, e: dict, factor: float) -> str:
    """UI position label. Two-way seasons (Ohtani) show both roles."""
    games = dict(gd.pos_games.get((lahman_id, year), {}))
    games.pop("P", None)
    hitter = max(games, key=lambda p: games[p]) if games and max(games.values()) else None
    min_pa, min_gs, min_rip = MIN_PA / factor, MIN_GS / factor, MIN_RELIEF_IP / factor
    is_sp, is_rp = e["gs"] >= min_gs, e["gs"] < min_gs and e["ip_relief"] >= min_rip
    if is_sp and e["pa"] >= min_pa and hitter:
        return f"SP/{hitter}"
    if is_sp:
        return "SP"
    if is_rp:
        return "RP"
    return hitter or "P"


def build_players(gd: GameData, br: str, year: int, factor: float) -> list[dict]:
    players = []
    # Short seasons scale the eligibility floors too (150 PA is a full-time
    # season in 2020's 60 games).
    min_pa, min_gs, min_rip = MIN_PA / factor, MIN_GS / factor, MIN_RELIEF_IP / factor
    for (bbref_id, y), e in gd.war.items():
        if y != year or br not in e["teams"]:
            continue
        if not (e["pa"] >= min_pa or e["gs"] >= min_gs or e["ip_relief"] >= min_rip):
            continue
        lahman_id = gd.b2l.get(bbref_id, bbref_id)
        salary, estimated = gd.resolve_salary(lahman_id, year)
        war_raw = e["war_bat"] + e["war_pitch"]
        war = round(war_raw * factor, 1)
        contract = gd.to_display_m(salary, year)
        games = gd.pos_games.get((lahman_id, year), {})
        players.append({
            "id": bbref_id,
            "name": e["name"],
            "pos": display_pos(gd, lahman_id, year, e, factor),
            "war": war,
            "warRaw": round(war_raw, 1),
            "cost": round(max(contract, ASKING_PER_WAR * war), 1),
            "contract": contract,
            "salary": salary,
            "est": estimated,
            "awards": gd.awards.get((lahman_id, year), []),
            "ws": gd.ws_winner.get(year) in e["teams"],
            "pen": (gd.ws_winner.get(year) not in e["teams"]
                    and bool(gd.pennant.get(year, set()) & e["teams"])),
            "pa": e["pa"],
            "gs": e["gs"],
            "relIP": round(e["ip_relief"]),
            "posG": {
                "c": games.get("C", 0),
                "if": sum(games.get(p, 0) for p in ("1B", "2B", "3B", "SS")),
                "of": sum(games.get(p, 0) for p in ("LF", "CF", "RF")),
                "dh": games.get("DH", 0),
            },
            "debut": gd.debut_franchise.get(lahman_id),
            "teams": sorted(e["teams"]),
        })
    players.sort(key=lambda p: p["war"], reverse=True)
    return players


def main() -> None:
    gd = GameData(load_raw())
    names = {r["playerID"]: f"{r['nameFirst']} {r['nameLast']}" for r in gd.raw["People"]}

    # Primary manager (most games) per team-season, for the Skipper mechanic.
    managers: dict[tuple[int, str], tuple[str, int]] = {}
    for r in gd.raw["Managers"]:
        key = (_i(r["yearID"]), r["teamID"])
        if key not in managers or _i(r["G"]) > managers[key][1]:
            managers[key] = (r["playerID"], _i(r["G"]))

    # Attendance percentile within each year drives the stadium multiplier.
    att_by_year: dict[int, list[int]] = {}
    for (year, br), row in gd.team_rows.items():
        att_by_year.setdefault(year, []).append(_i(row["attendance"]))
    for values in att_by_year.values():
        values.sort()

    cards_dir = DATA_DIR / "cards"
    cards_dir.mkdir(parents=True, exist_ok=True)
    index, empty_slots = [], 0
    min_budget = None  # league-minimum bankroll: the no-owner floor (meta.minBudget)

    for (year, br), row in sorted(gd.team_rows.items()):
        factor = gd.proration[year]
        _, slot8 = gd.budgets[(year, br)]
        bankroll_raw, contracts = gd.bankrolls[(year, br)]
        empty_slots += len(SLOTS) - len(slot8)
        att = _i(row["attendance"])
        ranks = att_by_year[year]
        pct = ranks.index(att) / max(len(ranks) - 1, 1)
        card = {
            "year": year,
            "team": br,
            "franchise": row["franchID"],
            "name": row["name"],
            "park": row["park"],
            "wins": _i(row["W"]),
            "losses": _i(row["L"]),
            "manager": names.get(
                (managers.get((year, gd.lahman_team[(year, br)])) or (None,))[0]),
            "attendance": att,
            "attendancePct": round(pct, 2),
            "stadiumMult": round(0.85 + 0.30 * pct, 2),
            "budget": gd.to_display_m(bankroll_raw, year),
            "budgetRaw": bankroll_raw,
            "contracts": [
                {"name": names.get(p["id"], p["id"]),
                 "salary": p["salary"], "est": p["est"]}
                for p in contracts
            ],
            "prorated": factor,
            "players": build_players(gd, br, year, factor),
        }
        min_budget = card["budget"] if min_budget is None else min(min_budget, card["budget"])
        (cards_dir / f"{br}_{year}.json").write_text(json.dumps(card))
        index.append({"team": br, "year": year, "franchise": row["franchID"],
                      "name": row["name"]})

    (DATA_DIR / "index.json").write_text(json.dumps(
        {"yearMin": YEAR_MIN, "yearMax": YEAR_MAX, "cards": index}))
    (DATA_DIR / "meta.json").write_text(json.dumps({
        "displayAvgM": DISPLAY_AVG_M,
        "replacementWins": REPLACEMENT_WINS,
        "slots": SLOTS,
        "minBudget": min_budget,
        "avgSlot8": {str(y): round(v) for y, v in sorted(gd.avg_slot8.items())},
        "salaryFloor": {str(y): v for y, v in sorted(gd.floor.items())},
        "proration": {str(y): f for y, f in sorted(gd.proration.items()) if f != 1.0},
    }, indent=1))

    owners_path = DATA_DIR / "owners.json"
    if not owners_path.exists():
        owners_path.write_text(json.dumps({
            "_todo": "Hand-curate from SABR team ownership histories "
                     "(https://sabr.org/bioproject/team-ownership-histories); "
                     "top up post-2020 sales from Wikipedia.",
            "franchises": {},
        }, indent=1))

    total_players = sum(len(json.loads((cards_dir / f"{c['team']}_{c['year']}.json")
                                       .read_text())["players"]) for c in index[:50])
    print(f"cards: {len(index)}  (sample avg players/card: {total_players / 50:.0f})")
    print(f"unfilled slot-8 slots across all cards: {empty_slots}")
    est = sum(1 for y in gd.floor)
    print(f"salary floors computed for {est} years; "
          f"e.g. 1987=${gd.floor[1987]:,} 2023=${gd.floor[2023]:,}")


if __name__ == "__main__":
    main()

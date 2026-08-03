"""Emits the static game data: one JSON card per team-season, plus index/meta.

Run from the project root:  uv run python -m pipeline.build
Output layout (all consumed by the static frontend):
  data/index.json        every rollable team-season (the wheel + Time Machine)
  data/meta.json         constants + per-year normalization tables
  data/cards/{BR}_{year}.json   full card, fetched on demand at spin time
  data/owners.json       owner names by franchise (hand-curated, flavor only)
  data/wbc.json          World Baseball Classic finalist rosters (hand-curated
                         INPUT, not output — read here, joined onto cards as
                         each player's `wbc` medal value)
  data/specials.json     per-franchise front-office timeline (manager/park/
                         attendance/budget per season) for Prime Time on
                         manager/stadium/owner tiles — fetched lazily
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from pipeline import fetch
from pipeline.scoring import (
    REPLACEMENT_WINS, WBC_CHAMPION_POINTS, WBC_RUNNERUP_POINTS,
)
from pipeline.transform import (
    BANKROLL_GAMMA, BANKROLL_MIN_M, BANKROLL_PIVOT_M, BANKROLL_SCALE,
    DISPLAY_AVG_M, MIN_GS, MIN_PA, MIN_RELIEF_IP, SLOTS,
    YEAR_MAX, YEAR_MIN, GameData, _i,
)


def bankroll_display(unscaled_m: float) -> float:
    """Widen around the pivot, scale, clamp — see the DESIGN KNOBS in transform."""
    widened = BANKROLL_PIVOT_M * (unscaled_m / BANKROLL_PIVOT_M) ** BANKROLL_GAMMA
    return round(max(widened * BANKROLL_SCALE, BANKROLL_MIN_M), 1)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Global price floor, display $M — no player ever costs less than $1M. Keeps
# every price in one legible unit ("everyone costs millions") and makes the
# 🏠 Homegrown flat price the same number as the cheapest possible signing.
MIN_PRICE_M = 1.0

# DESIGN KNOB — optional "asking price": a player costs
# max(contract, ASKING_PER_WAR x season WAR) in display $M. Set to 0: bargain
# hunting for pre-arb stars IS the game (players cost their real contracts),
# and budget pressure comes from TOP_N_CONTRACTS bankrolls instead. Nonzero
# values (4 = half market rate) remain available for a future "market mode";
# see the sweep tables in pipeline/playtest.py history.
ASKING_PER_WAR = 0.0

LAHMAN_TABLES = ["People", "Teams", "Appearances", "Batting", "Pitching",
                 "Salaries", "AwardsPlayers", "AwardsSharePlayers", "Managers",
                 "AllstarFull", "AwardsManagers", "HallOfFame"]

# The card value a Classic placing is worth. The mapping is one-way on
# purpose: data/wbc.json stores the PLACING and pipeline/scoring.py owns the
# POINTS, so the file and the scorer can never drift apart on what a medal is
# worth. The consequence is that editing either constant in scoring.py is an
# economy change AND a data change — the cards carry the number, so they have
# to be rebuilt for the new value to reach the game.
WBC_PLACING_POINTS = {
    "champion": WBC_CHAMPION_POINTS,
    "runnerUp": WBC_RUNNERUP_POINTS,
}


def load_wbc() -> list[dict]:
    """data/wbc.json flattened to one row per roster entry.

    Hand-curated input, checked in beside owners.json and read (never
    written) by the build. Flattening here means GameData receives it as
    just another table of rows, exactly like the Lahman tables, and the
    transform module stays free of filesystem access.

    A missing file yields no rows rather than an error: the Classic is one
    pedigree fact among several, and a fresh clone without it should still
    produce a complete, playable data set — every card simply carries no
    medals.
    """
    path = DATA_DIR / "wbc.json"
    if not path.exists():
        return []
    doc = json.loads(path.read_text())
    return [
        {"year": _i(year), "placing": placing,
         "brId": p["brId"], "name": p["name"]}
        for year, sides in doc.get("tournaments", {}).items()
        for placing in ("champion", "runnerUp")
        for p in sides[placing]["players"]
    ]


def load_raw() -> dict:
    raw = {f"war_{k}": fetch.load_war(k) for k in ("bat", "pitch")}
    for table in LAHMAN_TABLES:
        raw[table] = fetch.load_lahman(table)
    raw["wbc"] = load_wbc()
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
    if hitter:
        return hitter
    # Sub-floor pitcher (WAR-override eligible): label by role split, never
    # bare "P" — the frontend maps only "SP"/"RP" prefixes to pitcher slots.
    if e["war_pitch"] > e["war_bat"]:
        return "SP" if e["ip_start"] >= e["ip_relief"] else "RP"
    return "P"


def build_players(gd: GameData, br: str, year: int, factor: float) -> list[dict]:
    players = []
    # Short seasons scale the eligibility floors too (150 PA is a full-time
    # season in 2020's 60 games).
    min_pa, min_gs, min_rip = MIN_PA / factor, MIN_GS / factor, MIN_RELIEF_IP / factor
    for (bbref_id, y), e in gd.war.items():
        if y != year or br not in e["teams"]:
            continue
        war_raw = e["war_bat"] + e["war_pitch"]
        war = round(war_raw * factor, 1)
        # Playing-time floors, with a WAR override so a high-value short
        # stint (deadline rental, September call-up) still makes the card.
        if not (e["pa"] >= min_pa or e["gs"] >= min_gs
                or e["ip_relief"] >= min_rip or war >= 2.0):
            continue
        lahman_id = gd.b2l.get(bbref_id, bbref_id)
        salary, estimated = gd.resolve_salary(lahman_id, year)
        contract = gd.to_display_m(salary, year)
        games = gd.pos_games.get((lahman_id, year), {})
        # Scout-mode extras: age + trad stat lines, omitted when absent/noise.
        extras: dict = {}
        if (age := gd.seasonal_age(lahman_id, year)) is not None:
            extras["age"] = age
        bat = gd.bat_line.get((lahman_id, year))
        if bat and bat["ab"] >= 20:
            obp_den = bat["ab"] + bat["bb"] + bat["hbp"] + bat["sf"]
            obp = (bat["h"] + bat["bb"] + bat["hbp"]) / obp_den if obp_den else 0.0
            total_bases = bat["h"] + bat["2b"] + 2 * bat["3b"] + 3 * bat["hr"]
            extras["bat"] = {"avg": round(bat["h"] / bat["ab"], 3),
                             "obp": round(obp, 3),
                             "slg": round(total_bases / bat["ab"], 3),
                             "hr": bat["hr"], "rbi": bat["rbi"], "sb": bat["sb"]}
        pit = gd.pit_line.get((lahman_id, year))
        if pit and pit["outs"] >= 3:
            extras["pit"] = {"w": pit["w"], "l": pit["l"], "sv": pit["sv"],
                             "era": round(9 * pit["er"] / (pit["outs"] / 3), 2),
                             "so": pit["so"]}
        player = {
            **extras,
            "id": bbref_id,
            "name": e["name"],
            "pos": display_pos(gd, lahman_id, year, e, factor),
            "war": war,
            "warRaw": round(war_raw, 1),
            "cost": round(max(contract, ASKING_PER_WAR * war, MIN_PRICE_M), 1),
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
        }
        # Birth country, absent only when Lahman has no birthCountry for the
        # player (zero of the 1985-2025 card player-seasons today). The value
        # is the display name, not a code: a 2-letter code would save 112KB
        # across data/ (94 bytes on an average card) at the price of a second
        # lookup table every consumer has to carry.
        if country := gd.birth_country.get(lahman_id):
            player["bc"] = country
        # Hall of Fame as a player. Written only when true, like the card's
        # ws/pen flags — 955 of 35,720 player-seasons carry it.
        if lahman_id in gd.hof_players:
            player["hof"] = True
        # World Baseball Classic medal for this exact season: 2 for the
        # champion, 1 for the losing finalist, the same numbers scoring.py
        # pays. The value is the POINTS rather than a boolean because a gold
        # and a silver are worth different amounts and the scorer reads them
        # off the card. Sparse like `hof` rather than always-present like
        # ws/pen: five Classics fall in the 1985-2025 window, so the field is
        # absent from well over 99% of player-seasons and writing a 0 on all
        # of them would cost bytes on every card to say nothing.
        if placing := gd.wbc.get((bbref_id, year)):
            player["wbc"] = WBC_PLACING_POINTS[placing]
        players.append(player)
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
    #
    # 2020 IS NOT A BUG, AND MUST NOT BE "FIXED". Every club drew zero that
    # season, so `ranks.index(0)` returns 0 for all thirty and every 2020
    # ballpark lands on the 0.85 floor. That reads like an accident of
    # list.index and it is the honest answer anyway: the floor is what a park
    # with nobody in it is worth, and 2020 is the one year the whole league
    # earned it. Tie-breaking the zeros — by any rule at all — would invent a
    # gate ranking out of thirty identical empty stadiums.
    #
    # `attendancePct` is 0.0 on all thirty for the same reason and is display
    # only; nothing scores off it.
    att_by_year: dict[int, list[int]] = {}
    for (year, br), row in gd.team_rows.items():
        att_by_year.setdefault(year, []).append(_i(row["attendance"]))
    for values in att_by_year.values():
        values.sort()

    cards_dir = DATA_DIR / "cards"
    cards_dir.mkdir(parents=True, exist_ok=True)
    index, empty_slots = [], 0
    min_budget = None  # league-minimum bankroll: the no-owner floor (meta.minBudget)
    player_seasons: dict[str, list[list]] = defaultdict(list)  # bbrefID -> [[br, year]]
    specials: dict[str, list[dict]] = defaultdict(list)  # franchID -> FO timeline
    seasons, no_country, hof_seasons = 0, 0, 0
    hof_ids: set[str] = set()
    # Classic join audit: which roster entries actually reached a card, and
    # how much the axis is worth per tournament year. The rosters resolve
    # unevenly by construction — the 2006 and 2009 champions were NPB clubs
    # with barely an MLB season between them — so the per-year totals are the
    # number worth watching, not the overall hit rate.
    wbc_cards: dict[int, int] = defaultdict(int)   # year -> player-seasons flagged
    wbc_points: dict[int, int] = defaultdict(int)  # year -> total points on cards
    wbc_ids: set[str] = set()
    hof_mgr_cards, hof_mgr_ids = 0, set()

    for (year, br), row in sorted(gd.team_rows.items()):
        factor = gd.proration[year]
        _, slot8 = gd.budgets[(year, br)]
        bankroll_raw, contracts = gd.bankrolls[(year, br)]
        empty_slots += len(SLOTS) - len(slot8)
        att = _i(row["attendance"])
        ranks = att_by_year[year]
        pct = ranks.index(att) / max(len(ranks) - 1, 1)
        mgr_pid = (managers.get((year, gd.lahman_team[(year, br)])) or (None,))[0]
        # BBWAA Manager of the Year that season — lean flag, present only when
        # true (like the index's ws/pen), read by the Skipper scoring bonus.
        mgr_moty = (mgr_pid, year) in gd.manager_moty
        # In the Hall of Fame on a manager's plaque. Career-level, so it rides
        # every card that skipper appears on; present only when true.
        mgr_hof = mgr_pid in gd.hof_managers
        card = {
            "year": year,
            "team": br,
            "franchise": row["franchID"],
            "name": row["name"],
            "park": row["park"],
            "wins": _i(row["W"]),
            "losses": _i(row["L"]),
            "ws": gd.ws_winner.get(year) == br,
            "pen": (gd.ws_winner.get(year) != br
                    and br in gd.pennant.get(year, set())),
            "manager": names.get(mgr_pid),
            "attendance": att,
            "attendancePct": round(pct, 2),
            "stadiumMult": round(0.85 + 0.30 * pct, 2),
            "budget": bankroll_display(gd.to_display_m(bankroll_raw, year)),
            "budgetRaw": bankroll_raw,
            "contracts": [
                {"name": names.get(p["id"], p["id"]),
                 "salary": p["salary"], "est": p["est"]}
                for p in contracts
            ],
            "prorated": factor,
            "players": build_players(gd, br, year, factor),
        }
        if mgr_moty:
            card["managerMoty"] = True
        if mgr_hof:
            card["managerHof"] = True
        min_budget = card["budget"] if min_budget is None else min(min_budget, card["budget"])
        if mgr_hof:
            hof_mgr_cards += 1
            hof_mgr_ids.add(mgr_pid)
        for p in card["players"]:
            player_seasons[p["id"]].append([br, year])
            seasons += 1
            no_country += "bc" not in p
            if p.get("hof"):
                hof_seasons += 1
                hof_ids.add(p["id"])
            if pts := p.get("wbc"):
                wbc_cards[year] += 1
                wbc_points[year] += pts
                wbc_ids.add(p["id"])
        special = {
            "team": br, "year": year, "name": row["name"], "park": row["park"],
            "mgr": card["manager"], "w": card["wins"], "l": card["losses"],
            "att": card["attendancePct"], "mult": card["stadiumMult"],
            "budget": card["budget"],
        }
        if mgr_moty:
            special["moty"] = True
        if mgr_hof:
            special["hof"] = True
        specials[row["franchID"]].append(special)
        (cards_dir / f"{br}_{year}.json").write_text(json.dumps(card))
        # lg/div are the season's actual league + division (Lahman Teams), so
        # the Relocate picker can group by era-correct divisions (pre-1994
        # years have no Central; Houston is NL through 2012, etc.).
        entry = {"team": br, "year": year, "franchise": row["franchID"],
                 "name": row["name"], "lg": row["lgID"], "div": row["divID"]}
        # Pedigree flags ride the index (only when true, to keep it lean) so
        # the Season Ticket year grid can decorate without loading cards.
        if card["ws"]:
            entry["ws"] = True
        elif card["pen"]:
            entry["pen"] = True
        index.append(entry)

    (DATA_DIR / "index.json").write_text(json.dumps(
        {"yearMin": YEAR_MIN, "yearMax": YEAR_MAX, "cards": index}))
    (DATA_DIR / "players.json").write_text(json.dumps(
        {pid: sorted(seasons, key=lambda s: s[1])
         for pid, seasons in sorted(player_seasons.items())},
        separators=(",", ":")))
    (DATA_DIR / "specials.json").write_text(json.dumps(
        {fr: sorted(entries, key=lambda e: (e["year"], e["team"]))
         for fr, entries in sorted(specials.items())},
        separators=(",", ":")))
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
    print(f"players.json: {len(player_seasons)} players, "
          f"{(DATA_DIR / 'players.json').stat().st_size:,} bytes")
    print(f"birth country: {seasons - no_country:,}/{seasons:,} player-seasons "
          f"({no_country} missing)")
    print(f"hall of fame: {len(hof_ids)} players / {hof_seasons:,} player-seasons; "
          f"{len(hof_mgr_ids)} managers on {hof_mgr_cards} cards")

    wbc_rows = gd.raw["wbc"]
    resolved = sum(1 for r in wbc_rows if r["brId"])
    print(f"world baseball classic: {len(wbc_rows)} roster entries, "
          f"{resolved} with a B-R id, {sum(wbc_cards.values())} on cards "
          f"({len(wbc_ids)} distinct players)")
    for year in sorted(wbc_cards):
        year_cards = sum(1 for c in index if c["year"] == year)
        print(f"  {year}: {wbc_cards[year]:3} player-seasons  "
              f"{wbc_points[year]:3} points across {year_cards} cards  "
              f"({wbc_points[year] / year_cards:.2f} pts/card)")

    # Short-stint audit: player-seasons on cards only via the WAR >= 2.0
    # override (below every playing-time floor).
    overrides = []
    for (bbref_id, year), e in gd.war.items():
        factor = gd.proration[year]
        if (e["pa"] >= MIN_PA / factor or e["gs"] >= MIN_GS / factor
                or e["ip_relief"] >= MIN_RELIEF_IP / factor):
            continue
        war = round((e["war_bat"] + e["war_pitch"]) * factor, 1)
        if war >= 2.0:
            overrides.append((war, year, e["name"], sorted(e["teams"]),
                              e["pa"], e["gs"], round(e["ip_relief"])))
    overrides.sort(key=lambda o: -o[0])
    print(f"short-stint WAR>=2.0 overrides: {len(overrides)} player-seasons")
    for war, year, name, teams, pa, gs, rip in overrides[:15]:
        print(f"  {war:4.1f} WAR  {year} {'/'.join(teams):8} {name}  "
              f"pa={pa} gs={gs} relIP={rip}")


if __name__ == "__main__":
    main()

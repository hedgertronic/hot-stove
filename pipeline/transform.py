"""Transforms raw B-R + Lahman rows into game-ready team-season cards.

Pipeline shape:
  player-season aggregation (WAR, salary, positions, awards, debut franchise)
  -> per-team slot-8 payrolls (the owner bankroll mechanic)
  -> league-average normalization (all dollars = share of league-avg slot-8
     payroll x $160M display constant, so 1987 and 2024 are comparable)
  -> one JSON card per team-season.

ID discipline: B-R WAR files key on bbrefID; Lahman keys on playerID. 499
players differ between the two, so every join routes through People.bbrefID.
"""

from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any

YEAR_MIN, YEAR_MAX = 1985, 2024
DISPLAY_AVG_M = 160.0  # league-average slot-8 payroll displays as $160M "2026 dollars"

SLOTS = ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"]

# DESIGN KNOB — the owner's bankroll is the sum of the team's TOP_N_CONTRACTS
# biggest contracts. Bot sweep with real salaries (playtest): N=4 -> avg budget
# $112M, cost-blind drafting busts 44% of the time while informed drafting
# sacrifices only ~2 WAR — bargain-hunting is the skill, by design. N=3 is the
# harsher candidate (65% busts); N>=6 makes the budget decorative.
TOP_N_CONTRACTS = 4
IF_POS = {"1B", "2B", "3B", "SS"}
OF_POS = {"LF", "CF", "RF"}

# Card eligibility floors (sub-floor players still count toward slot-8 payrolls).
MIN_PA, MIN_GS, MIN_RELIEF_IP = 150, 10, 20

AWARD_CODES = {
    "Most Valuable Player": "MVP",
    "Cy Young Award": "CY",
    "Rookie of the Year": "ROY",
    "Gold Glove": "GG",
    "Silver Slugger": "SS",
}

# Voting places (AwardsSharePlayers): (winner, 2nd, 3rd) codes per ballot.
# Full award-name strings — Lahman's AwardsSharePlayers uses these, not the
# short AwardsPlayers labels.
VOTE_PLACE_CODES = {
    "Most Valuable Player": ("MVP", "MVP2", "MVP3"),
    "Cy Young Award": ("CY", "CY2", "CY3"),
}

POS_G_COLS = {
    "C": "G_c", "1B": "G_1b", "2B": "G_2b", "3B": "G_3b", "SS": "G_ss",
    "LF": "G_lf", "CF": "G_cf", "RF": "G_rf", "DH": "G_dh", "P": "G_p",
}


def _f(v: Any) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _i(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def _money(v: Any) -> int | None:
    s = str(v or "").strip()
    if not s or s == "NULL":
        return None
    try:
        return int(float(s))
    except ValueError:
        return None


class GameData:
    """All derived state, built once from raw rows."""

    def __init__(self, raw: dict[str, list[dict[str, Any]]]) -> None:
        self.raw = raw
        self._build_ids()
        self._build_teams()
        self._build_positions()
        self._build_stat_lines()
        self._build_war()
        self._build_salaries()
        self._build_awards()
        self._build_debuts()
        self._build_slot8()
        self._build_normalization()

    # -- IDs ---------------------------------------------------------------

    def _build_ids(self) -> None:
        self.b2l: dict[str, str] = {}
        self.birth: dict[str, tuple[int, int]] = {}  # playerID -> (year, month)
        for r in self.raw["People"]:
            bbref = r.get("bbrefID") or r["playerID"]
            self.b2l[bbref] = r["playerID"]
            if by := _i(r.get("birthYear")):
                self.birth[r["playerID"]] = (by, _i(r.get("birthMonth")) or 7)

    def seasonal_age(self, lahman_id: str, year: int) -> int | None:
        """Baseball convention: age on June 30 of the season."""
        if (b := self.birth.get(lahman_id)) is None:
            return None
        by, bm = b
        return year - by - (1 if bm >= 7 else 0)

    # -- Teams / seasons ---------------------------------------------------

    def _build_teams(self) -> None:
        self.team_rows: dict[tuple[int, str], dict[str, Any]] = {}  # (year, brCode)
        self.lahman_team: dict[tuple[int, str], str] = {}  # (year, brCode) -> teamID
        self.franchise_of: dict[str, str] = {}  # lahman teamID -> franchID (any era)
        games_by_year: dict[int, list[int]] = defaultdict(list)

        self.ws_winner: dict[int, str] = {}  # year -> B-R code of the champion
        self.pennant: dict[int, set[str]] = defaultdict(set)  # year -> league winners
        for r in self.raw["Teams"]:
            year = _i(r["yearID"])
            self.franchise_of[r["teamID"]] = r["franchID"]
            if not (YEAR_MIN <= year <= YEAR_MAX):
                continue
            br = r["teamIDBR"] or r["teamID"]
            self.team_rows[(year, br)] = r
            self.lahman_team[(year, br)] = r["teamID"]
            if r["WSWin"] == "Y":
                self.ws_winner[year] = br
            if r["LgWin"] == "Y":
                self.pennant[year].add(br)
            games_by_year[year].append(_i(r["G"]))

        # Short seasons (1994, 1995, 2020) surface as low average games played;
        # WAR is pro-rated to 162 by this factor.
        self.proration: dict[int, float] = {}
        for year, games in games_by_year.items():
            avg_g = mean(games)
            self.proration[year] = round(162 / avg_g, 3) if avg_g < 155 else 1.0

    # -- Positions (Lahman Appearances, summed across stints) --------------

    def _build_positions(self) -> None:
        self.pos_games: dict[tuple[str, int], dict[str, int]] = defaultdict(
            lambda: defaultdict(int)
        )
        self.team_pool: dict[tuple[str, int], set[str]] = defaultdict(set)
        for r in self.raw["Appearances"]:
            year = _i(r["yearID"])
            if not (YEAR_MIN <= year <= YEAR_MAX):
                continue
            key = (r["playerID"], year)
            for pos, col in POS_G_COLS.items():
                self.pos_games[key][pos] += _i(r.get(col))
            self.team_pool[(r["teamID"], year)].add(r["playerID"])

        self.gs: dict[tuple[str, int], int] = defaultdict(int)
        for r in self.raw["Pitching"]:
            year = _i(r["yearID"])
            if YEAR_MIN <= year <= YEAR_MAX:
                self.gs[(r["playerID"], year)] += _i(r["GS"])

    def primary_pos(self, lahman_id: str, year: int) -> str | None:
        games = self.pos_games.get((lahman_id, year))
        if not games:
            return None
        best = max(games, key=lambda p: games[p])
        return best if games[best] > 0 else None

    # -- Traditional stat lines (Scout mode; summed across stints) ---------

    def _build_stat_lines(self) -> None:
        self.bat_line: dict[tuple[str, int], dict[str, int]] = {}
        for r in self.raw["Batting"]:
            year = _i(r["yearID"])
            if not (YEAR_MIN <= year <= YEAR_MAX):
                continue
            e = self.bat_line.setdefault(
                (r["playerID"], year),
                {"ab": 0, "h": 0, "hr": 0, "sb": 0, "bb": 0, "hbp": 0, "sf": 0,
                 "2b": 0, "3b": 0, "rbi": 0, "so": 0})
            e["ab"] += _i(r["AB"])
            e["h"] += _i(r["H"])
            e["hr"] += _i(r["HR"])
            e["sb"] += _i(r["SB"])
            e["bb"] += _i(r["BB"])
            e["hbp"] += _i(r["HBP"])  # blank in old rows; _i coerces to 0
            e["sf"] += _i(r["SF"])
            e["2b"] += _i(r["2B"])
            e["3b"] += _i(r["3B"])
            e["rbi"] += _i(r["RBI"])
            e["so"] += _i(r["SO"])

        self.pit_line: dict[tuple[str, int], dict[str, int]] = {}
        for r in self.raw["Pitching"]:
            year = _i(r["yearID"])
            if not (YEAR_MIN <= year <= YEAR_MAX):
                continue
            e = self.pit_line.setdefault(
                (r["playerID"], year),
                {"w": 0, "l": 0, "sv": 0, "er": 0, "outs": 0, "so": 0})
            e["w"] += _i(r["W"])
            e["l"] += _i(r["L"])
            e["sv"] += _i(r["SV"])
            e["er"] += _i(r["ER"])
            e["outs"] += _i(r["IPouts"])
            e["so"] += _i(r["SO"])

    # -- WAR + B-R salary (aggregated across stints; full-season totals) ---

    def _build_war(self) -> None:
        agg: dict[tuple[str, int], dict[str, Any]] = {}

        def entry(bbref_id: str, year: int, name: str) -> dict[str, Any]:
            return agg.setdefault(
                (bbref_id, year),
                {
                    "name": name, "war_bat": 0.0, "war_pitch": 0.0, "pa": 0,
                    "gs": 0, "ip_start": 0.0, "ip_relief": 0.0,
                    "salary_br": None, "teams": set(),
                },
            )

        for r in self.raw["war_bat"]:
            year = _i(r["year_ID"])
            if not (YEAR_MIN <= year <= YEAR_MAX):
                continue
            e = entry(r["player_ID"], year, r["name_common"])
            e["war_bat"] += _f(r["WAR"])
            e["pa"] += _i(r["PA"])
            e["teams"].add(r["team_ID"])
            if (s := _money(r["salary"])) is not None:
                e["salary_br"] = max(e["salary_br"] or 0, s)

        for r in self.raw["war_pitch"]:
            year = _i(r["year_ID"])
            if not (YEAR_MIN <= year <= YEAR_MAX):
                continue
            e = entry(r["player_ID"], year, r["name_common"])
            e["war_pitch"] += _f(r["WAR"])
            e["gs"] += _i(r["GS"])
            e["ip_start"] += _f(r["IPouts_start"]) / 3
            e["ip_relief"] += _f(r["IPouts_relief"]) / 3
            e["teams"].add(r["team_ID"])
            if (s := _money(r["salary"])) is not None:
                e["salary_br"] = max(e["salary_br"] or 0, s)

        self.war = agg

    # -- Salaries: Lahman (1985-2016) > B-R > estimated league floor -------

    def _build_salaries(self) -> None:
        lahman_sal: dict[tuple[str, int], int] = {}
        for r in self.raw["Salaries"]:
            year = _i(r["yearID"])
            if (s := _money(r["salary"])) is not None:
                key = (r["playerID"], year)
                lahman_sal[key] = max(lahman_sal.get(key, 0), s)

        self.salary: dict[tuple[str, int], tuple[int, bool]] = {}  # (value, estimated)
        known_by_year: dict[int, list[int]] = defaultdict(list)
        for (bbref_id, year), e in self.war.items():
            lahman_id = self.b2l.get(bbref_id, bbref_id)
            value = lahman_sal.get((lahman_id, year)) or e["salary_br"]
            if value:
                self.salary[(lahman_id, year)] = (value, False)
                known_by_year[year].append(value)

        # League floor estimate: 5th percentile of known salaries that year.
        # Fills gaps (mostly pre-arb players in 2021+) without external data.
        self.floor: dict[int, int] = {}
        for year, values in known_by_year.items():
            values.sort()
            self.floor[year] = values[max(0, len(values) // 20 - 1)]

    def resolve_salary(self, lahman_id: str, year: int) -> tuple[int, bool]:
        if (hit := self.salary.get((lahman_id, year))) is not None:
            return hit
        return self.floor[year], True

    # -- Awards ------------------------------------------------------------

    def _build_awards(self) -> None:
        self.awards: dict[tuple[str, int], list[str]] = defaultdict(list)
        for r in self.raw["AwardsPlayers"]:
            code = AWARD_CODES.get(r["awardID"])
            if code:
                self.awards[(r["playerID"], _i(r["yearID"]))].append(code)

        # All-Star selections (AllstarFull): one AS per player-season. Dedupe
        # by playerID+yearID — 1959-62 had two AS games per year — and count
        # selections regardless of GP (selected-but-didn't-play still counts).
        seen_as: set[tuple[str, int]] = set()
        for r in self.raw["AllstarFull"]:
            key = (r["playerID"], _i(r["yearID"]))
            if key not in seen_as:
                seen_as.add(key)
                self.awards[key].append("AS")

        # MVP/CY voting places: 2nd (3rd) place by pointsWon — all ties at
        # that distinct point value — per award-year-league ballot gets
        # MVP2/CY2 (MVP3/CY3). A player never carries more than one code from
        # the same award's place ladder for the same award-year.
        ballots: dict[tuple[str, int, str], list[tuple[float, str]]] = defaultdict(list)
        for r in self.raw["AwardsSharePlayers"]:
            if r["awardID"] not in VOTE_PLACE_CODES:
                continue
            ballots[(r["awardID"], _i(r["yearID"]), r["lgID"])].append(
                (_f(r["pointsWon"]), r["playerID"]))
        for (award, year, _), votes in ballots.items():
            points = sorted({pts for pts, _ in votes}, reverse=True)
            place_codes = VOTE_PLACE_CODES[award]
            for place in (1, 2):  # index into distinct point values: 2nd, 3rd
                if len(points) <= place:
                    continue
                for pts, pid in votes:
                    if pts != points[place]:
                        continue
                    codes = self.awards[(pid, year)]
                    if not any(c in codes for c in place_codes):
                        codes.append(place_codes[place])

    # -- Debut franchise (for the Hometown Hero combo) ---------------------

    def _build_debuts(self) -> None:
        first: dict[str, tuple[int, str]] = {}
        for r in self.raw["Appearances"]:
            year = _i(r["yearID"])
            pid = r["playerID"]
            if pid not in first or year < first[pid][0]:
                first[pid] = (year, r["teamID"])
        self.debut_franchise = {
            pid: self.franchise_of.get(team, team) for pid, (_, team) in first.items()
        }

    # -- Slot-8 payroll (the bankroll mechanic) ----------------------------

    def _pool_entry(self, lahman_id: str, year: int) -> dict[str, Any] | None:
        pos = self.primary_pos(lahman_id, year)
        if pos is None:
            return None
        salary, estimated = self.resolve_salary(lahman_id, year)
        gs = self.gs.get((lahman_id, year), 0)
        return {
            "id": lahman_id, "pos": pos, "salary": salary, "est": estimated,
            "sp": pos == "P" and gs >= MIN_GS, "rp": pos == "P" and gs < MIN_GS,
        }

    @staticmethod
    def _slot_fits(slot: str, p: dict[str, Any]) -> bool:
        if slot == "C":
            return p["pos"] == "C"
        if slot == "IF":
            return p["pos"] in IF_POS
        if slot == "OF":
            return p["pos"] in OF_POS
        if slot == "FLEX":
            return p["pos"] not in ("P",)
        if slot == "SP":
            return p["sp"]
        return p["rp"]  # RP

    def slot8(self, team_id: str, year: int) -> tuple[int, list[dict[str, Any]]]:
        """Greedy highest-salary fill of the 8 slots from a team's real roster."""
        pool = [
            e for pid in self.team_pool.get((team_id, year), set())
            if (e := self._pool_entry(pid, year)) is not None
        ]
        pool.sort(key=lambda p: p["salary"], reverse=True)
        used: set[str] = set()
        filled: list[dict[str, Any]] = []
        for slot in SLOTS:
            for p in pool:
                if p["id"] not in used and self._slot_fits(slot, p):
                    used.add(p["id"])
                    filled.append({"slot": slot, **p})
                    break
        return sum(p["salary"] for p in filled), filled

    def top_contracts(self, team_id: str, year: int) -> list[dict[str, Any]]:
        """The team's TOP_N_CONTRACTS biggest contracts — the owner's bankroll."""
        pool = [
            e for pid in self.team_pool.get((team_id, year), set())
            if (e := self._pool_entry(pid, year)) is not None
        ]
        pool.sort(key=lambda p: p["salary"], reverse=True)
        return pool[:TOP_N_CONTRACTS]

    def _build_slot8(self) -> None:
        # slot-8 payrolls anchor the per-year price level (normalization basis);
        # top-N contracts set the actual owner bankrolls.
        self.budgets: dict[tuple[int, str], tuple[int, list[dict[str, Any]]]] = {}
        self.bankrolls: dict[tuple[int, str], tuple[int, list[dict[str, Any]]]] = {}
        for (year, br), _ in self.team_rows.items():
            team_id = self.lahman_team[(year, br)]
            self.budgets[(year, br)] = self.slot8(team_id, year)
            top = self.top_contracts(team_id, year)
            self.bankrolls[(year, br)] = (sum(p["salary"] for p in top), top)

    # -- Normalization: share of league-avg slot-8 payroll x $160M ---------

    def _build_normalization(self) -> None:
        by_year: dict[int, list[int]] = defaultdict(list)
        for (year, _), (total, _) in self.budgets.items():
            by_year[year].append(total)
        self.avg_slot8 = {year: mean(v) for year, v in by_year.items()}

    def to_display_m(self, dollars: int, year: int) -> float:
        return round(dollars / self.avg_slot8[year] * DISPLAY_AVG_M, 1)

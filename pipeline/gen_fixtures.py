"""Regenerate app/tests/scoring-fixtures.json from THIS scoring implementation.

    python3 pipeline/gen_fixtures.py

scoring.py is the source of truth for game math and app/src/lib/scoring.ts is a
hand-maintained 1:1 port of it. The fixtures are the only thing that holds those
two in parity: app/tests/scoring.test.ts runs every case below through the
TypeScript side and compares against the numbers Python produced here.

That pin was unenforceable for most of this project's life. The test's header
pointed at "the snippet in the repo history" and no such snippet was ever
committed — so a Python-side balance change could be mirrored wrongly, or not at
all, and nothing would fail. app/DECISIONS.md item 19 is that gap; this file
closes it.

HOW TO USE IT. Change a constant or a formula in scoring.py, run this, and the
diff on scoring-fixtures.json is exactly the blast radius of the change. Then
make scoring.ts agree until `npx vitest run` is green again. Running it with
nothing changed must produce NO diff; that is the file's own smoke test.

WHAT THE CASES COVER. Plain rosters; the luxury tax over the cap; the budget
bonus at its floor, at zero, partway and at the ceiling; every award code
including the ballot finishes; rings and pennants; both World Baseball Classic
medals, including a season that stacks a medal with a ring; a manager's net wins
in both directions; the manager's Manager-of-the-Year hardware; scout hits from
none to a full nine; and the rounding path that decides a displayed record.

The cases are frozen arguments, not generated ones. A random or derived case
list would make a regeneration diff impossible to read, which is the one thing
this file exists to keep legible.
"""

from __future__ import annotations

import json
import pathlib

import scoring

OUT = pathlib.Path(__file__).resolve().parent.parent / "app" / "tests" / "scoring-fixtures.json"

CASES: list[dict] = [
    dict(total_war=118.0, spend_m=150.0, budget_m=160.0, award_lists=[['MVP', 'AS'], ['CY', 'AS'], ['AS']], rings=2, pennants=0, manager_record=[116, 46], scout_hits=9, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=45.0, spend_m=214.6, budget_m=108.8, award_lists=[['MVP3'], ['CY3', 'AS']], rings=1, pennants=1, manager_record=[95, 67], scout_hits=2, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=33.3, spend_m=61.0, budget_m=122.0, award_lists=[['AS'], ['AS', 'GG']], rings=0, pennants=0, manager_record=[60, 102], scout_hits=0, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=0.0, spend_m=0.0, budget_m=0.0, award_lists=[], rings=0, pennants=0, manager_record=None, scout_hits=0, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=44.8, spend_m=45.5, budget_m=152.1, award_lists=[], rings=3, pennants=0, manager_record=[59, 103], scout_hits=2, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=24.8, spend_m=154.0, budget_m=138.3, award_lists=[[], ['MVP3'], ['CY2', 'SS', 'ROY'], ['CY2'], []], rings=0, pennants=3, manager_record=[75, 87], scout_hits=6, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=17.3, spend_m=251.9, budget_m=210.6, award_lists=[['AS'], [], [], ['MVP2'], [], [], ['CY']], rings=1, pennants=2, manager_record=[90, 72], scout_hits=0, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=45.1, spend_m=187.8, budget_m=172.6, award_lists=[[], ['ROY', 'CY'], [], ['ROY'], ['CY3', 'CY2'], ['SS', 'GG'], ['MVP', 'MVP3', 'GG']], rings=3, pennants=1, manager_record=[95, 67], scout_hits=6, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=30.0, spend_m=156.1, budget_m=195.5, award_lists=[[], ['MVP3'], [], ['MVP']], rings=3, pennants=0, manager_record=[75, 87], scout_hits=3, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=69.1, spend_m=253.2, budget_m=146.2, award_lists=[['MVP2', 'AS', 'MVP']], rings=2, pennants=3, manager_record=[90, 72], scout_hits=9, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=49.2, spend_m=99.5, budget_m=135.2, award_lists=[['CY3'], [], []], rings=3, pennants=3, manager_record=[103, 58], scout_hits=9, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=55.0, spend_m=132.3, budget_m=60.0, award_lists=[['CY']], rings=3, pennants=2, manager_record=[103, 58], scout_hits=4, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=7.1, spend_m=29.6, budget_m=123.0, award_lists=[[], ['CY', 'MVP2', 'MVP'], ['MVP'], ['GG'], []], rings=0, pennants=3, manager_record=[95, 67], scout_hits=2, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=25.0, spend_m=67.2, budget_m=222.5, award_lists=[[], ['CY']], rings=1, pennants=0, manager_record=[59, 103], scout_hits=9, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=24.6, spend_m=14.6, budget_m=110.1, award_lists=[], rings=2, pennants=2, manager_record=[75, 87], scout_hits=3, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=72.4, spend_m=217.8, budget_m=80.5, award_lists=[[], ['AS'], ['CY2', 'GG'], [], [], ['SS', 'AS'], ['ROY'], ['CY3', 'MVP2', 'CY']], rings=2, pennants=1, manager_record=None, scout_hits=2, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=12.7, spend_m=135.4, budget_m=136.2, award_lists=[[], ['CY'], []], rings=3, pennants=1, manager_record=[59, 103], scout_hits=6, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=9.0, spend_m=131.5, budget_m=55.4, award_lists=[[], [], [], ['SS', 'ROY', 'GG'], []], rings=2, pennants=3, manager_record=[59, 103], scout_hits=0, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=64.2, spend_m=78.9, budget_m=54.6, award_lists=[[]], rings=0, pennants=1, manager_record=None, scout_hits=0, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=8.5, spend_m=37.3, budget_m=210.3, award_lists=[], rings=1, pennants=2, manager_record=[82, 80], scout_hits=9, manager_moty=False, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=40.0, spend_m=80.0, budget_m=100.0, award_lists=[['MVP']], rings=0, pennants=0, manager_record=[97, 65], scout_hits=0, manager_moty=True, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=25.0, spend_m=50.0, budget_m=100.0, award_lists=[], rings=0, pennants=0, manager_record=[88, 74], scout_hits=0, manager_moty=True, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=30.0, spend_m=90.0, budget_m=100.0, award_lists=[['AS']], rings=0, pennants=1, manager_record=[78, 84], scout_hits=1, manager_moty=True, wbc_champions=0, wbc_runners_up=0),
    dict(total_war=30.0, spend_m=50.0, budget_m=100.0, award_lists=[['AS']], rings=0, pennants=0, manager_record=None, scout_hits=0, manager_moty=False, wbc_champions=1, wbc_runners_up=0),
    dict(total_war=30.0, spend_m=50.0, budget_m=100.0, award_lists=[['AS']], rings=0, pennants=0, manager_record=None, scout_hits=0, manager_moty=False, wbc_champions=0, wbc_runners_up=1),
    dict(total_war=41.5, spend_m=88.0, budget_m=120.0, award_lists=[['AS'], []], rings=1, pennants=0, manager_record=None, scout_hits=0, manager_moty=False, wbc_champions=1, wbc_runners_up=0),
    dict(total_war=22.0, spend_m=64.0, budget_m=90.0, award_lists=[], rings=0, pennants=1, manager_record=None, scout_hits=0, manager_moty=False, wbc_champions=1, wbc_runners_up=0),
    dict(total_war=38.4, spend_m=143.0, budget_m=150.0, award_lists=[['MVP'], ['AS'], [], ['GG'], [], ['AS'], []], rings=2, pennants=1, manager_record=[101, 61], scout_hits=3, manager_moty=False, wbc_champions=5, wbc_runners_up=2),
    dict(total_war=12.0, spend_m=20.0, budget_m=80.0, award_lists=[], rings=0, pennants=0, manager_record=None, scout_hits=0, manager_moty=False, wbc_champions=8, wbc_runners_up=0),
    dict(total_war=55.3, spend_m=199.4, budget_m=175.0, award_lists=[['CY', 'AS'], ['MVP2'], [], ['SS'], [], [], ['ROY'], []], rings=3, pennants=2, manager_record=[95, 67], scout_hits=4, manager_moty=True, wbc_champions=2, wbc_runners_up=3),
    dict(total_war=18.9, spend_m=233.1, budget_m=96.0, award_lists=[['AS']], rings=1, pennants=0, manager_record=[70, 92], scout_hits=0, manager_moty=False, wbc_champions=1, wbc_runners_up=1),
]


def main() -> None:
    fixtures = [{"args": c, "expect": scoring.score(**c)} for c in CASES]
    OUT.write_text(json.dumps(fixtures, indent=1) + "\n")
    print(f"wrote {len(fixtures)} fixtures to {OUT}")


if __name__ == "__main__":
    main()

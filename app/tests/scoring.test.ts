/** Parity fixtures generated from pipeline/scoring.py (the source of truth).
 *
 *     python3 pipeline/gen_fixtures.py
 *
 * Run that whenever scoring.py changes; the diff it leaves on
 * scoring-fixtures.json is the blast radius of the change, and this suite is
 * what then holds src/lib/scoring.ts to it. Run with nothing changed it must
 * produce no diff at all.
 *
 * The line this replaces pointed at "the snippet in the repo history", which
 * was never committed — for most of this project's life the fixtures could not
 * be regenerated, so a Python-side balance change could be mirrored wrongly and
 * nothing here would fail. The generator's own case list is the record of what
 * this parity actually covers. */
import { describe, expect, it } from "vitest";
import { score } from "../src/lib/scoring";
import fixtures from "./scoring-fixtures.json";

interface Fixture {
  args: {
    total_war: number;
    spend_m: number;
    budget_m: number;
    award_lists: string[][];
    rings: number;
    pennants: number;
    manager_record: [number, number] | null;
    scout_hits: number;
    manager_moty: boolean;
    wbc_champions: number;
    wbc_runners_up: number;
  };
  expect: Record<string, number>;
}

describe("scoring parity with pipeline/scoring.py", () => {
  (fixtures as Fixture[]).forEach((f, i) => {
    it(`fixture ${i}`, () => {
      const parts = score({
        totalWar: f.args.total_war,
        spendM: f.args.spend_m,
        budgetM: f.args.budget_m,
        awardLists: f.args.award_lists,
        rings: f.args.rings,
        pennants: f.args.pennants,
        managerRecord: f.args.manager_record,
        scoutHits: f.args.scout_hits,
        managerMoty: f.args.manager_moty,
        wbcChampions: f.args.wbc_champions,
        wbcRunnersUp: f.args.wbc_runners_up,
      });
      expect(parts).toEqual(f.expect);
    });
  });
});

describe("manager folds into the win total", () => {
  it("the 2001 Mariners' manager adds +14.0 wins, not separate points", () => {
    const p = score({
      totalWar: 20,
      spendM: 50,
      budgetM: 100,
      awardLists: [],
      managerRecord: [116, 46],
    });
    expect(p.expectedWins).toBeCloseTo(84.0, 5);
    expect(p.managerWins).toBeCloseTo(14.0, 5);
    expect("skipperPoints" in p).toBe(false);
  });

  it("wins cap at 162 even with a stacked club", () => {
    const p = score({
      totalWar: 200,
      spendM: 0,
      budgetM: 100,
      awardLists: [],
      managerRecord: [116, 46],
    });
    expect(p.expectedWins).toBe(162);
  });
});

describe("Manager of the Year is trophy-case hardware", () => {
  const args = {
    totalWar: 30,
    spendM: 50,
    budgetM: 100,
    awardLists: [["MVP"]],
    managerRecord: [97, 65] as [number, number],
  };

  it("adds exactly +2 to awardPoints, leaving the win column untouched", () => {
    const plain = score(args);
    const moty = score({ ...args, managerMoty: true });
    expect(moty.awardPoints).toBe(plain.awardPoints + 2);
    expect(moty.expectedWins).toBe(plain.expectedWins);
    expect(moty.managerWins).toBe(plain.managerWins);
    expect(moty.total).toBeCloseTo(plain.total + 2, 5);
  });

  it("a non-MotY manager adds 0 (omitted and explicit false agree)", () => {
    expect(score({ ...args, managerMoty: false })).toEqual(score(args));
    expect(score(args).awardPoints).toBe(3); // the MVP only
  });
});

describe("World Baseball Classic medals ride the Ring-chasing row", () => {
  const args = { totalWar: 30, spendM: 50, budgetM: 100, awardLists: [] };

  it("a gold medal is +1.5 and a silver is +0.5, both in ringPoints", () => {
    expect(score({ ...args, wbcChampions: 1 }).ringPoints).toBe(1.5);
    expect(score({ ...args, wbcRunnersUp: 1 }).ringPoints).toBe(0.5);
    expect(score({ ...args, wbcChampions: 3, wbcRunnersUp: 2 }).ringPoints).toBe(5.5);
  });

  it("medals land in ringPoints, never in the award or win columns", () => {
    const plain = score(args);
    const medaled = score({ ...args, wbcChampions: 2 });
    expect(medaled.awardPoints).toBe(plain.awardPoints);
    expect(medaled.expectedWins).toBe(plain.expectedWins);
    expect(medaled.total).toBeCloseTo(plain.total + 3, 5);
  });

  /* Stacking is the intended behavior, not a double-count. The Classic is
   * played in March and the World Series in October, so one player-season can
   * genuinely hold both: 2017 Alex Bregman won gold with the United States and
   * a ring with Houston, and that season is worth 1.5 + 3 = 4.5. */
  it("a ring and a gold medal in the same season stack to +4.5", () => {
    expect(score({ ...args, rings: 1, wbcChampions: 1 }).ringPoints).toBe(4.5);
    // 2017 Carlos Correa: gold medal, and Houston's ring — 3 + 1.5 = 4.5.
    // 2017 Carlos Beltran on the pennant-loser ledger would be 1 + 1.5 = 2.5.
    expect(score({ ...args, pennants: 1, wbcChampions: 1 }).ringPoints).toBe(2.5);
  });

  it("no medals is the default (omitted and explicit zero agree)", () => {
    expect(score({ ...args, wbcChampions: 0, wbcRunnersUp: 0 })).toEqual(score(args));
    expect(score(args).ringPoints).toBe(0);
  });
});

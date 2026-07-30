/** Parity fixtures generated from pipeline/scoring.py (the source of truth).
 * Regenerate via the snippet in the repo history if scoring.py changes. */
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
      });
      expect(parts).toEqual(f.expect);
    });
  });
});

describe("manager folds into the win total", () => {
  it("the 2001 Mariners' manager adds +7.0 wins, not separate points", () => {
    const p = score({
      totalWar: 20,
      spendM: 50,
      budgetM: 100,
      awardLists: [],
      managerRecord: [116, 46],
    });
    expect(p.expectedWins).toBeCloseTo(77.0, 5);
    expect(p.managerWins).toBeCloseTo(7.0, 5);
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

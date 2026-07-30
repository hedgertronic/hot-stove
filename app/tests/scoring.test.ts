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
    skipper_record: [number, number] | null;
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
        skipperRecord: f.args.skipper_record,
      });
      expect(parts).toEqual(f.expect);
    });
  });
});

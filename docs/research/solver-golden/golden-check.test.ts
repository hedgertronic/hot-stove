/** TEMP — the solver equivalence gate. Delete with the refactor.
 *
 * Replays every recorded engine input through the WORKING TREE's solver and
 * demands byte-identical output. This is the whole safety net for optimizing
 * bestroster.ts: the solver is the finale's scoring yardstick, so "faster" is
 * only acceptable when the club that comes back is the same club, down to
 * pick order and the last decimal of `total`.
 *
 * Regenerate the corpus with zz-golden-gen.test.ts, and only ever from a
 * commit whose solver output is known good. */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { bestRoster } from "../src/lib/bestroster";
import type { BestClubOptions, BestRoster } from "../src/lib/bestroster";
import type { Card } from "../src/lib/types";

const GOLDEN =
  "/private/tmp/claude-501/-Users-hedgertronic-Developer-personal-projects/" +
  "3218be39-5aac-4add-9fe6-5e83d5876e5f/scratchpad/golden/solver-golden.json";

interface GoldenCase {
  cards: Card[];
  opts: BestClubOptions;
  expected: BestRoster;
}

describe("the solver's output is unchanged", () => {
  const cases: GoldenCase[] = JSON.parse(fs.readFileSync(GOLDEN, "utf8"));

  it(`matches the golden corpus on every recorded input`, { timeout: 300_000 }, () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
    const bad: string[] = [];
    cases.forEach((c, i) => {
      const got = JSON.stringify(bestRoster(c.cards, c.opts));
      if (got !== JSON.stringify(c.expected))
        bad.push(`case ${i} (${c.cards.length} cards, cap ${c.opts.fixedBudgetM})`);
    });
    expect(bad, `solver output changed on ${bad.length}/${cases.length} cases`).toEqual([]);
  });
});

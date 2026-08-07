/** The pedigree flags on the front-office timeline (data/specials.json).
 *
 * The manager career sheet hangs 💍/🚩 on a season row straight off these
 * flags, without loading that season's card — so the timeline has to agree
 * with the cards' own ws/pen, and both ways it can drift are silent: a
 * missing flag is a ringless championship row, a doubled one is a second
 * champion in a year that had one. Baseball's own invariant is the tripwire:
 * every season year crowns exactly one World Series winner and exactly one
 * pennant winner who lost it, no club does both, and 1994 — the strike —
 * crowns nobody.
 *
 * Reads data/specials.json off disk, the same file loadSpecials fetches.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface SpecialRow {
  team: string;
  year: number;
  ws?: boolean;
  pen?: boolean;
}

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "data",
);
const specials = JSON.parse(
  fs.readFileSync(path.join(dataDir, "specials.json"), "utf8"),
) as Record<string, SpecialRow[]>;
const rows = Object.values(specials).flat();

describe("specials.json pedigree flags", () => {
  it("crowns exactly one champion and one pennant loser per year", () => {
    const years = [...new Set(rows.map((r) => r.year))];
    for (const y of years) {
      const season = rows.filter((r) => r.year === y);
      // 1994: the strike cancelled the postseason — no champion, no pennant.
      const crowns = y === 1994 ? 0 : 1;
      expect(season.filter((r) => r.ws === true)).toHaveLength(crowns);
      expect(season.filter((r) => r.pen === true)).toHaveLength(crowns);
    }
  });

  it("writes the flags lean: only true, never both on one row", () => {
    for (const r of rows) {
      expect(r.ws === undefined || r.ws === true).toBe(true);
      expect(r.pen === undefined || r.pen === true).toBe(true);
      expect(r.ws && r.pen).toBeFalsy();
    }
  });
});

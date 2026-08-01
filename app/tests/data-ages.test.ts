/** The `age` field on every card player-season, at the tails.
 *
 * Age is an age-badge input ("OLD HEADS" / "YOUNG GUNS" count players over and
 * under a threshold), so the badges are only as trustworthy as the extremes of
 * this field. Both ways it can go wrong are silent: a missing age drops a
 * player out of every age bucket, and a wrong one plants him at a tail. Bob
 * McClure shipped at 94-101 across ten team-seasons — a 19th-century namesake
 * won the bbrefID join in pipeline/transform.py — and five more players shipped
 * with no age at all, none of it visible to any test over forged rosters.
 *
 * Reads data/cards/*.json off disk, walked through data/index.json — the same
 * list the engine loads from, matching tests/badges-supply.test.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** The window a real MLB player-season falls in. Loose on purpose: it is a
 * corruption tripwire, not a record book. The actual extremes in the 1985-2025
 * data are 19 (Beltré, Griffey Jr., Harper, Hernández, Luciano, Machado) and
 * 49 (Jamie Moyer, COL 2012). */
const AGE_MIN = 17;
const AGE_MAX = 55;

interface CardPlayerRow {
  id: string;
  name: string;
  age?: number;
}
interface CardRow {
  year: number;
  team: string;
  players: CardPlayerRow[];
}

const DATA_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..", "data");
const readJson = <T,>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(DATA_ROOT, rel), "utf8")) as T;

const INDEX = readJson<{ cards: { team: string; year: number }[] }>("index.json");
const CARDS: CardRow[] = INDEX.cards.map((c) =>
  readJson<CardRow>(`cards/${c.team}_${c.year}.json`),
);

const rows = CARDS.flatMap((c) =>
  c.players.map((p) => ({ card: `${c.team}_${c.year}`, year: c.year, p })),
);

describe("every card player-season carries a plausible age", () => {
  it("walks a full set of cards with players on them", () => {
    expect(CARDS.length).toBeGreaterThan(1000);
    expect(rows.length).toBeGreaterThan(20000);
  });

  it("leaves no player-season without an age", () => {
    const missing = rows.filter((r) => r.p.age === undefined);
    expect(missing.map((r) => `${r.card} ${r.p.id} ${r.p.name}`)).toEqual([]);
  });

  it("keeps every age an integer inside the plausible window", () => {
    const bad = rows.filter(
      (r) => !Number.isInteger(r.p.age) || r.p.age! < AGE_MIN || r.p.age! > AGE_MAX,
    );
    expect(bad.map((r) => `${r.card} ${r.p.id} ${r.p.name} age=${r.p.age}`)).toEqual([]);
  });

  it("keeps a player's age moving with the calendar across his seasons", () => {
    // A single bad birth year is internally consistent — McClure's ages
    // advanced correctly from 94 to 101 — so the range check alone is not
    // enough. Age must track the season year for the same id: the gap between
    // any two of a player's seasons equals the gap between the two years.
    const byId = new Map<string, Map<number, number>>();
    for (const r of rows) {
      if (r.p.age === undefined) continue;
      const seasons = byId.get(r.p.id) ?? new Map<number, number>();
      seasons.set(r.year, r.p.age);
      byId.set(r.p.id, seasons);
    }
    const drift: string[] = [];
    for (const [id, seasons] of byId) {
      const years = [...seasons.keys()].sort((a, b) => a - b);
      const base = years[0];
      for (const y of years) {
        if (seasons.get(y)! - seasons.get(base)! !== y - base) {
          drift.push(`${id} ${base}=${seasons.get(base)} vs ${y}=${seasons.get(y)}`);
        }
      }
    }
    expect(drift).toEqual([]);
  });
});

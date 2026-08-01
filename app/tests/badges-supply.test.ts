/** The data facts the badge set stands on (src/lib/badges).
 *
 * Every assertion here breaks SILENTLY without this file. A badge label names
 * a real club — "MATCHED THE 2004 RED SOX" — but the trigger is a bare number,
 * so a data regen that moved Boston's 2004 total to 97 would leave 98 wins
 * awarding a badge for a season that no longer exists at 98. Nothing in the
 * app would throw and no unit test over forged facts could notice: the badge
 * table is arithmetically fine and only the claim it makes about baseball has
 * gone wrong.
 *
 * Reads data/cards/*.json off disk, the same source the engine fetches at
 * runtime (see tests/bots/harness.ts for the fetch-boundary stub). No engine,
 * no fixtures — just the cards and the labels.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BADGES, CROWN_WINS, MATCHED, WORST_WINS } from "../src/lib/badges";

interface CardPlayerRow {
  /** The stable id 🏦 keys on — a name is not enough, the trigger reads ids. */
  id: string;
  name: string;
  pos: string;
  awards: string[];
}
interface CardRow {
  year: number;
  team: string;
  wins: number;
  losses: number;
  ws: boolean;
  players: CardPlayerRow[];
}

const DATA_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..", "data");
const readJson = <T,>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(DATA_ROOT, rel), "utf8")) as T;

/** Every card the game can deal, walked through index.json — the same list the
 * engine loads from, so a card on disk that the index forgot is invisible here
 * for the same reason it is invisible in play. */
const INDEX = readJson<{ cards: { team: string; year: number }[] }>("index.json");
const CARDS: CardRow[] = INDEX.cards.map((c) =>
  readJson<CardRow>(`cards/${c.team}_${c.year}.json`),
);

const card = (team: string, year: number): CardRow => {
  const hit = CARDS.find((c) => c.team === team && c.year === year);
  expect(hit, `${team} ${year} is missing from data/cards`).toBeDefined();
  return hit!;
};

/** Each named rung, the club it claims, and whether that club won the Series.
 * SEA 2001 is the one entry that did not — it is the RECORD rung, and the file
 * comment in badges.ts turns on exactly that distinction. */
const RUNGS: { badge: string; team: string; year: number; wins: number; ws: boolean }[] = [
  { badge: "redsox", team: "BOS", year: 2004, wins: 98, ws: true },
  { badge: "cubs", team: "CHC", year: 2016, wins: 103, ws: true },
  { badge: "astros", team: "HOU", year: 2022, wins: 106, ws: true },
  { badge: "mets", team: "NYM", year: 1986, wins: 108, ws: true },
  { badge: "yankees", team: "NYY", year: 1998, wins: 114, ws: true },
  { badge: "mariners", team: "SEA", year: 2001, wins: 116, ws: false },
];

describe("the cards are readable at all", () => {
  it("loads a full season's worth of clubs, each with a roster", () => {
    expect(CARDS.length).toBeGreaterThan(1000);
    for (const c of CARDS) expect(c.players.length).toBeGreaterThan(0);
  });
});

describe("the named rungs still stand on their clubs", () => {
  it("holds every rung's exact win total", () => {
    for (const r of RUNGS) expect(card(r.team, r.year).wins, `${r.team} ${r.year}`).toBe(r.wins);
  });

  it("keeps every champion rung a champion, and the record rung not one", () => {
    for (const r of RUNGS) expect(card(r.team, r.year).ws, `${r.team} ${r.year}`).toBe(r.ws);
    expect(RUNGS.filter((r) => !r.ws)).toEqual([
      { badge: "mariners", team: "SEA", year: 2001, wins: 116, ws: false },
    ]);
  });

  it("has one rung per total in MATCHED, and no orphan labels", () => {
    expect(Object.keys(MATCHED)).toHaveLength(RUNGS.length);
    for (const r of RUNGS) expect(MATCHED[r.wins]).toBe(r.badge);
    for (const key of Object.values(MATCHED)) {
      expect(BADGES.some((b) => b.key === key), `${key} has no badge`).toBe(true);
    }
  });

  it("keeps 116 the most wins anyone in the set ever managed", () => {
    const most = Math.max(...CARDS.map((c) => c.wins));
    expect(most).toBe(116);
    // Which is what makes 117 "best record of all time" rather than a rung.
    expect(CROWN_WINS).toBe(most + 1);
    const holders = CARDS.filter((c) => c.wins === most).map((c) => `${c.team} ${c.year}`);
    expect(holders).toEqual(["SEA 2001"]);
  });

  /** The floor's mirror of the 116/CROWN_WINS pin above. 📉 claims to sit
   * below the worst record anyone ever posted, so it has to sit one win under
   * the real minimum — and the minimum must be read off FULL seasons only.
   * 1994, 1995, and 2020 were all shortened, and their sub-40-win totals are
   * short schedules rather than bad clubs; counting them would drag WORST_WINS
   * down to a number no 162-game season could ever reach. */
  it("keeps 41 the fewest wins any full season in the set managed", () => {
    const full = CARDS.filter((c) => c.wins + c.losses > 150);
    // The filter earns its keep: the seasons it drops are exactly the three
    // shortened ones, and one of them holds a total below WORST_WINS.
    const dropped = [...new Set(CARDS.filter((c) => c.wins + c.losses <= 150).map((c) => c.year))];
    expect(dropped.sort()).toEqual([1994, 1995, 2020]);
    expect(Math.min(...CARDS.map((c) => c.wins))).toBeLessThan(WORST_WINS);

    const fewest = Math.min(...full.map((c) => c.wins));
    expect(fewest).toBe(41);
    expect(WORST_WINS).toBe(fewest - 1);
    const holders = full
      .filter((c) => c.wins === fewest)
      .map((c) => `${c.team} ${c.year} ${c.wins}-${c.losses}`);
    expect(holders).toEqual(["CHW 2024 41-121"]);
  });

  /** 109–113 is bare because baseball never put a champion there, which is the
   * claim badges.ts makes in its file comment. 99 is bare by CHOICE — three
   * champions sit on it (below) — so it is asserted separately and must not be
   * confused for the same kind of gap. */
  it("finds no champion at all between the Mets and the Yankees", () => {
    for (const wins of [109, 110, 111, 112, 113]) {
      const champs = CARDS.filter((c) => c.wins === wins && c.ws).map((c) => `${c.team} ${c.year}`);
      expect(champs, `${wins} wins`).toEqual([]);
    }
    // The one club in the band, and it lost the NLDS.
    const band = CARDS.filter((c) => c.wins >= 109 && c.wins <= 113).map(
      (c) => `${c.team} ${c.year}`,
    );
    expect(band).toEqual(["LAD 2022"]);
  });

  it("records that 99 wins is an unclaimed rung, not an empty one", () => {
    const champs = CARDS.filter((c) => c.wins === 99 && c.ws)
      .map((c) => `${c.team} ${c.year}`)
      .sort();
    expect(champs).toEqual(["ANA 2002", "CHW 2005", "OAK 1989"]);
    // No badge claims the total. If one is ever added, this is the shortlist.
    expect(MATCHED[99]).toBeUndefined();
  });
});

describe("the era badges still have their seasons", () => {
  it("leaves 1994 the only season the set has no champion for", () => {
    const years = [...new Set(CARDS.map((c) => c.year))].sort();
    const championless = years.filter((y) => !CARDS.some((c) => c.year === y && c.ws));
    expect(championless).toEqual([1994]);
  });

  it("carries no All-Star nod anywhere in 2020 — the game was never played", () => {
    const nods = CARDS.filter((c) => c.year === 2020).flatMap((c) =>
      c.players.filter((p) => p.awards.includes("AS")).map((p) => `${c.team} ${p.name}`),
    );
    expect(nods).toEqual([]);
    // Which is the whole reason 🏅 and 🦠 can never appear on the same club.
    expect(CARDS.some((c) => c.year === 2020)).toBe(true);
  });

  it("still holds both scandal seasons, each with a roster to draft from", () => {
    for (const year of [2017, 2018]) {
      const c = card("HOU", year);
      expect(c.players.length, `HOU ${year} roster`).toBeGreaterThan(0);
    }
  });

  /** 🏦 is keyed to an id AND a club, so it needs both halves to survive on
   * disk: the id has to still spell the same thing after a regen, and the
   * player has to still appear on a card for THAT franchise. Either half
   * going missing leaves a badge that can never fire — and nothing else in the
   * suite would notice, because every unit test forges its own roster. */
  it("can still deal Bonilla a Mets card and Ohtani a Dodgers one", () => {
    const seasons = (id: string, team: string) =>
      CARDS.filter((c) => c.team === team && c.players.some((p) => p.id === id)).map(
        (c) => c.year,
      );
    expect(seasons("bonilbo01", "NYM").length, "bonilbo01 on NYM").toBeGreaterThan(0);
    expect(seasons("ohtansh01", "LAD").length, "ohtansh01 on LAD").toBeGreaterThan(0);
    // And the clubs the badge deliberately does NOT name are still draftable
    // too — the trigger is a choice between real options, not the only card
    // either player has.
    expect(seasons("bonilbo01", "PIT").length, "bonilbo01 on PIT").toBeGreaterThan(0);
    expect(seasons("ohtansh01", "LAA").length, "ohtansh01 on LAA").toBeGreaterThan(0);
  });
});

describe("the two-way guy is still findable", () => {
  it("has exactly five slashed-position seasons in the set", () => {
    const twoWay = CARDS.flatMap((c) =>
      c.players.filter((p) => p.pos.includes("/")).map((p) => `${p.name} ${c.year} ${c.team}`),
    );
    expect(twoWay).toHaveLength(5);
    // 🃏 is a badge about one player; if that ever stops being true the card's
    // own copy needs rewriting, not just its frequency.
    expect(new Set(twoWay.map((s) => s.split(" ").slice(0, 2).join(" "))).size).toBe(1);
  });
});

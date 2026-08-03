/** The passport: the country table, the lifetime collection, and the two
 * surfaces that draw it.
 *
 * Four things are under test and they are different claims.
 *
 * `COUNTRIES` is a claim about the DATA, so it is checked against the data.
 * Every flag, tier and measured rate is re-derived from data/cards here — the
 * same idiom badges-supply.test.ts uses on the badge table, for the same
 * reason. A hand-typed table checked against a hand-typed list can only prove
 * that someone typed the same thing twice; a regen that adds a country, or
 * moves one across a band line, has to fail something.
 *
 * `passport()` is a reader over `hotstove.history`, so the tolerance suite is
 * the same one `badgeCase()` gets — a store that has outlived three schema
 * changes must not be able to throw, and a row written before a field existed
 * has to read as "this season contributed nothing" rather than as a gap.
 *
 * The unique-player count is the claim with a hole in it that cannot be
 * patched. History rows record badges, countries and a record and have never
 * recorded a roster, so which PLAYERS an already-played season held is not
 * recoverable. The assertions below pin the shape of that degradation: an old
 * row still stamps, still dates the stamp, and contributes no players, and the
 * panel shows no number rather than a zero.
 *
 * The panels are the design claim: a SOUVENIR, never a checklist. Nothing in
 * the game shows a birth country until the season is over, and 15 of the 39
 * countries in the dataset have exactly one draftable man, so a grid of empty
 * slots would be pointing a player at a hunt they have no way to run. The
 * assertions here are what stops that shape from creeping back — no
 * denominator, no locked slot, and no panel at all until the first stamp
 * lands.
 *
 * Rendered SSR, the same idiom trophycase.test.ts and finale-reveal.test.ts
 * use and for the same reason: neither TrophyModal nor Finale fetches
 * anything, their markup is a pure function of props plus storage, and a node
 * environment can own localStorage outright. The trophy case's two panels are
 * both in the markup with the inactive one `hidden`, which is what lets an SSR
 * string see the passport without a click to reach it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "svelte/server";
import Finale from "../src/components/Finale.svelte";
import TrophyModal from "../src/components/TrophyModal.svelte";
import { COLLECTIBLE, RARITY_ORDER } from "../src/lib/badges";
import { finaleUnder } from "../src/lab/fixtures";
import {
  COUNTRIES,
  countryDef,
  passport,
  type PassportStamp,
} from "../src/lib/settings";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

/** Seed `hotstove.history` with raw rows — untyped on purpose, since the
 * malformed shapes under test are exactly what the interface forbids. */
function seed(...entries: unknown[]): void {
  store.set("hotstove.history", JSON.stringify(entries));
}

/** A well-formed finished game, countries aside. */
function game(countries: unknown, date = "2026-08-01"): unknown {
  return {
    v: 2,
    date,
    total: 120,
    record: "95-67",
    spins: 3,
    difficulty: "standard",
    bank: "classic",
    badges: ["hundred"],
    countries,
  };
}

/** A finished game that carries rosters — the row the engine writes once it
 * hands over player ids. Forged by hand so every assertion below holds before
 * that half lands. */
function rostered(countryPlayers: unknown, date = "2026-08-01"): unknown {
  const named =
    typeof countryPlayers === "object" && countryPlayers !== null && !Array.isArray(countryPlayers)
      ? Object.keys(countryPlayers)
      : [];
  return { ...(game(named, date) as object), countryPlayers };
}

function modal(): string {
  return render(TrophyModal, { props: { onclose: () => {} } }).body;
}

/** Only the passport section of the case, bounded at both ends, so an assertion
 * about the souvenir cannot pass or fail on the badge ladder above it or on the
 * sheet's own CLOSE button below it. An unbounded slice is how a panel
 * assertion quietly becomes a whole-sheet assertion.
 *
 * The passport is the last band on the sheet rather than a tab of its own, so
 * the front edge is its heading and the back edge is the CLOSE button. */
function panel(): string {
  const body = modal();
  const at = body.indexOf('<div class="psep">PASSPORT</div>');
  if (at < 0) return "";
  const end = body.indexOf('class="btn cancel', at);
  return body.slice(at, end < 0 ? undefined : end);
}

/** Only the STAMPS a career has actually collected — the passport section with
 * the grayed-out slots for every unvisited country stripped out. Almost every
 * assertion here is about what a player has, and the board is thirty-odd flags
 * of what they do not. */
function found(): string {
  return panel()
    .split('<span class="stamp')
    .filter((chunk, i) => i === 0 || !/^[^"]*\blocked\b/.test(chunk))
    .join('<span class="stamp');
}

/** The finale of a club whose men were born where these say, one country per
 * roster seat. `undefined` leaves a seat with no country at all. */
function finale(...countries: (string | undefined)[]): string {
  const g = finaleUnder();
  countries.forEach((bc, i) => {
    const seat = g.slots[i];
    if (seat) seat.bc = bc;
  });
  return render(Finale, {
    props: { game: g, onreplay: () => {}, onmodes: () => {}, resolved: true },
  }).body;
}

/** Only the finale's row of stamps, bounded at both ends. The stamps are the
 * `<span>`s inside one `<div class="stamps">`, so the first `</div>` past the
 * label closes it — which matters, because THE DREAM TEAM renders directly
 * below and an unbounded slice would let its eight roster rows answer
 * assertions about the passport. */
function finaleStamps(...countries: (string | undefined)[]): string {
  const body = finale(...countries);
  const at = body.indexOf('aria-label="Countries fielded"');
  if (at < 0) return "";
  const end = body.indexOf("</div>", at);
  return body.slice(at, end < 0 ? undefined : end);
}

/** A stamp is found by its ACCESSIBLE NAME, not by its text. The board prints
 * flags alone — a passport is read by its marks — so the country's name lives
 * in `aria-label` and the tooltip, and that is the only place a test can look
 * it up. Anchored on the delimiter that follows so "Japan" cannot match a
 * country merely beginning with it. */
function stampFor(markup: string, country: string): string {
  const esc = country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const chunk of markup.split('<span class="stamp').slice(1)) {
    if (new RegExp(`aria-label="${esc}[,."]`).test(chunk)) return chunk;
  }
  throw new Error(`no stamp for ${country}`);
}

/** Whatever the stamp naming a country wears BESIDES `stamp` and its style
 * hash — the tier a reader actually sees, rather than the tier the reader
 * returned. An empty list is a stamp with no tier at all. */
function stampClass(markup: string, country: string): string[] {
  const chunk = stampFor(markup, country);
  return chunk
    .slice(0, chunk.indexOf('"'))
    .trim()
    .split(/\s+/)
    .filter((c) => c !== "" && !c.startsWith("svelte-"));
}

/** Where a country's stamp sits on the board, for the ordering tests. */
function stampAt(markup: string, country: string): number {
  const esc = country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const i = markup.search(new RegExp(`aria-label="${esc}[,."]`));
  if (i < 0) throw new Error(`no stamp for ${country}`);
  return i;
}

/** Country names only, in the order the reader returns them. */
function names(): string[] {
  return passport().map((s) => s.country);
}

/** A stamp minus its decoration — what the reader claims about the LOG, which
 * is a separate question from what the table says about the country. */
function core(s: PassportStamp) {
  return {
    country: s.country,
    first: s.first,
    visits: s.visits,
    players: s.players,
    counted: s.counted,
  };
}

function cores() {
  return passport().map(core);
}

beforeEach(() => store.clear());

/* ---------- the table, against the corpus it describes ---------- */

const DATA_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..", "data");
const readJson = <T,>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(DATA_ROOT, rel), "utf8")) as T;

interface CardRow {
  players: { id: string; bc?: string }[];
}
interface IndexRow {
  team: string;
  year: number;
}

/** Every card the game can deal, walked through index.json — the same list the
 * engine loads from, so a card on disk the index forgot is invisible here for
 * the same reason it is invisible in play. */
const INDEX = readJson<{ cards: IndexRow[] }>("index.json");
const CARDS: CardRow[] = INDEX.cards.map((c) =>
  readJson<CardRow>(`cards/${c.team}_${c.year}.json`),
);

/** Player-seasons per birth country across the whole corpus, which is the
 * population `freq` is measured over. */
const SUPPLY = new Map<string, number>();
let SEASONS = 0;
for (const c of CARDS) {
  for (const p of c.players) {
    if (typeof p.bc !== "string" || p.bc === "") continue;
    SUPPLY.set(p.bc, (SUPPLY.get(p.bc) ?? 0) + 1);
    SEASONS += 1;
  }
}

/** The chance a club of eight holds at least one man born in a country, as a
 * percent — eight independent draws from the pool of player-seasons. The same
 * arithmetic `CountryDef.freq` records, recomputed rather than restated. */
function clubRate(country: string): number {
  const share = (SUPPLY.get(country) ?? 0) / SEASONS;
  return 100 * (1 - Math.pow(1 - share, 8));
}

/** The band a rate falls in. One rung per order of magnitude of club rate. */
function band(rate: number): string {
  if (rate >= 20) return "common";
  if (rate >= 5) return "uncommon";
  if (rate >= 1) return "rare";
  return "ultra";
}

describe("the country table", () => {
  it("covers exactly the countries the cards spell, and no others", () => {
    // The two failure directions are different bugs and both are silent. A
    // country in the data with no entry loses its flag and its tier to
    // `countryDef`'s null path; an entry with no country in the data is a
    // stamp nobody can ever earn sitting in a table that claims to be
    // measured.
    expect(Object.keys(COUNTRIES).sort()).toEqual([...SUPPLY.keys()].sort());
    expect(SUPPLY.size).toBe(39);
    expect(SEASONS).toBe(35720);
  });

  it("records the rate each country was actually measured at", () => {
    // `freq` lives beside the definition so it cannot go stale in a comment
    // somewhere else. This is what makes that true: a data regen that moves
    // the supply fails the table instead of quietly outdating it.
    for (const [country, def] of Object.entries(COUNTRIES)) {
      expect(Math.abs(def.freq - clubRate(country)), `${country} freq`).toBeLessThan(0.05);
    }
  });

  it("tiers every country by the band its rate falls in", () => {
    for (const [country, def] of Object.entries(COUNTRIES)) {
      expect(def.rarity, `${country} tier`).toBe(band(clubRate(country)));
    }
  });

  it("stops at ultra — no legendary rung and no anti-trophy", () => {
    // The ladder is the badge set's own (RARITY_ORDER), and the passport takes
    // the four middle rungs. `legendary` is the top of a badge AXIS and a
    // country is not an axis; `ironic` is an anti-trophy, and no birthplace is
    // one.
    const tiers = new Set(Object.values(COUNTRIES).map((d) => d.rarity));
    for (const t of tiers) expect(RARITY_ORDER).toContain(t);
    expect(tiers.has("legendary")).toBe(false);
    expect(tiers.has("ironic")).toBe(false);
    expect([...tiers].sort()).toEqual(["common", "rare", "ultra", "uncommon"]);
  });

  it("splits 4 / 4 / 7 / 24 across the four rungs", () => {
    // The whole set accounted for, so a country cannot be quietly re-tiered
    // into a band that already had the right names in it.
    const per = (r: string) => Object.values(COUNTRIES).filter((d) => d.rarity === r).length;
    expect([per("common"), per("uncommon"), per("rare"), per("ultra")]).toEqual([4, 4, 7, 24]);
    expect(per("common") + per("uncommon") + per("rare") + per("ultra")).toBe(39);
  });

  it("gives every country a real flag sequence", () => {
    // A mangled literal is the failure this catches, and it is invisible by
    // eye: a flag is either two regional indicators (🇯🇵) or the seven
    // code points of a subdivision tag sequence (🏴󠁧󠁢󠁥󠁮󠁧󠁿). Anything else renders
    // as loose letters or a stray black flag.
    for (const [country, def] of Object.entries(COUNTRIES)) {
      const cps = [...def.flag].map((c) => c.codePointAt(0)!);
      const pair = cps.length === 2 && cps.every((c) => c >= 0x1f1e6 && c <= 0x1f1ff);
      const tagged =
        cps.length === 7 &&
        cps[0] === 0x1f3f4 &&
        cps[cps.length - 1] === 0xe007f &&
        cps.slice(1, -1).every((c) => c >= 0xe0020 && c <= 0xe007e);
      expect(pair || tagged, `${country} flag ${JSON.stringify(def.flag)}`).toBe(true);
    }
  });

  it("keeps the two subdivision flags, which are the two that can fail to draw", () => {
    // Tag characters are default-ignorable, so a platform that does not know
    // the sequence draws the base 🏴 and drops the rest — a poorer stamp, never
    // a tofu box. The country's NAME is printed on every stamp, so no stamp is
    // ambiguous about which country it is even when the flag gives up.
    expect([...COUNTRIES["England"].flag][0]).toBe("🏴");
    expect([...COUNTRIES["Scotland"].flag][0]).toBe("🏴");
  });

  it("hands back nothing for a country it does not know", () => {
    expect(countryDef("Atlantis")).toBeNull();
    expect(countryDef("")).toBeNull();
    // The lookup key comes out of localStorage, so it can be any string at
    // all. A plain object lookup would walk the prototype chain and return a
    // function for these.
    expect(countryDef("constructor")).toBeNull();
    expect(countryDef("__proto__")).toBeNull();
    expect(countryDef("toString")).toBeNull();
  });
});

/* ---------- the reader ---------- */

describe("passport()", () => {
  it("round-trips a season's countries out of storage", () => {
    seed(game(["USA", "Dominican Republic", "Japan"]));
    expect(names().sort()).toEqual(["Dominican Republic", "Japan", "USA"]);
    expect(passport().every((s) => s.visits === 1)).toBe(true);
    expect(passport().every((s) => s.first === "2026-08-01")).toBe(true);
  });

  it("decorates each stamp out of the country table", () => {
    seed(game(["Japan", "USA", "Curaçao"]));
    const by = new Map(passport().map((s) => [s.country, s]));
    expect(by.get("Japan")).toMatchObject({ flag: "🇯🇵", rarity: "uncommon", freq: 6.38 });
    expect(by.get("USA")).toMatchObject({ flag: "🇺🇸", rarity: "common", freq: 100 });
    expect(by.get("Curaçao")).toMatchObject({ flag: "🇨🇼", rarity: "rare" });
  });

  it("stamps a country the table does not know, without decorating it", () => {
    // A data regen that adds a fortieth country must cost the row its color,
    // never its row. Null is "no tier", deliberately not a defaulted `common`:
    // guessing a rarity would print one the data never measured.
    seed(game(["Atlantis"]));
    expect(passport()).toEqual([
      {
        country: "Atlantis",
        flag: "",
        rarity: null,
        freq: null,
        first: "2026-08-01",
        visits: 1,
        players: 0,
        counted: 0,
      },
    ]);
    // And the panel draws the row anyway.
    expect(panel()).toContain("Atlantis");
  });

  it("unions across games and counts visits by GAME, not by player", () => {
    // Three men from one country in one club is one visit, the same way a
    // history row naming a badge three times is one earn.
    seed(
      game(["USA", "USA", "Venezuela"], "2026-01-01"),
      game(["USA", "Cuba"], "2026-02-01"),
    );
    expect(cores()).toEqual([
      { country: "Cuba", first: "2026-02-01", visits: 1, players: 0, counted: 0 },
      { country: "Venezuela", first: "2026-01-01", visits: 1, players: 0, counted: 0 },
      { country: "USA", first: "2026-01-01", visits: 2, players: 0, counted: 0 },
    ]);
  });

  it("returns discovery order, newest first", () => {
    // `loadHistory` is oldest first, so insertion order IS discovery order.
    // The newest stamp is the one worth looking at, so it leads. Rarity does
    // NOT re-sort this: a list ordered rarest-first is a ladder, and a ladder
    // is a thing to climb.
    seed(
      game(["USA"], "2026-01-01"),
      game(["Mexico"], "2026-02-01"),
      game(["Curaçao"], "2026-03-01"),
    );
    expect(names()).toEqual(["Curaçao", "Mexico", "USA"]);
  });

  it("keeps the FIRST date a country was fielded, not the latest", () => {
    seed(game(["Japan"], "2026-01-01"), game(["Japan"], "2026-05-05"));
    expect(cores()).toEqual([
      { country: "Japan", first: "2026-01-01", visits: 2, players: 0, counted: 0 },
    ]);
  });

  it("is global across bank and difficulty, like the trophy case", () => {
    // A record book is a leaderboard and scopes by mode; a collection does
    // not. Splitting this by bank would fragment one passport into three.
    seed(
      { v: 2, total: 1, difficulty: "scout", bank: "moneyball", countries: ["Aruba"] },
      { v: 2, total: 1, difficulty: "standard", bank: "blankcheck", countries: ["Panama"] },
    );
    expect(names().sort()).toEqual(["Aruba", "Panama"]);
  });

  /* ---- the tolerance suite: every shape the oldest store in the app holds ---- */

  it("reads an absent store as an empty passport", () => {
    expect(passport()).toEqual([]);
  });

  it("reads an unparseable store as an empty passport", () => {
    store.set("hotstove.history", "{not json");
    expect(passport()).toEqual([]);
    store.set("hotstove.history", '"a string, not an array"');
    expect(passport()).toEqual([]);
  });

  it("ignores rows written before the field existed", () => {
    // Every row in every player's log today is one of these, so this is the
    // shipping case rather than an edge one.
    seed({ v: 2, date: "2026-01-01", total: 120, record: "95-67", spins: 3 });
    expect(passport()).toEqual([]);
  });

  it("ignores a countries value that is not an array", () => {
    seed(game("USA"), game(42), game(null), game({ USA: true }), game(["Peru"]));
    expect(names()).toEqual(["Peru"]);
  });

  it("drops non-string and empty members rather than stamping them", () => {
    // An empty string would render as a blank stamp; a number would render as
    // a number. Neither is a country.
    seed(game(["Belize", "", "   ", 7, null, undefined, { x: 1 }]));
    expect(names()).toEqual(["Belize"]);
  });

  it("trims and de-duplicates within a single row", () => {
    seed(game([" Canada ", "Canada"]));
    expect(cores()).toEqual([
      { country: "Canada", first: "2026-08-01", visits: 1, players: 0, counted: 0 },
    ]);
  });

  it("survives a row with no parseable date", () => {
    // `first` is display only, so a missing date costs the stamp its caption
    // and nothing else.
    seed({ v: 2, countries: ["Guam"] }, { v: 2, date: 5, countries: ["Guam"] });
    expect(cores()).toEqual([
      { country: "Guam", first: "", visits: 2, players: 0, counted: 0 },
    ]);
  });

  it("skips an unscored quit row", () => {
    // A quit writes `{ date, badges: ["packedin"] }` and nothing else — a real
    // shape in the log, not a hypothetical. It produced no season, so it
    // stamps no country.
    seed({ date: "2026-01-01", badges: ["packedin"] }, game(["Japan"], "2026-02-01"));
    expect(cores()).toEqual([
      { country: "Japan", first: "2026-02-01", visits: 1, players: 0, counted: 0 },
    ]);
  });

  it("survives a null row in the log", () => {
    seed(null, game(["Taiwan"]), undefined);
    expect(names()).toEqual(["Taiwan"]);
  });
});

/* ---------- the unique-player count ---------- */

describe("the player count", () => {
  it("counts different PEOPLE, not seasons and not appearances", () => {
    // A man rostered in three separate seasons is one player; two different
    // Venezuelans are two. Ids are what make that true — names collide and a
    // count cannot be unioned.
    seed(
      rostered({ Venezuela: ["cabremi01"] }, "2026-01-01"),
      rostered({ Venezuela: ["cabremi01", "altuvjo01"] }, "2026-02-01"),
      rostered({ Venezuela: ["cabremi01"] }, "2026-03-01"),
    );
    expect(cores()).toEqual([
      { country: "Venezuela", first: "2026-01-01", visits: 3, players: 2, counted: 3 },
    ]);
  });

  it("de-duplicates ids inside one row", () => {
    seed(rostered({ Cuba: ["puigya01", "puigya01"] }));
    expect(passport()[0]).toMatchObject({ players: 1, counted: 1, visits: 1 });
  });

  it("counts a country nothing else named — ids alone are enough to stamp", () => {
    // The two fields are read independently, so a row carrying only rosters
    // still produces a stamp.
    seed({ v: 2, date: "2026-01-01", total: 1, countryPlayers: { Aruba: ["jonesan01"] } });
    expect(cores()).toEqual([
      { country: "Aruba", first: "2026-01-01", visits: 1, players: 1, counted: 1 },
    ]);
  });

  it("leaves a row that predates the field with its stamp, its date, and no players", () => {
    // THE degradation, and it cannot be patched: a history row records badges,
    // countries and a record and has never recorded a roster, so which players
    // an already-played season held is gone. The old game still establishes the
    // country and still owns the first-seen date.
    seed(
      game(["Japan"], "2024-01-01"),
      rostered({ Japan: ["ohtansh01"] }, "2026-02-01"),
    );
    expect(cores()).toEqual([
      { country: "Japan", first: "2024-01-01", visits: 2, players: 1, counted: 1 },
    ]);
  });

  it("counts nothing at all while no row carries a roster", () => {
    // The state of every player's log until the engine writes the field. Every
    // stamp is present, dated and tiered, and carries no number.
    seed(game(["Japan", "Cuba"], "2026-01-01"), game(["Japan"], "2026-02-01"));
    for (const s of passport()) {
      expect(s.players).toBe(0);
      expect(s.counted).toBe(0);
      expect(s.visits).toBeGreaterThan(0);
    }
  });

  it("holds counted <= visits, and players zero exactly when counted is", () => {
    // The pair that makes the degradation checkable rather than asserted in a
    // comment. `counted` is the honesty channel: it is what tells "no season
    // named anybody" apart from "you fielded nobody".
    seed(
      game(["Japan"], "2024-01-01"),
      rostered({ Japan: ["ohtansh01"], Cuba: [] }, "2026-01-01"),
      rostered({ Mexico: ["ureliju01"] }, "2026-02-01"),
      game(["Peru"], "2026-03-01"),
    );
    for (const s of passport()) {
      expect(s.counted, s.country).toBeLessThanOrEqual(s.visits);
      expect(s.players === 0, s.country).toBe(s.counted === 0);
    }
  });

  it("does not count a row whose id list is empty or unusable", () => {
    // An empty list still names the country — the key is evidence the club
    // held it — but it contributes no ids, so counting it would put a ×0 on a
    // stamp.
    seed(
      rostered({ Cuba: [] }),
      rostered({ Cuba: [7, null, "", "   "] }, "2026-08-02"),
    );
    expect(cores()).toEqual([
      { country: "Cuba", first: "2026-08-01", visits: 2, players: 0, counted: 0 },
    ]);
  });

  it("survives every malformed shape the field can hold", () => {
    seed(
      { v: 2, date: "2026-01-01", countryPlayers: "Cuba" },
      { v: 2, date: "2026-01-01", countryPlayers: 42 },
      { v: 2, date: "2026-01-01", countryPlayers: null },
      { v: 2, date: "2026-01-01", countryPlayers: ["Cuba"] },
      { v: 2, date: "2026-01-01", countryPlayers: { Cuba: "puigya01" } },
      { v: 2, date: "2026-01-01", countryPlayers: { "": ["nobody"] } },
      { v: 2, date: "2026-01-01", countryPlayers: { "  Peru  ": ["floreje01"] } },
    );
    expect(cores()).toEqual([
      { country: "Peru", first: "2026-01-01", visits: 1, players: 1, counted: 1 },
    ]);
  });
});

/* ---------- the trophy-case panel ---------- */

describe("the passport panel", () => {
  it("shows the whole board even on a case with nothing found", () => {
    // The reversal, pinned: the panel used to appear only once a country
    // landed, so a new player saw no passport at all. It is a permanent section
    // of the sheet now, and an untravelled one is thirty-nine grayed slots.
    seed({ v: 2, date: "2026-01-01", total: 120, record: "95-67", spins: 3, badges: ["hundred"] });
    const p = panel();
    expect(p).toContain("PASSPORT");
    expect(found()).not.toContain('role="listitem"');
    expect((p.match(/role="listitem"/g) ?? []).length).toBe(Object.keys(COUNTRIES).length);
  });

  it("sits on the same page as the badges, with no tabs between them", () => {
    // One sheet, two bands, badges first. A tab hid the passport from everyone
    // who did not press it, which is worse than a scroll.
    seed(game(["Japan"]));
    const body = modal();
    expect(body).not.toContain('role="tablist"');
    expect(body).not.toContain('role="tabpanel"');
    expect(body.indexOf("LEGENDARY")).toBeLessThan(body.indexOf("PASSPORT"));
  });

  it("fills in a country that has been fielded and leaves the rest a slot", () => {
    seed(game(["Japan", "Cuba"]));
    const p = panel();
    expect(stampClass(p, "Japan")).toEqual(["uncommon"]);
    expect(stampClass(p, "Cuba")).toEqual(["uncommon"]);
    // Everything else on the board is a slot, and says so in words too.
    expect(stampClass(p, "Venezuela")).toEqual(["common", "locked"]);
    expect(p).toContain("Never fielded.");
    const total = Object.keys(COUNTRIES).length;
    expect((p.match(/role="listitem"/g) ?? []).length).toBe(total);
    expect((p.match(/ locked"/g) ?? []).length).toBe(total - 2);
  });

  it("keeps an unvisited country's tier, and marks it unvisited by its line", () => {
    // A country's rarity is a fact about the COUNTRY — true before anyone goes
    // there — so the board shows it from the first time the case is opened and
    // the gold squares are visibly the hard ones. What an unvisited slot loses
    // is the solid border and the count, never the tier.
    seed(game(["Japan"]));
    const p = panel();
    expect(stampClass(p, "USA")).toEqual(["common", "locked"]);
    expect(stampClass(p, "Panama")).toEqual(["rare", "locked"]);
    expect(stampClass(p, "Guam")).toEqual(["ultra", "locked"]);
    // …and the one it HAS been to wears the tier with no `locked` beside it.
    expect(stampClass(p, "Japan")).toEqual(["uncommon"]);
  });

  it("names every country to assistive tech, printing none of them", () => {
    // The flag IS the stamp — thirty-nine spelled-out names is a list where a
    // field of flags is a collection — but a name that only exists as a glyph
    // is a name a screen reader cannot read. So it moves to the accessible
    // name and the tooltip rather than disappearing.
    seed(rostered({ Japan: ["ohtansh01"] }, "2026-01-01"));
    const p = panel();
    for (const c of ["Japan", "USA", "Curaçao", "Lithuania"]) {
      expect(p, `${c} has no accessible name`).toContain(`aria-label="${c}`);
      expect(p, `${c} is printed as text`).not.toContain(`>${c}<`);
    }
    // The count rides along with it, so "Japan, 1" is what gets announced
    // rather than a bare flag.
    expect(stampFor(p, "Japan")).toContain('aria-label="Japan, 1');
  });

  it("leads with what has been collected", () => {
    // A board that opened on thirty-seven gray slots would bury the two stamps
    // the sheet is actually for.
    seed(game(["Lithuania"]));
    const p = panel();
    expect(stampAt(p, "Lithuania")).toBeLessThan(stampAt(p, "USA"));
  });

  it("runs the unvisited half commonest first", () => {
    // The honest order for a thing nobody chases: the countries a few more
    // seasons will turn up on their own sit at the top, and 🇱🇹 at the bottom.
    seed(game(["Japan"]));
    const p = panel();
    expect(stampAt(p, "USA")).toBeLessThan(stampAt(p, "Cuba"));
    expect(stampAt(p, "Cuba")).toBeLessThan(stampAt(p, "Panama"));
    expect(stampAt(p, "Panama")).toBeLessThan(stampAt(p, "Lithuania"));
  });

  it("flies the flag beside the name", () => {
    seed(game(["Japan", "Curaçao", "England"]));
    const p = found();
    expect(p).toContain("🇯🇵");
    expect(p).toContain("🇨🇼");
    expect(p).toContain("🏴󠁧󠁢󠁥󠁮󠁧󠁿");
  });

  it("wears the country's tier, and no tier at all for an unknown one", () => {
    seed(game(["USA", "Japan", "Panama", "Guam", "Atlantis"]));
    const p = panel();
    expect(stampClass(p, "USA")).toEqual(["common"]);
    expect(stampClass(p, "Japan")).toEqual(["uncommon"]);
    expect(stampClass(p, "Panama")).toEqual(["rare"]);
    expect(stampClass(p, "Guam")).toEqual(["ultra"]);
    // The one country the table cannot measure wears nothing — no tier, and no
    // defaulted `common` standing in for one. It has no locked slot either,
    // since the board is built from the table and the table has never heard
    // of it.
    expect(stampClass(p, "Atlantis")).toEqual([]);
  });

  it("names no denominator anywhere on the sheet", () => {
    // Not over the stamps and not over the badges. The board shows what is left
    // by drawing it; a fraction beside it would turn a collection into an
    // errand, which is the one thing a souvenir must not become.
    seed(game(["Japan", "Cuba"]));
    const body = modal();
    expect(body).toContain("TROPHY CASE");
    // A fraction, specifically — 🤝 WORD OF MOUTH is a badge label and has
    // every right to those two letters.
    expect(body).not.toMatch(/\d+ OF \d+/);
    expect(body).not.toContain(`OF ${COLLECTIBLE.length}`);
    expect(body).not.toContain("COUNTRIES");
  });

  it("borrows none of the locked-badge vocabulary for a locked country", () => {
    // A slot is a country nobody has been to, not a badge nobody has earned:
    // it keeps its flag, its tier and its name, because there is no surprise
    // to protect.
    seed(game(["Japan"]));
    const p = panel();
    expect(p).not.toContain("Not yet earned");
    expect(p).not.toContain("An undiscovered badge");
    expect(p).not.toContain("? ? ?");
    expect(p).toContain('aria-label="Lithuania');
    expect(p).toContain("🇱🇹");
  });

  it("prints the unique-player count, at one as readily as at four", () => {
    // The number means "different people", so it is information at one. The
    // badge pills hide a ×1 on purpose and this deliberately does not: a blank
    // stamp has to mean exactly one thing here, and it means "no season on
    // record named anybody".
    seed(
      rostered({ Japan: ["ohtansh01"], Cuba: ["puigya01", "abreujo02"] }, "2026-01-01"),
    );
    const p = found();
    expect(p).toContain("×1");
    expect(p).toContain("×2");
  });

  it("shows no number rather than a zero when nothing was counted", () => {
    // A silent zero would read as a bug: a country nobody is counted for is a
    // gap in the log, not a club with nobody in it. The title says which. The
    // locked half of the board carries no number either, which is why this
    // reads the found stamps alone.
    seed(game(["Japan"], "2026-01-01"), game(["Japan"], "2026-02-01"));
    const p = found();
    expect(p).not.toContain("×");
    expect(p).toContain("First fielded 2026-01-01. 2 seasons, none carrying a roster.");
  });

  it("carries no prose at all — the stamp explains itself", () => {
    // The panel used to print a two-sentence note under the board saying what
    // a number meant and which seasons had none. It is gone: a passport that
    // needs a caption to be read is not a passport, and the same two facts are
    // already on every stamp's own title, where they belong to the country
    // being asked about rather than to the board.
    seed(game(["Japan"], "2024-01-01"), rostered({ Japan: ["ohtansh01"] }, "2026-01-01"));
    const p = panel();
    expect(p).not.toContain("A number is how many different players");
    expect(p).not.toContain("Seasons that recorded no roster carry none.");
    // …and the fact that note carried is still on the stamp.
    expect(p).toContain("First fielded 2024-01-01. 1 player across 1 of 2 seasons.");
  });

  it("keeps the whole title on the stamp, name first", () => {
    // The tooltip leads with the country because the stamp no longer prints
    // it: hovering a bare flag has to answer "which country" before it answers
    // anything else.
    seed(rostered({ Japan: ["ohtansh01", "suzukii01"] }, "2026-01-01"));
    const p = panel();
    expect(p).toContain(
      'title="Japan — First fielded 2026-01-01. 2 players across 1 season."',
    );
  });

  it("titles an unvisited slot with its country and nothing else to explain", () => {
    seed(game(["Japan"]));
    expect(panel()).toContain('title="Lithuania — Never fielded."');
  });
});

/* ---------- the finale ---------- */

describe("the finale's passport", () => {
  it("does not appear for a player whose log holds no country", () => {
    // Every save written before the field existed, and every finale restored
    // from one.
    expect(finale()).not.toContain("PASSPORT");
  });

  it("shows the whole career, not just tonight's club", () => {
    // The change: the panel is the passport, so a country from an earlier
    // season is on it even though nobody on tonight's roster came from there.
    // That is what makes a new stamp legible against something.
    seed(game(["Mexico"], "2026-01-01"));
    const stamps = finaleStamps("Japan", "USA", "Japan", "Venezuela");
    expect(stamps).toContain("🇯🇵");
    expect(stamps).toContain("🇺🇸");
    expect(stamps).toContain("🇻🇪");
    expect(stamps).toContain("🇲🇽");
    expect((stamps.match(/aria-label="Japan[,."]/g) ?? []).length).toBe(1);
  });

  it("draws no empty slots — the board belongs to the trophy case", () => {
    // The grayed half is context for a collection being browsed. A finale is a
    // scoreboard, and thirty-seven gray flags under one is noise.
    seed(game(["Japan"], "2026-01-01"));
    const stamps = finaleStamps("Japan");
    expect(stamps).not.toContain("stamp locked");
    expect(stamps).not.toContain("Never fielded.");
  });

  it("flags a country never fielded before, and only that one", () => {
    // The moment the souvenir is earned, and the only point in the game where
    // a birth country is surfaced beside a club. `recordHistory` runs before
    // the finale renders, so a country with ONE visit is one this club is the
    // only record of.
    seed(game(["Japan"], "2026-01-01"), game(["Japan"], "2026-02-01"));
    const stamps = finaleStamps("Japan", "Cuba");
    expect((stamps.match(/>NEW</g) ?? []).length).toBe(1);
    // The new one leads, the same order the badge pills take.
    expect(stamps.indexOf("Cuba")).toBeLessThan(stamps.indexOf("Japan"));
  });

  it("flags nothing when every country is already in the passport", () => {
    seed(game(["Japan"], "2026-01-01"), game(["Japan"], "2026-02-01"));
    expect(finaleStamps("Japan")).not.toContain(">NEW<");
  });

  it("never flags a one-visit country tonight's club did not hold", () => {
    // Both halves of the test are load-bearing: reading visits alone would
    // flag a country from a game the player finished last week.
    seed(game(["Mexico"], "2026-01-01"));
    const stamps = finaleStamps("Japan");
    expect(stamps).toContain("🇲🇽");
    expect((stamps.match(/>NEW</g) ?? []).length).toBe(1);
    expect(stamps.indexOf("Japan")).toBeLessThan(stamps.indexOf("Mexico"));
  });

  it("carries the career's player count, the same number the case prints", () => {
    // This IS the passport now, so it counts what the passport counts. The two
    // surfaces run one builder, so a figure here cannot disagree with the case.
    seed(rostered({ Japan: ["ohtansh01", "suzukii01"] }, "2026-01-01"));
    expect(finaleStamps("Japan")).toContain("×2");
  });
});

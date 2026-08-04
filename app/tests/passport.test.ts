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
 * The boards are the design claim: a SOUVENIR, never a checklist. Nothing in
 * the game shows a birth country until the season is over, and 15 of the 39
 * countries in the dataset have exactly one draftable man, so a grid of empty
 * slots would point a player at a hunt they have no way to run. The assertions
 * here are what stops that shape from creeping back — no denominator anywhere,
 * and nothing on either board that has not actually been fielded.
 *
 * Rendered SSR, the same idiom trophycase.test.ts and finale-reveal.test.ts
 * use and for the same reason: neither TrophyModal nor Finale fetches
 * anything, and their markup is a pure function of props plus storage.
 *
 * Read through a PARSER rather than by matching the string. The helpers below
 * used to slice the markup between two landmarks and pick stamps out with a
 * regex over `aria-label`, and both broke on every round that touched the
 * markup — which is the wrong failure: a test that has to be re-tuned whenever
 * a tag changes is measuring the tag. Querying `.stamps` cannot slide off the
 * board onto the sheet, and reading a stamp's own attributes cannot match its
 * neighbour.
 *
 * The one thing SSR cannot show is an OPEN stamp: the reveal is a floating
 * panel placed from measurements, so it exists only after a tap in a real
 * browser. What is pinned here is the control — every stamp is a button, it
 * announces what it draws, and it carries the detail it will reveal.
 *
 * jsdom is here as a PARSER and nothing else — the environment stays node.
 * Vitest infers a web transform from a jsdom environment, which resolves
 * svelte to its client build and leaves `$effect` running outside a component;
 * these are server renders and they need the server runtime.
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

/** jsdom, the test runner's own dependency, reached through a variable rather
 * than a literal specifier. It ships no type declarations and this project
 * pins `types` to vite/client, so a static import is a compile error about a
 * missing @types package — a fact about the toolchain, not about anything
 * under test. Adding a dependency to work around it would cost the app a
 * package for a line in one test file. */
const JSDOM_SPEC = "jsdom";
const { JSDOM } = await import(JSDOM_SPEC);

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

/** The passport on a rendered surface: EVERY row of stamps it drew, in
 * document order. Queried, not sliced — the finale's row sits directly over THE
 * DREAM TEAM and the case's rows sit inside the rarity bands, and a slice
 * bounded by any of those neighbours answers with the neighbour the moment one
 * of them moves.
 *
 * Rows, plural, because the case files a country in the band of its own tier —
 * so an ultra country is a stamp row under ULTRA, beside the ultra badges,
 * and there is one row per tier that has been reached. The finale still draws
 * exactly one. Reading them all in document order is what makes both surfaces
 * answerable by the same helpers: the bands run rarest first, so the
 * concatenation IS the board, in the order a reader meets it.
 *
 * It throws rather than returning an empty list when there is no row at all,
 * because "this career has no passport" and "this passport has no stamps" are
 * different claims and every assertion below is about one or the other. */
function board(markup: string): Element[] {
  // Two row shapes, because a stamp lives in two kinds of row. The finale draws
  // a passport strip of its own (`.stamps`); the trophy case has no passport
  // section at all any more, and files each country INLINE among the badges of
  // its rarity band, so up there the row is `.bandrow`. Both are queried, and
  // only rows that actually hold a stamp are a board — a rarity band of pure
  // badges is not an empty passport.
  const rows = [...new JSDOM(markup).window.document.querySelectorAll(".stamps, .bandrow")];
  const els = rows.filter((r) => r.querySelector(".stamp") !== null);
  if (els.length === 0) throw new Error("no passport rendered");
  return els;
}

/** Every stamp the surface drew, in the order a reader meets it — across every
 * band on a trophy sheet, and across the one row on a finale.
 *
 * `.stamp` is the class the rectangle has always worn and still wears: badges
 * and countries render through one shared `Pill` now, and the shape's own hook
 * survived the merge precisely so that a test selecting a stamp keeps selecting
 * a stamp. A badge in the same row is `.brag` and is never picked up here.
 *
 * What is returned is the BUTTON, not the chip inside it. A stamp is a chip in
 * a slot — the arrangement a badge has always had — so the control carries the
 * accessible name and the expanded state while the chip carries the tier and
 * the drawn parts. Every assertion below is about one or the other, and the
 * button is the one that reaches both. */
function stampEls(markup: string): Element[] {
  return board(markup).flatMap((row) => [
    ...row.querySelectorAll<Element>("button:has(.stamp)"),
  ]);
}

/** The country one stamp announces. The accessible name is the NEW chip, then
 * the country, then the count — all three are drawn rather than written, and
 * `aria-label` replaces everything inside the element — so the country is what
 * is left when the other two are taken off. Taken apart rather than searched
 * for: a stamp whose name stops following that shape fails here, where the
 * pattern is stated, instead of quietly matching the country beside it. */
function announced(el: Element): string {
  const label = el.getAttribute("aria-label");
  if (label === null) throw new Error("a stamp with no accessible name");
  return label.replace(/^New\. /, "").split(", ")[0];
}

/** The countries a board shows, in board order. */
function shown(markup: string): string[] {
  return stampEls(markup).map(announced);
}

/** The countries a board flags as first-ever — by what the stamp announces,
 * not by the chip's markup. */
function flagged(markup: string): string[] {
  return stampEls(markup)
    .filter((el) => el.getAttribute("aria-label")!.startsWith("New. "))
    .map(announced);
}

/** One country's stamp, by the name it announces. */
function stampFor(markup: string, country: string): Element {
  const el = stampEls(markup).find((e) => announced(e) === country);
  if (!el) throw new Error(`no stamp for ${country}`);
  return el;
}

/** Whatever the CHIP naming a country wears besides its structural classes and
 * its style hash — the tier a reader actually sees, rather than the tier the
 * reader returned. An empty list is a stamp with no tier at all.
 *
 * `pill` and `stamp` are both structural: `pill` is the one shared chip every
 * badge and country renders through, `stamp` is the rectangular shape's hook.
 * Neither is a tier, so neither counts here. */
function stampClass(markup: string, country: string): string[] {
  const chip = stampFor(markup, country).querySelector(".stamp");
  if (!chip) throw new Error(`no chip inside the stamp for ${country}`);
  return [...chip.classList].filter(
    (c) => c !== "pill" && c !== "stamp" && !c.startsWith("svelte-"),
  );
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
    // And the board draws the stamp anyway.
    expect(shown(modal())).toEqual(["Atlantis"]);
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

/* ---------- the trophy-case board ---------- */

describe("the passport board", () => {
  it("draws no stamp row at all on an untravelled sheet", () => {
    // An untravelled board draws nothing, and now draws it NOWHERE: the grayed
    // slot for every unvisited country is gone, and so is the band that used to
    // hold the "no countries yet" line. There is no passport section left to
    // stand empty — a country lives in the band of its own tier, so a career
    // that has been nowhere adds no stamp to any band and the badge ladder is
    // the whole sheet.
    seed({ v: 2, date: "2026-01-01", total: 120, record: "95-67", spins: 3, badges: ["hundred"] });
    const body = modal();
    expect(body).not.toContain("PASSPORT");
    expect(body).not.toContain("No countries yet — play a season.");
    expect(() => board(body)).toThrow(/no passport/);
  });

  it("files each country in its own rarity band, with no band of its own", () => {
    // ONE LADDER, NOT TWO. The countries used to sit in a PASSPORT band below
    // every rarity band, which filed them by what they ARE on a sheet organized
    // by how RARE they are — an ultra country two screens under the ultra
    // badges it is exactly as hard to get. Each stamp now sits in the band that
    // names its tier, and the separate header is gone.
    //
    // Japan is uncommon, Panama rare: two tiers, so the assertion is about the
    // country's OWN rung and not about one band happening to be first.
    seed(game(["Japan", "Panama"]));
    const body = modal();
    expect(body).not.toContain('role="tablist"');
    expect(body).not.toContain('role="tabpanel"');
    expect(body).not.toContain("PASSPORT");

    // INLINE, in the band's own wrapping row — a flag is one more chip in the
    // flow, not a strip parked under the badges. The evidence is structural:
    // the stamp's parent row is the same `.bandrow` that holds badges, and it
    // holds both kinds at once.
    const doc = new JSDOM(body).window.document;
    const rows = [...doc.querySelectorAll(".bandrow")];
    const withStamps = rows.filter((r) => r.querySelector(".stamp"));
    expect(withStamps).toHaveLength(2);
    for (const row of withStamps) {
      // Both kinds, one row. A band whose badges were all pushed elsewhere
      // would pass a "stamp is in a bandrow" check and fail this one.
      expect(row.querySelector(".brag")).not.toBeNull();
      expect(row.querySelector(".stamp")).not.toBeNull();
    }
    // And each lands in the band that names its OWN tier: Japan is uncommon,
    // Panama rare. Read off the heading each row is filed under, so a stamp
    // that drifted one band up or down fails here.
    const bandOf = (country: string) => {
      const stamp = [...doc.querySelectorAll(".stamp")].find(
        (s) => s.closest("button")?.getAttribute("aria-label")?.startsWith(country),
      );
      return stamp?.closest(".band")?.querySelector(".psep")?.textContent;
    };
    expect(bandOf("Japan")).toBe("UNCOMMON");
    expect(bandOf("Panama")).toBe("RARE");
  });

  it("shows the countries this career has fielded, and nothing else", () => {
    // The reversal: the board was the whole table for a while, with every
    // unreached country drawn as a grayed slot. Most of the table is somewhere
    // nobody has been, so the sheet opened as a wall of what the player does
    // NOT have — a checklist however carefully the slots were worded. What is
    // drawn now is what the career turned up, and the count of stamps is the
    // assertion that says so: two seeded, two on the board.
    seed(game(["Japan", "Cuba"]));
    const p = modal();
    expect(shown(p)).toEqual(["Cuba", "Japan"]);
    expect(stampClass(p, "Japan")).toEqual(["uncommon"]);
    expect(stampClass(p, "Cuba")).toEqual(["uncommon"]);
    // And the vocabulary the slots brought with them is gone with them.
    expect(p).not.toContain("Never fielded.");
  });

  it("orders the board rarest first, with an unmeasured country last", () => {
    // The case is a collection board and the badge bands above it are already
    // stacked rarest first, so the passport reads on the same axis as the
    // sheet it sits at the bottom of. A country the table cannot measure has no
    // tier to sort on and goes last — at the head of a board ordered by rarity
    // it would read as the rarest thing on it.
    seed(game(["USA", "Japan", "Panama", "Guam", "Atlantis"]));
    expect(shown(modal())).toEqual(["Guam", "Panama", "Japan", "USA", "Atlantis"]);
  });

  it("keeps newest-first inside a tier", () => {
    // Rarity is the board's axis, and it is the only one: two countries on the
    // same rung fall back on the order `passportItems` handed over, which is
    // discovery order newest first. Four commons across four seasons, so the
    // tier decides nothing and the tie-break decides everything — the whole of
    // what a stable sort buys, which an all-different-tiers board cannot show.
    seed(
      game(["USA"], "2026-01-01"),
      game(["Dominican Republic"], "2026-02-01"),
      game(["Venezuela"], "2026-03-01"),
      game(["Puerto Rico"], "2026-04-01"),
    );
    expect(shown(modal())).toEqual([
      "Puerto Rico",
      "Venezuela",
      "Dominican Republic",
      "USA",
    ]);
  });

  it("makes every stamp a control that opens its detail", () => {
    // The stamp prints a flag and no name, so on a touch screen — no hover,
    // no reachable `title` — the country it stands for was unanswerable. Every
    // stamp is a button now, and the detail is a panel it opens. Only the
    // control is visible here: the panel is placed from measurements taken in a
    // real browser, so nothing is open in a rendered string.
    seed(game(["Japan", "Cuba"]));
    const p = modal();
    for (const el of stampEls(p)) {
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("aria-expanded")).toBe("false");
      expect(el.hasAttribute("disabled")).toBe(false);
    }
    // And the row is a group of buttons rather than a list: `role="listitem"`
    // on a button replaces the button, and a wrapper carrying the role puts a
    // box between the button and the row its panel is measured against.
    // Every row, not just the first: the case draws one per rarity band.
    for (const row of board(p)) {
      expect(row.getAttribute("role")).toBe("group");
    }
    expect(p).not.toContain('role="listitem"');
  });

  it("names every country to assistive tech, printing none of them", () => {
    // The flag IS the stamp — thirty-nine spelled-out names is a list where a
    // field of flags is a collection — but a name that only exists as a glyph
    // is a name a screen reader cannot read. So it moves to the accessible
    // name and the tooltip rather than disappearing.
    seed(rostered({ Japan: ["ohtansh01"], Curaçao: ["jonesan01"] }, "2026-01-01"));
    const p = modal();
    for (const c of ["Japan", "Curaçao"]) {
      expect(stampFor(p, c).textContent, `${c} is printed as text`).not.toContain(c);
    }
    // The count rides along with it, so "Japan, 1" is what gets announced
    // rather than a bare flag. The detail is NOT in the name: it is the panel's
    // to announce when the panel is opened, which is the same division a badge
    // pill draws with its trigger.
    expect(stampFor(p, "Japan").getAttribute("aria-label")).toBe("Japan, 1");
  });

  it("flies the flag in place of the name", () => {
    seed(game(["Japan", "Curaçao", "England"]));
    const p = modal();
    expect(stampFor(p, "Japan").querySelector(".ico")?.textContent).toBe("🇯🇵");
    expect(stampFor(p, "Curaçao").querySelector(".ico")?.textContent).toBe("🇨🇼");
    expect(stampFor(p, "England").querySelector(".ico")?.textContent).toBe("🏴󠁧󠁢󠁥󠁮󠁧󠁿");
  });

  it("wears the country's tier, and no tier at all for an unknown one", () => {
    seed(game(["USA", "Japan", "Panama", "Guam", "Atlantis"]));
    const p = modal();
    expect(stampClass(p, "USA")).toEqual(["common"]);
    expect(stampClass(p, "Japan")).toEqual(["uncommon"]);
    expect(stampClass(p, "Panama")).toEqual(["rare"]);
    expect(stampClass(p, "Guam")).toEqual(["ultra"]);
    // The one country the table cannot measure wears nothing — no tier, and no
    // defaulted `common` standing in for one.
    expect(stampClass(p, "Atlantis")).toEqual([]);

    // AND IT STILL WEARS THE RECTANGLE'S SHAPE HOOK, which is what routes it to
    // the rectangle's untiered paper. Badges and countries share one `Pill`
    // now, and the two shapes' untiered fallbacks are deliberately DIFFERENT:
    // an untiered badge falls back to the pill's gray wash on the structural
    // line, while an untiered country falls back to plain card on a gray
    // hairline — quieter than `common`, because an unmeasured country must not
    // look like a measured one. Both are keyed off this class, so a stamp that
    // lost it would silently start wearing a badge's fallback.
    const chip = (sel: string) =>
      new JSDOM(p).window.document.querySelector(sel)!.classList;
    expect(stampFor(p, "Atlantis").querySelector(".stamp")!.classList).toContain("pill");
    // The badge half of the same claim: a capsule in the same sheet is `brag`,
    // never `stamp`, so the two fallbacks can never resolve to one rule.
    expect(chip(".brag")).toContain("pill");
    expect(chip(".brag")).not.toContain("stamp");
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

  it("prints the unique-player count, at one as readily as at four", () => {
    // The number means "different people", so it is information at one. The
    // badge pills hide a ×1 on purpose and this deliberately does not: a blank
    // stamp has to mean exactly one thing here, and it means "no season on
    // record named anybody".
    seed(
      rostered({ Japan: ["ohtansh01"], Cuba: ["puigya01", "abreujo02"] }, "2026-01-01"),
    );
    const p = modal();
    expect(stampFor(p, "Japan").querySelector(".count")?.textContent).toBe("×1");
    expect(stampFor(p, "Cuba").querySelector(".count")?.textContent).toBe("×2");
  });

  it("shows no number rather than a zero when nothing was counted", () => {
    // A silent zero would read as a bug: a country nobody is counted for is a
    // gap in the log, not a club with nobody in it. The detail says which.
    seed(game(["Japan"], "2026-01-01"), game(["Japan"], "2026-02-01"));
    const el = stampFor(modal(), "Japan");
    expect(el.querySelector(".count")).toBeNull();
    expect(el.getAttribute("aria-label")).toBe("Japan");
    // The blank is the whole claim about the number. The detail names the
    // country and says what the stamp is for; it does not stand in for a count
    // the stamp is deliberately not showing.
    expect(el.getAttribute("title")).toBe("Japan");
  });

  it("carries no prose at all — the stamp explains itself", () => {
    // The board used to print a two-sentence note under it saying what a number
    // meant and which seasons had none. It is gone: a passport that needs a
    // caption to be read is not a passport, and the same two facts are already
    // on every stamp's own detail, where they belong to the country being asked
    // about rather than to the board.
    seed(game(["Japan"], "2024-01-01"), rostered({ Japan: ["ohtansh01"] }, "2026-01-01"));
    const p = modal();
    expect(p).not.toContain("A number is how many different players");
    expect(p).not.toContain("Seasons that recorded no roster carry none.");
    // And no prose anywhere else on the sheet either: the career arithmetic the
    // note carried used to survive on the stamp's own detail, and it is gone
    // from there too.
    expect(p).not.toContain("First fielded");
    expect(p).not.toContain("across");
  });

  it("shows the country name as the hover tooltip, on both surfaces", () => {
    // A bare flag on hover answers "which country?" with just the name — brief
    // enough to read without interrupting the eye. The tapped panel gives the
    // full sentence. Both surfaces (trophy case and finale) agree on the tooltip.
    seed(rostered({ Japan: ["ohtansh01", "suzukii01"] }, "2026-01-01"));
    expect(stampFor(modal(), "Japan").getAttribute("title")).toBe("Japan");
    expect(stampFor(finale("Japan", "Japan"), "Japan").getAttribute("title")).toBe("Japan");
  });
});

/* ---------- the finale ---------- */

describe("the finale's passport", () => {
  it("does not appear for a player whose log holds no country", () => {
    // Every save written before the field existed, and every finale restored
    // from one. No row of stamps at all, which is a different thing from a row
    // with nothing in it — the finale draws no header over its passport, so an
    // empty one would be a silent gap in the column.
    expect(() => board(finale())).toThrow(/no passport/);
  });

  it("shows tonight's club, not the career", () => {
    // THIS CLUB, COUNTED THIS CLUB: every stamp names a country one of
    // tonight's men was born in, so the row and the header over it
    // ("Countries fielded") are literally true of the same eight seats. A
    // country from an earlier season is the trophy case's subject and is not
    // on this row. A country two of tonight's men were born in is one stamp.
    seed(game(["Mexico"], "2026-01-01"));
    expect(shown(finale("Japan", "USA", "Japan", "Venezuela")).sort()).toEqual([
      "Japan",
      "USA",
      "Venezuela",
    ]);
  });

  it("flags a country never fielded before, and only that one", () => {
    // The moment the souvenir is earned, and the only point in the game where
    // a birth country is surfaced beside a club. `recordHistory` runs before
    // the finale renders, so a country with ONE visit is one this club is the
    // only record of.
    seed(game(["Japan"], "2026-01-01"), game(["Japan"], "2026-02-01"));
    const f = finale("Japan", "Cuba");
    expect(flagged(f)).toEqual(["Cuba"]);
    // Announced AND drawn: the chip is a mark on the stamp, and the accessible
    // name leads with it because an aria-label replaces the mark.
    // `.newchip` is app.css's shared chip — the same one a badge pill wears.
    expect(stampFor(f, "Cuba").querySelector(".newchip")?.textContent).toBe("NEW");
  });

  it("flags nothing when every country is already in the passport", () => {
    seed(game(["Japan"], "2026-01-01"), game(["Japan"], "2026-02-01"));
    expect(flagged(finale("Japan"))).toEqual([]);
  });

  it("reads freshness from the career even though it draws only tonight", () => {
    // The two subjects the row holds at once. WHICH countries is tonight's
    // question and the roster answers it — Mexico came off a season the player
    // finished last week and is not drawn. WHETHER one is new is a lifetime
    // question and only the log can answer it.
    seed(game(["Mexico"], "2026-01-01"));
    const f = finale("Japan");
    expect(shown(f)).toEqual(["Japan"]);
    expect(flagged(f)).toEqual(["Japan"]);
  });

  it("counts tonight's men, not the career's", () => {
    // Six Americans on tonight's roster read USA ×6. The lifetime figure is a
    // fact about the collection and belongs to the trophy case: printed here,
    // inches under a nine-man roster, it reads as a claim about the roster,
    // which is the one thing it is not. Seeded with three men from Japan and
    // two of tonight's eight born there, so the two numbers cannot be confused.
    seed(rostered({ Japan: ["ohtansh01", "suzukii01", "yamamyo01"] }, "2026-01-01"));
    expect(
      stampFor(finale("Japan", "Japan"), "Japan").querySelector(".count")?.textContent,
    ).toBe("×2");
  });

  it("opens on the one sentence every stamp opens on", () => {
    // The question a bare flag cannot answer on a touch screen is which country
    // it is, and it is the question worth a tap. So the stamp is a control, and
    // what it opens is the same sentence the trophy case's stamps open — the
    // finale is not a shorter version of the passport, it is the same stamps.
    const el = stampFor(finale("Japan"), "Japan");
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("aria-expanded")).toBe("false");
    expect(el.getAttribute("title")).toBe("Japan");
  });
});

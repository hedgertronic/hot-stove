/** The passport: the lifetime country collection and the trophy-case panel it
 * feeds.
 *
 * Two things are under test and they are different claims. `passport()` is a
 * reader over `hotstove.history`, so the tolerance suite is the same one
 * `badgeCase()` gets — a store that has outlived two schema changes must not
 * be able to throw, and a row written before the `countries` field existed has
 * to read as "this season contributed nothing" rather than as a gap.
 *
 * The panel is the design claim: a SOUVENIR, never a checklist. Nothing in the
 * game shows a birth country, and 15 of the 39 countries in the dataset have
 * exactly one draftable man, so a grid of empty slots would be pointing a
 * player at a hunt they have no way to run. The assertions below are what
 * stops that shape from creeping back — no denominator, no locked slot, and no
 * panel at all until the first stamp lands.
 *
 * Rendered SSR, the same idiom trophycase.test.ts uses and for the same
 * reason: TrophyModal fetches nothing and its markup is a pure function of
 * storage, so a node environment can own localStorage outright.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "svelte/server";
import TrophyModal from "../src/components/TrophyModal.svelte";
import { COLLECTIBLE } from "../src/lib/badges";
import { passport } from "../src/lib/settings";

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

function modal(): string {
  return render(TrophyModal, { props: { onclose: () => {} } }).body;
}

/** Country names only, in the order the reader returns them. */
function names(): string[] {
  return passport().map((s) => s.country);
}

beforeEach(() => store.clear());

describe("passport()", () => {
  it("round-trips a season's countries out of storage", () => {
    seed(game(["USA", "Dominican Republic", "Japan"]));
    expect(names().sort()).toEqual(["Dominican Republic", "Japan", "USA"]);
    expect(passport().every((s) => s.visits === 1)).toBe(true);
    expect(passport().every((s) => s.first === "2026-08-01")).toBe(true);
  });

  it("unions across games and counts visits by GAME, not by player", () => {
    // Three men from one country in one club is one visit, the same way a
    // history row naming a badge three times is one earn.
    seed(
      game(["USA", "USA", "Venezuela"], "2026-01-01"),
      game(["USA", "Cuba"], "2026-02-01"),
    );
    expect(passport()).toEqual([
      { country: "Cuba", first: "2026-02-01", visits: 1 },
      { country: "Venezuela", first: "2026-01-01", visits: 1 },
      { country: "USA", first: "2026-01-01", visits: 2 },
    ]);
  });

  it("returns discovery order, newest first", () => {
    // `loadHistory` is oldest first, so insertion order IS discovery order.
    // The newest stamp is the one worth looking at, so it leads.
    seed(
      game(["USA"], "2026-01-01"),
      game(["Mexico"], "2026-02-01"),
      game(["Curaçao"], "2026-03-01"),
    );
    expect(names()).toEqual(["Curaçao", "Mexico", "USA"]);
  });

  it("keeps the FIRST date a country was fielded, not the latest", () => {
    seed(game(["Japan"], "2026-01-01"), game(["Japan"], "2026-05-05"));
    expect(passport()).toEqual([
      { country: "Japan", first: "2026-01-01", visits: 2 },
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
    expect(passport()).toEqual([
      { country: "Canada", first: "2026-08-01", visits: 1 },
    ]);
  });

  it("survives a row with no parseable date", () => {
    // `first` is display only, so a missing date costs the stamp its caption
    // and nothing else.
    seed({ v: 2, countries: ["Guam"] }, { v: 2, date: 5, countries: ["Guam"] });
    expect(passport()).toEqual([{ country: "Guam", first: "", visits: 2 }]);
  });

  it("skips an unscored quit row", () => {
    // A quit writes `{ date, badges: ["packedin"] }` and nothing else — a real
    // shape in the log, not a hypothetical. It produced no season, so it
    // stamps no country.
    seed({ date: "2026-01-01", badges: ["packedin"] }, game(["Japan"], "2026-02-01"));
    expect(passport()).toEqual([
      { country: "Japan", first: "2026-02-01", visits: 1 },
    ]);
  });

  it("survives a null row in the log", () => {
    seed(null, game(["Taiwan"]), undefined);
    expect(names()).toEqual(["Taiwan"]);
  });
});

describe("the passport panel", () => {
  it("does not exist until the first country lands", () => {
    // A "PASSPORT · 0 COUNTRIES" heading over an empty box is the checklist
    // wearing a different hat. The panel simply appears the first time a
    // country is fielded, which is the happy accident it is meant to be.
    seed({ v: 2, date: "2026-01-01", total: 120, record: "95-67", spins: 3, badges: ["hundred"] });
    expect(modal()).not.toContain("PASSPORT");
  });

  it("appears with a bare count once a country has been fielded", () => {
    seed(game(["Japan", "Cuba"]));
    const body = modal();
    expect(body).toContain("PASSPORT");
    expect(body).toContain("2");
    expect(body).toContain("COUNTRIES");
    expect(body).toContain("Japan");
    expect(body).toContain("Cuba");
  });

  it("says COUNTRY, singular, on the first stamp", () => {
    seed(game(["Japan"]));
    const body = modal();
    expect(body).toContain("COUNTRY");
    expect(body).not.toContain("COUNTRIES");
  });

  it("names no denominator, so it cannot read as a checklist", () => {
    // The dataset holds 39 countries and the panel must never say so — a
    // total is an invitation to complete a set the UI gives no tools for.
    seed(game(["Japan", "Cuba"]));
    const body = modal();
    expect(body).not.toContain("2 OF");
    expect(body).not.toContain("OF 39");
    expect(body).not.toMatch(/PASSPORT[^<]*OF/);
  });

  it("renders only what has been found — no empty slot for anything else", () => {
    // The whole shape of the panel: one element per stamp, full stop.
    seed(game(["Japan"]));
    const body = modal();
    expect((body.match(/role="listitem"/g) ?? []).length).toBe(1);
    // And it borrows none of the locked-badge vocabulary.
    const panel = body.slice(body.indexOf("PASSPORT"));
    expect(panel).not.toContain("Not yet earned");
    expect(panel).not.toContain("An undiscovered badge");
  });

  it("cannot move the trophy case's progress fraction", () => {
    // The fraction is counted from COLLECTIBLE. A country is not a badge, so
    // eight of them leave it exactly where an empty case does.
    seed(game(["USA", "Cuba", "Japan", "Mexico", "Canada", "Aruba", "Panama", "Peru"], "2026-01-01"));
    expect(modal()).toContain(`1 OF ${COLLECTIBLE.length}`);
    store.clear();
    expect(modal()).toContain(`0 OF ${COLLECTIBLE.length}`);
  });

  it("marks a repeat visit and leaves a single visit unmarked", () => {
    // The same rule the badge tiles use: on a collection surface the signal is
    // repetition, and existence is already carried by the stamp being there.
    seed(game(["Japan"], "2026-01-01"), game(["Japan", "Cuba"], "2026-02-01"));
    const body = modal();
    expect(body).toContain("×2");
    expect(body).not.toContain("×1");
  });
});

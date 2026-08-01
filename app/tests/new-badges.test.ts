/** First-time badges: the history reader that answers "have I earned this
 * before", and the finale flag it drives.
 *
 * The question is a sequencing one, which is why it is worth its own file.
 * `recordHistory()` appends the finished game to the same log the answer is
 * read from, so a diff taken one line too late reports nothing new, forever —
 * and would still pass any test that only checked "a new badge renders NEW"
 * against a hand-built finale. The engine-order test below is the one that can
 * actually fail on that mistake.
 *
 * The row's ORDER is asserted against `bragRow` rather than against rendered
 * Finale markup, because the pill row lives behind the finale's reveal
 * animation: `bragsShown` flips inside an $effect, which SSR never runs, so a
 * rendered assertion would find no pills at all and pass vacuously on the
 * branch that matters most. The pill's own markup is asserted against
 * BadgePill directly.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "svelte/server";
import BadgePill from "../src/components/BadgePill.svelte";
import TrophyModal from "../src/components/TrophyModal.svelte";
import { BADGE_BY_KEY, bragRow } from "../src/lib/badges";
import {
  appendHistory,
  earnedBadgeKeys,
  loadHistory,
} from "../src/lib/history";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

/** Seed the log with raw rows — untyped on purpose, since the malformed shapes
 * under test are exactly what HistoryEntry forbids. */
function seed(...entries: unknown[]): void {
  store.set("hotstove.history", JSON.stringify(entries));
}

function row(badges: unknown): unknown {
  return {
    v: 2,
    date: "2026-08-01",
    total: 120,
    record: "95-67",
    spins: 3,
    badges,
  };
}

beforeEach(() => store.clear());

describe("earnedBadgeKeys", () => {
  it("is empty before anything has ever been played", () => {
    expect(earnedBadgeKeys().size).toBe(0);
  });

  it("unions keys across every game in the log", () => {
    seed(row(["mariners", "dime"]), row(["dime", "crystal"]));
    expect([...earnedBadgeKeys()].sort()).toEqual([
      "crystal",
      "dime",
      "mariners",
    ]);
  });

  it("tolerates every shape the oldest store in the app can hold", () => {
    // A pre-badge row, a corrupt badges value, a non-string key, and a row
    // that is not an object at all. None may throw; none may contribute.
    seed(
      { date: "2020-01-01", total: 90 },
      row("nope"),
      row([42, null]),
      null,
      row(["dime"]),
    );
    expect([...earnedBadgeKeys()]).toEqual(["dime"]);
  });

  it("reads a corrupt store as no history rather than throwing", () => {
    store.set("hotstove.history", "{not json");
    expect(earnedBadgeKeys().size).toBe(0);
    expect(loadHistory()).toEqual([]);
  });

  it("keeps a key the badge table no longer defines", () => {
    // Deliberate: this answers "has the player seen this key", and a retired
    // badge is still one they saw. Rendering surfaces drop what they cannot
    // resolve; this reader must not, or a retired-then-restored badge would
    // wrongly flag as new.
    seed(row(["retiredbadge"]));
    expect(earnedBadgeKeys().has("retiredbadge")).toBe(true);
    expect(BADGE_BY_KEY["retiredbadge"]).toBeUndefined();
  });
});

describe("appendHistory", () => {
  it("adds one row without disturbing the rows already there", () => {
    seed(row(["dime"]));
    appendHistory({
      date: "2026-08-02",
      total: 130,
      record: "99-63",
      spins: 4,
      badges: ["crystal"],
    });
    expect(loadHistory()).toHaveLength(2);
    expect([...earnedBadgeKeys()].sort()).toEqual(["crystal", "dime"]);
  });
});

/** The brag row's shape as keys, for readable assertions. */
const keysOf = (row: ReturnType<typeof bragRow>) => row.map((b) => b.def.key);
const freshOf = (row: ReturnType<typeof bragRow>) =>
  row.filter((b) => b.fresh).map((b) => b.def.key);

describe("bragRow", () => {
  it("keeps the engine's order when nothing is new", () => {
    const row = bragRow(["allstars", "noweak", "cooperstown"], [], 4);
    expect(keysOf(row)).toEqual(["allstars", "noweak", "cooperstown"]);
    expect(freshOf(row)).toEqual([]);
  });

  it("flags exactly the first-time badges", () => {
    const row = bragRow(["mariners", "dime"], ["dime"], 4);
    expect(freshOf(row)).toEqual(["dime"]);
  });

  it("sorts a first-time badge ahead of the cap that would have cut it", () => {
    // 🗓️ decade sits fifth in the engine's order, past a four-pill cap — the
    // exact case the sort exists for. Without it the player never sees the one
    // badge they have never earned.
    const earned = ["allstars", "noweak", "cooperstown", "rings", "decade"];
    const row = bragRow(earned, ["decade"], 4);
    expect(keysOf(row)).toEqual([
      "decade",
      "allstars",
      "noweak",
      "cooperstown",
    ]);
    // The row does not widen to fit it: the tail is still what gets cut.
    expect(row).toHaveLength(4);
  });

  it("is stable within each group", () => {
    const earned = ["allstars", "noweak", "cooperstown", "rings", "decade"];
    const row = bragRow(earned, ["cooperstown", "decade"], 5);
    // New ones first in their original relative order, then the rest in theirs.
    expect(keysOf(row)).toEqual([
      "cooperstown",
      "decade",
      "allstars",
      "noweak",
      "rings",
    ]);
  });

  it("flags nothing when the first-time list is empty", () => {
    expect(freshOf(bragRow(["mariners", "dime"], [], 4))).toEqual([]);
  });

  it("drops a key the badge table no longer defines", () => {
    const row = bragRow(["retiredbadge", "dime"], ["retiredbadge"], 4);
    expect(keysOf(row)).toEqual(["dime"]);
  });

  it("holds the cap", () => {
    const many = [
      "allstars",
      "noweak",
      "cooperstown",
      "rings",
      "decade",
      "crystal",
    ];
    expect(bragRow(many, [], 4)).toHaveLength(4);
    expect(bragRow(many, many, 4)).toHaveLength(4);
  });
});

describe("the NEW flag on the pill", () => {
  const pill = (key: string, fresh: boolean) =>
    render(BadgePill, { props: { badge: BADGE_BY_KEY[key], fresh } }).body;

  it("prints NEW on a first-time badge", () => {
    const body = pill("mariners", true);
    expect(body).toContain("NEW");
    expect(body).toContain("MATCHED THE 2001 MARINERS");
  });

  it("prints no flag on a badge the player already owns", () => {
    expect(pill("mariners", false)).not.toContain("NEW");
  });

  it("defaults off, so no surface flags a badge by accident", () => {
    expect(
      render(BadgePill, { props: { badge: BADGE_BY_KEY["mariners"] } }).body,
    ).not.toContain("NEW");
  });

  it("never flags a badge in the trophy case", () => {
    // The case holds only earned badges, so a flag there would mark every one.
    seed(row(["mariners", "dime"]));
    expect(
      render(TrophyModal, { props: { onclose: () => {} } }).body,
    ).not.toContain("NEW");
  });
});

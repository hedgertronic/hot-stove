/** 🧳 PACKED IT IN — the badge for the game you walked away from.
 *
 * It is the one badge no resolver pushes. Every other badge is computed inside
 * `finishGame` from the season the game produced, and quitting produces no
 * season: it drops the save and goes home without ever reaching a finale, so
 * `earnedBadges()` never runs on that path and no trigger can be written
 * inside it. `recordQuit("standard", "classic")` writes it straight into the log instead.
 *
 * What makes that safe is the row's SHAPE, and that is what most of this file
 * asserts. A quit row carries a date and the key and nothing else — no
 * `total` — and every reader that measures play already skips a row whose
 * total is not a number. So the record book's G never counts a quit, no best
 * column can see one, and the only two surfaces that notice are the ones that
 * union `badges` across the log.
 *
 * The App-side control flow (which TAP earns it) is asserted in
 * quit-badge.dom.test.ts; this file is the storage contract underneath.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { BADGE_BY_KEY, COLLECTIBLE } from "../src/lib/badges";
import { loadHistory } from "../src/lib/history";
import {
  badgeCase,
  bestFor,
  firstEverPlay,
  loadCues,
  recordQuit,
} from "../src/lib/settings";

const HISTORY_KEY = "hotstove.history";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

/** One FINISHED game in classic/standard, for the contrast: the quit row has
 * to be invisible next to a row that is not. */
function finished(over: Record<string, unknown> = {}): void {
  const hist = JSON.parse(store.get(HISTORY_KEY) ?? "[]");
  hist.push({
    v: 2,
    date: "2026-08-01",
    total: 120,
    record: "95-67",
    spins: 3,
    difficulty: "standard",
    bank: "classic",
    badges: ["dime"],
    ...over,
  });
  store.set(HISTORY_KEY, JSON.stringify(hist));
}

beforeEach(() => store.clear());

describe("the row a quit writes", () => {
  it("carries the badge key and no score at all", () => {
    recordQuit("standard", "classic");
    const log = loadHistory();
    expect(log).toHaveLength(1);
    expect(log[0].badges).toEqual(["packedin"]);
    // The absence of `total` IS the marker every other reader keys off. If a
    // future edit starts writing a 0 here, the record book silently gains a
    // 0-point game and this is the test that says so.
    expect(log[0].total).toBeUndefined();
    expect(log[0].record).toBeUndefined();
    expect(log[0].spins).toBeUndefined();
    expect(typeof log[0].date).toBe("string");
    // The abandoned game's mode, stamped like a finished row's — without it
    // the quit row named no mode and 🧳 vanished under every trophy-case lens.
    expect(log[0].difficulty).toBe("standard");
    expect(log[0].bank).toBe("classic");
    expect(log[0].v).toBe(2);
  });

  it("shows under the lens of the mode it abandoned, and no other", () => {
    recordQuit("scout", "moneyball");
    const under = (f: Parameters<typeof badgeCase>[0]) =>
      badgeCase(f).tiles.some((t) => t.key === "packedin");
    expect(under({ difficulties: ["scout"] })).toBe(true);
    expect(under({ banks: ["moneyball"] })).toBe(true);
    expect(under({ difficulties: ["standard"] })).toBe(false);
    expect(under({ banks: ["classic"] })).toBe(false);
  });

  it("names a key the badge table still owns", () => {
    // `recordQuit` spells "packedin" itself — nothing in the badge resolver
    // pushes it, so a rename in badges.ts would otherwise leave this writing a
    // key the trophy case drops on the floor, silently and forever.
    recordQuit("standard", "classic");
    const def = BADGE_BY_KEY[loadHistory()[0].badges![0]];
    expect(def).toBeDefined();
    expect(def.label).toBe("PACKED IT IN");
    expect(def.ironic).toBe(true);
  });
});

describe("what a quit must not disturb", () => {
  it("does not move the record book's game count or its best", () => {
    finished();
    const before = bestFor("standard", "classic");
    expect(before.games).toBe(1);

    recordQuit("standard", "classic");
    recordQuit("standard", "classic");

    const after = bestFor("standard", "classic");
    expect(after.games).toBe(1);
    expect(after.best).toBe(before.best);
    expect(after.bestRecord).toBe(before.bestRecord);
  });

  it("counts for nothing in an empty record book either", () => {
    recordQuit("standard", "classic");
    expect(bestFor("standard", "classic")).toEqual({
      best: null,
      bestRecord: null,
      games: 0,
      // And it lands on no rung of the home screen's outcome band either — a
      // quit resolves no season, so there is no result to distribute.
      tiers: { neg: 0, low: 0, mid: 0, high: 0, star: 0, elite: 0 },
    });
  });

  it("leaves N OF M alone — an anti-trophy is not progress", () => {
    finished();
    const before = badgeCase();
    recordQuit("standard", "classic");
    const after = badgeCase();
    expect(after.earned).toBe(before.earned);
    expect(after.total).toBe(before.total);
    expect(COLLECTIBLE.some((b) => b.key === "packedin")).toBe(false);
  });

  it("does not put out the help cue for someone who has finished nothing", () => {
    // firstEverPlay asks "do you know how this works", not "have you pressed
    // PLAY". A player who quit their first game has still seen no result.
    expect(firstEverPlay()).toBe(true);
    recordQuit("standard", "classic");
    expect(firstEverPlay()).toBe(true);
    finished();
    expect(firstEverPlay()).toBe(false);
  });
});

describe("what a quit does show", () => {
  it("puts a tile in the case", () => {
    recordQuit("standard", "classic");
    const tiles = badgeCase().tiles;
    expect(tiles.map((t) => t.key)).toContain("packedin");
    expect(tiles.find((t) => t.key === "packedin")!.count).toBe(1);
  });

  it("tallies repeats rather than deduping them", () => {
    // A citation, not a target: four quits read as 🧳 ×4, the same way four
    // games that earned a badge read as ×4. Nothing about the case treats it
    // as a special case, which is what makes it read sanely.
    for (let i = 0; i < 4; i++) recordQuit("standard", "classic");
    expect(badgeCase().tiles.find((t) => t.key === "packedin")!.count).toBe(4);
    expect(loadHistory()).toHaveLength(4);
  });

  it("lights the trophy cue the first time and never again", () => {
    expect(loadCues().pendingBadges).toEqual([]);
    recordQuit("standard", "classic");
    expect(loadCues().pendingBadges).toEqual(["packedin"]);

    // The case has been opened; a second quit is no longer news.
    store.set(
      "hotstove.cues",
      JSON.stringify({ v: 1, pendingBadges: [], helpSeen: true }),
    );
    recordQuit("standard", "classic");
    expect(loadCues().pendingBadges).toEqual([]);
  });

  it("is news again for a player who earned it in an unreadable past", () => {
    // The log is the only source of "have I seen this before". A corrupt log
    // reads as no history, so the cue lights — the conservative answer, and
    // the same one every other reader in settings.ts gives.
    store.set(HISTORY_KEY, "%%%");
    recordQuit("standard", "classic");
    expect(loadCues().pendingBadges).toEqual(["packedin"]);
  });
});

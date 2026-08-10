/** The two attention cues: the persisted flag behind the trophy pill's
 * "new badge" state and the ? pill's first-time nudge.
 *
 * The property that matters most is the one nothing on screen can show: an
 * existing player, whose history is full of badges earned long before this key
 * existed, must load with a DARK trophy. So every unreadable store — absent,
 * corrupt, wrong version — is exercised against a seeded history, and all of
 * them have to read unlit.
 *
 * Node environment with a hand-rolled localStorage, the same idiom as
 * new-badges.test.ts: these are pure storage readers and the test owns the
 * store outright rather than fighting jsdom's own accessor.
 */
import { beforeEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const {
  clearBadgeCue,
  firstEverPlay,
  loadCues,
  markHelpSeen,
  markTourSeen,
  noteNewBadges } = await import("../src/lib/settings");

const CUES_KEY = "hotstove.cues";

/** A finished game carrying badges — the shape an existing player's log holds. */
function seedHistory(...badges: string[][]): void {
  store.set(
    "hotstove.history",
    JSON.stringify(
      badges.map((b) => ({
        v: 2,
        date: "2026-08-01",
        total: 120,
        record: "95-67",
        spins: 3,
        difficulty: "standard",
        bank: "classic",
        badges: b })),
    ),
  );
}

function stored(): Record<string, unknown> {
  return JSON.parse(store.get(CUES_KEY)!);
}

beforeEach(() => store.clear());

describe("loadCues", () => {
  it("reads unlit with no record at all", () => {
    expect(loadCues()).toEqual({ pendingBadges: [], helpSeen: false, tourSeen: false });
  });

  it("never lights a trophy for badges earned before the key existed", () => {
    // The whole migration story: a veteran with a full case and no cue record
    // opens the app and nothing pulses at them.
    seedHistory(["dime", "crystal"], ["moneyball"]);
    expect(loadCues().pendingBadges).toEqual([]);
  });

  it("reads unlit from a corrupt value", () => {
    store.set(CUES_KEY, "{not json");
    expect(loadCues()).toEqual({ pendingBadges: [], helpSeen: false, tourSeen: false });
  });

  it("reads unlit from an unrecognized version", () => {
    // Forward and backward: a record this build cannot vouch for is discarded
    // rather than guessed at, and discarding always errs toward dark.
    store.set(
      CUES_KEY,
      JSON.stringify({ v: 99, pendingBadges: ["dime"], helpSeen: true }),
    );
    expect(loadCues()).toEqual({ pendingBadges: [], helpSeen: false, tourSeen: false });
  });

  it("drops non-string keys and a non-array pending list", () => {
    store.set(
      CUES_KEY,
      JSON.stringify({ v: 1, pendingBadges: ["dime", 7, null], helpSeen: 1 }),
    );
    expect(loadCues()).toEqual({ pendingBadges: ["dime"], helpSeen: false, tourSeen: false });
    store.set(CUES_KEY, JSON.stringify({ v: 1, pendingBadges: "dime" }));
    expect(loadCues().pendingBadges).toEqual([]);
  });

  it("hands back a fresh array each read", () => {
    const first = loadCues();
    first.pendingBadges.push("dime");
    expect(loadCues().pendingBadges).toEqual([]);
  });
});

describe("noteNewBadges", () => {
  it("lights the trophy and survives a reload", () => {
    expect(noteNewBadges(["dime"]).pendingBadges).toEqual(["dime"]);
    expect(loadCues().pendingBadges).toEqual(["dime"]);
    expect(stored().v).toBe(1);
  });

  it("unions rather than replaces, so a second finale keeps the first's news", () => {
    noteNewBadges(["dime"]);
    expect(noteNewBadges(["crystal"]).pendingBadges).toEqual(["dime", "crystal"]);
  });

  it("is idempotent — noting the same finale twice counts once", () => {
    noteNewBadges(["dime", "crystal"]);
    noteNewBadges(["dime", "crystal"]);
    expect(loadCues().pendingBadges).toEqual(["dime", "crystal"]);
  });

  it("leaves the help flag alone", () => {
    markHelpSeen();
    noteNewBadges(["dime"]);
    expect(loadCues().helpSeen).toBe(true);
  });

  it("notes nothing for an empty list", () => {
    expect(noteNewBadges([]).pendingBadges).toEqual([]);
  });
});

describe("clearBadgeCue", () => {
  it("goes dark and stays dark across a reload", () => {
    noteNewBadges(["dime"]);
    expect(clearBadgeCue().pendingBadges).toEqual([]);
    expect(loadCues().pendingBadges).toEqual([]);
  });

  it("leaves the help flag alone", () => {
    markHelpSeen();
    noteNewBadges(["dime"]);
    clearBadgeCue();
    expect(loadCues().helpSeen).toBe(true);
  });
});

describe("markHelpSeen", () => {
  it("goes dark and stays dark across a reload", () => {
    expect(markHelpSeen().helpSeen).toBe(true);
    expect(loadCues().helpSeen).toBe(true);
  });

  it("leaves pending badges alone", () => {
    noteNewBadges(["dime"]);
    markHelpSeen();
    expect(loadCues().pendingBadges).toEqual(["dime"]);
  });
});

describe("markTourSeen", () => {
  it("stays seen across a reload and never re-arms", () => {
    expect(markTourSeen().tourSeen).toBe(true);
    expect(loadCues().tourSeen).toBe(true);
  });

  it("leaves the other cues alone", () => {
    noteNewBadges(["dime"]);
    markHelpSeen();
    markTourSeen();
    expect(loadCues()).toEqual({ pendingBadges: ["dime"], helpSeen: true, tourSeen: true });
  });

  it("reads unseen from a record written before the field existed", () => {
    // A v1 store from an older build simply lacks the key; absent must read
    // false rather than throw or, worse, true.
    localStorage.setItem("hotstove.cues", JSON.stringify({ v: 1, pendingBadges: [], helpSeen: true }));
    expect(loadCues().tourSeen).toBe(false);
  });
});

describe("firstEverPlay", () => {
  it("is true with no history — including mid-first-game, deliberately", () => {
    expect(firstEverPlay()).toBe(true);
  });

  it("is false once any game has been finished, badges or not", () => {
    seedHistory([]);
    expect(firstEverPlay()).toBe(false);
  });

  it("is true when history is unreadable", () => {
    store.set("hotstove.history", "{not json");
    expect(firstEverPlay()).toBe(true);
  });
});

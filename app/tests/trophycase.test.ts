/** The lifetime trophy case: the `badgeCase()` reader and the home screen
 * section it feeds.
 *
 * The reader's whole job is tolerance. `hotstove.history` is the oldest store
 * in the app and has outlived two schema changes, so every shape it can hold
 * is exercised here: entries from before badges existed, a corrupt `badges`
 * value, and a key naming a badge the table no longer defines.
 *
 * The section renders SSR rather than in jsdom, the same idiom as
 * finale-reveal.test.ts: Home fetches nothing and its markup is a pure
 * function of props plus storage, and a node environment lets the test own
 * localStorage outright instead of fighting jsdom's own accessor.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "svelte/server";
import Home from "../src/components/Home.svelte";
import TrophyModal from "../src/components/TrophyModal.svelte";
import { BADGES, BADGE_BY_KEY, COLLECTIBLE } from "../src/lib/badges";
import { badgeCase } from "../src/lib/settings";
import type { GameConfig } from "../src/lib/engine.svelte";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };

/** Seed `hotstove.history` with raw entries — deliberately untyped, since the
 * malformed shapes under test are exactly what the interface forbids. */
function seed(...entries: unknown[]): void {
  store.set("hotstove.history", JSON.stringify(entries));
}

/** A well-formed entry, badges aside. */
function game(badges: unknown, bank = "classic"): unknown {
  return { v: 2, date: "2026-08-01", total: 120, record: "95-67", spins: 3, difficulty: "standard", bank, badges };
}

function home(): string {
  return render(Home, { props: { config: CLASSIC, onplay: () => {} } }).body;
}

/** The case renders in its own sheet now, not on the home screen. */
function modal(): string {
  return render(TrophyModal, { props: { onclose: () => {} } }).body;
}

/** Keys → counts, for assertions that do not care about order. */
function counts(): Record<string, number> {
  return Object.fromEntries(badgeCase().tiles.map((t) => [t.key, t.count]));
}

beforeEach(() => store.clear());

describe("badgeCase", () => {
  it("pins the collectible denominator to the badge table", () => {
    // The summary line prints this denominator; it lives in badges.ts, and a
    // table edit must move the fraction here rather than silently anywhere.
    expect(COLLECTIBLE.length).toBe(26);
    expect(BADGES.length).toBe(33);
    expect(badgeCase().total).toBe(COLLECTIBLE.length);
  });

  it("unions across entries and counts repeats", () => {
    seed(game(["crystal", "twoway"]), game(["crystal"], "moneyball"), game(["hundred"]));
    expect(counts()).toEqual({ crystal: 2, twoway: 1, hundred: 1 });
    expect(badgeCase().earned).toBe(3);
  });

  it("unions across banks and difficulties — the case is global", () => {
    seed(
      { v: 2, total: 1, difficulty: "standard", bank: "blankcheck", badges: ["rings"] },
      { v: 2, total: 1, difficulty: "scout", bank: "moneyball", badges: ["rings", "dime"] },
    );
    expect(counts()).toEqual({ rings: 2, dime: 1 });
  });

  it("counts one game once, however many times its array names a badge", () => {
    seed(game(["dime", "dime", "dime"]));
    expect(counts()).toEqual({ dime: 1 });
  });

  it("tolerates legacy entries with no badges field", () => {
    seed(
      { date: "2024-01-01", total: 88, record: "80-82", spins: 2, difficulty: "eyetest" },
      game(["pinch"]),
    );
    expect(counts()).toEqual({ pinch: 1 });
  });

  it("tolerates a malformed badges value", () => {
    seed(game("crystal"), game(42), game(null), game({ crystal: true }), game(["pinch"]));
    expect(counts()).toEqual({ pinch: 1 });
  });

  it("tolerates non-string elements inside the array", () => {
    seed(game([1, null, undefined, { key: "dime" }, "twoway"]));
    expect(counts()).toEqual({ twoway: 1 });
  });

  it("drops keys the badge table no longer defines", () => {
    // A retired key must not inflate the fraction or render a blank tile.
    seed(game(["moonshot", "crystal"]));
    expect(counts()).toEqual({ crystal: 1 });
    expect(badgeCase().earned).toBe(1);
  });

  it("survives history that is not an array at all", () => {
    store.set("hotstove.history", "{}");
    expect(badgeCase().tiles).toEqual([]);
    store.set("hotstove.history", "not json");
    expect(badgeCase().tiles).toEqual([]);
  });

  it("keeps anti-trophies out of the fraction but in the tile list", () => {
    seed(game(["skull", "pocket", "crystal", "twoway"]));
    const c = badgeCase();
    expect(c.earned).toBe(2); // crystal + twoway only
    expect(c.tiles.map((t) => t.key).sort()).toEqual(["crystal", "pocket", "skull", "twoway"]);
  });

  it("orders rarest first with anti-trophies last", () => {
    seed(game(["hundred", "skull", "crystal", "crown", "cubs"]));
    expect(badgeCase().tiles.map((t) => t.key)).toEqual([
      "crown", // ultra
      "crystal", // rare
      "cubs", // uncommon
      "hundred", // common
      "skull", // ironic
    ]);
  });
});

describe("the trophy case sheet", () => {
  it("heads the sheet with the progress fraction", () => {
    seed(game(["crystal", "twoway", "skull"]));
    const body = modal();
    expect(body).toContain("TROPHY CASE");
    expect(body).toContain(`2 OF ${COLLECTIBLE.length}`);
  });

  it("keeps the case off the home screen — it opens from the trophy button", () => {
    seed(game(["crystal"]));
    const body = home();
    expect(body).not.toContain("TROPHY CASE");
    expect(body).not.toContain("CRYSTAL BALL");
    // The button is the only way in, on the home screen and mid-game alike.
    expect(body).toContain('aria-label="Trophy case"');
  });

  it("reveals no trigger text until a badge is opened", () => {
    // `how` strings are the reward for tapping an EARNED pill. A locked slot
    // has no button at all, so a silhouette can never spend its own surprise.
    seed(game(["crystal"]));
    const body = modal();
    expect(body).not.toContain(BADGE_BY_KEY.crystal.how);
    expect(body).not.toContain(BADGE_BY_KEY.cooperstown.how);
  });

  it("makes earned pills buttons and locked ones inert", () => {
    seed(game(["crystal"]));
    const body = modal();
    const buttons = (body.match(/aria-expanded=/g) ?? []).length;
    // Exactly one earned collectible, so exactly one openable pill.
    expect(buttons).toBe(1);
  });

  it("names every locked badge without revealing its trigger", () => {
    seed(game(["crystal", "twoway"]));
    const body = modal();
    expect(body).toContain("CRYSTAL BALL");
    expect(body).toContain("THE TWO-WAY GUY");
    // A locked slot names the badge — that is the direction it owes the
    // player — but never its emoji and never its trigger. The `how` string
    // stays the reward for actually earning it.
    expect(body).toContain("COOPERSTOWN CLASS");
    expect(body).toContain("RING BEARERS");
    expect(body).not.toContain(BADGE_BY_KEY.cooperstown.how);
    expect(body).not.toContain(BADGE_BY_KEY.rings.how);
    // The glyph rides along on a locked pill — it is a hint, not the answer.
    expect(body).toContain(BADGE_BY_KEY.rings.emoji);
    expect(lockedSlots(body)).toBe(BADGES.length - 2);
  });

  /* Locked pills carry one of two screen-reader strings and nothing else does,
   * so counting them is the cheapest exact read of the silhouette board. A
   * named locked badge says "Not yet earned"; a secret one, which withholds its
   * name as well, says "An undiscovered badge". */
  function namedSlots(body: string): number {
    return (body.match(/Not yet earned/g) ?? []).length;
  }
  function secretSlots(body: string): number {
    return (body.match(/An undiscovered badge/g) ?? []).length;
  }
  function lockedSlots(body: string): number {
    return namedSlots(body) + secretSlots(body);
  }

  it("withholds the name of a secret but not of a performance badge", () => {
    seed();
    const body = modal();
    // A performance badge names the thing to go do — that is the direction the
    // case owes the player.
    expect(body).toContain("MATCHED THE 2016 CUBS");
    expect(body).toContain("PERFECT SEASON");
    // A secret is a fact about one season or person. Naming it would turn
    // discovery into an errand: "go look up Bonilla".
    expect(body).not.toContain("DEFERRED MONEY");
    expect(body).not.toContain("PICKET LINE");
    expect(body).not.toContain("PLAYER-MANAGER");
    // Both classes render "? ? ?": a secret keeps its glyph as a hint, an
    // anti-trophy gives up even that.
    expect(secretSlots(body)).toBe(BADGES.filter((b) => b.secret || b.ironic).length);
    expect(body).not.toContain(BADGE_BY_KEY.skull.emoji);
  });

  it("slots every badge on a fresh case but counts only the collectible ones", () => {
    seed();
    const body = modal();
    // Every badge gets a slot, anti-trophies included — but theirs is fully
    // anonymous, so it invites nothing.
    expect(lockedSlots(body)).toBe(BADGES.length);
    // The fraction still counts only what can be chased.
    expect(body).toContain(`0 OF ${COLLECTIBLE.length}`);
    expect(COLLECTIBLE.length).toBeLessThan(BADGES.length);
  });

  it("names an anti-trophy only once it is earned", () => {
    seed(game(["skull"]));
    const body = modal();
    expect(body).toContain("100-LOSS CLUB");
    expect(body).toContain(BADGE_BY_KEY.skull.emoji);
    // It never enters the fraction, earned or not.
    expect(body).toContain(`0 OF ${COLLECTIBLE.length}`);
    // And earning it converts its anonymous slot rather than adding one.
    expect(lockedSlots(body)).toBe(BADGES.length - 1);
  });

  it("heads each rarity band with its tier word, so rarity is not color alone", () => {
    seed(game(["crown", "mariners", "crystal"]));
    const body = modal();
    for (const tier of ["legend", "ultra", "rare", "uncommon", "common"]) {
      expect(body).toContain(`>${tier}<`);
    }
  });

  it("heads the ironic band from the start but keeps it anonymous", () => {
    // The band is always there — the case shows the shape of the whole set —
    // but until one is earned it says nothing about what is in it.
    seed(game(["crystal"]));
    const before = modal();
    expect(before).toContain(">ironic<");
    expect(before).not.toContain("100-LOSS CLUB");
    expect(before).not.toContain(BADGE_BY_KEY.skull.emoji);
    seed(game(["crystal", "skull"]));
    expect(modal()).toContain("100-LOSS CLUB");
  });

  it("files an earned badge and a locked one in the same rarity band", () => {
    // CRYSTAL BALL is rare and earned; COOPERSTOWN CLASS is rare and locked.
    // Both must fall between the RARE heading and the UNCOMMON one, earned
    // ahead of locked.
    seed(game(["crystal"]));
    const body = modal();
    const rare = body.indexOf(">rare<");
    const uncommon = body.indexOf(">uncommon<");
    const crystal = body.indexOf("CRYSTAL BALL");
    expect(rare).toBeGreaterThan(-1);
    expect(crystal).toBeGreaterThan(rare);
    expect(crystal).toBeLessThan(uncommon);
    // The band's first locked slot sits after the earned pill, still above
    // the next heading.
    const firstLocked = body.indexOf("Not yet earned", rare);
    expect(firstLocked).toBeGreaterThan(crystal);
    expect(firstLocked).toBeLessThan(uncommon);
  });

  it("marks a repeat with a count and leaves a single earn unmarked", () => {
    seed(game(["crystal"]), game(["crystal"]), game(["twoway"]));
    const body = modal();
    expect(body).toContain("×2");
    // Boundary-anchored: a legitimate ×12 must not read as an unmarked ×1.
    expect(body).not.toMatch(/×1(?!\d)/);
  });

  it("says so plainly when nothing is earned yet", () => {
    seed();
    const body = modal();
    expect(body).toContain(`TROPHY CASE · 0 OF ${COLLECTIBLE.length}`);
    expect(body).toContain("No badges yet");
  });
});

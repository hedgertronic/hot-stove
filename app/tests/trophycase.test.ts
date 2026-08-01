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
    expect(COLLECTIBLE.length).toBe(22);
    expect(BADGES.length).toBe(29);
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

  it("names an earned badge and silhouettes the rest of the set", () => {
    seed(game(["crystal", "twoway"]));
    const body = modal();
    expect(body).toContain("CRYSTAL BALL");
    expect(body).toContain("THE TWO-WAY GUY");
    // A locked slot is a shape and a tier, never the identity — the finale
    // still gets to deliver the surprise.
    expect(body).not.toContain("COOPERSTOWN CLASS");
    expect(body).not.toContain("RING BEARERS");
    expect(body).not.toContain("PERFECT SEASON");
    expect(lockedSlots(body)).toBe(COLLECTIBLE.length - 2);
  });

  /* Every locked pill carries this one string and nothing else does, so
   * counting it is the cheapest exact read of the silhouette board. */
  function lockedSlots(body: string): number {
    return (body.match(/Not yet earned/g) ?? []).length;
  }

  it("silhouettes every collectible and no anti-trophy on a fresh case", () => {
    seed();
    // 22, not 29: an empty slot is an invitation, and nobody is invited to
    // lose 100 games. The count is the whole ironic-exclusion rule.
    expect(lockedSlots(modal())).toBe(COLLECTIBLE.length);
  });

  it("gives an earned anti-trophy a pill but never a locked slot", () => {
    seed(game(["skull"]));
    const body = modal();
    expect(body).toContain("100-LOSS CLUB");
    expect(body).toContain(`0 OF ${COLLECTIBLE.length}`);
    // Earning one anti-trophy adds a pill without moving the locked board.
    expect(lockedSlots(body)).toBe(COLLECTIBLE.length);
  });

  it("heads each rarity band with its tier word, so rarity is not color alone", () => {
    seed(game(["crown", "mariners", "crystal"]));
    const body = modal();
    for (const tier of ["legend", "ultra", "rare", "uncommon", "common"]) {
      expect(body).toContain(`>${tier}<`);
    }
  });

  it("heads the ironic band only once an anti-trophy is earned", () => {
    seed(game(["crystal"]));
    expect(modal()).not.toContain(">ironic<");
    seed(game(["crystal", "skull"]));
    expect(modal()).toContain(">ironic<");
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

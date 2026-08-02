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
import BadgeSlot from "../src/components/BadgeSlot.svelte";
import Home from "../src/components/Home.svelte";
import TrophyModal from "../src/components/TrophyModal.svelte";
import { BADGES, BADGE_BY_KEY, COLLECTIBLE } from "../src/lib/badges";
import { badgeCase, clearBadgeCue, loadCues, noteNewBadges } from "../src/lib/settings";
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
  return render(Home, { props: { config: CLASSIC, onplay: () => {}, onlast: () => {} } }).body;
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
    expect(COLLECTIBLE.length).toBe(40);
    expect(BADGES.length).toBe(47);
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
    // Secrets and anti-trophies both render as glyph + "? ? ?" — the glyph is
    // the hint, the withheld name is the discovery.
    expect(secretSlots(body)).toBe(BADGES.filter((b) => b.secret || b.ironic).length);
    expect(body).toContain(BADGE_BY_KEY.skull.emoji);
    expect(body).not.toContain("100-LOSS CLUB");
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
      expect(body).toContain(`>${tier.toUpperCase()}<`);
    }
  });

  it("heads the ironic band from the start but keeps it anonymous", () => {
    // The band is always there — the case shows the shape of the whole set —
    // but until one is earned it says nothing about what is in it.
    seed(game(["crystal"]));
    const before = modal();
    expect(before).toContain(">IRONIC<");
    // The glyph shows; the name does not. A 💀 in the brick band reads as a
    // hazard sign, and it stays out of the progress fraction either way.
    expect(before).toContain(BADGE_BY_KEY.skull.emoji);
    expect(before).not.toContain("100-LOSS CLUB");
    seed(game(["crystal", "skull"]));
    expect(modal()).toContain("100-LOSS CLUB");
  });

  it("files an earned badge and a locked one in the same rarity band", () => {
    // CRYSTAL BALL is rare and earned; COOPERSTOWN CLASS is rare and locked.
    // Both must fall between the RARE heading and the UNCOMMON one, earned
    // ahead of locked.
    seed(game(["crystal"]));
    const body = modal();
    const rare = body.indexOf(">RARE<");
    const uncommon = body.indexOf(">UNCOMMON<");
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

  /* BadgeSlot is the tappable pill on BOTH surfaces — the case and the finale
   * brag row — so its contract is asserted once here rather than twice.
   *
   * The reveal is a floating panel, placed by measurement at runtime, so most
   * of what it promises (it points at its pill, it stays inside the row, it
   * moves nothing) is geometry that only exists in a laid-out browser and is
   * covered by the Playwright pass instead. What SSR can pin down is the one
   * structural fact that geometry rests on: the button and the panel are
   * SIBLINGS, and the panel is a `<p>`.
   *
   * Sibling, because an absolutely positioned box is placed against its
   * containing block — being a sibling is what makes that block the caller's
   * ROW, which is in turn what lets the panel be clamped inside the row and
   * therefore inside a scrolling sheet. Nested in the button, it would be
   * measured against the pill and could never be fenced.
   *
   * A `<p>` and not a second button, because the finale staggers its deal-in
   * with `.brags > button:nth-of-type(n) .brag`. That selector counts BUTTONS
   * precisely so an opened panel cannot renumber the pills; a panel that
   * rendered as a button would put the count back in play. */
  describe("the shared badge reveal", () => {
    function slot(open: boolean): string {
      return render(BadgeSlot, {
        props: { badge: BADGE_BY_KEY.crystal, open, ontoggle: () => {} },
      }).body;
    }

    it("shows the trigger only when open, and says so in aria", () => {
      const shut = slot(false);
      expect(shut).toContain('aria-expanded="false"');
      expect(shut).not.toContain(BADGE_BY_KEY.crystal.how);
      // Nothing to point at while it is shut.
      expect(shut).not.toContain("aria-controls");

      const open = slot(true);
      expect(open).toContain('aria-expanded="true"');
      expect(open).toContain(BADGE_BY_KEY.crystal.how);
    });

    it("points aria-controls at the element it actually rendered", () => {
      const body = slot(true);
      const controls = body.match(/aria-controls="([^"]+)"/)?.[1];
      expect(controls).toBeTruthy();
      expect(body).toContain(`id="${controls}"`);
    });

    it("renders the reveal as a sibling of the button, after it", () => {
      const body = slot(true);
      const end = body.indexOf("</button>");
      expect(end).toBeGreaterThan(-1);
      // The trigger text sits outside the button entirely.
      expect(body.indexOf(BADGE_BY_KEY.crystal.how)).toBeGreaterThan(end);
      // Exactly one button per slot, open or shut — the finale's stagger
      // selector counts buttons, so a second one would renumber the pills.
      expect((body.match(/<button/g) ?? []).length).toBe(1);
      expect((slot(false).match(/<button/g) ?? []).length).toBe(1);
    });

    it("ships the connector with the panel and nothing else", () => {
      const open = slot(true);
      const panel = open.slice(open.indexOf("</button>"));
      // The arrow is the panel's own child — it is what the runtime aims at
      // the pill, and it is decorative, so it stays out of the reading order.
      expect(panel).toContain("notch");
      expect(panel).toContain('aria-hidden="true"');
      // The badge's emoji is deliberately NOT repeated in the panel: the arrow
      // is what says which pill this belongs to. It still rides on the PILL,
      // which is why this is asserted on the panel's slice and not the whole
      // render.
      expect(panel).not.toContain(BADGE_BY_KEY.crystal.emoji);
      expect(open).toContain(BADGE_BY_KEY.crystal.emoji);
      // A shut slot has no panel, so no connector either.
      expect(slot(false)).not.toContain("notch");
    });
  });

  /* The NEW flags inside the case, and the handover that makes them possible.
   *
   * The trophy button clears the cue on the tap that OPENS this sheet, so by
   * the time the sheet mounts the stored list is already gone. The clear hands
   * its list to `takeOpenedBadgeCue`, which the sheet takes once. Every test
   * here reproduces that real order — note, clear, then render — because a test
   * that rendered before clearing would pass against a broken implementation. */
  describe("new badges inside the case", () => {
    it("flags the badges that were pending when the case was opened", () => {
      seed(game(["crystal", "twoway", "hundred"]));
      noteNewBadges(["crystal", "hundred"]);
      // The button's half of the sequence.
      clearBadgeCue();
      expect(loadCues().pendingBadges).toEqual([]);

      const body = modal();
      // Two flags, on the two badges that were pending.
      expect((body.match(/>NEW</g) ?? []).length).toBe(2);
      const crystal = body.indexOf("CRYSTAL BALL");
      const twoway = body.indexOf("THE TWO-WAY GUY");
      const firstNew = body.indexOf(">NEW<");
      expect(firstNew).toBeGreaterThan(-1);
      // The flagged rare leads its band, ahead of the unflagged one.
      expect(crystal).toBeLessThan(twoway);
    });

    it("shows a clean board on the next open", () => {
      seed(game(["crystal", "hundred"]));
      noteNewBadges(["crystal"]);
      clearBadgeCue();
      expect(modal()).toContain(">NEW<");
      // Same session, sheet opened again: the cue was taken, not read.
      expect(modal()).not.toContain(">NEW<");
    });

    it("flags nothing when the case is opened with no news", () => {
      seed(game(["crystal", "hundred"]));
      // No noteNewBadges, so the button never lights and never clears.
      expect(modal()).not.toContain(">NEW<");
    });

    it("ignores a pending key the player has no earned tile for", () => {
      // A retired key, or a finale whose history write never landed. It must
      // not invent a pill, and must not flag anything else.
      seed(game(["crystal"]));
      noteNewBadges(["moonshot"]);
      clearBadgeCue();
      const body = modal();
      expect(body).not.toContain(">NEW<");
      expect(body).toContain("CRYSTAL BALL");
    });

    it("carries flags across several bands at once", () => {
      // A first-ever game can earn a handful in one go.
      seed(game(["crown", "mariners", "crystal", "cubs", "hundred", "skull"]));
      noteNewBadges(["crown", "mariners", "crystal", "cubs", "hundred", "skull"]);
      clearBadgeCue();
      expect((modal().match(/>NEW</g) ?? []).length).toBe(6);
    });
  });

  it("says so plainly when nothing is earned yet", () => {
    seed();
    const body = modal();
    expect(body).toContain(`TROPHY CASE · 0 OF ${COLLECTIBLE.length}`);
    expect(body).toContain("No badges yet");
  });
});

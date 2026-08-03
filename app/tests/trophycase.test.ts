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
import BadgePill from "../src/components/BadgePill.svelte";
import BadgeSlot from "../src/components/BadgeSlot.svelte";
import Home from "../src/components/Home.svelte";
import TrophyModal from "../src/components/TrophyModal.svelte";
import { BADGES, BADGE_BY_KEY, COLLECTIBLE, RARITY_ORDER } from "../src/lib/badges";
import type { BadgeDef } from "../src/lib/badges";
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

/** Two NAMED collectible badges from one rarity band, in table order — the pair
 * the band-local assertions need. Derived rather than written out, because
 * which tier a badge sits in and whether it is `secret` are both data that move
 * under this file; a hard-coded pair turns a re-tiering into a false failure. */
function bandPair(): [BadgeDef, BadgeDef] {
  for (const r of RARITY_ORDER) {
    const band = BADGES.filter((b) => b.rarity === r && !b.ironic && !b.secret);
    if (band.length >= 2) return [band[0], band[1]];
  }
  throw new Error("no rarity band holds two named collectible badges");
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
    expect(COLLECTIBLE.length).toBe(52);
    expect(BADGES.length).toBe(63);
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

  it("survives a history full of the two badges retired this round", () => {
    // `respect` and `walkoff` shipped, so real saves hold them. They reach
    // three unguarded property accesses inside badgeCase's sort — a key that
    // slipped past the filter would throw on `.rarity` and take the whole
    // trophy case down for anyone who had earned one. Every entry is retired
    // here, so a reader that only survived a MIXED history still fails.
    seed(game(["respect"]), game(["walkoff", "respect"]));
    expect(counts()).toEqual({});
    const c = badgeCase();
    expect(c.earned).toBe(0);
    expect(c.tiles).toEqual([]);
    // And the fraction's denominator never counted them either.
    expect(c.total).toBe(COLLECTIBLE.length);
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
    // One badge per tier, read off the table rather than named: the assertion
    // is about the ORDER of the ladder, and which tier any given badge is filed
    // under is data that moves independently of it. Seeded backwards, so a
    // reader that simply preserved history order would fail.
    const perTier = RARITY_ORDER.map((r) => BADGES.find((b) => b.rarity === r));
    expect(perTier.every((b) => b != null)).toBe(true);
    const keys = (perTier as BadgeDef[]).map((b) => b.key);
    seed(game([...keys].reverse()));
    expect(badgeCase().tiles.map((t) => t.key)).toEqual(keys);
  });
});

describe("the trophy case sheet", () => {
  it("heads the sheet with its name and no fraction", () => {
    // The denominator is gone on purpose. A trophy case answers "which
    // trophies do I have", and the ladder below shows exactly that, band by
    // band; "2 OF 52" only ever answered "how much is left", which turns a
    // collection into an errand. The passport under it lost its count the same
    // day and for the same reason.
    seed(game(["crystal", "twoway", "skull"]));
    const body = modal();
    expect(body).toContain("TROPHY CASE");
    expect(body).not.toMatch(/\d+ OF \d+/);
    // The reader still computes it — the sheet just stopped printing it.
    expect(badgeCase().earned).toBe(2);
    expect(badgeCase().total).toBe(COLLECTIBLE.length);
  });

  it("takes its header and its exits from the sheet, exactly once each", () => {
    // Sheet draws the title, the corner ✕ and the bottom button from `title`
    // and `confirmLabel`. A caller that also drew its own would render two of
    // each, which is the shape that produced two payroll boxes — and the
    // duplication is invisible in a screenshot of the top of the sheet.
    seed(game(["crystal"]));
    const body = modal();
    expect((body.match(/aria-label="Close"/g) ?? []).length).toBe(1);
    expect((body.match(/>CLOSE</g) ?? []).length).toBe(1);
    expect((body.match(/TROPHY CASE/g) ?? []).length).toBe(1);
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
    // case owes the player. Both examples are badges whose whole point is the
    // direction: pick ones the table has no reason to mark `secret`, since a
    // named example that later goes anonymous turns this into a false failure.
    expect(body).toContain("COOPERSTOWN CLASS");
    expect(body).toContain("RING BEARERS");
    // A secret's NAME is part of the reward — a fact about one season or
    // person, an exact rung you could farm, or the peak of the ladder itself.
    // Naming any of them turns a discovery into an errand.
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
    // The reader's fraction still counts only what can be chased, even though
    // the sheet no longer prints it.
    expect(badgeCase().total).toBe(COLLECTIBLE.length);
    expect(COLLECTIBLE.length).toBeLessThan(BADGES.length);
  });

  it("names an anti-trophy only once it is earned", () => {
    seed(game(["skull"]));
    const body = modal();
    expect(body).toContain("100-LOSS CLUB");
    expect(body).toContain(BADGE_BY_KEY.skull.emoji);
    // It never enters the fraction, earned or not.
    expect(badgeCase().earned).toBe(0);
    // And earning it converts its anonymous slot rather than adding one.
    expect(lockedSlots(body)).toBe(BADGES.length - 1);
  });

  it("heads each rarity band with its tier word, so rarity is not color alone", () => {
    seed(game(["crown", "mariners", "crystal"]));
    const body = modal();
    // Every tier the ladder declares, not a copy of the list: the case builds
    // its bands from RARITY_ORDER, so a tier renamed or inserted there has to
    // show up here without this line being touched.
    for (const tier of RARITY_ORDER) {
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
    // Two badges of one tier, one earned and one not. Both must fall between
    // that tier's heading and the next one, earned ahead of locked.
    const [earned] = bandPair();
    const tier = RARITY_ORDER.indexOf(earned.rarity);
    expect(tier).toBeGreaterThan(-1);
    expect(tier).toBeLessThan(RARITY_ORDER.length - 1);
    const head = `>${earned.rarity.toUpperCase()}<`;
    const nextHead = `>${RARITY_ORDER[tier + 1].toUpperCase()}<`;
    seed(game([earned.key]));
    const body = modal();
    const band = body.indexOf(head);
    const next = body.indexOf(nextHead);
    const at = body.indexOf(earned.label);
    expect(band).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(band);
    expect(at).toBeLessThan(next);
    // The band's first locked slot sits after the earned pill, still above
    // the next heading.
    const firstLocked = body.indexOf("Not yet earned", band);
    expect(firstLocked).toBeGreaterThan(at);
    expect(firstLocked).toBeLessThan(next);
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

  /* The silhouette itself, asserted on BadgePill rather than through the sheet,
   * because the question is the component's contract and not this table's
   * current contents.
   *
   * Which locked badges go anonymous is DATA — `secret` — and never a rarity
   * test. Rarity cannot express it: the exact-match rungs that must stay
   * nameless span three different tiers, so the moment a tier appears in this
   * branch the rule is wrong. These render a forged legendary badge both ways
   * to pin that, because legendary is where the temptation to special-case
   * lives — it is the top rung and the one inverted pill. */
  describe("the locked silhouette", () => {
    // The top rung by position, not by name, so the rename of the tier itself
    // cannot turn this into a test of nothing.
    const TOP = BADGES.find((b) => b.rarity === RARITY_ORDER[0]);

    function pill(badge: BadgeDef, locked: boolean): string {
      return render(BadgePill, { props: { badge, locked } }).body;
    }

    it("withholds the name of any locked secret, top rung included", () => {
      expect(TOP).toBeTruthy();
      const badge = { ...(TOP as BadgeDef), secret: true };
      const body = pill(badge, true);
      // The one anonymous form the app has, not a second one: same glyph kept,
      // same withheld name, same screen-reader string as every other secret.
      expect(body).toContain(badge.emoji);
      expect(body).toContain("? ? ?");
      expect(body).not.toContain(badge.label);
      expect(body).toContain("An undiscovered badge");
      expect(body).not.toContain("Not yet earned");
    });

    it("keeps the tier on the pill while the identity goes", () => {
      // The rarity token IS the class, which is what carries the inverted
      // legendary treatment onto an anonymous pill. Read off the badge so the
      // assertion survives the tier being renamed.
      const badge = { ...(TOP as BadgeDef), secret: true };
      const cls = pill(badge, true).match(/class="([^"]*brag[^"]*)"/)?.[1] ?? "";
      expect(cls.split(/\s+/)).toContain(badge.rarity);
      expect(cls.split(/\s+/)).toContain("locked");
    });

    it("names a locked badge that is not secret, whatever its tier", () => {
      // The proof the branch is keyed on data: the same top-rung badge without
      // the flag is named like any other locked slot. Forged both ways rather
      // than taken from the table, so which badges the table marks today
      // decides neither half of the pair.
      const badge = { ...(TOP as BadgeDef), secret: false };
      const body = pill(badge, true);
      expect(body).toContain(badge.label);
      expect(body).toContain("Not yet earned");
      expect(body).not.toContain("? ? ?");
    });

    it("leaves an EARNED badge alone, flag or no flag", () => {
      const badge = { ...(TOP as BadgeDef), secret: true };
      const body = pill(badge, false);
      expect(body).toContain(badge.label);
      expect(body).toContain(badge.emoji);
      expect(body).not.toContain("? ? ?");
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
      // Both from ONE band, so the ordering assertion is about the flag and not
      // about which tier either badge is filed under. The flagged one is the
      // SECOND in table order, so nothing but the flag can put it first.
      const [first, second] = bandPair();
      seed(game([first.key, second.key, "hundred"]));
      noteNewBadges([second.key, "hundred"]);
      // The button's half of the sequence.
      clearBadgeCue();
      expect(loadCues().pendingBadges).toEqual([]);

      const body = modal();
      // Two flags, on the two badges that were pending — and not on the third.
      expect((body.match(/>NEW</g) ?? []).length).toBe(2);
      const firstNew = body.indexOf(">NEW<");
      expect(firstNew).toBeGreaterThan(-1);
      // The flagged badge leads its band, ahead of the unflagged one.
      expect(body.indexOf(second.label)).toBeLessThan(body.indexOf(first.label));
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
    expect(body).toContain("TROPHY CASE");
    expect(body).not.toMatch(/\d+ OF \d+/);
    expect(body).toContain("No badges yet");
  });
});

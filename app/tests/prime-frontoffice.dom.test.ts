// @vitest-environment jsdom
/** ⭐ Prime Time's only front-office target is the SKIPPER — owner and stadium
 * tiles never reach the manager career sheet. While Prime is armed the two
 * untargetable rows therefore wear the same gray the taken rows wear
 * (availability is binary: active or gray) and go genuinely inert, while the
 * manager tile stays live and gains its amber browse affordance.
 *
 * Mounted in jsdom rather than SSR-rendered: the contract includes DISARMING
 * restoring the rows, which is a reactive update — an SSR string can only
 * prove the armed snapshot, not that the state is derived rather than latched.
 */
import { describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import SpecialPrimePicker from "../src/components/SpecialPrimePicker.svelte";
import SpecialRows from "../src/components/SpecialRows.svelte";
import { forgeGame, mkCard } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";
import type { Owners, SpecialsIndex } from "../src/lib/types";

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const EYE: GameConfig = { difficulty: "scout", bank: "classic" };

/** The three front-office buttons, in render order: owner · stadium · skipper. */
function rows(target: HTMLElement): HTMLButtonElement[] {
  return [...target.querySelectorAll<HTMLButtonElement>("button.srow")];
}

function mountRows(game: Game): { target: HTMLElement; comp: Record<string, unknown> } {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const comp = mount(SpecialRows, {
    target,
    props: { game, confirmKey: null, setConfirm: () => {} },
  });
  return { target, comp: comp as Record<string, unknown> };
}

describe("front-office rows while Prime Time is armed", () => {
  it("grays and disables owner + stadium, leaves the skipper targetable", async () => {
    const game = forgeGame(CLASSIC, (g) => {
      g.card = mkCard();
    });
    const { target, comp } = mountRows(game);

    // Ready state: all three live, none gray.
    let [owner, stadium, skipper] = rows(target);
    expect(rows(target)).toHaveLength(3);
    for (const b of [owner, stadium, skipper]) {
      expect(b.disabled).toBe(false);
      expect(b.className).not.toContain("taken");
    }

    game.togglePrime();
    flushSync();
    [owner, stadium, skipper] = rows(target);
    for (const b of [owner, stadium]) {
      expect(b.disabled).toBe(true);
      expect(b.className).toContain("taken");
    }
    // The one valid target keeps its amber "browsable" look and its tap.
    expect(skipper.disabled).toBe(false);
    expect(skipper.className).not.toContain("taken");
    expect(skipper.className).toContain("prime");

    // Derived, not latched: disarming restores all three.
    game.togglePrime();
    flushSync();
    [owner, stadium, skipper] = rows(target);
    for (const b of [owner, stadium, skipper]) {
      expect(b.disabled).toBe(false);
      expect(b.className).not.toContain("taken");
    }
    expect(skipper.className).not.toContain("prime");

    await unmount(comp as never);
    target.remove();
  });

  it("an already-hired owner stays Trade-Deadline swappable while Prime is armed", async () => {
    // Prime's blackout applies to UNTAKEN owner/stadium rows only: an armed
    // Trade Deadline still swaps a hired one, and that amber path outranks it.
    const game = forgeGame(CLASSIC, (g) => {
      g.card = mkCard();
      g.owner = {
        name: "Hiroshi Yamauchi",
        budget: 92.1,
        franchise: "SEA",
        year: 2001,
        teamName: "Seattle Mariners",
      };
      g.powerups.tradeDeadline = "armed";
      g.powerups.prime = "armed";
    });
    const { target, comp } = mountRows(game);
    const [owner] = rows(target);
    expect(owner.disabled).toBe(false);
    expect(owner.className).toContain("swap");

    await unmount(comp as never);
    target.remove();
  });
});

/** The corpus's longest front-office strings, both real. The owner is Kansas
 * City's 1993–2000 entry in `data/owners.json`; the park is Montreal's 2003–04
 * home, split between two stadiums, in `data/cards/MON_2003.json`. They are the
 * inputs that made the FRONT OFFICE section grow wider than the phone, so they
 * are the inputs the markup contract is pinned against.
 *
 * STORED and DISPLAYED are two different strings, and the difference is the
 * point: `ownerFor` drops a trailing parenthetical, so the row never renders
 * the 64-character stored form. 40 characters is the real ceiling the layout
 * has to survive, and a test that asserted the stored form would be measuring
 * a width the game cannot produce. The fixture therefore hands over the STORED
 * name and expects the DISPLAYED one, which pins the trim as well. */
const OWNER_STORED = "Greater Kansas City Community Foundation (David Glass, chairman)";
const OWNER_SHOWN = "Greater Kansas City Community Foundation";
const LONG_PARK = "Stade Olympique/Hiram Bithorn Stadium";

const longOwners: Owners = {
  franchises: {
    KCA: { name: "Kansas City Royals", owners: [{ name: OWNER_STORED, from: 1993, to: 2000 }] },
  },
};

/** What the row's overflow fix rests on, in markup terms.
 *
 * The blowout was a track-sizing bug: `.special` sized its column to the rows'
 * min-content, a row's min-content ran through the nowrap name, and the name
 * can be 64 characters. Only a laid-out browser can prove the pixels, and the
 * suite's rule is that a class or a structure proves the state while the look
 * is a screenshot job — so what is asserted here is the structure the CSS fix
 * needs to keep working.
 *
 * Two things have to stay true. The name has to render WHOLE, because
 * truncation is the stylesheet's job and a JS slice would hide the very bug
 * this guards. And the price has to sit OUTSIDE the shrinking column, because
 * `.mid` is the box allowed to collapse to zero — a value nested in it would
 * collapse with it, and DECISIONS' round-16 rule is that these columns are
 * structural. */
describe("front-office rows under the corpus's longest names", () => {
  function longGame(config: GameConfig = CLASSIC): Game {
    return forgeGame(config, (g) => {
      g.owners = longOwners;
      g.card = mkCard({ team: "KCA", franchise: "KCA", year: 1995, park: LONG_PARK });
    });
  }

  it("renders both names in full — trimming belongs to CSS, not to the data", () => {
    const game = longGame();
    const { target, comp } = mountRows(game);
    const [owner, stadium] = rows(target);
    expect(owner.querySelector(".who")?.textContent).toBe(OWNER_SHOWN);
    expect(stadium.querySelector(".who")?.textContent).toBe(LONG_PARK);
    unmount(comp as never);
    target.remove();
  });

  it("keeps the value out of the column that collapses", () => {
    const game = longGame();
    const { target, comp } = mountRows(game);
    for (const row of rows(target)) {
      const mid = row.querySelector(".mid");
      const val = row.querySelector(".val");
      expect(mid).not.toBeNull();
      expect(val).not.toBeNull();
      // A sibling of the shrinking box, never a descendant of it.
      expect(mid!.contains(val!)).toBe(false);
      expect(val!.parentElement).toBe(row);
    }
    unmount(comp as never);
    target.remove();
  });
});

/** ⭐ Prime Time on a manager: every season of the career wears the rung its
 * own record earns, on the ladder the roster rail's MGR seat already uses.
 *
 * The mapping is net wins × MANAGER_PER_NET_WIN through `warTier`, which is a
 * different arithmetic from a player's raw WAR, so the fixture spans the
 * ladder rather than sampling it: 116–46 is 14.0 WINS (elite), 90–72 is 3.6
 * WINS (mid), 81–81 is 0.0 WINS (low) and 60–102 is −8.4 WINS (neg). One rung
 * asserted alone passes on a constant.
 *
 * The token is also the only carrier — the row's `war-*` class sets the pair
 * the season's WINS chip wears — so a row emitting two would hand the chip
 * whichever pair the stylesheet listed last.
 *
 * And Eye Test must emit none of it. That mode already withholds the record and
 * the win value; a row washed gold would hand back the whole read the
 * withholding bought. */
describe("the manager career sheet colors every season by its rung", () => {
  /** [year, w, l, row token, the chip's bare value]. The chip's textContent is
   * the value with its WINS unit run together — jsdom textContent has no space
   * between the number and the unit span. */
  const CAREER: [number, number, number, string, string][] = [
    [2001, 116, 46, "war-elite", "14.0"],
    [2002, 90, 72, "war-mid", "3.6"],
    [2003, 81, 81, "war-low", "0.0"],
    [2004, 60, 102, "war-neg", "−8.4"],
  ];

  const specials: SpecialsIndex = {
    SEA: CAREER.map(([year, w, l]) => ({
      team: "SEA",
      year,
      name: "Seattle Mariners",
      park: "Safeco Field",
      mgr: "Lou Piniella",
      w,
      l,
      att: 1,
      mult: 1.05,
      budget: 92.1,
    })),
  };

  globalThis.fetch = (async (url: unknown) =>
    String(url).endsWith("data/specials.json") ?
      { ok: true, json: async () => specials }
    : { ok: false, status: 404 }) as unknown as typeof fetch;

  /** Mount the sheet and let its career fetch settle. */
  async function sheet(config: GameConfig): Promise<{ el: HTMLElement; close: () => void }> {
    const game = forgeGame(config, (g) => {
      // 1999 is off the career above, so no row is the landed card's own and
      // none grays out — the gray state overrides the rung on purpose and
      // would mask it here.
      g.card = mkCard({ year: 1999, manager: "Lou Piniella" });
      g.powerups.prime = "armed";
      g.primeSpecial = "manager";
    });
    const target = document.createElement("div");
    document.body.appendChild(target);
    const comp = mount(SpecialPrimePicker, { target, props: { game, onclose: () => {} } });
    await new Promise((r) => setTimeout(r, 20));
    return {
      el: target,
      close: () => {
        void unmount(comp as never);
        target.remove();
      },
    };
  }

  it("Box Score puts exactly one rung token on each season, matching its record", async () => {
    const { el, close } = await sheet(CLASSIC);
    const seasons = [...el.querySelectorAll<HTMLButtonElement>("button.srow")];
    expect(seasons).toHaveLength(CAREER.length);
    seasons.forEach((row, i) => {
      const [year, , , token, value] = CAREER[i];
      expect(row.textContent).toContain(String(year));
      expect(row.className).toContain(token);
      expect(row.className.match(/war-/g)).toHaveLength(1);
      // The value rides the chip: bare number (minus kept, plus dropped) with
      // the WINS unit beside it in the player chips' own unit register.
      const chip = row.querySelector(".val.warchip");
      expect(chip).not.toBeNull();
      expect(chip!.textContent).toBe(`${value}WINS`);
      expect(chip!.querySelector(".unit")?.textContent).toBe("WINS");
    });
    close();
  });

  it("Eye Test leaves every season untinted and unvalued", async () => {
    const { el, close } = await sheet(EYE);
    const seasons = [...el.querySelectorAll<HTMLButtonElement>("button.srow")];
    expect(seasons).toHaveLength(CAREER.length);
    for (const row of seasons) {
      expect(row.className).not.toContain("war-");
      expect(row.querySelector(".val")).toBeNull();
    }
    close();
  });
});

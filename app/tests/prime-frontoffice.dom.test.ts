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
import SpecialRows from "../src/components/SpecialRows.svelte";
import { forgeGame, mkCard } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };

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

// @vitest-environment jsdom
/** The meter label row is a legend for the bar above it: the figure that has
 * gone out wears the fill's orange, the figure still available wears its
 * green. Both colours ride an inner `.amt` span, because the words SPENT and
 * LEFT are constants and only the numbers are the signal.
 *
 * The contract these tests hold is that the green figure and the orange
 * over-payroll warning NEVER render together. That is what lets one hue mean
 * two things safely — outflow on the left, trouble on the right — so it is
 * worth a test rather than a comment.
 *
 * Mounted in jsdom rather than SSR-rendered because the interesting cases are
 * transitions: hiring an owner turns the unknown into a real figure, and
 * spending past the payroll swaps that figure for the warning. Only a reactive
 * update can prove either.
 */
import { describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import BankBox from "../src/components/BankBox.svelte";
import { forgeGame, mkCard, mkSigned } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };

const OWNER = {
  name: "Hiroshi Yamauchi",
  budget: 92.1,
  franchise: "SEA",
  year: 2001,
  teamName: "Seattle Mariners",
};

function mountBox(game: Game): { target: HTMLElement; comp: Record<string, unknown> } {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const comp = mount(BankBox, { target, props: { game } });
  return { target, comp: comp as Record<string, unknown> };
}

/** The two halves of the meter label row, left to right. */
function labels(target: HTMLElement): HTMLElement[] {
  return [...target.querySelectorAll<HTMLElement>(".meter-lbl > span")];
}

/** The figure inside a label half, or null where the half carries no number
 * the row is willing to colour — which is exactly the unknown-payroll case. */
function amount(el: HTMLElement): string | null {
  return el.querySelector(".amt")?.textContent ?? null;
}

function spendGame(config: GameConfig, costPaid: number): Game {
  return forgeGame(config, (g) => {
    g.card = mkCard();
    g.slots[0] = mkSigned({ name: "Payroll Loader", pos: "C", costPaid });
  });
}

describe("the payroll label row", () => {
  it("colours the spent figure from spin one, owner or no owner", () => {
    const game = spendGame(CLASSIC, 34);
    const { target, comp } = mountBox(game);

    const [spent] = labels(target);
    expect(spent.textContent).toBe("SPENT $34M");
    // The label is a constant, so the colour lands on the number alone.
    expect(amount(spent)).toBe("$34M");

    game.owner = { ...OWNER };
    flushSync();
    expect(amount(labels(target)[0])).toBe("$34M");

    unmount(comp as never);
    target.remove();
  });

  it("leaves the unknown uncoloured until an owner supplies the denominator", () => {
    const game = spendGame(CLASSIC, 34);
    const { target, comp } = mountBox(game);

    const [, left] = labels(target);
    expect(left.textContent).toBe("$??? LEFT");
    // Nothing to colour: there is no figure, and italic alone marks the unknown.
    expect(amount(left)).toBe(null);
    expect(left.classList.contains("nocap")).toBe(true);

    game.owner = { ...OWNER };
    flushSync();

    const [, resolved] = labels(target);
    expect(resolved.textContent).toBe("$58.1M LEFT");
    expect(amount(resolved)).toBe("$58.1M");
    expect(resolved.classList.contains("left")).toBe(true);

    unmount(comp as never);
    target.remove();
  });

  it("swaps the green figure for the warning rather than showing both", () => {
    const game = spendGame(CLASSIC, 34);
    const { target, comp } = mountBox(game);

    // A payroll this signing already blew: the right half becomes the alarm.
    game.owner = { ...OWNER, budget: 20 };
    flushSync();

    const [spent, right] = labels(target);
    expect(game.capKnown).toBe(true);
    expect(right.classList.contains("warn")).toBe(true);
    expect(right.classList.contains("left")).toBe(false);
    expect(right.textContent).toContain("OVER PAYROLL");
    // The invariant that lets orange mean two things: the green figure is gone.
    expect(target.querySelector(".left")).toBe(null);
    // …and the spent figure keeps its own orange, so the row reads as one alarm.
    expect(amount(spent)).toBe("$34M");

    unmount(comp as never);
    target.remove();
  });

  it("shows both figures from spin one in the fixed-cap banks", () => {
    for (const bank of ["moneyball", "blankcheck"] as const) {
      const game = spendGame({ difficulty: "standard", bank }, 34);
      const { target, comp } = mountBox(game);

      expect(game.capKnown).toBe(true);
      const [spent, left] = labels(target);
      expect(amount(spent)).toBe("$34M");
      expect(left.classList.contains("left")).toBe(true);
      expect(amount(left)).not.toBe(null);

      unmount(comp as never);
      target.remove();
    }
  });
});

// @vitest-environment jsdom
/** The meter label row is a legend for the bar above it: the figure that has
 * gone out wears the fill's orange, the figure still available wears its
 * green. Both colors ride an inner `.pamt` span, because the words SPENT and
 * LEFT are constants and only the numbers are the signal.
 *
 * The contract these tests hold is that the green figure and the orange
 * over-payroll warning NEVER render together. That is what lets one hue mean
 * two things safely — outflow on the left, trouble on the right — so it is
 * worth a test rather than a comment.
 *
 * The right half has three faces, and which one is showing is the whole
 * subject here: the payroll left, the overrun, and the club with no owner yet,
 * whose spend is all overrun because there is no payroll to be inside of.
 *
 * Mounted in jsdom rather than SSR-rendered because the interesting cases are
 * transitions: hiring an owner turns the unknown into a real figure, and
 * spending past the payroll swaps that figure for the warning. Only a reactive
 * update can prove either.
 *
 * Mounted through `BankBox` on purpose, though the row itself is drawn by the
 * `PayrollBox` it delegates to. Going in the front door is what makes this a
 * test of the board's payroll box rather than of a component in isolation: it
 * proves the adapter hands down the props that produce these states, which is
 * the half of the seam a direct PayrollBox mount would skip.
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
  return [...target.querySelectorAll<HTMLElement>(".paylbl > span")];
}

/** The figure inside a label half, or null where the half carries no number
 * the row is willing to color — which is exactly the unknown-payroll case. */
function amount(el: HTMLElement): string | null {
  return el.querySelector(".pamt")?.textContent ?? null;
}

function spendGame(config: GameConfig, costPaid: number): Game {
  return forgeGame(config, (g) => {
    g.card = mkCard();
    g.slots[0] = mkSigned({ name: "Payroll Loader", pos: "C", costPaid });
  });
}

describe("the payroll label row", () => {
  it("colors the spent figure from spin one, owner or no owner", () => {
    const game = spendGame(CLASSIC, 34);
    const { target, comp } = mountBox(game);

    const [spent] = labels(target);
    expect(spent.textContent).toBe("SPENT $34M");
    // The label is a constant, so the color lands on the number alone.
    expect(amount(spent)).toBe("$34M");

    game.owner = { ...OWNER };
    flushSync();
    expect(amount(labels(target)[0])).toBe("$34M");

    unmount(comp as never);
    target.remove();
  });

  it("reads a club with no owner as a club with a $0 payroll", () => {
    // Not "$???". An unhired chair is not a mystery the player is waiting on,
    // it is a payroll of zero — which is a state they can fix, and which every
    // other reading in the box then follows from without its own rule.
    const game = forgeGame(CLASSIC, (g) => {
      g.card = mkCard();
    });
    const { target, comp } = mountBox(game);

    const [spent, left] = labels(target);
    expect(spent.textContent).toBe("SPENT $0M");
    expect(left.textContent).toBe("$0M LEFT");
    // A real figure, colored like one — the green of money still in hand.
    expect(amount(left)).toBe("$0M");
    expect(left.classList.contains("left")).toBe(true);
    // The payroll chip says the same zero, still dashed because one is coming.
    const eff = [...target.querySelectorAll(".chip")].map((c) => c.textContent);
    expect(eff).toContain("$0M");
    // Three ghost chips: the owner, the ballpark, and the product they have
    // not made yet. The product is the one carrying the zero.
    const ghosts = [...target.querySelectorAll(".chip.ghost")].map((c) => c.textContent);
    expect(ghosts).toEqual(["💰", "🏟️", "$0M"]);
    // Nothing hired and nothing spent is the ONE state the gray drifting hatch
    // still belongs to — no quantity in either direction. Every other pre-owner
    // state is now an overrun, so this is what the hatch means.
    const meter = target.querySelector(".pmeter")!;
    expect(meter.classList.contains("pnocap")).toBe(true);
    expect(meter.classList.contains("pover")).toBe(false);
    expect(target.querySelector(".pfill")!.classList.contains("unknown")).toBe(true);

    unmount(comp as never);
    target.remove();
  });

  it("reads money spent into an empty owner's chair as money over", () => {
    // A club with no owner has no payroll, so the first dollar committed is
    // already past it: $34M spent reads as $34M over — the figure IS the
    // spend, which is what separates this from a real overrun.
    const game = spendGame(CLASSIC, 34);
    const { target, comp } = mountBox(game);

    const [, right] = labels(target);
    expect(game.capKnown).toBe(false);
    expect(right.classList.contains("warn")).toBe(true);
    expect(right.textContent).toBe("$34M OVER");
    expect(amount(right)).toBe("$34M");
    expect(target.querySelector(".left")).toBe(null);

    // The BAR joins in, which is the whole point of reading the payroll as $0:
    // over zero is over, so the club wears the same orange alarm an overrun
    // club wears rather than a neutral hatch that says nothing is wrong.
    const meter = target.querySelector(".pmeter")!;
    expect(meter.classList.contains("pover")).toBe(true);
    expect(meter.classList.contains("pnocap")).toBe(false);
    expect(target.querySelector(".pfill")!.classList.contains("unknown")).toBe(false);

    // Hiring the owner supplies the denominator, and the same $34M turns from
    // over into left — which is exactly what hiring an owner did.
    game.owner = { ...OWNER };
    flushSync();

    const [, resolved] = labels(target);
    expect(resolved.textContent).toBe("$58.1M LEFT");
    expect(amount(resolved)).toBe("$58.1M");
    expect(resolved.classList.contains("left")).toBe(true);
    expect(target.querySelector(".warn")).toBe(null);

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
    // The overrun itself — $34M against a $20M payroll — rather than the words
    // "over payroll". The figure is the news; the word PAYROLL is the row's
    // subject either way and says nothing a player did not already know.
    expect(right.textContent).toBe("$14M OVER");
    expect(amount(right)).toBe("$14M");
    // The invariant that lets orange mean two things: the green figure is gone.
    expect(target.querySelector(".left")).toBe(null);
    // …and the spent figure keeps its own orange, so the row reads as one alarm.
    expect(amount(spent)).toBe("$34M");

    unmount(comp as never);
    target.remove();
  });

  it("a hire thunks its chip and stamps the figures; a mounted box is silent", () => {
    // The landing marks are TRANSIENT state driven by a diff seeded at mount
    // (the rail seats' rule): a box mounted over an already-hired club plays
    // nothing, and only the seat that just filled wears .landed.
    const game = spendGame(CLASSIC, 34);
    const { target, comp } = mountBox(game);
    expect(target.querySelector(".landed")).toBe(null);
    expect(target.querySelector(".bump")).toBe(null);

    game.owner = { ...OWNER };
    flushSync();
    // The owner's chip lands, and the payroll product chip lands with it —
    // the number it carries just came into being. The stadium ghost stays.
    expect(target.querySelector(".chip.own.landed")).not.toBe(null);
    expect(target.querySelector(".chip.eff.landed")).not.toBe(null);
    expect(target.querySelector(".chip.stad")).toBe(null);
    // The figures stamp: the truth changed, and both wear the pop.
    expect(target.querySelectorAll(".pamt.bump").length).toBe(2);

    unmount(comp as never);
    target.remove();
  });

  it("a box mounted over a finished club never wears a landing mark", () => {
    const game = spendGame(CLASSIC, 34);
    game.owner = { ...OWNER };
    const { target, comp } = mountBox(game);
    expect(target.querySelector(".landed")).toBe(null);
    expect(target.querySelector(".bump")).toBe(null);

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

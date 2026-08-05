/** The squad rail's per-seat salary display.
 *
 * Salary (slot.costPaid, the actually-paid price after prime/Homegrown
 * discounts) is formatted via money() and passed to each player's RailSeat.
 * It renders in the markup at all difficulty modes — salary is a sunk cost,
 * not a talent read, so Eye Test does not gate it.
 *
 * The CSS hides .sal on mobile (display:none) and shows it at 760px+, but
 * jsdom / the SSR renderer have no layout engine, so the visibility rule is
 * not asserted here. The contract being pinned is: the formatted value is
 * present in the rendered HTML whenever a slot is filled. A screenshot or
 * visual regression test covers the responsive behavior.
 *
 * Same SSR-string approach as rail-tiers.test.ts. */
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import { forgeGame, mkCard, mkSigned } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";
import { money } from "../src/lib/format";

// Engine save()/restore() guards storage access; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const SCOUT: GameConfig = { difficulty: "scout", bank: "classic" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ssr(component: Component<any>, props: Record<string, unknown>): string {
  return render(component, { props }).body;
}

function pair(
  mutate: (g: Game) => void,
): { std: string; sct: string } {
  const gs = forgeGame(CLASSIC, mutate);
  const gc = forgeGame(SCOUT, mutate);
  return {
    std: ssr(RosterRail, { game: gs }),
    sct: ssr(RosterRail, { game: gc }),
  };
}

describe("roster rail salary display", () => {
  it("renders the formatted costPaid for a signed player", () => {
    // costPaid: 9 → money(9) === "$9M"
    const { std } = pair((g) => {
      g.card = mkCard();
      g.slots[0] = mkSigned({ name: "Bret Boone", pos: "C", costPaid: 9 });
    });
    expect(std).toContain("Boone");
    expect(std).toContain(money(9)); // "$9M"
  });

  it("renders the decimal form when cost has a non-zero tenth", () => {
    // costPaid: 5.4 → money(5.4) === "$5.4M"
    const { std } = pair((g) => {
      g.card = mkCard();
      g.slots[0] = mkSigned({ name: "Freddy Garcia", pos: "SP", costPaid: 5.4 });
    });
    expect(std).toContain(money(5.4)); // "$5.4M"
  });

  it("renders salary in Eye Test mode too — it is a sunk cost, not a talent read", () => {
    const { sct } = pair((g) => {
      g.card = mkCard();
      g.slots[0] = mkSigned({ name: "Bret Boone", pos: "C", costPaid: 9 });
    });
    // WAR is hidden in Eye Test, but salary still appears — and with no chip
    // beside it the wrapper wears `lone`, which shows the salary at phone
    // width (it takes the chip's seat) and drops the -4px chip-inset pull so
    // bare text sits at the row's full padding.
    expect(sct).toContain("Boone");
    expect(sct).toMatch(/class="chips[^"]*\blone\b/);
    expect(sct).not.toContain("warchip"); // WAR chip is gated
    expect(sct).toContain(money(9));      // salary is not gated
  });

  it("renders the homegrown flat price for a hero slot, not the list price", () => {
    // hero: true with costPaid: 1 is the $1M homegrown floor (e.g. Ichiro on SEA card)
    const { std } = pair((g) => {
      g.card = mkCard();
      g.slots[0] = mkSigned({ name: "Ichiro Suzuki", pos: "RF", costPaid: 1, hero: true });
    });
    expect(std).toContain(money(1)); // "$1M" — the paid price, not the list price
  });

  it("wears the market's costTier read: green cheap, orange spendy", () => {
    // Same buckets as the market rows' price (costTier in lib/format.ts):
    // under $8M reads green, over $25M orange, in between plain ink.
    const { std } = pair((g) => {
      g.card = mkCard();
      g.slots[0] = mkSigned({ name: "Cheap Guy", pos: "RF", costPaid: 3 });
      g.slots[1] = mkSigned({ name: "Spendy Guy", pos: "LF", costPaid: 30 });
      g.slots[2] = mkSigned({ name: "Mid Guy", pos: "CF", costPaid: 15 });
    });
    expect(std).toContain("sal cheap");
    expect(std).toContain("sal spendy");
    expect(std).toContain("sal mid");
  });

  it("shows nothing for an empty slot — no salary element at all", () => {
    const { std } = pair((g) => {
      g.card = mkCard();
      // slots[0] remains null
    });
    // The .sal class should not appear when no slot is filled
    expect(std).not.toContain("sal");
  });
});

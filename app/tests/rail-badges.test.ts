/** The squad rail's per-seat hardware — the Finale badge read, mid-game.
 *
 * A signed seat carries its season's marks in the rail markup at desktop
 * width: 🏠 for a Homegrown signing, the sorted award pills, 💍-or-🚩 for
 * October, 🥇/🥈 for March. The CSS hides the lane on the phone (the seat's
 * tap opens the detail sheet instead), and jsdom has no layout engine, so —
 * as with rail-salary.test.ts — what is pinned here is presence and ORDER in
 * the rendered HTML, not visibility.
 *
 * The gate is game.showAwards: Eye Test keeps hardware in the envelope
 * everywhere but the Finale, and the rail is not the Finale. Salary's own
 * sunk-cost exemption does NOT extend here — a GG pill is a talent read.
 *
 * Substring notes: "qb <family>" is AwardPill's class pair; the WBC gold is
 * asserted with GG/AS awards only, because the MVP pill's own label leads
 * with 🥇 and would alias the medal. */
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import { forgeGame, mkCard, mkSigned } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";

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

function pair(mutate: (g: Game) => void): { std: string; sct: string } {
  const gs = forgeGame(CLASSIC, mutate);
  const gc = forgeGame(SCOUT, mutate);
  return {
    std: ssr(RosterRail, { game: gs }),
    sct: ssr(RosterRail, { game: gc }),
  };
}

/** A fully decorated season: Homegrown, two awards, a ring AND a WBC gold
 * (2017 Bregman is the precedent — October and March are independent). */
const decorated = (g: Game) => {
  g.card = mkCard();
  g.slots[0] = mkSigned({
    name: "Alex Bregman",
    pos: "C",
    costPaid: 1,
    hero: true,
    awards: ["AS", "GG"], // arrives unsorted: GG outranks AS on the row
    ws: true,
    wbc: 2,
  });
};

describe("roster rail badge display", () => {
  it("renders the full mark row for a decorated signing, in doctrine order", () => {
    const { std } = pair(decorated);
    const at = (s: string) => {
      const i = std.indexOf(s);
      expect(i, `expected rail markup to contain ${s}`).toBeGreaterThan(-1);
      return i;
    };
    // 🏠 leads, sorted pills follow (GG rank 7 before AS rank 9), October's
    // ring next, March's medal last — the Finale .qbadges read, restated.
    expect(at("🏠")).toBeLessThan(at("qb gg"));
    expect(at("qb gg")).toBeLessThan(at("qb as"));
    expect(at("qb as")).toBeLessThan(at("💍"));
    expect(at("💍")).toBeLessThan(at("🥇"));
  });

  it("a pennant shows 🚩 only when there is no ring — the ring absorbs it", () => {
    const { std } = pair((g) => {
      g.card = mkCard();
      g.slots[0] = mkSigned({ name: "Edgar Martinez", pos: "C", pen: true });
    });
    expect(std).toContain("🚩");
    expect(std).not.toContain("💍");
  });

  it("Eye Test keeps every mark in the envelope — no badge lane at all", () => {
    const { sct } = pair(decorated);
    expect(sct).not.toContain("badges");
    expect(sct).not.toContain("qb ");
    expect(sct).not.toContain("🏠");
    expect(sct).not.toContain("💍");
  });

  it("an undecorated signing draws no badge lane — no empty span reserved", () => {
    const { std } = pair((g) => {
      g.card = mkCard();
      g.slots[0] = mkSigned({ name: "Mark McLemore", pos: "C" });
    });
    expect(std).not.toContain("badges");
  });

  it("the manager's row wears MOY and October at width, gated like the rest", () => {
    const hire = (g: Game) => {
      g.card = mkCard();
      g.manager = {
        name: "Lou Piniella",
        wins: 116,
        losses: 46,
        year: 2001,
        team: "SEA",
        teamName: "Seattle Mariners",
        ws: false,
        pen: true,
        moty: true,
      };
    };
    const { std, sct } = pair(hire);
    expect(std).toContain("qb moy");
    expect(std).toContain("🚩");
    expect(std).toContain("Lou Piniella"); // the full-name cut is in the DOM
    // Eye Test: the skipper's hardware waits for the finale like everyone's.
    expect(sct).not.toContain("qb ");
    expect(sct).not.toContain("🚩");
  });

  it("SSR rests every signed seat as a div — the tap is a phone gesture", () => {
    // The unfold tap only exists on the phone (the rail's matchMedia gate),
    // and SSR has no window, so server markup — like the desktop screen —
    // offers no button on a filled seat. The pickable branch stays the one
    // button a seat can be. seat-expand.dom.test.ts owns the phone side.
    const { std } = pair((g) => {
      g.card = mkCard();
      g.slots[0] = mkSigned({ name: "Bret Boone", pos: "C" });
    });
    expect(std).toMatch(/<div[^>]*class="cell filled/);
    expect(std).not.toMatch(/<button[^>]*class="cell filled/);
  });
});

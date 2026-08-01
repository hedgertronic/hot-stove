/** The in-play roster rail is a who/when card: name, season, and — on the
 * phone, where the WAR numeral doesn't fit — a tier band per seat. Two
 * contracts are load-bearing here.
 *
 * 1. No hardware in the rail. Players never wear their award pills in a seat,
 *    so the manager doesn't wear MOY either; the pill is finale-only. The
 *    manager's `moty` flag is display-suppressed, not dropped — the finale
 *    still reads it off the same object.
 * 2. The tier band obeys the difficulty ladder. It encodes the WAR bucket, so
 *    it is gated on `showWar` exactly like the numeral: Eye Test must emit no
 *    tier token at all, or the color leaks the talent read the mode hides.
 *
 * Same SSR-string approach as parity.test.ts / moy-parity.test.ts. */
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import PlayerList from "../src/components/PlayerList.svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import { forgeGame, mkCard, mkPlayer, mkSigned } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";

// Engine save()/restore() guard storage access; give node a minimal stub.
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

/** The same forged state rendered under both difficulties. */
function pair(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>,
  mutate: (g: Game) => void,
  props: (g: Game) => Record<string, unknown>,
): { std: string; sct: string; gs: Game; gc: Game } {
  const gs = forgeGame(CLASSIC, mutate);
  const gc = forgeGame(SCOUT, mutate);
  return { std: ssr(component, props(gs)), sct: ssr(component, props(gc)), gs, gc };
}

const railProps = (g: Game) => ({ game: g });

/** A Manager of the Year skipper in the MGR seat. */
const hireMoty = (g: Game) => {
  g.card = mkCard({ managerMoty: true });
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

describe("roster rail hardware", () => {
  it("the MGR seat wears no MOY pill, MotY skipper or not, in either mode", () => {
    const { std, sct } = pair(RosterRail, hireMoty, railProps);
    for (const body of [std, sct]) {
      expect(body).toContain("Piniella"); // the seat itself still renders
      expect(body).not.toContain("MOY");
    }
  });

  it("suppressing the pill leaves the manager's moty flag on the game", () => {
    const { gs, gc } = pair(RosterRail, hireMoty, railProps);
    // The finale reads game.manager.moty for the trophy case — display-only
    // suppression must not have touched the data.
    for (const g of [gs, gc]) expect(g.manager?.moty).toBe(true);
  });
});

describe("roster rail WAR tier bands", () => {
  // Two distinct tiers, so a hardcoded single class can't satisfy the test:
  // 5.2 WAR is "high" (4–6), 2.1 is "mid" (2–4).
  const seatTiers = (g: Game) => {
    g.card = mkCard();
    g.slots[0] = mkSigned({ id: "boone", name: "Bret Boone", pos: "C", war: 5.2 });
    g.slots[1] = mkSigned({ id: "salty", name: "Jarrod Saltalamacchia", pos: "1B", war: 2.1 });
  };

  it("Box Score seats carry their tier band class", () => {
    const { std } = pair(RosterRail, seatTiers, railProps);
    expect(std).toContain("war-high");
    expect(std).toContain("war-mid");
  });

  it("Eye Test seats carry no tier token at all — color would leak WAR", () => {
    const { sct } = pair(RosterRail, seatTiers, railProps);
    expect(sct).toContain("Boone"); // the seats render; only the tier is gone
    expect(sct).toContain("Saltalamacchia");
    expect(sct).not.toContain("war-");
  });

  it("the WAR numeral follows the same gate as the band", () => {
    const { std, sct } = pair(RosterRail, seatTiers, railProps);
    expect(std).toContain("5.2");
    expect(sct).not.toContain("5.2");
  });
});

describe("Trade Deadline release hint", () => {
  it("the pending pill reads TAP WHO TO TRADE in both modes", () => {
    const { std, sct } = pair(
      PlayerList,
      (g) => {
        g.card = mkCard({
          players: [mkPlayer({ id: "bonds", name: "Barry Bonds", pos: "LF", war: 11.8, cost: 32 })],
        });
        g.powerups.tradeDeadline = "armed";
        g.releasePick = "bonds";
      },
      (g) => ({ game: g, confirmKey: null, setConfirm: () => {} }),
    );
    for (const body of [std, sct]) {
      expect(body).toContain("↑ TAP WHO TO TRADE");
      expect(body).not.toContain("TRADE AWAY");
    }
  });
});

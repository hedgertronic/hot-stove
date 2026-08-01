/** Box Score ↔ Eye Test parity for the Manager of the Year pill: MOY is an
 * award signal, so it follows award visibility — rendered in Box Score,
 * absent from Eye Test on every surface (Skipper hire row, MGR rail seat).
 * Same SSR-string approach as parity.test.ts; kept separate so the two
 * files stay independently editable. */
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import SpecialRows from "../src/components/SpecialRows.svelte";
import { forgeGame, mkCard } from "../src/lab/fixtures";
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

function pair(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>,
  mutate: (g: Game) => void,
  props: (g: Game) => Record<string, unknown>,
): { std: string; sct: string } {
  const gs = forgeGame(CLASSIC, mutate);
  const gc = forgeGame(SCOUT, mutate);
  return { std: ssr(component, props(gs)), sct: ssr(component, props(gc)) };
}

const listProps = (g: Game) => ({ game: g, confirmKey: null, setConfirm: () => {} });

describe("Manager of the Year pill parity", () => {
  it("Skipper hire row: MOY pill in Box Score only", () => {
    const { std, sct } = pair(
      SpecialRows,
      (g) => (g.card = mkCard({ managerMoty: true })),
      listProps,
    );
    expect(std).toContain("MOY");
    expect(sct).not.toContain("MOY");
    for (const body of [std, sct]) expect(body).toContain("Lou Piniella");
  });

  it("a non-MotY card renders no MOY pill in either mode", () => {
    const { std, sct } = pair(SpecialRows, (g) => (g.card = mkCard()), listProps);
    for (const body of [std, sct]) expect(body).not.toContain("MOY");
  });

  it("MGR rail seat: the hired manager's MOY pill in Box Score only", () => {
    const { std, sct } = pair(
      RosterRail,
      (g) => {
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
      },
      (g) => ({ game: g }),
    );
    expect(std).toContain("MOY");
    expect(sct).not.toContain("MOY");
    for (const body of [std, sct]) expect(body).toContain("Piniella");
  });

  it("a restored pre-MotY save (manager without the field) renders no pill", () => {
    const { std, sct } = pair(
      RosterRail,
      (g) => {
        g.card = mkCard();
        // Old ManagerPick shape: no moty key at all.
        g.manager = {
          name: "Lou Piniella",
          wins: 116,
          losses: 46,
          year: 2001,
          team: "SEA",
          teamName: "Seattle Mariners",
          ws: false,
          pen: true,
        };
      },
      (g) => ({ game: g }),
    );
    for (const body of [std, sct]) expect(body).not.toContain("MOY");
  });
});

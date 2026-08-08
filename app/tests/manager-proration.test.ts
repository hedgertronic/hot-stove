/** Manager win proration.
 *
 * Player WAR arrives on the cards pre-prorated for the short seasons (1994
 * ×1.417, 1995 ×1.124, 2020 ×2.706); the manager's W–L does not. The engine's
 * `managerNetWins` getter scales the hired skipper's net by his season's
 * factor from meta.proration, and every scoring read of the dugout — the
 * finale's score() calls, the badge facts, the roster rail's +W chip — goes
 * through it. Display keeps the raw record (43–17); only the win term scales.
 *
 * The dream solver applies the same factor from the card's own `prorated`
 * field (bestroster.ts), so the ceiling comparison stays consistent.
 */
import { describe, expect, it } from "vitest";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import { MANAGER_PER_NET_WIN, round1, score } from "../src/lib/scoring";
import type { GameIndex, Meta, Owners } from "../src/lib/types";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: SLOT_TYPES,
  minBudget: 18.2,
  avgSlot8: { "2020": 87497175 },
  salaryFloor: { "2020": 508500 },
  proration: { "1994": 1.417, "1995": 1.124, "2020": 2.706 },
};

const index: GameIndex = { yearMin: 1985, yearMax: 2025, cards: [] };
const owners: Owners = { franchises: {} };

function withManager(year: number, wins: number, losses: number): Game {
  const g = new Game(meta, index, owners, 42);
  g.manager = {
    name: "Dave Roberts",
    wins,
    losses,
    year,
    team: "LAD",
    teamName: "Los Angeles Dodgers",
    ws: true,
    pen: false,
  };
  return g;
}

describe("managerNetWins prorates short seasons", () => {
  it("2020 LAD (43–17) nets 26 × 2.706 = 70.356", () => {
    expect(withManager(2020, 43, 17).managerNetWins).toBeCloseTo(70.356, 10);
  });

  it("a full season passes through at factor 1", () => {
    expect(withManager(2019, 106, 56).managerNetWins).toBe(50);
  });

  it("no hire reads zero", () => {
    expect(new Game(meta, index, owners, 42).managerNetWins).toBe(0);
  });
});

describe("the scored value a 2020 manager carries", () => {
  it("2020 LAD is worth 14.1 wins in the ledger, not 5.2", () => {
    const net = withManager(2020, 43, 17).managerNetWins;
    // The engine feeds score() the prorated net as [net, 0] — the manager
    // term only ever reads the difference.
    const parts = score({
      totalWar: 0,
      spendM: 0,
      budgetM: 100,
      awardLists: [],
      managerRecord: [net, 0],
    });
    expect(parts.managerWins).toBe(round1(net * MANAGER_PER_NET_WIN)); // 14.1
    expect(parts.managerWins).toBe(14.1);
    // Unprorated the same record was worth 26 × 0.2 = 5.2.
    expect(parts.managerWins).not.toBe(5.2);
  });
});

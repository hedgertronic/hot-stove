/** Two reveal-side contracts, both rendered SSR.
 *
 * SSR (render() from svelte/server) rather than a jsdom mount: neither Home
 * nor Finale fetches anything, and their markup is a pure function of props.
 * Mounting Finale for real would additionally start its reveal timers,
 * requestAnimationFrame count-ups, and the canvas-confetti dynamic import —
 * all animation, none of it the contract under test. Same idiom as
 * moy-parity.test.ts; the pickers' dom test mounts only because its rows load
 * inside a client $effect. The reveal's own choreography — record, then badges,
 * then passport — is the one contract here that CANNOT be read off a string, so
 * it lives mounted in finale-reveal.dom.test.ts.
 *
 * 1. BALL KNOWLEDGE is the home screen's player-facing label for the ladder,
 *    while the internal difficulty keys stay frozen (saves and data reference
 *    them) — so the label assertion is paired with a key assertion that can
 *    fail on a rename.
 * 2. Manager of the Year is hidden hardware, and the finale is where hidden
 *    hardware is revealed: the pill must show on the hired skipper's squad
 *    review row AND on the dream team's manager row, each driven by its own
 *    manager object. The ledger's trophy-case chip counts the HIRED skipper
 *    only, so the three surfaces are asserted separately — a whole-body
 *    toContain("MOY") would pass off the ledger chip alone and could never
 *    fail on a missing squad pill.
 */
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import Finale from "../src/components/Finale.svelte";
import Home from "../src/components/Home.svelte";
import { finaleUnder } from "../src/lab/fixtures";
import { DIFFICULTIES } from "../src/lib/modes";
import { MANAGER_MOTY_POINTS, score } from "../src/lib/scoring";
import type { Game, GameConfig } from "../src/lib/engine.svelte";

// Engine save()/restore() and the settings/history readers guard storage
// access; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ssr(component: Component<any>, props: Record<string, unknown>): string {
  return render(component, { props }).body;
}

describe("home screen ball-knowledge label", () => {
  it("names the ladder BALL KNOWLEDGE, not DIFFICULTY", () => {
    const body = ssr(Home, { config: CLASSIC, onplay: () => {} });
    expect(body).toContain("BALL KNOWLEDGE");
    expect(body).not.toContain("DIFFICULTY");
    // The rungs themselves are untouched — the separator is the only rename.
    expect(body).toContain("Box Score");
    expect(body).toContain("Eye Test");
  });

  it("leaves the internal difficulty keys frozen", () => {
    expect(Object.keys(DIFFICULTIES)).toEqual(["standard", "scout"]);
  });
});

/** The finale renders three MOY-bearing surfaces in fixed document order:
 * the ledger's trophy case, then YOUR SQUAD, then ⭐ THE DREAM TEAM. Split on
 * the psep labels so each surface is asserted on its own slice. */
function surfaces(game: Game): { ledger: string; squad: string; dream: string } {
  const body = ssr(Finale, { game, onreplay: () => {}, onmodes: () => {} });
  const sq = body.indexOf("YOUR SQUAD");
  const dr = body.indexOf("⭐ THE DREAM TEAM");
  expect(sq).toBeGreaterThan(-1);
  expect(dr).toBeGreaterThan(sq);
  return { ledger: body.slice(0, sq), squad: body.slice(sq, dr), dream: body.slice(dr) };
}

describe("Manager of the Year at the finale", () => {
  it("a hired MotY skipper wears the pill on the squad review (and the ledger)", () => {
    const g = finaleUnder();
    g.manager!.moty = true;
    const { ledger, squad, dream } = surfaces(g);
    expect(squad).toContain("MOY");
    expect(ledger).toContain("MOY");
    // The trophy case counts the HIRED skipper; the dream manager is a
    // separate object and this fixture's did not win it.
    expect(dream).not.toContain("MOY");
  });

  it("a MotY dream-team manager wears the pill on the dream team only", () => {
    const g = finaleUnder();
    g.finale!.bestManager!.moty = true;
    const { ledger, squad, dream } = surfaces(g);
    expect(dream).toContain("MOY");
    expect(squad).not.toContain("MOY");
    expect(ledger).not.toContain("MOY");
  });

  it("no MotY anywhere renders no pill on any surface", () => {
    const { ledger, squad, dream } = surfaces(finaleUnder());
    for (const s of [ledger, squad, dream]) expect(s).not.toContain("MOY");
  });

  it("the +2 lands in the trophy case, not the win column", () => {
    // MotY is hardware, so it scores as hardware: the same inputs with and
    // without it differ by MANAGER_MOTY_POINTS in awardPoints alone, and the
    // ledger renders awardPoints on the Trophy case row while managerWins
    // stays inside Baseline wins.
    const inputs = {
      totalWar: 30,
      spendM: 90,
      budgetM: 96.7,
      awardLists: [["MVP"]],
      rings: 0,
      pennants: 0,
      managerRecord: [116, 46] as [number, number],
      scoutHits: 0,
    };
    const plain = score({ ...inputs, managerMoty: false });
    const hardware = score({ ...inputs, managerMoty: true });
    expect(hardware.awardPoints - plain.awardPoints).toBe(MANAGER_MOTY_POINTS);
    expect(MANAGER_MOTY_POINTS).toBe(2);
    expect(hardware.managerWins).toBe(plain.managerWins);
    expect(hardware.expectedWins).toBe(plain.expectedWins);
  });
});

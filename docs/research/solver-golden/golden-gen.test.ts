/** TEMP — the solver equivalence gate's generator. Delete with the refactor.
 *
 * Plays real bot games across every bank and records the EXACT (cards, opts)
 * pair the engine hands `solveBestRoster`, then the BestRoster today's solver
 * returns for it. `zz-golden-check.test.ts` replays those inputs against the
 * working tree and demands byte-identical output.
 *
 * The inputs are intercepted rather than reconstructed: a hand-built opts
 * object would drift from engine.svelte.ts the moment either side changed,
 * and a gate that tests a shape the engine no longer sends is worse than no
 * gate at all. */
import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { bestRoster } from "../src/lib/bestroster";
import type { BestClubOptions } from "../src/lib/bestroster";
import type { Card } from "../src/lib/types";
import { ALL_POWERUPS, loadData, playGame, type BotConfig } from "./bots/harness";

const captured: { cards: Card[]; opts: BestClubOptions }[] = [];

// Call through, but keep what went in. This is the whole reason the gate can
// claim it tests real inputs.
vi.mock("../src/lib/solve", async () => {
  const real = await vi.importActual<typeof import("../src/lib/bestroster")>(
    "../src/lib/bestroster",
  );
  return {
    solveBestRoster: (cards: Card[], opts: BestClubOptions) => {
      captured.push({ cards, opts });
      return Promise.resolve(real.bestRoster(cards, opts));
    },
  };
});

const DIR =
  "/private/tmp/claude-501/-Users-hedgertronic-Developer-personal-projects/" +
  "3218be39-5aac-4add-9fe6-5e83d5876e5f/scratchpad/golden";

describe("solver golden corpus", () => {
  it("records real engine inputs across every bank", { timeout: 900_000 }, async () => {
    const d = loadData();
    const powerups: BotConfig = {
      name: "powerups",
      enabled: new Set(ALL_POWERUPS),
      overspend: false,
    };
    // Banks are the gap the first corpus had: `fixedBudgetM` non-null takes a
    // different branch (no owner, no ballpark to solve for), and an overspending
    // bot pushes the payroll logic where the cap stops being free.
    const arms: { bank: "classic" | "moneyball" | "blankcheck"; bot: BotConfig }[] = [
      { bank: "classic", bot: powerups },
      { bank: "classic", bot: { name: "bare", enabled: new Set(), overspend: false } },
      { bank: "classic", bot: { ...powerups, name: "over", overspend: true } },
      { bank: "moneyball", bot: powerups },
      { bank: "blankcheck", bot: powerups },
    ];
    for (const arm of arms)
      for (let s = 0; s < 8; s++)
        await playGame(1000 + s, arm.bot, d, { difficulty: "standard", bank: arm.bank });

    // A thin pool — fewer cards than seats — is the branch where the solver
    // leaves seats open and `completeClub` has nothing to complete. Bot games
    // never produce one (a season cannot end with an open seat), so it is
    // taken from a real game's cards, cut short.
    const full = captured[0];
    for (const n of [3, 5, 7])
      captured.push({
        cards: full.cards.slice(0, n),
        opts: { ...full.opts, landings: full.opts.landings?.slice(0, n) ?? [],
          offReel: [], offReelLandings: [] },
      });

    expect(captured.length).toBeGreaterThanOrEqual(40);
    const cases = captured.map((c) => ({
      cards: c.cards,
      opts: c.opts,
      expected: bestRoster(c.cards, c.opts),
    }));
    fs.writeFileSync(`${DIR}/solver-golden.json`, JSON.stringify(cases));
  });
});

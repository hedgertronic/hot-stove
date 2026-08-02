/** STUDY 12 — the dream-club CEILING: the best finale total this game's cards
 * could have produced, printed next to the one the player actually got.
 *
 * The solver maximizes the finale's own score() — expected wins + payroll bonus
 * + awards + pedigree + scout points − luxury tax — over the cards the reel
 * showed, hiring the owner and buying the ballpark too (they set the payroll,
 * so the bonus is not separable from them). Measured here:
 *
 *  1. THE INVARIANT. `bestPossibleTotal >= parts.total`, every game, no
 *     tolerance. A ceiling under the player's own stamp reads as a bug on
 *     screen, so it is asserted rather than reported.
 *  2. The clamp rate — how often the search fails to beat the club the player
 *     built and the finale has to fall back on it. That is the honest measure
 *     of whether the search is strong enough for the feature to be interesting.
 *  3. Solve time. This runs at the finale, on a phone.
 *  4. Does it ever pay to cross the payroll? (Over-budget ceilings, by how much,
 *     and what they gain over the best club that stayed under.)
 *  5. ⭐ scout hits and the 🔮 CRYSTAL BALL rate (≥7), which move because the
 *     dream club itself moved.
 *
 * Run: BOT_STUDIES=1 npx vitest run tests/bots/study12-ceiling.test.ts
 * (BOT_GAMES=<n>, default 2000) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_POWERUPS, loadData, playGame, type BotConfig } from "./harness";
import { makeSeeds, mean } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);
const seeds = makeSeeds(N);

const pct = (n: number, of: number): string => `${((100 * n) / of).toFixed(2)}%`;
const pctl = (xs: number[], p: number): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const fmt = (x: number, d = 1): string => (Number.isNaN(x) ? "—" : x.toFixed(d));

describe("study 12: the dream-club ceiling", () => {
  it(`solves the ceiling for ${N} games per bot`, { timeout: 900_000 }, async () => {
    const d = loadData();
    const runs: { label: string; bot: BotConfig }[] = [
      { label: "baseline", bot: { name: "baseline", enabled: new Set(), overspend: false } },
      {
        label: "powerups",
        bot: { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
      },
    ];

    const L: string[] = [];
    L.push(`=== Study 12: dream-club ceiling, ${N} Classic games/bot ===`);
    for (const { label, bot } of runs) {
      const total: number[] = [];
      const ceiling: number[] = [];
      const gap: number[] = [];
      const ms: number[] = [];
      const clamped: number[] = [];
      const over: number[] = [];
      const overGain: number[] = [];
      const fill: number[] = [];
      let offReel = 0;
      let tightPool = 0;
      const hits: number[] = [];
      const seats: number[] = [];
      let violations = 0;
      for (const seed of seeds) {
        const r = await playGame(seed, bot, d);
        // 1. THE INVARIANT.
        if (r.ceiling === null || r.ceiling < r.total) violations += 1;
        total.push(r.total);
        ceiling.push(r.ceiling ?? 0);
        gap.push((r.ceiling ?? 0) - r.total);
        ms.push(r.solveMs);
        if ((r.solverTotal ?? -Infinity) < r.total) clamped.push(r.total - (r.solverTotal ?? 0));
        if (r.dreamBudget > 0) fill.push(r.dreamSpend / r.dreamBudget);
        if (r.dreamSpend > r.dreamBudget) {
          over.push(r.dreamSpend - r.dreamBudget);
          if (r.dreamUnderCap !== null) overGain.push((r.solverTotal ?? 0) - r.dreamUnderCap);
        }
        if (r.dreamUsesOffReel) offReel += 1;
        // The off-reel season is one loose item in the pool; it can only inflate
        // the ceiling when the spun cards alone cannot fill the club — 9 or
        // fewer distinct cards against 11 seats.
        if (r.seenCount <= 9) tightPool += 1;
        hits.push(r.scout);
        seats.push(r.dreamSeats);
      }
      expect(violations, "ceiling below the achieved total").toBe(0);

      L.push("");
      L.push(`--- ${label} ---`);
      L.push(
        `achieved  mean ${fmt(mean(total))}   ceiling mean ${fmt(mean(ceiling))}   ` +
          `gap mean ${fmt(mean(gap))} (median ${fmt(pctl(gap, 0.5))}, max ${fmt(Math.max(...gap))})`,
      );
      L.push(
        `ceiling ≥162  ${pct(ceiling.filter((c) => c >= 162).length, N)}   ` +
          `≥155 ${pct(ceiling.filter((c) => c >= 155).length, N)}   ` +
          `achieved ≥162 ${pct(total.filter((t) => t >= 162).length, N)}`,
      );
      L.push(
        `clamped to the club played  ${pct(clamped.length, N)}   ` +
          `(shortfall mean ${fmt(clamped.length ? mean(clamped) : NaN)}, ` +
          `max ${fmt(clamped.length ? Math.max(...clamped) : NaN)})`,
      );
      L.push(
        `solve ms  median ${fmt(pctl(ms, 0.5))}  p95 ${fmt(pctl(ms, 0.95))}  ` +
          `p99 ${fmt(pctl(ms, 0.99))}  max ${fmt(Math.max(...ms))}`,
      );
      L.push(
        `payroll   dream fill median ${fmt(100 * pctl(fill, 0.5))}%   ` +
          `over the cap ${pct(over.length, N)} ` +
          `(median $${fmt(pctl(over, 0.5))}M, max $${fmt(over.length ? Math.max(...over) : NaN)}M, ` +
          `worth ${fmt(overGain.length ? mean(overGain) : NaN, 2)} pts vs the best legal club)`,
      );
      L.push(
        `dream club seats the ⭐ Prime Time off-reel season  ${pct(offReel, N)}  ` +
          `(pool loose by one item; can only bind when ≤9 cards were spun: ${pct(tightPool, N)} of games)`,
      );
      L.push(
        `⭐ hits   mean ${fmt(mean(hits), 2)}   ≥7 (🔮 CRYSTAL BALL) ${pct(hits.filter((h) => h >= 7).length, N)}   ` +
          `≥5 ${pct(hits.filter((h) => h >= 5).length, N)}   dream seats mean ${fmt(mean(seats), 2)}`,
      );
    }
    const out = L.join("\n");
    console.log(`\n${out}\n`);
    fs.writeFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "last-run-study12.txt"),
      `${out}\n`,
    );
  });
});

/** STUDY 21 — 💵 SPENT EVERY DIME under its raw-dollar rule.
 *
 * The badge once read ScoreParts.budgetBonus ≥ 9.9, but that figure reaches
 * the facts rounded to one decimal, so the gate really admitted spends from
 * 99.25% of the cap while the copy promised 99.5%. The trigger now compares
 * the raw dollars (spend ≥ 99.5% of cap, without going over), which is
 * strictly narrower — so the stated freq (4.98, measured under the old gate)
 * needs re-measuring. Both rates are counted here: the shipping trigger via
 * the finale's own badge list, and the rounded-gate rate for the before/after.
 *
 * Population: the reference arm every `BadgeDef.freq` quotes — From the
 * Ground Up (classic) with all powerups.
 *
 * Run: BOT_STUDIES=1 npx vitest run tests/bots/study21-dime.test.ts
 * (BOT_GAMES=<n>, default 2000) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_POWERUPS, loadData, playGame, type BotConfig } from "./harness";
import { makeSeeds } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);
const seeds = makeSeeds(N);

const pct = (n: number, of: number): string => `${((100 * n) / of).toFixed(2)}%`;

describe("study 21: 💵 on the raw dollars", () => {
  it.runIf(process.env.BOT_STUDIES === "1")(
    `measures the strict and rounded gates over ${N} reference games`,
    { timeout: 3_600_000 },
    async () => {
      const d = loadData();
      const bot: BotConfig = { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false };

      let games = 0;
      let dime = 0; // the shipping trigger, off the finale's own badge list
      let roundedGate = 0; // the old gate: spend in [99.25%, 100%] of cap

      for (const seed of seeds) {
        await playGame(seed, bot, d, undefined, (g) => {
          games++;
          if (g.finale?.badges.includes("dime")) dime++;
          const f = g.finale!;
          if (f.spend <= f.budget && f.spend >= f.budget * 0.9925) roundedGate++;
        });
      }

      const lines = [
        `study 21 over ${games} reference games`,
        `dime (raw ≥ 99.5%): ${dime} = ${pct(dime, games)}`,
        `old rounded gate (≥ 99.25%): ${roundedGate} = ${pct(roundedGate, games)}`,
      ];
      fs.writeFileSync(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "last-run-study21.txt"),
        lines.join("\n") + "\n",
      );
      expect(games).toBe(N);
    },
  );
});

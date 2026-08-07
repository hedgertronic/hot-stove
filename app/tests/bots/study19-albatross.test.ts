/** STUDY 19 — rungs for two roster anti-trophies before they exist:
 *
 *  1. THE ALBATROSS — the club's priciest seat is not one of its best. The
 *     candidate rungs are "not in the top k by WAR" for every k, so the badge
 *     can be pinned at whichever k lands in the anti-trophy band (rare enough
 *     to sting, common enough to be seen). The priciest seat is a STRICT
 *     maximum on costPaid, the 🚒/🧤 rule: 20.5% of player-seasons cost
 *     exactly $1.0M, and a >= reading would hand a club of eight minimum men
 *     the badge for free. WAR rank is 1 + (seats strictly richer in WAR), so
 *     a WAR tie favors the player — the badge fails toward not firing.
 *
 *  2. BELOW REPLACEMENT — a rostered seat with negative WAR. Reported as
 *     P(>=1 seat) and P(>=2 seats), plus the worst seat's WAR distribution,
 *     so the rung can be one man or a pattern.
 *
 * Population: the reference arm every `BadgeDef.freq` quotes — From the
 * Ground Up (classic) with all powerups. Full eight-seat clubs only; the
 * bots finish essentially every game, and a partial club has no "priciest of
 * eight" to rank.
 *
 * Run: BOT_STUDIES=1 npx vitest run tests/bots/study19-albatross.test.ts
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

describe("study 19: albatross and below-replacement rungs", () => {
  it.runIf(process.env.BOT_STUDIES === "1")(
    `measures both candidate badges over ${N} reference games`,
    { timeout: 3_600_000 },
    async () => {
      const d = loadData();
      const bot: BotConfig = { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false };

      let full = 0;
      let pricyTied = 0;
      // rankCount[r] = clubs whose strict-priciest seat holds WAR rank r (1-8).
      const rankCount = new Array<number>(9).fill(0);
      // negCount[n] = clubs with exactly n seats under 0 WAR.
      const negCount = new Array<number>(9).fill(0);
      const worstWars: number[] = [];
      const priciestWars: number[] = [];

      for (const seed of seeds) {
        await playGame(seed, bot, d, undefined, (g) => {
          const seats = g.slots.filter((s) => s !== null);
          if (seats.length !== 8) return;
          full++;
          negCount[seats.filter((s) => s.war < 0).length]++;
          worstWars.push(Math.min(...seats.map((s) => s.war)));
          const maxCost = Math.max(...seats.map((s) => s.costPaid));
          const atMax = seats.filter((s) => s.costPaid === maxCost);
          if (atMax.length > 1) {
            pricyTied++;
            return;
          }
          const pricy = atMax[0];
          const rank = 1 + seats.filter((s) => s.war > pricy.war).length;
          rankCount[rank]++;
          priciestWars.push(pricy.war);
        });
      }

      const lines: string[] = [];
      lines.push(`=== Study 19: albatross + below-replacement, ${N} reference games ===\n`);
      lines.push(`full clubs ${full}   priciest-seat cost tie (excluded) ${pct(pricyTied, full)}`);
      lines.push(`\n--- albatross: WAR rank of the strict-priciest seat ---`);
      for (let r = 1; r <= 8; r++) lines.push(`  rank ${r}: ${pct(rankCount[r], full)}`);
      for (let k = 1; k <= 7; k++) {
        const beyond = rankCount.slice(k + 1).reduce((a, b) => a + b, 0);
        lines.push(`  not in top ${k}: ${pct(beyond, full)}`);
      }
      const pw = priciestWars.slice().sort((a, b) => a - b);
      lines.push(
        `  priciest seat WAR: p10 ${pw[Math.floor(pw.length * 0.1)]?.toFixed(1)}, ` +
          `median ${pw[Math.floor(pw.length * 0.5)]?.toFixed(1)}`,
      );
      lines.push(`\n--- below replacement: seats under 0 WAR ---`);
      for (let n = 0; n <= 3; n++) lines.push(`  exactly ${n}: ${pct(negCount[n], full)}`);
      const atLeast = (n: number): number => negCount.slice(n).reduce((a, b) => a + b, 0);
      lines.push(`  at least 1: ${pct(atLeast(1), full)}   at least 2: ${pct(atLeast(2), full)}`);
      const ww = worstWars.slice().sort((a, b) => a - b);
      lines.push(
        `  worst seat WAR: p1 ${ww[Math.floor(ww.length * 0.01)]?.toFixed(1)}, ` +
          `p5 ${ww[Math.floor(ww.length * 0.05)]?.toFixed(1)}, ` +
          `p10 ${ww[Math.floor(ww.length * 0.1)]?.toFixed(1)}, ` +
          `median ${ww[Math.floor(ww.length * 0.5)]?.toFixed(1)}`,
      );

      const report = lines.join("\n");
      console.log(report);
      fs.writeFileSync(
        path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study19.txt"),
        report + "\n",
      );

      expect(full).toBeGreaterThan(0);
    },
  );
});

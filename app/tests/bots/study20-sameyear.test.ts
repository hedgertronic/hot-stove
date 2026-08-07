/** STUDY 20 — two measurements the round-twelve changes need:
 *
 *  1. SAME-SEASON CLUB — how many rostered seats share one YEAR, so the new
 *     era badge's rung can be pinned where the count lands in a collectible
 *     band (the way 🗓️ ALL-DECADE TEAM's five-of-a-decade was). Reported as
 *     the full distribution of the max same-year count, plus the same-TEAM-
 *     season count (the stricter reading, for comparison).
 *
 *  2. 🧠 BEAT THE DREAM TEAM under its new rule — baseline wins (expected
 *     wins from WAR + skipper) against the dream club's, not totals — read
 *     straight off the finale's own badge resolution, so the measured rate
 *     is the shipping trigger and not a reimplementation.
 *
 * Population: the reference arm every `BadgeDef.freq` quotes — From the
 * Ground Up (classic) with all powerups.
 *
 * Run: BOT_STUDIES=1 npx vitest run tests/bots/study20-sameyear.test.ts
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

describe("study 20: same-season club rung and the rebuilt 🧠", () => {
  it.runIf(process.env.BOT_STUDIES === "1")(
    `measures both over ${N} reference games`,
    { timeout: 3_600_000 },
    async () => {
      const d = loadData();
      const bot: BotConfig = { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false };

      let games = 0;
      let beatDream = 0;
      // maxYear[k] = games whose largest same-year cohort is exactly k seats.
      const maxYear = new Array<number>(9).fill(0);
      const maxTeamYear = new Array<number>(9).fill(0);

      for (const seed of seeds) {
        await playGame(seed, bot, d, undefined, (g) => {
          games++;
          if (g.finale?.badges.includes("beatdream")) beatDream++;
          const seats = g.slots.filter((s) => s !== null);
          const by = (key: (s: (typeof seats)[number]) => string): number => {
            const c = new Map<string, number>();
            for (const s of seats) c.set(key(s), (c.get(key(s)) ?? 0) + 1);
            return Math.max(0, ...c.values());
          };
          maxYear[by((s) => String(s.year))]++;
          maxTeamYear[by((s) => `${s.team}|${s.year}`)]++;
        });
      }

      const lines: string[] = [
        `study 20 over ${games} reference games (classic + all powerups)`,
        "",
        "max seats sharing one YEAR (cumulative ≥k is the candidate rung):",
      ];
      for (let k = 2; k <= 8; k++) {
        const exact = maxYear[k];
        const atLeast = maxYear.slice(k).reduce((a, b) => a + b, 0);
        lines.push(
          `  =${k}: ${String(exact).padStart(4)}  (≥${k}: ${pct(atLeast, games)})`,
        );
      }
      lines.push("", "max seats sharing one TEAM-SEASON:");
      for (let k = 2; k <= 8; k++) {
        const atLeast = maxTeamYear.slice(k).reduce((a, b) => a + b, 0);
        lines.push(`  ≥${k}: ${pct(atLeast, games)}`);
      }
      lines.push("", `🧠 beatdream (baseline-wins rule): ${pct(beatDream, games)}`);

      const out = lines.join("\n");
      console.log(out);
      fs.writeFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), "last-run-study20.txt"),
        out + "\n",
      );
      expect(games).toBeGreaterThan(0);
    },
  );
});

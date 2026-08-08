/** STUDY 23 — is there a Double Play bar that works for 162–0 chasing?
 *
 * Study 22 found Double Play tail-NEGATIVE at the shipped +3.0 bar: the kit
 * without it perfected more seeds than the full kit (36 vs 26 at 5,000
 * games). But +3.0 was tuned for MEAN score, and the tail's economics
 * differ — a double commit spends a whole card view, and on a perfect path
 * every card view is a lottery ticket. This study sweeps the bar upward to
 * ask whether a stricter Double Play (fire only on genuine twin-jackpot
 * cards) recovers a tail-positive powerup, or whether the exposure cost
 * dominates at every bar and 162–0 chasers should shelve it entirely.
 *
 * Every bot runs the FULL kit on the same paired seeds; only `dpMin` moves.
 * no-doublePlay is the ablation control from Study 22.
 *
 * Run:      BOT_STUDIES=1 npx vitest run tests/bots/study23-dp-bar.test.ts
 * Tunables: BOT_GAMES=<n> (default 5000). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALL_POWERUPS,
  loadData,
  playGame,
  type BotConfig,
  type GameResult,
} from "./harness";

const N = Number(process.env.BOT_GAMES ?? 5000);
/** Study 18's line: the smallest total the finale stamps as 162–0. */
const PERFECT = 161.5;

const seeds = Array.from({ length: N }, (_, i) => (987654321 + i * 2654435761) >>> 0);

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const f1 = (x: number): string => x.toFixed(1);
const pm = (k: number, n: number): string => `${k} (${((100 * k) / n).toFixed(2)}%)`;

describe("study 23: Double Play bar sweep on the perfect-season rate", () => {
  it.runIf(process.env.BOT_STUDIES === "1")(
    `plays ${N} seeded games per bot through the real engine`,
    { timeout: 7_200_000 },
    async () => {
      const d = loadData();
      const full = (name: string, dpMin?: number): BotConfig => ({
        name,
        enabled: new Set(ALL_POWERUPS),
        overspend: false,
        ...(dpMin === undefined ? {} : { dpMin }),
      });
      const bots: BotConfig[] = [
        full("dp3.0-shipped"),
        full("dp4.5", 4.5),
        full("dp6.0", 6.0),
        full("dp8.0", 8.0),
        {
          name: "no-doublePlay",
          enabled: new Set(ALL_POWERUPS.filter((x) => x !== "doublePlay")),
          overspend: false,
        },
      ];

      const results = new Map<string, GameResult[]>();
      for (const bot of bots) {
        const rs: GameResult[] = [];
        for (const seed of seeds) rs.push(await playGame(seed, bot, d));
        results.set(bot.name, rs);
      }

      const perfects = (rs: GameResult[]): number =>
        rs.filter((r) => r.total >= PERFECT).length;

      const lines: string[] = [];
      lines.push(`\n=== Study 23: Double Play bar sweep (>=${PERFECT}), ${N} games/bot ===`);
      lines.push(`${"bot".padEnd(18)} ${"perfects".padStart(14)} ${"mean".padStart(6)} ${"max".padStart(8)}`);
      for (const bot of bots) {
        const rs = results.get(bot.name)!;
        lines.push(
          `${bot.name.padEnd(18)} ${pm(perfects(rs), N).padStart(14)} ` +
            `${f1(mean(rs.map((r) => r.total))).padStart(6)} ${f1(Math.max(...rs.map((r) => r.total))).padStart(8)}`,
        );
      }

      const ref = results.get("no-doublePlay")!;
      lines.push("\npaired flips vs no-doublePlay (same seeds):");
      lines.push("  lost = no-DP perfected the seed, the DP bot did not; found = the reverse");
      for (const bot of bots) {
        if (bot.name === "no-doublePlay") continue;
        const rs = results.get(bot.name)!;
        let lost = 0;
        let found = 0;
        for (let i = 0; i < N; i++) {
          const a = ref[i].total >= PERFECT;
          const b = rs[i].total >= PERFECT;
          if (a && !b) lost++;
          if (!a && b) found++;
        }
        lines.push(
          `  ${bot.name.padEnd(16)} lost ${String(lost).padStart(3)}  found ${String(found).padStart(3)}  net ${String(found - lost).padStart(4)}`,
        );
      }

      const report = lines.join("\n");
      console.log(report);
      fs.writeFileSync(
        path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study23.txt"),
        report + "\n",
      );

      for (const bot of bots) expect(results.get(bot.name)!).toHaveLength(N);
      // Vacuity guard, same shape as Study 22: a full-size run must see the
      // tail at all; a smoke run at small BOT_GAMES is allowed to see none.
      if (N >= 2000) expect(perfects(ref)).toBeGreaterThan(0);
    },
  );
});

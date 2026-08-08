/** STUDY 22 — which powerups drive the 162–0 tail?
 *
 * The main powerup study (last-run.txt) ranks powerups on MEAN score, a lens
 * that undervalues anything whose payoff concentrates in rare boards
 * (Homegrown's dream-team surplus, Double Play's twin-elite cards). This
 * study re-runs the same paired-seed ablations and judges them on the
 * perfect-season rate instead: total ≥ 161.5, the lowest number the stamp
 * prints as 162–0 (study 18's criterion).
 *
 * Perfects are ~1% events, so the study needs volume: at the default 5,000
 * games/bot the full kit stamps ~30–50 perfects and an ablation's deficit is
 * directional rather than exact. The paired flip counts are the sharper
 * read: a seed the full kit perfects but the ablation does not is one game
 * where that powerup was on the perfect path.
 *
 * Run:      BOT_STUDIES=1 npx vitest run tests/bots/study22-perfection-powerups.test.ts
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
const pm = (k: number, n: number): string =>
  `${k} (${((100 * k) / n).toFixed(2)}%)`;

describe("study 22: powerup ablations on the perfect-season rate", () => {
  it.runIf(process.env.BOT_STUDIES === "1")(
    `plays ${N} seeded games per bot through the real engine`,
    { timeout: 7_200_000 },
    async () => {
      const d = loadData();
      const bots: BotConfig[] = [
        { name: "baseline", enabled: new Set(), overspend: false },
        { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
        ...ALL_POWERUPS.map((k) => ({
          name: `no-${k}`,
          enabled: new Set(ALL_POWERUPS.filter((x) => x !== k)),
          overspend: false,
        })),
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
      lines.push(`\n=== Study 22: perfect-season (>=${PERFECT}) ablations, ${N} games/bot ===`);
      lines.push(`${"bot".padEnd(18)} ${"perfects".padStart(14)} ${"mean".padStart(6)} ${"p99-ish max".padStart(12)}`);
      for (const bot of bots) {
        const rs = results.get(bot.name)!;
        lines.push(
          `${bot.name.padEnd(18)} ${pm(perfects(rs), N).padStart(14)} ` +
            `${f1(mean(rs.map((r) => r.total))).padStart(6)} ${f1(Math.max(...rs.map((r) => r.total))).padStart(12)}`,
        );
      }

      const pw = results.get("powerups")!;
      lines.push("\npaired flips vs the full kit (same seeds):");
      lines.push("  lost = full kit perfected the seed, ablation did not; found = the reverse");
      for (const k of ALL_POWERUPS) {
        const abl = results.get(`no-${k}`)!;
        let lost = 0;
        let found = 0;
        for (let i = 0; i < N; i++) {
          const a = pw[i].total >= PERFECT;
          const b = abl[i].total >= PERFECT;
          if (a && !b) lost++;
          if (!a && b) found++;
        }
        lines.push(`  without ${k.padEnd(14)} lost ${String(lost).padStart(3)}  found ${String(found).padStart(3)}  net ${String(lost - found).padStart(4)}`);
      }

      const report = lines.join("\n");
      console.log(report);
      fs.writeFileSync(
        path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study22.txt"),
        report + "\n",
      );

      for (const bot of bots) expect(results.get(bot.name)!).toHaveLength(N);
      // The study is vacuous if the full kit never stamps a perfect at all.
      // Perfects run ~1%, so only a full-size run owes the guarantee — a
      // smoke run at a small BOT_GAMES is allowed to see none.
      if (N >= 2000) expect(perfects(pw)).toBeGreaterThan(0);
    },
  );
});

/** STUDY 1 — Moneyball mode (fixed $51.5M cap, no owner/stadium spins).
 * Hypothesis under test: 🏠 Homegrown's marginal value is much higher when
 * the cap is genuinely tight (it measured ~0 in Classic, where the bots
 * bank-shop their way to ~$161M average bankrolls).
 *
 * Run: npx vitest run tests/bots/study1-moneyball.test.ts  (BOT_GAMES=<n>) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GameConfig } from "../../src/lib/engine.svelte";
import {
  ALL_POWERUPS,
  loadData,
  playGame,
  type BotConfig,
  type GameResult,
} from "./harness";
import { f1, makeSeeds, mean, pct, TABLE_HEADER, tableRow } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 400);
const seeds = makeSeeds(N);
const MONEYBALL: GameConfig = { difficulty: "standard", bank: "moneyball" };

describe("study 1: moneyball mode", () => {
  it(`plays ${N} paired games per bot at the fixed $51.5M cap`, { timeout: 600_000 }, async () => {
    const d = loadData();
    const bots: BotConfig[] = [
      { name: "baseline", enabled: new Set(), overspend: false },
      { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
      {
        name: "no-hometown",
        enabled: new Set(ALL_POWERUPS.filter((k) => k !== "hometown")),
        overspend: false,
      },
    ];
    const results = new Map<string, GameResult[]>();
    for (const bot of bots) {
      const rs: GameResult[] = [];
      for (const seed of seeds) rs.push(await playGame(seed, bot, d, MONEYBALL));
      results.set(bot.name, rs);
    }

    const base = results.get("baseline")!;
    const pw = results.get("powerups")!;
    const noHg = results.get("no-hometown")!;
    const deltas = pw.map((r, i) => r.total - base[i].total);
    const hgWorth = mean(pw.map((r) => r.total)) - mean(noHg.map((r) => r.total));

    const lines: string[] = [];
    lines.push(`\n=== Study 1: Moneyball bank ($51.5M fixed), ${N} games/bot ===`);
    lines.push(TABLE_HEADER);
    for (const bot of bots) lines.push(tableRow(bot.name, results.get(bot.name)!));
    lines.push(
      `\npaired powerups vs baseline: mean ${f1(mean(deltas))} pts, ` +
        `improved ${pct(mean(deltas.map((x) => (x > 0 ? 1 : 0))))}`,
    );
    lines.push(
      `Homegrown: used in ${pct(mean(pw.map((r) => (r.spent.hometown ? 1 : 0))))} of powerups-bot games; ` +
        `ablation value ${f1(hgWorth)} pts (Classic measured +0.1)`,
    );
    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study1.txt"),
      report + "\n",
    );

    for (const bot of bots) {
      const rs = results.get(bot.name)!;
      expect(rs).toHaveLength(N);
      for (const r of rs) {
        expect(Number.isFinite(r.total)).toBe(true);
        expect(r.budget).toBeCloseTo(51.5, 5); // fixed-cap bank really applied
        expect(r.spins).toBeGreaterThanOrEqual(8); // 8 seats + manager, −1 for DP
      }
    }
    for (const r of base) expect(Object.values(r.spent).every((x) => !x)).toBe(true);
  });
});

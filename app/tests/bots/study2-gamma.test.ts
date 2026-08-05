/** STUDY 2 — Bankroll spread: γ=1.25 (shipped) vs γ=1.0 (no widening).
 * Question: does the power-curve widening amplify bank-shopping — the
 * powerup bot rerolling its way into rich owners?
 *
 * SKIPPED: the γ arm rescaled budgets harness-side from each card's raw
 * top-4 contract sum, a field the shipped cards no longer carry (trimmed
 * from the payload — the app never reads it). The study's answer stands in
 * last-run-study2.txt; γ=1.25 shipped. Re-running would need a data build
 * that re-emits the raw sums for the harness to consume. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALL_POWERUPS,
  applyBudgets,
  loadData,
  playGame,
  type BotConfig,
  type GameResult,
} from "./harness";
import { f1, f2, makeSeeds, mean, pct, TABLE_HEADER, tableRow } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 400);
const seeds = makeSeeds(N);

describe.skip("study 2: bankroll gamma", () => {
  it(`plays ${N} paired games per bot per γ`, { timeout: 600_000 }, async () => {
    const d = loadData();

    // The recomputed γ=1.25 curve must reproduce the shipped budgets (JS vs
    // Python rounding can differ by one 0.1 step at exact midpoints).
    applyBudgets(d, 1.25);
    let worst = 0;
    for (const [key, card] of d.cards)
      worst = Math.max(worst, Math.abs(card.budget - d.shippedBudgets.get(key)!));
    expect(worst).toBeLessThanOrEqual(0.1);
    applyBudgets(d, null); // shipped numbers for the γ=1.25 arm

    const bots: BotConfig[] = [
      { name: "baseline", enabled: new Set(), overspend: false },
      { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
    ];
    const arms: { label: string; gamma: number | null }[] = [
      { label: "γ=1.25", gamma: null }, // shipped budgets
      { label: "γ=1.00", gamma: 1.0 },
    ];

    const results = new Map<string, GameResult[]>(); // `${arm}|${bot}`
    for (const arm of arms) {
      applyBudgets(d, arm.gamma);
      for (const bot of bots) {
        const rs: GameResult[] = [];
        for (const seed of seeds) rs.push(await playGame(seed, bot, d));
        results.set(`${arm.label}|${bot.name}`, rs);
      }
    }
    applyBudgets(d, null); // leave the shared dataset as shipped

    const lines: string[] = [];
    lines.push(`\n=== Study 2: bankroll γ=1.25 (shipped) vs γ=1.00, ${N} games/bot, Classic ===`);
    lines.push(TABLE_HEADER);
    for (const arm of arms)
      for (const bot of bots)
        lines.push(tableRow(`${arm.label} ${bot.name}`, results.get(`${arm.label}|${bot.name}`)!));

    lines.push("\nbank-shopping (powerups bot):");
    for (const arm of arms) {
      const pw = results.get(`${arm.label}|powerups`)!;
      const rerolls = pw.reduce((a, r) => a + r.rerolls, 0);
      const richer = pw.reduce((a, r) => a + r.rerollsRicher, 0);
      lines.push(
        `  ${arm.label}: mean final bank $${f1(mean(pw.map((r) => r.budget)))}M, ` +
          `rerolls/game ${f2(rerolls / N)}, into-richer-bank ${pct(richer / Math.max(1, rerolls))} of rerolls`,
      );
    }
    for (const arm of arms) {
      const base = results.get(`${arm.label}|baseline`)!;
      const pw = results.get(`${arm.label}|powerups`)!;
      const deltas = pw.map((r, i) => r.total - base[i].total);
      lines.push(
        `paired powerup lift at ${arm.label}: mean ${f1(mean(deltas))} pts, ` +
          `improved ${pct(mean(deltas.map((x) => (x > 0 ? 1 : 0))))}`,
      );
    }
    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study2.txt"),
      report + "\n",
    );

    for (const key of results.keys()) {
      const rs = results.get(key)!;
      expect(rs).toHaveLength(N);
      for (const r of rs) expect(Number.isFinite(r.total)).toBe(true);
    }
    // Baselines never reroll; instrumentation only counts real powerup fires.
    for (const arm of arms)
      for (const r of results.get(`${arm.label}|baseline`)!) expect(r.rerolls).toBe(0);
  });
});

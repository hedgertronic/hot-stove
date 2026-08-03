/** STUDY 16 — does the era a club is drafted from move its SCORE?
 *
 * The question behind it. Measured off data/cards, the best bargains available
 * in 1985–89 return about 1.97 WAR per $M; in 2015–19 they return 4.81. That
 * is a 2.4x gap and it is real history rather than a data defect: before
 * arbitration pulled the middle of the market up, a star cost a large multiple
 * of the median and there was no long tail of minimum-salary seasons with real
 * WAR in it. Median salary is $8.1M in 1985 and $1.4M in 2025, in the same
 * normalized dollars.
 *
 * A ratio is not a balance problem, though. Total WAR per dollar across the
 * whole card is nearly flat (0.131 in 1985 to 0.155 in 2025), owner budgets are
 * normalized to their own era, and the payroll bonus caps at +10 no matter how
 * large the cap is — so the ratio gap has three places it could be absorbed
 * before it reaches a final total. This study asks the only question that
 * decides whether anything needs changing: do clubs whose rosters skew old
 * actually SCORE worse?
 *
 * It is a null-result study by design. If eras score flat, the ratio is a
 * curiosity and the era knowledge in the prices is worth keeping — and the
 * assertion below is the thing that would tell us if a future data regen or
 * economy change turned it into a real one.
 *
 * The bot cannot choose its era. The reel deals what it deals, so a club's mean
 * roster year is a property of the seeds rather than of the policy, and
 * comparing the top and bottom deciles of that mean is comparing games the
 * draft made old-skewed against games it made new-skewed.
 *
 * Run: BOT_STUDIES=1 BOT_GAMES=4000 npx vitest run tests/bots/study16-era.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Game } from "../../src/lib/engine.svelte";
import { loadData, playGame, type BotConfig } from "./harness";
import { makeSeeds } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 1500);

interface Row {
  /** Mean year across the filled seats — how old this club is. */
  meanYear: number;
  /** Seats whose season predates 1995 — the sharper cut. A MEAN of eight years
   * regresses hard toward the middle of the window (no reel deals eight 1980s
   * cards), so the decile bands below only span about 1999–2012. Counting old
   * seats reaches clubs the mean cannot separate. */
  oldSeats: number;
  total: number;
  war: number;
  spend: number;
  budget: number;
  bonus: number;
  seats: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("study 16: does era move the score", () => {
  it.runIf(process.env.BOT_STUDIES === "1")(
    "scores flat across the eras the reel deals",
    async () => {
      const d = loadData();
      // Vanilla: no powerups. Season Ticket and Relocate can both move a club
      // across years, and the question is about what the DRAFT deals rather
      // than about what a player can steer away from.
      const cfg: BotConfig = {
        name: "vanilla",
        enabled: new Set(),
        overspend: false,
      };
      const rows: Row[] = [];
      for (const seed of makeSeeds(N)) {
        let club: Game | null = null;
        const r = await playGame(seed, cfg, d, undefined, (g) => (club = g));
        const g = club as Game | null;
        if (!g) continue;
        const years = g.slots.filter((s) => s !== null).map((s) => s!.year);
        if (years.length === 0) continue;
        rows.push({
          meanYear: mean(years),
          oldSeats: years.filter((y) => y < 1995).length,
          total: r.total,
          war: r.war,
          spend: r.spend,
          budget: r.budget,
          bonus: r.bonus,
          seats: years.length,
        });
      }
      rows.sort((a, b) => a.meanYear - b.meanYear);

      const k = Math.floor(rows.length / 10);
      const oldest = rows.slice(0, k);
      const newest = rows.slice(-k);
      const gap = mean(newest.map((r) => r.total)) - mean(oldest.map((r) => r.total));

      const lines: string[] = [];
      lines.push(`=== Study 16: era vs score — ${rows.length} vanilla classic games ===`);
      lines.push("");
      lines.push("--- 1. Deciles of mean roster year ---");
      for (let i = 0; i < 10; i++) {
        const band = rows.slice(i * k, (i + 1) * k);
        if (band.length === 0) continue;
        lines.push(
          `  d${i + 1}  year ${mean(band.map((r) => r.meanYear)).toFixed(1)}` +
            `  total ${mean(band.map((r) => r.total)).toFixed(2)}` +
            `  WAR ${mean(band.map((r) => r.war)).toFixed(2)}` +
            `  spend ${mean(band.map((r) => r.spend)).toFixed(1)}` +
            `  cap ${mean(band.map((r) => r.budget)).toFixed(1)}` +
            `  bonus ${mean(band.map((r) => r.bonus)).toFixed(2)}` +
            `  seats ${mean(band.map((r) => r.seats)).toFixed(2)}`,
        );
      }
      lines.push("");
      lines.push("--- 2. By seats drafted before 1995 ---");
      // The cut the decile bands cannot make. A club with five or more
      // pre-1995 seats is genuinely an old club, and there are enough of them
      // to average even though no seed produces eight.
      for (let n = 0; n <= 8; n++) {
        const band = rows.filter((r) => r.oldSeats === n);
        if (band.length < 20) continue;
        lines.push(
          `  ${n} old seat${n === 1 ? " " : "s"}  n=${String(band.length).padStart(4)}` +
            `  total ${mean(band.map((r) => r.total)).toFixed(2)}` +
            `  WAR ${mean(band.map((r) => r.war)).toFixed(2)}` +
            `  bonus ${mean(band.map((r) => r.bonus)).toFixed(2)}`,
        );
      }
      lines.push("");
      lines.push("--- 3. Top decile minus bottom decile ---");
      lines.push(`  newest−oldest total: ${gap >= 0 ? "+" : ""}${gap.toFixed(2)} pts`);
      lines.push(
        `  newest−oldest WAR:   ${(mean(newest.map((r) => r.war)) - mean(oldest.map((r) => r.war))).toFixed(2)}`,
      );
      lines.push(
        `  newest−oldest bonus: ${(mean(newest.map((r) => r.bonus)) - mean(oldest.map((r) => r.bonus))).toFixed(2)}`,
      );
      const out = lines.join("\n");
      console.log(`\n${out}\n`);
      const dir = path.dirname(fileURLToPath(import.meta.url));
      fs.writeFileSync(path.join(dir, "last-run-study16.txt"), `${out}\n`);

      // The claim: era does not decide a season. Three points on a scale whose
      // spread across these deciles is tens of points is the band inside which
      // the 2.4x bargain-ratio gap is absorbed rather than expressed. If this
      // ever fails, the prices have stopped being era knowledge and started
      // being a handicap, and study 16's report says which term moved.
      expect(Math.abs(gap)).toBeLessThan(3);
    },
    600_000,
  );
});

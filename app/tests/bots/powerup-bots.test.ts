/** Powerup bot study — answers "do simulated bots that play WITH powerups do
 * better?" empirically, through the real engine.
 *
 * Bots (all share the same budget-aware greedy core; see harness.ts):
 *   baseline   — no powerups.
 *   powerups   — all six powerups under heuristic policies.
 *   overspend  — powerups + willingness to cross the cap when WAR > tax.
 * Optional ablations (BOT_ABLATIONS=1): powerups minus one, per powerup —
 * each powerup's marginal contribution in context.
 *
 * Run:      BOT_HARNESS=1 npx vitest run tests/bots/powerup-bots.test.ts
 *            (or `npm run test:full`). Without the flag, vite.config
 *            excludes this file and vitest exits green having run NOTHING
 *            — `npm test` is the fast suite and never plays the bots.
 * Tunables: BOT_GAMES=<n> (default 400), BOT_ABLATIONS=1 to add the six
 * ablation bots (research report only — no assertion reads them, the same
 * opt-in rule the study*.test.ts files live under; without them the run is
 * 1,200 games instead of 3,600, which is what keeps `npm run test:full`
 * affordable now that every finale prices the dream solver's wider
 * shortlists).
 * Games are seeded; the same seed list is shared across bots for pairing
 * (the engine's RNG walk advances only inside spin(), so paired games see
 * the same card sequence until their spin counts diverge). */
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

const N = Number(process.env.BOT_GAMES ?? 400);
const ABLATIONS = process.env.BOT_ABLATIONS === "1";
const GOAL = 162;

const seeds = Array.from({ length: N }, (_, i) => (123456789 + i * 2654435761) >>> 0);

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const pctl = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const f1 = (x: number): string => x.toFixed(1);
const pct = (x: number): string => `${(100 * x).toFixed(0)}%`;

function summarize(name: string, rs: GameResult[]): string {
  const t = rs.map((r) => r.total);
  return [
    name.padEnd(18),
    f1(mean(t)).padStart(6),
    f1(pctl(t, 0.5)).padStart(6),
    f1(pctl(t, 0.9)).padStart(6),
    f1(Math.max(...t)).padStart(6),
    f1(mean(rs.map((r) => r.war))).padStart(6),
    `${f1(mean(rs.map((r) => r.spend)))}/${f1(mean(rs.map((r) => r.budget)))}`.padStart(12),
    pct(mean(rs.map((r) => (r.tax > 0 ? 1 : 0)))).padStart(5),
    f1(mean(rs.map((r) => r.bonus))).padStart(6),
    f1(mean(rs.map((r) => r.tax))).padStart(5),
    f1(mean(rs.map((r) => r.spins))).padStart(6),
    pct(mean(rs.map((r) => (r.total >= GOAL ? 1 : 0)))).padStart(6),
  ].join(" ");
}

describe("powerup bot study", () => {
  it(
    `plays ${N} seeded games per bot through the real engine`,
    // 3 bots × 400 finales runs the dream solver 1,200 times ≈ 800s measured
    // on an M-series laptop, suite otherwise idle (2026-08-13, with landing
    // grouping, the ⭐ split enumeration, and bestroster's probe cache all
    // in); BOT_ABLATIONS=1 triples the games. The margin is for CI's slower
    // runners, for this file sharing cores with the rest of the suite, and
    // for opt-in ablation runs.
    //
    // A game that rerolled or primed costs more than one solve: bestroster
    // enumerates one pool per retained card per landing, plus three variants
    // for a ⭐ split landing, and the powerup bots play 🎟️, 🚚 AND ⭐ most
    // games. Measured at 20 games/bot pre-⭐, that was 2.8× the solves for
    // 1.79× the wall clock — a pool with one card per landing is a card or
    // two smaller than the raw pool and solves cheaper, and a split pool
    // skips the doubling pass or drops a card.
    { timeout: 1_800_000 },
    async () => {
      const d = loadData();
      const bots: BotConfig[] = [
        { name: "baseline", enabled: new Set(), overspend: false },
        { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
        { name: "overspend", enabled: new Set(ALL_POWERUPS), overspend: true },
        ...(ABLATIONS
          ? ALL_POWERUPS.map((k) => ({
              name: `no-${k}`,
              enabled: new Set(ALL_POWERUPS.filter((x) => x !== k)),
              overspend: false }))
          : []),
      ];

      const results = new Map<string, GameResult[]>();
      for (const bot of bots) {
        const rs: GameResult[] = [];
        for (const seed of seeds) rs.push(await playGame(seed, bot, d));
        results.set(bot.name, rs);
      }

      // ---- report ----
      const lines: string[] = [];
      lines.push(`\n=== Powerup bot study: ${N} games/bot, classic bank, standard ===`);
      lines.push(
        [
          "bot".padEnd(18),
          "mean".padStart(6),
          "med".padStart(6),
          "p90".padStart(6),
          "max".padStart(6),
          "WAR".padStart(6),
          "spend/bank".padStart(12),
          "bust".padStart(5),
          "bonus".padStart(6),
          "tax".padStart(5),
          "spins".padStart(6),
          ">=162".padStart(6),
        ].join(" "),
      );
      for (const bot of bots) lines.push(summarize(bot.name, results.get(bot.name)!));

      const base = results.get("baseline")!;
      const pw = results.get("powerups")!;
      const deltas = pw.map((r, i) => r.total - base[i].total);
      lines.push(
        `\npaired (same seeds) powerups vs baseline: mean ${f1(mean(deltas))} pts, ` +
          `improved ${pct(mean(deltas.map((x) => (x > 0 ? 1 : 0))))}, ` +
          `hurt ${pct(mean(deltas.map((x) => (x < 0 ? 1 : 0))))}`,
      );

      lines.push("\npowerup usage (powerups bot) and paired delta when used:");
      for (const k of ALL_POWERUPS) {
        const used = pw.map((r, i) => [r.spent[k], deltas[i]] as const);
        const on = used.filter(([u]) => u).map(([, x]) => x);
        const off = used.filter(([u]) => !u).map(([, x]) => x);
        lines.push(
          `  ${k.padEnd(14)} used ${pct(on.length / N).padStart(4)}` +
            (on.length ? ` | mean paired delta when used ${f1(mean(on)).padStart(5)}` : "") +
            (off.length ? ` (when unused ${f1(mean(off))})` : ""),
        );
      }

      if (ABLATIONS) {
        lines.push("\nablations (powerups minus one — marginal contribution):");
        const full = mean(pw.map((r) => r.total));
        for (const k of ALL_POWERUPS) {
          const abl = results.get(`no-${k}`)!;
          lines.push(
            `  without ${k.padEnd(14)} mean ${f1(mean(abl.map((r) => r.total))).padStart(6)}` +
              `  (powerup worth ${f1(full - mean(abl.map((r) => r.total))).padStart(5)} pts)`,
          );
        }
      }
      // Vitest hides passing-test console output in some reporters; persist
      // the report next to the harness as well.
      const report = lines.join("\n");
      console.log(report);
      fs.writeFileSync(
        path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run.txt"),
        report + "\n",
      );

      // ---- harness integrity ----
      for (const bot of bots) {
        const rs = results.get(bot.name)!;
        expect(rs).toHaveLength(N);
        for (const r of rs) {
          expect(Number.isFinite(r.total)).toBe(true);
          expect(r.war).toBeGreaterThan(0);
          expect(r.spins).toBeGreaterThanOrEqual(10); // 8 seats + 3 specials, −1 if Double Play
        }
      }
      // The baseline truly never touches a powerup.
      for (const r of base) expect(Object.values(r.spent).every((x) => !x)).toBe(true);
      // The powerup bot actually plays them (the study would be vacuous otherwise).
      const anyUse = mean(pw.map((r) => (Object.values(r.spent).some((x) => x) ? 1 : 0)));
      expect(anyUse).toBeGreaterThan(0.5);
      // No powerup bot game busts under the strict-cap policy unless forced;
      // sanity: bust rate stays below the greedy ~75-79% design headline.
      expect(mean(pw.map((r) => (r.tax > 0 ? 1 : 0)))).toBeLessThan(0.5);
    },
  );
});

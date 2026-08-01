/** STUDY 3 — Payroll-bonus rule variants (Classic bank, shipped γ=1.25):
 *   current  10×(2×spend/budget−1), capped +10, 0 if over (Price-is-Right)
 *   thrift   +1 per $2M left under budget, capped +10, 0 if over
 *   none     no payroll bonus at all
 * Luxury tax unchanged in every variant. Each variant is applied BOTH ways:
 * post-hoc rescoring of the finale (total − shipped bonus + variant bonus)
 * AND in the bot's in-game economics (BotConfig.econ steers the $→points
 * spend credit and the Homegrown savings valuation — see harness.ts's
 * EconVariant doc). Bank-size valuation on owner picks stays common across
 * variants — a deliberate simplification.
 *
 * Questions: does thrift make Homegrown matter? does it induce cheap-roster
 * hoarding? does it strengthen or weaken bank-shopping (bank↔score corr)?
 *
 * Run: npx vitest run tests/bots/study3-bonus.test.ts  (BOT_GAMES=<n>) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALL_POWERUPS,
  loadData,
  playGame,
  type BotConfig,
  type EconVariant,
  type GameResult,
} from "./harness";
import { f1, f2, makeSeeds, mean, pctl, pearson } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 400);
const seeds = makeSeeds(N);
const VARIANTS: EconVariant[] = ["current", "thrift", "none"];

/** Variant payroll bonus from a finale's spend/budget. */
function variantBonus(v: EconVariant, spend: number, budget: number): number {
  if (v === "none") return 0;
  if (spend > budget || budget <= 0) return 0;
  if (v === "thrift") return Math.min(10, (budget - spend) / 2);
  return 10 * ((2 * spend) / budget - 1); // current — matches scoring.ts
}

/** Rescore a game under a variant: swap the shipped bonus for the variant's. */
const rescore = (v: EconVariant, r: GameResult): number =>
  Number((r.total - r.bonus + variantBonus(v, r.spend, r.budget)).toFixed(1));

describe("study 3: payroll bonus variants", () => {
  it(`plays ${N} games per bot per variant, bots playing toward each rule`, { timeout: 600_000 }, async () => {
    const d = loadData();
    const results = new Map<string, GameResult[]>(); // `${variant}|${bot}`
    for (const v of VARIANTS) {
      const bots: BotConfig[] = [
        { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false, econ: v },
        {
          name: "no-hometown",
          enabled: new Set(ALL_POWERUPS.filter((k) => k !== "hometown")),
          overspend: false,
          econ: v,
        },
      ];
      for (const bot of bots) {
        const rs: GameResult[] = [];
        for (const seed of seeds) rs.push(await playGame(seed, bot, d));
        results.set(`${v}|${bot.name}`, rs);
      }
    }

    const lines: string[] = [];
    lines.push(`\n=== Study 3: payroll-bonus variants, ${N} games/bot, Classic γ=1.25 ===`);
    lines.push(
      [
        "variant".padEnd(9),
        "mean".padStart(6),
        "med".padStart(6),
        "HGworth".padStart(8),
        "HGused".padStart(7),
        "spend/bank".padStart(11),
        "bank↔score r".padStart(13),
      ].join(" "),
    );
    for (const v of VARIANTS) {
      const pw = results.get(`${v}|powerups`)!;
      const noHg = results.get(`${v}|no-hometown`)!;
      const scores = pw.map((r) => rescore(v, r));
      const hgWorth = mean(scores) - mean(noHg.map((r) => rescore(v, r)));
      lines.push(
        [
          v.padEnd(9),
          f1(mean(scores)).padStart(6),
          f1(pctl(scores, 0.5)).padStart(6),
          f1(hgWorth).padStart(8),
          `${(100 * mean(pw.map((r) => (r.spent.hometown ? 1 : 0)))).toFixed(0)}%`.padStart(7),
          f2(mean(pw.map((r) => r.spend / r.budget))).padStart(11),
          f2(pearson(pw.map((r) => r.budget), scores)).padStart(13),
        ].join(" "),
      );
    }
    lines.push(
      "\n(HGworth = powerups mean − no-hometown mean, both rescored under the variant;",
    );
    lines.push(
      " spend/bank = mean per-game ratio; r = Pearson corr of final bank vs rescored score)",
    );
    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study3.txt"),
      report + "\n",
    );

    for (const key of results.keys()) {
      const rs = results.get(key)!;
      expect(rs).toHaveLength(N);
      for (const r of rs) expect(Number.isFinite(r.total)).toBe(true);
    }
    // Rescoring identity: under "current" the rescored total equals the
    // engine's own finale total (the variant formula matches scoring.ts).
    for (const r of results.get("current|powerups")!)
      expect(Math.abs(rescore("current", r) - r.total)).toBeLessThanOrEqual(0.1);
  });
});

/** STUDY 8 — EXPERT bot: the strongest honest player proxy the harness can
 * field, to estimate the expert-human perfect-season (≥162) rate. Same
 * information diet as the standard powerups bot (card contents only after
 * landing; card summaries only for reroll targeting — the "1998 NYY were
 * good" tier of baseball knowledge; no seed peeking).
 *
 * Method: candidate refinements (harness.ts ExpertFeature — exact payroll
 * slope, decaying option costs, depth-aware reroll appraisal, jackpot
 * rerolling, tight-cap Homegrown + HG-in-DP) are first measured SOLO against
 * the standard bot on paired seeds; only features with a clearly positive
 * paired mean make the expert. The selected expert then runs the full
 * paired sweep. If nothing helps, the expert IS the standard bot and the
 * report says so — no thumb on the scale.
 *
 * Run: npx vitest run tests/bots/study8-expert.test.ts
 * Tunables: BOT_SWEEP (default 5000), BOT_ABL (selection seeds, default 1500). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALL_POWERUPS,
  EXPERT_FEATURES,
  loadData,
  playGame,
  type BotConfig,
  type ExpertFeature,
  type GameResult,
} from "./harness";
import { f1, f2, makeSeeds, mean, pct, pctl } from "./stats";

const SWEEP = Number(process.env.BOT_SWEEP ?? 5000);
const ABL = Number(process.env.BOT_ABL ?? 1500);
/** Solo feature must beat standard by this paired mean to join the expert. */
const KEEP_MARGIN = 0.3;

const expertBot = (name: string, features: ExpertFeature[]): BotConfig => ({
  name,
  enabled: new Set(ALL_POWERUPS),
  overspend: false,
  expert: new Set(features),
});

function row(name: string, ts: number[]): string {
  const c = (thr: number): number => ts.filter((x) => x >= thr).length;
  return [
    name.padEnd(16),
    f1(mean(ts)).padStart(7),
    f1(pctl(ts, 0.9)).padStart(7),
    f1(pctl(ts, 0.99)).padStart(7),
    f1(Math.max(...ts)).padStart(7),
    String(c(150)).padStart(6),
    String(c(155)).padStart(6),
    String(c(162)).padStart(6),
    pct(c(162) / ts.length).padStart(7),
  ].join(" ");
}

describe("study 8: expert bot perfect-game rate", () => {
  it(`selects helpful features on ${ABL} paired seeds, then sweeps ${SWEEP}`, { timeout: 600_000 }, async () => {
    const d = loadData();
    const standard: BotConfig = {
      name: "standard",
      enabled: new Set(ALL_POWERUPS),
      overspend: false,
    };
    const run = async (bot: BotConfig, ss: number[]): Promise<GameResult[]> => {
      const rs: GameResult[] = [];
      for (const seed of ss) rs.push(await playGame(seed, bot, d));
      return rs;
    };

    // ---- phase A: solo-feature selection on paired seeds ----
    const ablSeeds = makeSeeds(ABL);
    const stdAbl = await run(standard, ablSeeds);
    const lines: string[] = [];
    lines.push(`=== Study 8: expert vs standard powerups bot ===`);
    lines.push(
      `\n[A] solo-feature selection, ${ABL} paired seeds (keep if mean > +${KEEP_MARGIN}; tail shown for context):`,
    );
    const stdTail = stdAbl.filter((r) => r.total >= 150).length;
    const kept: ExpertFeature[] = [];
    for (const f of EXPERT_FEATURES) {
      const rs = await run(expertBot(`solo-${f}`, [f]), ablSeeds);
      const delta = mean(rs.map((r, i) => r.total - stdAbl[i].total));
      const tail = rs.filter((r) => r.total >= 150).length;
      const keep = delta > KEEP_MARGIN;
      if (keep) kept.push(f);
      lines.push(
        `  +${f.padEnd(8)} paired mean ${f2(delta).padStart(6)}  >=150: ${String(tail).padStart(3)} (std ${stdTail})  ${keep ? "KEPT" : "dropped"}`,
      );
    }
    lines.push(
      kept.length > 0
        ? `  expert = standard + {${kept.join(", ")}}`
        : `  expert = standard (no refinement cleared the bar — the standard heuristics are the local optimum)`,
    );

    // ---- phase B: full paired sweep ----
    // The mean-selected expert answers "strongest average play". The chaser
    // (chase + jackpot) is the variance play a human hunting a perfect
    // season would make — swept separately because ≥162 is a tail question
    // that mean-selection can't see.
    const expert = expertBot("expert", kept);
    const chaser = expertBot("chaser", ["chase", "jackpot"]);
    const seeds = makeSeeds(SWEEP);
    const std = await run(standard, seeds);
    const exp = kept.length > 0 ? await run(expert, seeds) : std;
    const cha = await run(chaser, seeds);

    lines.push(`\n[B] full sweep, ${SWEEP} paired Classic seeds:`);
    lines.push(
      [
        "bot".padEnd(16),
        "mean".padStart(7),
        "p90".padStart(7),
        "p99".padStart(7),
        "max".padStart(7),
        ">=150".padStart(6),
        ">=155".padStart(6),
        ">=162".padStart(6),
        "rate".padStart(7),
      ].join(" "),
    );
    lines.push(row("standard", std.map((r) => r.total)));
    lines.push(row("expert", exp.map((r) => r.total)));
    lines.push(row("chaser", cha.map((r) => r.total)));
    if (kept.length > 0) {
      const deltas = exp.map((r, i) => r.total - std[i].total);
      lines.push(
        `\npaired expert−standard: mean ${f1(mean(deltas))} pts, improved ${pct(mean(deltas.map((x) => (x > 0 ? 1 : 0))))}`,
      );
    }
    const chDeltas = cha.map((r, i) => r.total - std[i].total);
    lines.push(
      `paired chaser−standard: mean ${f1(mean(chDeltas))} pts (variance play — judge it on the >=162 column)`,
    );

    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study8.txt"),
      report + "\n",
    );

    expect(std).toHaveLength(SWEEP);
    expect(exp).toHaveLength(SWEEP);
    for (const r of exp) expect(Number.isFinite(r.total)).toBe(true);
  });
});

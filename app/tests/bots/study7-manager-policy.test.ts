/** STUDY 7 — Manager multiplier, POLICY-AWARE (supersedes Study 6's post-hoc
 * first read): for M ∈ {0.1, 0.15, 0.2, 0.25} the powerups bot both PLAYS
 * under M (manager hires, TD/Prime manager decisions, reroll appraisal of
 * manager tiles all value (W−L)×M) and is SCORED under M (the engine finale
 * embeds 0.1, so totals/wins are rescored with the same M the bot believed).
 * 2,000 paired seeds per arm. Behavioral shifts reported vs the M=0.1 arm.
 *
 * Run: npx vitest run tests/bots/study7-manager-policy.test.ts  (BOT_GAMES=<n>) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GAMES, MANAGER_PER_NET_WIN, REPLACEMENT_WINS } from "../../src/lib/scoring";
import {
  ALL_POWERUPS,
  loadData,
  playGame,
  type BotConfig,
  type GameResult,
} from "./harness";
import { f1, f2, makeSeeds, mean, pct, pctl } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);
const seeds = makeSeeds(N);
const MULTS = [0.1, 0.15, 0.2, 0.25];

const expWinsAt = (r: GameResult, m: number): number =>
  Math.min(REPLACEMENT_WINS + r.war + r.mgrNet * m, GAMES);
const winsAt = (r: GameResult, m: number): number => Math.round(expWinsAt(r, m));
const totalAt = (r: GameResult, m: number): number =>
  Number((r.total - r.expectedWins + Number(expWinsAt(r, m).toFixed(1))).toFixed(1));

describe("study 7: manager multiplier, policy-aware", () => {
  it(`plays ${N} paired seeds per M with the bot believing (and scored at) M`, { timeout: 600_000 }, async () => {
    const d = loadData();
    const arms = new Map<number, GameResult[]>();
    for (const m of MULTS) {
      const bot: BotConfig = {
        name: `powerups-M${m}`,
        enabled: new Set(ALL_POWERUPS),
        overspend: false,
        mgrMult: m,
      };
      const rs: GameResult[] = [];
      for (const seed of seeds) rs.push(await playGame(seed, bot, d));
      arms.set(m, rs);
    }

    const lines: string[] = [];
    lines.push(`=== Study 7: manager multiplier M, POLICY-AWARE, ${N} Classic games/arm ===`);
    lines.push(
      [
        "M".padEnd(5),
        ">116".padStart(7),
        ">110".padStart(7),
        ">100".padStart(7),
        "maxW".padStart(5),
        "mean".padStart(7),
        "p90".padStart(7),
        ">=162".padStart(6),
      ].join(" "),
    );
    for (const m of MULTS) {
      const rs = arms.get(m)!;
      const ws = rs.map((r) => winsAt(r, m));
      const ts = rs.map((r) => totalAt(r, m));
      const share = (thr: number): string =>
        `${((100 * ws.filter((w) => w > thr).length) / N).toFixed(2)}%`;
      lines.push(
        [
          m.toFixed(2).padEnd(5),
          share(116).padStart(7),
          share(110).padStart(7),
          share(100).padStart(7),
          String(Math.max(...ws)).padStart(5),
          f1(mean(ts)).padStart(7),
          f1(pctl(ts, 0.9)).padStart(7),
          String(ts.filter((t) => t >= 162).length).padStart(6),
        ].join(" "),
      );
    }

    lines.push("\nbehavior per arm (managers are mandatory for completion — 100% hire):");
    lines.push(
      [
        "M".padEnd(5),
        "mgr W-L".padStart(8),
        "TD→mgr".padStart(7),
        "TD→plyr".padStart(8),
        "PT→mgr".padStart(7),
        "PT→plyr".padStart(8),
        "HG signs".padStart(9),
        "rerolls/gm".padStart(11),
      ].join(" "),
    );
    for (const m of MULTS) {
      const rs = arms.get(m)!;
      lines.push(
        [
          m.toFixed(2).padEnd(5),
          f1(mean(rs.map((r) => r.mgrNet))).padStart(8),
          pct(mean(rs.map((r) => r.uses.tdManager))).padStart(7),
          pct(mean(rs.map((r) => r.uses.tdPlayer))).padStart(8),
          pct(mean(rs.map((r) => r.uses.primeManager))).padStart(7),
          pct(mean(rs.map((r) => r.uses.primePlayer))).padStart(8),
          pct(mean(rs.map((r) => r.uses.hgSigns))).padStart(9),
          f2(mean(rs.map((r) => r.rerolls))).padStart(11),
        ].join(" "),
      );
    }
    lines.push("\n(rates are per-game shares; PT = Prime Time; engine scores at 0.1 so");
    lines.push(" wins/totals above are rescored at the M the bot played toward)");

    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study7.txt"),
      report + "\n",
    );

    for (const m of MULTS) {
      const rs = arms.get(m)!;
      expect(rs).toHaveLength(N);
      for (const r of rs) expect(Number.isFinite(r.total)).toBe(true);
    }
    // Policy-aware identity: the M=0.1 arm must reproduce the shipped game.
    for (const r of arms.get(0.1)!)
      expect(Math.abs(totalAt(r, MANAGER_PER_NET_WIN) - r.total)).toBeLessThanOrEqual(0.1);
    // Bots believing a bigger M must end up with better-record managers.
    const mgrAt = (m: number): number => mean(arms.get(m)!.map((r) => r.mgrNet));
    expect(mgrAt(0.25)).toBeGreaterThanOrEqual(mgrAt(0.1));
  });
});

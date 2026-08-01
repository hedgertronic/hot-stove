/** STUDY 9 — Should ⭐ Prime Time be players-only? Three POLICY-AWARE arms
 * (the bot never appraises banned tiles), powerups bot, Classic, M=0.1:
 *   A "all"          — shipped rule: players + owner/stadium/manager tiles
 *   B "players+mgr"  — owner and stadium tiles banned
 *   C "players-only" — every front-office tile banned
 * Key question: is Prime-on-owner a meaningful third bank-shopping tool
 * alongside the reroll powerups?
 *
 * OUTCOME (shipped, DECISIONS.md Round 17): arm B. The engine now rejects
 * owner/stadium primes outright, so on a rerun arm A degrades to B — the
 * A-vs-B comparison is historical, only B-vs-C remains simulable.
 *
 * Run: npx vitest run tests/bots/study9-prime-specials.test.ts  (BOT_GAMES=<n>) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SpecialKey } from "../../src/lib/engine.svelte";
import {
  ALL_POWERUPS,
  loadData,
  playGame,
  type BotConfig,
  type GameResult,
} from "./harness";
import { f1, makeSeeds, mean, pct, pctl } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);
const seeds = makeSeeds(N);

interface Arm {
  label: string;
  primeSpecials: SpecialKey[];
}
const ARMS: Arm[] = [
  { label: "A all", primeSpecials: ["owner", "stadium", "manager"] },
  { label: "B players+mgr", primeSpecials: ["manager"] },
  { label: "C players-only", primeSpecials: [] },
];

describe("study 9: Prime Time special-tile restrictions", () => {
  it(`plays ${N} paired Classic seeds per arm, policy-aware`, { timeout: 600_000 }, async () => {
    const d = loadData();
    const results = new Map<string, GameResult[]>();
    for (const arm of ARMS) {
      const bot: BotConfig = {
        name: arm.label,
        enabled: new Set(ALL_POWERUPS),
        overspend: false,
        primeSpecials: arm.primeSpecials,
      };
      const rs: GameResult[] = [];
      for (const seed of seeds) rs.push(await playGame(seed, bot, d));
      results.set(arm.label, rs);
    }

    const lines: string[] = [];
    lines.push(`=== Study 9: Prime Time tile bans, ${N} paired Classic games/arm, M=0.1 ===`);
    lines.push(
      [
        "arm".padEnd(15),
        "mean".padStart(7),
        "p90".padStart(7),
        "max".padStart(7),
        ">=162".padStart(6),
        "bank".padStart(7),
        "bonus".padStart(6),
      ].join(" "),
    );
    for (const arm of ARMS) {
      const rs = results.get(arm.label)!;
      const ts = rs.map((r) => r.total);
      lines.push(
        [
          arm.label.padEnd(15),
          f1(mean(ts)).padStart(7),
          f1(pctl(ts, 0.9)).padStart(7),
          f1(Math.max(...ts)).padStart(7),
          String(ts.filter((x) => x >= 162).length).padStart(6),
          f1(mean(rs.map((r) => r.budget))).padStart(7),
          f1(mean(rs.map((r) => r.bonus))).padStart(6),
        ].join(" "),
      );
    }

    // Arm A: what Prime is actually spent on today.
    const a = results.get("A all")!;
    const primeSpent = a.filter((r) => r.spent.prime).length;
    const split = (k: "primePlayer" | "primeManager" | "primeOwner" | "primeStadium"): string =>
      pct(a.reduce((s, r) => s + r.uses[k], 0) / Math.max(1, primeSpent));
    lines.push(
      `\narm A prime usage: spent in ${pct(primeSpent / N)} of games — ` +
        `player ${split("primePlayer")}, owner ${split("primeOwner")}, ` +
        `stadium ${split("primeStadium")}, manager ${split("primeManager")} of spends`,
    );
    const gains = a.map((r) => r.primeOwnerGain).filter((x): x is number => x !== null);
    lines.push(
      gains.length > 0
        ? `arm A prime-on-owner: fired in ${pct(gains.length / N)} of games; chosen bank ` +
            `richer than the landed tile's by $${f1(mean(gains))}M on average`
        : "arm A prime-on-owner: never fired",
    );

    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study9.txt"),
      report + "\n",
    );

    for (const arm of ARMS) {
      const rs = results.get(arm.label)!;
      expect(rs).toHaveLength(N);
      for (const r of rs) expect(Number.isFinite(r.total)).toBe(true);
    }
    // Policy-awareness: banned tiles are truly never taken.
    for (const r of results.get("B players+mgr")!)
      expect(r.uses.primeOwner + r.uses.primeStadium).toBe(0);
    for (const r of results.get("C players-only")!)
      expect(r.uses.primeOwner + r.uses.primeStadium + r.uses.primeManager).toBe(0);
  });
});

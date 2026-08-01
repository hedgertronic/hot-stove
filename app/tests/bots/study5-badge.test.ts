/** STUDY 5 — 🔱 badge frequency: how often does the ON-FIELD record beat the
 * 2001 Mariners? Trigger = round(50 + roster WAR + manager net wins) > 116 —
 * pure on-field expected wins, NOT the total score. Measured over seeded
 * Classic games (baseline + powerups bots) and Blank Check (powerups).
 *
 * Run: npx vitest run tests/bots/study5-badge.test.ts  (BOT_GAMES=<n>, default 2000) */
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
import { makeSeeds, mean } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);
const seeds = makeSeeds(N);
const BC: GameConfig = { difficulty: "standard", bank: "blankcheck" };

/** The finale's displayed on-field record: rounded expected wins. */
const wins = (r: GameResult): number => Math.round(r.expectedWins);

describe("study 5: Mariners badge frequency", () => {
  it(`counts on-field wins > 116/110/100 over ${N} games per run`, { timeout: 600_000 }, async () => {
    const d = loadData();
    const baseline: BotConfig = { name: "baseline", enabled: new Set(), overspend: false };
    const powerups: BotConfig = { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false };

    const runs: { label: string; bot: BotConfig; config?: GameConfig }[] = [
      { label: "Classic baseline", bot: baseline },
      { label: "Classic powerups", bot: powerups },
      { label: "BlankCheck powerups", bot: powerups, config: BC },
    ];

    const lines: string[] = [];
    lines.push(`=== Study 5: 🔱 on-field wins > 116, ${N} games/run ===`);
    lines.push(
      ["run".padEnd(20), ">116".padStart(7), ">110".padStart(7), ">100".padStart(7), "max W".padStart(6)].join(" "),
    );
    const allWins: number[][] = [];
    for (const run of runs) {
      const ws: number[] = [];
      for (const seed of seeds)
        ws.push(wins(await playGame(seed, run.bot, d, run.config)));
      allWins.push(ws);
      const share = (thr: number): string => `${((100 * ws.filter((w) => w > thr).length) / N).toFixed(2)}%`;
      lines.push(
        [
          run.label.padEnd(20),
          share(116).padStart(7),
          share(110).padStart(7),
          share(100).padStart(7),
          String(Math.max(...ws)).padStart(6),
        ].join(" "),
      );
    }
    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study5.txt"),
      report + "\n",
    );

    for (const ws of allWins) {
      expect(ws).toHaveLength(N);
      // On-field wins live on the 162-game scale, above replacement level.
      expect(Math.min(...ws)).toBeGreaterThanOrEqual(50);
      expect(Math.max(...ws)).toBeLessThanOrEqual(162);
    }
    expect(mean(allWins[1])).toBeGreaterThan(mean(allWins[0])); // powerups add WAR
  });
});

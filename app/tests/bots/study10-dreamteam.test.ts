/** STUDY 10 — ⭐ scout hits and the 🔮 CRYSTAL BALL rate under the one-pick-per-
 * card dream team. A spin buys one thing from the card it lands on, so the
 * dream club takes at most one pick per team-season and its skipper consumes a
 * card too. That makes the yardstick harder to match than the old solver's
 * (which could stack five players off one card), and 🔮 is gated on hits ≥ 7.
 *
 * Measured: the hit distribution, the honest denominator (`best.dreamSeats` —
 * seats the dream club could actually occupy given the cards spun), and the
 * rate at each candidate 🔮 threshold, so the badge can be recalibrated against
 * real numbers rather than the pre-change 0.25–2% band.
 *
 * Run: BOT_STUDIES=1 npx vitest run tests/bots/study10-dreamteam.test.ts
 * (BOT_GAMES=<n>, default 2000) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_POWERUPS, loadData, playGame, type BotConfig } from "./harness";
import { makeSeeds, mean } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);
const seeds = makeSeeds(N);
const THRESHOLDS = [5, 6, 7, 8, 9];

const pct = (n: number, of: number): string => `${((100 * n) / of).toFixed(2)}%`;

describe("study 10: dream-team scout hits", () => {
  it(`counts ⭐ hits and 🔮 rate over ${N} games per bot`, { timeout: 600_000 }, async () => {
    const d = loadData();
    const runs: { label: string; bot: BotConfig }[] = [
      { label: "baseline", bot: { name: "baseline", enabled: new Set(), overspend: false } },
      {
        label: "powerups",
        bot: { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
      },
    ];

    const lines: string[] = [];
    lines.push(`=== Study 10: ⭐ hits / 🔮 rate, ${N} Classic games/bot ===`);
    lines.push(
      ["run".padEnd(10), "mean⭐".padStart(7), "max⭐".padStart(5), "spins".padStart(6),
        ...THRESHOLDS.map((t) => `≥${t}`.padStart(8))].join(" "),
    );
    for (const run of runs) {
      const hits: number[] = [];
      const spins: number[] = [];
      for (const seed of seeds) {
        const r = await playGame(seed, run.bot, d);
        hits.push(r.scout); // a seat count, like the 🔮 threshold it feeds
        spins.push(r.spins); // spins bound the cards seen, and so the dream seats
      }
      lines.push(
        [
          run.label.padEnd(10),
          mean(hits).toFixed(2).padStart(7),
          String(Math.max(...hits)).padStart(5),
          mean(spins).toFixed(2).padStart(6),
          ...THRESHOLDS.map((t) => pct(hits.filter((h) => h >= t).length, N).padStart(8)),
        ].join(" "),
      );
      expect(hits).toHaveLength(N);
    }
    const out = lines.join("\n");
    console.log(`\n${out}\n`);
    const dir = path.dirname(fileURLToPath(import.meta.url));
    fs.writeFileSync(path.join(dir, "last-run-study10.txt"), `${out}\n`);
  });
});

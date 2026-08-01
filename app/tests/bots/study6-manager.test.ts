/** STUDY 6 — Manager multiplier sensitivity: on-field wins =
 * round(50 + roster WAR + (mgrW − mgrL) × M), shipped M = 0.1. For
 * M ∈ {0.1, 0.15, 0.2, 0.25}, how does the 🔱 rate (>116) move, and what is
 * the side-effect on total score (manager wins feed expected wins)?
 *
 * Method: POST-HOC recompute over one set of played games per bot — results
 * store the hired manager's W−L, so each M is applied to the same games.
 * Caveat (stated, accepted for a first read): the bot's hire-time policy
 * still values managers at 0.1×, so higher-M play would chase good managers
 * slightly harder than measured here.
 *
 * Run: npx vitest run tests/bots/study6-manager.test.ts  (BOT_GAMES=<n>, default 2000) */
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
import { f1, makeSeeds, mean, pctl } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);
const seeds = makeSeeds(N);
const MULTS = [0.1, 0.15, 0.2, 0.25];

/** Unrounded expected wins under multiplier M (win cap honored). */
const expWinsAt = (r: GameResult, m: number): number =>
  Math.min(REPLACEMENT_WINS + r.war + r.mgrNet * m, GAMES);

/** On-field record under M — what the 🔱 badge tests against 116. */
const winsAt = (r: GameResult, m: number): number => Math.round(expWinsAt(r, m));

/** Total score under M: swap the shipped expected-wins term (which embeds
 * M=0.1) for the recomputed one; all other parts are unchanged. */
const totalAt = (r: GameResult, m: number): number =>
  Number((r.total - r.expectedWins + Number(expWinsAt(r, m).toFixed(1))).toFixed(1));

describe("study 6: manager multiplier sensitivity", () => {
  it(`recomputes 🔱 and total score at M=${MULTS.join("/")} over ${N} games/bot`, { timeout: 600_000 }, async () => {
    const d = loadData();
    const runs: { label: string; bot: BotConfig; mults: number[] }[] = [
      {
        label: "powerups",
        bot: { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
        mults: MULTS,
      },
      {
        label: "baseline",
        bot: { name: "baseline", enabled: new Set(), overspend: false },
        mults: [0.1, 0.2], // one casual-player data point (0.1 as reference)
      },
    ];

    const lines: string[] = [];
    lines.push(`=== Study 6: manager multiplier M, post-hoc over ${N} Classic games/bot ===`);
    lines.push(
      [
        "bot / M".padEnd(16),
        ">116".padStart(7),
        ">110".padStart(7),
        ">100".padStart(7),
        "max W".padStart(6),
        "mean".padStart(7),
        "p90".padStart(7),
        ">=162".padStart(6),
      ].join(" "),
    );
    for (const run of runs) {
      const rs: GameResult[] = [];
      for (const seed of seeds) rs.push(await playGame(seed, run.bot, d));
      for (const m of run.mults) {
        const ws = rs.map((r) => winsAt(r, m));
        const ts = rs.map((r) => totalAt(r, m));
        const share = (thr: number): string =>
          `${((100 * ws.filter((w) => w > thr).length) / N).toFixed(2)}%`;
        lines.push(
          [
            `${run.label} ${m.toFixed(2)}`.padEnd(16),
            share(116).padStart(7),
            share(110).padStart(7),
            share(100).padStart(7),
            String(Math.max(...ws)).padStart(6),
            f1(mean(ts)).padStart(7),
            f1(pctl(ts, 0.9)).padStart(7),
            String(ts.filter((t) => t >= 162).length).padStart(6),
          ].join(" "),
        );
      }
      // Recompute identity: at the shipped M=0.1 the recomputed totals and
      // wins must match the engine's own finale numbers (within 0.1 rounding).
      for (const r of rs) {
        expect(Math.abs(totalAt(r, MANAGER_PER_NET_WIN) - r.total)).toBeLessThanOrEqual(0.1);
        expect(Math.abs(expWinsAt(r, MANAGER_PER_NET_WIN) - r.expectedWins)).toBeLessThanOrEqual(0.06);
      }
      expect(rs).toHaveLength(N);
    }
    lines.push("\n(post-hoc: same played games per bot, M applied at rescore; hire-time");
    lines.push(" policy still values managers at 0.1x — see file header caveat)");

    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study6.txt"),
      report + "\n",
    );
  });
});

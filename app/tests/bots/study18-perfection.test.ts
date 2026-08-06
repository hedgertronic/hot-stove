/** STUDY 18 — how often is a PERFECT 162–0 on the table?
 *
 * "On the table" is the finale's own claim: the printed ceiling
 * (`bestPossibleTotal`, the solver's proven-reachable best over the cards the
 * reel actually showed) stamps 162–0 through `recordFromTotal` — i.e. the
 * ceiling total reaches 161.5, the lowest number that rounds to the full
 * record. That is the 🎣 THE ONE THAT GOT AWAY badge's condition read from
 * the other side, so this study also reports the badge's bot rate directly:
 * ceiling stamps perfect, club's own stamp doesn't.
 *
 * Two banks × two arms:
 *   - classic + all powerups: the question as asked — the reference
 *     population every `BadgeDef.freq` quotes.
 *   - moneyball + all powerups: the $51.5M fixed cap. The solver's ceiling
 *     lives under the same cap the player does, so this measures whether a
 *     perfect season is even purchasable at Oakland money.
 *   - both banks vanilla (no powerups): context. The powerup arms' pools are
 *     bigger by construction (rerolls, ⭐'s off-reel season), so the vanilla
 *     rate says how much of "perfection possible" is powerup-supplied.
 *
 * One caveat the numbers inherit from the harness: the card pool the solver
 * sees is the pool the BOT's play produced (its rerolls, its spins), so the
 * powerup arms measure "a game played with powerups had 162–0 in its cards",
 * not "a clairvoyant could reach 162–0 from the seed". The bots reroll to
 * shop bankrolls, not to hunt perfect boards, so these rates are a floor on
 * what a perfection-hunting player could surface.
 *
 * Run: BOT_STUDIES=1 npx vitest run tests/bots/study18-perfection.test.ts
 * (BOT_GAMES=<n>, default 2000 per arm) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { recordFromTotal } from "../../src/lib/format";
import type { GameConfig } from "../../src/lib/engine.svelte";
import { ALL_POWERUPS, loadData, playGame, type BotConfig } from "./harness";
import { makeSeeds, mean } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);
const seeds = makeSeeds(N);

const pct = (n: number, of: number): string => `${((100 * n) / of).toFixed(2)}%`;
const fmt = (x: number, d = 1): string => (Number.isNaN(x) ? "—" : x.toFixed(d));

/** The stamp's own arithmetic: a total whose record rounds to 162–0. */
const stampsPerfect = (total: number | null): boolean =>
  total !== null && recordFromTotal(total).losses === 0;

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const MONEYBALL: GameConfig = { difficulty: "standard", bank: "moneyball" };

describe("study 18: how often is 162–0 on the table", () => {
  it.runIf(process.env.BOT_STUDIES === "1")(
    `measures the perfect-board rate over ${N} games per arm`,
    { timeout: 3_600_000 },
    async () => {
      const d = loadData();
      const arms: { label: string; bot: BotConfig; config: GameConfig }[] = [
        {
          label: "classic + all powerups",
          bot: { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
          config: CLASSIC,
        },
        {
          label: "classic vanilla",
          bot: { name: "vanilla", enabled: new Set(), overspend: false },
          config: CLASSIC,
        },
        {
          label: "moneyball + all powerups",
          bot: { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
          config: MONEYBALL,
        },
        {
          label: "moneyball vanilla",
          bot: { name: "vanilla", enabled: new Set(), overspend: false },
          config: MONEYBALL,
        },
      ];

      const L: string[] = [];
      L.push(`=== Study 18: 162–0 on the table, ${N} games/arm ===`);
      L.push(
        "(possible = the printed ceiling stamps 162–0, i.e. ceiling ≥ 161.5;",
      );
      L.push(" 🎣 = possible and the club's own stamp fell short)");
      for (const { label, bot, config } of arms) {
        let possible = 0;
        let achieved = 0;
        let gotaway = 0;
        const ceiling: number[] = [];
        const total: number[] = [];
        for (const seed of seeds) {
          const r = await playGame(seed, bot, d, config);
          const p = stampsPerfect(r.ceiling);
          const a = stampsPerfect(r.total);
          if (p) possible += 1;
          if (a) achieved += 1;
          if (p && !a) gotaway += 1;
          ceiling.push(r.ceiling ?? 0);
          total.push(r.total);
        }
        // The badge's own identity, restated over the tallies: every counted
        // 🎣 sits inside "possible" and outside "achieved".
        expect(gotaway).toBe(possible - ceiling.filter((c, i) => stampsPerfect(c) && stampsPerfect(total[i])).length);

        L.push("");
        L.push(`--- ${label} ---`);
        L.push(
          `162–0 possible  ${pct(possible, N)}   achieved ${pct(achieved, N)}   ` +
            `🎣 got away ${pct(gotaway, N)}`,
        );
        L.push(
          `ceiling mean ${fmt(mean(ceiling))}   achieved mean ${fmt(mean(total))}`,
        );
      }

      const out = L.join("\n");
      console.log(`\n${out}\n`);
      const dir = path.dirname(fileURLToPath(import.meta.url));
      fs.writeFileSync(path.join(dir, "last-run-study18.txt"), `${out}\n`);
    },
  );
});

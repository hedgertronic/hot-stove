/** STUDY 14 — what the stamped-record gate on the on-field rungs costs, and
 * how often a rung is won on a busted payroll.
 *
 * `onFieldBadge` picks a rung off the BASELINE record and keeps it only if the
 * STAMPED record clears the same mark. `engine.svelte.ts` does not pass
 * `stamp` into `earnedBadges` yet, so the gate is inert in the harness and
 * study 11 measures the ungated rates. This study measures the gate directly
 * instead: it captures each finale's baseline record and points total, derives
 * the stamp the finale printed with `recordFromTotal` — the same call the
 * finale itself makes — and runs both versions of the ladder over them.
 *
 * That answers three questions at once:
 *
 *   1. Each rung's fire rate before and after the gate.
 *   2. How often a club clears the baseline mark and fails the stamp, which is
 *      the size of the change.
 *   3. How often a rung is won alongside 💸 MORTGAGED THE FARM ($15M or more
 *      past the cap) — the set's own definition of "way over", and the number
 *      the overrun question was actually about.
 *
 * TWO arms, because one would answer the wrong question. The reference arm the
 * badge table is quoted against treats the cap as a hard feasibility gate
 * (`overspend: false`), so it measures how often a club TRYING to stay under
 * still busts. The overspend arm crosses the cap whenever the WAR gained
 * outruns the tax plus the lost bonus — the strategy that stays legitimate —
 * so it measures what the gate does to a player actually playing that way.
 *
 * Run: BOT_STUDIES=1 BOT_GAMES=1500 npx vitest run tests/bots/study14-overrun.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CROWN_WINS, HUNDRED_WINS, MATCHED, onFieldBadge } from "../../src/lib/badges";
import { Game } from "../../src/lib/engine.svelte";
import { recordFromTotal } from "../../src/lib/format";
import { GAMES, MARINERS_WINS } from "../../src/lib/scoring";
import { ALL_POWERUPS, loadData, playGame, type BotConfig } from "./harness";
import { makeSeeds } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 1500);

interface Capture {
  /** `displayRecord(expectedWins)` — the ledger's "Baseline wins" row. */
  baseline: number;
  /** `recordFromTotal(total)` — the giant W–L the finale stamps. */
  stamp: number;
  /** $M past the cap, negative when under it. */
  over: number;
  busted: boolean;
}

const captured: Capture[] = [];

/* `GameResult` carries neither the record nor the spend, so the study wraps
 * `finishGame` the way study 11 does rather than re-deriving either. */
{
  type FinishFn = (this: Game) => Promise<void>;
  const proto = Game.prototype as unknown as { finishGame: FinishFn };
  const orig = proto.finishGame;
  proto.finishGame = async function wrapped(this: Game): Promise<void> {
    await orig.call(this);
    const f = this.finale;
    if (!f) return;
    captured.push({
      baseline: f.wins,
      stamp: recordFromTotal(f.parts.total, GAMES, MARINERS_WINS).wins,
      over: f.spend - f.budget,
      busted: f.badges.includes("farm"),
    });
  };
}

/** The ladder as it stands with the gate inert — baseline alone. */
const ungated = (c: Capture): string | null => onFieldBadge(c.baseline);
/** The ladder as `earnedBadges` resolves it once the engine passes `stamp`. */
const gated = (c: Capture): string | null => onFieldBadge(c.baseline, c.stamp);

const RUNGS = ["crown", ...Object.values(MATCHED), "hundred"];
const pct = (n: number, of: number): string =>
  of === 0 ? "     —" : `${((100 * n) / of).toFixed(2)}%`.padStart(6);

async function runArm(bot: BotConfig): Promise<Capture[]> {
  const d = loadData();
  const out: Capture[] = [];
  for (const seed of makeSeeds(N)) {
    captured.length = 0;
    await playGame(seed, bot, d);
    // A missed capture would read as a plausible zero, so it is checked per
    // game rather than only in aggregate.
    expect(captured).toHaveLength(1);
    out.push(captured[0]);
  }
  return out;
}

function table(label: string, rows: Capture[]): string[] {
  const L = [`--- ${label} (n=${rows.length}) ---`, ""];
  L.push(["rung".padEnd(12), "ungated", " gated", "  lost"].join(" "));
  for (const key of RUNGS) {
    const before = rows.filter((c) => ungated(c) === key).length;
    const after = rows.filter((c) => gated(c) === key).length;
    L.push(
      [
        key.padEnd(12),
        pct(before, rows.length),
        pct(after, rows.length),
        pct(before - after, rows.length),
      ].join(" "),
    );
  }
  const anyBefore = rows.filter((c) => ungated(c) !== null);
  const vetoed = rows.filter((c) => ungated(c) !== null && gated(c) === null);
  const busted = rows.filter((c) => c.busted);
  const over = rows.filter((c) => c.over > 0);
  L.push("");
  L.push(`any rung, ungated                        ${pct(anyBefore.length, rows.length)}`);
  L.push(`cleared the baseline, failed the stamp   ${pct(vetoed.length, rows.length)}`);
  L.push(`  … as a share of rung-winning seasons   ${pct(vetoed.length, anyBefore.length)}`);
  L.push("");
  L.push(`💸 MORTGAGED THE FARM ($15M+ over)        ${pct(busted.length, rows.length)}`);
  L.push(`a rung AND 💸, ungated                    ${pct(rows.filter((c) => ungated(c) !== null && c.busted).length, rows.length)}`);
  L.push(`  … as a share of rung-winning seasons   ${pct(rows.filter((c) => ungated(c) !== null && c.busted).length, anyBefore.length)}`);
  L.push(`a rung AND 💸, gated                      ${pct(rows.filter((c) => gated(c) !== null && c.busted).length, rows.length)}`);
  L.push(`any overrun at all (> $0 past the cap)   ${pct(over.length, rows.length)}`);
  L.push(`  … and won a rung, ungated              ${pct(rows.filter((c) => ungated(c) !== null && c.over > 0).length, rows.length)}`);
  L.push(`  … and won a rung, gated                ${pct(rows.filter((c) => gated(c) !== null && c.over > 0).length, rows.length)}`);
  L.push("");
  return L;
}

describe("study 14: the stamped-record gate on the on-field rungs", () => {
  it(
    `measures the gate over ${N} games per arm`,
    { timeout: 7_200_000 },
    async () => {
      if (!process.env.BOT_STUDIES) return;
      const under: BotConfig = {
        name: "reference",
        enabled: new Set(ALL_POWERUPS),
        overspend: false,
      };
      const overspend: BotConfig = {
        name: "overspend",
        enabled: new Set(ALL_POWERUPS),
        overspend: true,
      };

      const t0 = Date.now();
      const refRows = await runArm(under);
      const overRows = await runArm(overspend);
      const wall = (Date.now() - t0) / 1000;

      const L = [
        "=== Study 14: the stamped-record gate on the on-field rungs ===",
        `Clean House bank + all six powerups. Wall clock ${wall.toFixed(1)}s ` +
          `for ${2 * N} games.`,
        `Gate: rung picked at ${HUNDRED_WINS}/exact/${CROWN_WINS}+ baseline wins,`,
        "kept only if the stamped record clears the same mark.",
        "",
        ...table("reference arm — cap treated as a hard gate", refRows),
        ...table("overspend arm — crosses the cap when the WAR pays for it", overRows),
        "Reading: 'lost' is the rung's own fall. 'cleared the baseline, failed",
        "the stamp' is the whole size of the change. The 💸 lines are the",
        "overrun question — how often a rung is currently won on a busted",
        "payroll, and what the gate leaves of it.",
      ];
      const out = L.join("\n");
      console.log(`\n${out}\n`);
      const dir = path.dirname(fileURLToPath(import.meta.url));
      fs.writeFileSync(path.join(dir, "last-run-study14.txt"), `${out}\n`);

      expect(refRows).toHaveLength(N);
      expect(overRows).toHaveLength(N);
    },
  );
});

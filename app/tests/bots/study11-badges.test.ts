/** STUDY 11 — per-badge fire rates for the rebuilt badge set, and the shape of
 * the on-field axis after the champion ladder was rebuilt around exact matches
 * around exact champion matches — six named rungs (98 / 103 / 106 / 108 / 114)
 * plus the 116 record rung, 👑 at 117+, and 💯 as the ≥100 fallback.
 *
 * Measures three arms:
 *   - reference: From the Ground Up bank (`classic`) + all six powerups — the
 *     population `BadgeDef.freq` is quoted against.
 *   - baseline: From the Ground Up, no powerups — the floor a player starts from.
 *   - Blank Check: uncapped bank + all powerups, for context.
 *
 * `GameResult` carries only scalars, so the badge list would be discarded with
 * the finale. `Game.prototype.finishGame` is wrapped to capture the finale's
 * badge keys and its displayed record before the harness drops it — the badges
 * come from the engine's own `earnedBadges` call, never re-derived here, and
 * the win totals are the finale's `displayRecord` output rather than a second
 * rounding of `expectedWins`.
 *
 * Run: BOT_STUDIES=1 BOT_GAMES=10000 npx vitest run tests/bots/study11-badges.test.ts
 * (BOT_GAMES sizes the reference arm, default 2000; BOT_GAMES_CTX sizes the
 * two context arms, default min(2000, BOT_GAMES).) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BADGES, CROWN_WINS, MATCHED, type Rarity } from "../../src/lib/badges";
import { Game, type GameConfig } from "../../src/lib/engine.svelte";
import { ALL_POWERUPS, loadData, playGame, type BotConfig, type HarnessData } from "./harness";
import { makeSeeds } from "./stats";

const N_REF = Number(process.env.BOT_GAMES ?? 2000);
const N_CTX = Number(process.env.BOT_GAMES_CTX ?? Math.min(2000, N_REF));
const BC: GameConfig = { difficulty: "standard", bank: "blankcheck" };

// ---------------------------------------------------------------------------
// Finale capture
// ---------------------------------------------------------------------------

interface Capture {
  seed: number;
  badges: string[];
  wins: number;
  losses: number;
}

const captured: Capture[] = [];

{
  type FinishFn = (this: Game) => Promise<void>;
  const proto = Game.prototype as unknown as { finishGame: FinishFn };
  const orig = proto.finishGame;
  proto.finishGame = async function wrapped(this: Game): Promise<void> {
    await orig.call(this);
    const f = this.finale;
    if (f) captured.push({ seed: this.seed, badges: f.badges, wins: f.wins, losses: f.losses });
  };
}

async function runArm(
  seeds: number[],
  bot: BotConfig,
  d: HarnessData,
  config?: GameConfig,
): Promise<Capture[]> {
  const out: Capture[] = [];
  for (const seed of seeds) {
    captured.length = 0;
    await playGame(seed, bot, d, config);
    // A missed capture would read as a plausible-looking zero, so it is checked
    // per game rather than only in aggregate.
    expect(captured).toHaveLength(1);
    expect(captured[0].seed).toBe(seed);
    out.push(captured[0]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rarity bands
// ---------------------------------------------------------------------------

/** Percentage points either side of a band edge inside which a call is not
 * worth making: the binomial SE at p=5%, n=10000 is ≈0.22pp. */
const EDGE_SLACK = 0.5;
const BAND_EDGES = [1.5, 5, 25];

function tierFor(p: number): Rarity {
  if (p >= 25) return "common";
  if (p >= 5) return "uncommon";
  if (p >= 1.5) return "rare";
  return "ultra";
}

const borderline = (p: number): boolean => BAND_EDGES.some((e) => Math.abs(p - e) <= EDGE_SLACK);

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

const pct = (n: number, of: number): number => (100 * n) / of;
const f2 = (x: number): string => x.toFixed(2);

function badgeRate(rows: Capture[], key: string): number {
  return pct(rows.filter((r) => r.badges.includes(key)).length, rows.length);
}

/** Win-total buckets: every total 95–120 individually (the whole champion
 * ladder plus its shoulders), coarse buckets below, one overflow above. */
interface Bucket {
  label: string;
  lo: number;
  hi: number;
}
const BUCKETS: Bucket[] = [
  { label: "<=62 (💀 range)", lo: -Infinity, hi: 62 },
  { label: "63-79", lo: 63, hi: 79 },
  { label: "80-89", lo: 80, hi: 89 },
  { label: "90-94", lo: 90, hi: 94 },
  ...Array.from({ length: 26 }, (_, i) => ({ label: String(95 + i), lo: 95 + i, hi: 95 + i })),
  { label: ">120", lo: 121, hi: Infinity },
];

/** What the win total earns, as a label for the histogram's right-hand column. */
function rungLabel(w: number): string {
  if (w >= CROWN_WINS) return "👑 crown";
  if (MATCHED[w]) return `🏅 ${MATCHED[w]}`;
  if (w >= 100) return "💯 hundred";
  if (162 - w >= 100) return "💀 skull";
  return "— nothing";
}

// ---------------------------------------------------------------------------

describe("study 11: badge frequencies", () => {
  it(
    `measures every badge over ${N_REF} reference games`,
    { timeout: 7_200_000 },
    async () => {
      const d = loadData();
      const powerups: BotConfig = {
        name: "powerups",
        enabled: new Set(ALL_POWERUPS),
        overspend: false,
      };
      const baseline: BotConfig = { name: "baseline", enabled: new Set(), overspend: false };

      const t0 = Date.now();
      const ref = await runArm(makeSeeds(N_REF), powerups, d);
      const base = await runArm(makeSeeds(N_CTX), baseline, d);
      const bc = await runArm(makeSeeds(N_CTX), powerups, d, BC);
      const wall = (Date.now() - t0) / 1000;

      const arms: { label: string; rows: Capture[] }[] = [
        { label: `reference (From the Ground Up + all powerups, n=${N_REF})`, rows: ref },
        { label: `baseline (From the Ground Up, no powerups, n=${N_CTX})`, rows: base },
        { label: `Blank Check (+ all powerups, n=${N_CTX})`, rows: bc },
      ];

      const L: string[] = [];
      L.push("=== Study 11: badge fire rates, rebuilt on-field ladder ===");
      L.push(
        `Population: bot play through the real engine. reference = From the Ground Up ` +
          `bank + all six powerups, n=${N_REF}. Context arms n=${N_CTX}.`,
      );
      L.push(`Wall clock: ${wall.toFixed(1)}s for ${N_REF + 2 * N_CTX} games.`);
      L.push("");

      // ---- 1. per-badge table ----
      L.push("--- 1. Per-badge fire rate (% of games) ---");
      L.push(
        [
          "badge".padEnd(14),
          "axis".padEnd(8),
          "current".padEnd(9),
          `ref n=${N_REF}`.padStart(12),
          `base n=${N_CTX}`.padStart(12),
          `bc n=${N_CTX}`.padStart(12),
          "recommend".padEnd(10),
          "flag",
        ].join(" "),
      );
      const disagree: string[] = [];
      for (const b of BADGES) {
        const r = badgeRate(ref, b.key);
        const rec = b.ironic ? "ironic" : tierFor(r);
        const flags: string[] = [];
        if (!b.ironic && borderline(r)) flags.push("BORDERLINE");
        if (!b.ironic && rec !== b.rarity) {
          flags.push(`CHANGE ${b.rarity}→${rec}`);
          disagree.push(
            `${b.emoji} ${b.key.padEnd(12)} current=${b.rarity.padEnd(8)} ` +
              `measured=${f2(r)}%  →  ${rec}${borderline(r) ? "  (borderline)" : ""}`,
          );
        }
        L.push(
          [
            `${b.emoji} ${b.key}`.padEnd(14),
            b.axis.padEnd(8),
            b.rarity.padEnd(9),
            f2(r).padStart(12),
            f2(badgeRate(base, b.key)).padStart(12),
            f2(badgeRate(bc, b.key)).padStart(12),
            rec.padEnd(10),
            flags.join(" "),
          ].join(" "),
        );
      }
      L.push("");
      L.push("--- 2. Tier disagreements vs the frozen badges.ts ---");
      L.push(...(disagree.length > 0 ? disagree : ["(none)"]));
      L.push("");

      // ---- 3. on-field axis ----
      L.push("--- 3. On-field axis: exactly one of these fires, or nothing ---");
      const onfield = BADGES.filter((b) => b.axis === "onfield").map((b) => b.key);
      L.push(
        ["rung".padEnd(14), ...arms.map((a) => a.label.split(" ")[0].padStart(12))].join(" "),
      );
      for (const key of onfield) {
        L.push(
          [
            key.padEnd(14),
            ...arms.map((a) => f2(badgeRate(a.rows, key)).padStart(12)),
          ].join(" "),
        );
      }
      L.push(
        [
          "NOTHING".padEnd(14),
          ...arms.map((a) =>
            f2(
              pct(
                a.rows.filter((r) => !r.badges.some((k) => onfield.includes(k))).length,
                a.rows.length,
              ),
            ).padStart(12),
          ),
        ].join(" "),
      );
      L.push("");
      L.push(
        "  (column order: " + arms.map((a) => a.label).join(" | ") + ")",
      );
      L.push("");

      // ---- 4. win histogram ----
      L.push("--- 4. Baseline-win histogram (finale displayRecord wins) ---");
      L.push(
        [
          "wins".padEnd(16),
          ...arms.map((_, i) => (i === 0 ? "ref %" : i === 1 ? "base %" : "bc %").padStart(9)),
          "  earns",
        ].join(" "),
      );
      for (const bk of BUCKETS) {
        const counts = arms.map((a) => a.rows.filter((r) => r.wins >= bk.lo && r.wins <= bk.hi));
        if (counts.every((c) => c.length === 0)) continue;
        const earns =
          bk.lo === bk.hi ? rungLabel(bk.lo) : bk.hi <= 62 ? "💀 skull" : bk.hi <= 94 ? "— nothing" : "👑 crown";
        L.push(
          [
            bk.label.padEnd(16),
            ...counts.map((c, i) => f2(pct(c.length, arms[i].rows.length)).padStart(9)),
            `  ${earns}`,
          ].join(" "),
        );
      }
      L.push("");

      // ---- 5. crown tail ----
      L.push("--- 5. 👑 tail by exact total (reference arm) — how much mass 117+ takes ---");
      const maxW = Math.max(...ref.map((r) => r.wins));
      for (let w = CROWN_WINS; w <= maxW; w++) {
        const c = ref.filter((r) => r.wins === w).length;
        if (c > 0) L.push(`  ${String(w).padStart(3)}  ${f2(pct(c, N_REF)).padStart(6)}%  (${c})`);
      }
      L.push("");

      // ---- 6. dead zone ----
      const share = (f: (w: number) => boolean): string =>
        `${f2(pct(ref.filter((r) => f(r.wins)).length, N_REF))}%`;
      const lowestRung = Math.min(...Object.keys(MATCHED).map(Number));
      L.push("--- 6. Dead zones (reference arm) ---");
      L.push(
        `  Nothing at all (no rung, no 💯, no 💀): ` +
          `${share((w) => w > 162 - 100 && w < 100 && !MATCHED[w])}`,
      );
      L.push(
        `  …of which the live shoulder 95-99, one to five wins short of 💯: ` +
          `${share((w) => w >= 95 && w <= 99 && !MATCHED[w])}`,
      );
      for (let w = 95; w < 100; w++)
        if (!MATCHED[w]) L.push(`      ${w} wins: ${share((x) => x === w)}`);
      L.push(
        `  Generic 💯 only, no named rung (100-116 off a rung): ` +
          `${share((w) => w >= 100 && w < CROWN_WINS && !MATCHED[w])}`,
      );
      L.push(
        `      the empty 109-113 band specifically: ${share((w) => w >= 109 && w <= 113)}`,
      );
      L.push(
        `  (${lowestRung} is the lowest named rung; 💀 needs ≤62 wins, i.e. 100 losses.)`,
      );

      const out = L.join("\n");
      console.log(`\n${out}\n`);
      const dir = path.dirname(fileURLToPath(import.meta.url));
      fs.writeFileSync(path.join(dir, "last-run-study11.txt"), `${out}\n`);

      // Structural checks only — the numbers themselves are the deliverable and
      // must be free to move when badges.ts is recalibrated.
      expect(ref).toHaveLength(N_REF);
      expect(base).toHaveLength(N_CTX);
      expect(bc).toHaveLength(N_CTX);
      for (const b of BADGES) expect(out).toContain(b.key);
      for (const a of arms) {
        const binned = a.rows.filter((r) => BUCKETS.some((k) => r.wins >= k.lo && r.wins <= k.hi));
        expect(binned).toHaveLength(a.rows.length);
        // At most one on-field badge per game — the axis is exclusive.
        for (const r of a.rows)
          expect(r.badges.filter((k) => onfield.includes(k)).length).toBeLessThanOrEqual(1);
      }
    },
  );
});

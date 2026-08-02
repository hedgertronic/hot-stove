/** STUDY 13 — the roster-shape distributions three badge decisions turn on.
 *
 * Study 11 measures how often a badge FIRES, which can only be run once the
 * badge is already in BADGES. These three questions are the other kind: they
 * ask what shapes bot play actually produces, so that a threshold can be picked
 * before a definition is written.
 *
 *   1. How many seats hold an 8.0+ WAR season at once — the "how many stars did
 *      you stack" ladder. data/cards puts a hard ceiling of 7 of 8 on this (no
 *      relief season in the set reaches 8.0 and exactly one catcher season
 *      does), so the question the harness answers is where between 0 and 6 the
 *      mass actually sits.
 *   2. The joint distribution of the best-to-worst WAR gap against roster
 *      quality. A tight gap is only worth a badge if tight-gap clubs are not
 *      uniformly bad ones — the objection a "balanced" badge has to answer.
 *   3. Badges per season, which is what PILL_CAP was calibrated against.
 *
 * Reads `Game.slots` at the finale (index-aligned with SLOT_TYPES) rather than
 * the finale's badge list, because the questions are about WAR per SEAT and the
 * finale does not carry the roster.
 *
 * Run: BOT_STUDIES=1 BOT_GAMES=10000 npx vitest run tests/bots/study13-shapes.test.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SLOT_TYPES } from "../../src/lib/types";
import { Game } from "../../src/lib/engine.svelte";
import { ALL_POWERUPS, loadData, playGame, type BotConfig } from "./harness";
import { makeSeeds } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 2000);

interface Shape {
  seed: number;
  /** One entry per slot, in SLOT_TYPES order; null for a seat left empty. */
  wars: (number | null)[];
  badges: string[];
  full: boolean;
  /** Hall of Famers signed, plus one if the skipper is in as a manager. */
  hof: number;
  /** Hall of Fame PLAYERS signed, with no manager contribution. */
  hofPlayers: number;
  /** The hired skipper is in the Hall as a manager. */
  mgrHof: boolean;
  /** Distinct birth countries across the filled seats. */
  countries: number;
  /** What the club is worth before modifiers, and what the season scored. */
  baselineWins: number;
  stampWins: number;
}

const captured: Shape[] = [];

/** Set before each arm so the finale hook can resolve a signing back to its
 * card row — `Signed` carries neither the Hall flag nor a birth country. */
let cardLookup: ((team: string, year: number, id: string) => {
  hof?: boolean;
  bc?: string;
} | null) | null = null;
let managerHofLookup: ((team: string, year: number) => boolean) | null = null;

{
  type FinishFn = (this: Game) => Promise<void>;
  const proto = Game.prototype as unknown as { finishGame: FinishFn };
  const orig = proto.finishGame;
  proto.finishGame = async function wrapped(this: Game): Promise<void> {
    await orig.call(this);
    const f = this.finale;
    if (!f) return;
    const wars = this.slots.map((s) => (s === null ? null : s.war));
    let hof = 0;
    const countries = new Set<string>();
    for (const s of this.slots) {
      if (s === null) continue;
      const row = cardLookup?.(s.team, s.year, s.id) ?? null;
      if (row?.hof === true) hof += 1;
      if (row?.bc) countries.add(row.bc);
    }
    const hofPlayers = hof;
    const mgr = this.manager;
    const mgrHof = mgr !== null && managerHofLookup?.(mgr.team, mgr.year) === true;
    if (mgrHof) hof += 1;
    captured.push({
      seed: this.seed,
      wars,
      badges: f.badges,
      full: wars.every((w) => w !== null),
      hof,
      hofPlayers,
      mgrHof,
      countries: countries.size,
      baselineWins: f.wins,
      // The finale stamp: the points total, rounded and clamped into 0–162,
      // which is what `format.recordFromTotal` prints on screen.
      stampWins: Math.min(Math.max(Math.round(f.parts.total), 0), 162),
    });
  };
}

const pct = (n: number, of: number): number => (100 * n) / of;
const f2 = (x: number): string => x.toFixed(2);
const median = (xs: number[]): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

describe("study 13: roster shapes", () => {
  it(
    `measures roster shape over ${N} reference games`,
    { timeout: 7_200_000 },
    async () => {
      const d = loadData();
      cardLookup = (team, year, id) =>
        (d.cards.get(`${team}_${year}`)?.players.find((p) => p.id === id) as
          | { hof?: boolean; bc?: string }
          | undefined) ?? null;
      managerHofLookup = (team, year) =>
        (d.cards.get(`${team}_${year}`) as { managerHof?: boolean } | undefined)
          ?.managerHof === true;
      const bot: BotConfig = {
        name: "powerups",
        enabled: new Set(ALL_POWERUPS),
        overspend: false,
      };
      const t0 = Date.now();
      const rows: Shape[] = [];
      for (const seed of makeSeeds(N)) {
        captured.length = 0;
        await playGame(seed, bot, d);
        expect(captured).toHaveLength(1);
        rows.push(captured[0]);
      }
      const wall = (Date.now() - t0) / 1000;
      const full = rows.filter((r) => r.full);

      const L: string[] = [];
      L.push("=== Study 13: roster shapes (Clean House + all powerups) ===");
      L.push(`n=${N} games, ${f2(wall)}s wall clock. Full clubs: ${full.length} (${f2(pct(full.length, N))}%).`);
      L.push("");

      // ---- 1. how many seats reach each WAR rung at once ----
      L.push("--- 1. Seats at or above a WAR rung, per club (full clubs only) ---");
      for (const floor of [8.0, 6.0, 4.0]) {
        const counts = full.map(
          (r) => r.wars.filter((w) => w !== null && w >= floor).length,
        );
        L.push(`  floor ${floor.toFixed(1)} WAR:`);
        for (let k = 0; k <= 8; k++) {
          const atLeast = counts.filter((c) => c >= k).length;
          const exactly = counts.filter((c) => c === k).length;
          if (atLeast === 0 && k > 0) break;
          L.push(
            `    >=${k} seats: ${f2(pct(atLeast, full.length)).padStart(7)}%   ` +
              `(exactly ${k}: ${f2(pct(exactly, full.length)).padStart(7)}%)`,
          );
        }
      }
      L.push("");

      // ---- 1b. which seat types actually hold the gold ----
      L.push("--- 1b. Share of clubs whose seat of each type holds an 8.0+ season ---");
      for (let i = 0; i < SLOT_TYPES.length; i++) {
        const hits = full.filter((r) => (r.wars[i] ?? 0) >= 8.0).length;
        L.push(`    slot ${i} (${SLOT_TYPES[i]}): ${f2(pct(hits, full.length)).padStart(7)}%`);
      }
      L.push("");

      // ---- 2. the gap, and what a club at each gap is worth ----
      L.push("--- 2. Best-to-worst WAR gap vs roster quality (full clubs only) ---");
      L.push(
        [
          "gap <=".padEnd(8),
          "share".padStart(8),
          "median roster WAR".padStart(19),
          "median min seat".padStart(17),
          "median max seat".padStart(17),
          "% also >=4.0 floor".padStart(19),
        ].join(" "),
      );
      const stats = full.map((r) => {
        const w = r.wars.filter((x): x is number => x !== null);
        return { gap: Math.max(...w) - Math.min(...w), min: Math.min(...w), max: Math.max(...w), sum: w.reduce((a, b) => a + b, 0) };
      });
      for (const gap of [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]) {
        const hit = stats.filter((s) => s.gap <= gap);
        if (hit.length === 0) {
          L.push(`${String(gap).padEnd(8)}${"0.00".padStart(8)}`);
          continue;
        }
        L.push(
          [
            String(gap).padEnd(8),
            f2(pct(hit.length, full.length)).padStart(8),
            f2(median(hit.map((s) => s.sum))).padStart(19),
            f2(median(hit.map((s) => s.min))).padStart(17),
            f2(median(hit.map((s) => s.max))).padStart(17),
            f2(pct(hit.filter((s) => s.min >= 4.0).length, hit.length)).padStart(19),
          ].join(" "),
        );
      }
      L.push(`  all full clubs: median roster WAR ${f2(median(stats.map((s) => s.sum)))}, median gap ${f2(median(stats.map((s) => s.gap)))}`);
      L.push("");

      // ---- 2b. gap AND a floor together, the version worth a badge ----
      L.push("--- 2b. Gap plus a quality floor: % of full clubs earning both ---");
      L.push(
        ["floor".padEnd(7), ...[2.0, 2.5, 3.0, 3.5, 4.0].map((g) => `gap<=${g}`.padStart(10))].join(" "),
      );
      for (const floor of [2.0, 2.5, 3.0, 3.5, 4.0]) {
        L.push(
          [
            String(floor).padEnd(7),
            ...[2.0, 2.5, 3.0, 3.5, 4.0].map((g) =>
              f2(pct(stats.filter((s) => s.min >= floor && s.gap <= g).length, full.length)).padStart(10),
            ),
          ].join(" "),
        );
      }
      L.push("");

      // ---- 2c. does the gap discriminate INSIDE the 🧱 population? ----
      const noweak = stats.filter((s) => s.min >= 4.0);
      L.push("--- 2c. Inside the 🧱 population (every seat >= 4.0), what the gap adds ---");
      L.push(`  🧱-shaped clubs: ${noweak.length} (${f2(pct(noweak.length, full.length))}% of full clubs)`);
      for (const gap of [2.0, 2.5, 3.0, 3.5, 4.0, 5.0]) {
        const k = noweak.filter((s) => s.gap <= gap).length;
        L.push(`    of those, gap <= ${gap}: ${f2(pct(k, Math.max(1, noweak.length))).padStart(7)}% (${k})`);
      }
      L.push(`  median gap inside 🧱: ${f2(median(noweak.map((s) => s.gap)))}`);
      L.push("");

      // ---- 2d. the stars-and-scrubs shape, for the pairwise check ----
      const topheavy = stats.filter(() => false).length; // placeholder, computed below
      void topheavy;
      const th = full.filter((r) => {
        const w = r.wars.filter((x): x is number => x !== null);
        return w.filter((x) => x >= 6.0).length >= 2 && w.filter((x) => x <= 1.0).length >= 3;
      }).length;
      L.push(`--- 2d. ⛰️ shape (2 seats >=6.0 and 3 seats <=1.0): ${f2(pct(th, full.length))}% of full clubs ---`);
      L.push("");

      // ---- 3. Hall of Famers, and countries of birth ----
      L.push("--- 3. Hall of Famers per club ---");
      L.push(
        "  The skipper's chair is one of the seats the badge counts, and how " +
          "often it holds a Hall of Famer is a property of the ARM's manager " +
          "policy rather than of the badge. Both columns are reported so the " +
          "threshold is not chosen off a number the bot supplies.",
      );
      L.push(
        `  Clubs whose hired skipper is a Hall of Fame manager: ${f2(pct(rows.filter((r) => r.mgrHof).length, N))}%`,
      );
      L.push(
        ["count".padEnd(8), "players only".padStart(14), "with skipper".padStart(14)].join(" "),
      );
      for (let k = 1; k <= 9; k++) {
        const withMgr = rows.filter((r) => r.hof >= k).length;
        const only = rows.filter((r) => r.hofPlayers >= k).length;
        if (withMgr === 0 && only === 0) break;
        L.push(
          [
            `>=${k}`.padEnd(8),
            f2(pct(only, N)).padStart(14),
            f2(pct(withMgr, N)).padStart(14),
          ].join(" "),
        );
      }
      L.push("");
      L.push("--- 4. Distinct birth countries per FULL club (blind play) ---");
      for (let k = 2; k <= 8; k++) {
        const n = full.filter((r) => r.countries >= k).length;
        if (n === 0) break;
        L.push(`    >=${k}: ${f2(pct(n, full.length)).padStart(7)}%   (of all games: ${f2(pct(full.filter((r) => r.countries >= k).length, N)).padStart(7)}%)`);
      }
      L.push("");

      // ---- 5. the two records the on-field ladder reads ----
      L.push("--- 5. Baseline wins vs the stamped record ---");
      L.push(`  median baseline ${f2(median(rows.map((r) => r.baselineWins)))}, median stamp ${f2(median(rows.map((r) => r.stampWins)))}`);
      const floorRate = (
        label: string,
        pick: (r: Shape) => number,
      ): void => {
        const dj = rows.filter((r) => pick(r) <= 0).length;
        const wo = rows.filter((r) => pick(r) > 0 && pick(r) <= 40).length;
        const sk = rows.filter((r) => pick(r) > 40 && 162 - pick(r) >= 100).length;
        const hund = rows.filter((r) => pick(r) >= 100).length;
        L.push(
          `  ${label.padEnd(10)} 👔 ${f2(pct(dj, N)).padStart(6)}%   📉 ${f2(pct(wo, N)).padStart(6)}%   ` +
            `💀 ${f2(pct(sk, N)).padStart(6)}%   💯+ ${f2(pct(hund, N)).padStart(6)}%`,
        );
      };
      floorRate("baseline", (r) => r.baselineWins);
      floorRate("stamp", (r) => r.stampWins);
      L.push(
        "  (💯+ on the stamp is why the TOP of the ladder stays on the baseline.)",
      );
      L.push("");

      // ---- 6. badges per season ----
      L.push("--- 3. Badges per season (PILL_CAP calibration) ---");
      const counts = rows.map((r) => r.badges.length);
      L.push(`  mean ${f2(counts.reduce((a, b) => a + b, 0) / counts.length)}, median ${f2(median(counts))}`);
      for (let k = 0; k <= Math.max(...counts); k++) {
        const n = counts.filter((c) => c === k).length;
        if (n === 0) continue;
        L.push(`    ${String(k).padStart(2)} badges: ${f2(pct(n, N)).padStart(7)}%  (cumulative over cap 4: ${f2(pct(counts.filter((c) => c > 4).length, N))}%)`);
      }
      L.push(`  seasons earning MORE than 4 badges: ${f2(pct(counts.filter((c) => c > 4).length, N))}%`);
      L.push(`  seasons earning MORE than 5 badges: ${f2(pct(counts.filter((c) => c > 5).length, N))}%`);

      const out = L.join("\n");
      console.log(`\n${out}\n`);
      const dir = path.dirname(fileURLToPath(import.meta.url));
      fs.writeFileSync(path.join(dir, "last-run-study13.txt"), `${out}\n`);

      expect(rows).toHaveLength(N);
    },
  );
});

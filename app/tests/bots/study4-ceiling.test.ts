/** STUDY 4 — Is 162 (the goal score) even possible?  Three measurements:
 *  1. Theoretical dataset ceiling (seed-free): exact best legal 8-man roster
 *     over ALL cards maximizing WAR + awards + ring/pennant points (same
 *     144-state DP as src/lib/bestroster.ts, but with pedigree included in
 *     the objective — the shipped solver excludes it on purpose), plus the
 *     dataset's best manager, a maxed payroll bonus, nine ⭐ seats, no tax;
 *     win cap at 162 expected wins honored. Every point value comes from
 *     src/lib/scoring.ts, so the ceiling tracks a balance change.
 *  2. Seed-sweep empirical max: powerups bot, Classic, 5,000 seeds.
 *  3. Blank Check runs: powerups bot at the fat $203.2M fixed cap — isolates
 *     money vs card luck in the remaining gap.
 *
 * Run: npx vitest run tests/bots/study4-ceiling.test.ts
 * Tunables: BOT_SWEEP (default 5000), BOT_GAMES (default 400, study 3 part). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { GameConfig } from "../../src/lib/engine.svelte";
import { eligibleTypes } from "../../src/lib/eligibility";
import {
  AWARD_POINTS,
  BUDGET_BONUS_MAX,
  GAMES,
  MANAGER_PER_NET_WIN,
  REPLACEMENT_WINS,
  SCOUT_HIT_POINTS,
  WBC_CHAMPION_ID,
  WBC_CHAMPION_POINTS,
  WBC_RUNNERUP_ID,
  WBC_RUNNERUP_POINTS,
} from "../../src/lib/scoring";
import type { CardPlayer, SlotType } from "../../src/lib/types";
import {
  ALL_POWERUPS,
  loadData,
  playGame,
  type BotConfig,
  type GameResult,
  type HarnessData,
} from "./harness";
import { f1, makeSeeds, mean, pctl } from "./stats";

const SWEEP = Number(process.env.BOT_SWEEP ?? 5000);
const N = Number(process.env.BOT_GAMES ?? 400);
const BLANK_CHECK_M = 203.2;

const awardPts = (a: string[]): number => a.reduce((s, x) => s + (AWARD_POINTS[x] ?? 0), 0);
// Ring-chasing whole: October's pair plus March's medal — id compared,
// points added, scoring.ts's own two-constant discipline.
const ringPts = (p: { ws: boolean; pen: boolean; wbc?: number }): number =>
  (p.ws ? 3 : p.pen ? 1 : 0) +
  (p.wbc === WBC_CHAMPION_ID
    ? WBC_CHAMPION_POINTS
    : p.wbc === WBC_RUNNERUP_ID
      ? WBC_RUNNERUP_POINTS
      : 0);

interface GodPick {
  p: CardPlayer;
  team: string;
  teamName: string;
  year: number;
  type: SlotType;
}

/** Exact max-value legal roster over the whole dataset. Same DP shape as
 * bestroster.ts (capacities C1 IF2 OF1 FLEX1 SP2 RP1, one season per human)
 * but the objective includes ring/pennant points — the finale scores them,
 * so the true ceiling must too. */
function godSquad(d: HarnessData): { picks: GodPick[]; value: number } {
  const TYPE_ORDER: SlotType[] = ["C", "IF", "OF", "FLEX", "SP", "RP"];
  const CAPACITY = [1, 2, 1, 1, 2, 1];
  const RADIX = CAPACITY.map((c) => c + 1);
  const STATES = RADIX.reduce((a, b) => a * b, 1); // 144

  interface Season {
    pick: GodPick;
    value: number;
    types: number[];
  }
  const groups = new Map<string, Season[]>();
  for (const card of d.cards.values()) {
    for (const p of card.players) {
      const value = p.war + awardPts(p.awards) + ringPts(p);
      if (value <= 0) continue;
      const season: Season = {
        value,
        pick: { p, team: card.team, teamName: card.name, year: card.year, type: "FLEX" },
        types: eligibleTypes(p).map((t) => TYPE_ORDER.indexOf(t)),
      };
      const list = groups.get(p.id);
      if (list) list.push(season);
      else groups.set(p.id, [season]);
    }
  }
  const groupList = [...groups.values()];

  const fill = (state: number, type: number): number => {
    let stride = 1;
    for (let t = 0; t < type; t++) stride *= RADIX[t];
    const used = Math.floor(state / stride) % RADIX[type];
    return used < CAPACITY[type] ? state + stride : -1;
  };

  let dp = new Float64Array(STATES).fill(-1);
  dp[0] = 0;
  const parents: Int32Array[] = [];
  for (const seasons of groupList) {
    const next = Float64Array.from(dp);
    const parent = new Int32Array(STATES).fill(-1);
    for (let s = 0; s < STATES; s++) {
      if (dp[s] < 0) continue;
      for (let si = 0; si < seasons.length; si++) {
        for (const ti of seasons[si].types) {
          const ns = fill(s, ti);
          if (ns < 0) continue;
          const v = dp[s] + seasons[si].value;
          if (v > next[ns]) {
            next[ns] = v;
            parent[ns] = s * 4096 + si * 8 + ti;
          }
        }
      }
    }
    dp = next;
    parents.push(parent);
  }

  let bestState = 0;
  for (let s = 1; s < STATES; s++) if (dp[s] > dp[bestState]) bestState = s;
  const picks: GodPick[] = [];
  let state = bestState;
  for (let gi = groupList.length - 1; gi >= 0; gi--) {
    const packed = parents[gi][state];
    if (packed < 0) continue;
    const si = Math.floor((packed % 4096) / 8);
    picks.push({ ...groupList[gi][si].pick, type: TYPE_ORDER[packed % 8] });
    state = Math.floor(packed / 4096);
  }
  return { picks: picks.reverse(), value: dp[bestState] };
}

describe("study 4: the 162 ceiling", () => {
  it("measures the theoretical and empirical ceilings", { timeout: 600_000 }, async () => {
    const t0 = Date.now();
    const d = loadData();
    const lines: string[] = [];

    // ---- 1. theoretical dataset ceiling ----
    const { picks } = godSquad(d);
    const warSum = picks.reduce((a, g) => a + g.p.war, 0);
    const awards = picks.reduce((a, g) => a + awardPts(g.p.awards), 0);
    const rings = picks.reduce((a, g) => a + ringPts(g.p), 0);
    const cost = picks.reduce((a, g) => a + g.p.cost, 0);
    let bestMgr = { name: "", team: "", year: 0, net: -Infinity };
    for (const c of d.cards.values()) {
      if (c.manager == null) continue;
      if (c.wins - c.losses > bestMgr.net)
        bestMgr = { name: c.manager, team: c.team, year: c.year, net: c.wins - c.losses };
    }
    const mgrWins = bestMgr.net * MANAGER_PER_NET_WIN;
    const expWins = Math.min(REPLACEMENT_WINS + warSum + mgrWins, GAMES);
    const winCapped = REPLACEMENT_WINS + warSum + mgrWins > GAMES;
    // Every term is scoring.ts's own, so this ceiling moves when a balance
    // constant does. Nine is the ⭐ maximum — eight roster seats plus the
    // skipper — which is a roster shape, not a scoring constant, so it stays a
    // literal here rather than widening badges.ts's private DREAM_SEATS.
    const scoutMax = 9 * SCOUT_HIT_POINTS;
    const ceiling = expWins + BUDGET_BONUS_MAX + awards + rings + scoutMax;
    const tax = Math.max(0, cost - BLANK_CHECK_M);
    lines.push("=== Study 4: is 162 possible? ===\n");
    lines.push("[1] THEORETICAL DATASET CEILING (all 1,188 cards, seed-free)");
    for (const g of picks)
      lines.push(
        `  ${g.type.padEnd(4)} ${g.p.name.padEnd(22)} ${g.team} ${g.year}  ` +
          `WAR ${f1(g.p.war).padStart(5)}  $${f1(g.p.cost).padStart(5)}M` +
          `${g.p.awards.length ? "  " + g.p.awards.join(",") : ""}${g.p.ws ? "  💍" : g.p.pen ? "  🚩" : ""}`,
      );
    lines.push(`  MGR  ${bestMgr.name} ${bestMgr.team} ${bestMgr.year}  net +${bestMgr.net} → +${f1(mgrWins)} wins`);
    lines.push(
      `  totals: WAR ${f1(warSum)}, awards ${awards}, rings/pennants ${rings}, ` +
        `expected wins ${f1(expWins)}${winCapped ? " (WIN-CAPPED at 162)" : ""}`,
    );
    lines.push(
      `  ceiling = ${f1(expWins)} wins + ${BUDGET_BONUS_MAX} bonus + ${awards} awards + ${rings} rings + ${f1(scoutMax)} scout = ${f1(ceiling)} pts`,
    );
    lines.push(
      `  roster cost $${f1(cost)}M — ${cost <= BLANK_CHECK_M ? "FITS under Blank Check $203.2M" : `over Blank Check by $${f1(tax)}M → net-of-tax ${f1(ceiling - tax)} pts`}`,
    );

    // ---- 2. seed-sweep empirical max ----
    const bot: BotConfig = { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false };
    const sweepSeeds = makeSeeds(SWEEP);
    const sweep: number[] = [];
    for (const seed of sweepSeeds) sweep.push((await playGame(seed, bot, d)).total);
    const count = (thr: number): number => sweep.filter((x) => x >= thr).length;
    lines.push(`\n[2] SEED SWEEP — powerups bot, Classic, ${SWEEP} seeds`);
    lines.push(
      `  max ${f1(Math.max(...sweep))}, p99 ${f1(pctl(sweep, 0.99))}, p99.9 ${f1(pctl(sweep, 0.999))}, ` +
        `mean ${f1(mean(sweep))}`,
    );
    lines.push(`  games >=150: ${count(150)}   >=155: ${count(155)}   >=162: ${count(162)}`);

    // ---- 3. Blank Check ----
    const BC: GameConfig = { difficulty: "standard", bank: "blankcheck" };
    const bcSeeds = makeSeeds(N);
    const bc: GameResult[] = [];
    for (const seed of bcSeeds) bc.push(await playGame(seed, bot, d, BC));
    const bcT = bc.map((r) => r.total);
    lines.push(`\n[3] BLANK CHECK ($203.2M fixed cap) — powerups bot, ${N} seeds`);
    lines.push(
      `  mean ${f1(mean(bcT))}, med ${f1(pctl(bcT, 0.5))}, p90 ${f1(pctl(bcT, 0.9))}, max ${f1(Math.max(...bcT))}, ` +
        `mean WAR ${f1(mean(bc.map((r) => r.war)))}, mean spend $${f1(mean(bc.map((r) => r.spend)))}M, ` +
        `>=162: ${bcT.filter((x) => x >= 162).length}`,
    );
    lines.push(`\nruntime ${(Date.now() - t0) / 1000}s`);

    const report = lines.join("\n");
    console.log(report);
    fs.writeFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "last-run-study4.txt"),
      report + "\n",
    );

    // Integrity: full roster found; ceiling must dominate everything the bots scored.
    expect(picks).toHaveLength(8);
    expect(ceiling).toBeGreaterThanOrEqual(Math.max(...sweep));
    expect(ceiling).toBeGreaterThanOrEqual(Math.max(...bcT));
    for (const r of bc) expect(r.budget).toBeCloseTo(BLANK_CHECK_M, 5);
    expect(sweep.every((x) => Number.isFinite(x))).toBe(true);
  });
});

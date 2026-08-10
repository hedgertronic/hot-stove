/** STUDY 24 — how much ceiling do the dream solver's shortlists leave behind?
 *
 * bestroster's passes 2 and 3 are shortlist heuristics (REFINE_PAIRS /
 * DOUBLE_PAIRS). This study measures their residual against an ORACLE: for
 * every ordered (owner, ballpark) pair, solve the rest of the pool through
 * the fixed-budget entry point at that pair's exact cap — per-pair, that IS
 * the full sweep + double pass + branch-and-bound the shortlists ration.
 * The unbounded-shortlist run closes every gap (measured 2026-08-10), so
 * whatever this prints is pure shortlist coverage, not λ precision.
 *
 * Why it matters: the gap is OUTSCOUTED's false-positive window. A player
 * whose total lands between the shortlisted ceiling and the oracle's earns
 * beatCeiling, the scout-hit upgrade, and the badge for a club that did not
 * actually beat perfect play. The 24/32 cut shipped with mean 0.9 / max 1.9
 * points on these pools; the old 8/2 cut measured mean 1.8 / max 5.7.
 *
 * The assertions are a regression net at ~2× the shipped residual: a
 * shortlist cut (or a ranking regression in PROBE_LAMBDAS) that widens the
 * window past it fails here rather than shipping silently.
 *
 * Run:      BOT_STUDIES=1 npx vitest run tests/bots/study24-shortlist-gap.test.ts
 * Tunables: GAP_POOLS=<n> (default 60). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bestRoster } from "../../src/lib/bestroster";
import type { Card } from "../../src/lib/types";
import { loadData } from "./harness";

const POOLS = Number(process.env.GAP_POOLS ?? 60);
const SIZE = 12;

describe("study 24: shortlist residual vs the per-pair oracle", () => {
  it(
    `solves ${POOLS} seeded ${SIZE}-card pools both ways`,
    { timeout: 600_000 },
    () => {
      const d = loadData();
      const all = [...d.cards.values()];
      // Deterministic LCG so the pools are the same every run.
      let s = 12345;
      const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x7fffffff);
      const rows: { i: number; got: number; oracle: number; gap: number }[] = [];
      for (let p = 0; p < POOLS; p++) {
        const pool: Card[] = [];
        const used = new Set<number>();
        while (pool.length < SIZE) {
          const k = Math.floor(rnd() * all.length);
          if (!used.has(k)) {
            used.add(k);
            pool.push(all[k]);
          }
        }
        const got = bestRoster(pool);
        let oracle = -Infinity;
        let oseats = 0;
        for (let o = 0; o < SIZE; o++)
          for (let q = 0; q < SIZE; q++) {
            if (o === q) continue;
            const sub = pool.filter((_, j) => j !== o && j !== q);
            const r = bestRoster(sub, {
              fixedBudgetM: pool[o].budget * pool[q].stadiumMult,
            });
            const seats = r.dreamSeats ?? 0;
            if (seats > oseats || (seats === oseats && (r.total ?? -Infinity) > oracle)) {
              oseats = seats;
              oracle = r.total ?? -Infinity;
            }
          }
        // A seat deficit would be a different bug class entirely; flag it as
        // an unmissable gap rather than folding it into the points.
        const gap =
          oseats > (got.dreamSeats ?? 0) ? 99 : +(oracle - (got.total ?? 0)).toFixed(2);
        rows.push({ i: p, got: got.total ?? 0, oracle, gap });
      }
      const bad = rows.filter((r) => r.gap > 0.05);
      const maxGap = Math.max(0, ...bad.map((r) => r.gap));
      const meanGap = bad.length ? bad.reduce((a, r) => a + r.gap, 0) / bad.length : 0;

      const lines = [
        `\n=== Study 24: shortlist residual, ${POOLS} pools of ${SIZE} shipped cards ===`,
        `pools short of the oracle: ${bad.length}/${POOLS}`,
        `gap among those: mean ${meanGap.toFixed(2)}, max ${maxGap.toFixed(2)} pts`,
        ...bad
          .sort((a, b) => b.gap - a.gap)
          .slice(0, 8)
          .map(
            (r) =>
              `  pool ${String(r.i).padStart(3)}  solver ${r.got.toFixed(1).padStart(6)}` +
              `  oracle ${r.oracle.toFixed(1).padStart(6)}  gap ${r.gap.toFixed(1).padStart(4)}`,
          ),
      ];
      const out = lines.join("\n");
      console.log(`${out}\n`);
      const dir = path.dirname(fileURLToPath(import.meta.url));
      fs.writeFileSync(path.join(dir, "last-run-study24.txt"), `${out}\n`);

      // ~2× the shipped residual (mean 0.9 / max 1.9 / 10 pools at 24/32).
      expect(maxGap).toBeLessThanOrEqual(4);
      expect(bad.length).toBeLessThanOrEqual(Math.ceil(POOLS * 0.35));
    },
  );
});

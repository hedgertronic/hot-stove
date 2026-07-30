/** 1:1 port of pipeline/scoring.py — that module is the source of truth.
 * Balance changes happen there first (playtested via pipeline/playtest.py),
 * then get mirrored here. tests/scoring.test.ts holds parity fixtures
 * generated from the Python implementation. */
import { Rng } from "./rng";
import type { ScoreParts } from "./types";

export const REPLACEMENT_WINS = 47.7;
export const GAMES = 162;

export const AWARD_POINTS: Record<string, number> = { MVP: 3, CY: 3, ROY: 2, GG: 1, SS: 1 };
export const RING_POINTS = 2; // per player whose team won the World Series that season
export const PENNANT_POINTS = 1; // per player whose team won the pennant but lost the Series
export const SKIPPER_PER_NET_WIN = 0.1; // hired manager: (team W − team L) × this, negative allowed

export const LUXURY_TAX_PER_M = 1.0;
export const BUDGET_BONUS_MAX = 10.0;

/** Round to 1 decimal, matching Python's round(x, 1). toFixed rounds the true
 * double value (multiplying by 10 first double-rounds: 60.050000000000004×10
 * collapses to exactly 600.5 and would snap the wrong way). Known divergence:
 * doubles that are EXACT 1dp midpoints (fraction .25/.75) round half-up here
 * vs Python's half-even — unreachable from card data, harmless if ever hit. */
export function round1(x: number): number {
  return Number(x.toFixed(1));
}

export function expectedWins(totalWar: number): number {
  return Math.min(REPLACEMENT_WINS + totalWar, GAMES);
}

export function luxuryTax(spendM: number, budgetM: number): number {
  return Math.max(0, spendM - budgetM) * LUXURY_TAX_PER_M;
}

/** Front-office bonus: Price-is-Right with teeth.
 * Linear from −10 (empty payroll) through 0 (half the cap) to +10 (right at the
 * cap); 0 when over (the luxury tax takes it from there). */
export function budgetBonus(spendM: number, budgetM: number): number {
  if (spendM > budgetM || budgetM <= 0) return 0;
  return BUDGET_BONUS_MAX * ((2 * spendM) / budgetM - 1);
}

export function awardPoints(awardLists: string[][]): number {
  let total = 0;
  for (const awards of awardLists) for (const code of awards) total += AWARD_POINTS[code] ?? 0;
  return total;
}

/** Displayed record: game-by-game coin flips at p = expWins/162. Deterministic
 * per rng seed. The score always uses expectedWins; this is just drama.
 * (Uses mulberry32 rather than Python's Mersenne Twister — the record never
 * needs cross-language parity, only cross-device reproducibility.) */
export function simulateSeason(expWins: number, rng: Rng): [number, number] {
  const p = expWins / GAMES;
  let wins = 0;
  for (let g = 0; g < GAMES; g++) if (rng.next() < p) wins++;
  return [wins, GAMES - wins];
}

export function score(args: {
  totalWar: number;
  spendM: number;
  budgetM: number;
  awardLists: string[][];
  rings?: number;
  pennants?: number;
  skipperRecord?: [number, number] | null;
}): ScoreParts {
  const { totalWar, spendM, budgetM, awardLists, rings = 0, pennants = 0, skipperRecord = null } = args;
  const parts: ScoreParts = {
    expectedWins: round1(expectedWins(totalWar)),
    budgetBonus: round1(budgetBonus(spendM, budgetM)),
    awardPoints: awardPoints(awardLists),
    ringPoints: rings * RING_POINTS + pennants * PENNANT_POINTS,
    skipperPoints: skipperRecord
      ? round1((skipperRecord[0] - skipperRecord[1]) * SKIPPER_PER_NET_WIN)
      : 0,
    luxuryTax: round1(luxuryTax(spendM, budgetM)),
    total: 0,
  };
  parts.total = round1(
    parts.expectedWins +
      parts.budgetBonus +
      parts.awardPoints +
      parts.ringPoints +
      parts.skipperPoints -
      parts.luxuryTax,
  );
  return parts;
}

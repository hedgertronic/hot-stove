/** 1:1 port of pipeline/scoring.py — that module is the source of truth.
 * Balance changes happen there first (playtested via pipeline/playtest.py),
 * then get mirrored here. tests/scoring.test.ts holds parity fixtures
 * generated from the Python implementation. */
import type { ScoreParts } from "./types";

export const REPLACEMENT_WINS = 47.7;
export const GAMES = 162;

/** MVP2/CY2 are award-vote runners-up (finished 2nd in their league's ballot). */
export const AWARD_POINTS: Record<string, number> = {
  MVP: 5,
  CY: 4,
  MVP2: 2,
  CY2: 2,
  ROY: 2,
  GG: 1,
  SS: 1,
};
export const RING_POINTS = 2; // per player whose team won the World Series that season
export const PENNANT_POINTS = 1; // per player whose team won the pennant but lost the Series
export const SKIPPER_PER_NET_WIN = 0.1; // hired manager: (team W − team L) × this, negative allowed
export const SCOUT_HIT_POINTS = 1.0; // per drafted player who's in the WAR-optimal roster

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

/** Displayed record: expected wins, rounded. Deliberately deterministic — the
 * headline W–L must match the "Expected wins" ledger row exactly (a simulated
 * record read as a bug: it never reconciled with the visible math). */
export function displayRecord(expWins: number): [number, number] {
  const wins = Math.round(expWins);
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
  scoutHits?: number;
}): ScoreParts {
  const {
    totalWar,
    spendM,
    budgetM,
    awardLists,
    rings = 0,
    pennants = 0,
    skipperRecord = null,
    scoutHits = 0,
  } = args;
  const parts: ScoreParts = {
    expectedWins: round1(expectedWins(totalWar)),
    budgetBonus: round1(budgetBonus(spendM, budgetM)),
    awardPoints: awardPoints(awardLists),
    ringPoints: rings * RING_POINTS + pennants * PENNANT_POINTS,
    skipperPoints: skipperRecord
      ? round1((skipperRecord[0] - skipperRecord[1]) * SKIPPER_PER_NET_WIN)
      : 0,
    scoutBonus: round1(scoutHits * SCOUT_HIT_POINTS),
    luxuryTax: round1(luxuryTax(spendM, budgetM)),
    total: 0,
  };
  parts.total = round1(
    parts.expectedWins +
      parts.budgetBonus +
      parts.awardPoints +
      parts.ringPoints +
      parts.skipperPoints +
      parts.scoutBonus -
      parts.luxuryTax,
  );
  return parts;
}

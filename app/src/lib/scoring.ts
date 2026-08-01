/** 1:1 port of pipeline/scoring.py — that module is the source of truth.
 * Balance changes happen there first (playtested via pipeline/playtest.py),
 * then get mirrored here. tests/scoring.test.ts holds parity fixtures
 * generated from the Python implementation. */
import type { ScoreParts } from "./types";

export const REPLACEMENT_WINS = 50;
export const GAMES = 162;

/** MVP2/CY2 (and 3) are award-vote ballot finishes; AS is an All-Star selection. */
export const AWARD_POINTS: Record<string, number> = {
  MVP: 3,
  CY: 3,
  MVP2: 2,
  CY2: 2,
  MVP3: 1,
  CY3: 1,
  ROY: 2,
  AS: 1,
  GG: 1,
  SS: 1,
};
export const RING_POINTS = 3; // per player whose team won the World Series that season
export const PENNANT_POINTS = 1; // per player whose team won the pennant but lost the Series
export const MANAGER_PER_NET_WIN = 0.2; // hired manager: (team W − team L) × this, in WINS
/** Hired manager won the BBWAA Manager of the Year that season. Hardware, not
 * wins: it joins the awardPoints (trophy case) sum, never the managerWins term. */
export const MANAGER_MOTY_POINTS = 2;
export const SCOUT_HIT_POINTS = 1.0; // per drafted pick who's in the dream team

export const LUXURY_TAX_PER_M = 1.0;
export const BUDGET_BONUS_MAX = 10.0;

/** The season is 162 games; a perfect draft chases 162 points. */
export const GOAL_POINTS = 162;
/** 2001 Mariners — the wins record the finale calls out when beaten. */
export const MARINERS_WINS = 116;

/** Round to 1 decimal, matching Python's round(x, 1). toFixed rounds the true
 * double value (multiplying by 10 first double-rounds: 60.050000000000004×10
 * collapses to exactly 600.5 and would snap the wrong way). Known divergence:
 * doubles that are EXACT 1dp midpoints (fraction .25/.75) round half-up here
 * vs Python's half-even — unreachable from card data, harmless if ever hit. */
export function round1(x: number): number {
  return Number(x.toFixed(1));
}

/** Manager folds into the win total (not a separate points row). */
export function expectedWins(totalWar: number, managerWins = 0): number {
  return Math.min(REPLACEMENT_WINS + totalWar + managerWins, GAMES);
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
  managerRecord?: [number, number] | null;
  scoutHits?: number;
  managerMoty?: boolean;
}): ScoreParts {
  const {
    totalWar,
    spendM,
    budgetM,
    awardLists,
    rings = 0,
    pennants = 0,
    managerRecord = null,
    scoutHits = 0,
    managerMoty = false,
  } = args;
  const mw = managerRecord ? (managerRecord[0] - managerRecord[1]) * MANAGER_PER_NET_WIN : 0;
  const parts: ScoreParts = {
    expectedWins: round1(expectedWins(totalWar, mw)),
    managerWins: round1(mw),
    budgetBonus: round1(budgetBonus(spendM, budgetM)),
    // The skipper's MotY is hardware like any player award — trophy case.
    awardPoints: awardPoints(awardLists) + (managerMoty ? MANAGER_MOTY_POINTS : 0),
    ringPoints: rings * RING_POINTS + pennants * PENNANT_POINTS,
    scoutBonus: round1(scoutHits * SCOUT_HIT_POINTS),
    luxuryTax: round1(luxuryTax(spendM, budgetM)),
    total: 0,
  };
  parts.total = round1(
    parts.expectedWins +
      parts.budgetBonus +
      parts.awardPoints +
      parts.ringPoints +
      parts.scoutBonus -
      parts.luxuryTax,
  );
  return parts;
}

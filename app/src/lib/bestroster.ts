/** Score-optimal club from the cards a game actually spun — the finale's
 * "best possible squad" yardstick. The objective is WAR + award points +
 * ring/pennant points (the same 1-point-per-win weighting score() uses), so
 * an MVP season or a championship teammate can out-rank a slightly higher
 * plain WAR — you can see a champion's 💍 coming when the card is in front
 * of you. Money is ignored on purpose: the yardstick answers "did you spot
 * the value?", not "could you afford it?".
 *
 * Three rules shape a legal dream club, and all three are solved together:
 *
 * 1. ONE PICK PER CARD. A spin lands on one team-season and buys one thing —
 *    a player OR the skipper, never both. So the yardstick is a roster the
 *    player could genuinely have drafted, not five 1998 Yankees off a single
 *    card.
 * 2. ONE SEASON PER HUMAN. The same B-R id may fill only one seat, the same
 *    rule the draft enforces. A human can appear on several cards (a midseason
 *    trade, or two spun years of one franchise), so this does not fall out of
 *    rule 1 for free.
 * 3. SLOT CAPACITY. C1 IF2 OF1 FLEX1 SP2 RP1, plus one manager seat.
 *
 * The manager is folded in as a seventh slot type worth (W − L) × 0.2 +
 * (Manager of the Year ? 2 : 0) — the skipper's full score value, in the same
 * 1-point-per-win units as everything else. He is solved jointly with the
 * roster because he consumes a card: hiring the best skipper greedily and
 * filling the roster from what's left is not optimal, and neither is the
 * reverse. The manager seat is REQUIRED whenever any spun card offers a
 * skipper, because the game requires one too (Game.complete). That means a
 * card is spent on the dugout even when every available skipper carries
 * negative value — a manager-less roster could score higher, but the player
 * was never allowed to build one, so the yardstick doesn't either.
 *
 * Solve shape: a DP over cards (choose at most one candidate per card) across
 * the 2·3·2·2·3·2·2 = 288 capacity states. That DP enforces rules 1 and 3
 * exactly but relaxes rule 2, so its value is an upper bound. Conflict-driven
 * branch and bound closes the gap: when a solution seats one human twice off
 * cards A and B, branch on forbidding him on A / forbidding him on B — every
 * legal club lies in one branch or the other — and prune any node whose relaxed
 * value can't beat the best legal club found so far. Deterministic throughout:
 * stable iteration order, strict-improvement updates, and a fixed branch order,
 * so ties always resolve the same way on every device. */
import { eligibleTypes } from "./eligibility";
import {
  AWARD_POINTS,
  MANAGER_MOTY_POINTS,
  MANAGER_PER_NET_WIN,
  PENNANT_POINTS,
  RING_POINTS,
} from "./scoring";
import type { Card, SlotType } from "./types";

export interface BestPick {
  id: string;
  name: string;
  pos: string;
  war: number;
  year: number;
  team: string;
  teamName: string;
  ws: boolean;
  pen: boolean;
  awards: string[];
}

/** The dream club's skipper — the same shape the finale renders for the hired
 * manager, so a hit is a straight team+year comparison. */
export interface BestManagerPick {
  name: string;
  team: string;
  year: number;
  teamName: string;
  ws: boolean;
  pen: boolean;
  netWins: number;
  moty: boolean;
}

export interface BestRoster {
  /** One entry per roster slot, SLOT_TYPES order (null = best play is empty). */
  picks: (BestPick | null)[];
  totalWar: number;
  /** Optional so hand-built lab fixtures stay valid; the solver always sets it
   * (null only when no spun card carried a manager). */
  manager?: BestManagerPick | null;
  /** Seats the dream club actually occupies — filled roster slots plus the
   * skipper. This is the honest ⭐ denominator: with one pick per card, a game
   * that spun only 8 cards can never show 9 seats, so a fixed 8-or-9 would
   * advertise a target nobody could hit. Optional for the same fixture reason
   * as `manager`; the solver always sets it. */
  dreamSeats?: number;
}

const TYPE_ORDER: SlotType[] = ["C", "IF", "OF", "FLEX", "SP", "RP"];
/** Seventh type: the dugout. One seat, filled by a card's skipper. */
const MGR_TYPE = 6;
const CAPACITY = [1, 2, 1, 1, 2, 1, 1];
/** Roster-rail slot index for the nth filled seat of each type. */
const SLOT_INDICES: Record<SlotType, number[]> = {
  C: [0],
  IF: [1, 2],
  OF: [3],
  FLEX: [4],
  SP: [5, 6],
  RP: [7],
};

/** One thing a single card can supply: a player in one slot type, or the
 * skipper. `value` is what the DP maximizes; `playerId` is null for a manager
 * (skippers never collide with the one-season-per-human rule). */
interface Candidate {
  type: number;
  value: number;
  playerId: string | null;
  pick: BestPick | null;
  manager: BestManagerPick | null;
}

interface Chosen {
  card: number;
  cand: Candidate;
}

interface Relaxed {
  value: number;
  chosen: Chosen[];
}

const awardPts = (awards: string[]): number =>
  awards.reduce((sum, a) => sum + (AWARD_POINTS[a] ?? 0), 0);

const RADIX = CAPACITY.map((c) => c + 1);
const STATES = RADIX.reduce((a, b) => a * b, 1); // 288
/** Digit weight of the manager seat: states at or above it have him hired. */
const MGR_STRIDE = STATES / RADIX[MGR_TYPE]; // 144

/** Ceiling on branch-and-bound nodes. Conflicts need one human seated twice in
 * an otherwise-optimal club, so real games settle in a handful of nodes; the cap
 * only bounds a pathological card set. If it ever binds, the answer is the best
 * LEGAL club found so far — feasible and deterministic, but not proven optimal. */
const MAX_NODES = 2000;

function fill(state: number, type: number): number {
  let stride = 1;
  for (let t = 0; t < type; t++) stride *= RADIX[t];
  const used = Math.floor(state / stride) % RADIX[type];
  return used < CAPACITY[type] ? state + stride : -1;
}

/** Every candidate one card can supply, in stable order: its players (each
 * eligible slot type) then its skipper. Non-positive player seasons are dropped
 * — they can never improve a value-max roster — but a card whose players all
 * drop is still worth keeping for its manager. */
function cardCandidates(card: Card): Candidate[] {
  const cands: Candidate[] = [];
  for (const p of card.players) {
    const value =
      p.war +
      awardPts(p.awards) +
      (p.ws ? RING_POINTS : 0) +
      (p.pen ? PENNANT_POINTS : 0);
    if (value <= 0) continue;
    const pick: BestPick = {
      id: p.id,
      name: p.name,
      pos: p.pos,
      war: p.war,
      year: card.year,
      team: card.team,
      teamName: card.name,
      ws: p.ws,
      pen: p.pen,
      awards: p.awards,
    };
    for (const t of eligibleTypes(p))
      cands.push({
        type: TYPE_ORDER.indexOf(t),
        value,
        playerId: p.id,
        pick,
        manager: null,
      });
  }
  if (card.manager != null) {
    const netWins = card.wins - card.losses;
    const moty = card.managerMoty === true;
    cands.push({
      type: MGR_TYPE,
      value: netWins * MANAGER_PER_NET_WIN + (moty ? MANAGER_MOTY_POINTS : 0),
      playerId: null,
      pick: null,
      manager: {
        name: card.manager,
        team: card.team,
        year: card.year,
        teamName: card.name,
        ws: card.ws,
        pen: card.pen,
        netWins,
        moty,
      },
    });
  }
  return cands;
}

/** Best club under rules 1 and 3 only (one pick per card, slot capacity), with
 * `forbidden[c]` naming players this branch has barred from card c. Since a card
 * yields at most one pick, only its highest-value candidate per slot type can
 * ever be used — collapsing to that keeps each card's option list at seven. */
function solveRelaxed(
  cardCands: Candidate[][],
  forbidden: Set<string>[],
  forceManager: boolean,
): Relaxed | null {
  const options: Candidate[][] = cardCands.map((cands, c) => {
    const byType: (Candidate | null)[] = Array(CAPACITY.length).fill(null);
    for (const cand of cands) {
      if (cand.playerId !== null && forbidden[c].has(cand.playerId)) continue;
      const cur = byType[cand.type];
      if (cur === null || cand.value > cur.value) byType[cand.type] = cand;
    }
    return byType.filter((x): x is Candidate => x !== null);
  });

  let dp = new Float64Array(STATES).fill(-Infinity);
  dp[0] = 0;
  const fromState: Int32Array[] = [];
  const fromOpt: Int32Array[] = [];
  for (let c = 0; c < options.length; c++) {
    // Carrying dp forward is the "skip this card" move; its states keep a -1
    // parent, which the unwind reads as "this card supplied nothing".
    const next = Float64Array.from(dp);
    const prevState = new Int32Array(STATES).fill(-1);
    const prevOpt = new Int32Array(STATES).fill(-1);
    for (let s = 0; s < STATES; s++) {
      if (dp[s] === -Infinity) continue;
      for (let oi = 0; oi < options[c].length; oi++) {
        const cand = options[c][oi];
        const ns = fill(s, cand.type);
        if (ns < 0) continue;
        const v = dp[s] + cand.value;
        if (v > next[ns]) {
          next[ns] = v;
          prevState[ns] = s;
          prevOpt[ns] = oi;
        }
      }
    }
    dp = next;
    fromState.push(prevState);
    fromOpt.push(prevOpt);
  }

  const first = forceManager ? MGR_STRIDE : 0;
  let bestState = -1;
  for (let s = first; s < STATES; s++)
    if (dp[s] !== -Infinity && (bestState < 0 || dp[s] > dp[bestState])) bestState = s;
  if (bestState < 0) return null; // no legal club (only when a manager is required and none exists)

  const chosen: Chosen[] = [];
  let state = bestState;
  for (let c = options.length - 1; c >= 0; c--) {
    const oi = fromOpt[c][state];
    if (oi < 0) continue; // card skipped, state predates it — walk on unchanged
    chosen.push({ card: c, cand: options[c][oi] });
    state = fromState[c][state];
  }
  chosen.reverse(); // card-ascending, so conflict scans are stable
  return { value: dp[bestState], chosen };
}

/** The first human seated twice, as [id, earlier card, later card]. Managers
 * carry no id and never conflict. */
function findConflict(chosen: Chosen[]): [string, number, number] | null {
  const seen = new Map<string, number>();
  for (const { card, cand } of chosen) {
    if (cand.playerId === null) continue;
    const prior = seen.get(cand.playerId);
    if (prior !== undefined) return [cand.playerId, prior, card];
    seen.set(cand.playerId, card);
  }
  return null;
}

/** Drop every repeat seating of a human, keeping his earliest card — a legal
 * club, used to seed the search so a feasible answer always exists. */
function repair(chosen: Chosen[]): Chosen[] {
  const used = new Set<string>();
  const kept: Chosen[] = [];
  for (const c of chosen) {
    if (c.cand.playerId !== null) {
      if (used.has(c.cand.playerId)) continue;
      used.add(c.cand.playerId);
    }
    kept.push(c);
  }
  return kept;
}

const totalValue = (chosen: Chosen[]): number =>
  chosen.reduce((sum, c) => sum + c.cand.value, 0);

export function bestRoster(cards: Card[]): BestRoster {
  // One card per team-season: a reel that lands twice on the same card still
  // only ever offered one choice from it.
  const unique: Card[] = [];
  const keys = new Set<string>();
  for (const card of cards) {
    const key = `${card.team}|${card.year}`;
    if (keys.has(key)) continue;
    keys.add(key);
    unique.push(card);
  }

  const cardCands = unique.map(cardCandidates);
  const forceManager = cardCands.some((cs) => cs.some((c) => c.type === MGR_TYPE));
  const empty = unique.map(() => new Set<string>());

  let bestChosen: Chosen[] = [];
  let bestValue = -Infinity;
  const root = solveRelaxed(cardCands, empty, forceManager);
  if (root !== null) {
    bestChosen = repair(root.chosen);
    bestValue = totalValue(bestChosen);
  }

  let nodes = 0;
  const search = (forbidden: Set<string>[]): void => {
    if (nodes >= MAX_NODES) return;
    nodes++;
    const r = solveRelaxed(cardCands, forbidden, forceManager);
    if (r === null) return;
    if (r.value <= bestValue) return; // relaxation is an upper bound: nothing to find here
    const conflict = findConflict(r.chosen);
    if (conflict === null) {
      bestChosen = r.chosen; // legal, and strictly better than the incumbent
      bestValue = r.value;
      return;
    }
    const [id, a, b] = conflict;
    for (const c of [a, b]) {
      const nf = forbidden.map((s) => new Set(s));
      nf[c].add(id);
      search(nf);
    }
  };
  if (root !== null) search(empty);

  const picks: (BestPick | null)[] = Array(8).fill(null);
  let manager: BestManagerPick | null = null;
  const players = bestChosen.filter((c) => c.cand.pick !== null);
  for (const c of bestChosen) if (c.cand.manager !== null) manager = c.cand.manager;
  const seats: Record<number, number> = {};
  for (const { cand } of players.sort((a, b) => b.cand.pick!.war - a.cand.pick!.war)) {
    const seat = seats[cand.type] ?? 0;
    seats[cand.type] = seat + 1;
    picks[SLOT_INDICES[TYPE_ORDER[cand.type]][seat]] = cand.pick;
  }
  // dp holds value (WAR + awards + pedigree); the reported total stays pure WAR.
  const totalWar = players.reduce((sum, c) => sum + c.cand.pick!.war, 0);
  const dreamSeats = players.length + (manager !== null ? 1 : 0);
  return { picks, totalWar: Math.round(totalWar * 10) / 10, manager, dreamSeats };
}

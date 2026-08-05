/** Headless bot harness — plays full Hot Stove games through the REAL engine
 * (src/lib/engine.svelte.ts) with heuristic policies, to measure how much
 * powerup play improves outcomes over a no-powerup baseline.
 *
 * Read-only over the app: the engine is imported as-is; the data layer is
 * stubbed at the fetch boundary to serve the repo's data/ JSON from disk.
 * Entry point: tests/bots/powerup-bots.test.ts (`npx vitest run` that file).
 *
 * Design note on "knowledge": the bots consult precomputed summaries of the
 * card set (best player per slot per card, budgets, manager records) when
 * aiming Season Ticket / Relocate / Prime Time. That stands in for the
 * baseball knowledge a human player brings ("the 1998 Yankees were good"),
 * which is exactly the skill those powerups are designed to reward. The
 * per-spin RNG walk is never peeked at — bots see only the landed card. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bestRoster } from "../../src/lib/bestroster";
import * as engineModule from "../../src/lib/engine.svelte";
import { DEFAULT_CONFIG, Game, SLOT_TYPES } from "../../src/lib/engine.svelte";
import type { GameConfig, PowerupKey, SpecialKey, Signed } from "../../src/lib/engine.svelte";

/** 🏠 Homegrown's repriced sticker. Read defensively — the powerup's
 * presentation is being reworked and the constant may move again; the engine
 * clamps to min(flat, listed) either way. */
const HG_FLAT: number =
  typeof (engineModule as Record<string, unknown>).HOMEGROWN_PRICE_M === "number"
    ? ((engineModule as Record<string, unknown>).HOMEGROWN_PRICE_M as number)
    : 1.0;
const hgPrice = (p: { cost: number }): number => Math.min(HG_FLAT, p.cost);
import { eligibleTypes } from "../../src/lib/eligibility";
import { AWARD_POINTS } from "../../src/lib/scoring";
import type {
  Card,
  CardPlayer,
  GameIndex,
  Meta,
  Owners,
  PlayerSeasons,
  SlotType,
  SpecialsIndex,
} from "../../src/lib/types";

// ---------------------------------------------------------------------------
// Node stubs: the engine touches localStorage (save/restore) and fetch (cards,
// specials). Same shape engine.test.ts uses, but fetch serves real files.
// ---------------------------------------------------------------------------

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const DATA_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..", "data");

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_ROOT, rel), "utf8")) as T;
}

// ---------------------------------------------------------------------------
// Data preload + precomputed knowledge
// ---------------------------------------------------------------------------

/** Score points a player season is worth beyond money: WAR (1 pt/win) +
 * award points + ring/pennant points. */
const awardPts = (a: string[]): number => a.reduce((s, x) => s + (AWARD_POINTS[x] ?? 0), 0);
const ringPts = (ws: boolean, pen: boolean): number => (ws ? 3 : pen ? 1 : 0);
const playerPts = (p: { war: number; awards: string[]; ws: boolean; pen: boolean }): number =>
  p.war + awardPts(p.awards) + ringPts(p.ws, p.pen);

const TYPE_SET: SlotType[] = ["C", "IF", "OF", "FLEX", "SP", "RP"];

interface SlotBest {
  pts: number;
  cost: number;
}

/** Per-card summary the bots use as "baseball knowledge" when aiming rerolls. */
interface CardSummary {
  team: string;
  year: number;
  budget: number;
  mult: number;
  /** (W − L) × 0.1, null when the card lists no manager. */
  mgrPts: number | null;
  /** Best (WAR+awards+rings) player per slot type, cost ≤ AFFORD_CAP. */
  bestBySlot: Partial<Record<SlotType, SlotBest>>;
}

export interface HarnessData {
  meta: Meta;
  index: GameIndex;
  owners: Owners;
  cards: Map<string, Card>;
  players: PlayerSeasons;
  specials: SpecialsIndex;
  /** `${playerId}|${team}_${year}` → that season's CardPlayer (for Prime Time). */
  seasons: Map<string, CardPlayer>;
  summaries: Map<string, CardSummary>;
  /** Expected best available (WAR+awards+rings) per slot type on a random card
   * — the opportunity cost of burning that seat now. */
  seatEV: Record<SlotType, number>;
  /** Mean of max(0, manager points) — what "wait for a good manager" is worth. */
  mgrEV: number;
  meanBudget: number;
  /** Shipped per-card budgets, for restoring after applyBudgets(). */
  shippedBudgets: Map<string, number>;
}

let cached: HarnessData | null = null;

export function loadData(): HarnessData {
  if (cached) return cached;
  const meta = readJson<Meta>("meta.json");
  const index = readJson<GameIndex>("index.json");
  const owners = readJson<Owners>("owners.json");
  const players = readJson<PlayerSeasons>("players.json");
  const specials = readJson<SpecialsIndex>("specials.json");

  const cards = new Map<string, Card>();
  const seasons = new Map<string, CardPlayer>();
  const summaries = new Map<string, CardSummary>();
  const bestLists: Record<SlotType, number[]> = { C: [], IF: [], OF: [], FLEX: [], SP: [], RP: [] };
  const mgrList: number[] = [];
  const budgets: number[] = [];

  for (const e of index.cards) {
    const key = `${e.team}_${e.year}`;
    const card = readJson<Card>(`cards/${key}.json`);
    cards.set(key, card);
    budgets.push(card.budget);
    const bestBySlot: Partial<Record<SlotType, SlotBest>> = {};
    for (const p of card.players) {
      seasons.set(`${p.id}|${key}`, p);
      if (p.war < 0 || p.cost > AFFORD_CAP) continue; // matches the engine's visibility, roughly
      const pts = playerPts(p);
      for (const t of eligibleTypes(p)) {
        const cur = bestBySlot[t];
        if (!cur || pts > cur.pts) bestBySlot[t] = { pts, cost: p.cost };
      }
    }
    const mgrPts = card.manager == null ? null : (card.wins - card.losses) * 0.1;
    if (mgrPts != null) mgrList.push(Math.max(0, mgrPts));
    summaries.set(key, {
      team: e.team,
      year: e.year,
      budget: card.budget,
      mult: card.stadiumMult,
      mgrPts,
      bestBySlot,
    });
    for (const t of TYPE_SET) bestLists[t].push(bestBySlot[t]?.pts ?? 0);
  }

  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const seatEV = Object.fromEntries(TYPE_SET.map((t) => [t, mean(bestLists[t])])) as Record<
    SlotType,
    number
  >;

  // Serve the engine's fetch calls (loadCard, loadSpecials) from the maps.
  (globalThis as Record<string, unknown>).fetch = async (url: unknown) => {
    const s = String(url);
    if (s.endsWith("data/specials.json")) return { ok: true, json: async () => specials };
    if (s.endsWith("data/players.json")) return { ok: true, json: async () => players };
    const m = s.match(/cards\/([A-Z0-9]+_\d{4})\.json$/);
    const c = m ? cards.get(m[1]) : undefined;
    return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
  };

  cached = {
    meta,
    index,
    owners,
    cards,
    players,
    specials,
    seasons,
    summaries,
    seatEV,
    mgrEV: mean(mgrList),
    meanBudget: mean(budgets),
    shippedBudgets: new Map([...cards.entries()].map(([k, c]) => [k, c.budget])),
  };
  return cached;
}

const round1 = (x: number): number => Number(x.toFixed(1));

/** Restore every card's bankroll to the shipped budgets. The `gamma` parameter
 * is a vestige of study 2's power-curve rescaling, which needed the raw budget
 * sums that the shipped cards no longer carry; it keeps the signature the
 * (skipped) study compiles against, and every call restores shipped numbers. */
export function applyBudgets(d: HarnessData, gamma: number | null): void {
  const budgets: number[] = [];
  for (const [key, card] of d.cards) {
    const b = d.shippedBudgets.get(key)!;
    card.budget = b;
    d.summaries.get(key)!.budget = b;
    budgets.push(b);
  }
  d.meanBudget = budgets.reduce((a, x) => a + x, 0) / budgets.length;
}

// ---------------------------------------------------------------------------
// Policy constants (all in finale points unless noted)
// ---------------------------------------------------------------------------

/** Points per $M of cap headroom: stars run ~5 WAR / $20M (≈0.25 WAR/$M), and
 * unspent headroom still earns payroll bonus — 0.2 splits the difference. */
const MONEY_PT = 0.2;
/** $M reserve assumed per unfilled roster seat (mean cheapest signable ≈ 1.05). */
const CHEAP_FILL = 1.2;
/** Cost ceiling used when precomputing "best per slot" card summaries. */
const AFFORD_CAP = 30;
/** Half the payroll-bonus slope (full slope is 20/cap per $M): under-cap
 * spending earns bonus, but money kept can also buy WAR later — half credit. */
const SLOPE = 10;
/** One-shot powerups carry option value; a use must beat the alternatives by
 * at least this much before the bot burns it. */
const OPT_PRIME = 2.0;
const OPT_TD = 2.0;
/** Homegrown must clear a high bar: savings only matter when the freed cap
 * room actually gets spent, and the bots usually finish under cap. */
const OPT_HG = 3.0;
/** Both Double Play picks must be worth at least this net — a double commit
 * sees one fewer card over the whole game, so the card must be exceptional. */
const DP_MIN = 3.0;
/** Homegrown only fires when the discount saves at least this many $M. */
const HG_MIN_SAVE = 8;
/** A landed card offering this much net is never rerolled away. */
const REROLL_KEEP = 1.5;
/** Reroll target must beat the current card by at least this much. */
const REROLL_MIN_GAIN = 2.5;
/** Payroll bonus forfeited when a taxed roster first crosses the cap
 * (a legal roster would have banked ~8 of the 10 available). */
const OVER_BONUS_LOSS = 8;
/** When no owner is hired yet, plan against a slightly conservative league-
 * average bankroll. */
const CAP_SAFETY = 0.95;

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

/** Payroll-bonus rule the bot plays toward (Study 3 — the scoring itself is
 * rescored post-hoc; this steers the in-game economics):
 *  - "current": Price-is-Right — spending toward the cap earns bonus, so
 *    under-cap spend gets the half-slope credit (SLOPE/cap per $M).
 *  - "thrift": +1 per $2M left under budget, capped +10 — the bonus slope
 *    only exists inside the last $20M below the cap, so spend is charged
 *    half the true 0.5/$M slope on the portion falling in that region
 *    (spending below cap−$20M forfeits nothing).
 *  - "none": money is neutral under the cap (feasibility gate only).
 * Bank-size valuation (MONEY_PT on owner picks/rerolls) stays common across
 * variants — a deliberate simplification, noted in the study report. */
export type EconVariant = "current" | "thrift" | "none";

/** Expert-bot refinements over the standard heuristics (Study 8):
 *  - "slope":  end-state-exact payroll-bonus marginal — the spend credit
 *    ramps from half-slope to the full 20/cap as seats fill (money held
 *    late has nowhere else to go).
 *  - "decay":  option costs on one-shot powerups decay as the club nears
 *    completion (an unspent powerup at the finale is wasted money).
 *  - "depth":  reroll appraisal counts the target card's depth (best +
 *    0.4 × second-best candidate).
 *  - "jackpot": rerolls fire on any gain ≥ 3 even from a decent card.
 *  - "hgdp":   Homegrown savings valued at the tight-cap rate (0.25/$M) and
 *    Homegrown signs are eligible Double Play picks.
 *  - "chase":  perfect-season hunting — when the game is pacing elite
 *    (projected final total ≥ CHASE_BAR from own roster + public seat EVs;
 *    no hidden information), award/ring points get 1.5× weight in every
 *    player decision. Variance-seeking: built for the ≥162 tail, not the mean.
 * Study 8 selects the subset that actually helps via paired solo runs. */
export type ExpertFeature = "slope" | "decay" | "depth" | "jackpot" | "hgdp" | "chase";
export const EXPERT_FEATURES: ExpertFeature[] = [
  "slope",
  "decay",
  "depth",
  "jackpot",
  "hgdp",
  "chase",
];

export interface BotConfig {
  name: string;
  /** Powerups this bot is allowed to use (empty set = vanilla baseline). */
  enabled: Set<PowerupKey>;
  /** Overspend mode: cross the cap when the WAR gained outruns tax + lost
   * bonus, instead of treating the cap as a hard feasibility gate. */
  overspend: boolean;
  /** Payroll-bonus economics the bot optimizes for (default "current"). */
  econ?: EconVariant;
  /** Manager multiplier M the POLICY believes: manager hires and TD/Prime
   * manager decisions value (W−L)×M (default 0.1, the shipped rule). The
   * engine still scores at 0.1 — studies rescore post-hoc with the same M. */
  mgrMult?: number;
  /** Front-office tiles ⭐ Prime Time may target (Study 9 rule variants).
   * Default: manager only — the shipped rule since the Round 17 ban. The
   * engine no longer accepts owner/stadium primes, so listing them here is
   * inert; `[]` (players-only) is the one variant still simulable. */
  primeSpecials?: SpecialKey[];
  /** Expert refinements in force (undefined/empty = standard heuristics). */
  expert?: Set<ExpertFeature>;
}

const mgrM = (cfg: BotConfig): number => cfg.mgrMult ?? 0.1;
/** d.mgrEV is stored at the shipped 0.1 rate; rescale linearly for M. */
const mgrEVAt = (d: HarnessData, cfg: BotConfig): number => d.mgrEV * (mgrM(cfg) / 0.1);
const hasExpert = (cfg: BotConfig, f: ExpertFeature): boolean => cfg.expert?.has(f) === true;

export const ALL_POWERUPS: PowerupKey[] = [
  "seasonTicket",
  "relocate",
  "doublePlay",
  "tradeDeadline",
  "prime",
  "hometown",
];

export interface GameResult {
  seed: number;
  total: number;
  war: number;
  spend: number;
  budget: number;
  bonus: number;
  tax: number;
  expectedWins: number;
  /** ⭐ hits — the COUNT of dream-team seats the bot filled, not the points
   * they paid. Every study reads it as a count (the 🔮 threshold is a count,
   * and so is the ⭐ denominator), and a count is the quantity that keeps
   * meaning the same thing when SCOUT_HIT_POINTS moves. */
  scout: number;
  spins: number;
  /** Hired manager's (W − L) — for post-hoc manager-multiplier studies. */
  mgrNet: number;
  spent: Record<PowerupKey, boolean>;
  /** Reroll (Season Ticket / Relocate) uses, and how many landed on a card
   * with a bigger bankroll than the one rerolled away (bank-shopping). */
  rerolls: number;
  rerollsRicher: number;
  /** Distinct cards the reel landed on — the dream solver's whole card pool. */
  seenCount: number;
  /** Commitments the finished club made (roster + skipper + front office). */
  commitments: number;
  /** Commitments beyond the first taken off a single card — what ✌️ Double
   * Play buys, and the one way a club outruns one-pick-per-card. */
  extraPerCard: number;
  /** Signings whose season came off a card the reel never landed on (⭐ Prime
   * Time reaching outside the pool). */
  offPoolPicks: number;
  /** Best possible total the solver proved reachable, and its record. */
  ceiling: number | null;
  ceilingRecord: string | null;
  /** True when the ceiling had to fall back on the club actually built
   * (the solver's own search found nothing better). */
  ceilingIsAchieved: boolean;
  /** The solver's own answer, BEFORE the finale clamps it up to the club the
   * player actually built — the number that says whether the search is strong
   * enough to be interesting. */
  solverTotal: number | null;
  /** Wall time of one dream solve, ms (the finale's own call, replayed). */
  solveMs: number;
  /** The dream club's payroll and cap, for the over-budget question. */
  dreamSpend: number;
  dreamBudget: number;
  dreamSeats: number;
  /** The dream club seats the ⭐ Prime Time season the reel never showed. */
  dreamUsesOffReel: boolean;
  /** Best total the solver could reach WITHOUT crossing the cap — the control
   * for "does it ever pay to go over?" (null when not measured). */
  dreamUnderCap: number | null;
  /** What each spent powerup was spent ON (allocation shifts, Study 7). */
  uses: UseCounts;
  /** When Prime bought an owner: chosen year's bank − landed tile's bank. */
  primeOwnerGain: number | null;
}

export interface UseCounts {
  tdPlayer: number;
  tdManager: number;
  tdOther: number;
  primePlayer: number;
  primeManager: number;
  primeOwner: number;
  primeStadium: number;
  /** primeOwner + primeStadium (kept for earlier studies' reports). */
  primeOther: number;
  hgSigns: number;
}

/** Per-game instrumentation threaded through the decision loop. */
interface Track extends UseCounts {
  rerolls: number;
  rerollsRicher: number;
  /** When Prime bought an owner: chosen year's bank − the landed tile's bank. */
  primeOwnerGain: number | null;
}

interface Candidate {
  kind:
    | "sign"
    | "signHG"
    | "owner"
    | "stadium"
    | "manager"
    | "prime"
    | "primeSpecial"
    | "tdPlayer"
    | "tdSpecial";
  net: number;
  feasible: boolean;
  price: number;
  p?: CardPlayer;
  team?: string;
  year?: number;
  special?: SpecialKey;
  releaseIdx?: number;
}

const capEst = (g: Game, d: HarnessData): number =>
  g.capKnown ? g.effectiveBudget : d.meanBudget * CAP_SAFETY;

const openSeatCount = (g: Game): number => g.slots.filter((s) => s === null).length;

/** Money verdict for adding `price` of salary. Strict mode: hard gate that
 * leaves CHEAP_FILL per remaining seat; under-cap spend earns bonus credit.
 * Overspend mode: never gates — charges marginal tax and, on first crossing
 * the cap, the forfeited payroll bonus. `extraSeats` = seats still to fill
 * after this action (a swap fills none). */
function moneyEval(
  g: Game,
  d: HarnessData,
  cfg: BotConfig,
  price: number,
  extraSeats: number,
  releasedCost = 0,
): { feasible: boolean; adj: number } {
  const cap = capEst(g, d);
  const spend = g.spend - releasedCost;
  if (!cfg.overspend) {
    const feasible = spend + price + CHEAP_FILL * extraSeats <= cap;
    const delta = price - releasedCost;
    const econ = cfg.econ ?? "current";
    let adj = 0;
    if (feasible && econ === "current") {
      // Expert "slope": ramp toward the exact end-state marginal (20/cap) as
      // seats fill — late money has nowhere else to go, so full credit.
      const eff = hasExpert(cfg, "slope")
        ? SLOPE + (SLOPE * (SLOT_TYPES.length - openSeatCount(g))) / SLOT_TYPES.length
        : SLOPE;
      adj = (delta * eff) / cap; // spending toward the cap earns bonus
    } else if (feasible && econ === "thrift") {
      // Thrift's slope lives only in [cap−20, cap]; charge half the true
      // 0.5/$M on the spend that falls inside it (signed, so a TD swap that
      // frees money inside the region earns the credit back).
      const inRegion = (x: number): number => Math.min(20, Math.max(0, x - (cap - 20)));
      adj = -0.25 * (inRegion(spend + price) - inRegion(spend));
    } // "none": money neutral under the cap
    return { feasible, adj };
  }
  const overBefore = Math.max(0, spend - cap);
  const overAfter = Math.max(0, spend + price - cap);
  let adj = -(overAfter - overBefore);
  if (overBefore === 0 && overAfter > 0) adj -= OVER_BONUS_LOSS;
  if (overAfter === 0) adj += ((price - releasedCost) * SLOPE) / cap;
  return { feasible: true, adj };
}

/** The seat a signable player would burn: cheapest-EV open eligible type
 * (fill the weak seats — C, RP — with competent bodies; save IF/FLEX for
 * stars). Mirrored by the slot-picker choice in doSign. */
function seatFor(g: Game, d: HarnessData, p: CardPlayer): SlotType | null {
  const open = g.openSlotsFor(p);
  if (open.length === 0) return null;
  const types = [...new Set(open.map((i) => SLOT_TYPES[i]))];
  const specialist = types.filter((t) => t !== "FLEX");
  const pool = specialist.length > 0 ? specialist : types;
  return pool.reduce((a, b) => (d.seatEV[b] < d.seatEV[a] ? b : a));
}

/** Sign with the engine's slot picker resolved to the cheapest-EV open cell. */
function doSign(g: Game, d: HarnessData, p: CardPlayer): void {
  g.signPlayer(p);
  if (g.slotPick === p.id) {
    const cells = g.pickableSlotCells(p);
    const cell = cells.reduce((a, b) => (d.seatEV[SLOT_TYPES[b]] < d.seatEV[SLOT_TYPES[a]] ? b : a));
    g.signPlayer(p, cell);
  }
}

const signedPts = (s: Signed): number => s.war + awardPts(s.awards) + ringPts(s.ws, s.pen);

/** Seats still to fill across roster + front office — the option-value clock. */
function seatsRemaining(g: Game): number {
  return (
    openSeatCount(g) +
    (g.manager ? 0 : 1) +
    (g.fixedCap ? 0 : (g.owner ? 0 : 1) + (g.stadium ? 0 : 1))
  );
}

/** Expert "decay": a one-shot powerup unused at the finale is wasted, so its
 * option cost shrinks as the club nears completion. */
function optCost(g: Game, cfg: BotConfig, base: number): number {
  if (!hasExpert(cfg, "decay")) return base;
  return base * Math.max(0.3, seatsRemaining(g) / 11);
}

/** Projected final total on mean expectations: 50 base + rostered value +
 * seat EVs for open seats + manager (actual or EV) + a typical ~7 payroll
 * bonus. Honest — own roster and public dataset averages only. */
const CHASE_BAR = 145;
function projectedTotal(g: Game, d: HarnessData): number {
  let t = 50 + g.totalWar + 7;
  for (const s of g.slots) if (s) t += awardPts(s.awards) + ringPts(s.ws, s.pen);
  for (let i = 0; i < SLOT_TYPES.length; i++) if (g.slots[i] === null) t += d.seatEV[SLOT_TYPES[i]];
  t += g.manager ? (g.manager.wins - g.manager.losses) * 0.1 : d.mgrEV;
  return t;
}

/** All actions available on the landed card, scored in net finale points
 * (value minus the expected value of the seat/powerup consumed).
 * `baseOnly` restricts to plain signs + specials (used for reroll appraisal). */
function buildCandidates(g: Game, d: HarnessData, cfg: BotConfig, baseOnly = false): Candidate[] {
  const card = g.card;
  if (!card) return [];
  const out: Candidate[] = [];
  const openSeats = openSeatCount(g);
  const cap = capEst(g, d);
  const refBudget = g.owner?.budget ?? d.meanBudget;
  const optHG = optCost(g, cfg, OPT_HG);
  const optPrime = optCost(g, cfg, OPT_PRIME);
  const optTD = optCost(g, cfg, OPT_TD);
  const hgSaveRate = hasExpert(cfg, "hgdp") ? 0.25 : MONEY_PT;
  // "chase": pacing elite → award/ring points get 1.5× weight in player picks.
  const chasing = hasExpert(cfg, "chase") && projectedTotal(g, d) >= CHASE_BAR;
  const chaseBonus = (pl: { awards: string[]; ws: boolean; pen: boolean }): number =>
    chasing ? 0.5 * (awardPts(pl.awards) + ringPts(pl.ws, pl.pen)) : 0;

  // --- plain signs ---
  for (const p of g.visiblePlayers) {
    if (g.playerState(p) !== "open") continue;
    const seat = seatFor(g, d, p);
    if (!seat) continue;
    const money = moneyEval(g, d, cfg, p.cost, openSeats - 1);
    out.push({
      kind: "sign",
      p,
      price: p.cost,
      feasible: money.feasible,
      net: playerPts(p) + chaseBonus(p) - d.seatEV[seat] + money.adj,
    });
    // --- 🏠 Homegrown variant: same sign at the league minimum ---
    if (
      !baseOnly &&
      cfg.enabled.has("hometown") &&
      g.powerups.hometown === "ready" &&
      p.debut === card.franchise &&
      p.cost - hgPrice(p) >= HG_MIN_SAVE
    ) {
      const hgMoney = moneyEval(g, d, cfg, hgPrice(p), openSeats - 1);
      // The discount's value is the freed cap room (MONEY_PT per $M saved) —
      // without that credit the payroll-bonus slope would always prefer the
      // full-price sign and Homegrown would never fire.
      out.push({
        kind: "signHG",
        p,
        price: hgPrice(p),
        feasible: hgMoney.feasible,
        net:
          playerPts(p) +
          chaseBonus(p) -
          d.seatEV[seat] +
          hgMoney.adj +
          // Savings valued at the common cap-headroom rate for every econ
          // variant — thrift's extra savings value (if any) must emerge from
          // moneyEval's region charge, not a hand-boosted credit here.
          (p.cost - hgPrice(p)) * hgSaveRate -
          optHG,
      });
    }
  }

  // --- specials (free money-wise; the cost is the seat and the spin) ---
  if (!g.fixedCap && !g.owner) {
    out.push({
      kind: "owner",
      price: 0,
      feasible: true,
      net: (card.budget - d.meanBudget) * MONEY_PT,
    });
  }
  if (!g.fixedCap && !g.stadium) {
    out.push({
      kind: "stadium",
      price: 0,
      feasible: true,
      net: (card.stadiumMult - 1) * refBudget * MONEY_PT,
    });
  }
  if (!g.manager && card.manager != null) {
    out.push({
      kind: "manager",
      price: 0,
      feasible: true,
      net: (card.wins - card.losses) * mgrM(cfg) - mgrEVAt(d, cfg),
    });
  }
  if (baseOnly) return out;

  // --- ⭐ Prime Time: browse a listed player's career, sign a better season ---
  if (cfg.enabled.has("prime") && g.powerups.prime === "ready") {
    for (const p of g.visiblePlayers) {
      if (g.isRostered(p)) continue;
      const appearances = d.players[p.id] ?? [];
      for (const [team, year] of appearances) {
        if (team === card.team && year === card.year) continue;
        const sp = d.seasons.get(`${p.id}|${team}_${year}`);
        if (!sp || sp.war < 0) continue;
        const seat = seatFor(g, d, sp); // that season's eligibility, engine-identical
        if (!seat) continue;
        const money = moneyEval(g, d, cfg, sp.cost, openSeats - 1);
        if (!money.feasible) continue;
        out.push({
          kind: "prime",
          p,
          team,
          year,
          price: sp.cost,
          feasible: true,
          net: playerPts(sp) + chaseBonus(sp) - d.seatEV[seat] + money.adj - optPrime,
        });
      }
    }
    // Front-office flavor: browse this franchise's timeline for the open
    // manager tile — the engine's only special Prime target since the
    // Round 17 ban (Study 9 measured the owner/stadium arms; those tiles
    // can no longer be primed, so the bot never appraises them).
    const allowed = cfg.primeSpecials ?? ["manager"];
    const timeline = d.specials[card.franchise] ?? [];
    for (const s of timeline) {
      if (s.team === card.team && s.year === card.year) continue;
      if (allowed.includes("manager") && !g.manager && g.managerAvailable && s.mgr != null) {
        out.push({
          kind: "primeSpecial",
          special: "manager",
          team: s.team,
          year: s.year,
          price: 0,
          feasible: true,
          net: (s.w - s.l) * mgrM(cfg) - mgrEVAt(d, cfg) - optPrime,
        });
      }
    }
  }

  // --- 🔁 Trade Deadline: upgrade an occupied seat or a taken special ---
  if (cfg.enabled.has("tradeDeadline") && g.powerups.tradeDeadline === "ready") {
    for (const p of g.visiblePlayers) {
      if (g.isRostered(p)) continue;
      const occupied = g.occupiedSlotsFor(p);
      for (const idx of occupied) {
        const occ = g.slots[idx]!;
        const money = moneyEval(g, d, cfg, p.cost, openSeats, occ.costPaid);
        if (!money.feasible) continue;
        out.push({
          kind: "tdPlayer",
          p,
          releaseIdx: idx,
          price: p.cost,
          feasible: true,
          net: playerPts(p) + chaseBonus(p) - signedPts(occ) + money.adj - optTD,
        });
      }
    }
    if (g.owner) {
      out.push({
        kind: "tdSpecial",
        special: "owner",
        price: 0,
        feasible: true,
        net: (card.budget - g.owner.budget) * MONEY_PT - optTD,
      });
    }
    if (g.stadium) {
      out.push({
        kind: "tdSpecial",
        special: "stadium",
        price: 0,
        feasible: true,
        net: (card.stadiumMult - g.stadium.mult) * refBudget * MONEY_PT - optTD,
      });
    }
    if (g.manager && card.manager != null) {
      out.push({
        kind: "tdSpecial",
        special: "manager",
        price: 0,
        feasible: true,
        net:
          (card.wins - card.losses) * mgrM(cfg) -
          (g.manager.wins - g.manager.losses) * mgrM(cfg) -
          optTD,
      });
    }
  }

  return out;
}

/** What a summarized card would offer this game state — same net scale as
 * buildCandidates, players + specials only. Used to aim rerolls. */
function summaryQuality(g: Game, d: HarnessData, cfg: BotConfig, s: CardSummary): number {
  const nets: number[] = [];
  const openSeats = openSeatCount(g);
  const refBudget = g.owner?.budget ?? d.meanBudget;
  const openTypes = new Set(SLOT_TYPES.filter((t, i) => g.slots[i] === null));
  for (const t of openTypes) {
    const best = s.bestBySlot[t];
    if (!best) continue;
    const money = moneyEval(g, d, cfg, best.cost, openSeats - 1);
    if (!money.feasible) continue;
    nets.push(best.pts - d.seatEV[t] + money.adj);
  }
  if (!g.fixedCap && !g.owner) nets.push((s.budget - d.meanBudget) * MONEY_PT);
  if (!g.fixedCap && !g.stadium) nets.push((s.mult - 1) * refBudget * MONEY_PT);
  if (!g.manager && s.mgrPts != null) nets.push(s.mgrPts * (mgrM(cfg) / 0.1) - mgrEVAt(d, cfg));
  if (nets.length === 0) return -Infinity;
  nets.sort((a, b) => b - a);
  // Expert "depth": a deep card is worth more than its single best pick —
  // the second option feeds Double Play and later hunt spins.
  return hasExpert(cfg, "depth") && nets.length > 1 && nets[1] > 0
    ? nets[0] + 0.4 * nets[1]
    : nets[0];
}

/** 🎟️ Season Ticket / 🚚 Relocate: when the landed card is weak, reroll it
 * toward the best-looking alternative (franchise's other years / same year's
 * other clubs). Fires at most one reroll per landing; the engine's once-per-
 * game state gates repeats. Returns true when a reroll started (phase →
 * "spinning"; the driver awaits land() and re-decides on the new card). */
function tryReroll(g: Game, d: HarnessData, cfg: BotConfig, track: Track): boolean {
  const card = g.card;
  if (!card || g.choicesUsed !== 0) return false;
  const st = cfg.enabled.has("seasonTicket") && g.powerups.seasonTicket === "ready";
  const rel = cfg.enabled.has("relocate") && g.powerups.relocate === "ready";
  if (!st && !rel) return false;
  const base = buildCandidates(g, d, cfg, true).filter((c) => c.feasible);
  const q = base.length > 0 ? Math.max(...base.map((c) => c.net)) : -5;
  // Standard bots never reroll a card that clears the keep bar; jackpot
  // hunters still appraise it (they may reroll past a merely-decent card).
  if (q >= REROLL_KEEP && !hasExpert(cfg, "jackpot")) return false;

  let bestQ = -Infinity;
  let bestMove: { kind: "st"; year: number } | { kind: "rel"; team: string } | null = null;
  if (st) {
    for (const year of g.yearsForFranchise(card.franchise)) {
      if (year === card.year) continue;
      const entry = d.index.cards.find((c) => c.franchise === card.franchise && c.year === year);
      const s = entry && d.summaries.get(`${entry.team}_${entry.year}`);
      if (!s) continue;
      const sq = summaryQuality(g, d, cfg, s);
      if (sq > bestQ) {
        bestQ = sq;
        bestMove = { kind: "st", year };
      }
    }
  }
  if (rel) {
    for (const entry of g.teamsForYear(card.year)) {
      if (entry.team === card.team) continue;
      const s = d.summaries.get(`${entry.team}_${entry.year}`);
      if (!s) continue;
      const sq = summaryQuality(g, d, cfg, s);
      if (sq > bestQ) {
        bestQ = sq;
        bestMove = { kind: "rel", team: entry.team };
      }
    }
  }
  if (!bestMove) return false;
  const gain = bestQ - q;
  // Weak card + solid gain fires for everyone; "jackpot" additionally fires
  // on a ≥3 gain even off a card that clears the keep bar.
  const fire =
    (q < REROLL_KEEP && gain >= REROLL_MIN_GAIN) || (hasExpert(cfg, "jackpot") && gain >= 3);
  if (!fire) return false;
  const sourceBudget = card.budget;
  const targetKey =
    bestMove.kind === "st"
      ? (() => {
          const e = d.index.cards.find(
            (c) => c.franchise === card.franchise && c.year === (bestMove as { year: number }).year,
          );
          return e ? `${e.team}_${e.year}` : null;
        })()
      : `${bestMove.team}_${card.year}`;
  if (bestMove.kind === "st") g.seasonTicket(bestMove.year);
  else g.relocate(bestMove.team);
  if (g.phase !== "spinning") return false;
  track.rerolls += 1;
  const target = targetKey ? d.summaries.get(targetKey) : null;
  if (target && target.budget > sourceBudget) track.rerollsRicher += 1;
  return true;
}

/** ✌️ Double Play: arm when the card offers TWO strong, jointly affordable
 * plain picks. The second pick is re-derived after the first commits; if it
 * evaporated, finishSpin() refunds the powerup. */
function maybeArmDoublePlay(g: Game, d: HarnessData, cfg: BotConfig, pool: Candidate[]): void {
  if (!cfg.enabled.has("doublePlay") || g.powerups.doublePlay !== "ready") return;
  if (g.choicesUsed !== 0) return;
  const dpKinds = hasExpert(cfg, "hgdp")
    ? ["sign", "signHG", "owner", "stadium", "manager"]
    : ["sign", "owner", "stadium", "manager"];
  const plain = pool
    .filter((c) => c.feasible && dpKinds.includes(c.kind))
    .sort((a, b) => b.net - a.net);
  const c1 = plain[0];
  if (!c1 || c1.net < DP_MIN) return;
  const c2 = plain.find((c) => {
    if (c === c1 || c.net < DP_MIN) return false;
    if (c.kind !== "sign" || c1.kind !== "sign") return true;
    if (c.p!.id === c1.p!.id) return false;
    // Joint affordability + not fighting over one last seat.
    const cap = capEst(g, d);
    if (!cfg.overspend && g.spend + c1.price + c.price + CHEAP_FILL * (openSeatCount(g) - 2) > cap)
      return false;
    const open1 = g.openSlotsFor(c1.p!);
    const open2 = g.openSlotsFor(c.p!);
    return open2.some((i) => !(open1.length === 1 && open1[0] === i));
  });
  if (c2) g.toggleDoublePlay();
}

/** Execute one candidate against the engine. Async because Prime Time loads
 * the target season's card. */
async function execute(g: Game, d: HarnessData, c: Candidate): Promise<void> {
  switch (c.kind) {
    case "sign":
      doSign(g, d, c.p!);
      break;
    case "signHG":
      g.toggleHometown();
      doSign(g, d, c.p!);
      if (g.powerups.hometown === "armed") g.toggleHometown(); // sign failed → disarm
      break;
    case "owner":
      g.hireOwner();
      break;
    case "stadium":
      g.buyStadium();
      break;
    case "manager":
      g.hireManager();
      break;
    case "prime":
      g.togglePrime();
      g.primeTapPlayer(c.p!);
      await g.applyPrime(c.team!, c.year!);
      // A two-way season with more than one open seat type hands off to the
      // rail's slot picker instead of signing — the bot answers it the way
      // `doSign` answers the market's, on cheapest seat EV.
      if (g.primeSlotPending) {
        const cells = g.pickableSlotCells(c.p!);
        const cell = cells.reduce((a, b) =>
          d.seatEV[SLOT_TYPES[b]] < d.seatEV[SLOT_TYPES[a]] ? b : a,
        );
        g.signPlayer(c.p!, cell);
      }
      if (g.primeArmed) g.togglePrime();
      break;
    case "primeSpecial":
      g.togglePrime();
      g.primeTapSpecial(c.special!);
      if (!(await g.applyPrimeSpecial(c.team!, c.year!)) && g.primeArmed) g.togglePrime();
      break;
    case "tdPlayer":
      g.toggleTradeDeadline();
      g.tdTapPlayer(c.p!);
      if (g.releasePick === c.p!.id) g.tdRelease(c.p!, c.releaseIdx!);
      if (g.powerups.tradeDeadline === "armed") g.toggleTradeDeadline(); // failed → disarm
      break;
    case "tdSpecial":
      g.toggleTradeDeadline();
      g.tdTapSpecial(c.special!);
      if (g.powerups.tradeDeadline === "armed") g.toggleTradeDeadline();
      break;
  }
}

/** Rank for the forced-commit rule: the engine has no pass, so when nothing
 * is worth taking the bot still commits the least-bad option — free specials
 * first (recoverable via TD), then the cheapest signable body. */
function ranked(pool: Candidate[]): Candidate[] {
  const feasible = pool.filter((c) => c.feasible).sort((a, b) => b.net - a.net);
  const forced = pool
    .filter((c) => !c.feasible)
    .sort((a, b) => (a.price === b.price ? b.net - a.net : a.price - b.price));
  return [...feasible, ...forced];
}

const progressKey = (g: Game): string => `${g.phase}|${g.choicesUsed}|${g.spinCount}`;

/** Record what a committed candidate spent its powerup on (Studies 7/9). */
function noteCommit(track: Track, c: Candidate, g: Game, d: HarnessData): void {
  if (c.kind === "tdPlayer") track.tdPlayer += 1;
  else if (c.kind === "tdSpecial") {
    if (c.special === "manager") track.tdManager += 1;
    else track.tdOther += 1;
  } else if (c.kind === "prime") track.primePlayer += 1;
  else if (c.kind === "primeSpecial") {
    if (c.special === "manager") track.primeManager += 1;
    else {
      track.primeOther += 1;
      if (c.special === "owner") {
        track.primeOwner += 1;
        // Bank-shopping magnitude: chosen year's bank vs the landed tile's.
        const chosen = d.summaries.get(`${c.team}_${c.year}`)?.budget;
        if (chosen !== undefined && g.owner)
          track.primeOwnerGain = chosen - (g.card?.budget ?? chosen);
      } else track.primeStadium += 1;
    }
  } else if (c.kind === "signHG") track.hgSigns += 1;
}

/** One decision on a landed card: reroll, or commit exactly one choice. */
async function act(g: Game, d: HarnessData, cfg: BotConfig, track: Track): Promise<void> {
  const before = progressKey(g);
  if (g.choicesUsed === 0 && tryReroll(g, d, cfg, track)) return;

  const pool = buildCandidates(g, d, cfg);
  if (g.choicesUsed > 0) {
    // Second Double Play pick: it's refundable, so only commit a positive one.
    const best = ranked(pool.filter((c) => c.feasible && c.net > 0))[0];
    if (!best) {
      g.finishSpin();
      return;
    }
    await execute(g, d, best);
    if (progressKey(g) === before) g.finishSpin();
    else noteCommit(track, best, g, d);
    return;
  }

  maybeArmDoublePlay(g, d, cfg, pool);
  for (const c of ranked(pool).slice(0, 5)) {
    await execute(g, d, c);
    if (progressKey(g) !== before) {
      noteCommit(track, c, g, d);
      return;
    }
  }
  throw new Error(
    `bot stuck: seed=${g.seed} spin=${g.spinCount} card=${g.card?.team}_${g.card?.year} ` +
      `pool=${pool.length} choicesLeft=${g.choicesLeft}`,
  );
}

// ---------------------------------------------------------------------------
// Game driver
// ---------------------------------------------------------------------------

async function waitFinale(g: Game): Promise<void> {
  for (let i = 0; i < 1000 && g.phase !== "finale"; i++)
    await new Promise((r) => setImmediate(r));
  if (g.phase !== "finale") throw new Error(`finale never arrived: seed=${g.seed}`);
}

export async function playGame(
  seed: number,
  cfg: BotConfig,
  d: HarnessData,
  gameConfig: GameConfig = DEFAULT_CONFIG, // classic bank, standard difficulty
  /** Hook for studies that need the finished Game itself (the club, the cards
   * it saw) rather than the summary row. */
  inspect?: (g: Game) => void,
): Promise<GameResult> {
  store.clear();
  const track: Track = {
    rerolls: 0,
    rerollsRicher: 0,
    tdPlayer: 0,
    tdManager: 0,
    tdOther: 0,
    primePlayer: 0,
    primeManager: 0,
    primeOwner: 0,
    primeStadium: 0,
    primeOther: 0,
    hgSigns: 0,
    primeOwnerGain: null,
  };
  const g = new Game(d.meta, d.index, d.owners, seed, gameConfig);
  let guard = 0;
  while (g.phase !== "finale") {
    if (++guard > 2000)
      throw new Error(`game never finished: seed=${seed} bot=${cfg.name} spins=${g.spinCount}`);
    if (g.phase === "preSpin") {
      g.spin();
      await g.land();
      if (g.loadFailed) throw new Error(`card load failed: seed=${seed}`);
      continue;
    }
    if (g.phase === "spinning") {
      await g.land();
      if (g.loadFailed) throw new Error(`card load failed: seed=${seed}`);
      continue;
    }
    // landed
    if (g.complete) {
      await waitFinale(g);
      continue;
    }
    if (g.coldStove) {
      g.coldRespin();
      continue;
    }
    await act(g, d, cfg, track);
  }
  const f = g.finale!;
  const spent = Object.fromEntries(
    ALL_POWERUPS.map((k) => [k, g.powerups[k] === "spent"]),
  ) as Record<PowerupKey, boolean>;
  // Card accounting: how the finished club maps onto the cards the reel showed.
  // Owner and stadium carry a franchise, not an era team code, so they resolve
  // through the index before they can be compared with `seen`.
  const teamFor = (franchise: string, year: number): string =>
    d.index.cards.find((c) => c.franchise === franchise && c.year === year)?.team ?? franchise;
  const seenKeys = new Set(g.seen.map((s) => `${s.team}|${s.year}`));
  const commitKeys: string[] = [];
  for (const s of g.slots) if (s) commitKeys.push(`${s.team}|${s.year}`);
  if (g.manager) commitKeys.push(`${g.manager.team}|${g.manager.year}`);
  if (g.owner) commitKeys.push(`${teamFor(g.owner.franchise, g.owner.year)}|${g.owner.year}`);
  if (g.stadium) commitKeys.push(`${teamFor(g.stadium.franchise, g.stadium.year)}|${g.stadium.year}`);
  const perCard = new Map<string, number>();
  for (const k of commitKeys) perCard.set(k, (perCard.get(k) ?? 0) + 1);
  const extraPerCard = [...perCard.values()].reduce((sum, n) => sum + (n - 1), 0);
  const offPoolPicks = commitKeys.filter((k) => !seenKeys.has(k)).length;
  // Replay the finale's own dream solve to time it and to see the solver's raw
  // answer, which the finale then clamps up to the club the player built. Same
  // inputs, same options — the engine assembles the off-reel pool the same way
  // (a ⭐ Prime Time signing's card, narrowed to that one player).
  const offReel: Card[] = [];
  for (const s of g.slots) {
    if (!s || seenKeys.has(`${s.team}|${s.year}`)) continue;
    const c = d.cards.get(`${s.team}_${s.year}`);
    if (c) offReel.push({ ...c, players: c.players.filter((p) => p.id === s.id), manager: null });
  }
  if (g.manager && !seenKeys.has(`${g.manager.team}|${g.manager.year}`)) {
    const c = d.cards.get(`${g.manager.team}_${g.manager.year}`);
    if (c) offReel.push({ ...c, players: [] });
  }
  const pool = g.seen.map((s) => d.cards.get(`${s.team}_${s.year}`)!).filter(Boolean);
  const t0 = performance.now();
  const solved = bestRoster(pool, {
    fixedBudgetM: g.fixedCap ? g.effectiveBudget : null,
    offReel,
  });
  const solveMs = performance.now() - t0;
  inspect?.(g);
  return {
    seed,
    total: f.parts.total,
    seenCount: seenKeys.size,
    commitments: commitKeys.length,
    extraPerCard,
    offPoolPicks,
    ceiling: f.bestPossibleTotal ?? null,
    ceilingRecord: f.bestPossibleRecord
      ? `${f.bestPossibleRecord.wins}-${f.bestPossibleRecord.losses}`
      : null,
    ceilingIsAchieved: (f.bestPossibleTotal ?? -Infinity) <= f.parts.total,
    solverTotal: solved.total ?? null,
    solveMs,
    dreamSpend: solved.spend ?? 0,
    dreamBudget: solved.budget ?? 0,
    dreamSeats: solved.dreamSeats ?? 0,
    dreamUnderCap: solved.underBudgetTotal ?? null,
    dreamUsesOffReel: solved.picks.some(
      (p) => p !== null && !seenKeys.has(`${p.team}|${p.year}`),
    ),
    war: f.totalWar,
    spend: f.spend,
    budget: f.budget,
    bonus: f.parts.budgetBonus,
    tax: f.parts.luxuryTax,
    expectedWins: f.parts.expectedWins,
    scout: f.scoutHits,
    spins: f.spinCount,
    mgrNet: g.manager ? g.manager.wins - g.manager.losses : 0,
    spent,
    rerolls: track.rerolls,
    rerollsRicher: track.rerollsRicher,
    uses: {
      tdPlayer: track.tdPlayer,
      tdManager: track.tdManager,
      tdOther: track.tdOther,
      primePlayer: track.primePlayer,
      primeManager: track.primeManager,
      primeOwner: track.primeOwner,
      primeStadium: track.primeStadium,
      primeOther: track.primeOther,
      hgSigns: track.hgSigns,
    },
    primeOwnerGain: track.primeOwnerGain,
  };
}

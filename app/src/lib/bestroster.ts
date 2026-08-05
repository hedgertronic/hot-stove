/** The best club the cards a game actually spun could have produced — the
 * finale's "you could have gone 141–21" yardstick, and the dream team the
 * ⭐ scout hits are counted against.
 *
 * OBJECTIVE. The solver maximizes the finale's OWN total, not WAR. Every term
 * of that total is in the objective — expected wins (replacement + WAR + the
 * skipper's net wins, capped), the payroll bonus, the trophy case including a
 * MotY skipper, ring chasing, the scout hits, minus the luxury tax. The point
 * values are `./scoring`'s and are imported below, never restated here: this
 * file is a consumer of that module, and a formula written out in a comment is
 * a copy nobody executes.
 *
 * A WAR-max club that spends 45% of its payroll gives back ~1 point of that
 * bonus for every 1% of the bankroll it leaves on the table, so the old
 * WAR-max yardstick could and did print a club that SCORES LESS than the one
 * the player built. Every term above is in the objective now, which is why the
 * owner and the ballpark are solved too: they set `budget`, and the payroll
 * bonus is not separable from that choice.
 *
 * THE SCOUT TERM IS A FIXED POINT, not a circularity. The player's scout bonus
 * is w·|their club ∩ this club| for w = SCOUT_HIT_POINTS, so this club's own
 * score has to assume it hits itself. Write base(R) for everything except the
 * scout term and seats(R) for the roster+skipper seats R fills. Choosing
 * D = argmax [base(R) + w·seats(R)] is self-consistent: for any legal club R,
 *   score(R) = base(R) + w·|R ∩ D| ≤ base(R) + w·seats(R) ≤ base(D) + w·seats(D)
 * so D really is the best club available, whichever club the player built. The
 * middle inequality needs w ≥ 0 and nothing else, so the argument holds at
 * whatever a seat is currently priced at.
 * Owner and ballpark earn no scout point (the engine counts players and the
 * skipper only), so `dreamSeats` still tops out at 9.
 *
 * WHAT A LEGAL CLUB IS. Six rules, all solved together:
 *
 * 1. ONE PICK PER CARD, PLUS ONE ✌️. A spin lands on one team-season and buys
 *    one thing — a player, the skipper, the owner, OR the ballpark. So the
 *    yardstick is a club the player could genuinely have drafted, not five 1998
 *    Yankees off a single card. Double Play is the one exception the game
 *    itself grants, and every game starts holding it: exactly one card may
 *    supply two things.
 * 2. ONE SEASON PER HUMAN. The same B-R id may fill only one seat, the same
 *    rule the draft enforces.
 * 3. SLOT CAPACITY. C1 IF2 OF1 FLEX1 SP2 RP1, plus one manager seat.
 * 4. THE FRONT OFFICE COSTS CARDS TOO. Classic bank hires an owner and buys a
 *    ballpark, each off its own card; budget = owner payroll × park multiplier.
 *    Fixed banks (Moneyball, Blank Check) skip both — their cap is a constant.
 * 5. THE MARKET IS WHAT THE PLAYER SAW. Only players the card list would have
 *    shown (`visible`, mirroring Game.visiblePlayers) can be signed, at their
 *    listed price.
 * 6. NO PASSING. There is no such thing as a club with an open seat: the game
 *    will not let a season end until every seat is filled (DECISIONS.md item 2),
 *    so a club a seat short is not a worse club, it is not a club. This is the
 *    one rule the DP cannot carry in its state, and `better` is where it lives —
 *    every club the search compares is ranked on (seats filled, total), seats
 *    dominating. It has to dominate rather than break ties, because the
 *    incomplete club usually scores HIGHER: the seat it skipped is the one that
 *    pushed payroll past the cap, and dodging the luxury tax is worth more under
 *    this objective than the win the missing player would have added. Measured
 *    on real games, an eight-seat club could beat every complete club in the
 *    same game by twenty points and be printed as the ceiling.
 *
 * The one honest exception to rule 6 is a pool too thin to reach nine seats — a
 * three-card lab fixture, or a game abandoned four spins in. `better` compares
 * seat counts rather than testing for nine, so those still get the fullest club
 * their cards can field, and `dreamSeats` reports what came out; that is why the
 * ⭐ denominator is that number and not a fixed nine. Across 800 bot games on
 * the classic bank the exception never fires: every finished game reaches nine,
 * which is Study 15's assertion rather than a rate it tolerates.
 *
 * WHAT THE CEILING ASSUMES, in one sentence: perfect play of the cards the reel
 * actually showed you — every roster seat, the skipper, the owner and the
 * ballpark chosen with hindsight, one pick per card plus a ✌️ Double Play
 * second pick off one of them, at list prices, plus the one off-reel season
 * ⭐ Prime Time reached, which enters the pool as an extra card rather than
 * being charged the spin it really cost.
 *
 * Counting that last clause exactly: a real Prime spends a landed card's
 * choice and buys elsewhere, so a game that spun N cards had N + 1 choices
 * (the Double Play is the +1) no matter how they were used. The pool here can
 * yield N + 2 items — one per spun card, one doubled, one off-reel — so it is
 * one item loose, and that slack can only bind when N + 1 is short of the 11
 * seats a club fills, i.e. when the reel showed 9 cards or fewer. Study 12
 * measures how often that happens. Off-reel cards are barred from the front
 * office and from the Double Play, so the slack can never exceed one seat.
 *
 * Not modeled, deliberately: 🏠 Homegrown's discount (it only ever lowers
 * payroll, and under the bonus that is a cost, not a saving), 🔁 Trade Deadline
 * (re-choosing a seat is free to a solver that chose with hindsight), and
 * 🎟️/🚚 rerolls (they change WHICH cards you see, and the pool already is the
 * cards you saw). The finale clamps the ceiling up to the club actually built,
 * so a line this search cannot see can never make the ceiling read below it.
 *
 * SOLVE SHAPE. For a fixed budget the score is linear in payroll on each side
 * of the cap: below it every $1M is worth +20/budget points, above it every
 * $1M is worth −1. So each (owner, ballpark) pair is solved as a Lagrangian
 * sweep — a DP over cards (at most one candidate each) across the
 * 2·3·2·2·3·2·2 = 288 capacity states, maximizing value + λ·spend — and every
 * club that falls out is then scored EXACTLY by score(). λ = 20/budget solves
 * the under-cap branch and λ = −1 solves the over-cap branch exactly, so an
 * over-cap optimum is genuinely reachable by the search rather than clamped
 * away; λ = 0 is the plain best-players club between them; and when the
 * under-cap solve overshoots the cap, λ is bisected down to find the richest
 * club that still fits. The DP relaxes rule 2, so conflict-driven branch and
 * bound closes that gap on the winner.
 *
 * Three passes, because ~180 front offices × a full sweep is too slow for a
 * finale on a phone: pass 1 ranks every (owner, ballpark) pair on the two
 * budget-INDEPENDENT probes (λ = 0 and λ = −1, one DP shared by both orderings
 * of a card pair, since only the cap differs); pass 2 runs the full sweep and
 * the bisection on the best few; pass 3 tries the Double Play card on the best
 * few of those. Passes 2 and 3 are shortlist heuristics — they can only raise
 * the answer, and every club they consider is legal and scored exactly, so the
 * number printed is always a club somebody could really have built. The
 * shortlists are cut on the same (seats, total) order the winner is chosen by,
 * so the refinement is spent on front offices that reach a complete club rather
 * than on one whose best club is a seat short and cannot win anyway.
 *
 * Deterministic throughout: stable iteration order, strict-improvement
 * updates, fixed λ schedule and a fixed branch order, so two runs of the same
 * seed always print the same club. */
import { eligibleTypes, visiblePlayers } from "./eligibility";
import {
  AWARD_POINTS,
  BUDGET_BONUS_MAX,
  LUXURY_TAX_PER_M,
  MANAGER_MOTY_POINTS,
  MANAGER_PER_NET_WIN,
  PENNANT_POINTS,
  RING_POINTS,
  SCOUT_HIT_POINTS,
  score,
} from "./scoring";
import type { Card, CardPlayer, SlotType } from "./types";

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
  /** Listed price, $M — what this seat costs the dream club's payroll.
   * Optional so hand-built lab fixtures stay valid; the solver always sets it. */
  cost?: number;
  /** World Baseball Classic medal for this season — card-data discriminant,
   * 2 (WBC_CHAMPION_ID) for a gold medal, 1 (WBC_RUNNERUP_ID) for silver,
   * absent otherwise, exactly as the card carries it. NOT scoring points:
   * use WBC_CHAMPION_ID / WBC_RUNNERUP_ID (not WBC_CHAMPION_POINTS /
   * WBC_RUNNERUP_POINTS) to compare against this field. Here for the same
   * reason `ws`/`pen` are: the finale draws the dream club's seats with the
   * same hardware its own squad shows, and a medal the solver dropped would
   * make the ceiling look like it won less than it did. Optional because most
   * player-seasons have none, not because the solver sometimes omits it. */
  wbc?: number;
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

/** The dream club's owner: the card whose payroll it plays under. Carries the
 * card's coordinates rather than the owner's name — the name lives in
 * data/owners.json, which the solver deliberately does not load. */
export interface BestOwnerPick {
  team: string;
  year: number;
  teamName: string;
  franchise: string;
  budget: number;
}

/** The dream club's ballpark: the card whose multiplier it plays under. */
export interface BestParkPick {
  team: string;
  year: number;
  teamName: string;
  franchise: string;
  park: string;
  mult: number;
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
   * as `manager`; the solver always sets it. Owner and ballpark are NOT counted
   * — the engine awards no scout point for either. */
  dreamSeats?: number;
  /** Front office the dream club runs (null under a fixed bank, which has no
   * owner or ballpark to pick). */
  owner?: BestOwnerPick | null;
  park?: BestParkPick | null;
  /** Payroll the dream club plays under: owner budget × ballpark multiplier. */
  budget?: number;
  /** What the dream club's eight seats cost, $M. */
  spend?: number;
  /** THE CEILING: the finale total this club scores, from the same score()
   * the player's own stamp comes out of. */
  total?: number;
  /** Best total the search reached WITHOUT crossing the payroll, over the same
   * complete clubs `total` is chosen from. Equal to `total` unless the dream
   * club deliberately pays the luxury tax, which is the whole reason the cap is
   * not a hard constraint here: the bonus is worth at most 10 points and a
   * single elite season can be worth more. Null when no club in the search
   * stayed under (a pool too expensive to fit). */
  underBudgetTotal?: number | null;
}

export interface BestClubOptions {
  /** Moneyball / Blank Check: payroll is a constant, not a card choice, so the
   * dream club hires no owner and buys no ballpark. Null (the default) is the
   * classic bank, where both are solved. */
  fixedBudgetM?: number | null;
  /** Seasons the reel never landed on, reachable only because ⭐ Prime Time
   * reached them — already narrowed to the single item that powerup bought.
   * They fill roster and dugout seats but never the front office (Prime Time
   * cannot target the owner or the ballpark). */
  offReel?: Card[];
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

/** Every seat a club fills — the eight on the rail plus the dugout. */
const SEATS_FULL = CAPACITY.reduce((a, b) => a + b, 0);

const RADIX = CAPACITY.map((c) => c + 1);
const STATES = RADIX.reduce((a, b) => a * b, 1); // 288
const STRIDE = RADIX.map((_, t) => RADIX.slice(0, t).reduce((a, b) => a * b, 1));
/** Digit weight of the manager seat: states at or above it have him hired. */
const MGR_STRIDE = STRIDE[MGR_TYPE]; // 144

/** Ceiling on branch-and-bound nodes. Conflicts need one human seated twice in
 * an otherwise-optimal club, so real games settle in a handful of nodes; the cap
 * only bounds a pathological card set. If it ever binds, the answer is the best
 * LEGAL club found so far — feasible and deterministic, but not proven optimal. */
const MAX_NODES = 2000;

/** (owner, ballpark) pairs that get the full λ bisection after the cheap
 * two-λ pass ranks them. Every pair is still solved and scored exactly at
 * λ = 20/budget and λ = −1; this only bounds the extra refinement. */
const REFINE_PAIRS = 8;
/** Front offices that also get the ✌️ Double Play pass. The doubled card is
 * worth a few points, so a pair it could lift past the leader is already near
 * the top of the pass-1 ranking. */
const DOUBLE_PAIRS = 2;
/** λ bisection steps between "spend everything" and "spend nothing" when the
 * under-cap solve overshoots the cap. Each step is one more DP over ~12 cards;
 * 6 lands within ~1.5% of the crossing. */
const BISECT_STEPS = 6;

const awardPts = (awards: string[]): number =>
  awards.reduce((sum, a) => sum + (AWARD_POINTS[a] ?? 0), 0);

/** One thing a single card can supply: a player in one slot type, or the
 * skipper. `base` is everything the finale scores except payroll; the DP
 * maximizes base + λ·cost. `playerId` is null for a manager (skippers never
 * collide with the one-season-per-human rule). */
interface Item {
  type: number;
  base: number;
  cost: number;
  playerId: string | null;
  pick: BestPick | null;
  manager: BestManagerPick | null;
}

interface Chosen {
  card: number;
  item: Item;
}

/** One legal club the search produced, scored exactly. `dup` is the pool card
 * this club bought two things off (✌️ Double Play), or −1. */
interface Club {
  total: number;
  spend: number;
  /** Seats this club occupies — one per item, so roster seats plus the skipper.
   * Carried alongside the total because every comparison in the search is on
   * the pair, not the total (see `better`). */
  seats: number;
  chosen: Chosen[];
  dup: number;
}

/** THE ONLY ORDER THE SEARCH RANKS CLUBS BY: seats filled first, total second.
 *
 * A club with an open seat is not a club this game lets anybody finish
 * (DECISIONS.md: there is no passing, and the club must be complete to finish),
 * so it is not a candidate ceiling however well it scores. That has to dominate
 * rather than break ties, because the incomplete club usually scores HIGHER:
 * the seat it skipped was the one that pushed payroll past the cap, and under
 * the finale's own arithmetic dodging the luxury tax is worth more than the
 * win the missing player would have added. A yardstick that reads
 * "you could have gone 141–21" off a club with nobody in the rotation is
 * measuring a season nobody was allowed to play.
 *
 * Seat count is compared rather than tested against nine so a thin pool still
 * gets an answer: a three-card fixture, or a game abandoned four spins in, can
 * only reach the seats its cards carry, and the fullest club available is the
 * honest ceiling for it. `dreamSeats` reports what came out, which is why the
 * finale's ⭐ denominator is that number and not a fixed nine.
 *
 * Strict improvement keeps the search deterministic: the first club found at a
 * given (seats, total) is the one kept. */
function better(a: Club, b: Club | null): boolean {
  if (b === null) return true;
  return a.seats !== b.seats ? a.seats > b.seats : a.total > b.total;
}

/** A club record for `chosen`, scored exactly against `budgetM`. */
function clubOf(chosen: Chosen[], budgetM: number, dup: number): Club {
  return {
    total: evaluate(chosen, budgetM),
    spend: spendOf(chosen),
    seats: chosen.length,
    chosen,
    dup,
  };
}

/** The market the player actually saw on this card. It is eligibility.ts's
 * `visiblePlayers`, which `Game.visiblePlayers` also calls — not a mirror of
 * it. A dream club built out of rows the card never listed is not a club anyone
 * could have drafted, and the payroll term makes expensive washouts tempting
 * (they soak up bankroll), so this filter matters more here than it did under a
 * WAR-max objective. That is exactly why it cannot be a second copy: the two
 * were byte-identical and one comment away from drifting. */
const visible = (card: Card): CardPlayer[] => visiblePlayers(card.players);

/** Every item one card can supply, in stable order: its visible players (each
 * eligible slot type) then its skipper. Nothing is dropped for being weak — a
 * $30M washout can still be the best way to reach the payroll bonus, which is
 * exactly the kind of play the old WAR-max objective could not see. */
function cardItems(card: Card): Item[] {
  const items: Item[] = [];
  for (const p of visible(card)) {
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
      wbc: p.wbc,
      awards: p.awards,
      cost: p.cost,
    };
    const base =
      p.war +
      awardPts(p.awards) +
      (p.ws ? RING_POINTS : 0) +
      (p.pen ? PENNANT_POINTS : 0) +
      SCOUT_HIT_POINTS;
    for (const t of eligibleTypes(p))
      items.push({
        type: TYPE_ORDER.indexOf(t),
        base,
        cost: p.cost,
        playerId: p.id,
        pick,
        manager: null,
      });
  }
  if (card.manager != null) {
    const netWins = card.wins - card.losses;
    const moty = card.managerMoty === true;
    items.push({
      type: MGR_TYPE,
      base:
        netWins * MANAGER_PER_NET_WIN +
        (moty ? MANAGER_MOTY_POINTS : 0) +
        SCOUT_HIT_POINTS,
      cost: 0,
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
  return items;
}

function fill(state: number, type: number): number {
  const used = Math.floor(state / STRIDE[type]) % RADIX[type];
  return used < CAPACITY[type] ? state + STRIDE[type] : -1;
}

/** Seats filled, per DP state — the digit sum of the state's mixed radix.
 *
 * This is what makes each probe return the FULLEST club at its own λ, which is
 * the only form in which a probe is worth comparing. The pull the other way is
 * arithmetic, not a bug: on the over-cap branch λ = −1, so an item is worth
 * `base − cost` and a $20M starter worth one win scores −19, and a terminal
 * state chosen on value alone answers "sign nobody". That answer is correct for
 * a knapsack and useless as a candidate club, so terminal states are ranked
 * seats first, value second — among states with the same seat count the
 * best-scoring one still wins, which is exactly the DP's own optimum on the
 * capacity vector that state names.
 *
 * What this array does NOT do is decide the answer. Whether a complete club
 * gets printed is settled one level up, in `better`, where the clubs the passes
 * produce are compared: an incomplete club that survived `repair` still has to
 * lose to a complete one there, and before `better` existed it did not. Ranking
 * DP states was measured on 600 bot games with `better` in place and changed no
 * game's seat count; it is kept because a λ = −1 probe that seats nobody is a
 * wasted probe, and because the fullest club at a given λ is the club that
 * branch of the sweep is meant to be offering. */
const SEATS: Int32Array = (() => {
  const seats = new Int32Array(STATES);
  for (let s = 0; s < STATES; s++) {
    let n = 0;
    for (let t = 0; t < RADIX.length; t++) n += Math.floor(s / STRIDE[t]) % RADIX[t];
    seats[s] = n;
  }
  return seats;
})();

/** The first human seated twice, as [id, earlier card, later card]. Managers
 * carry no id and never conflict. */
function findConflict(chosen: Chosen[]): [string, number, number] | null {
  const seen = new Map<string, number>();
  for (const { card, item } of chosen) {
    if (item.playerId === null) continue;
    const prior = seen.get(item.playerId);
    if (prior !== undefined) return [item.playerId, prior, card];
    seen.set(item.playerId, card);
  }
  return null;
}

/** Make a relaxed solution legal: keep each human's earliest seating and refill
 * the seat the repeat would have taken with the best other thing that card
 * could have supplied. The refill matters — the DP is happy to seat one
 * two-way bat at both IF and UTIL off the same card, and a repair that only
 * deleted would hand back a club a seat short and score it as the ceiling.
 *
 * TWO PASSES, because a refill competes for capacity with seatings it has not
 * walked past yet. The keepers are counted first — every seating this repair is
 * not respending, wherever its card sits in the order — and only then is a
 * refill offered the types still open. Counting incrementally instead lets a
 * refill take the one OF seat a later card's keeper already holds, and the club
 * that falls out carries three men for two seats: `SLOT_INDICES` has no index
 * to hand the third, so the finale renders him nowhere and draws the seat the
 * conflict vacated as empty. A club a seat short is at least a club the search
 * can rank; one that silently loses a man it counted is not.
 *
 * The refill can only come off the conflicting card, because that is the card
 * whose one pick is being respent; a card that already supplied something has
 * no second pick to give. So a card carrying exactly one usable human really
 * can leave here a seat light, and this is the one place in the search that
 * produces an incomplete club at all. `better` is what keeps such a club from
 * being printed — it loses to any complete club the passes found — and
 * `branchAndBound` is what can win the seat back outright, by re-solving with
 * the doubled human barred and returning a complete club that never conflicted. */
function repair(chosen: Chosen[], items: Item[][], lambda: number): Chosen[] {
  const used = new Set<string>();
  const filled = [0, 0, 0, 0, 0, 0, 0];
  const doubled: boolean[] = chosen.map(({ item }) => {
    if (item.playerId === null || !used.has(item.playerId)) {
      if (item.playerId !== null) used.add(item.playerId);
      filled[item.type] += 1;
      return false;
    }
    return true;
  });

  const kept: Chosen[] = [];
  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i];
    if (!doubled[i]) {
      kept.push(c);
      continue;
    }
    let best: Item | null = null;
    let bestVal = 0;
    for (const alt of items[c.card]) {
      if (alt.playerId !== null && used.has(alt.playerId)) continue;
      if (filled[alt.type] >= CAPACITY[alt.type]) continue;
      const v = alt.base + lambda * alt.cost;
      // The LEAST BAD refill, never no refill: an empty seat beats a seat that
      // costs points in a knapsack and never in this game, and under λ = −1
      // every candidate refill scores negative, so a "skip a losing refill"
      // guard here would empty the seat every time it was asked to fill one.
      if (best === null || v > bestVal) {
        best = alt;
        bestVal = v;
      }
    }
    if (best !== null) {
      if (best.playerId !== null) used.add(best.playerId);
      filled[best.type] += 1;
      kept.push({ card: c.card, item: best });
    }
  }
  return kept;
}

/** The finale total a club scores, through the same score() that stamps the
 * player's own record — the ceiling and the stamp can never be computed two
 * different ways. */
function evaluate(chosen: Chosen[], budgetM: number): number {
  let totalWar = 0;
  let spendM = 0;
  let rings = 0;
  let pennants = 0;
  let scoutHits = 0;
  let managerMoty = false;
  let managerRecord: [number, number] | null = null;
  const awardLists: string[][] = [];
  for (const { item } of chosen) {
    if (item.pick !== null) {
      totalWar += item.pick.war;
      spendM += item.cost;
      awardLists.push(item.pick.awards);
      if (item.pick.ws) rings += 1;
      if (item.pick.pen) pennants += 1;
      scoutHits += 1;
    } else if (item.manager !== null) {
      // score() only ever reads the difference, so net wins in the W column is
      // the same input as the real 97–65.
      managerRecord = [item.manager.netWins, 0];
      if (item.manager.ws) rings += 1;
      if (item.manager.pen) pennants += 1;
      managerMoty = item.manager.moty;
      scoutHits += 1;
    }
  }
  return score({
    totalWar,
    spendM,
    budgetM,
    awardLists,
    rings,
    pennants,
    managerRecord,
    scoutHits,
    managerMoty,
  }).total;
}

const spendOf = (chosen: Chosen[]): number =>
  chosen.reduce((sum, c) => sum + c.item.cost, 0);

/** The DP, reused across every (owner, ballpark, λ) solve of one game so the
 * finale allocates its scratch once instead of ten thousand times. */
class Dp {
  private readonly cur = new Float64Array(STATES);
  private readonly next = new Float64Array(STATES);
  private readonly fromState: Int32Array[];
  private readonly fromOpt: Int32Array[];
  private readonly options: Item[][];

  constructor(readonly items: Item[][]) {
    this.fromState = items.map(() => new Int32Array(STATES));
    this.fromOpt = items.map(() => new Int32Array(STATES));
    this.options = items.map(() => []);
  }

  /** Best club under rules 1, 3, 4 and 5 (rule 2, one season per human, is
   * relaxed — the caller repairs or branches). `skip` holds card indices the
   * front office already claimed; `forbidden[c]` names players this branch has
   * barred from card c. Since a card yields at most one pick, only its
   * highest-scoring candidate per slot type can ever be used — collapsing to
   * that keeps each card's option list at seven. */
  solve(
    lambda: number,
    skip: readonly number[],
    forbidden: Set<string>[] | null,
    forceManager: boolean,
  ): Chosen[] | null {
    const n = this.items.length;
    for (let c = 0; c < n; c++) {
      const opts = this.options[c];
      opts.length = 0;
      if (skip.includes(c)) continue;
      const byType: (Item | null)[] = [null, null, null, null, null, null, null];
      const bestVal = [0, 0, 0, 0, 0, 0, 0];
      for (const item of this.items[c]) {
        if (item.playerId !== null && forbidden !== null && forbidden[c].has(item.playerId))
          continue;
        const v = item.base + lambda * item.cost;
        if (byType[item.type] === null || v > bestVal[item.type]) {
          byType[item.type] = item;
          bestVal[item.type] = v;
        }
      }
      for (const item of byType) if (item !== null) opts.push(item);
    }

    let dp = this.cur;
    let nxt = this.next;
    dp.fill(-Infinity);
    dp[0] = 0;
    for (let c = 0; c < n; c++) {
      // Carrying dp forward is the "skip this card" move; its states keep a -1
      // parent, which the unwind reads as "this card supplied nothing".
      nxt.set(dp);
      const prevState = this.fromState[c].fill(-1);
      const prevOpt = this.fromOpt[c].fill(-1);
      const opts = this.options[c];
      for (let s = 0; s < STATES; s++) {
        const at = dp[s];
        if (at === -Infinity) continue;
        for (let oi = 0; oi < opts.length; oi++) {
          const item = opts[oi];
          const ns = fill(s, item.type);
          if (ns < 0) continue;
          const v = at + item.base + lambda * item.cost;
          if (v > nxt[ns]) {
            nxt[ns] = v;
            prevState[ns] = s;
            prevOpt[ns] = oi;
          }
        }
      }
      const tmp = dp;
      dp = nxt;
      nxt = tmp;
    }

    // Seats first, value second — see SEATS. `forceManager` stays a hard floor
    // rather than folding into the seat count: a club one seat short is a club
    // this search may still print when the pool is that thin, but a club with
    // nobody in the dugout is not a club the caller asked for.
    const first = forceManager ? MGR_STRIDE : 0;
    let bestState = -1;
    for (let s = first; s < STATES; s++) {
      if (dp[s] === -Infinity) continue;
      if (
        bestState < 0 ||
        SEATS[s] > SEATS[bestState] ||
        (SEATS[s] === SEATS[bestState] && dp[s] > dp[bestState])
      )
        bestState = s;
    }
    if (bestState < 0) return null; // no legal club (a manager is required and none is left)

    const chosen: Chosen[] = [];
    let state = bestState;
    for (let c = n - 1; c >= 0; c--) {
      const oi = this.fromOpt[c][state];
      if (oi < 0) continue; // card skipped, state predates it — walk on unchanged
      chosen.push({ card: c, item: this.options[c][oi] });
      state = this.fromState[c][state];
    }
    chosen.reverse(); // card-ascending, so conflict scans are stable
    return chosen;
  }
}

/** Every club worth scoring for one (owner, ballpark) budget, and the best
 * total among them. λ = 20/budget is the exact under-cap payroll slope and
 * λ = −LUXURY_TAX_PER_M the exact over-cap one, so the two branches are solved
 * on their own terms and an over-budget club wins whenever it genuinely
 * outscores every legal one. `refine` adds the bisection between them. */
function sweep(
  dp: Dp,
  budgetM: number,
  skip: readonly number[],
  forceManager: boolean,
  refine: boolean,
  dup = -1,
): { best: Club; bestUnder: Club | null } | null {
  const found: Club[] = [];
  const run = (lambda: number): Chosen[] | null => {
    const raw = dp.solve(lambda, skip, null, forceManager);
    if (raw === null) return null;
    const chosen = repair(raw, dp.items, lambda);
    found.push(clubOf(chosen, budgetM, dup));
    return chosen;
  };

  const lambdaUnder = budgetM > 0 ? (2 * BUDGET_BONUS_MAX) / budgetM : 0;
  const under = run(lambdaUnder);
  if (under === null) return null;
  run(-LUXURY_TAX_PER_M);
  // The third probe is the one that keeps rich owners in the race. λ = 20/budget
  // buys the whole shop and gets taxed for it; λ = −1 buys nothing and forfeits
  // the bonus. Against a $144M cap the club that actually wins is the plain
  // best-players club sitting between them, and without this probe every big
  // bankroll scores as one of its two extremes and loses to a $16M owner whose
  // cheap roster maxes a bonus worth ten points — measured, on a real seed.
  run(0);

  // The under-cap optimum spends as close to the cap as it can. When the full
  // slope overshoots, walk λ down until the club fits: every step is a real
  // club on the value/payroll frontier, and every one gets scored exactly.
  if (refine && spendOf(under) > budgetM) {
    let lo = -LUXURY_TAX_PER_M; // spends least
    let hi = lambdaUnder; // spends most
    for (let i = 0; i < BISECT_STEPS; i++) {
      const mid = (lo + hi) / 2;
      const chosen = run(mid);
      if (chosen === null) break;
      if (spendOf(chosen) > budgetM) hi = mid;
      else lo = mid;
    }
  }
  return pick(found, budgetM);
}

function pick(found: Club[], budgetM: number): { best: Club; bestUnder: Club | null } | null {
  if (found.length === 0) return null;
  let best = found[0];
  let bestUnder: Club | null = null;
  for (const f of found) {
    if (better(f, best)) best = f;
    if (f.spend <= budgetM && better(f, bestUnder)) bestUnder = f;
  }
  return { best, bestUnder };
}

/** Close the one-season-per-human gap on a club the DP relaxed: branch on
 * forbidding the doubled human from one card or the other — every legal club
 * lies in one branch — and keep whatever scores best. `dup` is the pool card
 * this `dp` doubles, carried onto any club the search returns. */
function branchAndBound(
  dp: Dp,
  cardCount: number,
  budgetM: number,
  skip: readonly number[],
  forceManager: boolean,
  lambda: number,
  incumbent: Club,
  dup: number,
): Club {
  let best = incumbent;
  let nodes = 0;
  const search = (forbidden: Set<string>[]): void => {
    if (nodes >= MAX_NODES) return;
    nodes += 1;
    const raw = dp.solve(lambda, skip, forbidden, forceManager);
    if (raw === null) return;
    const conflict = findConflict(raw);
    if (conflict === null) {
      const total = evaluate(raw, budgetM);
      // Seats first here too: this search is the only one that can hand back a
      // seat `repair` had to vacate, and ranking its leaves on the total alone
      // is exactly how a complete club got discarded for an incomplete one.
      const cand = {
        total,
        spend: spendOf(raw),
        seats: raw.length,
        chosen: raw,
        dup,
      };
      if (better(cand, best)) best = cand;
      return;
    }
    const [id, a, b] = conflict;
    for (const c of [a, b]) {
      const nf = forbidden.map((s) => new Set(s));
      nf[c].add(id);
      search(nf);
    }
  };
  search(Array.from({ length: cardCount }, () => new Set<string>()));
  return best;
}

const EMPTY: BestRoster = {
  picks: Array(8).fill(null),
  totalWar: 0,
  manager: null,
  dreamSeats: 0,
  owner: null,
  park: null,
  budget: 0,
  spend: 0,
  total: 0,
};

export function bestRoster(cards: Card[], opts: BestClubOptions = {}): BestRoster {
  // One entry per team-season: a reel that lands twice on the same card still
  // only ever offered one choice from it.
  const pool: Card[] = [];
  const frontOffice: boolean[] = [];
  const keys = new Set<string>();
  for (const card of cards) {
    const key = `${card.team}|${card.year}`;
    if (keys.has(key)) continue;
    keys.add(key);
    pool.push(card);
    frontOffice.push(true);
  }
  for (const card of opts.offReel ?? []) {
    const key = `${card.team}|${card.year}`;
    if (keys.has(key)) continue;
    keys.add(key);
    pool.push(card);
    frontOffice.push(false); // ⭐ Prime Time never reaches an owner or a park
  }
  if (pool.length === 0) return { ...EMPTY, picks: Array(8).fill(null) };

  const items = pool.map(cardItems);
  const dp = new Dp(items);
  const hasManager = items.some((list) => list.some((i) => i.type === MGR_TYPE));
  // ✌️ Double Play buys a second thing off one spin, so exactly one card in the
  // pool may supply two items. Modeled by handing the DP a second copy of that
  // card: the one-season-per-human rule then falls out of the machinery that
  // already exists, since the two copies carry the same B-R ids.
  const doubled = (x: number): Dp => new Dp([...items, items[x]]);

  // Candidate front offices. Under a fixed bank there is none and the budget is
  // a constant; otherwise every ordered (owner card, ballpark card) pair is a
  // different cap AND a different pair of cards spent away from the roster, so
  // the two choices cannot be made independently of it.
  interface Pair {
    owner: number;
    park: number;
    budget: number;
    skip: number[];
  }
  const pairs: Pair[] = [];
  const fixed = opts.fixedBudgetM ?? null;
  if (fixed !== null) {
    pairs.push({ owner: -1, park: -1, budget: fixed, skip: [] });
  } else {
    const fo = pool.map((_, i) => i).filter((i) => frontOffice[i]);
    for (const o of fo)
      for (const p of fo)
        if (o !== p)
          pairs.push({
            owner: o,
            park: p,
            budget: pool[o].budget * pool[p].stadiumMult,
            skip: [o, p],
          });
    if (pairs.length === 0) {
      // Degenerate pool (a completed classic game always spun at least two
      // cards): price the club off whatever single card there is.
      const b = fo.length > 0 ? pool[fo[0]].budget * pool[fo[0]].stadiumMult : 0;
      pairs.push({ owner: -1, park: -1, budget: b, skip: [] });
    }
  }

  // Pass 1 — every pair at both exact slopes. Pass 2 — the λ bisection, on the
  // pairs pass 1 ranked highest (the refinement moves a few points at most, so
  // a pair it could promote past the leader is already in this shortlist).
  const scored: { pair: Pair; best: Club; manager: boolean }[] = [];
  let underBudget: Club | null = null;
  const note = (u: Club | null): void => {
    if (u !== null && better(u, underBudget)) underBudget = u;
  };
  // Read through a call rather than at the return site: `underBudget` is only
  // ever written from inside `note`, and control-flow analysis at the return
  // still holds it to its `null` initializer.
  const underTotal = (): number | null => (underBudget === null ? null : underBudget.total);
  // Pass 1 ranks the front offices on the two probes that do not depend on the
  // budget at all — the plain best-players club (λ = 0) and the thriftiest one
  // (λ = −1). Both come out of the same DP for the two orderings of a card
  // pair, since only the cap differs between "A owns, B's park" and the
  // reverse, so one solve serves two candidates.
  const seenSkip = new Map<string, { clubs: Chosen[][]; manager: boolean }>();
  for (const pair of pairs) {
    const key = pair.skip.length === 2 ? `${Math.min(...pair.skip)}|${Math.max(...pair.skip)}` : "-";
    let probe = seenSkip.get(key);
    if (probe === undefined) {
      let forceManager = hasManager;
      let plain = dp.solve(0, pair.skip, null, forceManager);
      // A pool whose only skipper went to the front office cannot seat one; the
      // player could not have built that club either, so the pair runs without
      // the dugout rather than dropping out of the search entirely.
      if (plain === null) {
        forceManager = false;
        plain = dp.solve(0, pair.skip, null, forceManager);
      }
      const thrifty = dp.solve(-LUXURY_TAX_PER_M, pair.skip, null, forceManager);
      const clubs = [plain, thrifty]
        .filter((c): c is Chosen[] => c !== null)
        .map((c) => repair(c, dp.items, 0));
      probe = { clubs, manager: forceManager };
      seenSkip.set(key, probe);
    }
    if (probe.clubs.length === 0) continue;
    const out = pick(
      probe.clubs.map((chosen) => clubOf(chosen, pair.budget, -1)),
      pair.budget,
    );
    if (out !== null) {
      scored.push({ pair, best: out.best, manager: probe.manager });
      note(out.bestUnder);
    }
  }
  if (scored.length === 0) return { ...EMPTY, picks: Array(8).fill(null) };
  // The shortlist is ranked on the same (seats, total) order the winner is
  // chosen by, so the pairs that reach a complete club are the ones that get
  // the expensive refinement — spending pass 2 on a front office whose only
  // clubs are a seat short would be refining a candidate that cannot win.
  const order = scored
    .map((s, i) => ({ s, i }))
    .sort(
      (a, b) =>
        b.s.best.seats - a.s.best.seats || b.s.best.total - a.s.best.total || a.i - b.i,
    );
  for (const { s } of order.slice(0, REFINE_PAIRS)) {
    const refined = sweep(dp, s.pair.budget, s.pair.skip, s.manager, true);
    if (refined === null) continue;
    if (better(refined.best, s.best)) s.best = refined.best;
    note(refined.bestUnder);
  }
  // Pass 3 — one card doubled, on the front offices pass 2 left on top. The
  // doubled card may be the owner's or the ballpark's: spending both of a
  // Double Play's picks on one spin's card is exactly what the powerup allows.
  for (const { s } of order.slice(0, DOUBLE_PAIRS)) {
    for (let x = 0; x < pool.length; x++) {
      // Never the off-reel card: ⭐ Prime Time buys one named season, and
      // doubling it would invent a second pick nobody was ever offered.
      if (!frontOffice[x]) continue;
      const out = sweep(doubled(x), s.pair.budget, s.pair.skip, s.manager, false, x);
      if (out === null) continue;
      if (better(out.best, s.best)) s.best = out.best;
      note(out.bestUnder);
    }
  }

  let winner = scored[0];
  for (const s of scored) if (better(s.best, winner.best)) winner = s;
  // Only the winner pays for the one-season-per-human search: a conflict needs
  // one human seated twice in an otherwise-optimal club, and the repair above
  // already made every candidate legal, so this recovers the seat rather than
  // finding a different club.
  {
    const b = winner.pair.budget;
    const lambda = b > 0 ? (2 * BUDGET_BONUS_MAX) / b : 0;
    const branch = (d: number, incumbent: Club): Club =>
      branchAndBound(
        d < 0 ? dp : doubled(d),
        pool.length + (d < 0 ? 0 : 1),
        b,
        winner.pair.skip,
        winner.manager,
        lambda,
        incumbent,
        d,
      );
    const firstDup = winner.best.dup;
    winner.best = branch(firstDup, winner.best);
    // A club still short of a full rail gets every ✌️ Double Play searched, not
    // just the one pass 3 happened to leave on top. Pass 3 ranks a doubled club
    // by what `repair` left of it, so the card whose second pick fills the last
    // seat can tie the undoubled club at pass-3 time — one seating collides,
    // repair has no legal refill off that card, and the seat the doubling was
    // for goes back. Only branching recovers it, and branching a club that is
    // already full would only be trading seats for points. The pool bounds this
    // at one branch-and-bound per card, and it runs on games too thin to seat
    // nine off distinct cards — the case the header's "N + 1 short of 11" slack
    // describes.
    if (winner.best.seats < SEATS_FULL) {
      for (let x = 0; x < pool.length; x++) {
        if (!frontOffice[x] || x === firstDup) continue;
        winner.best = branch(x, winner.best);
        if (winner.best.seats >= SEATS_FULL) break;
      }
    }
  }

  const chosen = winner.best.chosen;
  const picks: (BestPick | null)[] = Array(8).fill(null);
  let manager: BestManagerPick | null = null;
  const players = chosen.filter((c) => c.item.pick !== null);
  for (const c of chosen) if (c.item.manager !== null) manager = c.item.manager;
  const seats: Record<number, number> = {};
  for (const { item } of players.sort((a, b) => b.item.pick!.war - a.item.pick!.war)) {
    const seat = seats[item.type] ?? 0;
    seats[item.type] = seat + 1;
    picks[SLOT_INDICES[TYPE_ORDER[item.type]][seat]] = item.pick;
  }
  const totalWar = players.reduce((sum, c) => sum + c.item.pick!.war, 0);
  const ownerCard = winner.pair.owner >= 0 ? pool[winner.pair.owner] : null;
  const parkCard = winner.pair.park >= 0 ? pool[winner.pair.park] : null;
  return {
    picks,
    // dp maximizes the finale total; the reported totalWar stays pure WAR.
    totalWar: Math.round(totalWar * 10) / 10,
    manager,
    // Counted off the rail rather than off `chosen`, so this number is the one
    // the finale draws. The two agree — `repair` respects slot capacity, so
    // every chosen player reaches a slot — and reading the rail is what makes
    // any future disagreement show up as a seat short in Study 15 instead of as
    // a man the ⭐ denominator counts and the roster never shows.
    dreamSeats: picks.filter((p) => p !== null).length + (manager !== null ? 1 : 0),
    owner:
      ownerCard === null
        ? null
        : {
            team: ownerCard.team,
            year: ownerCard.year,
            teamName: ownerCard.name,
            franchise: ownerCard.franchise,
            budget: ownerCard.budget,
          },
    park:
      parkCard === null
        ? null
        : {
            team: parkCard.team,
            year: parkCard.year,
            teamName: parkCard.name,
            franchise: parkCard.franchise,
            park: parkCard.park,
            mult: parkCard.stadiumMult,
          },
    budget: winner.pair.budget,
    spend: Math.round(spendOf(chosen) * 10) / 10,
    total: winner.best.total,
    underBudgetTotal: underTotal(),
  };
}

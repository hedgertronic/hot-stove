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
 * 1. ONE PICK PER LANDING, PLUS ONE ✌️. A spin lands on one team-season and
 *    buys one thing — a player, the skipper, the owner, OR the ballpark. So the
 *    yardstick is a club the player could genuinely have drafted, not five 1998
 *    Yankees off a single card. The reel samples with replacement, so the same
 *    card landing twice is two landings and two picks — the pool carries one
 *    entry per landing, never deduped. Double Play is the one exception the game
 *    itself grants, and every game starts holding it: exactly one landing may
 *    supply two things.
 *
 *    A landing is not always one card. 🎟️ Season Ticket, 🚚 Relocate and the
 *    cold-stove respin re-deal the card a landing is standing on, and the
 *    player still leaves that landing holding one card, so both the abandoned
 *    card and its replacement are legal for it and at most one of them may pay
 *    out. `opts.landings` names which cards share a landing; the solver reads
 *    it in the outer wrapper (see `bestRoster` at the bottom of the file), by
 *    enumerating one retained card per landing and solving each resulting pool.
 *    The abandoned card is kept in the pool rather than dropped because
 *    "should you have kept the original?" is a real question about the season,
 *    and the enumeration is what asks it. It also makes the ✌️ rule right for
 *    free: a re-deal REPLACES the card under the player, who holds one of them
 *    at a time, so a doubled reroll landing must spend both picks on the same
 *    card — which is what a pool of one card per landing already says. That is
 *    a fact about the re-deal rather than about landings in general (see the
 *    `Landing` record's `split`), and ⭐ Prime Time, which reaches its season
 *    while the landed card is still held, answers it the other way.
 * 2. ONE SEASON PER HUMAN. The same B-R id may fill only one seat, the same
 *    rule the draft enforces.
 * 3. SLOT CAPACITY. C1 IF2 OF1 FLEX1 SP2 RP1, plus one manager seat.
 * 4. THE FRONT OFFICE COSTS CARDS TOO. Classic bank hires an owner and buys a
 *    ballpark, each off its own card; budget = owner payroll × park multiplier.
 *    Fixed banks (Moneyball, Blank Check) skip both — their cap is a constant.
 * 5. THE MARKET IS WHAT THE PLAYER SAW. Every qualified player on the card,
 *    below-replacement included — the list hides no one, so neither does the
 *    solver — at the listed price.
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
 * ⭐ denominator is that number and not a fixed nine. Across 480 bot games on
 * the classic bank the exception never fires: every finished game reaches nine,
 * which is Study 15's assertion rather than a rate it tolerates. That number is
 * re-measured rather than inherited — Study 15, four arms, 120 games each,
 * 2026-08-13, with landing grouping and `completeClub` both in; every arm
 * printed a mean of 9.000 seats and 0.00% short.
 *
 * WHAT THE CEILING ASSUMES, in one sentence: perfect play of the cards the reel
 * actually showed you — every roster seat, the skipper, the owner and the
 * ballpark chosen with hindsight, one pick per landing plus a ✌️ Double Play
 * second pick off one of them, at list prices. The one off-reel season
 * ⭐ Prime Time reached is charged the pick it really cost: it shares a
 * `split` landing group with the card the reel left under it (see `Landing`
 * and `opts.offReelLandings`), so the two cards pay out at most one item
 * between them unless the ✌️ is spent on that landing — in which case one
 * item may come off each, and nothing else in the pool may double. A game of
 * N landings therefore yields at most N + 1 items, exactly the choices it
 * had. Off-reel cards stay barred from the front office and from being the
 * doubled card themselves. The old accounting — the off-reel card as a free
 * extra on top of every landing — survives only for saves written before the
 * landing was recorded, and measured 3.2 points loose on one recorded game.
 *
 * 🏠 Homegrown is NOT modeled, and the omission is deliberate. Do not "fix"
 * it on the old argument that the discount only lowers payroll and so forfeits
 * bonus — that reasoning is wrong. `budgetBonus` pays most AT the cap, and the
 * discount frees cap the club RE-SPENDS on better seasons: modeling it raised
 * the mean ceiling 2.0 points across 800 bot games (Study 15, four arms,
 * 2026-08-12). It stays unmodeled because it is the last mechanic a player can
 * out-think the search with. Those same 800 games produced ZERO ceiling beats
 * with it modeled, against 4 without — 🦉 OUTSCOUTED is what the accuracy
 * would cost, and the badge won.
 *
 * Re-measured after landing grouping (480 games, 2026-08-13), the badge still
 * pays and still pays for that reason: 2 beats, and BOTH were games that signed
 * a 🏠 season, while the 🏠-off control arm scored none. The omission is not
 * merely tolerated by the beat rate, it is where the beat rate comes from.
 * Re-measured again the same day with ⭐ Prime Time charged its pick (480
 * games): 1 beat, again a 🏠 game, again none in the control arm.
 *
 * Also not modeled: 🔁 Trade Deadline (re-choosing a seat is free to a solver
 * that chose with hindsight).
 *
 * 🎟️/🚚 rerolls and the cold-stove respin ARE modeled, and rule 1 says how:
 * they do not change how many picks the season had, only which card each one
 * came off. They used to inflate the ceiling instead — `land()` records the
 * abandoned card before a re-deal runs and nothing took it back, so the pool
 * read one landing as two and drafted a pick from each.
 *
 * ⭐ Prime Time is modeled the same way, with the one difference rule 1
 * describes: `primeSign` consumes a choice, so the off-reel season costs the
 * landing it was bought from a pick. Prime reaches that season while the
 * landed card is still HELD, so the group's two ✌️ picks may split across its
 * cards — the `split` case — where a reroll's doubled landing spends both on
 * the one card it kept.
 *
 * When the search loses to a real line the finale prints the losing number
 * RAW — the caption must be true of the roster beneath it, and 🦉 OUTSCOUTED
 * needs the beaten number on screen (finale-ceiling.test.ts pins this; the
 * engine's clamped bestPossibleTotal is bookkeeping no surface draws).
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
 * finale on a phone: pass 1 ranks every (owner, ballpark) pair on a fixed
 * budget-INDEPENDENT λ grid (one set of DP solves shared by both orderings of
 * a card pair, since only the cap differs; PROBE_LAMBDAS below says why the
 * grid is mostly negative); pass 2 runs the full sweep and
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
import { eligibleTypes } from "./eligibility";
import {
  AWARD_POINTS,
  BUDGET_BONUS_MAX,
  LUXURY_TAX_PER_M,
  MANAGER_MOTY_POINTS,
  MANAGER_PER_NET_WIN,
  PENNANT_POINTS,
  RING_POINTS,
  SCOUT_HIT_POINTS,
  WBC_CHAMPION_ID,
  WBC_CHAMPION_POINTS,
  WBC_RUNNERUP_ID,
  WBC_RUNNERUP_POINTS,
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
   * same hardware its own squad shows, and `evaluate()` scores the medal the
   * way it scores a ring — a medal the solver dropped OR failed to price
   * would make the ceiling look like it won less than it did. Optional
   * because most player-seasons have none, not because the solver sometimes
   * omits it. */
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
   * skipper. This is the honest ⭐ denominator: with one pick per landing, a
   * game of only 8 landings can never show 9 seats, so a fixed 8-or-9 would
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
  /** Which landing each entry of `cards` arrived on, same index — the engine's
   * `spinCount` at the moment the reel landed. Cards sharing a value are the
   * cards ONE landing cycled through (🎟️ Season Ticket, 🚚 Relocate, the
   * cold-stove respin), and rule 1 lets at most one of them pay out.
   *
   * Absent, or absent for an entry, means one landing per card: that is what a
   * lab fixture wants and what a save written before the field can honestly
   * say. */
  landings?: (number | undefined)[];
  /** Which landing each `offReel` entry's ⭐ Prime Time pick was spent on, same
   * index — `primeSign` consumes the choice of the landing it stands on, and
   * that landing id is what ties the off-reel season to the landed card it
   * shares a pick with (the `split` landing group `bestRoster` builds from it).
   * Absent, or absent for an entry, means the tie is unknown — an old save, or
   * a lab fixture — and the off-reel card rides free the way it always did,
   * which can only read the ceiling HIGH, never low. */
  offReelLandings?: (number | undefined)[];
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
 * grid pass ranks them. Every pair is still solved and scored exactly at
 * every PROBE_LAMBDAS rung; this only bounds the extra refinement.
 *
 * Both shortlist sizes were set against an ORACLE (per-pair fixed-budget
 * solves over pool-minus-office, 60 seeded 12-card shipped pools,
 * 2026-08-10): unbounded refine+double closes every gap, so all residual
 * ceiling error is shortlist coverage. At 24/32 the residual is 10/60 pools
 * short of the oracle, mean 0.9 and max 1.9 points — the honesty bar for
 * OUTSCOUTED, whose false-positive window is exactly this gap. The old 8/2
 * cut measured mean 1.8, max 5.7 on the same pools. Cost: the finale solve
 * runs ~0.35s in node (~1s phone), overlapped by the finale's own staged
 * reveal, and pass 3 is the bulk of it (DOUBLE_PAIRS × pool-size sweeps). */
const REFINE_PAIRS = 24;
/** Front offices that also get the ✌️ Double Play pass, taken from the
 * POST-refine ranking (the resort below) — the doubled card's winner is
 * often a pair the plain solve ranks twenty deep, which is why this list
 * runs past the refine list's own knee (oracle numbers above). */
const DOUBLE_PAIRS = 32;
/** λ bisection steps between "spend everything" and "spend nothing" when the
 * under-cap solve overshoots the cap. Each step is one more DP over ~12 cards;
 * 6 lands within ~1.5% of the crossing. */
const BISECT_STEPS = 6;

const awardPts = (awards: string[]): number =>
  awards.reduce((sum, a) => sum + (AWARD_POINTS[a] ?? 0), 0);

/** Classic medal points from the card's discriminant (2 gold / 1 silver) —
 * ids compared, points returned, the same two-constant discipline scoring.ts
 * documents. */
const wbcPts = (wbc: number | undefined): number =>
  wbc === WBC_CHAMPION_ID
    ? WBC_CHAMPION_POINTS
    : wbc === WBC_RUNNERUP_ID
      ? WBC_RUNNERUP_POINTS
      : 0;

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

/** The market the player actually saw on this card: every qualified player,
 * the same unfiltered list `Game.visiblePlayers` shows. A dream club built out
 * of rows the card never listed is not a club anyone could have drafted, which
 * is why this and the market must read the same card the same way. */
const visible = (card: Card): CardPlayer[] => card.players;

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
      // March's medal is real points like October's ring — unpriced here, a
      // Bregman-class season (ring AND gold) read as 3 points cheaper than
      // the game scores it, and at gold-equals-ring pricing that is a
      // full ring's worth of solver blindness.
      wbcPts(p.wbc) +
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
    // Net wins at full-season strength — the card's proration factor scales
    // short seasons (2020 ×2.706) the same way player WAR already arrives
    // scaled, so the solver prices the dugout on the engine's own terms.
    const netWins = (card.wins - card.losses) * card.prorated;
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

/** `fill` precomputed over every (state, type) — the DP's innermost read,
 * ~2k transitions in a solve that runs thousands of times per finale, so the
 * div/mod pair is paid once here instead of per transition. */
const FILL: Int32Array = (() => {
  const f = new Int32Array(STATES * RADIX.length);
  for (let s = 0; s < STATES; s++)
    for (let t = 0; t < RADIX.length; t++) f[s * RADIX.length + t] = fill(s, t);
  return f;
})();

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
  let wbcChampions = 0;
  let wbcRunnersUp = 0;
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
      if (item.pick.wbc === WBC_CHAMPION_ID) wbcChampions += 1;
      if (item.pick.wbc === WBC_RUNNERUP_ID) wbcRunnersUp += 1;
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
    wbcChampions,
    wbcRunnersUp,
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
  private readonly parents: Int32Array;
  private readonly itemTypes: Int32Array[];
  private readonly itemBases: Float64Array[];
  private readonly itemCosts: Float64Array[];
  private readonly itemPlayerIds: (string | null)[][];
  private readonly optionItems: Int32Array[];
  private readonly optionTypes: Int32Array[];
  private readonly optionBases: Float64Array[];
  private readonly optionLambdaCosts: Float64Array[];
  private readonly optionCounts: Int32Array;
  private readonly byType = new Int32Array(RADIX.length);
  private readonly bestVal = new Float64Array(RADIX.length);
  private readonly bestLambdaCost = new Float64Array(RADIX.length);

  constructor(readonly items: Item[][]) {
    this.parents = new Int32Array(items.length * STATES);
    this.itemTypes = items.map((list) => Int32Array.from(list, (item) => item.type));
    this.itemBases = items.map((list) => Float64Array.from(list, (item) => item.base));
    this.itemCosts = items.map((list) => Float64Array.from(list, (item) => item.cost));
    this.itemPlayerIds = items.map((list) => list.map((item) => item.playerId));
    this.optionItems = items.map(() => new Int32Array(RADIX.length));
    this.optionTypes = items.map(() => new Int32Array(RADIX.length));
    this.optionBases = items.map(() => new Float64Array(RADIX.length));
    this.optionLambdaCosts = items.map(() => new Float64Array(RADIX.length));
    this.optionCounts = new Int32Array(items.length);
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
      this.optionCounts[c] = 0;
      if (skip.includes(c)) continue;
      const types = this.itemTypes[c];
      const bases = this.itemBases[c];
      const costs = this.itemCosts[c];
      const playerIds = this.itemPlayerIds[c];
      const barred = forbidden === null ? null : forbidden[c];
      this.byType.fill(-1);
      for (let i = 0; i < types.length; i++) {
        const playerId = playerIds[i];
        if (playerId !== null && barred !== null && barred.has(playerId)) continue;
        const type = types[i];
        const lambdaCost = lambda * costs[i];
        const v = bases[i] + lambdaCost;
        if (this.byType[type] < 0 || v > this.bestVal[type]) {
          this.byType[type] = i;
          this.bestVal[type] = v;
          this.bestLambdaCost[type] = lambdaCost;
        }
      }
      const optionItems = this.optionItems[c];
      const optionTypes = this.optionTypes[c];
      const optionBases = this.optionBases[c];
      const optionLambdaCosts = this.optionLambdaCosts[c];
      let count = 0;
      for (let type = 0; type < this.byType.length; type++) {
        const i = this.byType[type];
        if (i < 0) continue;
        optionItems[count] = i;
        optionTypes[count] = type;
        optionBases[count] = bases[i];
        optionLambdaCosts[count] = this.bestLambdaCost[type];
        count += 1;
      }
      this.optionCounts[c] = count;
    }

    let dp = this.cur;
    let nxt = this.next;
    dp.fill(-Infinity);
    dp[0] = 0;
    this.parents.fill(-1);
    for (let c = 0; c < n; c++) {
      // Carrying dp forward is the "skip this card" move; its states keep a -1
      // parent, which the unwind reads as "this card supplied nothing".
      nxt.set(dp);
      const parentOffset = c * STATES;
      const optionTypes = this.optionTypes[c];
      const optionBases = this.optionBases[c];
      const optionLambdaCosts = this.optionLambdaCosts[c];
      const optionCount = this.optionCounts[c];
      for (let s = 0; s < STATES; s++) {
        const at = dp[s];
        if (at === -Infinity) continue;
        for (let oi = 0; oi < optionCount; oi++) {
          const ns = FILL[s * 7 + optionTypes[oi]];
          if (ns < 0) continue;
          // The payroll product stays separate so this is exactly
          // ((at + base) + product), the scoring yardstick's operation order.
          const v = at + optionBases[oi] + optionLambdaCosts[oi];
          if (v > nxt[ns]) {
            nxt[ns] = v;
            this.parents[parentOffset + ns] = (s << 3) | oi;
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
      const parent = this.parents[c * STATES + state];
      if (parent < 0) continue; // card skipped, state predates it — walk on unchanged
      const oi = parent & 7;
      chosen.push({ card: c, item: this.items[c][this.optionItems[c][oi]] });
      state = parent >> 3;
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
  cache?: Map<string, Chosen[] | null>,
): { best: Club; bestUnder: Club | null } | null {
  const found: Club[] = [];
  // A probe at a budget-INDEPENDENT λ depends only on (doubled card, skip set,
  // manager floor, λ) — never on which of a card pair owns and which supplies
  // the park — and passes 2 and 3 revisit the same skip set under both
  // orderings' budgets. `cache` shares the post-repair solution between them
  // (the set is normalized, so [o,p] and [p,o] read one entry); the club is
  // still scored EXACTLY against this call's own budget, which is the only
  // budget-dependent step. λ = 20/budget probes and the bisection's midpoints
  // never pass `cacheable`.
  const cacheKey = (lambda: number): string =>
    `${dup}|${[...skip].sort((a, b) => a - b).join(",")}|${forceManager}|${lambda}`;
  const run = (lambda: number, cacheable = false): Chosen[] | null => {
    const key = cacheable && cache !== undefined ? cacheKey(lambda) : null;
    let chosen = key !== null ? cache!.get(key) : undefined;
    if (chosen === undefined) {
      const raw = dp.solve(lambda, skip, null, forceManager);
      chosen = raw === null ? null : repair(raw, dp.items, lambda);
      if (key !== null) cache!.set(key, chosen);
    }
    if (chosen === null) return null;
    found.push(clubOf(chosen, budgetM, dup));
    return chosen;
  };

  const lambdaUnder = budgetM > 0 ? (2 * BUDGET_BONUS_MAX) / budgetM : 0;
  const under = run(lambdaUnder);
  if (under === null) return null;
  run(-LUXURY_TAX_PER_M, true);
  // The third probe is the one that keeps rich owners in the race. λ = 20/budget
  // buys the whole shop and gets taxed for it; λ = −1 buys nothing and forfeits
  // the bonus. Against a $144M cap the club that actually wins is the plain
  // best-players club sitting between them, and without this probe every big
  // bankroll scores as one of its two extremes and loses to a $16M owner whose
  // cheap roster maxes a bonus worth ten points — measured, on a real seed.
  run(0, true);

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
      // Seats first here too: this search is the only one that can hand back a
      // seat `repair` had to vacate, and ranking its leaves on the total alone
      // is exactly how a complete club got discarded for an incomplete one.
      const cand = clubOf(raw, budgetM, dup);
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

/** ANY complete club off this pool under one front office, or null if the pool
 * genuinely cannot field one. Exact: a backtracking search over the nine seats
 * that stops at the first legal club it reaches.
 *
 * This exists because everything above it is a heuristic and rule 6 is not. The
 * sweep relaxes one-season-per-human and hands the gap to `repair`, which can
 * only refill off the conflicting card and so gives back a seat whenever that
 * card carried one usable human; `branchAndBound` wins the seat back, but the
 * recovery pass runs it on the WINNING front office alone. So a pair whose DP
 * solution conflicts at every sampled λ is recorded at eight seats, loses the
 * winner slot to a pair that also reached eight but scored higher, and the nine
 * seats it could legally have filled are never looked for. DOUBLE_PAIRS,
 * MAX_NODES and a front office eating the pool's only catcher can each hide a
 * complete club the same way. None of that is worth fixing in the sweep: the
 * sweep's job is points, and this search's job is the one thing points must
 * never be traded against.
 *
 * It does NOT optimize. The club it returns is the first one the seat order
 * reaches, scored afterwards by the same `clubOf` as every other candidate, and
 * it only ever replaces a club that was a seat short — which `better` already
 * ranks below any complete club, at any total.
 *
 * `dupCard` is the pool entry the ✌️ Double Play buys twice, or −1. Allowance
 * follows `doubled()`: a card the front office took supplies nothing more, and
 * the Double Play adds one pick wherever it lands, so doubling the owner's card
 * buys one roster seat off it and doubling any other card buys two.
 *
 * Seats are taken fewest-candidates-first, and the two upfront rejects below
 * are what stand in for a node cap. They fire on every thin pool in the suite —
 * a three-card fixture fails the allowance count, a `manager: null` pool has no
 * dugout candidate, a pool of catchers has no outfielder — so the pools that
 * reach the backtracking at all are pools where a complete club is plausible
 * and usually immediate. */
function completeClub(
  items: Item[][],
  skip: readonly number[],
  dupCard: number,
): Chosen[] | null {
  const allowance = items.map(
    (_, c) => (skip.includes(c) ? 0 : 1) + (c === dupCard ? 1 : 0),
  );
  if (allowance.reduce((a, b) => a + b, 0) < SEATS_FULL) return null;

  const cands: Chosen[][] = CAPACITY.map(() => []);
  for (let c = 0; c < items.length; c++) {
    if (allowance[c] === 0) continue;
    for (const item of items[c]) cands[item.type].push({ card: c, item });
  }
  // Distinct CARDS, not candidates: five catchers off one card are still one
  // pick, so a type is unreachable whenever fewer cards than seats can supply
  // it — EXCEPT the doubled card, which can seat two of a type by itself
  // whenever it carries two candidates of that type (two same-type items off
  // one card are two distinct humans: `cardItems` yields at most one item per
  // eligible type per player). Without that exception this reject refused
  // legal clubs whose ✌️ was the only way to fill a two-seat type. Counting
  // candidates instead would send an infeasible pool the long way round for
  // the same answer.
  for (let t = 0; t < CAPACITY.length; t++) {
    const supply = new Set(cands[t].map((x) => x.card));
    const dupExtra =
      dupCard >= 0 && cands[t].filter((x) => x.card === dupCard).length >= 2 ? 1 : 0;
    if (supply.size + dupExtra < CAPACITY[t]) return null;
  }

  const order = CAPACITY.map((_, t) => t).sort(
    (a, b) => cands[a].length - cands[b].length || a - b,
  );
  const used = new Set<string>();
  const left = allowance.slice();
  const chosen: Chosen[] = [];
  // The two seats of a doubled type are filled in ascending candidate order, so
  // one pair of men is offered once rather than once per ordering.
  const seat = (oi: number, k: number, start: number): boolean => {
    if (oi === order.length) return true;
    const t = order[oi];
    if (k === CAPACITY[t]) return seat(oi + 1, 0, 0);
    const list = cands[t];
    const rest = CAPACITY[t] - k - 1;
    for (let i = start; i < list.length - rest; i++) {
      const cand = list[i];
      if (left[cand.card] === 0) continue;
      const id = cand.item.playerId;
      if (id !== null && used.has(id)) continue;
      left[cand.card] -= 1;
      if (id !== null) used.add(id);
      chosen.push(cand);
      if (seat(oi, k + 1, i + 1)) return true;
      chosen.pop();
      if (id !== null) used.delete(id);
      left[cand.card] += 1;
    }
    return false;
  };
  return seat(0, 0, 0) ? [...chosen] : null;
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

/** The whole search over ONE pool, which is one card per landing. `bestRoster`
 * below is what guarantees that: it hands this function a pool the rerolled
 * landings have already been resolved out of, so every index here — `options`,
 * `frontOffice`, `pair.owner`, `pair.park`, `dup` — still means one card and
 * one pick, exactly as it did before landings existed.
 *
 * `noDouble` says the ✌️ Double Play is already spent OUTSIDE this function:
 * `bestRoster`'s split-landing variant keeps a ⭐ Prime Time season AND its
 * landed card in the pool, and the second pick that pair costs IS the Double
 * Play. Every doubling pass below is skipped for such a pool — pass 3, the
 * seat-recovery branches, and `completeClub`'s dup enumeration — because a
 * pool that doubled a card on top would spend two Double Plays in one game. */
function solveClub(cards: Card[], opts: BestClubOptions, noDouble = false): BestRoster {
  // One entry per LANDING: a reel that lands twice on the same card spent two
  // spins there and bought from it twice. NOT deduped by team|year — that was
  // the old premise, that a repeat landing was one choice, and it was the cause
  // of the one real 8-seat dream club: a player who drew off both landings
  // built a club the deduped pool was a card short of fielding. Rule 2 still
  // bars the same HUMAN twice, which is the constraint that actually applies.
  const pool: Card[] = [...cards];
  const frontOffice: boolean[] = pool.map(() => true);
  const keys = new Set(pool.map((c) => `${c.team}|${c.year}`));
  for (const card of opts.offReel ?? []) {
    // ⭐ Prime deliberately reaches only cards the reel never landed
    // (engine's candidate gate), so this guard is for malformed callers
    // and old saves rather than a real path.
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
  // Memoized per card: pass 3 asks for the same doubled DP once per PAIR on
  // its shortlist, and a Dp carries ~30 preallocated per-card state arrays —
  // rebuilding one per (pair, card) was pure allocator churn.
  const dupDps = new Map<number, Dp>();
  const doubled = (x: number): Dp => {
    let d = dupDps.get(x);
    if (d === undefined) {
      d = new Dp([...items, items[x]]);
      dupDps.set(x, d);
    }
    return d;
  };

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
  // Pass 1 ranks the front offices on a fixed λ grid, every probe shared by
  // the two orderings of a card pair through one cached DP (only the cap
  // differs between "A owns, B's park" and the reverse) and every club scored
  // EXACTLY under each ordering's own budget. The endpoints alone — the plain
  // best-players club (λ = 0) and the thriftiest one (λ = −1) — are not a
  // ranking: a rich owner's winner lives BETWEEN them, spending up toward his
  // cap, and at the endpoints he only ever shows as the λ = 0 club taxed for
  // buying the whole shop or the λ = −1 club that forfeits the bonus, so he
  // loses the shortlist to a $57M owner whose cheap club maxes its little cap
  // and the sweep that would find his real club never runs. The rungs between
  // the endpoints are a geometric net over the NEGATIVE slopes, because that
  // is where the mid-priced frontier lives: at any λ > 0 the DP rewards every
  // extra dollar and re-buys the whole shop, so a "spend $160M of a $170M
  // cap" club only falls out of λ ∈ (−1, 0) — the same region pass 2's
  // bisection walks — and the net brackets any pair's crossing slope within a
  // factor of two. No positive rungs: λ > 0 only ever re-buys the shop with a
  // bonus-flavored tiebreak, and the one regime that needs it — a cheap pool
  // under a rich cap, worth ≤ the 10-point bonus — is pass 2's exact
  // λ = 20/budget probe, which every shortlisted pair still gets. Measured on
  // a real season (seed 3801105927, a $164M owner among $57M ones): the
  // ceiling read 124.9 from the endpoints alone and 150.1 with the rungs — a
  // 25-point hole in the yardstick the finale prints, hiding that the season
  // had genuinely beaten the ceiling.
  const PROBE_LAMBDAS = [0, -LUXURY_TAX_PER_M, -0.5, -0.25, -0.12, -0.06];
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
      const clubs = [
        plain,
        ...PROBE_LAMBDAS.slice(1).map((l) => dp.solve(l, pair.skip, null, forceManager)),
      ]
        .map((c, k) => (c === null ? null : repair(c, dp.items, PROBE_LAMBDAS[k])))
        .filter((c): c is Chosen[] => c !== null);
      // Neighboring rungs often return the SAME club (a lumpy frontier holds
      // one club across a wide λ span); dedup here so each unique club is
      // exact-scored once per ordering, not once per rung.
      const sig = (c: Chosen[]): string =>
        c.map((x) => `${x.card}:${x.item.type}:${x.item.playerId ?? "m"}`).join("|");
      const seen = new Set<string>();
      probe = {
        clubs: clubs.filter((c) => {
          const s = sig(c);
          if (seen.has(s)) return false;
          seen.add(s);
          return true;
        }),
        manager: forceManager,
      };
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
  // Shared across passes 2 and 3 — see `sweep`. Keyed by (dup, skip set,
  // manager, λ), so a Dp is never read through another's entries.
  const probeCache = new Map<string, Chosen[] | null>();
  for (const { s } of order.slice(0, REFINE_PAIRS)) {
    const refined = sweep(dp, s.pair.budget, s.pair.skip, s.manager, true, -1, probeCache);
    if (refined === null) continue;
    if (better(refined.best, s.best)) s.best = refined.best;
    note(refined.bestUnder);
  }
  // Pass 3 — one card doubled, on the front offices pass 2 left on top:
  // RE-SORTED on the refined totals, because refinement reshuffles the top
  // (a pair whose winner needed the bisection can climb ten places), and the
  // doubled card is worth enough that handing this pass the PRE-refine order
  // measurably leaked ceiling (the oracle harness caught it). The doubled
  // card may be the owner's or the ballpark's: spending both of a Double
  // Play's picks on one spin's card is exactly what the powerup allows.
  const orderRefined = [...order].sort(
    (a, b) =>
      b.s.best.seats - a.s.best.seats || b.s.best.total - a.s.best.total || a.i - b.i,
  );
  if (!noDouble)
    for (const { s } of orderRefined.slice(0, DOUBLE_PAIRS)) {
      for (let x = 0; x < pool.length; x++) {
        // Never the off-reel card: ⭐ Prime Time buys one named season, and
        // doubling it would invent a second pick nobody was ever offered.
        if (!frontOffice[x]) continue;
        const out = sweep(doubled(x), s.pair.budget, s.pair.skip, s.manager, false, x, probeCache);
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
    if (!noDouble && winner.best.seats < SEATS_FULL) {
      for (let x = 0; x < pool.length; x++) {
        if (!frontOffice[x] || x === firstDup) continue;
        winner.best = branch(x, winner.best);
        if (winner.best.seats >= SEATS_FULL) break;
      }
    }
  }

  // Last word on rule 6. Everything above ranks clubs; this only asks whether a
  // complete one exists, and it asks every front office and every ✌️ Double
  // Play rather than the one the ranking left on top. A club it finds is worth
  // fewer points than the eight-seat club it displaces — that is the whole
  // reason the eight-seat club won — and it is still the only one of the two
  // the game would have let anybody finish.
  //
  // Off the common path entirely: a winner already holding nine seats never
  // reaches this, so a finished classic game pays nothing for it.
  if (winner.best.seats < SEATS_FULL) {
    const dups = noDouble
      ? [-1]
      : [-1, ...pool.map((_, i) => i).filter((i) => frontOffice[i])];
    // Feasibility reads the skip SET, so the two orderings of one card pair ask
    // the same question; the second ordering pays only a lookup for it.
    const infeasible = new Set<string>();
    for (const { s } of orderRefined) {
      if (winner.best.seats >= SEATS_FULL) break;
      const key =
        s.pair.skip.length === 2
          ? `${Math.min(...s.pair.skip)}|${Math.max(...s.pair.skip)}`
          : "-";
      for (const d of dups) {
        if (infeasible.has(`${key}|${d}`)) continue;
        const club = completeClub(items, s.pair.skip, d);
        if (club === null) {
          infeasible.add(`${key}|${d}`);
          continue;
        }
        const full = clubOf(club, s.pair.budget, d);
        if (full.spend <= s.pair.budget) note(full);
        winner = { pair: s.pair, best: full, manager: s.manager };
        break;
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

/** Pools the landing enumeration will solve, at most. 🎟️ and 🚚 fire once a
 * game each, so the two of them together are four pools, and a ⭐ split group
 * multiplies by three — six covers either reroll alone beside a ⭐, and both
 * rerolls without one. The cap was 8 when only rerolls bought pools, and
 * across the 480 games of the 2026-08-13 remeasure the reroll product never
 * exceeded 4, so the headroom above 6 was paying wall clock (each pool is a
 * full solve, and the finale has one staged reveal to hide them all behind)
 * for a cold-stove chain no game produced. Measured over 20 bot games per
 * arm, the enumeration
 * costs 2.8× the solves for 1.79× the wall clock — a pool holding one card per
 * landing is a card or two shorter than the raw pool and solves cheaper, so the
 * multiplier a four-pool game pays is nearer three than four.
 *
 * Over the cap, the reroll landings that bought the most pools are PINNED to
 * the last card their group dealt — the card the reel left the player holding,
 * so the pool is the season as played. The ⭐ split group is never pinned (its
 * enumeration is the Prime rule itself), which means the cap is a budget for
 * the REROLL product rather than a hard ceiling on solves: a split group of k
 * landed cards runs k + 2 variants per surviving combination (k retained, one
 * ⭐-only, one both-pay off the last card), so a lone rerolled-then-primed
 * group can run the count past the cap by a couple of solves — bounded by the
 * cold-stove chain length, and accepted rather than pinned because pinning it
 * would pin the Prime rule. The pinning is logged rather than taken quietly,
 * and it only ever takes options away, so the ceiling can read LOW when it
 * binds and never high. */
const MAX_LANDING_POOLS = 6;

/** `better` for a finished club, on the same (seats, total) order — see the
 * long note on `better` for why seat count dominates. */
const betterRoster = (a: BestRoster, b: BestRoster): boolean =>
  (a.dreamSeats ?? 0) !== (b.dreamSeats ?? 0)
    ? (a.dreamSeats ?? 0) > (b.dreamSeats ?? 0)
    : (a.total ?? 0) > (b.total ?? 0);

/** One landing the reel spent more than one card on, and whether the ✌️ Double
 * Play second pick this landing might take may come off a DIFFERENT card of the
 * group than the first.
 *
 * `split` is a property OF THE GROUP rather than a rule of this file, because
 * it is a fact about the mechanism that built the group and the mechanisms
 * disagree. 🎟️ Season Ticket, 🚚 Relocate and the cold-stove respin all
 * REPLACE the card under the player, who therefore only ever holds one of them:
 * a doubled reroll landing spends both picks on the one card it kept, so
 * `split` is false and enumerating a single retained card is what enforces it.
 * ⭐ Prime Time is the same grouping with the opposite answer — `primeSign`
 * spends a pick from the landing it stands on and reaches the off-reel season
 * while the landed card is STILL held, so one landing can genuinely pay out a
 * man from the landed card and another from the season Prime reached.
 *
 * A split group is built from `opts.offReelLandings` — the off-reel season
 * joins the group of the landing whose pick bought it — and enumerated in the
 * wrapper like everything else: per retained landed card, the landed card
 * pays and the ⭐ season goes unbought; once, the ⭐ season pays and the
 * landed card supplies nothing; and for the LAST card the group dealt only,
 * BOTH pay — the ✌️ Double Play spent on this landing with its two picks
 * split across the pair, so that variant's pool is solved with every other
 * doubling barred (`noDouble`). Last card only because that is the card ⭐
 * was really browsed from: every re-deal is refused once the spin's choice
 * is spent, so a card the reroll abandoned was never held together with the
 * ⭐ season and cannot share the ✌️ with it. */
interface Landing {
  cards: number[];
  split: boolean;
}

/** THE DREAM CLUB. See the file header for the objective and every rule.
 *
 * This is rule 1's landing half and nothing else: it resolves each landing that
 * cycled through more than one card down to a single retained card — or, for
 * the ⭐ split group, one of its three payout variants — and hands every
 * resulting pool to `solveClub`. A game that never rerolled and never primed
 * has one card per landing already, so it takes the first branch below and
 * reaches exactly the search it always did.
 *
 * An OUTER WRAPPER rather than a regrouping of the DP, because the DP indexes
 * by card position everywhere — `options[c]`, `frontOffice[c]`, `pair.owner`,
 * `pair.park`, `dup` — and a pool of one card per landing keeps every one of
 * those meanings intact. It also settles the ✌️ Double Play question for a
 * `split: false` group for free: the doubled card is a card, so such a landing
 * spends both picks on the single card it retained.
 *
 * Deterministic like the rest of the file: groups in first-card order, cards
 * within a group in pool order, an odometer over them, and strict improvement,
 * so the first club found at a given (seats, total) is the one that survives. */
export function bestRoster(cards: Card[], opts: BestClubOptions = {}): BestRoster {
  const landings = opts.landings ?? [];
  const groups = new Map<number, Landing>();
  for (let i = 0; i < cards.length; i++) {
    // A card with no landing id is its own landing. The synthetic id is
    // NEGATIVE so it can never collide with a real `spinCount`: a save written
    // before the field keeps its fieldless entries and then goes on playing, so
    // one array holds both kinds, and an index-shaped synthetic would merge an
    // old entry with the landing that happens to carry its number.
    const id = landings[i] ?? -1 - i;
    const g = groups.get(id);
    // A landed-card id names a reroll landing, and a reroll hands the player
    // one card at a time. ⭐ Prime Time is the mechanism that groups cards the
    // player holds AT ONCE, and it joins below through `offReelLandings`.
    if (g === undefined) groups.set(id, { cards: [i], split: false });
    else g.cards.push(i);
  }

  // ⭐ Prime Time's off-reel season joins the landing whose pick bought it —
  // `primeSign` spends that landing's choice — making it a split group. ⭐
  // fires once a game, so at most one group ever splits; an off-reel entry
  // with no id, or an id no landed card carries, rides free the way it always
  // did, which is what an old save can honestly claim.
  const offReel = opts.offReel ?? [];
  const offIds = opts.offReelLandings ?? [];
  let split: Landing | null = null;
  let splitOff = -1;
  for (let j = 0; j < offReel.length && split === null; j++) {
    const id = offIds[j];
    if (id === undefined) continue;
    const g = groups.get(id);
    if (g === undefined) continue;
    g.split = true;
    split = g;
    splitOff = j;
  }

  const multi = [...groups.values()].filter((g) => g.cards.length > 1);
  if (multi.length === 0 && split === null) return solveClub(cards, opts);

  // Pin the biggest groups first: they are the ones buying the most pools, so
  // pinning them keeps the most of the enumeration alive per landing given up.
  // Never the split group — its enumeration is the ⭐ rule itself, and its
  // variants are the cheap ones (one pool solves without the doubling pass,
  // one is a card smaller), so a reroll group is always the better sacrifice.
  const drop = new Set<number>();
  const pinned: Landing[] = [];
  const costliest = [...multi]
    .filter((g) => g !== split)
    .sort((a, b) => b.cards.length - a.cards.length || a.cards[0] - b.cards[0]);
  let pools = multi.reduce((n, g) => n * g.cards.length, 1);
  const splitFactor = split === null ? 1 : 3;
  while (pools * splitFactor > MAX_LANDING_POOLS && costliest.length > 0) {
    const g = costliest.shift()!;
    pools /= g.cards.length;
    pinned.push(g);
    for (const i of g.cards.slice(0, -1)) drop.add(i);
  }
  if (pinned.length > 0)
    console.warn(
      "hot stove: dream solver pinned rerolled landings to the card played, " +
        `over the ${MAX_LANDING_POOLS}-pool cap:`,
      pinned.map((g) =>
        g.cards.slice(0, -1).map((i) => `${cards[i].team}_${cards[i].year}`).join("/"),
      ),
    );

  const open = multi.filter((g) => !pinned.includes(g));
  let best: BestRoster | null = null;
  // `underBudgetTotal` rides along with the club that won rather than being
  // maxed across pools: it is the best under-cap total among the clubs THIS
  // club was chosen from, and a figure lifted out of a losing pool could
  // exceed the winner's own total, which is a thing it is never allowed to do.
  const consider = (club: BestRoster): void => {
    if (best === null || betterRoster(club, best)) best = club;
  };
  const solveOne = (skip: Set<number>, off: Card[], noDouble: boolean): void =>
    consider(
      solveClub(
        cards.filter((_, i) => !skip.has(i)),
        off === offReel ? opts : { ...opts, offReel: off },
        noDouble,
      ),
    );
  for (let n = 0; n < pools; n++) {
    const skip = new Set<number>(drop);
    let splitKeep = -1; // retained landed card of the split group, this pool
    let splitFirst = true; // first retained choice — dedups the ⭐-only variant
    let rest = n;
    for (const g of open) {
      const keep = rest % g.cards.length;
      rest = Math.floor(rest / g.cards.length);
      for (let j = 0; j < g.cards.length; j++) if (j !== keep) skip.add(g.cards[j]);
      if (g === split) {
        splitKeep = g.cards[keep];
        splitFirst = keep === 0;
      }
    }
    if (split === null) {
      solveOne(skip, offReel, false);
      continue;
    }
    // A split group of one landed card never enters `open`; its one retained
    // choice is that card.
    if (splitKeep < 0) splitKeep = split.cards[split.cards.length - 1];
    // (a) The landed card keeps the landing's pick; the ⭐ season goes unbought.
    solveOne(skip, offReel.filter((_, j) => j !== splitOff), false);
    // (b) BOTH pay out — the ✌️ Double Play spent here, split across the pair,
    //     so no card in this pool may double on top of it. ONLY with the card
    //     ⭐ was really reached from, the LAST card the group dealt: every
    //     re-deal is refused once the spin's choice is spent (the engine's
    //     choicesUsed gates), so Prime always fires from the card the reel
    //     left the player holding — a split with a card the reroll abandoned
    //     would pair the ⭐ season with a card it could never have been
    //     browsed from.
    if (splitKeep === split.cards[split.cards.length - 1])
      solveOne(skip, offReel, true);
    // (c) The ⭐ season is the landing's one pick; the landed card supplies
    //     nothing. Once every landed card of the group is dropped the retained
    //     choice no longer matters, so this runs once per odometer family.
    if (splitFirst) {
      const s2 = new Set(skip);
      s2.add(splitKeep);
      solveOne(s2, offReel, false);
    }
  }
  return best!;
}
/** Test-only handles. `completeClub` is rule 6's backstop, and the pools where
 * its upfront feasibility rejects decide anything are exactly the pools the
 * heuristic passes already solve on their own through `bestRoster` — so the
 * invariant those rejects must respect is pinned at this level instead. Not
 * public API; nothing outside the tests may import it. */
export const _internals = { cardItems, completeClub };

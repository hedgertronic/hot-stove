/** Game state machine. Implements SPEC.md's rules, DECISIONS.md's gap fills.
 * All gameplay randomness flows through `this.rng` (one mulberry32 stream per
 * seed). The displayed record is deterministic (rounded expected wins). */
import { bestRoster, type BestRoster } from "./bestroster";
import { loadCard, loadSpecials, ownerFor } from "./data";
import { eligibleTypes } from "./eligibility";
import { Rng, randomSeed } from "./rng";
import { MANAGER_MOTY_POINTS, MANAGER_PER_NET_WIN, displayRecord, score } from "./scoring";
import { SLOT_TYPES } from "./types";
import type {
  Card,
  CardPlayer,
  GameIndex,
  IndexEntry,
  Meta,
  Owners,
  ScoreParts,
  SpecialSeason,
} from "./types";

export { SLOT_TYPES };

export type Phase = "preSpin" | "spinning" | "landed" | "finale";
export type PowerupKey =
  | "seasonTicket"
  | "relocate"
  | "doublePlay"
  | "tradeDeadline"
  | "prime"
  | "hometown";
export type PowerupState = "ready" | "armed" | "spent";
export type PlayerRowState = "open" | "dead";

export type Difficulty = "standard" | "scout";
export type Bank = "classic" | "moneyball" | "blankcheck";

export interface GameConfig {
  difficulty: Difficulty;
  bank: Bank;
}

export const DEFAULT_CONFIG: GameConfig = { difficulty: "standard", bank: "classic" };

/** 2002 A's top-4 contracts (Dye/Justice/Durham/Tejada) through the bankroll
 * curve (widen × scale) — must equal the OAK_2002 card's budget. */
export const MONEYBALL_BUDGET_M = 51.5;
/** 2005 Yankees top-4 — the fattest payroll in the league — through the same
 * curve — must equal the NYY_2005 card's budget. */
export const BLANK_CHECK_BUDGET_M = 203.2;

/** What the reel animates on a given spin: powerup rerolls hold the other
 * half of the banner constant (Season Ticket keeps the team, Relocate keeps
 * the year). */
export type SpinKind = "full" | "year" | "team";

export interface Signed {
  id: string;
  name: string;
  pos: string;
  war: number;
  awards: string[];
  ws: boolean;
  pen: boolean;
  year: number;
  team: string;
  teamName: string;
  franchise: string;
  costPaid: number;
  /** Signed at the 🏠 Homegrown flat price. (The field name predates the
   * powerup; it stays for save and finale compatibility.) */
  hero: boolean;
  prorated: number;
}

export interface OwnerPick {
  name: string;
  budget: number;
  franchise: string;
  year: number;
  teamName: string;
}

export interface StadiumPick {
  park: string;
  mult: number;
  franchise: string;
  year: number;
}

export interface ManagerPick {
  name: string;
  wins: number;
  losses: number;
  year: number;
  team: string;
  teamName: string;
  ws: boolean;
  pen: boolean;
  /** Won the BBWAA Manager of the Year that season (+2 trophy-case points).
   * Optional so pre-MotY saves restore as-is (absent reads as false). */
  moty?: boolean;
}

/** The most valuable manager among every card this game landed on:
 * maximizes netWins × 0.1 + (MotY ? 2 : 0), the skipper's full score value. */
export interface BestManager {
  name: string;
  team: string;
  year: number;
  teamName: string;
  ws: boolean;
  pen: boolean;
  netWins: number;
  moty?: boolean;
}

export type SpecialKey = "owner" | "stadium" | "manager";

export interface SpinLogEntry {
  kind: "sign" | "owner" | "stadium" | "manager" | "swap";
  war?: number;
}

export interface FinaleResult {
  parts: ScoreParts;
  wins: number;
  losses: number;
  spend: number;
  budget: number;
  spinCount: number;
  totalWar: number;
  /** WAR-optimal roster over every card this game landed on (null if the
   * cards couldn't be reloaded — score falls back to zero scout hits). */
  best: BestRoster | null;
  bestManager: BestManager | null;
  /** True when the hired manager IS the dream team's manager. */
  managerHit: boolean;
  scoutHits: number;
}

/** 🏠 Homegrown's flat sticker price ($1.0M normalized), clamped per-player
 * to the listed price — the discount must never cost MORE than a plain sign
 * (floor-priced players in cheap-floor years list below $1M). */
export const HOMEGROWN_PRICE_M = 1.0;

const SAVE_KEY = "hotstove.current";
const HISTORY_KEY = "hotstove.history";
/** v5 = 🏠 Homegrown is a sixth powerup; v4 saves migrate on restore
 * (heroUsed → the hometown powerup's ready/spent state). */
const SAVE_VERSION = 5;

export class Game {
  meta: Meta;
  index: GameIndex;
  owners: Owners;
  seed: number;
  rng: Rng;
  config: GameConfig;

  phase = $state<Phase>("preSpin");
  card = $state<Card | null>(null);
  slots = $state<(Signed | null)[]>(Array(SLOT_TYPES.length).fill(null));
  owner = $state<OwnerPick | null>(null);
  stadium = $state<StadiumPick | null>(null);
  manager = $state<ManagerPick | null>(null);
  powerups = $state<Record<PowerupKey, PowerupState>>({
    seasonTicket: "ready",
    relocate: "ready",
    doublePlay: "ready",
    tradeDeadline: "ready",
    prime: "ready",
    hometown: "ready",
  });
  choicesLeft = $state(0);
  choicesUsed = $state(0);
  spinCount = $state(0);
  spinLog = $state<SpinLogEntry[]>([]);
  spinKind = $state<SpinKind>("full");
  /** Every distinct card this game has landed on — the scouting yardstick. */
  seen = $state<{ team: string; year: number }[]>([]);
  /** Sign-time slot ambiguity: rail becomes a slot picker for this player. */
  slotPick = $state<string | null>(null);
  /** TD release picker: rail cells the incoming player could replace. */
  releasePick = $state<string | null>(null);
  /** Prime picker: id of the LISTED player whose career is being browsed. */
  primePick = $state<string | null>(null);
  /** Prime picker, front-office flavor: the manager tile is the only
   * browsable special — owner and stadium are never Prime targets. */
  primeSpecial = $state<"manager" | null>(null);
  finale = $state<FinaleResult | null>(null);
  /** The pending card's fetch failed (connection dropped mid-spin) — the
   * banner offers a retry instead of leaving the reel spinning forever. */
  loadFailed = $state(false);

  private pendingCard: Promise<Card> | null = null;
  private pendingEntry: IndexEntry | null = null;

  constructor(
    meta: Meta,
    index: GameIndex,
    owners: Owners,
    seed?: number,
    config: GameConfig = DEFAULT_CONFIG,
  ) {
    this.meta = meta;
    this.index = index;
    this.owners = owners;
    this.seed = seed ?? randomSeed();
    this.rng = new Rng(this.seed);
    this.config = { ...config };
  }

  // ---------- mode visibility (difficulty ladder) ----------

  get showWar(): boolean {
    return this.config.difficulty === "standard";
  }

  /** Salary shows in every difficulty — Eye Test hides talent signals (WAR,
   * awards), not the price tag; the cap game is the same either way. */
  get showCost(): boolean {
    return true;
  }

  get showAwards(): boolean {
    return this.config.difficulty === "standard";
  }

  get scout(): boolean {
    return this.config.difficulty === "scout";
  }

  /** Moneyball and Blank Check are fixed-cap modes: no owners, no stadiums. */
  get fixedCap(): boolean {
    return this.config.bank !== "classic";
  }

  // ---------- derived ----------

  get rosterFull(): boolean {
    return this.slots.every((s) => s !== null);
  }

  /** The club is complete when every seat that can be filled is: the whole
   * roster, a manager, and (classic bank only) an owner and a stadium. The
   * game keeps spinning until this is true. */
  get complete(): boolean {
    return (
      this.rosterFull &&
      this.manager !== null &&
      (this.fixedCap || (this.owner !== null && this.stadium !== null))
    );
  }

  get totalWar(): number {
    return this.slots.reduce((sum, s) => sum + (s?.war ?? 0), 0);
  }

  /** 💍/🚩 season counts across the signed club, manager included — the one
   * tally scoring, the finale chips, and the share string all read. */
  get pedigree(): { rings: number; pennants: number } {
    return {
      rings: this.slots.filter((s) => s?.ws).length + (this.manager?.ws ? 1 : 0),
      pennants: this.slots.filter((s) => s?.pen).length + (this.manager?.pen ? 1 : 0),
    };
  }

  get spend(): number {
    return this.slots.reduce((sum, s) => sum + (s?.costPaid ?? 0), 0);
  }

  get effectiveBudget(): number {
    if (this.config.bank === "moneyball") return MONEYBALL_BUDGET_M;
    if (this.config.bank === "blankcheck") return BLANK_CHECK_BUDGET_M;
    return (this.owner?.budget ?? this.meta.minBudget) * (this.stadium?.mult ?? 1);
  }

  /** Whether the cap means anything yet: fixed banks always; Owner's Box only
   * once an owner is hired. Before that, effectiveBudget falls back to the
   * league-minimum floor (meta.minBudget) — real math, but not the player's
   * cap, so the UI shouldn't present it as one. */
  get capKnown(): boolean {
    return this.fixedCap || this.owner !== null;
  }


  get ownerName(): string {
    if (!this.card) return "";
    return ownerFor(this.owners, this.card.franchise, this.card.year);
  }

  get managerAvailable(): boolean {
    return this.card?.manager != null;
  }

  /** Open slot indices a player could fill right now, specialist types first. */
  openSlotsFor(p: CardPlayer): number[] {
    const types = eligibleTypes(p);
    return SLOT_TYPES.map((t, i) => i).filter(
      (i) => this.slots[i] === null && types.includes(SLOT_TYPES[i]),
    );
  }

  /** One human per roster, any season (B-R ids are stable across years). */
  isRostered(p: CardPlayer): boolean {
    return this.slots.some((s) => s?.id === p.id);
  }

  playerState(p: CardPlayer): PlayerRowState {
    if (this.isRostered(p)) return "dead";
    return this.openSlotsFor(p).length > 0 ? "open" : "dead";
  }

  /** Card players the list actually shows: below-replacement (negative WAR)
   * rows are hidden, EXCEPT the best player at any position that would
   * otherwise vanish entirely — a roster hunting a C or RP always has at
   * least one candidate. Career sheets (Prime Time) are unaffected. */
  get visiblePlayers(): CardPlayer[] {
    if (!this.card) return [];
    const ps = this.card.players;
    const rescued = new Set<string>();
    for (const pos of new Set(ps.map((p) => p.pos))) {
      const atPos = ps.filter((p) => p.pos === pos);
      if (atPos.some((p) => p.war >= 0)) continue;
      rescued.add(atPos.reduce((a, b) => (b.war > a.war ? b : a)).id);
    }
    return ps.filter((p) => p.war >= 0 || rescued.has(p.id));
  }

  /** Whether a listed row is tappable right now — the single gate the UI
   * uses for signing, Trade Deadline swaps, AND Prime Time browsing (an
   * armed Prime follows the same gray-out rules as a plain sign). */
  rowPlayable(p: CardPlayer): boolean {
    if (this.phase !== "landed" || this.choicesLeft === 0) return false;
    if (this.hometownBlocks(p)) return false;
    return this.playerState(p) === "open" || this.tdCandidate(p);
  }

  /** An armed 🏠 filters the market like Trade Deadline filters seats: only
   * debut-eligible rows stay live; every other unsigned row is hard-gray and
   * untappable until the discount is disarmed. */
  private hometownBlocks(p: CardPlayer): boolean {
    return this.powerups.hometown === "armed" && !this.discountEligible(p);
  }

  /** Whether an armed Trade Deadline claims this row's tap: any unrostered
   * player with at least one occupied eligible seat is a trade candidate —
   * even when an open seat could also take them directly (a catcher can
   * replace the rostered C while the FLEX seat sits open; disarm to sign
   * plainly into the open seat instead). */
  tdCandidate(p: CardPlayer): boolean {
    return (
      this.powerups.tradeDeadline === "armed" &&
      !this.hometownBlocks(p) &&
      !this.isRostered(p) &&
      this.occupiedSlotsFor(p).length > 0
    );
  }

  /** Whether an armed 🏠 Homegrown reprices this row: the player debuted
   * with the current spin's franchise. Signing gates (rostered, no open
   * seat) are handled by the usual tappability rules, not here. */
  discountEligible(p: CardPlayer): boolean {
    return (
      this.powerups.hometown === "armed" && this.card !== null && p.debut === this.card.franchise
    );
  }

  priceFor(p: CardPlayer): number {
    return this.discountEligible(p) ? Math.min(HOMEGROWN_PRICE_M, p.cost) : p.cost;
  }

  /** Occupied slot indices the incoming player could replace (TD). */
  occupiedSlotsFor(p: CardPlayer): number[] {
    const types = eligibleTypes(p);
    return SLOT_TYPES.map((t, i) => i).filter(
      (i) => this.slots[i] !== null && types.includes(SLOT_TYPES[i]),
    );
  }

  specialTaken(which: SpecialKey): boolean {
    return { owner: this.owner, stadium: this.stadium, manager: this.manager }[which] !== null;
  }

  /** Can any choice still be committed on this card? (DECISIONS.md #3) */
  anyActionable(): boolean {
    if (!this.card) return false;
    const specialsOpen = this.fixedCap
      ? !this.manager && this.managerAvailable
      : !this.owner || !this.stadium || (!this.manager && this.managerAvailable);
    if (specialsOpen) return true;
    if (!this.rosterFull && this.visiblePlayers.some((p) => this.playerState(p) === "open"))
      return true;
    if (this.powerups.tradeDeadline !== "spent") {
      if (this.visiblePlayers.some((p) => this.playerState(p) === "dead" && !this.isRostered(p)))
        return true;
      if (this.owner || this.stadium || (this.manager && this.managerAvailable)) return true;
    }
    return false;
  }

  /** Dead spin: landed, nothing committed, nothing possible → free respin. */
  get coldStove(): boolean {
    return this.phase === "landed" && this.choicesUsed === 0 && !this.anyActionable();
  }

  // ---------- spin flow ----------

  /** Begin a spin. UI animates the reel, then awaits land(). Stray taps
   * (double-tap on SPIN, taps mid-animation) are no-ops, never errors. */
  spin(): void {
    if (this.phase !== "preSpin") return;
    this.disarmToggles();
    const entry = this.rng.pick(this.index.cards);
    this.beginSpin(entry, "full");
  }

  private beginSpin(entry: IndexEntry, kind: SpinKind): void {
    this.phase = "spinning";
    this.spinKind = kind;
    this.spinCount += 1;
    this.pendingEntry = entry;
    this.loadFailed = false;
    this.pendingCard = loadCard(entry.team, entry.year);
  }

  /** Re-issue a failed card fetch (the cache evicts rejections, so this hits
   * the network again). The caller awaits land() afterward, same as a spin. */
  retrySpin(): void {
    if (!this.loadFailed || !this.pendingEntry) return;
    this.loadFailed = false;
    this.pendingCard = loadCard(this.pendingEntry.team, this.pendingEntry.year);
  }

  async land(): Promise<void> {
    if (!this.pendingCard) return;
    try {
      this.card = await this.pendingCard;
    } catch {
      this.pendingCard = null;
      this.loadFailed = true;
      return;
    }
    this.pendingCard = null;
    this.phase = "landed";
    this.choicesLeft = 1;
    this.choicesUsed = 0;
    if (!this.seen.some((s) => s.team === this.card!.team && s.year === this.card!.year))
      this.seen = [...this.seen, { team: this.card.team, year: this.card.year }];
    this.clearTransients();
    this.save();
  }

  // ---------- powerups ----------

  yearsForFranchise(franchise: string): number[] {
    return this.index.cards
      .filter((c) => c.franchise === franchise)
      .map((c) => c.year)
      .sort((a, b) => a - b);
  }

  /** Season Ticket grid decoration: year → "ws" | "pen" for this franchise's
   * flagged seasons (era-correct team codes come free — the index rows carry
   * the flags). Unflagged years are simply absent. */
  yearPedigree(franchise: string): Record<number, "ws" | "pen"> {
    const out: Record<number, "ws" | "pen"> = {};
    for (const c of this.index.cards) {
      if (c.franchise !== franchise) continue;
      if (c.ws) out[c.year] = "ws";
      else if (c.pen) out[c.year] = "pen";
    }
    return out;
  }

  /** 🎟️ Season Ticket: re-pick any other season of this franchise. Pre-choice only. */
  seasonTicket(year: number): void {
    if (this.phase !== "landed" || this.powerups.seasonTicket !== "ready") return;
    if (this.choicesUsed > 0 || !this.card || year === this.card.year) return;
    const entry = this.index.cards.find(
      (c) => c.franchise === this.card!.franchise && c.year === year,
    );
    if (!entry) return;
    this.powerups.seasonTicket = "spent";
    this.disarmToggles();
    this.spinCount -= 1; // same spin, new card
    this.beginSpin(entry, "year");
  }

  /** Teams available to Relocate to (any club, same season). */
  teamsForYear(year: number): IndexEntry[] {
    return this.index.cards
      .filter((c) => c.year === year)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 🚚 Relocate: re-pick any other team from this same season. Pre-choice only. */
  relocate(team: string): void {
    if (this.phase !== "landed" || this.powerups.relocate !== "ready") return;
    if (this.choicesUsed > 0 || !this.card || team === this.card.team) return;
    const entry = this.index.cards.find((c) => c.year === this.card!.year && c.team === team);
    if (!entry) return;
    this.powerups.relocate = "spent";
    this.disarmToggles();
    this.spinCount -= 1;
    this.beginSpin(entry, "team");
  }

  /** ✌️ Double Play: arming grants a second choice this spin. Only consumed
   * when the SECOND pick actually commits — disarming or moving on with one
   * pick refunds it. */
  toggleDoublePlay(): void {
    if (this.phase !== "landed") return;
    if (this.powerups.doublePlay === "ready") {
      if (this.choicesUsed > 0) return;
      this.powerups.doublePlay = "armed";
      this.choicesLeft += 1;
    } else if (this.powerups.doublePlay === "armed") {
      this.powerups.doublePlay = "ready";
      this.choicesLeft -= 1;
      if (this.choicesLeft === 0 && this.choicesUsed > 0) {
        this.endSpin();
        return;
      }
    }
    this.save();
  }

  /** 🔁 Trade Deadline arming toggle: gray rows become swappable. */
  toggleTradeDeadline(): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (this.powerups.tradeDeadline === "ready") {
      this.powerups.tradeDeadline = "armed";
    } else if (this.powerups.tradeDeadline === "armed") {
      this.powerups.tradeDeadline = "ready";
      this.releasePick = null;
    }
    this.save();
  }

  /** ⭐ Prime Time arming toggle: listed (unsigned) players become
   * career-browsable. Browsing costs nothing until a season is signed. */
  togglePrime(): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (this.powerups.prime === "ready") {
      this.powerups.prime = "armed";
    } else if (this.powerups.prime === "armed") {
      this.powerups.prime = "ready";
      this.primePick = null;
      this.primeSpecial = null;
    }
    this.save();
  }

  get primeArmed(): boolean {
    return this.powerups.prime === "armed";
  }

  /** 🏠 Homegrown arming toggle (the hometown discount): while armed, the
   * market filters to unsigned players who DEBUTED with this spin's
   * franchise, repriced to the flat HOMEGROWN_PRICE_M; every other row
   * grays. Signing one at the discount spends the powerup; disarming
   * restores the list without spending it. A card with no debut-eligible
   * players still arms — the whole list grays until disarm. (The internal
   * powerup key stays "hometown".) */
  toggleHometown(): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (this.powerups.hometown === "ready") {
      this.powerups.hometown = "armed";
    } else if (this.powerups.hometown === "armed") {
      this.powerups.hometown = "ready";
    }
    this.save();
  }

  /** Armed Prime, tap a listed player: browse their whole career. */
  primeTapPlayer(p: CardPlayer): void {
    if (!this.primeArmed || this.isRostered(p)) return;
    this.primePick = p.id;
  }

  /** Armed Prime, tap the OPEN manager tile: browse that skipper's whole
   * career. Prime targets are PLAYERS and MANAGERS only — owner and stadium
   * tiles never open a timeline (DECISIONS.md Round 17: owner-Priming was
   * pure bank-shopping, and banning it is score-neutral). A taken tile
   * isn't browsable — the seat is filled. */
  primeTapSpecial(which: SpecialKey): void {
    if (which !== "manager") return;
    if (!this.primeArmed || this.specialTaken(which) || !this.card) return;
    if (!this.managerAvailable) return;
    this.primeSpecial = which;
  }

  /** Sign a DIFFERENT season of the browsed player's career, at that season's
   * real cost. Consumes both the powerup and the spin's choice. Slot ambiguity
   * auto-resolves (first open specialist seat, else first open seat) — no
   * nested picker inside the career sheet. The browsed card does not count as
   * scouted (`seen`): only cards the reel landed on do. */
  async applyPrime(team: string, year: number): Promise<boolean> {
    if (this.powerups.prime !== "armed" || this.primePick === null) return false;
    if (this.phase !== "landed" || this.choicesLeft === 0) return false;
    const id = this.primePick;
    if (this.slots.some((s) => s?.id === id)) return false;
    const card = await loadCard(team, year);
    const p = card.players.find((pl) => pl.id === id);
    if (!p) return false;
    const open = this.openSlotsFor(p);
    if (open.length === 0) return false;
    const specialist = open.filter((i) => SLOT_TYPES[i] !== "FLEX");
    const idx = specialist.length > 0 ? specialist[0] : open[0];
    this.slots[idx] = this.makeSigned(card, p, p.cost, false);
    this.powerups.prime = "spent";
    this.primePick = null;
    this.consumeChoice({ kind: "sign", war: p.war });
    return true;
  }

  /** Hire a DIFFERENT season of the browsed manager's career — that
   * season's record, with pedigree flags (💍/🚩) from the index rows.
   * Mirrors applyPrime: consumes the powerup and the spin's choice. The
   * manager is Prime's only front-office target (see primeTapSpecial). */
  async applyPrimeSpecial(team: string, year: number): Promise<boolean> {
    if (this.powerups.prime !== "armed" || this.primeSpecial !== "manager") return false;
    if (this.phase !== "landed" || this.choicesLeft === 0) return false;
    if (this.specialTaken("manager")) return false;
    const specials = await loadSpecials();
    let entry: SpecialSeason | undefined;
    for (const list of Object.values(specials)) {
      const e = list.find((s) => s.team === team && s.year === year);
      if (e) {
        entry = e;
        break;
      }
    }
    if (!entry || entry.mgr == null) return false;
    const idx = this.index.cards.find((c) => c.team === team && c.year === year);
    this.manager = {
      name: entry.mgr,
      wins: entry.w,
      losses: entry.l,
      year,
      team,
      teamName: entry.name,
      ws: idx?.ws === true,
      pen: idx?.pen === true,
      moty: entry.moty === true,
    };
    this.powerups.prime = "spent";
    this.primeSpecial = null;
    this.consumeChoice({ kind: "manager" });
    return true;
  }

  private disarmToggles(): void {
    if (this.powerups.doublePlay === "armed") {
      this.powerups.doublePlay = "ready";
      this.choicesLeft = Math.max(0, this.choicesLeft - 1);
    }
    if (this.powerups.tradeDeadline === "armed") this.powerups.tradeDeadline = "ready";
    if (this.powerups.prime === "armed") this.powerups.prime = "ready";
    if (this.powerups.hometown === "armed") this.powerups.hometown = "ready";
    this.clearTransients();
  }

  private clearTransients(): void {
    this.slotPick = null;
    this.releasePick = null;
    this.primePick = null;
    this.primeSpecial = null;
  }

  // ---------- choices ----------

  private makeSigned(c: Card, p: CardPlayer, costPaid: number, discounted: boolean): Signed {
    return {
      id: p.id,
      name: p.name,
      pos: p.pos,
      war: p.war,
      awards: p.awards,
      ws: p.ws,
      pen: p.pen,
      year: c.year,
      team: c.team,
      teamName: c.name,
      franchise: c.franchise,
      costPaid,
      hero: discounted,
      prorated: c.prorated,
    };
  }

  private consumeChoice(entry: SpinLogEntry): void {
    this.choicesUsed += 1;
    this.choicesLeft -= 1;
    // Double Play burns only when its second pick lands.
    if (this.powerups.doublePlay === "armed" && this.choicesUsed >= 2)
      this.powerups.doublePlay = "spent";
    this.spinLog = [...this.spinLog, entry];
    this.clearTransients();
    if (this.choicesLeft === 0 || !this.anyActionable()) this.endSpin();
    else this.save();
  }

  /** Forfeit a remaining Double Play pick and move on (DP refunds). The UI
   * has no button for this — disarming the ✌️ pill is the player's exit —
   * but bots and tests use it as the programmatic equivalent. */
  finishSpin(): void {
    if (this.phase !== "landed" || this.choicesUsed === 0) return;
    this.endSpin();
  }

  /** Free respin out of a dead card. */
  coldRespin(): void {
    if (!this.coldStove) return;
    this.spinCount -= 1;
    this.phase = "preSpin";
    this.save();
  }

  private endSpin(): void {
    if (this.powerups.doublePlay === "armed") this.powerups.doublePlay = "ready";
    if (this.powerups.tradeDeadline === "armed") this.powerups.tradeDeadline = "ready";
    if (this.powerups.prime === "armed") this.powerups.prime = "ready";
    if (this.powerups.hometown === "armed") this.powerups.hometown = "ready";
    if (this.complete) {
      // A complete club ends the game — unspent powerups are just left money.
      void this.finishGame();
    } else {
      this.phase = "preSpin";
      this.save();
    }
  }

  /** Sign an open player. When more than one specialist slot type is open the
   * rail becomes a slot picker (DECISIONS.md #4) — re-call with slotIdx. */
  signPlayer(p: CardPlayer, slotIdx?: number): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (this.hometownBlocks(p)) return;
    if (this.playerState(p) !== "open") return;
    const open = this.openSlotsFor(p);
    const specialist = open.filter((i) => SLOT_TYPES[i] !== "FLEX");
    let idx: number;
    if (slotIdx !== undefined) {
      if (!open.includes(slotIdx)) return;
      idx = slotIdx;
    } else if (specialist.length === 0) {
      idx = open[0]; // FLEX only
    } else {
      const types = new Set(specialist.map((i) => SLOT_TYPES[i]));
      if (types.size === 1) idx = specialist[0];
      else {
        this.slotPick = p.id; // ambiguous: rail picker
        this.save();
        return;
      }
    }
    const discounted = this.discountEligible(p);
    this.slots[idx] = this.makeSigned(this.card!, p, this.priceFor(p), discounted);
    if (discounted) this.powerups.hometown = "spent";
    this.consumeChoice({ kind: "sign", war: p.war });
  }

  /** Rail cells pickable during slotPick: open eligible specialist cells. */
  pickableSlotCells(p: CardPlayer): number[] {
    const specialist = this.openSlotsFor(p).filter((i) => SLOT_TYPES[i] !== "FLEX");
    return specialist.length > 0 ? specialist : this.openSlotsFor(p);
  }

  hireOwner(): void {
    if (this.fixedCap) return;
    if (this.phase !== "landed" || this.choicesLeft === 0 || this.owner || !this.card) return;
    const c = this.card;
    this.owner = {
      name: this.ownerName,
      budget: c.budget,
      franchise: c.franchise,
      year: c.year,
      teamName: c.name,
    };
    this.consumeChoice({ kind: "owner" });
  }

  buyStadium(): void {
    if (this.fixedCap) return;
    if (this.phase !== "landed" || this.choicesLeft === 0 || this.stadium || !this.card) return;
    const c = this.card;
    this.stadium = { park: c.park, mult: c.stadiumMult, franchise: c.franchise, year: c.year };
    this.consumeChoice({ kind: "stadium" });
  }

  hireManager(): void {
    if (this.phase !== "landed" || this.choicesLeft === 0 || this.manager || !this.card) return;
    const c = this.card;
    if (c.manager == null) return;
    this.manager = {
      name: c.manager,
      wins: c.wins,
      losses: c.losses,
      year: c.year,
      team: c.team,
      teamName: c.name,
      ws: c.ws,
      pen: c.pen,
      moty: c.managerMoty === true,
    };
    this.consumeChoice({ kind: "manager" });
  }

  // ---------- Trade Deadline swaps ----------

  /** Armed TD, tap a trade candidate: pick who they replace (or complete if
   * only one seat is eligible). Open rows count too — arming TD routes the
   * tap through the trade, so an open seat elsewhere never blocks a swap. */
  tdTapPlayer(p: CardPlayer): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (!this.tdCandidate(p)) return;
    const occupied = this.occupiedSlotsFor(p);
    if (occupied.length === 0) return;
    if (occupied.length === 1) this.completeSwap(p, occupied[0]);
    else {
      this.releasePick = p.id;
      this.save();
    }
  }

  tdRelease(p: CardPlayer, slotIdx: number): void {
    if (this.powerups.tradeDeadline !== "armed" || this.releasePick !== p.id) return;
    if (!this.occupiedSlotsFor(p).includes(slotIdx)) return;
    this.completeSwap(p, slotIdx);
  }

  private completeSwap(p: CardPlayer, idx: number): void {
    // TD + 🏠 both armed: a debut-eligible trade-in commits at the discounted
    // price and consumes both powerups.
    const discounted = this.discountEligible(p);
    this.slots[idx] = this.makeSigned(this.card!, p, this.priceFor(p), discounted);
    if (discounted) this.powerups.hometown = "spent";
    this.powerups.tradeDeadline = "spent";
    this.consumeChoice({ kind: "swap", war: p.war });
  }

  /** Armed TD, tap a taken special: 1-for-1 replacement, no picker. */
  tdTapSpecial(which: SpecialKey): void {
    if (this.powerups.tradeDeadline !== "armed" || this.choicesLeft === 0 || !this.card) return;
    if (!this.specialTaken(which)) return;
    const c = this.card;
    if (which === "owner") {
      this.owner = {
        name: this.ownerName,
        budget: c.budget,
        franchise: c.franchise,
        year: c.year,
        teamName: c.name,
      };
    } else if (which === "stadium") {
      this.stadium = { park: c.park, mult: c.stadiumMult, franchise: c.franchise, year: c.year };
    } else {
      if (c.manager == null) return;
      this.manager = {
        name: c.manager,
        wins: c.wins,
        losses: c.losses,
        year: c.year,
        team: c.team,
        teamName: c.name,
        ws: c.ws,
        pen: c.pen,
        moty: c.managerMoty === true,
      };
    }
    this.powerups.tradeDeadline = "spent";
    this.consumeChoice({ kind: "swap" });
  }

  // ---------- finale ----------

  private async finishGame(): Promise<void> {
    const players = this.slots.filter((s): s is Signed => s !== null);
    // Reload every card this game landed on (all memoized from play) and
    // solve for the WAR-max roster — the finale's scouting yardstick. The
    // dream team also gets a manager: the most valuable one available, by the
    // skipper's full score value (netWins × 0.1 + 2 if Manager of the Year).
    let best: BestRoster | null = null;
    let bestManager: BestManager | null = null;
    let bestManagerValue = -Infinity;
    try {
      const cards = await Promise.all(this.seen.map((s) => loadCard(s.team, s.year)));
      best = bestRoster(cards);
      for (const c of cards) {
        if (c.manager == null) continue;
        const netWins = c.wins - c.losses;
        const moty = c.managerMoty === true;
        const value = netWins * MANAGER_PER_NET_WIN + (moty ? MANAGER_MOTY_POINTS : 0);
        if (bestManager === null || value > bestManagerValue) {
          bestManagerValue = value;
          bestManager = {
            name: c.manager,
            team: c.team,
            year: c.year,
            teamName: c.name,
            ws: c.ws,
            pen: c.pen,
            netWins,
            moty,
          };
        }
      }
    } catch {
      /* offline mid-game: finish without the yardstick */
    }
    const playerHits =
      best?.picks.filter(
        (b) =>
          b != null &&
          players.some((p) => p.id === b.id && p.year === b.year && p.team === b.team),
      ).length ?? 0;
    const managerHit =
      bestManager !== null &&
      this.manager !== null &&
      this.manager.team === bestManager.team &&
      this.manager.year === bestManager.year;
    const scoutHits = playerHits + (managerHit ? 1 : 0);
    const parts = score({
      totalWar: this.totalWar,
      spendM: this.spend,
      budgetM: this.effectiveBudget,
      awardLists: players.map((p) => p.awards),
      rings: this.pedigree.rings,
      pennants: this.pedigree.pennants,
      managerRecord: this.manager ? [this.manager.wins, this.manager.losses] : null,
      scoutHits,
      managerMoty: this.manager?.moty === true,
    });
    const [wins, losses] = displayRecord(parts.expectedWins);
    this.finale = {
      parts,
      wins,
      losses,
      spend: this.spend,
      budget: this.effectiveBudget,
      spinCount: this.spinCount,
      totalWar: this.totalWar,
      best,
      bestManager,
      managerHit,
      scoutHits,
    };
    this.phase = "finale";
    this.recordHistory();
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  private recordHistory(): void {
    if (!this.finale) return;
    try {
      const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown[];
      hist.push({
        v: 2, // two-rung ladder era; disambiguates "scout" from the old stats mode
        date: new Date().toISOString().slice(0, 10),
        seed: this.seed,
        total: this.finale.parts.total,
        record: `${this.finale.wins}-${this.finale.losses}`,
        spins: this.finale.spinCount,
        difficulty: this.config.difficulty,
        bank: this.config.bank,
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
    } catch {
      /* storage unavailable */
    }
  }

  // ---------- persistence (iOS Safari evicts tabs; resume must be exact) ----------

  save(): void {
    if (this.phase === "finale") return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          v: SAVE_VERSION,
          config: this.config,
          seed: this.seed,
          rngState: this.rng.state,
          spinCount: this.spinCount,
          seen: this.seen,
          phase: this.phase === "spinning" ? "preSpin" : this.phase,
          cardRef: this.card ? { team: this.card.team, year: this.card.year } : null,
          slots: this.slots,
          owner: this.owner,
          stadium: this.stadium,
          manager: this.manager,
          powerups: this.powerups,
          choicesLeft: this.choicesLeft,
          choicesUsed: this.choicesUsed,
          spinLog: this.spinLog,
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }

  /** Abandon any saved game (the header's restart action). */
  static clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  static async restore(meta: Meta, index: GameIndex, owners: Owners): Promise<Game | null> {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (s.v !== SAVE_VERSION && s.v !== 4) return null;
      // v4 → v5: the Hometown Hero combo became the 🏠 Homegrown powerup; an
      // in-flight save's heroUsed maps to the powerup's spent/ready state.
      if (s.v === 4) s.powerups = { ...s.powerups, hometown: s.heroUsed ? "spent" : "ready" };
      const game = new Game(meta, index, owners, s.seed, s.config ?? DEFAULT_CONFIG);
      game.rng.state = s.rngState;
      game.spinCount = s.spinCount;
      game.seen = s.seen ?? [];
      // (older saves carry a tdBonus field from the retired bonus-spin rule —
      // ignored; a restored complete club simply finishes on its next endSpin)
      game.slots = s.slots;
      game.owner = s.owner;
      game.stadium = s.stadium;
      game.manager = s.manager;
      game.powerups = s.powerups;
      game.choicesLeft = s.choicesLeft;
      game.choicesUsed = s.choicesUsed;
      game.spinLog = s.spinLog;
      if (s.cardRef && s.phase === "landed") {
        game.card = await loadCard(s.cardRef.team, s.cardRef.year);
        game.phase = "landed";
        // A reload mid-picker restores to the base landed state.
        if (game.powerups.tradeDeadline === "armed") game.powerups.tradeDeadline = "ready";
        if (game.powerups.prime === "armed") game.powerups.prime = "ready";
        if (game.powerups.hometown === "armed") game.powerups.hometown = "ready";
        if (game.powerups.doublePlay === "armed") {
          game.powerups.doublePlay = "ready";
          game.choicesLeft = Math.max(0, game.choicesLeft - 1);
        }
      } else {
        game.phase = "preSpin";
      }
      return game;
    } catch {
      return null;
    }
  }
}

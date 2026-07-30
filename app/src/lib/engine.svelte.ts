/** Game state machine. Implements SPEC.md's rules, DECISIONS.md's gap fills.
 * All gameplay randomness flows through `this.rng` (one mulberry32 stream per
 * seed); the finale record sim uses a fixed derivation of the seed so the
 * displayed record is independent of how many spins the draft took. */
import { bestRoster, type BestRoster } from "./bestroster";
import { loadCard, ownerFor } from "./data";
import { eligibleTypes } from "./eligibility";
import { Rng, randomSeed } from "./rng";
import { displayRecord, score } from "./scoring";
import { SLOT_TYPES } from "./types";
import type { Card, CardPlayer, GameIndex, IndexEntry, Meta, Owners, ScoreParts } from "./types";

export { SLOT_TYPES };

export type Phase = "preSpin" | "spinning" | "landed" | "finale";
export type PowerupKey = "seasonTicket" | "relocate" | "doublePlay" | "tradeDeadline" | "prime";
export type PowerupState = "ready" | "armed" | "spent";
export type PlayerRowState = "open" | "dead";

export type Difficulty = "standard" | "scout" | "eyetest";
export type Bank = "classic" | "moneyball" | "blankcheck";

export interface GameConfig {
  difficulty: Difficulty;
  bank: Bank;
}

export const DEFAULT_CONFIG: GameConfig = { difficulty: "standard", bank: "classic" };

/** 2002 A's top-4 contracts, normalized (Dye/Justice/Durham/Tejada). */
export const MONEYBALL_BUDGET_M = 82.9;
/** 2005 Yankees top-4 — the fattest bankroll in the league. */
export const BLANK_CHECK_BUDGET_M = 248.6;

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

export interface SkipperPick {
  name: string;
  wins: number;
  losses: number;
  year: number;
  teamName: string;
  ws: boolean;
  pen: boolean;
}

export type SpecialKey = "owner" | "stadium" | "skipper";

export interface SpinLogEntry {
  kind: "sign" | "owner" | "stadium" | "skipper" | "swap";
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
  scoutHits: number;
}

const SAVE_KEY = "hotstove.current";
const HISTORY_KEY = "hotstove.history";
const SAVE_VERSION = 3;

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
  skipper = $state<SkipperPick | null>(null);
  powerups = $state<Record<PowerupKey, PowerupState>>({
    seasonTicket: "ready",
    relocate: "ready",
    doublePlay: "ready",
    tradeDeadline: "ready",
    prime: "ready",
  });
  choicesLeft = $state(0);
  choicesUsed = $state(0);
  heroUsed = $state(false);
  spinCount = $state(0);
  spinLog = $state<SpinLogEntry[]>([]);
  spinKind = $state<SpinKind>("full");
  /** Every distinct card this game has landed on — the scouting yardstick. */
  seen = $state<{ team: string; year: number }[]>([]);
  /** Sign-time slot ambiguity: rail becomes a slot picker for this player. */
  slotPick = $state<string | null>(null);
  /** TD release picker: rail cells the incoming player could replace. */
  releasePick = $state<string | null>(null);
  /** Prime picker: rail slot whose player is browsing their other seasons. */
  primePick = $state<number | null>(null);
  finale = $state<FinaleResult | null>(null);

  private pendingCard: Promise<Card> | null = null;

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

  /** Standard sees everything priced; Scout trades WAR for trad stat lines
   * but still shops by salary; Eye Test flies blind. */
  get showCost(): boolean {
    return this.config.difficulty !== "eyetest";
  }

  get showAwards(): boolean {
    return this.config.difficulty === "standard";
  }

  get showStats(): boolean {
    return this.config.difficulty === "scout";
  }

  get eyeTest(): boolean {
    return this.config.difficulty === "eyetest";
  }

  /** Moneyball and Blank Check are fixed-cap modes: no owners, no stadiums. */
  get fixedCap(): boolean {
    return this.config.bank !== "classic";
  }

  // ---------- derived ----------

  get rosterFull(): boolean {
    return this.slots.every((s) => s !== null);
  }

  get totalWar(): number {
    return this.slots.reduce((sum, s) => sum + (s?.war ?? 0), 0);
  }

  get spend(): number {
    return this.slots.reduce((sum, s) => sum + (s?.costPaid ?? 0), 0);
  }

  get effectiveBudget(): number {
    if (this.config.bank === "moneyball") return MONEYBALL_BUDGET_M;
    if (this.config.bank === "blankcheck") return BLANK_CHECK_BUDGET_M;
    return (this.owner?.budget ?? this.meta.minBudget) * (this.stadium?.mult ?? 1);
  }

  get heroActive(): boolean {
    return (
      !this.heroUsed &&
      this.owner !== null &&
      this.stadium !== null &&
      this.owner.franchise === this.stadium.franchise
    );
  }

  get heroFranchise(): string | null {
    return this.heroActive ? this.owner!.franchise : null;
  }

  /** Normalized league-minimum price for the current card's year. */
  get heroPrice(): number {
    if (!this.card) return 0;
    const y = String(this.card.year);
    return (this.meta.salaryFloor[y] / this.meta.avgSlot8[y]) * this.meta.displayAvgM;
  }

  get ownerName(): string {
    if (!this.card) return "";
    return ownerFor(this.owners, this.card.franchise, this.card.year);
  }

  get skipperAvailable(): boolean {
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

  heroEligible(p: CardPlayer): boolean {
    return this.heroFranchise !== null && p.debut === this.heroFranchise;
  }

  priceFor(p: CardPlayer): number {
    return this.heroEligible(p) ? this.heroPrice : p.cost;
  }

  /** Occupied slot indices the incoming player could replace (TD). */
  occupiedSlotsFor(p: CardPlayer): number[] {
    const types = eligibleTypes(p);
    return SLOT_TYPES.map((t, i) => i).filter(
      (i) => this.slots[i] !== null && types.includes(SLOT_TYPES[i]),
    );
  }

  specialTaken(which: SpecialKey): boolean {
    return { owner: this.owner, stadium: this.stadium, skipper: this.skipper }[which] !== null;
  }

  /** Can any choice still be committed on this card? (DECISIONS.md #3) */
  anyActionable(): boolean {
    if (!this.card) return false;
    const specialsOpen = this.fixedCap
      ? !this.skipper && this.skipperAvailable
      : !this.owner || !this.stadium || (!this.skipper && this.skipperAvailable);
    if (specialsOpen) return true;
    if (!this.rosterFull && this.card.players.some((p) => this.playerState(p) === "open"))
      return true;
    if (this.powerups.tradeDeadline !== "spent") {
      if (this.card.players.some((p) => this.playerState(p) === "dead" && !this.isRostered(p)))
        return true;
      if (this.owner || this.stadium || (this.skipper && this.skipperAvailable)) return true;
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
    this.pendingCard = loadCard(entry.team, entry.year);
  }

  async land(): Promise<void> {
    if (!this.pendingCard) return;
    this.card = await this.pendingCard;
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

  /** ✌️ Double Play: arming grants a second choice this spin. Toggle pre-commit;
   * spent at the first commit while armed. */
  toggleDoublePlay(): void {
    if (this.phase !== "landed" || this.choicesUsed > 0) return;
    if (this.powerups.doublePlay === "ready") {
      this.powerups.doublePlay = "armed";
      this.choicesLeft += 1;
    } else if (this.powerups.doublePlay === "armed") {
      this.powerups.doublePlay = "ready";
      this.choicesLeft -= 1;
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

  /** ⭐ Prime arming toggle: filled rail cells become season-pickable. Free
   * action — browsing a career costs nothing until a season is applied. */
  togglePrime(): void {
    if (this.phase !== "landed") return;
    if (this.powerups.prime === "ready") {
      this.powerups.prime = "armed";
    } else if (this.powerups.prime === "armed") {
      this.powerups.prime = "ready";
      this.primePick = null;
    }
    this.save();
  }

  get primeArmed(): boolean {
    return this.powerups.prime === "armed";
  }

  /** Armed Prime, tap a filled rail cell: browse that player's other seasons. */
  primeTapSlot(slotIdx: number): void {
    if (!this.primeArmed || this.slots[slotIdx] === null) return;
    this.primePick = slotIdx;
  }

  /** Swap the slot's player to another season of their own career. The new
   * season must still fit the slot; cost becomes that season's real contract
   * (hero pricing doesn't travel through time). */
  async applyPrime(slotIdx: number, team: string, year: number): Promise<boolean> {
    if (this.powerups.prime !== "armed" || this.primePick !== slotIdx) return false;
    const signed = this.slots[slotIdx];
    if (!signed) return false;
    const card = await loadCard(team, year);
    const p = card.players.find((pl) => pl.id === signed.id);
    if (!p || !eligibleTypes(p).includes(SLOT_TYPES[slotIdx])) return false;
    this.slots[slotIdx] = {
      id: p.id,
      name: p.name,
      pos: p.pos,
      war: p.war,
      awards: p.awards,
      ws: p.ws,
      pen: p.pen,
      year: card.year,
      team: card.team,
      teamName: card.name,
      franchise: card.franchise,
      costPaid: p.cost,
      hero: false,
      prorated: card.prorated,
    };
    this.powerups.prime = "spent";
    this.primePick = null;
    this.save();
    return true;
  }

  private disarmToggles(): void {
    if (this.powerups.doublePlay === "armed") {
      this.powerups.doublePlay = "ready";
      this.choicesLeft = Math.max(0, this.choicesLeft - 1);
    }
    if (this.powerups.tradeDeadline === "armed") this.powerups.tradeDeadline = "ready";
    if (this.powerups.prime === "armed") this.powerups.prime = "ready";
    this.clearTransients();
  }

  private clearTransients(): void {
    this.slotPick = null;
    this.releasePick = null;
    this.primePick = null;
  }

  // ---------- choices ----------

  private makeSigned(p: CardPlayer, costPaid: number, hero: boolean): Signed {
    const c = this.card!;
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
      hero,
      prorated: c.prorated,
    };
  }

  private consumeChoice(entry: SpinLogEntry): void {
    if (this.powerups.doublePlay === "armed") this.powerups.doublePlay = "spent";
    this.choicesUsed += 1;
    this.choicesLeft -= 1;
    this.spinLog = [...this.spinLog, entry];
    this.clearTransients();
    if (this.choicesLeft === 0 || !this.anyActionable()) this.endSpin();
    else this.save();
  }

  /** Forfeit a remaining Double Play pick and move on. */
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
    if (this.powerups.tradeDeadline === "armed") this.powerups.tradeDeadline = "ready";
    if (this.powerups.prime === "armed") this.powerups.prime = "ready";
    if (this.rosterFull) void this.finishGame();
    else {
      this.phase = "preSpin";
      this.save();
    }
  }

  /** Sign an open player. When more than one specialist slot type is open the
   * rail becomes a slot picker (DECISIONS.md #4) — re-call with slotIdx. */
  signPlayer(p: CardPlayer, slotIdx?: number): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
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
    const hero = this.heroEligible(p);
    this.slots[idx] = this.makeSigned(p, this.priceFor(p), hero);
    if (hero) this.heroUsed = true;
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

  hireSkipper(): void {
    if (this.phase !== "landed" || this.choicesLeft === 0 || this.skipper || !this.card) return;
    const c = this.card;
    if (c.manager == null) return;
    this.skipper = {
      name: c.manager,
      wins: c.wins,
      losses: c.losses,
      year: c.year,
      teamName: c.name,
      ws: c.ws,
      pen: c.pen,
    };
    this.consumeChoice({ kind: "skipper" });
  }

  // ---------- Trade Deadline swaps ----------

  /** Armed TD, tap a gray player: pick who they replace (or complete if only one). */
  tdTapPlayer(p: CardPlayer): void {
    if (this.powerups.tradeDeadline !== "armed" || this.choicesLeft === 0) return;
    if (this.playerState(p) !== "dead" || this.isRostered(p)) return;
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
    const hero = this.heroEligible(p);
    this.slots[idx] = this.makeSigned(p, this.priceFor(p), hero);
    if (hero) this.heroUsed = true;
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
      this.skipper = {
        name: c.manager,
        wins: c.wins,
        losses: c.losses,
        year: c.year,
        teamName: c.name,
        ws: c.ws,
        pen: c.pen,
      };
    }
    this.powerups.tradeDeadline = "spent";
    this.consumeChoice({ kind: "swap" });
  }

  // ---------- finale ----------

  private async finishGame(): Promise<void> {
    const players = this.slots.filter((s): s is Signed => s !== null);
    // Reload every card this game landed on (all memoized from play) and
    // solve for the WAR-max roster — the finale's scouting yardstick.
    let best: BestRoster | null = null;
    try {
      const cards = await Promise.all(this.seen.map((s) => loadCard(s.team, s.year)));
      best = bestRoster(cards);
    } catch {
      /* offline mid-game: finish without the yardstick */
    }
    const scoutHits =
      best?.picks.filter((b) =>
        b != null && players.some((p) => p.id === b.id && p.year === b.year && p.team === b.team),
      ).length ?? 0;
    const parts = score({
      totalWar: this.totalWar,
      spendM: this.spend,
      budgetM: this.effectiveBudget,
      awardLists: players.map((p) => p.awards),
      rings: players.filter((p) => p.ws).length + (this.skipper?.ws ? 1 : 0),
      pennants: players.filter((p) => p.pen).length + (this.skipper?.pen ? 1 : 0),
      skipperRecord: this.skipper ? [this.skipper.wins, this.skipper.losses] : null,
      scoutHits,
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
          skipper: this.skipper,
          powerups: this.powerups,
          choicesLeft: this.choicesLeft,
          choicesUsed: this.choicesUsed,
          heroUsed: this.heroUsed,
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
      if (s.v !== SAVE_VERSION) return null;
      const game = new Game(meta, index, owners, s.seed, s.config ?? DEFAULT_CONFIG);
      game.rng.state = s.rngState;
      game.spinCount = s.spinCount;
      game.seen = s.seen ?? [];
      game.slots = s.slots;
      game.owner = s.owner;
      game.stadium = s.stadium;
      game.skipper = s.skipper;
      game.powerups = s.powerups;
      game.choicesLeft = s.choicesLeft;
      game.choicesUsed = s.choicesUsed;
      game.heroUsed = s.heroUsed;
      game.spinLog = s.spinLog;
      if (s.cardRef && s.phase === "landed") {
        game.card = await loadCard(s.cardRef.team, s.cardRef.year);
        game.phase = "landed";
        // A reload mid-picker restores to the base landed state.
        if (game.powerups.tradeDeadline === "armed") game.powerups.tradeDeadline = "ready";
        if (game.powerups.prime === "armed") game.powerups.prime = "ready";
      } else {
        game.phase = "preSpin";
      }
      return game;
    } catch {
      return null;
    }
  }
}

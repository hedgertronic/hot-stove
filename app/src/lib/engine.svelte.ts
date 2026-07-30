/** Game state machine. Implements SPEC.md's rules, DECISIONS.md's gap fills.
 * All gameplay randomness flows through `this.rng` (one mulberry32 stream per
 * seed); the finale record sim uses a fixed derivation of the seed so the
 * displayed record is independent of how many spins the draft took. */
import { loadCard, ownerFor } from "./data";
import { eligibleTypes } from "./eligibility";
import { Rng, randomSeed } from "./rng";
import { score, simulateSeason } from "./scoring";
import type {
  Card,
  CardPlayer,
  GameIndex,
  IndexEntry,
  Meta,
  Owners,
  ScoreParts,
  SlotType,
} from "./types";

export type Phase = "preSpin" | "spinning" | "landed" | "finale";
export type PowerupKey = "seasonTicket" | "relocate" | "doublePlay" | "tradeDeadline";
export type PowerupState = "ready" | "armed" | "spent";
export type PlayerRowState = "open" | "dead";

export type Difficulty = "rookie" | "standard" | "scout" | "eyetest";

export interface GameConfig {
  difficulty: Difficulty;
  moneyball: boolean;
}

export const DEFAULT_CONFIG: GameConfig = { difficulty: "standard", moneyball: false };

/** 2002 A's top-4 contracts, normalized (Dye/Justice/Durham/Tejada). */
export const MONEYBALL_BUDGET_M = 82.9;

export const SLOT_TYPES: SlotType[] = ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"];

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
}

const SAVE_KEY = "hotstove.current";
const HISTORY_KEY = "hotstove.history";
const SAVE_VERSION = 2;

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
  });
  choicesLeft = $state(0);
  choicesUsed = $state(0);
  heroUsed = $state(false);
  spinCount = $state(0);
  spinLog = $state<SpinLogEntry[]>([]);
  /** Sign-time slot ambiguity: rail becomes a slot picker for this player. */
  slotPick = $state<string | null>(null);
  /** TD release picker: rail cells the incoming player could replace. */
  releasePick = $state<string | null>(null);
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

  // ---------- mode visibility (BUILD.md difficulty table) ----------

  get showWar(): boolean {
    return this.config.difficulty === "rookie" || this.config.difficulty === "standard";
  }

  get showCost(): boolean {
    return this.showWar; // WAR and cost hide together (Scout, Eye Test)
  }

  get showAwards(): boolean {
    return this.config.difficulty === "rookie";
  }

  get showStats(): boolean {
    return this.config.difficulty === "scout";
  }

  get eyeTest(): boolean {
    return this.config.difficulty === "eyetest";
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
    if (this.config.moneyball) return MONEYBALL_BUDGET_M;
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
    const specialsOpen = this.config.moneyball
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
    this.beginSpin(entry);
  }

  private beginSpin(entry: IndexEntry): void {
    this.phase = "spinning";
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
    this.beginSpin(entry);
  }

  /** 🚚 Relocate: reroll to a different random team, same year. Pre-choice only. */
  relocate(): void {
    if (this.phase !== "landed" || this.powerups.relocate !== "ready") return;
    if (this.choicesUsed > 0 || !this.card) return;
    const candidates = this.index.cards.filter(
      (c) => c.year === this.card!.year && c.team !== this.card!.team,
    );
    if (candidates.length === 0) return;
    const entry = this.rng.pick(candidates);
    this.powerups.relocate = "spent";
    this.disarmToggles();
    this.spinCount -= 1;
    this.beginSpin(entry);
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

  private disarmToggles(): void {
    if (this.powerups.doublePlay === "armed") {
      this.powerups.doublePlay = "ready";
      this.choicesLeft = Math.max(0, this.choicesLeft - 1);
    }
    if (this.powerups.tradeDeadline === "armed") this.powerups.tradeDeadline = "ready";
    this.clearTransients();
  }

  private clearTransients(): void {
    this.slotPick = null;
    this.releasePick = null;
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
    if (this.rosterFull) this.finishGame();
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
    if (this.config.moneyball) return;
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
    if (this.config.moneyball) return;
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
      };
    }
    this.powerups.tradeDeadline = "spent";
    this.consumeChoice({ kind: "swap" });
  }

  // ---------- finale ----------

  private finishGame(): void {
    const players = this.slots.filter((s): s is Signed => s !== null);
    const parts = score({
      totalWar: this.totalWar,
      spendM: this.spend,
      budgetM: this.effectiveBudget,
      awardLists: players.map((p) => p.awards),
      rings: players.filter((p) => p.ws).length,
      pennants: players.filter((p) => p.pen).length,
      skipperRecord: this.skipper ? [this.skipper.wins, this.skipper.losses] : null,
    });
    const [wins, losses] = simulateSeason(parts.expectedWins, new Rng(this.seed ^ 0x51ed));
    this.finale = {
      parts,
      wins,
      losses,
      spend: this.spend,
      budget: this.effectiveBudget,
      spinCount: this.spinCount,
      totalWar: this.totalWar,
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
        moneyball: this.config.moneyball,
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
      } else {
        game.phase = "preSpin";
      }
      return game;
    } catch {
      return null;
    }
  }
}

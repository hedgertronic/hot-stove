export type SlotType = "C" | "IF" | "OF" | "FLEX" | "SP" | "RP";

export const SLOT_TYPES: SlotType[] = ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"];

export interface CardPlayer {
  id: string;
  name: string;
  pos: string;
  war: number;
  cost: number; // normalized display $M
  awards: string[];
  ws: boolean;
  pen: boolean;
  posG: { c: number; if: number; of: number };
  debut: string;
  age?: number;
  /** Birth country as its display name ("Dominican Republic", "Puerto Rico",
   * "Germany"). Historical names are folded into the current one, so a country
   * counts once however Lahman spelled it that decade. Absent only when Lahman
   * records no birth country — no card player-season today. */
  bc?: string;
  /** In the Hall of Fame, elected as a player. Career-level, so it rides every
   * season of his; present only when true. Managers elected as managers carry
   * `managerHof` on the card instead. */
  hof?: boolean;
  /** World Baseball Classic medal for this exact season, in Ring-chasing
   * points: 2 for the champion, 1 for the losing finalist. The Classic is
   * played in March, so the tournament year is the card year and a player can
   * hold a medal and a World Series ring for the same season — both count.
   * Present only when the player medaled; five Classics fall inside the
   * 1985–2025 window, so all but a handful of player-seasons omit it. */
  wbc?: number;
}

export interface Card {
  year: number;
  team: string;
  franchise: string;
  name: string;
  park: string;
  wins: number;
  losses: number;
  manager: string | null;
  /** The primary manager won the BBWAA Manager of the Year that season
   * (present only when true, like the index's ws/pen). */
  managerMoty?: boolean;
  /** The primary manager is in the Hall of Fame on a manager's plaque
   * (present only when true). A skipper elected as a player — Frank Robinson,
   * Paul Molitor — does not carry this. */
  managerHof?: boolean;
  ws: boolean;
  pen: boolean;
  attendance: number;
  attendancePct: number;
  stadiumMult: number;
  budget: number; // normalized display $M (top-4 contracts)
  prorated: number;
  players: CardPlayer[];
}

export interface Meta {
  displayAvgM: number;
  replacementWins: number;
  slots: SlotType[];
  minBudget: number;
  avgSlot8: Record<string, number>;
  salaryFloor: Record<string, number>;
  proration: Record<string, number>;
}

export interface IndexEntry {
  team: string;
  year: number;
  franchise: string;
  name: string;
  lg?: "AL" | "NL"; // that season's actual league (Lahman Teams)
  div?: "E" | "C" | "W"; // that season's actual division (no "C" pre-1994)
  ws?: boolean; // won the World Series (flag present only when true)
  pen?: boolean; // won the pennant but not the Series
}

export interface GameIndex {
  yearMin: number;
  yearMax: number;
  cards: IndexEntry[];
}

export interface OwnerEntry {
  name: string;
  from: number;
  to: number | null;
}

export interface Owners {
  franchises: Record<string, { name: string; wikipediaOnly?: boolean; owners: OwnerEntry[] }>;
}

export interface Colors {
  franchises: Record<string, string>;
}

export interface ScoreParts {
  expectedWins: number;
  /** Manager net-win contribution — already inside expectedWins, shown for the ledger. */
  managerWins: number;
  budgetBonus: number;
  awardPoints: number;
  ringPoints: number;
  scoutBonus: number;
  luxuryTax: number;
  total: number;
}

/** Player-seasons index (data/players.json): every card a player appears on. */
export type PlayerSeasons = Record<string, [string, number][]>;

/** One franchise-season's front office (data/specials.json): the numbers a
 * Prime Time hire of that year's manager/stadium/owner would lock in. */
export interface SpecialSeason {
  team: string;
  year: number;
  /** Full club name that season ("Chicago Cubs"). */
  name: string;
  park: string;
  mgr: string | null;
  /** The manager won the BBWAA Manager of the Year that season (only when true). */
  moty?: boolean;
  /** The manager is in the Hall of Fame on a manager's plaque (only when true). */
  hof?: boolean;
  w: number;
  l: number;
  /** Attendance percentile within the year, 0–1. */
  att: number;
  /** Stadium payroll multiplier (0.85–1.15). */
  mult: number;
  /** Normalized owner payroll, display $M. */
  budget: number;
}

/** Franchise → season timeline, sorted by year. */
export type SpecialsIndex = Record<string, SpecialSeason[]>;

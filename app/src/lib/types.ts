export type SlotType = "C" | "IF" | "OF" | "FLEX" | "SP" | "RP";

export const SLOT_TYPES: SlotType[] = ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"];

export interface CardPlayer {
  id: string;
  name: string;
  pos: string;
  war: number;
  warRaw: number;
  cost: number; // normalized display $M
  contract: number;
  salary: number;
  est: boolean;
  awards: string[];
  ws: boolean;
  pen: boolean;
  pa: number;
  gs: number;
  relIP: number;
  posG: { c: number; if: number; of: number; dh: number };
  debut: string;
  teams: string[];
  age?: number;
  bat?: { avg: number; obp: number; slg: number; hr: number; rbi: number; sb: number };
  pit?: { w: number; l: number; sv: number; era: number; so: number };
}

export interface Contract {
  name: string;
  salary: number;
  est: boolean;
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
  ws: boolean;
  pen: boolean;
  attendance: number;
  attendancePct: number;
  stadiumMult: number;
  budget: number; // normalized display $M (top-4 contracts)
  budgetRaw: number;
  contracts: Contract[];
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

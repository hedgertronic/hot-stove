export type SlotType = "C" | "IF" | "OF" | "FLEX" | "SP" | "RP";

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
  bat?: { avg: number; hr: number; sb: number };
  pit?: { w: number; l: number; sv: number; era: number };
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
  budgetBonus: number;
  awardPoints: number;
  ringPoints: number;
  skipperPoints: number;
  luxuryTax: number;
  total: number;
}

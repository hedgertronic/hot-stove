/** Forged Game states for the dev-only UI lab (?lab). Every fixture builds a
 * REAL Game instance from synthetic data, so the lab renders the live
 * components under extreme inputs without replaying actual games. */
import { Game, type GameConfig, type Signed } from "../lib/engine.svelte";
import { displayRecord, score } from "../lib/scoring";
import type { BestManager, FinaleResult } from "../lib/engine.svelte";
import type { BestPick, BestRoster } from "../lib/bestroster";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../lib/types";

/** heroPrice = salaryFloor/avgSlot8 × displayAvgM → 0.3/48 × 160 = $1M. */
const YEARS = ["1994", "1998", "2001", "2002", "2004", "2005"];
export const stubMeta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"],
  minBudget: 40,
  avgSlot8: Object.fromEntries(YEARS.map((y) => [y, 48])),
  salaryFloor: Object.fromEntries(YEARS.map((y) => [y, 0.3])),
  proration: Object.fromEntries(YEARS.map((y) => [y, 1])),
};

/** Spins never run in the lab, so the index stays empty. */
export const stubIndex: GameIndex = { yearMin: 1985, yearMax: 2024, cards: [] };

/** Real owner entries for the fixed-cap BankBox line (OAK 2002 / NYY 2005). */
export const stubOwners: Owners = {
  franchises: {
    OAK: {
      name: "Oakland Athletics",
      owners: [{ name: "Stephen Schott & Ken Hofmann", from: 1995, to: 2005 }],
    },
    NYY: {
      name: "New York Yankees",
      owners: [{ name: "George Steinbrenner", from: 1973, to: 2008 }],
    },
    SEA: {
      name: "Seattle Mariners",
      owners: [{ name: "Hiroshi Yamauchi", from: 1992, to: 2004 }],
    },
  },
};

/** posG from a primary position: enough games to be slot-eligible there. */
function posGFor(pos: string): CardPlayer["posG"] {
  const g = { c: 0, if: 0, of: 0, dh: 0 };
  if (pos === "C") g.c = 100;
  else if (["1B", "2B", "3B", "SS"].includes(pos)) g.if = 100;
  else if (["LF", "CF", "RF", "OF"].includes(pos)) g.of = 100;
  else if (pos === "DH") g.dh = 100;
  return g;
}

let nextId = 0;
export function mkPlayer(over: Partial<CardPlayer> & { name: string; pos: string }): CardPlayer {
  return {
    id: over.id ?? `lab${nextId++}`,
    war: 2.0,
    warRaw: 2.0,
    cost: 5,
    contract: 5,
    salary: 5_000_000,
    est: false,
    awards: [],
    ws: false,
    pen: false,
    pa: 600,
    gs: over.pos.startsWith("SP") ? 30 : 0,
    relIP: over.pos === "RP" ? 70 : 0,
    posG: posGFor(over.pos),
    debut: "XXX",
    teams: ["SEA"],
    ...over,
  };
}

export function mkCard(over: Partial<Card> = {}): Card {
  return {
    year: 2001,
    team: "SEA",
    franchise: "SEA",
    name: "Seattle Mariners",
    park: "Safeco Field",
    wins: 116,
    losses: 46,
    manager: "Lou Piniella",
    ws: false,
    pen: true,
    attendance: 3_500_000,
    attendancePct: 1,
    stadiumMult: 1.05,
    budget: 92.1,
    budgetRaw: 0,
    contracts: [],
    prorated: 1,
    players: [],
    ...over,
  };
}

export function mkSigned(
  over: Partial<Signed> & { name: string; pos: string },
): Signed {
  return {
    id: over.id ?? `lab${nextId++}`,
    war: 3.0,
    awards: [],
    ws: false,
    pen: false,
    year: 2001,
    team: "SEA",
    teamName: "Seattle Mariners",
    franchise: "SEA",
    costPaid: 8,
    hero: false,
    prorated: 1,
    ...over,
  };
}

/** A landed-phase Game whose save() is inert — lab games must never write the
 * real localStorage slot (a forged save would resurrect on the next visit). */
export function forgeGame(config: GameConfig, mutate?: (g: Game) => void): Game {
  const g = new Game(stubMeta, stubIndex, stubOwners, 12345, config);
  Object.defineProperty(g, "save", { value: () => {} });
  g.phase = "landed";
  g.choicesLeft = 1;
  mutate?.(g);
  return g;
}

// ---------- market fixtures ----------

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const SCOUT: GameConfig = { difficulty: "scout", bank: "classic" };

const marketPlayers = () => [
  mkPlayer({ name: "Barry Bonds", pos: "LF", war: 11.8, cost: 32, awards: ["MVP", "GG", "SS", "AS"] }),
  mkPlayer({ id: "salty", name: "Jarrod Saltalamacchia", pos: "C", war: 2.1, cost: 4.2, awards: ["MVP3", "GG", "SS", "AS"] }),
  mkPlayer({ name: "Ichiro Suzuki", pos: "RF", war: 7.7, cost: 14, debut: "SEA", awards: ["MVP", "ROY", "GG", "AS"] }),
  mkPlayer({ name: "Bret Boone", pos: "2B", war: 5.2, cost: 9, awards: ["SS"] }),
  mkPlayer({ name: "Mark McLemore", pos: "LF", war: 2.5, cost: 3 }),
  mkPlayer({ name: "Dan Wilson", pos: "C", war: 0.8, cost: 5 }),
  mkPlayer({ id: "edgar", name: "Edgar Martinez", pos: "DH", war: 5.5, cost: 11, awards: ["SS", "AS"] }),
  mkPlayer({ name: "Jose Mesa", pos: "RP", war: -1.4, cost: 2.6 }),
  mkPlayer({ name: "Freddy Garcia", pos: "SP", war: 4.9, cost: 26.1, awards: ["AS"] }),
];

/** Box Score market: every WAR tier, spendy/cheap costs, a 🏠 hero (owner +
 * stadium are both SEA), a wrapped-badges long name, and a dead row (Edgar
 * is already rostered). */
export function marketGame(): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard({ players: marketPlayers() });
    g.owner = { name: "Hiroshi Yamauchi", budget: 92.1, franchise: "SEA", year: 2001, teamName: "Seattle Mariners" };
    g.stadium = { park: "Safeco Field", mult: 1.05, franchise: "SEA", year: 2001 };
    g.slots[4] = mkSigned({ id: "edgar", name: "Edgar Martinez", pos: "DH", war: 5.5, costPaid: 11 });
  });
}

/** Same market, Eye Test: cost-sorted, WAR chips and award pills hidden. */
export function scoutGame(): Game {
  return forgeGame(SCOUT, (g) => {
    g.card = mkCard({ players: marketPlayers() });
  });
}

/** Full roster + armed Trade Deadline: unsigned rows turn amber swap targets. */
export function tdGame(): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard({
      players: [
        mkPlayer({ name: "Alex Rodriguez", pos: "SS", war: 8.5, cost: 27, awards: ["MVP2", "GG", "SS", "AS"] }),
        mkPlayer({ name: "Mike Cameron", pos: "CF", war: 4.4, cost: 6 }),
        mkPlayer({ id: "full-rp", name: "Kazuhiro Sasaki", pos: "RP", war: 1.9, cost: 7, awards: ["ROY"] }),
      ],
    });
    fillRoster(g);
    g.powerups.tradeDeadline = "armed";
  });
}

/** Armed Prime Time: every signable row grows the ⭐ browse affordance. */
export function primeGame(): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard({
      players: [
        mkPlayer({ name: "Randy Johnson", pos: "SP", war: 8.1, cost: 24, awards: ["CY", "AS"] }),
        mkPlayer({ name: "Jay Buhner", pos: "RF", war: 3.1, cost: 9 }),
      ],
    });
    g.powerups.prime = "armed";
  });
}

function fillRoster(g: Game): void {
  const seats: [string, string][] = [
    ["Dan Wilson", "C"],
    ["David Bell", "3B"],
    ["Carlos Guillén", "SS"],
    ["Stan Javier", "LF"],
    ["Ed Sprague", "DH"],
    ["Aaron Sele", "SP"],
    ["Paul Abbott", "SP"],
    ["Jeff Nelson", "RP"],
  ];
  seats.forEach(([name, pos], i) => {
    g.slots[i] = mkSigned({ name, pos, war: 1 + i * 0.3, costPaid: 4 + i });
  });
}

// ---------- bank fixtures ----------

function spendGame(config: GameConfig, costPaid: number, withOwner: boolean): Game {
  return forgeGame(config, (g) => {
    g.card = mkCard();
    if (withOwner) {
      g.owner = { name: "Hiroshi Yamauchi", budget: 92.1, franchise: "SEA", year: 2001, teamName: "Seattle Mariners" };
      g.stadium = { park: "Safeco Field", mult: 1.05, franchise: "SEA", year: 2001 };
    }
    if (costPaid > 0) g.slots[0] = mkSigned({ name: "Payroll Loader", pos: "C", costPaid });
  });
}

export const bankGames = () => ({
  preOwner: spendGame(CLASSIC, 0, false),
  normal: spendGame(CLASSIC, 38, true), // ~39% of 96.7
  nearCap: spendGame(CLASSIC, 93, true), // ~96%
  over: spendGame(CLASSIC, 111, true), // $14.3M over
  moneyball: spendGame({ difficulty: "standard", bank: "moneyball" }, 60, false),
  blankcheck: spendGame({ difficulty: "standard", bank: "blankcheck" }, 120, false),
});

// ---------- powerup fixtures ----------

export const powerupGames = () => ({
  ready: forgeGame(CLASSIC, (g) => {
    g.card = mkCard({ players: [mkPlayer({ name: "Filler", pos: "C" })] });
  }),
  armed: forgeGame(CLASSIC, (g) => {
    g.card = mkCard({ players: [mkPlayer({ name: "Filler", pos: "C" })] });
    g.powerups.doublePlay = "armed";
    g.powerups.tradeDeadline = "armed";
    g.choicesLeft = 2;
  }),
  spent: forgeGame(CLASSIC, (g) => {
    g.card = mkCard({ players: [mkPlayer({ name: "Filler", pos: "C" })] });
    g.powerups.seasonTicket = "spent";
    g.powerups.relocate = "spent";
    g.powerups.prime = "spent";
    g.choicesUsed = 1; // post-choice: ST/RELO window closed → DP reads off
  }),
});

// ---------- rail fixtures ----------

export const railGames = () => ({
  empty: forgeGame(CLASSIC, (g) => {
    g.card = mkCard();
  }),
  partial: forgeGame(CLASSIC, (g) => {
    g.card = mkCard();
    g.slots[1] = mkSigned({ name: "Bret Boone", pos: "2B", war: 5.2, costPaid: 9 });
    g.slots[3] = mkSigned({ name: "Ichiro Suzuki", pos: "RF", war: 7.7, costPaid: 14, hero: true });
    g.slots[5] = mkSigned({ name: "Freddy Garcia", pos: "SP", war: 4.9, costPaid: 26.1 });
  }),
  full: forgeGame(CLASSIC, (g) => {
    g.card = mkCard();
    fillRoster(g);
    g.manager = { name: "Lou Piniella", wins: 116, losses: 46, year: 2001, team: "SEA", teamName: "Seattle Mariners", ws: false, pen: true };
  }),
});

// ---------- finale fixtures ----------

function bestPickOf(s: Signed): BestPick {
  return {
    id: s.id,
    name: s.name,
    pos: s.pos,
    war: s.war,
    year: s.year,
    team: s.team,
    teamName: s.teamName,
    ws: s.ws,
    pen: s.pen,
    awards: s.awards,
  };
}

/** A finale-phase Game built from hand-picked slots and score inputs. The
 * ledger, squads, and dream team all render from this forged FinaleResult. */
function forgeFinale(opts: {
  slots: Signed[];
  spend: number;
  budget: number;
  scoutSweep: boolean; // true → every pick matches (9 ⭐); false → 1 hit + an empty seat
}): Game {
  return forgeGame(CLASSIC, (g) => {
    opts.slots.forEach((s, i) => (g.slots[i] = s));
    g.manager = { name: "Lou Piniella", wins: 116, losses: 46, year: 2001, team: "SEA", teamName: "Seattle Mariners", ws: false, pen: true };
    g.spinCount = 12;

    const picks: (BestPick | null)[] = opts.scoutSweep
      ? opts.slots.map(bestPickOf)
      : [
          bestPickOf(opts.slots[0]),
          mkSigned({ name: "Derek Jeter", pos: "SS", war: 5.8, year: 2004, team: "NYY", teamName: "New York Yankees" }),
          mkSigned({ name: "Manny Ramírez", pos: "LF", war: 5.1, year: 2004, team: "BOS", teamName: "Boston Red Sox" }),
          mkSigned({ name: "Vladimir Guerrero", pos: "RF", war: 5.9, year: 2004, team: "ANA", teamName: "Anaheim Angels" }),
          null, // best play for this seat was leaving it empty
          mkSigned({ name: "Johan Santana", pos: "SP", war: 7.6, year: 2004, team: "MIN", teamName: "Minnesota Twins" }),
          mkSigned({ name: "Curt Schilling", pos: "SP", war: 6.6, year: 2004, team: "BOS", teamName: "Boston Red Sox" }),
          mkSigned({ name: "Mariano Rivera", pos: "RP", war: 3.9, year: 2004, team: "NYY", teamName: "New York Yankees" }),
        ].map((s, i) => (i === 4 ? null : bestPickOf(s as Signed)));
    const best: BestRoster = {
      picks,
      totalWar: picks.reduce((t, p) => t + (p?.war ?? 0), 0),
    };
    // Sweep: dream manager IS the hired one (green + 9th ⭐). Otherwise a
    // different manager, so the miss reads honestly in both lists.
    const bestManager: BestManager = opts.scoutSweep
      ? { name: "Lou Piniella", team: "SEA", year: 2001, teamName: "Seattle Mariners", ws: false, pen: true, netWins: 70 }
      : { name: "Joe Torre", team: "NYY", year: 1998, teamName: "New York Yankees", ws: true, pen: false, netWins: 50 };
    const managerHit = opts.scoutSweep;
    const scoutHits = (opts.scoutSweep ? 8 : 1) + (managerHit ? 1 : 0);

    const totalWar = opts.slots.reduce((t, s) => t + s.war, 0);
    const rings = opts.slots.filter((s) => s.ws).length + (g.manager.ws ? 1 : 0);
    const pennants = opts.slots.filter((s) => s.pen).length + (g.manager.pen ? 1 : 0);
    const parts = score({
      totalWar,
      spendM: opts.spend,
      budgetM: opts.budget,
      awardLists: opts.slots.map((s) => s.awards),
      rings,
      pennants,
      managerRecord: [g.manager.wins, g.manager.losses],
      scoutHits,
    });
    const [wins, losses] = displayRecord(parts.expectedWins);
    const finale: FinaleResult = {
      parts,
      wins,
      losses,
      spend: opts.spend,
      budget: opts.budget,
      spinCount: 12,
      totalWar,
      best,
      bestManager,
      managerHit,
      scoutHits,
    };
    g.finale = finale;
    g.phase = "finale";
  });
}

/** Under cap: front-office-bonus ledger face, 💍💍🚩 pedigree, a full 9-⭐
 * scouting sweep (every squad row starred, every dream row green). Includes
 * the decorated long-name squad row (badge wrap proof) and a 🏠 hero. */
export function finaleUnder(): Game {
  const slots = [
    mkSigned({ id: "salty", name: "Jarrod Saltalamacchia", pos: "C", war: 2.1, costPaid: 4.2, awards: ["MVP3", "GG", "SS", "AS"], ws: true }),
    mkSigned({ name: "Bret Boone", pos: "2B", war: 5.2, costPaid: 9, awards: ["SS"] }),
    mkSigned({ name: "Alex Rodriguez", pos: "SS", war: 8.5, costPaid: 27, awards: ["MVP2", "GG", "SS", "AS"] }),
    mkSigned({ name: "Ichiro Suzuki", pos: "RF", war: 7.7, costPaid: 1, hero: true, awards: ["MVP", "ROY", "GG", "AS"], pen: true }),
    mkSigned({ name: "Edgar Martinez", pos: "DH", war: 5.5, costPaid: 11, awards: ["SS", "AS"], ws: true }),
    mkSigned({ name: "Randy Johnson", pos: "SP", war: 8.1, costPaid: 24, awards: ["CY", "AS"] }),
    mkSigned({ name: "Freddy Garcia", pos: "SP", war: 4.9, costPaid: 8, awards: ["AS"] }),
    mkSigned({ name: "Kazuhiro Sasaki", pos: "RP", war: 1.9, costPaid: 7, awards: ["ROY"] }),
  ];
  return forgeFinale({ slots, spend: 91.2, budget: 96.7, scoutSweep: true });
}

/** Over cap: luxury-tax ledger face, and a stacked pedigree (8💍 + 2🚩 > 8
 * emojis) that must fall back to the ×N chips. One scout hit, one empty
 * dream-team seat. */
export function finaleOver(): Game {
  const ws = (name: string, pos: string, war: number, costPaid: number) =>
    mkSigned({ name, pos, war, costPaid, ws: true });
  const slots = [
    ws("Jorge Posada", "C", 3.4, 12),
    ws("Tino Martinez", "1B", 2.9, 14),
    mkSigned({ name: "Scott Brosius", pos: "3B", war: 4.5, costPaid: 11, pen: true }),
    ws("Bernie Williams", "CF", 5.0, 18, ),
    ws("Darryl Strawberry", "DH", 1.8, 9),
    ws("David Cone", "SP", 4.8, 19),
    ws("David Wells", "SP", 3.9, 17),
    ws("Mariano Rivera", "RP", 3.6, 16),
  ];
  return forgeFinale({ slots, spend: 116, budget: 96.7, scoutSweep: false });
}

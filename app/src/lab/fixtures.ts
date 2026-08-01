/** Forged Game states for the dev-only UI lab (?lab). Every fixture builds a
 * REAL Game instance from synthetic data, so the lab renders the live
 * components under extreme inputs without replaying actual games. */
import { earnedBadges } from "../lib/badges";
import { Game, type GameConfig, type Signed } from "../lib/engine.svelte";
import { displayRecord, score } from "../lib/scoring";
import type { BestManager, FinaleResult } from "../lib/engine.svelte";
import type { BestPick, BestRoster } from "../lib/bestroster";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../lib/types";

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
export const stubIndex: GameIndex = { yearMin: 1985, yearMax: 2025, cards: [] };

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

/** Box Score market: every WAR tier, spendy/cheap costs, a wrapped-badges
 * long name, and a dead row (Edgar is already rostered). */
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

/** Armed 🏠 Homegrown: the market filters to debut-matching rows at the
 * flat $1M (HOMEGROWN_PRICE_M); everyone else is hard-gray until disarm.
 * The grayed rows span every WAR tier so the faded-tier treatment (gray rows
 * keep a washed chip/salary hue) can be judged across the whole ramp. */
export function hdGame(): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard({
      players: [
        mkPlayer({ name: "Ichiro Suzuki", pos: "RF", war: 7.7, cost: 14, debut: "SEA", awards: ["MVP", "ROY", "GG", "AS"] }),
        mkPlayer({ name: "Freddy Garcia", pos: "SP", war: 4.9, cost: 26.1, debut: "SEA", awards: ["AS"] }),
        mkPlayer({ name: "Alex Rodriguez", pos: "SS", war: 8.5, cost: 27, awards: ["MVP2", "GG", "SS", "AS"] }),
        mkPlayer({ name: "Edgar Martinez", pos: "DH", war: 6.5, cost: 11, awards: ["SS", "AS"] }),
        mkPlayer({ name: "Bret Boone", pos: "2B", war: 5.2, cost: 9, awards: ["SS"] }),
        mkPlayer({ name: "Mark McLemore", pos: "LF", war: 2.5, cost: 3 }),
        mkPlayer({ name: "Jeff Nelson", pos: "RP", war: 1.2, cost: 3.1 }),
      ],
    });
    g.powerups.hometown = "armed";
  });
}

/** ⭐ armed, browsing the open 🧢 tile: the manager career sheet
 * (SpecialPrimePicker) pulls the card skipper's real specials.json timeline
 * — Piniella's 23 cross-franchise seasons, MOY pills, negative-value TBD
 * years, and the grayed "here" row (SEA 2001). */
export function specialPrimeGame(): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard();
    g.powerups.prime = "armed";
    g.primeSpecial = "manager";
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
    // Badges run through the same function the engine calls at a real finale,
    // assembled from the same fields — a fixture that hardcoded a badge list
    // would keep rendering pills the triggers no longer award.
    const badges = earnedBadges({
      baselineWins: wins,
      baselineLosses: losses,
      total: parts.total,
      spendM: opts.spend,
      budgetM: opts.budget,
      budgetBonus: parts.budgetBonus,
      scoutHits,
      roster: opts.slots.map((s) => ({
        id: s.id,
        war: s.war,
        awards: s.awards,
        year: s.year,
        team: s.team,
        pos: s.pos,
      })),
      managerTeam: g.manager.team,
      managerYear: g.manager.year,
      rings,
      awardPoints: parts.awardPoints,
      managerMoty: g.manager.moty === true,
    });
    const finale: FinaleResult = {
      parts,
      wins,
      losses,
      badges,
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
 * the decorated long-name squad row (badge wrap proof) and a 🏠 discount
 * signing. Two pills: 108 wins matches the 1986 Mets (🍎, uncommon) and the
 * 9-hit sweep takes 🔮 (rare) — a filled pill row with no gold in it. */
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
  return forgeFinale({ slots, spend: 95.0, budget: 96.7, scoutSweep: true });
}

/** Over cap: luxury-tax ledger face, and a stacked pedigree (8💍 + 2🚩 > 8
 * emojis) that must fall back to the ×N chips. One scout hit, one empty
 * dream-team seat. The $19.3M bust clears 💸's $15M bar, the eight rings take
 * 💍, and a roster with no hardware at all takes 🕸️ — the mixed row, one
 * ultra pill between two dashed anti-trophies. */
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

/** The crown without the goal: a bought superteam. 71.7 WAR carries the
 * baseline past 117 wins, so 👑 supersedes every named rung, but the luxury
 * tax on the $128M payroll keeps the total short of 162. Four pills exactly —
 * 👑 💸 🏅 🏛️ — which is the row at its cap, one of each register: ultra gold,
 * dashed irony, sky, and violet. */
export function finaleMariners(): Game {
  const slots = [
    mkSigned({ name: "Iván Rodríguez", pos: "C", war: 6.4, costPaid: 12, year: 1999, team: "TEX", teamName: "Texas Rangers", awards: ["MVP", "GG", "AS"] }),
    mkSigned({ name: "Cal Ripken Jr.", pos: "SS", war: 11.5, costPaid: 21, year: 1991, team: "BAL", teamName: "Baltimore Orioles", awards: ["MVP", "GG", "SS", "AS"] }),
    mkSigned({ name: "Craig Biggio", pos: "2B", war: 9.4, costPaid: 14, year: 1997, team: "HOU", teamName: "Houston Astros", awards: ["GG", "SS", "AS"] }),
    mkSigned({ name: "Barry Bonds", pos: "LF", war: 11.9, costPaid: 24, year: 2001, team: "SFG", teamName: "San Francisco Giants", awards: ["MVP", "SS", "AS"] }),
    mkSigned({ name: "Mark McGwire", pos: "1B", war: 7.5, costPaid: 13, year: 1998, team: "STL", teamName: "St. Louis Cardinals", awards: ["SS", "AS"] }),
    mkSigned({ name: "Pedro Martínez", pos: "SP", war: 11.7, costPaid: 22, year: 2000, team: "BOS", teamName: "Boston Red Sox", awards: ["CY", "AS"] }),
    mkSigned({ name: "Greg Maddux", pos: "SP", war: 9.7, costPaid: 15, year: 1995, team: "ATL", teamName: "Atlanta Braves", awards: ["CY", "GG", "AS"], ws: true }),
    mkSigned({ name: "Billy Wagner", pos: "RP", war: 3.6, costPaid: 7, year: 1999, team: "HOU", teamName: "Houston Astros", awards: ["AS"] }),
  ];
  return forgeFinale({ slots, spend: 128, budget: 96.7, scoutSweep: false });
}

/** 🏆 PERFECT SEASON (and 👑 — a real perfect game clears both): 74.1 WAR,
 * near-cap payroll, big trophy case, and a 9-⭐ sweep push the total past
 * 162, so the record caps at 162–0 while the points line beneath keeps the
 * exact number. Five badges qualify (👑 🏆 🔮 🧱 ✊, the last from Frank
 * Thomas's 1994) — the four-pill cap drops ✊ from the tail, which is the
 * proof the wall can't happen. */
export function finalePerfect(): Game {
  const slots = [
    mkSigned({ name: "Mike Piazza", pos: "C", war: 8.7, costPaid: 11, year: 1997, team: "LAD", teamName: "Los Angeles Dodgers", awards: ["MVP2", "SS", "AS"] }),
    mkSigned({ name: "Cal Ripken Jr.", pos: "SS", war: 11.5, costPaid: 16, year: 1991, team: "BAL", teamName: "Baltimore Orioles", awards: ["MVP", "GG", "SS", "AS"] }),
    mkSigned({ name: "Alex Rodriguez", pos: "SS", war: 9.4, costPaid: 13, year: 2000, team: "SEA", teamName: "Seattle Mariners", awards: ["SS", "AS"] }),
    mkSigned({ name: "Barry Bonds", pos: "LF", war: 11.8, costPaid: 15, year: 2002, team: "SFG", teamName: "San Francisco Giants", awards: ["MVP", "SS", "AS"], pen: true }),
    mkSigned({ name: "Frank Thomas", pos: "DH", war: 6.3, costPaid: 9, year: 1994, team: "CHW", teamName: "Chicago White Sox", awards: ["MVP", "AS"] }),
    mkSigned({ name: "Pedro Martínez", pos: "SP", war: 11.7, costPaid: 14, year: 2000, team: "BOS", teamName: "Boston Red Sox", awards: ["CY", "AS"] }),
    mkSigned({ name: "Randy Johnson", pos: "SP", war: 10.4, costPaid: 12, year: 2001, team: "ARI", teamName: "Arizona Diamondbacks", awards: ["CY", "AS"], ws: true }),
    mkSigned({ name: "Mariano Rivera", pos: "RP", war: 4.3, costPaid: 5, year: 1996, team: "NYY", teamName: "New York Yankees", ws: true }),
  ];
  return forgeFinale({ slots, spend: 95, budget: 96.7, scoutSweep: true });
}

/** 💀 100-LOSS CLUB: −2.0 WAR of washed veterans, against a skipper worth
 * +14 wins, lands on 62–100 — the exact edge the skull sits on, so the
 * fixture fails loudly if the trigger ever moves. The payroll still blows the
 * cap by $3.3M, which stays UNBADGED (💸 needs a $15M overrun; an ordinary
 * bust is just the tax row), and two All-Star nods keep 🕸️ and 🏖️ off. The
 * skull is the only pill: one dashed anti-trophy on an empty line. */
export function finaleBad(): Game {
  const slots = [
    mkSigned({ name: "Jason Varitek", pos: "C", war: -0.1, costPaid: 10, year: 2008, team: "BOS", teamName: "Boston Red Sox", awards: ["AS"] }),
    mkSigned({ name: "Ryan Howard", pos: "1B", war: -0.4, costPaid: 20, year: 2011, team: "PHI", teamName: "Philadelphia Phillies" }),
    mkSigned({ name: "Alfonso Soriano", pos: "2B", war: -0.3, costPaid: 17, year: 2009, team: "CHC", teamName: "Chicago Cubs" }),
    mkSigned({ name: "Vernon Wells", pos: "CF", war: -0.2, costPaid: 21, year: 2011, team: "LAA", teamName: "Los Angeles Angels" }),
    mkSigned({ name: "Adam Dunn", pos: "DH", war: 0.1, costPaid: 12, year: 2012, team: "CHW", teamName: "Chicago White Sox", awards: ["AS"] }),
    mkSigned({ name: "Barry Zito", pos: "SP", war: -0.3, costPaid: 18, year: 2008, team: "SFG", teamName: "San Francisco Giants" }),
    mkSigned({ name: "Carl Pavano", pos: "SP", war: -0.4, costPaid: 11, year: 2005, team: "NYY", teamName: "New York Yankees" }),
    mkSigned({ name: "Jonathan Papelbon", pos: "RP", war: -0.4, costPaid: 8, year: 2016, team: "WSN", teamName: "Washington Nationals" }),
  ];
  return forgeFinale({ slots, spend: 100, budget: 96.7, scoutSweep: false });
}

/** 💯 + 🗑️: the plain end of the ramp. A 2017 Astros club lands on exactly
 * 100 wins, taking the century rung — the set's ONLY common badge, and the
 * only pill that wears the gray-on-gray treatment — beside the scandal badge
 * in rare violet. The pair is the rarity floor rendered against a rung three
 * steps up, which is the comparison the other fixtures can't make: every one
 * of them opens at uncommon or better. Deliberately earns nothing else — one
 * seat under 4.0
 * WAR keeps 🧱 off, three unpicked players keep 🏅 off, and the hardware that
 * did land keeps both anti-trophies away. */
export function finaleCentury(): Game {
  const hou = (name: string, pos: string, war: number, costPaid: number, awards: string[] = []) =>
    mkSigned({ name, pos, war, costPaid, awards, year: 2017, team: "HOU", teamName: "Houston Astros" });
  const slots = [
    hou("Brian McCann", "C", 2.5, 7),
    hou("Yuli Gurriel", "1B", 3.5, 8),
    hou("José Altuve", "2B", 6.0, 16, ["MVP", "SS", "AS"]),
    hou("George Springer", "CF", 4.5, 11, ["AS"]),
    hou("Alex Bregman", "3B", 4.5, 9),
    hou("Justin Verlander", "SP", 5.5, 14, ["GG"]),
    hou("Dallas Keuchel", "SP", 5.0, 10),
    hou("Ken Giles", "RP", 4.5, 6),
  ];
  return forgeFinale({ slots, spend: 81, budget: 96.7, scoutSweep: false });
}

/** 💸 MORTGAGED THE FARM: a $145M payroll of albatross contracts against the
 * $96.7M cap — a $48.3M overrun, comfortably past the badge's $15M bar —
 * carrying a 13.5-WAR roster to 78 wins. Two dashed pills and nothing else:
 * 💸 for the overrun and 🕸️ for a roster that won no hardware at all. The
 * all-irony row, where the anti-trophy treatment has to carry the line by
 * itself. */
export function finaleMortgaged(): Game {
  const slots = [
    mkSigned({ name: "Joe Mauer", pos: "C", war: 2.6, costPaid: 18, year: 2014, team: "MIN", teamName: "Minnesota Twins" }),
    mkSigned({ name: "Albert Pujols", pos: "1B", war: 0.8, costPaid: 14, year: 2013, team: "LAA", teamName: "Los Angeles Angels" }),
    mkSigned({ name: "Robinson Canó", pos: "2B", war: 3.0, costPaid: 20, year: 2018, team: "SEA", teamName: "Seattle Mariners" }),
    mkSigned({ name: "Jacoby Ellsbury", pos: "CF", war: 1.5, costPaid: 17, year: 2015, team: "NYY", teamName: "New York Yankees" }),
    mkSigned({ name: "Miguel Cabrera", pos: "DH", war: 0.9, costPaid: 22, year: 2017, team: "DET", teamName: "Detroit Tigers" }),
    mkSigned({ name: "David Price", pos: "SP", war: 2.4, costPaid: 24, year: 2017, team: "BOS", teamName: "Boston Red Sox" }),
    mkSigned({ name: "Zack Greinke", pos: "SP", war: 2.2, costPaid: 22, year: 2016, team: "ARI", teamName: "Arizona Diamondbacks" }),
    mkSigned({ name: "Craig Kimbrel", pos: "RP", war: 0.1, costPaid: 8, year: 2019, team: "CHC", teamName: "Chicago Cubs" }),
  ];
  return forgeFinale({ slots, spend: 145, budget: 96.7, scoutSweep: false });
}

/** 🧾 POCKETED THE DIFFERENCE: $35M spent of a $96.7M cap (36%) on a
 * scrap-heap roster — 12.0 WAR and a losing record with $61.7M left in the
 * owner's pocket. Cheap enough for 🧮 too, but the losing record decides
 * which face of the payroll axis fires, and 🕸️ joins it for a trophy case
 * that stayed as empty as the payroll. The under-half-cap payroll also eats a
 * −2.8 front-office penalty, so the ledger and the pills tell one joke. */
export function finalePocketed(): Game {
  const slots = [
    mkSigned({ name: "Jeff Mathis", pos: "C", war: 0.6, costPaid: 2, year: 2018, team: "ARI", teamName: "Arizona Diamondbacks" }),
    mkSigned({ name: "Yuniesky Betancourt", pos: "SS", war: 0.3, costPaid: 1, year: 2013, team: "MIL", teamName: "Milwaukee Brewers" }),
    mkSigned({ name: "Ronny Cedeño", pos: "2B", war: 1.9, costPaid: 2, year: 2011, team: "PIT", teamName: "Pittsburgh Pirates" }),
    mkSigned({ name: "Juan Pierre", pos: "LF", war: 2.6, costPaid: 3, year: 2012, team: "PHI", teamName: "Philadelphia Phillies" }),
    mkSigned({ name: "Delmon Young", pos: "DH", war: 1.2, costPaid: 6, year: 2012, team: "DET", teamName: "Detroit Tigers" }),
    mkSigned({ name: "Liván Hernández", pos: "SP", war: 2.4, costPaid: 5, year: 2011, team: "WSN", teamName: "Washington Nationals" }),
    mkSigned({ name: "Bronson Arroyo", pos: "SP", war: 2.0, costPaid: 9, year: 2014, team: "ARI", teamName: "Arizona Diamondbacks" }),
    mkSigned({ name: "Fernando Rodney", pos: "RP", war: 1.0, costPaid: 7, year: 2018, team: "MIN", teamName: "Minnesota Twins" }),
  ];
  return forgeFinale({ slots, spend: 35, budget: 96.7, scoutSweep: false });
}

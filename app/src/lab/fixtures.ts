/** Forged Game states for the dev-only UI lab (?lab). Every fixture builds a
 * REAL Game instance from synthetic data, so the lab renders the live
 * components under extreme inputs without replaying actual games. */
import { BADGE_BY_KEY, earnedBadges, type BadgeDef } from "../lib/badges";
import { Game, type GameConfig, type ManagerPick, type Signed } from "../lib/engine.svelte";
import { recordFromTotal } from "../lib/format";
import { GAMES, MARINERS_WINS, displayRecord, score } from "../lib/scoring";
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
  const g = { c: 0, if: 0, of: 0 };
  if (pos === "C") g.c = 100;
  else if (["1B", "2B", "3B", "SS"].includes(pos)) g.if = 100;
  else if (["LF", "CF", "RF", "OF"].includes(pos)) g.of = 100;
  return g;
}

let nextId = 0;
export function mkPlayer(over: Partial<CardPlayer> & { name: string; pos: string }): CardPlayer {
  return {
    id: over.id ?? `lab${nextId++}`,
    war: 2.0,
    cost: 5,
    awards: [],
    ws: false,
    pen: false,
    posG: posGFor(over.pos),
    debut: "XXX",
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

/** ⭐ armed, browsing a decorated player: the career sheet (PrimePicker)
 * pulls Ichiro's real seasons — award-pill rows dense enough to wrap to a
 * second line at phone widths, the WBC medal, and the grayed "here" row
 * (SEA 2001). The wrap is the point of the gallery: it is where the pill
 * row's optical nudge meets the pills' pinned whole-pixel edges. */
export function primePickGame(): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard({
      players: [
        mkPlayer({ id: "suzukic01", name: "Ichiro Suzuki", pos: "RF", war: 7.7, cost: 14, awards: ["MVP", "ROY", "GG", "SS", "AS"] }),
      ],
    });
    g.powerups.prime = "armed";
    g.primePick = "suzukic01";
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
  // Seats 1 and 3 carry enough hardware to WRAP the wide row's lane to a
  // second line — the decorated-seat geometry (finale squad row's own) that
  // an undecorated roster never shows.
  const hardware: Partial<Signed>[] = [];
  hardware[1] = { awards: ["MVP", "SS", "AS"], ws: true, hero: true };
  hardware[3] = { awards: ["MVP", "GG", "GG", "AS"], pen: true };
  seats.forEach(([name, pos], i) => {
    g.slots[i] = mkSigned({ name, pos, war: 1 + i * 0.3, costPaid: 4 + i, ...hardware[i] });
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
  preOwnerSpent: spendGame(CLASSIC, 34, false),
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

/** How a fixture asks for the ceiling fields.
 *
 * `solved` is the SOLVER's own unclamped total, expressed as a function of the
 * total the forged club actually scored — everything else is derived from it
 * exactly the way the engine derives it, so a fixture can never print a ceiling
 * that disagrees with its own stamp. Returning less than the player's total is
 * the real case where the search lost to a line it does not model. */
interface CeilingSpec {
  solved: (playerTotal: number) => number;
}

/** The two front offices, one per list, chosen so the pair proves two things.
 *
 * The owner card is the SAME on both sides: the club the player hired is the
 * club the solver would have hired. Neither seat is scoutable, so that
 * coincidence must earn no ⭐ and no tint — the fixture is how that stays true.
 *
 * The ballparks differ, and the dream club's carries a real 27-character name,
 * which is what proves the row ellipsizes on a phone instead of widening the
 * list. Both franchises resolve to a real name in stubOwners. */
const HIRED_OWNER = {
  name: "Hiroshi Yamauchi",
  budget: 92.1,
  franchise: "SEA",
  year: 2001,
  teamName: "Seattle Mariners",
};
const BOUGHT_PARK = { park: "Safeco Field", mult: 1.05, franchise: "SEA", year: 2001 };
const DREAM_OWNER = {
  team: "SEA",
  year: 2001,
  teamName: "Seattle Mariners",
  franchise: "SEA",
  budget: 92.1,
};
const DREAM_PARK = {
  team: "OAK",
  year: 2002,
  teamName: "Oakland Athletics",
  franchise: "OAK",
  park: "Network Associates Coliseum",
  mult: 0.86,
};

/** A finale-phase Game built from hand-picked slots and score inputs. The
 * ledger, squads, and dream team all render from this forged FinaleResult. */
function forgeFinale(opts: {
  slots: Signed[];
  spend: number;
  budget: number;
  scoutSweep: boolean; // true → every pick matches (9 ⭐); false → 1 hit + an empty seat
  /** The hired skipper. Piniella's +14 wins is the house default; a fixture
   * aiming at a specific win total hires someone else to move the baseline. */
  manager?: ManagerPick;
  /** Omitted → the ceiling fields stay absent, which is a finale restored from
   * a save written before they existed. Every fixture below this one predates
   * them and keeps that path covered. */
  ceiling?: CeilingSpec;
  /** The classic bank hires an owner and buys a ballpark — both lists then
   * carry the two front-office rows. A fixed cap (Moneyball / Blank Check) sets
   * payroll directly and has neither seat, so neither list grows the rows.
   * Omitted → no front office anywhere, which is what every fixture written
   * before these rows existed shows. */
  frontOffice?: boolean;
  config?: GameConfig;
}): Game {
  return forgeGame(opts.config ?? CLASSIC, (g) => {
    opts.slots.forEach((s, i) => (g.slots[i] = s));
    if (opts.frontOffice) {
      g.owner = { ...HIRED_OWNER };
      g.stadium = { ...BOUGHT_PARK };
    }
    g.manager = opts.manager ?? { name: "Lou Piniella", wins: 116, losses: 46, year: 2001, team: "SEA", teamName: "Seattle Mariners", ws: false, pen: true };
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
      scoutHits,
      roster: opts.slots.map((s) => ({
        id: s.id,
        name: s.name,
        war: s.war,
        awards: s.awards,
        year: s.year,
        team: s.team,
        pos: s.pos,
        franchise: s.franchise,
        costPaid: s.costPaid,
        hero: s.hero,
        age: s.age,
      })),
      managerTeam: g.manager.team,
      managerYear: g.manager.year,
      managerName: g.manager.name,
      rings,
      // The WBC counts are omitted on purpose: lab clubs carry no WBC seats,
      // so absent-read-as-zero is the truth here, not a gap.
      pennants,
      awardPoints: parts.awardPoints,
      managerMoty: g.manager.moty === true,
      owner: g.owner,
      stadium: g.stadium,
      // Lab games never spin, so stubIndex carries no rows to resolve an
      // alignment against — 🗺️ is simply unreachable in the lab.
      divisions: [],
      powerups: {
        spent: Object.values(g.powerups).filter((s) => s === "spent").length,
        total: Object.values(g.powerups).length,
      },
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
    // The ceiling, derived here the way engine.svelte.ts derives it and not one
    // step differently: the club actually built is the search's incumbent, so
    // the printed ceiling is floored at the player's own total, and the record
    // comes out of the same recordFromTotal the stamp uses. A fixture that hand
    // -set these could show a record its own points contradict.
    if (opts.frontOffice) {
      best.owner = { ...DREAM_OWNER };
      best.park = { ...DREAM_PARK };
    }
    if (opts.ceiling) {
      // The dream club's payroll, and what it spends of it. A solver maximizing
      // SCORE fills its cap — the measured shape is a dream club at ~96% of
      // payroll against a player at 78–91%, which is the whole reason the two
      // blocks sit side by side: it is what explains a dream club carrying LESS
      // WAR than the one the player built.
      best.budget = opts.frontOffice
        ? Number((DREAM_OWNER.budget * DREAM_PARK.mult).toFixed(1))
        : opts.budget;
      best.spend = Number((best.budget * 0.966).toFixed(1));
      const solved = Number(opts.ceiling.solved(parts.total).toFixed(1));
      best.total = solved;
      const bestPossibleTotal = Math.max(solved, parts.total);
      finale.bestPossibleTotal = bestPossibleTotal;
      finale.bestPossibleRecord = recordFromTotal(bestPossibleTotal, GAMES, MARINERS_WINS);
      finale.playedTheCeiling = bestPossibleTotal <= parts.total;
    }
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
 * 👑 💸 🏅 🏛️ — which is the row at its cap, one of each register: the
 * inverted legendary, dashed ironic, sky, and violet. */
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
 * proof the wall can't happen. It is also the only row that opens with two
 * legendaries side by side: 👑 and 🏆 are the whole tier. */
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
 * all-ironic row, where the anti-trophy treatment has to carry the line by
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

/** 👔 DON'T QUIT YOUR DAY JOB: the floor of the on-field ladder, 0–162.
 *
 * The roster is invented rather than cast from real players: −34.0 WAR over
 * eight seats is −4.25 apiece, worse than any season anyone has ever actually
 * posted, and putting a real name on a forged number is a lie the lab does not
 * need to tell. With the 41–121 skipper's −16 wins, 50 − 34 − 16 lands the
 * baseline on exactly 0, which is what 👔 requires — one win more and 📉 fires
 * instead.
 *
 * The payroll sits at $90M of the $96.7M cap on purpose: too high for 🧾 and
 * too low for 💵, so the payroll axis stays silent and the row is the two
 * anti-trophies the season actually earned — 👔 for the record and 🕸️ for a
 * club that won no hardware at all. */
export function finaleDayjob(): Game {
  const scrub = (name: string, pos: string, war: number) =>
    mkSigned({ name, pos, war, costPaid: 11.25, year: 2024, team: "CHW", teamName: "Chicago White Sox" });
  const slots = [
    scrub("Waiver Wire", "C", -4.0),
    scrub("Rule 5 Pick", "1B", -4.3),
    scrub("Spring Invitee", "2B", -4.2),
    scrub("Emergency Callup", "CF", -4.5),
    scrub("Rehab Assignment", "DH", -4.1),
    scrub("Bullpen Day", "SP", -4.4),
    scrub("Opener Experiment", "SP", -4.3),
    scrub("Position Player Pitching", "RP", -4.2),
  ];
  return forgeFinale({
    slots,
    spend: 90,
    budget: 96.7,
    scoutSweep: false,
    manager: { name: "Pedro Grifol", wins: 41, losses: 121, year: 2024, team: "CHW", teamName: "Chicago White Sox", ws: false, pen: false },
  });
}

// ---------- ceiling fixtures ----------

/* One club, six ceilings.
 *
 * The ceiling block and the two lists' front-office rows are the state under
 * review, so everything else is held still: the same 2015 Cubs roster, the same
 * skipper, the same payroll, the same single scout hit, the same hired owner and
 * ballpark. Anything that moves between these fixtures is the ceiling.
 *
 * The roster is deliberately quiet — no rings, no pennants, three award pills —
 * because a stacked pedigree or a full brag row would pull the eye off the block
 * being judged. Every other finale fixture above carries the loud states.
 *
 * All six sit ABOVE the ceiling in the file only by convention; the fixtures
 * that predate them (every one above) keep the old-record path covered, where
 * the three fields are absent entirely and the finale renders no ceiling at all. */
const ceilSlots = (): Signed[] => {
  const cub = (name: string, pos: string, war: number, costPaid: number, awards: string[] = []) =>
    mkSigned({ name, pos, war, costPaid, awards, year: 2015, team: "CHC", teamName: "Chicago Cubs", franchise: "CHC" });
  return [
    cub("Miguel Montero", "C", 1.6, 9),
    cub("Anthony Rizzo", "1B", 5.9, 15, ["AS"]),
    cub("Addison Russell", "SS", 1.9, 4),
    cub("Dexter Fowler", "CF", 2.3, 8),
    cub("Kris Bryant", "3B", 6.1, 12, ["ROY"]),
    cub("Jake Arrieta", "SP", 8.3, 18, ["CY", "AS"]),
    cub("Jon Lester", "SP", 3.4, 17),
    cub("Héctor Rondón", "RP", 1.4, 5),
  ];
};

function ceilingGame(ceiling: CeilingSpec, frontOffice = true, config?: GameConfig): Game {
  return forgeFinale({
    slots: ceilSlots(),
    spend: 88,
    budget: 96.7,
    scoutSweep: false,
    manager: { name: "Joe Maddon", wins: 97, losses: 65, year: 2015, team: "CHC", teamName: "Chicago Cubs", ws: false, pen: false },
    ceiling,
    frontOffice,
    config,
  });
}

/** The ordinary ceiling: a club the cards could have made that scores well
 * clear of the one built. +21.6 is a shade above the measured gap (bot runs
 * average a 154.4 ceiling against a 136.8 achieved), so this is the state most
 * finales land in. Both lists carry their front office, and the OWNER row is
 * the same card on both sides — the coincidence that must earn no cue. */
export function finaleCeilingAbove(): Game {
  return ceilingGame({ solved: (t) => t + 21.6 });
}

/** The ceiling IS the club built, and the solver's own answer agrees: the block
 * prints a record and a points total identical to the stamp's, which is the
 * whole message. Nothing is said about it. */
export function finaleCeilingMet(): Game {
  return ceilingGame({ solved: (t) => t });
}

/** The finale where the player OUTSCORED the search. The search's own club
 * scores 3.1 below the one built: ✌️ and repeat landings are modeled, so a
 * real beat comes off 🏠 Homegrown (unmodeled on purpose, to keep this state
 * reachable) or the search's own shortlist gap. The caption prints the dream
 * club's own losing number RAW — it must be true of the roster beneath it,
 * and 🦉 OUTSCOUTED is a claim about exactly this number
 * (finale-ceiling.test.ts pins both). */
export function finaleCeilingMatched(): Game {
  return ceilingGame({ solved: (t) => t - 3.1 });
}

/** The near-miss that fires most often: 21.85% of full-powerup games reach a
 * ≥162 ceiling and 0.85% cash it. The record caps at 162–0 and the points line
 * keeps the number that earned it. Still no commentary — the gap between this
 * and the stamp is the player's to read. */
export function finaleCeilingPerfect(): Game {
  return ceilingGame({ solved: () => 168.4 });
}

/** The rounding edge: a ceiling genuinely above the player's total that lands
 * on the SAME record once rounded, so the block prints a record identical to
 * the stamp's. Nothing contradicts — the points line beneath carries the whole
 * difference, which is exactly the job it does under the stamp too. */
export function finaleCeilingSameRecord(): Game {
  return ceilingGame({ solved: (t) => Math.round(t) + 0.4 });
}

/** Moneyball: payroll is a constant, so there is no owner to hire and no
 * ballpark to buy — on EITHER side. The ceiling still prints; neither list
 * grows a front-office row, empty or otherwise. Test-only; "two rows absent"
 * has no visual state a lab screenshot could judge. */
export function finaleCeilingFixedBank(): Game {
  return ceilingGame({ solved: (t) => t + 12 }, false, {
    difficulty: "standard",
    bank: "moneyball",
  });
}

/** The rarity ladder as bare pills, rarest first, plus the locked slots.
 *
 * Every other finale fixture shows pills in the company of a season, which is
 * how a player meets them — but no single season can hold all six tiers (the
 * row caps at four, and legendary and common are mutually exclusive on the
 * on-field axis). This list exists so the ramp can be read top to bottom in one
 * glance, and so the locked silhouette — a trophy-case state that never appears
 * at a finale at all — is reviewable without a save file. */
export const PILL_LADDER: {
  badge: BadgeDef;
  locked: boolean;
  note: string;
  fresh?: boolean;
}[] = [
  { badge: BADGE_BY_KEY.crown, locked: false, note: "legendary — ink fill, gold text, gold ring" },
  { badge: BADGE_BY_KEY.mariners, locked: false, note: "ultra — gold wash, no inner ring" },
  { badge: BADGE_BY_KEY.crystal, locked: false, note: "rare — violet wash" },
  { badge: BADGE_BY_KEY.allstars, locked: false, note: "uncommon — sky wash" },
  { badge: BADGE_BY_KEY.hundred, locked: false, note: "common — gray on a gray hairline" },
  { badge: BADGE_BY_KEY.skull, locked: false, note: "ironic — brick wash on a SOLID brick border" },
  { badge: BADGE_BY_KEY.rings, locked: true, note: "locked ultra — the tier survives, the identity does not" },
  {
    badge: BADGE_BY_KEY.threebrothers,
    locked: true,
    note: "locked secret — glyph kept, name withheld: a hint, not an errand",
  },
  // The anonymous silhouette on the one INVERTED pill, which is the pairing
  // that needs looking at: every other locked slot fades a pale wash, this one
  // fades an ink fill with gold type on it, and "? ? ?" has to survive that.
  // Forged rather than taken from the table — the badge is `secret` here so the
  // state is reviewable from the component's own contract, whatever the table
  // currently marks.
  {
    badge: { ...BADGE_BY_KEY.crown, secret: true },
    locked: true,
    note: "locked legendary — the anonymous form against the inverted pill",
  },
  // The finale-only state, once per rarity. The chip's own geometry is the
  // reason it needs the full ramp rather than one sample: it is a solid mass
  // sitting inside the pill's left padding, so how snug it looks is a judgement
  // against every fill behind it — and on legendary it inverts to gold, or it
  // would vanish into the ink.
  {
    badge: BADGE_BY_KEY.crown,
    locked: false,
    fresh: true,
    note: "NEW on legendary — the chip inverts to gold, or it would vanish",
  },
  {
    badge: BADGE_BY_KEY.mariners,
    locked: false,
    fresh: true,
    note: "NEW on ultra — ink chip on gold, the highest-contrast pairing",
  },
  {
    badge: BADGE_BY_KEY.crystal,
    locked: false,
    fresh: true,
    note: "NEW on rare — first time ever earned; ink chip, leading the pill",
  },
  {
    badge: BADGE_BY_KEY.allstars,
    locked: false,
    fresh: true,
    note: "NEW on uncommon — sky wash behind the chip",
  },
  {
    badge: BADGE_BY_KEY.hundred,
    locked: false,
    fresh: true,
    note: "NEW on common — the one pill whose own border is a gray hairline",
  },
  {
    badge: BADGE_BY_KEY.skull,
    locked: false,
    fresh: true,
    note: "NEW on ironic — an anti-trophy can be a first, too",
  },
];

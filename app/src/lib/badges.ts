import { GOAL_POINTS } from "./scoring";

/* The badge set — one table, read by the finale pill row, the share string,
 * and the home trophy case. Adding a badge means adding one BadgeDef and one
 * trigger; nothing else in the app enumerates badges.
 *
 * Two rules govern the set:
 *
 * 1. Named on-field rungs are World Series winners, matched EXACTLY. A rung
 *    is a club whose win total you hit on the nose, so the ladder can be dense
 *    without any rung swallowing its neighbours. Every club below is verified
 *    against data/cards/ — see tests/badges-supply.test.ts, which fails if a
 *    data regen moves a total out from under a label.
 *
 *    The one exception is 🔱 at 116. No club has ever won the Series with 116
 *    wins — 2001 Seattle and 1906 Chicago both hold the record and both lost —
 *    so it is the RECORD rung rather than a champion rung. It keeps the same
 *    "MATCHED" wording as its neighbours anyway: the ladder reads as one list,
 *    and a lone verb change costs more in consistency than it buys in
 *    precision. It stays because 116 is also the blue rung on the record
 *    ladder in format.ts — the two screens agree.
 *
 *    109–113 is empty on purpose. The only club in that band is the 2022
 *    Dodgers at 111, who lost the NLDS, so the champion rule has nothing to
 *    offer between the Mets at 108 and the Yankees at 114. Those five totals
 *    carry 12.6% of reference games — more than any single named rung — but
 *    they all earn 💯, so the band is unnamed rather than unrewarded.
 *
 *    The one genuinely bare stretch is 95–99, five totals just short of the
 *    century that earn nothing at all (16.4% of reference games, 5.3% of them
 *    on 99 alone — the most common unbadged total in the game). It is the
 *    price of the champion rule: no club won a title with 95–97 or 99 wins in
 *    the dataset era, and inventing a rung there would break the rule the
 *    ladder is built on.
 *
 * 2. Records are BASELINE wins, never the total-derived record. Awards, rings,
 *    and the payroll bonus routinely add 20+ wins to the stamp; keying the
 *    rungs to that would make 💯 automatic. The stamp is a flourish, the
 *    badges are a scorecard.
 */

/** The collection ladder. `legend` sits above `ultra` and holds the two badges
 * that say "you maxed out an axis" rather than "this was rare" — the frequency
 * gap between them and ultra is small, the statement is not. It is styled
 * inverted from every other tier (ink fill, gold text) so it reads as beyond
 * the ladder rather than one more rung on it. */
export type Rarity =
  "legend" | "ultra" | "rare" | "uncommon" | "common" | "ironic";

/** Which slot a badge competes for. Within an exclusive axis exactly one badge
 * fires; `roster`, `era`, and `goal` stack freely. */
export type BadgeAxis =
  "onfield" | "goal" | "payroll" | "scout" | "roster" | "era";

export interface BadgeDef {
  key: string;
  emoji: string;
  /** Finale pill and trophy-case text, sans emoji. */
  label: string;
  rarity: Rarity;
  axis: BadgeAxis;
  /** An anti-trophy: rendered dashed and muted, and never given a locked
   * trophy-case slot — a visible empty slot is an invitation, and inviting
   * someone to lose 100 games inverts the incentive. */
  ironic?: boolean;
  /** Plain-language trigger, shown when a player opens an earned badge in the
   * trophy case. Written as the condition they met, not as a rule they should
   * chase — locked badges never reveal it. */
  how: string;
  /** Measured rate in the reference population (Clean House + all powerups),
   * or null where the rung postdates the last study. The number lives beside
   * the definition so it cannot go stale in a comment somewhere else. */
  freq: number | null;
}

/** Per-season facts the roster badges read, one entry per filled slot. */
export interface BadgeRosterEntry {
  /** Stable player id ("ohtansh01") — the deferred-money badge names people. */
  id: string;
  /** Display name, matched against the hired skipper's for 📋. */
  name: string;
  war: number;
  awards: string[];
  year: number;
  /** Franchise code as the data spells it ("HOU") — the scandal badge is the
   * only trigger keyed to a specific club. */
  team: string;
  pos: string;
}

/** Everything the triggers need. Assembled once at the finale; the share
 * string and the history entry both read the result rather than re-deriving. */
export interface BadgeFacts {
  baselineWins: number;
  baselineLosses: number;
  /** Final points — 🏆 fires at the 162 goal. */
  total: number;
  spendM: number;
  budgetM: number;
  /** `ScoreParts.budgetBonus`; 💵 wants it near its 10-point ceiling. */
  budgetBonus: number;
  scoutHits: number;
  /** Filled roster slots only — empty seats are simply absent, so a partial
   * club can never earn a "every player …" badge by vacancy. */
  roster: BadgeRosterEntry[];
  /** The hired skipper's season, or null with the dugout empty. Only the era
   * badges read it: a manager is a member of that team-year the same way a
   * player is, so a scandal club's skipper counts. */
  managerTeam: string | null;
  managerYear: number | null;
  /** The hired skipper's name, or null with the dugout empty. */
  managerName: string | null;
  /** `Game.pedigree.rings`. */
  rings: number;
  /** `ScoreParts.awardPoints` — includes the manager's MotY points. */
  awardPoints: number;
  managerMoty: boolean;
}

const FARM_TAX_M = 15; // $M over the bankroll before the overrun earns its pill
const DIME_BONUS = 9.9; // payroll bonus this high means the cap is all but exactly spent
const CHEAP_PCT = 0.6; // spend/cap at or under this is a pocketed payroll
const PINCH_PCT = 0.5; // …and this cheap WITH a winning record is a skill brag
const PINCH_WINS = 95;
const CRYSTAL_HITS = 7; // dream-team picks found (of 8, or 9 with a manager)
const RING_BEARERS = 4;
const COOPERSTOWN_PTS = 30;
const NO_WEAK_LINK_WAR = 4.0; // the WAR ladder's own green→blue boundary
const SKIPPER_WINS = 105;
const ROSTER_SLOTS = 8;

/** The seasons the Commissioner's report found the trash can running. 2019 was
 * alleged and never substantiated, so it is not here — the badge names a
 * finding, not a rumour. Anyone on those two clubs trips it, skipper included:
 * the manager was suspended for exactly this. */
const SCANDAL_TEAM = "HOU";
const SCANDAL_YEARS = [2017, 2018];
function isScandal(p: { team: string | null; year: number | null }): boolean {
  return (
    p.team === SCANDAL_TEAM && p.year !== null && SCANDAL_YEARS.includes(p.year)
  );
}

/** The two contracts baseball tells stories about paying off for decades:
 * Bonilla in a Mets uniform and Ohtani in a Dodgers one. Both are keyed to the
 * club rather than the player alone, because it is the pairing that carries
 * the folklore — Bonilla in Pittsburgh is just a good third baseman.
 *
 * The Bonilla side is deliberately his 1992–95 Mets tenure rather than the
 * 1999 season the deferral actually bought out. That 1999 season is not
 * draftable: he hit .160 over 60 games and the card build filters him off the
 * NYM 1999 roster entirely, so a literal trigger could never fire. */
const DEFERRED: Record<string, string> = {
  bonilbo01: "NYM",
  ohtansh01: "LAD",
};
function isDeferred(p: { id: string; team: string }): boolean {
  return DEFERRED[p.id] === p.team;
}

/** The 1995 replacement players who later reached the majors and are still
 * draftable here. Every name is carried by both published transcriptions of
 * the Players Association's own classification list — Baseball Almanac's and
 * Tim Kurkjian's in ESPN The Magazine. Anyone a second publication does not
 * carry is off it, and so is anyone whose Baseball-Reference id could be
 * confused with another player's: Pedro Borbón Jr. and the 2008 Greg Smith
 * both look like matches by name and are not the men who crossed. Damian
 * Miller is off it as the one genuinely disputed case — the union classifies
 * him and never admitted him; he says the Twins told him one "B" game would
 * cost him nothing. The badge does not pick a side by naming him.
 *
 * Keyed on the player alone, not the club: the 1995 spring is a fact about the
 * person that every one of his seasons carries.
 *
 * These ids are subtracted from ✊ PICKET LINE — a replacement player cannot
 * stand for the strike he crossed — but only for himself. Any OTHER 1994
 * season still earns the picket line, so one club can carry both: one man
 * walked out, another walked in, which is the actual history.
 *
 * The consequence the copy points at is documented and permanent: none of
 * these men was ever admitted to the MLBPA. */
export const REPLACEMENTS: ReadonlySet<string> = new Set([
  "agbaybe01", // Benny Agbayani
  "daubabr01", // Brian Daubach
  "donnebr01", // Brendan Donnelly
  "echevan01", // Angel Echevarria
  "hergema01", // Matt Herges
  "lidleco01", // Cory Lidle
  "ligteke01", // Kerry Ligtenberg
  "loiseri01", // Rich Loiselle
  "mahayro01", // Ron Mahay
  "martito02", // Tom Martin
  "menecfr01", // Frank Menechino
  "merlolo01", // Lou Merloni
  "millake01", // Kevin Millar
  "oropeed01", // Eddie Oropesa
  "osikke01", // Keith Osik
  "reedri01", // Rick Reed
  "smithch07", // Chuck Smith
  "spencsh01", // Shane Spencer
  "tamje01", // Jeff Tam
  "tollbbr01", // Brian Tollberg
  "trubych01", // Chris Truby
  "walkeja01", // Jamie Walker
]);

/** The champion rungs, keyed on the exact win total that matches them. Every
 * total is a real club's real record; 🔱 is the record rung (see the file
 * comment) and 👑 is the only rung that names no club. */
export const MATCHED: Record<number, string> = {
  98: "redsox",
  103: "cubs",
  106: "astros",
  108: "mets",
  114: "yankees",
  116: "mariners",
};
export const CROWN_WINS = 117;
export const HUNDRED_WINS = 100;
/** One win worse than the 2024 White Sox at 41–121, the worst full season in
 * the dataset — the floor's answer to CROWN_WINS. Pinned in badges-supply. */
export const WORST_WINS = 40;

export const BADGES: BadgeDef[] = [
  // ---- on-field: exactly one fires, resolved crown → named rung → 💯 ----
  {
    key: "crown",
    emoji: "👑",
    label: "BEST RECORD OF ALL TIME",
    rarity: "legend",
    axis: "onfield",
    freq: 1.33,
    how: "117 wins or more — better than any club has ever finished.",
  },
  {
    key: "mariners",
    emoji: "🔱",
    label: "MATCHED THE 2001 MARINERS",
    rarity: "ultra",
    axis: "onfield",
    freq: 0.63,
    how: "Exactly 116 wins, tying the record the 2001 Mariners still hold.",
  },
  {
    key: "yankees",
    emoji: "🗽",
    label: "MATCHED THE 1998 YANKEES",
    rarity: "ultra",
    axis: "onfield",
    freq: 1.4,
    how: "Exactly 114 wins, matching the 1998 Yankees.",
  },
  /* The champion rungs climb in rarity with the win total they name, which is
   * also what the measurement says: 4.29 / 4.92 / 4.99 / 5.95 percent, rarest
   * first. The split falls on the 5% band line between the Astros and the Red
   * Sox, so the tier a player sees and the frequency they actually hit agree. */
  {
    key: "mets",
    emoji: "🍎",
    label: "MATCHED THE 1986 METS",
    rarity: "rare",
    axis: "onfield",
    freq: 4.29,
    how: "Exactly 108 wins, matching the 1986 Mets.",
  },
  {
    key: "astros",
    emoji: "🚀",
    label: "MATCHED THE 2022 ASTROS",
    rarity: "rare",
    axis: "onfield",
    freq: 4.92,
    how: "Exactly 106 wins, matching the 2022 Astros.",
  },
  {
    key: "cubs",
    emoji: "🐻",
    label: "MATCHED THE 2016 CUBS",
    rarity: "uncommon",
    axis: "onfield",
    freq: 5.95,
    how: "Exactly 103 wins, matching the 2016 Cubs.",
  },
  {
    key: "redsox",
    emoji: "🧦",
    label: "MATCHED THE 2004 RED SOX",
    rarity: "uncommon",
    axis: "onfield",
    freq: 4.99,
    how: "Exactly 98 wins, matching the 2004 Red Sox.",
  },
  {
    key: "hundred",
    emoji: "💯",
    label: "100-WIN CLUB",
    rarity: "common",
    axis: "onfield",
    freq: 47.37,
    how: "100 wins or more, on a total no champion has posted exactly.",
  },
  /* The bottom two rungs mirror the top two. 👑 fires above the best record
   * anyone ever posted (116, so 117+); 📉 fires below the worst anyone ever
   * posted (41, so 40 and under). 👔 is the true floor — an 0–162 season is
   * not a baseball result at all — and it supersedes 📉 exactly as 👑
   * supersedes a named rung. */
  {
    key: "dayjob",
    emoji: "👔",
    label: "DON'T QUIT YOUR DAY JOB",
    rarity: "ironic",
    axis: "onfield",
    ironic: true,
    freq: 0,
    how: "An 0–162 season. Every game, lost.",
  },
  {
    key: "worst",
    emoji: "📉",
    label: "WORST RECORD OF ALL TIME",
    rarity: "ironic",
    axis: "onfield",
    ironic: true,
    freq: 0,
    how: "40 wins or fewer — worse than any club has ever finished.",
  },
  {
    key: "skull",
    emoji: "💀",
    label: "100-LOSS CLUB",
    rarity: "ironic",
    axis: "onfield",
    ironic: true,
    freq: 0,
    how: "100 losses or more.",
  },

  // ---- the goal, its own axis ----
  {
    key: "perfect",
    emoji: "🏆",
    label: "PERFECT SEASON",
    rarity: "legend",
    axis: "goal",
    freq: 1.01,
    how: "A full 162 points — the game's stated goal.",
  },

  // ---- payroll: exactly one fires ----
  {
    key: "farm",
    emoji: "💸",
    label: "MORTGAGED THE FARM",
    rarity: "ironic",
    axis: "payroll",
    ironic: true,
    freq: 0.5,
    how: "Finished $15M or more past your payroll.",
  },
  {
    key: "dime",
    emoji: "💵",
    label: "SPENT EVERY DIME",
    rarity: "rare",
    axis: "payroll",
    freq: 4.98,
    how: "Spent all but a sliver of your payroll without going over it.",
  },
  {
    key: "pinch",
    emoji: "🧮",
    label: "PINCHED EVERY PENNY",
    rarity: "rare",
    axis: "payroll",
    freq: 2.33,
    how: "95 wins or more on half your payroll or less.",
  },
  {
    key: "pocket",
    emoji: "🧾",
    label: "POCKETED THE DIFFERENCE",
    rarity: "ironic",
    axis: "payroll",
    ironic: true,
    freq: 0,
    how: "Left 40% of your payroll unspent and still finished under .500.",
  },

  // ---- scouting ----
  {
    key: "crystal",
    emoji: "🔮",
    label: "CRYSTAL BALL",
    rarity: "rare",
    axis: "scout",
    freq: 3.25,
    how: "Drafted 7 or more of the players the dream team wanted.",
  },

  // ---- roster shape: these stack ----
  {
    key: "allstars",
    emoji: "🏅",
    label: "ALL-STAR ROSTER",
    rarity: "uncommon",
    axis: "roster",
    freq: 6.05,
    how: "All eight players made an All-Star team that year.",
  },
  {
    key: "twoway",
    emoji: "🃏",
    label: "THE TWO-WAY GUY",
    rarity: "rare",
    axis: "roster",
    freq: 3.79,
    how: "Rostered a season someone both pitched and hit in.",
  },
  {
    key: "noweak",
    emoji: "🧱",
    label: "NO WEAK LINKS",
    rarity: "rare",
    axis: "roster",
    freq: 3.04,
    how: "Every player on the roster posted 4.0 WAR or better.",
  },
  {
    key: "cooperstown",
    emoji: "🏛️",
    label: "COOPERSTOWN CLASS",
    rarity: "rare",
    axis: "roster",
    freq: 2.05,
    how: "Collected 30 or more award points across the club.",
  },
  {
    key: "rings",
    emoji: "💍",
    label: "RING BEARERS",
    rarity: "ultra",
    axis: "roster",
    freq: 1.48,
    how: "Four or more players wearing a World Series ring.",
  },
  {
    key: "skipper",
    emoji: "🧢",
    label: "PUSHED THE RIGHT BUTTONS",
    rarity: "uncommon",
    axis: "roster",
    freq: 9.91,
    how: "Hired a Manager of the Year and won more than 105 games.",
  },
  {
    key: "nohardware",
    emoji: "🕸️",
    label: "EMPTY TROPHY CASE",
    rarity: "ironic",
    axis: "roster",
    ironic: true,
    freq: 0,
    how: "Not one award point, from anyone, all year.",
  },
  {
    key: "noallstars",
    emoji: "🏖️",
    label: "NOBODY MADE THE TRIP",
    rarity: "ironic",
    axis: "roster",
    ironic: true,
    freq: 0,
    how: "Not one player made an All-Star team.",
  },

  // ---- era: seasons with an asterisk, whatever the reason ----
  {
    key: "strike",
    emoji: "✊",
    label: "PICKET LINE",
    rarity: "uncommon",
    axis: "era",
    freq: 19.14,
    how: "Rostered a 1994 season — the year the strike killed the World Series.",
  },
  {
    key: "covid",
    emoji: "🦠",
    label: "SOCIAL DISTANCING",
    rarity: "uncommon",
    axis: "era",
    freq: 18.51,
    how: "Rostered a 2020 season — the 60-game year played to empty parks.",
  },
  {
    key: "signstealing",
    emoji: "🗑️",
    label: "STOLEN SIGNS",
    rarity: "rare",
    axis: "era",
    freq: 4.31,
    how: "Rostered a player or the manager from the 2017–18 Astros.",
  },
  {
    key: "deferred",
    emoji: "🏦",
    label: "DEFERRED MONEY",
    rarity: "rare",
    axis: "era",
    freq: null,
    how: "Signed Bobby Bonilla as a Met, or Shohei Ohtani as a Dodger.",
  },
];

export const BADGE_BY_KEY: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.key, b]),
);

/** Badges eligible for a locked trophy-case slot — everything you would chase.
 * Anti-trophies are excluded on purpose; they show up only once earned. */
export const COLLECTIBLE = BADGES.filter((b) => !b.ironic);

/** The one on-field badge a win total earns, or null. Crown supersedes every
 * named rung, named rungs match exactly, and 💯 catches the rest of the
 * century. 98 sits BELOW the 💯 floor, which is deliberate: at 3.2% without
 * powerups it is the only named rung a player reaches without them. */
export function onFieldBadge(wins: number): string | null {
  if (wins >= CROWN_WINS) return "crown";
  if (MATCHED[wins]) return MATCHED[wins];
  if (wins >= HUNDRED_WINS) return "hundred";
  return null;
}

/** Every badge a finale earns, in the order the pill row deals them out:
 * on-field rung, the goal, payroll, scout, roster shape, era.
 *
 * Most seasons earn two or three. The list is uncapped — the finale's pill row
 * caps itself because pills cost pixels, and emoji in a text message do not. */
export function earnedBadges(f: BadgeFacts): string[] {
  const out: string[] = [];
  const roster = f.roster;
  const hasAS = (p: BadgeRosterEntry) => p.awards.includes("AS");

  const field = onFieldBadge(f.baselineWins);
  if (field) out.push(field);
  else if (f.baselineWins === 0) out.push("dayjob");
  else if (f.baselineWins <= WORST_WINS) out.push("worst");
  else if (f.baselineLosses >= 100) out.push("skull");

  if (f.total >= GOAL_POINTS) out.push("perfect");

  // Four faces of one axis, ordered from busted to stingiest.
  if (f.spendM - f.budgetM >= FARM_TAX_M) out.push("farm");
  else if (f.budgetBonus >= DIME_BONUS) out.push("dime");
  else if (f.baselineWins >= PINCH_WINS && f.spendM <= f.budgetM * PINCH_PCT)
    out.push("pinch");
  else if (
    f.spendM <= f.budgetM * CHEAP_PCT &&
    f.baselineWins < f.baselineLosses
  )
    out.push("pocket");

  if (f.scoutHits >= CRYSTAL_HITS) out.push("crystal");

  const full = roster.length === ROSTER_SLOTS;
  // No 2020 season carries an All-Star nod — the game was never played — so a
  // club with a 2020 bat in it can never earn 🏅. Verified in badges-supply.
  if (full && roster.every(hasAS)) out.push("allstars");
  if (roster.some((p) => p.pos.includes("/"))) out.push("twoway");
  if (full && roster.every((p) => p.war >= NO_WEAK_LINK_WAR))
    out.push("noweak");
  if (f.awardPoints >= COOPERSTOWN_PTS) out.push("cooperstown");
  if (f.rings >= RING_BEARERS) out.push("rings");
  if (f.managerMoty && f.baselineWins > SKIPPER_WINS) out.push("skipper");
  // Pete Rose is the only person in the dataset who managed and played the same
  // season (CIN 1985 and 1986), but the trigger deliberately does not name him:
  // it asks whether YOUR skipper is on YOUR roster, which is a decision made
  // across two separate picks rather than a season you happened to land on.
  if (f.managerName !== null && roster.some((p) => p.name === f.managerName))
    out.push("playermanager");
  // A club that won nothing at all is the stronger joke, so it supersedes.
  if (roster.length > 0 && f.awardPoints === 0) out.push("nohardware");
  else if (roster.length > 0 && !roster.some(hasAS)) out.push("noallstars");

  if (roster.some((p) => p.year === 1994 && !REPLACEMENTS.has(p.id)))
    out.push("strike");
  if (roster.some((p) => REPLACEMENTS.has(p.id))) out.push("crossed");
  if (roster.some((p) => p.year === 2020)) out.push("covid");
  if (
    roster.some(isScandal) ||
    isScandal({ team: f.managerTeam, year: f.managerYear })
  )
    out.push("signstealing");
  if (roster.some(isDeferred)) out.push("deferred");

  return out;
}

/** Badge keys → the emoji the share string spends. */
export function badgeEmoji(keys: string[]): string[] {
  return keys.map((k) => BADGE_BY_KEY[k]?.emoji ?? "").filter(Boolean);
}

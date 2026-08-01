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
/** Rarest first, anti-trophies last — the one ordering of the ladder.
 *
 * It is a value, not just a type, because three surfaces need the ORDER and
 * not merely the names: the trophy case stacks its bands in it, the case's
 * tile sort resolves by it, and the type below is derived from it. Written out
 * separately in each place, a tier inserted in the middle would land in a
 * different position on each surface — or be silently dropped by a sort that
 * did not know the name, which is how `legend` came to sort last on the home
 * case after it shipped. */
export const RARITY_ORDER = [
  "legend",
  "ultra",
  "rare",
  "uncommon",
  "common",
  "ironic",
] as const;

export type Rarity = (typeof RARITY_ORDER)[number];

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
  /** An anti-trophy. It sits outside the progress fraction — nobody chases a
   * 100-loss season, so it belongs to neither side of the ratio — and its
   * locked slot is anonymized: glyph kept, name withheld.
   *
   * The constraint that matters is "no invitation", not "no slot". A slot
   * reading "💀 100-LOSS CLUB" tells a player how to farm it; "? ? ?" tells
   * them nothing, and inviting someone to lose 100 games inverts the
   * incentive. Earned, it wears a solid brick pill — a citation you got. */
  ironic?: boolean;
  /** A discovery rather than a target. Its locked slot shows a question mark
   * instead of its name.
   *
   * The split is between badges you can *aim at* and badges you *find*. A
   * performance badge names a thing to go do — win 103 games, spend the whole
   * payroll, field eight All-Stars — and naming it is the direction the case
   * owes the player. A secret is a fact about a specific season or person, and
   * naming it turns discovery into a shopping list: "🏦 DEFERRED MONEY" on a
   * locked slot is just an instruction to go look up Bonilla. */
  secret?: boolean;
  /** Plain-language trigger, shown when a player opens an earned badge in the
   * trophy case. Written as the condition they met, not as a rule they should
   * chase — locked badges never reveal it. */
  how: string;
  /** Measured rate in the reference population (Clean House + all powerups),
   * or null where the rung postdates the last study. The number lives beside
   * the definition so it cannot go stale in a comment somewhere else.
   *
   * `freq` records what was MEASURED; `rarity` records what the player SEES,
   * and the two are allowed to disagree. Counterpart badges — one idea pointed
   * in two directions, 🧓/🍼 — share a tier so the pair renders as one thing,
   * even when their measured rates fall either side of a band line. The
   * measurement stays honest; only the tier is pinned to the pairing. */
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
  /** Lahman franchise id ("ANA" for every Angels season, however the club was
   * spelled that year) — the front-office matches compare against the owner's
   * and the ballpark's, which carry the same id. */
  franchise: string;
  /** What this seat actually cost, after any 🏠 discount — 💎 measures one
   * player's share of the payroll. */
  costPaid: number;
  /** Signed at the 🏠 Homegrown flat price. */
  hero: boolean;
  /** Seasonal age. Optional because a save written before the field existed
   * restores players without one, and a missing age must count as NEITHER old
   * nor young — every age trigger tests `age != null` first. */
  age?: number;
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
  /** The hired owner's card, or null. Moneyball and Blank Check are fixed-cap
   * banks with no owner seat at all, so the front-office badges are Clean
   * House only by mechanics rather than by a mode gate. */
  owner: { franchise: string; year: number } | null;
  /** The bought ballpark's card, or null — same fixed-cap caveat. */
  stadium: { franchise: string; year: number } | null;
  /** One entry per filled roster slot, in roster order: the league and
   * division THAT season's club played in ("NL/W"), resolved era-correctly
   * from the index. A slot whose index row carries no alignment is absent, so
   * a division count can never be padded by a row the data cannot place. */
  divisions: string[];
  /** How many powerups were spent, out of how many the game offered. Both
   * ends of the toolbox axis read this, and `total` is carried rather than
   * assumed so a seventh powerup does not silently break 🧰. */
  powerups: { spent: number; total: number };
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
/* The age axis, both ends. The supply is asymmetric — 9.6% of player-seasons
 * are 35 or older against 7.2% at 23 or younger — so the two gates are the
 * matched outer deciles rather than a symmetric pair of numbers, and both ends
 * ask for the same THREE players. Three is the only rung that lands: two at
 * 35+ is 7.65% (an accident), four is 0.03% (a coin that never lands). */
const OLD_AGE = 35;
const YOUNG_AGE = 23;
const AGE_COUNT = 3;
/** Five of eight from one ten-year bucket. Four is 37% and fires by accident;
 * six is 1.57%. The trigger asks whether SOME decade holds five, never a named
 * one — 1985–89 and 2020–25 are short buckets, and a per-decade badge would
 * make an ALL-EIGHTIES TEAM harder than an ALL-TENS TEAM for a reason that is
 * about where the dataset starts rather than about the player. */
const DECADE_COUNT = 5;
/** Five of eight out of one division, same ladder: four is 22.8%, six is
 * 0.38%. */
const DIVISION_COUNT = 5;
/** data/index.json runs 1985–2025, so 40 is the widest span there is: the
 * badge means "you hold both ends of the dataset", not "a wide roster". */
const SPAN_YEARS = 40;
/** One player's share of the payroll that makes him the franchise. */
const FRANCHISE_SHARE = 0.5;
/** What a 🏠 Homegrown dollar has to buy for the discount to be a play rather
 * than a click — the WAR ladder's top tier. */
const HOMEGROWN_WAR = 8.0;

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

/** The record book, as this game knows it. Every entry is the best mark in the
 * 1985–2025 window the cards cover — deliberately NOT the all-time record,
 * because only three all-time marks fall inside that window (Bonds' 73 homers
 * and 1.421 OPS, and Rodríguez's 62 saves) and two of them are the same man.
 * A ten-season board is a record book; a three-season one is a Barry Bonds
 * exhibit.
 *
 * Gwynn's .394 came in the strike-shortened 1994 and would miss a 502-plate-
 * appearance cutoff on 475. It is here anyway: it is the batting mark of the
 * era by any honest reading, and the season being short is the reason it is
 * remembered, not a reason to discount it.
 *
 * Keyed on the exact season, not the player — Bonds appears twice for two
 * different records, and his other years are ordinary by his own standard. */
const RECORD_SEASONS: Record<string, number[]> = {
  bondsba01: [2001, 2004], // 73 HR · 1.421 OPS
  ramirma02: [1999], // 165 RBI
  colemvi01: [1985], // 110 SB
  gwynnto01: [1994], // .394
  johnsra05: [2001], // 372 K
  welchbo01: [1990], // 27 wins
  rodrifr03: [2008], // 62 saves
  goodedw01: [1985], // 1.53 ERA and 13.3 WAR, one season
};
function isRecord(p: { id: string; year: number }): boolean {
  return RECORD_SEASONS[p.id]?.includes(p.year) === true;
}

/** The summer of 1998 and the year Bonds ended it. Three seasons, one story —
 * kept apart from the record board because the chase is remembered as an event
 * rather than a line in a table. */
const CHASE_SEASONS: Record<string, number[]> = {
  mcgwima01: [1998], // 70
  sosasa01: [1998], // 66
  bondsba01: [2001], // 73
};
function isChase(p: { id: string; year: number }): boolean {
  return CHASE_SEASONS[p.id]?.includes(p.year) === true;
}

export const FATHER_SON: ReadonlyArray<readonly [string, string]> = [
  ["armasto01", "armasto02"], // Tony Armas / Tony Armas Jr.
  ["bannifl01", "bannibr01"], // Floyd Bannister / Brian Bannister
  ["barfije01", "barfijo02"], // Jesse Barfield / Josh Barfield
  ["bedrost01", "bedroca01"], // Steve Bedrosian / Cam Bedrosian
  ["bellbu01", "bellda01"], // Buddy Bell / David Bell
  ["bellicl01", "bellico01"], // Clay Bellinger / Cody Bellinger
  ["bicheda01", "bichebo01"], // Dante Bichette / Bo Bichette
  ["biggicr01", "biggica01"], // Craig Biggio / Cavan Biggio
  ["boonebo01", "boonebr01"], // Bob Boone / Bret Boone
  ["boonebo01", "booneaa01"], // Bob Boone / Aaron Boone
  ["brantmi01", "brantmi02"], // Mickey Brantley / Michael Brantley
  ["burroje01", "burrose01"], // Jeff Burroughs / Sean Burroughs
  ["camermi01", "camerda01"], // Mike Cameron / Daz Cameron
  ["clemero02", "clemeko01"], // Roger Clemens / Kody Clemens
  ["cruzjo01", "cruzjo02"], // José Cruz / José Cruz Jr.
  ["davisro02", "davisik02"], // Ron Davis / Ike Davis
  ["deshide01", "deshide02"], // Delino DeShields / Delino DeShields Jr.
  ["drabedo01", "drabeky01"], // Doug Drabek / Kyle Drabek
  ["farrejo03", "farrelu01"], // John Farrell / Luke Farrell
  ["fieldce01", "fieldpr01"], // Cecil Fielder / Prince Fielder
  ["fitzgmi02", "fitzgty01"], // Mike Fitzgerald / Tyler Fitzgerald
  ["gordoto01", "gordode01"], // Tom Gordon / Dee Strange-Gordon
  ["gordoto01", "gordoni01"], // Tom Gordon / Nick Gordon
  ["griffke01", "griffke02"], // Ken Griffey / Ken Griffey Jr. — SEA 1990
  ["guerrvl01", "guerrvl02"], // Vladimir Guerrero / Vladimir Guerrero Jr.
  ["gwynnto01", "gwynnto02"], // Tony Gwynn / Tony Gwynn Jr.
  ["hairsje01", "hairsje02"], // Jerry Hairston / Jerry Hairston Jr.
  ["hairsje01", "hairssc01"], // Jerry Hairston / Scott Hairston
  ["hayesch01", "hayeske01"], // Charlie Hayes / Ke'Bryan Hayes
  ["hollima01", "hollija01"], // Matt Holliday / Jackson Holliday
  ["jarvike01", "jarvibr01"], // Kevin Jarvis / Bryce Jarvis
  ["karroer01", "karroky01"], // Eric Karros / Kyle Karros
  ["leibrch01", "leibrbr01"], // Charlie Leibrandt / Brandon Leibrandt
  ["leiteal01", "leiteja01"], // Al Leiter / Jack Leiter
  ["leitema01", "leitema02"], // Mark Leiter / Mark Leiter Jr.
  ["lombast01", "lombast02"], // Steve Lombardozzi / Steve Lombardozzi Jr.
  ["martica02", "martijo08"], // Carlos Martínez / José Martínez
  ["martisa01", "martian02"], // Sandy Martínez / Angel Martínez
  ["matthga01", "matthga02"], // Gary Matthews / Gary Matthews Jr.
  ["mcculla01", "mcculla02"], // Lance McCullers / Lance McCullers Jr.
  ["mcraeha01", "mcraebr01"], // Hal McRae / Brian McRae
  ["mondera01", "mondera02"], // Raúl Mondesí / Adalberto Mondesí
  ["nevinph01", "nevinty01"], // Phil Nevin / Tyler Nevin
  ["niekrjo01", "niekrla01"], // Joe Niekro / Lance Niekro
  ["penage01", "penaje02"], // Geronimo Pena / Jeremy Peña
  ["penato01", "penato02"], // Tony Peña / Tony Peña Jr.
  ["perezto01", "perezed01"], // Tony Pérez / Eduardo Pérez
  ["quantpa01", "quantca01"], // Paul Quantrill / Cal Quantrill
  ["rodriiv01", "rodride01"], // Iván Rodríguez / Dereck Rodríguez
  ["roeniga01", "roenijo01"], // Gary Roenicke / Josh Roenicke
  ["rominke01", "rominan01"], // Kevin Romine / Andrew Romine
  ["rominke01", "rominau01"], // Kevin Romine / Austin Romine
  ["russeje01", "russeja02"], // Jeff Russell / James Russell
  ["shawje01", "shawtr01"], // Jeff Shaw / Travis Shaw
  ["sheetla01", "sheetga01"], // Larry Sheets / Gavin Sheets
  ["vanslan01", "vanslsc01"], // Andy Van Slyke / Scott Van Slyke
  ["smithdw01", "smithdw02"], // Dwight Smith / Dwight Smith Jr.
  ["speiech01", "speieju01"], // Chris Speier / Justin Speier
  ["younger01", "younger03"], // Eric Young Sr. / Eric Young Jr.
  ["tatisfe01", "tatisfe02"], // Fernando Tatís / Fernando Tatis Jr.
  ["tollewa01", "tollest01"], // Wayne Tolleson / Steven Tolleson
  ["turanbr01", "turanbr02"], // Brian Turang / Brice Turang
  ["varshga01", "varshda01"], // Gary Varsho / Daulton Varsho
  ["venabma01", "venabwi01"], // Max Venable / Will Venable
  ["wallati01", "wallach01"], // Tim Wallach / Chad Wallach
  ["weathda01", "weathry01"], // David Weathers / Ryan Weathers
  ["wilsoja02", "wilsoja05"], // Jack Wilson / Jacob Wilson
  ["wittbo01", "wittbo02"], // Bobby Witt / Bobby Witt Jr.
];

export const BROTHERS: ReadonlyArray<readonly [string, string]> = [
  ["alexasc02", "alexaja01"], // Scott Alexander / Jason Alexander
  ["alomaro01", "alomasa02"], // Roberto Alomar / Sandy Alomar — CHW 2003, CHW 2004…
  ["arciaos01", "arciaor01"], // Oswaldo Arcia / Orlando Arcia
  ["ariasjo01", "ariasal02"], // Joaquín Arias / Alberto Árias
  ["aybarwi01", "aybarer01"], // Willy Aybar / Erick Aybar
  ["bardda01", "bardlu01"], // Daniel Bard / Luke Bard
  ["bellge02", "bellju01"], // George Bell / Juan Bell
  ["benesan01", "benesal01"], // Andy Benes / Alan Benes — STL 1996, STL 1997…
  ["bonifem01", "bonifjo01"], // Emilio Bonifácio / Jorge Bonifacio
  ["boonebr01", "booneaa01"], // Bret Boone / Aaron Boone — CIN 1998
  ["bulliji01", "bulliki01"], // Jim Bullinger / Kirk Bullinger
  ["cabreor01", "cabrejo02"], // Orlando Cabrera / Jolbert Cabrera
  ["cedenan01", "cedendo01"], // Andújar Cedeño / Domingo Cedeño
  ["clarkje01", "clarkph02"], // Jerald Clark / Phil Clark
  ["contrwi01", "contrwi02"], // Willson Contreras / William Contreras
  ["corajo01", "coraal01"], // Joey Cora / Alex Cora
  ["crespfe01", "crespce01"], // Felipe Crespo / César Crespo
  ["danksjo01", "danksjo02"], // John Danks / Jordan Danks — CHW 2013
  ["darwida01", "darwije01"], // Danny Darwin / Jeff Darwin
  ["davismi02", "davisma01"], // Mike Davis / Mark Davis
  ["drewj.01", "drewst01"], // J.D. Drew / Stephen Drew
  ["duncach01", "duncash01"], // Chris Duncan / Shelley Duncan
  ["dunnija01", "dunnida01"], // Jake Dunning / Dane Dunning
  ["eyresc01", "eyrewi01"], // Scott Eyre / Willie Eyre
  ["fletcda02", "fletcdo01"], // David Fletcher / Dominic Fletcher
  ["garciad01", "garciad02"], // Adonis García / Adolis García
  ["giambja01", "giambje01"], // Jason Giambi / Jeremy Giambi — OAK 2000, OAK 2001
  ["gilesbr02", "gilesma01"], // Brian Giles / Marcus Giles — SDP 2007
  ["goedder01", "goeddty01"], // Erik Goeddel / Tyler Goeddel
  ["gonzaad01", "gonzaed02"], // Adrián González / Edgar Gonzalez — SDP 2008, SDP 2009
  ["guerrvl01", "guerrwi01"], // Vladimir Guerrero / Wilton Guerrero — MON 1998, MON 1999…
  ["gourryu01", "gurrilo01"], // Yuli Gurriel / Lourdes Gurriel Jr.
  ["gwynnto01", "gwynnch01"], // Tony Gwynn / Chris Gwynn
  ["hairsje02", "hairssc01"], // Jerry Hairston / Scott Hairston — SDP 2010
  ["hernali01", "hernaor01"], // Liván Hernández / Orlando Hernández — ARI 2006
  ["hoffmgl01", "hoffmtr01"], // Glenn Hoffman / Trevor Hoffman
  ["holmabr01", "holmabr02"], // Brian Holman / Brad Holman
  ["izturce01", "izturma01"], // César Izturis / Maicer Izturis
  ["ripkeca01", "ripkebi01"], // Cal Ripken Jr. / Billy Ripken — BAL 1987, BAL 1988…
  ["acunaro01", "acunajo01"], // Ronald Acuña Jr. / Luisangel Acuña
  ["larocad01", "larocan01"], // Adam LaRoche / Andy LaRoche — PIT 2008, PIT 2009
  ["lambepe01", "lambeji01"], // Peter Lambert / Jimmy Lambert
  ["leiteal01", "leitema01"], // Al Leiter / Mark Leiter
  ["lowena01", "lowejo01"], // Nathaniel Lowe / Josh Lowe
  ["lugoju01", "lugoru01"], // Julio Lugo / Ruddy Lugo — TBD 2006
  ["maddugr01", "maddumi01"], // Greg Maddux / Mike Maddux
  ["mahleri01", "mahlemi01"], // Rick Mahler / Mickey Mahler
  ["martira02", "martipe02"], // Ramón Martínez / Pedro Martínez — BOS 2000, LAD 1993
  ["matonph01", "matonni01"], // Phil Maton / Nick Maton
  ["meadoau01", "meadopa01"], // Austin Meadows / Parker Meadows
  ["megiltr01", "megilty01"], // Trevor Megill / Tylor Megill
  ["molinbe01", "molinjo01"], // Bengie Molina / José Molina — ANA 2004, LAA 2005
  ["molinbe01", "molinya01"], // Bengie Molina / Yadier Molina
  ["molinjo01", "molinya01"], // José Molina / Yadier Molina
  ["naylojo01", "naylobo01"], // Josh Naylor / Bo Naylor — CLE 2023, CLE 2024
  ["niekrph01", "niekrjo01"], // Phil Niekro / Joe Niekro — NYY 1985
  ["nieveme01", "nievewi01"], // Melvin Nieves / Wil Nieves
  ["nixla01", "nixja01"], // Laynce Nix / Jayson Nix
  ["nixonot01", "nixondo01"], // Otis Nixon / Donell Nixon
  ["nolaaa01", "nolaau01"], // Aaron Nola / Austin Nola
  ["osunaro01", "osunaal02"], // Roberto Osuna / Alejandro Osuna
  ["palacjo01", "palacri01"], // Joshua Palacios / Richie Palacios
  ["patteco01", "patteer01"], // Corey Patterson / Eric Patterson
  ["perezme01", "perezca01"], // Melido Perez / Carlos Pérez
  ["perezpa01", "perezme01"], // Pascual Pérez / Melido Perez
  ["perezpa01", "perezca01"], // Pascual Pérez / Carlos Pérez
  ["rasmuco01", "rasmuco02"], // Colby Rasmus / Cory Rasmus
  ["roeniga01", "roeniro01"], // Gary Roenicke / Ron Roenicke
  ["rominan01", "rominau01"], // Andrew Romine / Austin Romine
  ["rossty01", "rossjo01"], // Tyson Ross / Joe Ross
  ["seageky01", "seageco01"], // Kyle Seager / Corey Seager
  ["sheffju01", "sheffjo01"], // Justus Sheffield / Jordan Sheffield
  ["stottto01", "stottme02"], // Todd Stottlemyre / Mel Stottlemyre Jr.
  ["gordode01", "gordoni01"], // Dee Strange-Gordon / Nick Gordon
  ["suareal01", "suarero01"], // Albert Suárez / Robert Suarez
  ["tuckepr01", "tuckeky01"], // Preston Tucker / Kyle Tucker
  ["uptonbj01", "uptonju01"], // B.J. Upton / Justin Upton — ATL 2013, ATL 2014…
  ["uriaslu01", "uriasra01"], // Luis Urías / Ramón Urías
  ["valenjo03", "valenja01"], // José Valentín / Javier Valentín
  ["varlalo01", "varlagu01"], // Louis Varland / Gus Varland
  ["weaveje01", "weaveje02"], // Jeff Weaver / Jered Weaver — LAA 2006
  ["weeksri01", "weeksje01"], // Rickie Weeks / Jemile Weeks
  ["worreto01", "worreti01"], // Todd Worrell / Tim Worrell
  ["ynoami01", "ynoahu01"], // Michael Ynoa / Huascar Ynoa
  ["youngdm01", "youngde03"], // Dmitri Young / Delmon Young
  ["zimmebr01", "zimmeky01"], // Bradley Zimmer / Kyle Zimmer
  ["darnach01", "darnatr01"], // Chase d'Arnaud / Travis d'Arnaud
];

/** The only two families with THREE draftable brothers. Three of eight seats is
 * the price, and landing three men from one family is 0.89% before a single
 * signing — the Molinas need two separate landings plus ✌️ Double Play, because
 * Yadier never shares a card with Bengie or José. It is the hardest thing in
 * the game you can actually set out to do, which is the point. */
export const THREE_BROTHERS: ReadonlyArray<readonly [string, string, string]> =
  [
    ["molinbe01", "molinjo01", "molinya01"], // Bengie / José / Yadier Molina
    ["perezpa01", "perezme01", "perezca01"], // Pascual / Melido / Carlos Pérez
  ];

function hasPair(
  ids: Set<string>,
  pairs: ReadonlyArray<readonly string[]>,
): boolean {
  return pairs.some((pair) => pair.every((id) => ids.has(id)));
}

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
    rarity: "uncommon",
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
    secret: true,
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
    key: "brothers",
    emoji: "👬",
    label: "BROTHERLY LOVE",
    rarity: "rare",
    axis: "roster",
    secret: true,
    freq: null,
    how: "Signed a pair of brothers.",
  },
  {
    key: "fatherson",
    emoji: "👨‍👦",
    label: "LIKE FATHER, LIKE SON",
    rarity: "ultra",
    axis: "roster",
    secret: true,
    freq: null,
    how: "Signed a father and his son — a lineup only this game lets you field.",
  },
  {
    key: "threebrothers",
    emoji: "👨‍👨‍👦",
    label: "FAMILY REUNION",
    rarity: "ultra",
    axis: "roster",
    secret: true,
    freq: null,
    how: "Signed three brothers from one family — the Molinas or the Pérezes.",
  },
  {
    key: "playermanager",
    secret: true,
    emoji: "📋",
    label: "PLAYER-MANAGER",
    rarity: "ultra",
    axis: "roster",
    // 0.05% measured over 25,000 games: hiring a skipper who ALSO played is
    // common (35.5% of cards carry one), but signing that same man is the
    // other half of the badge and nothing in the UI points at him.
    freq: 0.05,
    how: "Hired a skipper who is also on your roster as a player.",
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
  /* The two ends of the age axis. They are ONE idea pointed in two
   * directions, so they share a tier and render identically — 0.95% and 1.73%
   * straddle the ultra/rare line on raw frequency, and splitting them would
   * make the same idea look like two different achievements. `ultra` is the
   * side that fits: the rare band's floor is 🏭 at 1.90, and 🍼 at 1.73 sits
   * under it while 🧓 at 0.95 sits inside the existing ultra cohort. Sending
   * the pair to `rare` instead would put a 0.95% badge two bands' worth below
   * every other rare and overlap the two tiers by half a point. */
  {
    key: "oldheads",
    emoji: "🧓",
    label: "OLD HEADS",
    rarity: "ultra",
    axis: "roster",
    freq: 0.95,
    how: "Three players aged 35 or older — a clubhouse of veterans.",
  },
  {
    key: "youngguns",
    emoji: "🍼",
    label: "YOUNG GUNS",
    rarity: "ultra",
    axis: "roster",
    freq: 1.73,
    how: "Three players aged 23 or younger — a club built on kids.",
  },
  {
    key: "division",
    emoji: "🗺️",
    label: "RAIDED THE DIVISION",
    rarity: "rare",
    axis: "roster",
    freq: 3.83,
    how: "Five players out of one division — you raided one neighbourhood.",
  },
  {
    key: "homefield",
    emoji: "⛲",
    label: "HOME FIELD ADVANTAGE",
    rarity: "rare",
    axis: "roster",
    freq: 2.98,
    how: "Bought a ballpark and signed a player from that exact season.",
  },
  {
    key: "companytown",
    emoji: "🏭",
    label: "COMPANY TOWN",
    rarity: "rare",
    axis: "roster",
    freq: 1.9,
    how: "Your owner, your ballpark and one of your players, all from one club.",
  },
  {
    key: "franchiseplayer",
    emoji: "💎",
    label: "THE FRANCHISE PLAYER",
    rarity: "uncommon",
    axis: "roster",
    freq: 6.47,
    how: "Spent half your payroll or more on one player.",
  },
  /* The toolbox axis: how much of the game's own surface a season used. All
   * three ride `roster`, which stacks, because the exclusivity is in the world
   * rather than in the resolver — all six spent and none spent cannot both be
   * true, and 🌱 needs 🏠 spent so it can never co-fire with 🧗.
   *
   * All three carry `freq: null` on purpose. Every bot arm defines its own
   * powerup policy, so a measured powerup rate describes the arm and not the
   * game; the shipping 🏦 sets the precedent for a definition with no number. */
  {
    key: "homegrown",
    emoji: "🌱",
    label: "HOMEGROWN SUPERSTAR",
    rarity: "uncommon",
    axis: "roster",
    freq: null,
    how: "Signed an 8-WAR season at the Homegrown price of one million dollars.",
  },
  {
    key: "hardway",
    emoji: "🧗",
    label: "THE HARD WAY",
    rarity: "rare",
    axis: "roster",
    freq: null,
    how: "A hundred wins without spending a single powerup.",
  },
  {
    key: "toolbox",
    emoji: "🧰",
    label: "THE WHOLE TOOLBOX",
    rarity: "common",
    axis: "roster",
    freq: null,
    how: "Spent every powerup you had in one season.",
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
    secret: true,
    emoji: "✊",
    label: "PICKET LINE",
    rarity: "uncommon",
    axis: "era",
    freq: 19.14,
    how: "Rostered a 1994 season — the year the strike killed the World Series.",
  },
  {
    key: "covid",
    secret: true,
    emoji: "🦠",
    label: "SOCIAL DISTANCING",
    rarity: "uncommon",
    axis: "era",
    freq: 18.51,
    how: "Rostered a 2020 season — the 60-game year played to empty parks.",
  },
  {
    key: "signstealing",
    secret: true,
    emoji: "🗑️",
    label: "STOLEN SIGNS",
    rarity: "rare",
    axis: "era",
    freq: 4.31,
    how: "Rostered a player or the manager from the 2017–18 Astros.",
  },
  {
    key: "deferred",
    secret: true,
    emoji: "🏦",
    label: "DEFERRED MONEY",
    rarity: "rare",
    axis: "era",
    freq: null,
    how: "Signed Bobby Bonilla as a Met, or Shohei Ohtani as a Dodger.",
  },
  {
    key: "crossed",
    secret: true,
    emoji: "🚧",
    label: "CROSSED THE LINE",
    rarity: "ultra",
    axis: "era",
    freq: 0.74,
    how: "Signed a 1995 replacement player — none of them was ever admitted to the union.",
  },
  {
    key: "recordbook",
    secret: true,
    emoji: "📖",
    label: "REWROTE THE RECORD BOOK",
    rarity: "ultra",
    axis: "era",
    freq: null,
    how: "Signed a season that holds a record for 1985–2025.",
  },
  {
    key: "chase",
    secret: true,
    emoji: "💥",
    label: "THE CHASE",
    rarity: "rare",
    axis: "era",
    freq: null,
    how: "Signed McGwire or Sosa in 1998, or Bonds in 2001 — the home run chase.",
  },

  /* …and the shape of the years themselves, rather than any one of them. The
   * two poles: 📆 rewards committing to one slice of the history, 🕰️ rewards
   * holding both ends of it. They stack — a club of five 1985s plus a 2025
   * earns both — but at a measured 0.06% they behave as one axis with two
   * ends, and a club that really does both has done something odd enough to be
   * told so. They are NOT a counterpart pair and do not share a tier: a decade
   * bucket is a concentration and a span is a maximum, different trigger
   * shapes with a 3x frequency gap between them. */
  {
    key: "decade",
    emoji: "📆",
    label: "ALL-DECADE TEAM",
    rarity: "uncommon",
    axis: "era",
    freq: 9.43,
    how: "Five players from the same decade — a club with one sound.",
  },
  {
    key: "fortyyears",
    emoji: "🕰️",
    label: "FORTY YEARS APART",
    rarity: "rare",
    axis: "era",
    freq: 2.95,
    how: "Rostered seasons forty years apart — the oldest and newest the game has.",
  },
];

export const BADGE_BY_KEY: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.key, b]),
);

/** The denominator of the trophy case's progress fraction — everything you
 * would chase. Anti-trophies are excluded on purpose: they belong to neither
 * side of the ratio, so earning one must not move the fraction. They still get
 * a slot in the case, which is a separate question this list does not answer. */
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

/** The largest group one keying produces over a roster — five players sharing
 * a decade, five sharing a division. Both badges that use it are existential
 * over the buckets ("SOME decade holds five"), never over a named one. */
function maxBucket(keys: (string | number)[]): number {
  const counts = new Map<string | number, number>();
  let most = 0;
  for (const k of keys) {
    const n = (counts.get(k) ?? 0) + 1;
    counts.set(k, n);
    if (n > most) most = n;
  }
  return most;
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
  // Both ends of the age axis. A player with no age counts as NEITHER old nor
  // young: BadgeRosterEntry.age is optional, so a save written before the
  // field existed restores a club the age badges simply cannot read.
  const aged = (ok: (age: number) => boolean) =>
    roster.filter((p) => p.age != null && ok(p.age)).length;
  if (aged((a) => a >= OLD_AGE) >= AGE_COUNT) out.push("oldheads");
  if (aged((a) => a <= YOUNG_AGE) >= AGE_COUNT) out.push("youngguns");
  if (maxBucket(f.divisions) >= DIVISION_COUNT) out.push("division");
  // Locals, not f.owner/f.stadium: a null check on a property does not narrow
  // inside the callback below it.
  const owner = f.owner;
  const stadium = f.stadium;
  // Card-exact, not franchise-level. Thirty franchises over eleven spins make
  // a bare franchise collision a coin flip (26.5% measured); the season has to
  // match too before this is a play rather than an accident.
  if (
    stadium !== null &&
    roster.some(
      (p) => p.franchise === stadium.franchise && p.year === stadium.year,
    )
  )
    out.push("homefield");
  if (
    owner !== null &&
    stadium !== null &&
    owner.franchise === stadium.franchise &&
    roster.some((p) => p.franchise === owner.franchise)
  )
    out.push("companytown");
  if (
    f.spendM > 0 &&
    roster.some((p) => p.costPaid / f.spendM >= FRANCHISE_SHARE)
  )
    out.push("franchiseplayer");
  if (roster.some((p) => p.hero && p.war >= HOMEGROWN_WAR))
    out.push("homegrown");
  // The result gate is what keeps 🧗 honest: ungated, "spent no powerups"
  // would be a collectible for never finding the buttons.
  if (
    f.powerups.total > 0 &&
    f.powerups.spent === 0 &&
    f.baselineWins >= HUNDRED_WINS
  )
    out.push("hardway");
  if (f.powerups.total > 0 && f.powerups.spent === f.powerups.total)
    out.push("toolbox");
  // A club that won nothing at all is the stronger joke, so it supersedes.
  if (roster.length > 0 && f.awardPoints === 0) out.push("nohardware");
  else if (roster.length > 0 && !roster.some(hasAS)) out.push("noallstars");

  // Family lines run off a Set of the roster's ids: 155 pair lookups and two
  // triples, once, at the finale. Tuples rather than a family bucket because a
  // bucket cannot tell brothers from sons inside a mixed family and would sweep
  // in uncles and cousins the badges do not name.
  const ids = new Set(roster.map((p) => p.id));
  if (hasPair(ids, THREE_BROTHERS)) out.push("threebrothers");
  if (hasPair(ids, BROTHERS)) out.push("brothers");
  if (hasPair(ids, FATHER_SON)) out.push("fatherson");

  if (roster.some((p) => p.year === 1994 && !REPLACEMENTS.has(p.id)))
    out.push("strike");
  if (roster.some((p) => REPLACEMENTS.has(p.id))) out.push("crossed");
  if (roster.some(isRecord)) out.push("recordbook");
  if (roster.some(isChase)) out.push("chase");
  if (roster.some((p) => p.year === 2020)) out.push("covid");
  if (
    roster.some(isScandal) ||
    isScandal({ team: f.managerTeam, year: f.managerYear })
  )
    out.push("signstealing");
  if (roster.some(isDeferred)) out.push("deferred");
  if (maxBucket(roster.map((p) => Math.floor(p.year / 10))) >= DECADE_COUNT)
    out.push("decade");
  const years = roster.map((p) => p.year);
  if (years.length > 0 && Math.max(...years) - Math.min(...years) >= SPAN_YEARS)
    out.push("fortyyears");

  return out;
}

/** One pill on the finale's brag row: the badge, and whether this is the
 * first time it has ever been earned. */
export interface Brag {
  def: BadgeDef;
  fresh: boolean;
}

/** The finale's brag row: which badges get the scarce pill slots, in order.
 *
 * Lives here rather than in the component because it is a rule about badges,
 * not about rendering — and because the component can only run it behind a
 * reveal animation, which puts it out of reach of a test.
 *
 * First-time badges sort to the FRONT. That is the whole reason the order is
 * touched: the row caps at a handful of pills and cuts from the tail of
 * `earnedBadges`' order, so a badge earned for the first time ever could land
 * past the cut and never be seen — the one pill the player most wants. The
 * sort is stable, so within each group the engine's order survives.
 *
 * Keys that resolve to no definition are dropped, which covers a finale
 * restored from a save written before a badge was retired. */
export function bragRow(
  keys: string[],
  newKeys: string[],
  cap: number,
): Brag[] {
  const fresh = new Set(newKeys);
  return keys
    .map((k) => BADGE_BY_KEY[k])
    .filter((d): d is BadgeDef => d !== undefined)
    .map((def) => ({ def, fresh: fresh.has(def.key) }))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh))
    .slice(0, cap);
}

/** Badge keys → the emoji the share string spends. */
export function badgeEmoji(keys: string[]): string[] {
  return keys.map((k) => BADGE_BY_KEY[k]?.emoji ?? "").filter(Boolean);
}

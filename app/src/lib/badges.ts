import { GOAL_POINTS } from "./scoring";

/* The badge set — one table, read by the finale pill row, the share string,
 * and the home trophy case. Adding a badge means adding one BadgeDef and one
 * trigger; nothing else in the app enumerates badges.
 *
 * Two rules govern the set:
 *
 * 1. Named on-field rungs are World Series winners, matched EXACTLY. A rung
 *    is a club whose win total you hit on the nose, so the ladder can be dense
 *    without any rung swallowing its neighbors. Every club below is verified
 *    against data/cards/ — see tests/badges-supply.test.ts, which fails if a
 *    data regen moves a total out from under a label.
 *
 *    The one exception is 🔱 at 116. No club has ever won the Series with 116
 *    wins — 2001 Seattle and 1906 Chicago both hold the record and both lost —
 *    so it is the RECORD rung rather than a champion rung. It keeps the same
 *    "MATCHED" wording as its neighbors anyway: the ladder reads as one list,
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
 * 2. The on-field axis runs on TWO records, and every rung on it reads both.
 *
 *    BASELINE wins is the finale ledger's opening line — 50 plus roster WAR
 *    plus the skipper's net, before awards, rings and the payroll bonus. The
 *    STAMPED record is the giant W–L printed above it, modifiers and luxury
 *    tax included.
 *
 *    👑, the six named rungs and 💯 are PICKED by the baseline and KEPT on the
 *    stamp: the stamp has to clear the same mark or the rung is not awarded.
 *    The baseline picks because those modifiers add 20+ wins to a stamp
 *    routinely and 💯 keyed to the stamp alone would be automatic. The stamp
 *    vetoes because a badge reading 100-WIN CLUB over an 81–81 season is the
 *    badge calling the screen a liar.
 *
 *    That gate does not ban the luxury tax and is not meant to. Overspending
 *    stays a real line and stays priced by the tax; what it can no longer do
 *    is buy a monster roster, eat a penalty that drops the season to .500, and
 *    still collect a badge about the result. The rung is awarded when the
 *    result SURVIVES the bill. onFieldBadge carries the asymmetry — exact on
 *    the baseline, a floor on the stamp — and the reason a vetoed rung earns
 *    nothing rather than dropping to a lower one.
 *
 *    The three floor rungs — 👔, 📉, 💀 — read the STAMPED record alone,
 *    because an anti-trophy has to name something the player can actually see,
 *    and the stamp is the only record the finale ever prints. That was the
 *    owner's call and it is what makes 👔 reachable at all; the arithmetic is
 *    beside `dayjob`.
 *
 *    Because the axis genuinely uses two measures, every `how` string on it
 *    names WHICH ones it means, in the finale's own words — "baseline wins" is
 *    the label printed beside `50 + WAR + skipper`, "final record" is the
 *    stamp — so the badge copy and the screen agree instead of looking like
 *    two readings of one number. The same applies to every other badge keyed
 *    to a win total: 🧮, 🧢, 🧗 and 🧾 all read the baseline and all say so.
 */

/** The collection ladder. `legendary` sits above `ultra` and holds the two badges
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
 * did not know the name, which is how the top tier came to sort last on the
 * home case after it shipped. */
export const RARITY_ORDER = [
  "legendary",
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
   * The split is between badges you can *aim at* and badges whose NAME is
   * itself part of the reward. A performance badge names a thing to go do —
   * spend the whole payroll, field eight All-Stars, get to a hundred wins —
   * and naming it is the direction the case owes the player. A secret's name
   * spends something instead, and it spends it in one of three ways:
   *
   *  - It is a fact about one season or one person. "🏦 DEFERRED MONEY" on a
   *    locked slot is just an instruction to go look up Bonilla.
   *  - It is an exact-match rung. "MATCHED THE 2016 CUBS" on a locked slot is
   *    a farmable target — go win exactly 103 — and six of them named at once
   *    turn the on-field ladder into a checklist of totals to hit on the nose,
   *    which is the opposite of what a ladder of champions is for.
   *  - It is the peak. 👑 and 🏆 are the two ends the whole ladder exists to
   *    deliver, and printing their names on a case nobody has filled yet
   *    pre-spends the one surprise the top has to give.
   *
   * 💯 100-WIN CLUB deliberately stays named. It is the rung a player can aim
   * at, and it is the direction the rest of the axis is measured from — the
   * case still says "a hundred wins is a thing", and everything above it is a
   * discovery. */
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
  /** In the Hall of Fame as a PLAYER (Lahman `HallOfFame`, `inducted = "Y"`
   * and `category = "Player"`). Optional for the same reason `age` is: a club
   * restored from a save written before the field existed must count as no
   * Hall of Famers rather than as an unknown that pads the count. */
  hof?: boolean;
  /** Birth country as the cards spell it ("Dominican Republic", "Curaçao").
   * Optional for the `age` reason; a missing country counts as NO country
   * rather than as a shared unknown that pads the distinct count. */
  country?: string;
}

/** Everything the triggers need. Assembled once at the finale; the share
 * string and the history entry both read the result rather than re-deriving. */
export interface BadgeFacts {
  baselineWins: number;
  baselineLosses: number;
  /** The record the finale STAMPS on the season — `recordFromTotal(total)`,
   * i.e. the points total rounded and clamped into 0–162.
   *
   * The two records answer different questions and the ladder uses both on
   * purpose. `baselineWins` is what the CLUB is worth: 50 replacement wins
   * plus roster WAR plus the skipper's net, before a single award, ring or
   * payroll bonus is counted. The stamp is what the SEASON scored, modifiers
   * and luxury tax included. The champion rungs and 💯 read the baseline,
   * because awards and rings routinely add twenty wins to a stamp and keying
   * 💯 to that would make it automatic. The three floor rungs read the stamp,
   * because they are anti-trophies about a result — and the stamp is the only
   * record the player is ever shown.
   *
   * Optional so the engine can adopt it in its own commit; every floor rung
   * falls back to the baseline pair when it is absent, which is the behavior
   * that shipped before the field existed. */
  stamp?: { wins: number; losses: number };
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
  /** The hired skipper is in the Hall of Fame AS A MANAGER — Lahman's
   * `category = "Manager"`, strictly. The loose "in the Hall in any capacity"
   * reading would add men like Frank Robinson, who is in as a player and
   * happened to manage; the badge counts the chair, not the man. Nine
   * managers, on 125 of the 1,188 cards. Optional for the `age` reason. */
  managerHof?: boolean;
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
  /** True when this game's seed already appears in the local history log —
   * i.e. the player entered a code they had played before.
   *
   * Resolved in the engine because it is a question about the log BEFORE this
   * game joins it: `recordHistory()` appends a row carrying this same seed, so
   * a check made one line later would answer "yes" on every game, forever,
   * with no error and no symptom.
   *
   * No entered-vs-random flag is needed to make it mean what it says. `Game`
   * seeds are uint32 (`rng.randomSeed()` masks with `>>> 0`), so a random seed
   * colliding with one already in a local log is about 1 in 4 million after a
   * thousand games — "this seed is in my history" IS "I typed it in".
   *
   * Optional so that a fact set built before the field existed — a restored
   * save, a forged test fixture — reads as "not a replay" rather than failing
   * to type-check. */
  replayedSeed?: boolean;
  /** True when the owner was hired with all eight roster seats already filled
   * — the whole club drafted before the payroll was known.
   *
   * A derived fact rather than the spin log, because the log cannot answer
   * this question cleanly on its own: ✌️ Double Play signs two men off one
   * card and 🔁 Trade Deadline logs a `swap` that replaces one, so counting
   * `sign` entries before the `owner` entry is not the same as counting filled
   * seats. The engine records the answer at the moment it hires the owner,
   * where the roster is right there to look at.
   *
   * Only Clean House can set it, and no mode gate is needed for that:
   * `hireOwner()` returns immediately when `fixedCap` is true, so Moneyball
   * and Blank Check — which know their payroll from the first spin and have no
   * owner seat at all — never reach the line that records it.
   *
   * Optional for the `age` reason: a fact set assembled before the field
   * existed reads as "not blind" rather than earning the badge by default. */
  ownerLast?: boolean;
  /** True when the player typed this game's seed in AND it is NOT already in
   * their local history — a code that came from somewhere else.
   *
   * This half genuinely does need the engine to know the seed was entered
   * rather than rolled: a random seed is also absent from the log, and without
   * the flag every fresh game would earn it. `replayedSeed` and `sharedSeed`
   * are mutually exclusive by construction (see the engine note in the def
   * below), so the two seed badges can never co-fire.
   *
   * Optional for the same reason as `replayedSeed`. */
  sharedSeed?: boolean;
}

const FARM_TAX_M = 15; // $M over the bankroll before the overrun earns its pill
const DIME_BONUS = 9.9; // payroll bonus this high means the cap is all but exactly spent
const CHEAP_PCT = 0.6; // spend/cap at or under this is a pocketed payroll
const PINCH_PCT = 0.5; // …and this cheap WITH a winning record is a skill brag
const PINCH_WINS = 95;
const CRYSTAL_HITS = 7; // dream-team picks found (of 8, or 9 with a manager)
/* 🕶️ needs a result as well as the nerve, and CHEAP_PCT is the number that
 * supplies it. Above 60% of the cap the club has genuinely committed the
 * payroll it did not know it had; at or below it, signing eight cheap men and
 * finishing well under is timidity rather than daring. Reusing 🧾 POCKETED THE
 * DIFFERENCE's own line makes the two badges exact complements — 🧾 wants
 * spend ≤ 60%, 🕶️ wants spend > 60%, so they can never co-fire and say
 * opposite things about the same payroll. */
const RING_BEARERS = 4;
const COOPERSTOWN_PTS = 30;
/** Hall of Famers on one club, counting the skipper's chair. Measured over
 * 6,000 bot seasons: three is 21.67%, four is 6.10%, five is 1.03%.
 *
 * A third of that total is the chair, and the chair's rate is a property of
 * the ARM rather than of the badge — a bot that prefers Manager-of-the-Year
 * winners hires a Hall of Fame skipper more often than the 125-of-1,188 card
 * supply alone would predict. Split out: players only, four is 4.20% and three
 * is 15.47%; with the skipper, 6.33% and 20.07% (n = 1,500). So the tier reads
 * `uncommon` on the badge as it actually fires and would read `rare` on the
 * players alone. The badge counts the chair, so `uncommon` is the honest tier
 * — but the number is arm-sensitive and should be re-read after any change to
 * manager policy.
 *
 * Four is the rung. Five would be a second ~1% badge that fires on almost the
 * same clubs as 🌟 MURDERERS' ROW — Hall of Famers ARE the highest-WAR
 * seasons in the set, so the two would move together and say one thing twice.
 * Three fires in one game in five, which is not a class of anything. Four sits
 * beside 🏅 ALL-STAR ROSTER (6.05) and 💎 THE FRANCHISE PLAYER (6.47), and
 * it shares 💍 RING BEARERS' shape — "four or more players who…".
 *
 * The supply is 70 distinct men over 955 player-seasons (2.67% of the pool) on
 * 558 of the 1,188 cards, plus nine Hall of Fame managers on 125 cards. */
const HALL_COUNT = 4;
/** Five countries of birth across eight seats. The count, never a named
 * country: 75.8% of draftable player-seasons are USA-born and the long tail is
 * single men — Scotland, Spain, Indonesia and Portugal have one player each in
 * the whole dataset — so a per-country badge would make an all-Curaçao club a
 * different order of problem from an all-USA one for a reason that is about
 * supply rather than about the player. Simulated over the real card pool, five
 * is the only rung that lands. Measured over 6,000 bot seasons: three is
 * 55.40%, four is 19.80%, five is 3.70%, six is 0.35%. Four is a coin that
 * comes up one game in five; six never comes up. Same reasoning that picked
 * AGE_COUNT.
 *
 * Both rates are measured under BLIND play — a draw that maximizes WAR and
 * knows nothing about where anyone was born — which is the only honest
 * population for this badge, because no player can see a country either. That
 * is what settles 5 over 4: a threshold nobody can steer toward has to land as
 * a surprise rather than as a coin that comes up one game in six. */
const COUNTRY_COUNT = 5;
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

/* ---- the three shape badges, and the ceiling they all run into ----
 *
 * The club is C / IF / IF / OF / FLEX / SP / SP / RP (types.ts SLOT_TYPES) and
 * eligibility.ts fills the RP seat only from `pos === "RP"`. Over the 35,720
 * card player-seasons that produces one hard fact every shape badge has to be
 * written around: NO relief season in the set reaches 8.0 WAR. The best is
 * Mark Eichhorn, TOR 1986, at 7.2; the next two are Mariano Rivera (NYY 1996)
 * and Jonathan Papelbon (BOS 2006), both at exactly 5.0. Catcher is the second
 * choke point — exactly one catcher season in the set reaches 8.0, Mike Piazza
 * LAD 1997 at 8.7.
 *
 * So "every seat at 8.0" is not rare, it is IMPOSSIBLE, and the arithmetic
 * ceiling on simultaneous 8.0 seats is 7 of 8 — and 6 of 8 unless the club
 * holds that one Piazza card. Both numbers are pinned in badges-supply, which
 * is where the reason this set has no ALL-GOLD badge lives. 🌟 counts stars
 * instead, which is the reachable version of the same idea. */

/** The WAR ladder's top rung, and how many seats have to reach it. 8.0 is the
 * same gold boundary 🌱 asks a Homegrown dollar to buy.
 *
 * Five is reachable and barely: over 8,000 bot seasons that maximize WAR at
 * every pick, the club held five gold seats 0.84% of the time and six 0.05%.
 * Four would be 6.86% — one game in fifteen, `uncommon`, and more common than
 * 🏅 ALL-STAR ROSTER, which is not what a badge for stacking stars should
 * feel like. Three would be 27%.
 *
 * The measured ceiling is six, against an arithmetic ceiling of seven: RP
 * never (0.00% of clubs), catcher almost never (1.46%, and only ever the one
 * Piazza card), and the other six seats between 22% and 37% each. */
const GOLD_WAR = 8.0;
const GOLD_SEATS = 5;

/** Stars and scrubs: the payroll strategy the bankroll mechanic rewards,
 * named. Two seats on the WAR ladder's star rung or above, three at or under
 * the low rung's floor — a club that spent everything on the top of the order
 * and let the rest ride.
 *
 * The two halves make it structurally impossible to co-fire with 🧼, which
 * wants every seat at 4.0 or better: three seats at 1.0 or under and "no seat
 * under 4.0" cannot both be true. ⚖️ is disjoint from it too, for the reason
 * recorded beside BALANCED_GAP. All three therefore stay on `roster`, and no
 * exclusive axis is needed — the exclusivity is in the world, the way the
 * toolbox trio's is. */
const TOP_HEAVY_STAR_WAR = 6.0; // the WAR ladder's violet→gold boundary
const TOP_HEAVY_STARS = 2;
const TOP_HEAVY_SCRUB_WAR = 1.0;
const TOP_HEAVY_SCRUBS = 3;

/** ⚖️ is a gap AND a floor, and the floor is not decoration. A bare
 * best-to-worst gap is a trophy for eight mediocre men — the shape a club
 * lands on when nothing good ever showed up on the reel — so the floor is what
 * turns "uniformly mediocre" into "deep and even": every seat useful, no seat
 * carrying the club.
 *
 * The relief seat is the reason the gap sits as wide as 4.0, and it is worth
 * spelling out because 4.0 looks generous next to 🧼's 4.0 floor. Only 0.30%
 * of relief seasons in the set reach 4.0 WAR at all and none reaches 8.0, so
 * the RP seat is the low seat on most clubs by construction. Measured over
 * 8,000 seasons the MEDIAN full club's best-to-worst gap is 7.40, and the
 * median gap inside the 🧼 population — every seat already at 4.0 — is still
 * 5.10. A gap of 4.0 is therefore genuinely tight rather than lenient: it
 * fires on 1.38% of clubs. Tightening it to 3.0 would drop that to 0.09%, and
 * to 2.5 to 0.01% — a badge nobody ever sees.
 *
 * The floor is deliberately BELOW 🧼's 4.0. At 4.0 this would be 🧼 plus a
 * ceiling, a reward for NOT signing a star, which is the objection that has to
 * be answered rather than repeated. At 3.0 it is a different claim, and it is
 * not a free rider on 🧼 either: only 17.7% of 🧼-shaped clubs clear a 4.0
 * gap, so the two badges disagree about five clubs in six.
 *
 * ⚖️ and ⛰️ are structurally exclusive and need no resolver to be: ⛰️ wants a
 * seat at 6.0+ and a seat at 1.0−, i.e. a gap of at least 5.0, where ⚖️ wants
 * a gap of at most 4.0. Both therefore stay on `roster`, the stacking axis,
 * the way the toolbox trio does — the exclusivity is in the world. */
const BALANCED_GAP = 4.0;
const BALANCED_FLOOR = 3.0;

/** The seasons the Commissioner's report found the trash can running. 2019 was
 * alleged and never substantiated, so it is not here — the badge names a
 * finding, not a rumor. Anyone on those two clubs trips it, skipper included:
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

/** Men Major League Baseball publicly suspended under the Joint Drug
 * Prevention and Treatment Program. The line is an ANNOUNCED PENALTY, never an
 * accusation: the Mitchell Report named far more people and adjudicated none
 * of them, and a grand-jury leak is not a finding — the same standard that
 * keeps the 2019 Astros off 🗑️.
 *
 * Seven of these men (Rodriguez, Braun, Cruz, Peralta, Everth Cabrera, Ruiz,
 * Tejada) are also Biogenesis names, which is not why they are here. They are
 * here because an announced penalty followed, with a number of games attached
 * to it. Appearing in the clinic's documents earns nothing; the suspension
 * does.
 *
 * Every entry resolves to an MLB announcement with a game count against it.
 * The comments carry the year and the length so the claim is checkable in the
 * diff rather than only in a browser tab.
 *
 * Keyed on the player alone, not the season. A suspension is a fact about the
 * person that every one of his cards carries, and the suspended season itself
 * is usually not draftable anyway: Tatís served all of 2022 and Canó all of
 * 2021, so neither year survived the card build.
 *
 * Two name collisions were checked and are NOT the men here — the Pedro Borbón
 * Jr. trap the 🚧 list records. `braunry01` is the 2007 Royals pitcher, one
 * card only; the Brewers outfielder is `braunry02` (MIL 2007–2020). `cruzne01`
 * is the 1997–2002 pitcher; the slugger is `cruzne02` (TEX 2007–SDP 2023).
 * Both traps are pinned in badges-supply.
 *
 * Jenrry Mejía is here rather than on 🎲: his 2016 permanent ban was a third
 * positive test, and it was conditionally lifted in 2018.
 *
 * `romerj.01` is the one id in this file with a non-alphanumeric character. A
 * period is legal in a Baseball-Reference id and legal in a Set key; it is
 * called out because it looks like a typo and is not. */
export const SUSPENDED: ReadonlySet<string> = new Set([
  "braunry02", // Ryan Braun, 2013 — 65 games
  "byrdma01", // Marlon Byrd, 2012 — 50 games; 2016 — 162 games
  "cabreev01", // Everth Cabrera, 2013 — 65 games
  "cabreme01", // Melky Cabrera, 2012 — 50 games
  "canoro01", // Robinson Canó, 2018 — 80 games; 2020 — 162 games
  "castiwe01", // Welington Castillo, 2018 — 80 games
  "colabch01", // Chris Colabello, 2016 — 80 games
  "colonba01", // Bartolo Colón, 2012 — 50 games
  "cruzne02", // Nelson Cruz, 2013 — 50 games
  "galvifr01", // Freddy Galvis, 2012 — 50 games
  "gordode01", // Dee Strange-Gordon, 2016 — 80 games
  "grandya01", // Yasmani Grandal, 2012 — 50 games
  "martest01", // Starling Marte, 2017 — 80 games
  "mejiaje01", // Jenrry Mejía, 2015 — 80 then 162 games; 2016 — permanent
  "motagu01", // Guillermo Mota, 2006 — 50 games; 2012 — 100 games
  "palmera01", // Rafael Palmeiro, 2005 — 10 days
  "peraljh01", // Jhonny Peralta, 2013 — 65 games
  "polanjo01", // Jorge Polanco, 2018 — 80 games
  "ramirma02", // Manny Ramirez, 2009 — 50 games; 2011 — 100 games
  "rodrial01", // Alex Rodriguez, 2014 — 162 games
  "romerj.01", // J.C. Romero, 2009 — 50 games
  "ruizca01", // Carlos Ruiz, announced 2012 — 25 games, served 2013
  "sanchal03", // Alex Sánchez, 2005 — 10 days, the first man under the policy
  "santaer01", // Ervin Santana, 2015 — 80 games
  "tatisfe02", // Fernando Tatís Jr., 2022 — 80 games
  "tejadmi01", // Miguel Tejada, 2013 — 105 games
  "volqued01", // Edinson Vólquez, 2010 — 50 games
]);

/** The men this game's window can put in a uniform who are on the record for
 * betting on baseball, or charged with rigging it.
 *
 * Three different legal facts sit in one list, which is why the copy names
 * NONE of them:
 *
 *  - Pete Rose — the 1989 investigation concluded he bet on the Reds while
 *    managing them, and he accepted the ban. That is a finding.
 *  - Tucupita Marcano — permanently banned by MLB in 2024 for 387 baseball
 *    bets, the first active player banned for life for gambling in a century.
 *    That is a finding too.
 *  - Emmanuel Clase and Luis L. Ortiz — federally indicted in November 2025
 *    over rigged pitches, both pleaded not guilty, both on non-disciplinary
 *    paid leave since July 2025. As of this writing there is NO verdict and no
 *    MLB finding. That is a charge, not a finding.
 *
 * The label is BET ON BASEBALL — the phrase the sport itself uses for the rule
 * on the clubhouse wall, and the owner's call. It is a category, not a verdict
 * on any one man, and the `how` string is where the four men's actual statuses
 * are spelled out one at a time: two findings, two open cases. That division
 * of labor is deliberate rather than a compromise. The label is shorthand
 * carried on a pill and into a share string; the `how` is the sentence a
 * player reads when they tap the badge, so precision is cheap there and
 * nothing in it asserts guilt against Clase or Ortiz.
 *
 * The status copy has already gone stale once on this subject and would again:
 * Manfred removed Rose from the permanently ineligible list in May 2025,
 * holding that a ban ends at death. A badge reading "BANNED FROM BASEBALL"
 * would have been wrong the day it shipped.
 *
 * Rose's skipper seat counts, the way the 2017–18 Astros' does — he was banned
 * for what he did in that chair, not for anything he did at the plate. His
 * five Reds seasons as primary manager are card-exact and pinned in
 * badges-supply. */
export const GAMBLERS: ReadonlySet<string> = new Set([
  "rosepe01", // Pete Rose — CIN 1985, 1986
  "marcatu01", // Tucupita Marcano — PIT 2022, 2023
  "claseem01", // Emmanuel Clase — TEX 2019, CLE 2021–2025
  "ortizlu03", // Luis L. Ortiz — PIT 2023, 2024, CLE 2025
]);
const ROSE_TEAM = "CIN";
const ROSE_YEARS = [1985, 1986, 1987, 1988, 1989];

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
    // The peak, and the peak is a secret. See `secret` on BadgeDef: a locked
    // slot reading "👑 BEST RECORD OF ALL TIME" spends the surprise the top of
    // the ladder exists to deliver, on a case where nothing has been found yet.
    secret: true,
    emoji: "👑",
    label: "BEST RECORD OF ALL TIME",
    rarity: "legendary",
    axis: "onfield",
    freq: 1.33,
    // Two records, both named. "Baseline wins" is the finale ledger's own
    // label for the row that reads `50 + WAR + skipper`, and "final record" is
    // the giant W–L stamped above it. 👑 beside a stamp that disagreed with it
    // is what the second gate exists to prevent, so the copy can say plainly
    // that both cleared 117 rather than hedging about which one counts. The
    // ledger already prints the arithmetic; this string does not repeat it.
    how: "117 baseline wins or more, and a final record that held there — better than any club has ever finished.",
  },
  /* All six named rungs are `secret`, for the reason `crown` is and one more
   * of their own: a rung matched EXACTLY is a farmable target the moment it is
   * named. "MATCHED THE 2016 CUBS" on a locked slot reads as "go win exactly
   * 103", and six of them named at once turn the axis into a list of totals to
   * hit on the nose. Anonymous, the ladder is what it was built to be — a club
   * you turn out to have tied. */
  {
    key: "mariners",
    secret: true,
    emoji: "🔱",
    label: "MATCHED THE 2001 MARINERS",
    rarity: "ultra",
    axis: "onfield",
    freq: 0.63,
    how: "Exactly 116 baseline wins and a final record no worse, tying the mark the 2001 Mariners still hold.",
  },
  {
    key: "yankees",
    secret: true,
    emoji: "🗽",
    label: "MATCHED THE 1998 YANKEES",
    rarity: "ultra",
    axis: "onfield",
    freq: 1.4,
    how: "Exactly 114 baseline wins and a final record no worse, matching the 1998 Yankees.",
  },
  /* The champion rungs climb in rarity with the win total they name, which is
   * also what the measurement says: 4.29 / 4.92 / 4.99 / 5.95 percent, rarest
   * first. The split falls on the 5% band line between the Astros and the Red
   * Sox, so the tier a player sees and the frequency they actually hit agree. */
  {
    key: "mets",
    secret: true,
    emoji: "🍎",
    label: "MATCHED THE 1986 METS",
    rarity: "rare",
    axis: "onfield",
    freq: 4.29,
    how: "Exactly 108 baseline wins and a final record no worse, matching the 1986 Mets.",
  },
  {
    key: "astros",
    secret: true,
    emoji: "🚀",
    label: "MATCHED THE 2022 ASTROS",
    rarity: "rare",
    axis: "onfield",
    freq: 4.92,
    how: "Exactly 106 baseline wins and a final record no worse, matching the 2022 Astros.",
  },
  {
    key: "cubs",
    secret: true,
    emoji: "🐻",
    label: "MATCHED THE 2016 CUBS",
    rarity: "uncommon",
    axis: "onfield",
    freq: 5.95,
    how: "Exactly 103 baseline wins and a final record no worse, matching the 2016 Cubs.",
  },
  {
    key: "redsox",
    secret: true,
    emoji: "🧦",
    label: "MATCHED THE 2004 RED SOX",
    rarity: "uncommon",
    axis: "onfield",
    freq: 4.99,
    how: "Exactly 98 baseline wins and a final record no worse, matching the 2004 Red Sox.",
  },
  {
    // The one rung on the axis that is NOT secret, and the reason the rest can
    // be: a locked case still names a hundred wins, so the ladder has a
    // direction. Everything above this rung is a discovery.
    key: "hundred",
    emoji: "💯",
    label: "100-WIN CLUB",
    rarity: "common",
    axis: "onfield",
    freq: 47.37,
    how: "100 baseline wins or more, and a final record that held there.",
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
    // Keyed to the STAMPED record — the 0–162 the finale prints — not to the
    // baseline. On the baseline this rung cannot fire at all: the worst season
    // available at each of the eight seats sums to −26.5 WAR and the worst
    // manager in the set is worth −16 wins, so the floor under a baseline is
    // 50 − 26.5 − 16 = 7.5, comfortably above zero. Pinned in badges-supply.
    // A season CAN stamp 0–162, because the stamp counts the luxury tax; that
    // is what the badge names, and it is the record the player is looking at
    // when they go looking for it.
    freq: 0,
    how: "An 0–162 season on the record the finale stamps. Every game, lost.",
  },
  {
    key: "worst",
    emoji: "📉",
    label: "WORST RECORD OF ALL TIME",
    rarity: "ironic",
    axis: "onfield",
    ironic: true,
    freq: 0,
    how: "40 wins or fewer on the record the finale stamps — worse than any club has ever finished.",
  },
  {
    key: "skull",
    emoji: "💀",
    label: "100-LOSS CLUB",
    rarity: "ironic",
    axis: "onfield",
    ironic: true,
    freq: 0,
    how: "100 losses or more on the record the finale stamps.",
  },

  // ---- the goal, its own axis ----
  {
    // `secret` for 👑's reason rather than the ladder's: this is the other end
    // the game exists to deliver, and a locked slot reading "🏆 PERFECT
    // SEASON" hands it over before anyone has played for it. The trigger is
    // the game's stated goal, which the help sheet already states — what the
    // silhouette withholds is that there is a badge waiting at the end of it.
    key: "perfect",
    secret: true,
    emoji: "🏆",
    label: "PERFECT SEASON",
    rarity: "legendary",
    axis: "goal",
    freq: 1.01,
    how: "A full 162 points.",
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
    how: "95 baseline wins or more on half your payroll or less.",
  },
  {
    key: "pocket",
    emoji: "🧾",
    label: "POCKETED THE DIFFERENCE",
    rarity: "ironic",
    axis: "payroll",
    ironic: true,
    freq: 0,
    how: "Left 40% of your payroll unspent and still finished under .500 on baseline wins.",
  },

  // ---- scouting ----
  /* The threshold stands at seven and the tier moves, rather than the other
   * way round. The badge means "you drafted what the optimizer wanted", and
   * that meaning has not changed — what changed is the optimizer. It now
   * maximizes the finale's actual SCORE rather than WAR plus hardware, so the
   * dream club fills about 96% of its payroll instead of ignoring the cap, and
   * it therefore looks far more like a club a person would build. Agreement
   * with a real draft rose accordingly: scout hits mean 3.95 → 4.60, and this
   * badge 3.25% → 9.60%.
   *
   * Raising CRYSTAL_HITS to eight would hold the old tier by making a
   * different and much harsher claim — eight of nine picks matching. Letting
   * the number move is the honest reading: the badge got easier because the
   * yardstick got better, and 9.60% seats it beside 🧢 (9.90) and 📆 (9.43),
   * which is where a badge that fires one game in ten belongs. */
  {
    key: "crystal",
    emoji: "🔮",
    label: "CRYSTAL BALL",
    rarity: "uncommon",
    axis: "scout",
    freq: 9.6,
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
    how: "Signed a player who both pitched and hit that season.",
  },
  /* The three shape badges sit together because they are one question asked
   * three ways — how the club's WAR is distributed across its eight seats.
   * 🧼 says there is no soft seat, ⛰️ says two seats carry six, ⚖️ says every
   * seat is close to every other. None of them can be an ALL-GOLD badge; see
   * the ceiling note beside GOLD_WAR for why that badge cannot exist. */
  {
    // The key is `noweak` and the label says NO SCRUBS, which is normal here
    // (`dayjob`, `pocket`, `crossed` all read one way and store another) and
    // is deliberate: the key is the storage contract. history.ts records badge
    // KEYS, and badgeCase() counts by key, so renaming it would orphan every
    // NO SCRUBS anyone has ever earned. The glyph is not under that contract
    // and tracks the label instead: 🧼 is the soap the name asks for. It is a
    // single code point, so the share string's emoji run costs exactly what a
    // one-glyph badge has always cost, and nothing else in the set is a pale
    // rounded block it could be confused with at 10.5px — 🧾, 🧰 and 🧮 are the
    // near neighbors in the household register and all three carry detail a
    // bar of soap does not.
    key: "noweak",
    emoji: "🧼",
    label: "NO SCRUBS",
    rarity: "rare",
    freq: 3.04,
    axis: "roster",
    how: "Every player on the roster posted 4.0 WAR or better.",
  },
  {
    key: "topheavy",
    emoji: "⛰️",
    label: "STARS AND SCRUBS",
    rarity: "rare",
    axis: "roster",
    // Null on purpose, and it will stay null. Every bot arm maximizes WAR, and
    // this badge asks a club to waste three seats — so a measured rate here
    // records how often a greedy policy ACCIDENTALLY builds stars-and-scrubs,
    // not how hard the badge is for a player who sets out to do it. That is
    // the same reason 🌱 / 🧗 / 🧰 carry no number: the measurement would
    // describe the arm rather than the game.
    freq: null,
    how: "Two players at 6.0 WAR or better, and three at 1.0 or under.",
  },
  {
    key: "balanced",
    emoji: "⚖️",
    label: "NO DROP-OFF",
    rarity: "rare",
    axis: "roster",
    freq: null,
    how: "Every seat at 3.0 WAR or better, and no more than 4.0 WAR between your best player and your worst.",
  },
  {
    key: "gold",
    emoji: "🌟",
    label: "MURDERERS' ROW",
    rarity: "ultra",
    axis: "roster",
    // Null for the ⛰️ reason inverted: this one the bot is BETTER at than a
    // player, because stacking WAR is exactly what every arm already does. A
    // measured rate here is an upper bound on a human's, not an estimate of
    // it. The number study 12 recorded is in the report rather than in this
    // field, because `freq` documents itself as the rate in the reference
    // population and quoting a greedy solver's rate as the player's would be
    // the fabricated measurement that field forbids.
    freq: null,
    how: "Five players at 8.0 WAR or better in one club.",
  },
  /* The name COOPERSTOWN CLASS moves to the badge that means it literally, and
   * the award-points badge it moves off keeps its KEY.
   *
   * That split is deliberate and it is the only migration that does not lie to
   * somebody. history.ts stores badge KEYS and badgeCase() counts by key, so a
   * key is a claim about what a player has already earned: everyone holding
   * `cooperstown` collected thirty award points, and that is still exactly
   * what the badge under that key asks for. Moving the KEY to the Hall of Fame
   * badge would hand every one of them a badge they never earned. Moving only
   * the LABEL is a re-skin of a pill they own — the same trade 🧼 NO SCRUBS
   * makes — and the emoji has to follow the label, because a pill reading
   * "🏛️ HARDWARE COLLECTION" is incoherent.
   *
   * The name is 🕸️ EMPTY TROPHY CASE's positive counterpart, because that is
   * what the badge is: 🕸️ fires at zero award points and this one at thirty,
   * one idea pointed in two directions. The pair does NOT share a tier the way
   * 🧓/🍼 do, and cannot: `ironic` is a tier and a rendering mode at once — an
   * anti-trophy sits outside the progress fraction and wears an anonymised
   * locked slot — so the two ends of this idea are `ironic` and `rare` by
   * necessity. They share a subject, not a band.
   *
   * 🎖️ rather than 🥇 or 🏅: 🥇 collides with the medal on the MVP award pill
   * and 🏅 is ALL-STAR ROSTER's, and both are round medals that read alike at
   * pill size. "Hardware" is what a clubhouse calls a trophy. */
  {
    key: "cooperstown",
    emoji: "🎖️",
    label: "HARDWARE STORE",
    rarity: "rare",
    axis: "roster",
    // Unchanged: same trigger, same threshold, same measured rate. Only the
    // name and the glyph moved.
    freq: 2.05,
    how: "Collected 30 or more award points across the club.",
  },
  /* The Hall, literally. Membership is read off the cards rather than
   * inferred: a player carries `hof` when Lahman has him inducted with
   * `category = "Player"`, and a card carries `managerHof` when its skipper is
   * inducted with `category = "Manager"`. The skipper counts because a manager
   * is a member of that club the same way a player is — the same reading that
   * puts the 2017 Astros' manager on 🗑️ — and because the strict category
   * split is what keeps the chair honest: Frank Robinson is in the Hall as a
   * player and managed for sixteen years, and he is not a Hall of Fame manager.
   *
   * Two properties of this badge are era-locked and neither is a bug:
   *
   * 1. Induction needs retirement plus a five-year wait, so NO player-season
   *    from 2020 or later can ever carry the flag — 0 of 6,077. The rate
   *    decays 5.48% for 1985–94 to 0.33% for 2016–19 to zero, so the badge
   *    quietly rewards drafting old and gets harder every year the dataset
   *    grows a season on the front.
   * 2. The set is not closed. Membership changes every January, so this is the
   *    one badge in the file whose difficulty drifts with a data regen rather
   *    than staying put. badges-supply pins the counts, so the drift shows up
   *    as a failing assertion rather than as a badge that silently got easier.
   *
   * Both are accepted rather than mitigated. */
  {
    key: "hall",
    emoji: "🏛️",
    label: "COOPERSTOWN CLASS",
    rarity: "uncommon",
    axis: "roster",
    freq: null,
    how: "Four Hall of Famers, signed or hired — the skipper's chair counts as one.",
  },
  {
    // `secret` for a reason that is unusual in this table: nothing in the app
    // shows a player's birth country. Not the market rows, not the roster
    // rail, not the finale. So this is not a badge a player can aim at even in
    // principle — the fact is invisible until it is already collected — and a
    // named locked slot reading "🌎 THE WORLD TOUR" would advertise a target
    // the UI gives no way to hunt. That is the exact case `secret` exists for.
    key: "worldtour",
    secret: true,
    emoji: "🌎",
    label: "THE WORLD TOUR",
    rarity: "rare",
    axis: "roster",
    freq: null,
    how: "Eight players born in five different countries.",
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
    how: "Signed a father and his son.",
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
    how: "Hired a skipper who is also on your roster.",
  },
  {
    key: "skipper",
    emoji: "🧢",
    label: "PUSHED THE RIGHT BUTTONS",
    rarity: "uncommon",
    axis: "roster",
    freq: 9.91,
    how: "Hired a Manager of the Year and finished above 105 baseline wins.",
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
    how: "Five players out of one division.",
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
    how: "Your owner, your ballpark, and one of your players, all from one club.",
  },
  {
    key: "franchiseplayer",
    emoji: "💎",
    label: "THE FRANCHISE PLAYER",
    rarity: "uncommon",
    axis: "roster",
    freq: 6.47,
    // Half of what you SPENT, not half of the cap — the denominator is the
    // outlay, so a $40M man on an $80M club earns this under a $200M payroll.
    // 🚜 and 🤏 measure against the budget and say "payroll" for it; this one
    // says "spent" because that is the number it divides by.
    how: "Half of everything you spent went to one player.",
  },
  /* Drafting against an unknown payroll — the one nerve play Clean House sets
   * up. The bank does not tell you your cap until you hire an owner, so every
   * signing made before that is a bet, and the box shows the pre-owner spend
   * in caution orange for exactly that reason.
   *
   * The badge asks for the whole club, not merely a late owner. "Owner hired
   * last in the spin log" is the easy version and it is wrong twice over: it
   * fires for a club with five empty seats that happened to take an owner on
   * its final spin, and it misses a club that drafted all eight blind and then
   * bought a ballpark. The ballpark and the skipper are not part of the
   * gamble — the ballpark multiplies a cap you already know and the skipper
   * costs nothing against payroll — so neither belongs in the condition.
   *
   * It rides `roster` rather than `payroll`, which is an exclusive axis: this
   * is a fact about the ORDER a club was built in, and it is supposed to stack
   * with whatever the payroll finally came to. 💵 SPENT EVERY DIME beside it
   * is the best possible version of the story. */
  {
    key: "flyingblind",
    emoji: "🕶️",
    label: "FLYING BLIND",
    rarity: "rare",
    axis: "roster",
    // Likely null permanently, for the 🧗 / 🧰 reason: every bot arm carries
    // its own front-office policy, and when to take the owner IS that policy.
    // A measured rate would describe the arm's patience rather than the
    // badge's difficulty. Study 11 measures it anyway; if the arms disagree
    // wildly with each other, that is the evidence the number is about them.
    freq: null,
    how: "Filled all eight seats before hiring an owner, then committed over 60% of a payroll you could not see without busting it.",
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
    how: "Signed an 8-WAR season for the Homegrown price of $1M.",
  },
  {
    key: "hardway",
    emoji: "🧗",
    label: "THE HARD WAY",
    rarity: "rare",
    axis: "roster",
    freq: null,
    how: "A hundred baseline wins without spending a single powerup.",
  },
  {
    key: "toolbox",
    emoji: "🧰",
    label: "THE WHOLE TOOLBOX",
    rarity: "common",
    axis: "roster",
    freq: null,
    how: "Spent every powerup you had.",
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
  {
    // The one badge in the table `earnedBadges` never pushes. It is written
    // straight into the history row by the quit path, because there is no
    // finale on that path to earn anything at — see the engine spec in the
    // round-2 badge notes. badges.test.ts scrapes pushed keys and asserts each
    // resolves to a definition; it does not assert the reverse, so a
    // defined-but-never-pushed badge is legal. This comment is here so the
    // next reader does not go looking for the trigger.
    key: "packedin",
    emoji: "🧳",
    label: "PACKED IT IN",
    rarity: "ironic",
    // Nearly decorative: no resolver ever sees this key, because nothing
    // pushes it. `roster` is the least wrong of six bad fits — study 11's
    // per-axis table will file it there and it is not a roster fact. If a
    // seventh axis is ever added for app-level events, this and ✳️ / 🤝 are
    // its three members.
    axis: "roster",
    ironic: true,
    // No bot arm quits — every harness game runs to the finale — so there is
    // no population to measure this against.
    freq: null,
    how: "Walked out on a season in progress.",
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
    how: "Signed one of the record seasons of 1985–2025.",
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
  {
    // `secret` is not optional here. A named locked slot reading "💊 FAILED
    // THE TEST" is a shopping list of who to go sign, which is a repugnant
    // thing to hand a player about twenty-seven living men. Anonymised, it is
    // a fact you stumble into.
    key: "suspended",
    secret: true,
    emoji: "💊",
    label: "FAILED THE TEST",
    rarity: "uncommon",
    axis: "era",
    // Measured, and much higher than it looks like it should be: 18.3% of
    // reference games, which puts it beside ✊ PICKET LINE (18.90) and
    // 🦠 SOCIAL DISTANCING (18.51) rather than beside 🚧 CROSSED THE LINE
    // (0.74), whose trigger shape it copies. The cause is exposure rather than
    // list size — these are stars with long careers, so the 27 men are 2.14%
    // of top-5-WAR seats against 0.96% of all player-seasons, and a WAR-led
    // draft finds them at more than double their population share.
    freq: 18.28,
    how: "Signed a player Major League Baseball suspended under its drug program.",
  },
  {
    key: "gambling",
    secret: true,
    emoji: "🎲",
    label: "BET ON BASEBALL",
    rarity: "ultra",
    axis: "era",
    // Eleven of the 1,188 cards can trip it, and the manager path carries most
    // of that: two of the four men have four draftable player-seasons between
    // them, against Rose's five seasons in the Reds dugout.
    freq: 1.0,
    // The longest string in the file, and it earns every character. The label
    // is a category — the rule on the clubhouse wall — and this is where the
    // four men stop being a category and become their actual statuses: two
    // findings, two open cases. It says "charged", never "caught"; it names
    // the pleas, the pending trial and the paid leave; and it says in so many
    // words that Major League Baseball has found nothing against the two
    // Guardians pitchers. Nothing here may be shortened into an assertion of
    // guilt, whatever the label above it says.
    how: "Signed or hired one of the four men in this game's window on baseball's betting rules. Pete Rose was banned in 1989 for betting on his own club. Tucupita Marcano was banned in 2024. Emmanuel Clase and Luis Ortiz were charged in 2025 over rigged pitches: both pleaded not guilty, both re-entered those pleas in February 2026, both are awaiting trial and have been on non-disciplinary paid leave since July 2025, and Major League Baseball has made no finding against either.",
  },
  /* The two seed badges. Both are jokes about provenance rather than facts
   * about baseball, and they are a matched pair pointed in opposite
   * directions: ✳️ is what you did to yourself, 🤝 is what someone did for
   * you. They ride `era` because that is where the set already keeps "this
   * season has an asterisk on it, whatever the reason". */
  {
    key: "asterisk",
    // No `secret: true`. It would be redundant — BadgePill and TrophyModal's
    // anonymous predicate both treat `ironic` OR `secret` as sufficient to
    // withhold the name, and no shipped badge carries both.
    emoji: "✳️",
    label: "THE ASTERISK",
    rarity: "ironic",
    axis: "era",
    ironic: true,
    // No bot arm replays a seed — every harness game gets a fresh one from
    // makeSeeds — so there is no population to measure this against.
    freq: null,
    // "The same seed", never "the same game": engine.svelte.ts picks cards by
    // indexing into the live card list, so a data regen that changes the card
    // count remaps every seed to a different sequence. The seed is the only
    // thing that is true about a replay unconditionally and forever.
    how: "Finished a season on a seed you had already played.",
  },
  {
    // Deliberately NOT ironic, unlike its twin. Replaying your own seed is a
    // joke at your expense; playing a code a friend sent you is the one thing
    // in this game two people can do together, and it belongs in the progress
    // fraction as something to chase.
    //
    // Yes, it is self-farmable by typing six characters you invented — there
    // is no server to ask whose seed it was. That is accepted rather than
    // defended: the badge costs nothing to earn dishonestly and nothing is
    // ranked on it.
    key: "wordofmouth",
    emoji: "🤝",
    label: "WORD OF MOUTH",
    rarity: "rare",
    axis: "era",
    // Unmeasurable for the ✳️ reason: no bot arm types a seed in.
    freq: null,
    how: "Played a seed someone else gave you.",
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
    how: "Five players from the same decade.",
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

/** The one on-field badge a season earns, or null. Crown supersedes every
 * named rung, named rungs match exactly, and 💯 catches the rest of the
 * century. 98 sits BELOW the 💯 floor, which is deliberate: at 3.2% without
 * powerups it is the only named rung a player reaches without them.
 *
 * EVERY rung is gated on both records. `baselineWins` picks the rung — that is
 * the club you built, and the exact-match ladder is defined on it — and
 * `stampWins`, the record the finale prints, decides whether you keep it.
 *
 * The reason is the luxury tax. Overspending is a legitimate line and stays
 * one: the tax prices it, and nothing here forbids it. What the second gate
 * says is that the result has to SURVIVE the bill. A club worth 105 on the
 * field that taxes itself down to 81–81 has not been a 100-win club in any
 * sense the player can point at, and a badge reading 100-WIN CLUB over an
 * 81–81 stamp is the badge calling the screen a liar.
 *
 * The two sides are shaped differently and the asymmetry is the ladder's:
 *
 *  - Baseline is EXACT on a named rung. A rung is a total you hit on the nose,
 *    which is what lets the ladder be dense without a rung swallowing its
 *    neighbors.
 *  - The stamp is a FLOOR, never an exact match. A club that matches the '16
 *    Cubs on the field and then piles award points on top has still matched
 *    the Cubs; a club that matches them and taxes itself to .500 has not.
 *
 * A rung vetoed by the stamp earns NOTHING — it does not drop to a lower rung.
 * The rung a season is playing for is the one its baseline names, and the only
 * question the stamp answers is whether it held. Cascading would hand a
 * taxed-out 116-win club a consolation 💯, which turns the penalty back into a
 * prize and makes "matched the Mariners" a thing you can half-do.
 *
 * `stampWins` defaults to `baselineWins`, which is what a fact set assembled
 * before the stamp existed supplies: on that path the gate is satisfied by
 * construction and the ladder behaves exactly as it did before it. */
export function onFieldBadge(
  baselineWins: number,
  stampWins: number = baselineWins,
): string | null {
  if (baselineWins >= CROWN_WINS)
    return stampWins >= CROWN_WINS ? "crown" : null;
  const rung = MATCHED[baselineWins];
  if (rung) return stampWins >= baselineWins ? rung : null;
  if (baselineWins >= HUNDRED_WINS)
    return stampWins >= HUNDRED_WINS ? "hundred" : null;
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

  // The whole on-field ladder reads BOTH records, top and bottom, and reads
  // them for different jobs.
  //
  // The rungs at and above 💯 are PICKED by the baseline — what the club is
  // worth before awards, rings and the payroll bonus, because those modifiers
  // add twenty wins to a stamp routinely and 💯 keyed to the stamp would be
  // automatic — and KEPT or lost on the stamp, which has to clear the same
  // mark. See onFieldBadge for why, and for why a vetoed rung earns nothing
  // rather than dropping a rung.
  //
  // The three floor rungs read the stamp alone, because an anti-trophy has to
  // name something the player can see: a season that scores −16 points stamps
  // 0–162 and must earn 👔, whatever the club underneath it was theoretically
  // worth. All three move together — they are one ladder, nothing won, then a
  // record low, then a hundred losses, and supersession only means anything
  // while the rungs are measured in the same units.
  //
  // One consequence worth naming, because it is a change in kind rather than
  // in degree: a club whose baseline earns a rung and whose stamp lands in the
  // floor bands now falls through to the floor rung it actually posted. A 103
  // baseline taxed to a 30–132 stamp reads 📉 rather than 🐻. That is the
  // honest answer — 30–132 is the record on the screen — and it is only
  // reachable at all because the rung above can now be vetoed.
  //
  // Exclusivity survives untouched: this is still one if/else chain, so at
  // most one on-field badge comes out of it however the two records disagree.
  const floor = f.stamp ?? {
    wins: f.baselineWins,
    losses: f.baselineLosses,
  };
  const field = onFieldBadge(f.baselineWins, floor.wins);
  if (field) out.push(field);
  // At or below zero, not exactly zero. The stamp clamps at zero so the two
  // forms agree today, but the rung is written not to depend on a clamp in
  // another module staying in place — and `scoring.displayRecord`, which feeds
  // the fallback, clamps only its upper end.
  else if (floor.wins <= 0) out.push("dayjob");
  else if (floor.wins <= WORST_WINS) out.push("worst");
  else if (floor.losses >= 100) out.push("skull");

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
  // The three shape badges all want `full`, for the reason 🏅 and 🧼 do: a
  // club with five empty seats and three cheap men would otherwise earn a
  // badge whose copy claims a whole roster. ⚖️ needs it twice over — a gap
  // taken over two filled seats is trivially small.
  if (
    full &&
    roster.filter((p) => p.war >= TOP_HEAVY_STAR_WAR).length >=
      TOP_HEAVY_STARS &&
    roster.filter((p) => p.war <= TOP_HEAVY_SCRUB_WAR).length >=
      TOP_HEAVY_SCRUBS
  )
    out.push("topheavy");
  if (full) {
    const wars = roster.map((p) => p.war);
    const low = Math.min(...wars);
    if (low >= BALANCED_FLOOR && Math.max(...wars) - low <= BALANCED_GAP)
      out.push("balanced");
    if (wars.filter((w) => w >= GOLD_WAR).length >= GOLD_SEATS)
      out.push("gold");
  }
  if (f.awardPoints >= COOPERSTOWN_PTS) out.push("cooperstown");
  // The skipper's chair is one of the four seats, and it is counted the same
  // way a player is. `=== true` rather than a truthiness test because both
  // fields are optional: a club restored from a save written before they
  // existed must count as no Hall of Famers rather than as an unknown.
  if (
    roster.filter((p) => p.hof === true).length +
      (f.managerHof === true ? 1 : 0) >=
    HALL_COUNT
  )
    out.push("hall");
  // The type predicate is load-bearing: a bare `!== undefined` filter does not
  // narrow, and would leave a Set<string | undefined> whose size counts the
  // missing countries as one more country.
  if (
    full &&
    new Set(
      roster
        .map((p) => p.country)
        .filter((c): c is string => c !== undefined && c !== ""),
    ).size >= COUNTRY_COUNT
  )
    out.push("worldtour");
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
  // `full` is required here as well as in the engine's flag, because the flag
  // answers "was the roster full WHEN the owner was hired" and this badge's
  // copy claims a finished club — a 🔁 Trade Deadline release afterwards could
  // leave a seat empty at the finale.
  if (
    f.ownerLast === true &&
    full &&
    f.budgetM > 0 &&
    f.spendM <= f.budgetM &&
    f.spendM > f.budgetM * CHEAP_PCT
  )
    out.push("flyingblind");
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

  // The replacement filter is defensive rather than load-bearing: no man in
  // REPLACEMENTS has a 1994 card season, so ✊ and 🚫 cannot both fire off one
  // player today. It stays because the two badges make opposite claims about
  // the same year, and a corpus change must not quietly award both.
  if (roster.some((p) => p.year === 1994 && !REPLACEMENTS.has(p.id)))
    out.push("strike");
  if (roster.some((p) => REPLACEMENTS.has(p.id))) out.push("crossed");
  if (roster.some((p) => SUSPENDED.has(p.id))) out.push("suspended");
  // Rose's five Reds seasons in the dugout are the half of 🎲 that makes it
  // reachable at all — two of the four men have four draftable player-seasons
  // between them. The window is a bare team-and-year pair with his name only
  // in the comment, so badges-supply pins the `manager` field of those five
  // cards; that is the assertion that would otherwise break silently.
  if (
    roster.some((p) => GAMBLERS.has(p.id)) ||
    (f.managerTeam === ROSE_TEAM &&
      f.managerYear !== null &&
      ROSE_YEARS.includes(f.managerYear))
  )
    out.push("gambling");
  // Both seed facts default to false, so a fact set assembled before the
  // fields existed — a save restored from an older version, a forged fixture —
  // earns neither rather than earning one by accident.
  if (f.replayedSeed === true) out.push("asterisk");
  if (f.sharedSeed === true) out.push("wordofmouth");
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

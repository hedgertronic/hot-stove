import { MONEYBALL_BUDGET_M, type Bank } from "./engine.svelte";
import { recordFromTotal } from "./format";
import { MANAGER_PER_NET_WIN } from "./scoring";

/* The badge set — one table, read by the finale pill row, the share string,
 * and the home trophy case. Adding a badge means adding one BadgeDef and one
 * trigger; nothing else in the app enumerates badges. Copy, face, key, and
 * process rules live in BADGES.md at the repo root — every new badge goes
 * through its checklist.
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
 *    💳 is the last arm of that chain and the only rung that reads the veto
 *    itself: a club whose baseline earns a rung, whose payroll went past the
 *    cap, and whose stamp cannot hold the mark. It is what the axis has to say
 *    about a season the veto would otherwise leave with nothing at all. It
 *    sits UNDER 👔 / 📉 / 💀, so a stamp deep enough to post a record low
 *    still reads the record it posted.
 *
 *    Because the axis genuinely uses two measures, every `how` string on it
 *    names WHICH ones it means, in the finale's own words — "baseline wins" is
 *    the label printed beside `50 + WAR + skipper`, "final record" is the
 *    stamp — so the badge copy and the screen agree instead of looking like
 *    two readings of one number. The same applies to every other badge keyed
 *    to a win total: 🧮, 🧢, 🧗 and 🧾 all read the baseline and all say so.
 */

/** The collection ladder. `legendary` sits above `ultra` and holds the badges
 * that say "you maxed out an axis" rather than "this was rare" — the frequency
 * gap between them and ultra is small, the statement is not. Membership is the
 * top of an axis: 👑 is the top of the on-field ladder, 🏆 the stated goal,
 * 🌠 the top of scouting, 💰 the top of the goal axis (exceeding the solver's
 * own ceiling). It is styled inverted from every other tier (ink fill, gold
 * text) so it reads as beyond the ladder rather than one more rung on it. */
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
 * fires; `roster`, `era`, `goal`, and `meta` stack freely.
 *
 * `meta` is the axis for badges that are about the APP rather than about a
 * baseball season: quitting a run, replaying a seed, being handed a seed, and
 * typing a code on a keyboard. Nothing on it reads the roster, the record or
 * the payroll, and nothing on it can be earned by playing better. It exists so
 * a per-axis tally files those four together instead of filing them under
 * `roster` and `era`, where they were the only members that named no player,
 * no season and no club.
 *
 * `career` is the axis for badges whose subject is the RUN of seasons rather
 * than any one of them. Both members read one fact off the local history log
 * (`prevTotal`), resolved in the engine before this game's own row is
 * appended — the seed flags' sequencing. They stack: gold and losing are
 * disjoint by arithmetic, so the axis needs no resolver (the ⚖️/⛰️
 * arrangement — the exclusivity is in the world). */
export type BadgeAxis =
  "onfield" | "goal" | "payroll" | "scout" | "roster" | "era" | "meta" | "career";

export interface BadgeDef {
  key: string;
  emoji: string;
  /** Finale pill and trophy-case text, sans emoji. */
  label: string;
  /** Human-readable display name for tooltips, in title case. Matches label for
   * pure acronyms (WBC, MVP) but uses mixed case for everything else — "Bet on
   * Baseball" not "BET ON BASEBALL". */
  name: string;
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
  /** The only banks whose MECHANICS can produce this badge; absent means every
   * bank can. The four front-office badges carry `["classic"]`: Moneyball and
   * Blank Check are fixed-cap banks with no owner or stadium seat at all, so a
   * condition that needs one is unearnable there by construction, not by
   * policy. The trophy case reads this to keep such a badge off the board and
   * out of the N OF M denominator under a bank lens that excludes every bank
   * it can fire in — a silhouette that says "could aim at" would be lying
   * under that lens. Difficulty needs no twin field: Eye Test hides
   * information but locks nothing out. */
  banks?: Bank[];
  /** Plain-language trigger, shown when a player opens an earned badge in the
   * trophy case. Written as the condition they met, not as a rule they should
   * chase — locked badges never reveal it. */
  how: string;
  /** Measured rate in the reference population (Open Market + all powerups),
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
  /** The season OUT-BUILT the dream club solved off its own cards — strictly
   * more BASELINE WINS (expected wins from WAR plus the skipper) than the
   * best club those cards could field. The talent comparison, deliberately
   * not the whole ledger: the full-total comparison is 🦉's alone, and when
   * both badges read the total they were one claim at two strictnesses (the
   * owner's split, round twelve).
   *
   * Resolved in the engine because the comparison is between numbers only the
   * engine holds at once: its own `parts.expectedWins` and the solver's
   * roster WAR + manager, pressed through the same round1 the ledger prints.
   *
   * Optional for the `age` reason, and it fails safe: absent reads as "did not
   * beat it", which is also what a game whose dream solve could not run should
   * report. */
  beatDream?: boolean;
  /** The season outscored the solver's own ceiling — the highest total possible
   * given the cards in play, which can be exceeded by Double Play when a
   * dominant card appears in both slots.
   *
   * Optional for the same "fail-safe" reason as `beatDream`. Absent reads as
   * "did not beat it", consistent with a game whose ceiling solve could not run.
   * Populated by the engine; the field is declared here so `earnedBadges` can
   * guard against it before the engine agent's commit lands. */
  beatCeiling?: boolean;
  /** The solver's RAW ceiling total — `best.total` exactly as the solve
   * returned it, the same unclamped number `beatDream` is compared against.
   * 🎣 reads it to ask whether the cards on the table could have stamped a
   * perfect 162–0 at all.
   *
   * Optional for the `beatDream` reason, and it fails safe the same way:
   * absent means "no ceiling known", and a season whose ceiling is unknown
   * cannot be said to have let one get away. */
  ceilingTotal?: number;
  spendM: number;
  budgetM: number;
  /** RAW dream-team hits — the count of seats genuinely matched, BEFORE the
   * engine's beatCeiling scoring upgrade (which raises the scored count to
   * `dreamSeats` as a courtesy to a club that beat the ceiling). The badges
   * read the raw number: 🌠 is a claim about matching, 🦉 about beating, and
   * feeding the upgraded count here made outscouting auto-earn 🌠 while the
   * finale's dream-team column visibly disagreed with the player's club. */
  scoutHits: number;
  /** The seats the dream club can actually fill — nine with a manager, fewer
   * when the reel showed too few cards to put one pick in every chair
   * (`bestroster.dreamSeats`, the same denominator the finale prints beside
   * the stars).
   *
   * `scoutHits` alone cannot answer "did you match the dream team", only "how
   * many did you match". A game that spun five cards has a five-seat dream
   * club, and five hits against it is a full match of a club that was never a
   * club — so 🌠 reads BOTH numbers and asks for nine of nine. The denominator
   * is carried rather than assumed at nine for the same reason `powerups`
   * carries its own total: a partial solve is a real state, and a badge that
   * hard-codes the full one silently rewards the thin reel it was built to
   * exclude.
   *
   * Optional for the `age` reason — a fact set assembled before the field
   * existed, a forged fixture, a restored save — and the direction of the
   * default is the whole point. It fails SAFE: the trigger asks
   * `dreamSeats === 9` on the nose, so absent, zero, and every partial solve
   * alike withhold 🌠 and leave 🔮 CRYSTAL BALL exactly as it was. A
   * permissive default here would be the `stampWins` trap again — an optional
   * fact whose absence turned a gate into dead code — and the shape of that
   * bug is that nothing ever fails. */
  dreamSeats?: number;
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
  /** The hired skipper's (W − L) that season. 🪑 THE INTERIM asks whether the
   * dugout the club settled for finished under .500, which is a fact about the
   * chair rather than about the season's own record — the club's stamp already
   * folds in eight roster seats and every modifier.
   *
   * Optional for the `age` reason, and it fails SAFE: absent reads as zero
   * through the trigger's `?? 0`, and zero is not under .500, so a fact set
   * assembled before the field existed withholds the badge rather than
   * inventing it. */
  managerNetWins?: number;
  /** True when the skipper was hired with every OTHER seat already filled —
   * the whole club built, the dugout left to the final spin.
   *
   * The exact counterpart of `ownerLast`, and it is a moment for the same
   * reason: by the finale a full roster and a hired manager look identical
   * whichever order they arrived in, so the engine records the answer at the
   * moment it makes the hire. Both first-hire paths write it — the FRONT
   * OFFICE row and ⭐ Prime Time's manager career sheet — while a 🔁 Trade
   * Deadline swap does not, because that path requires the chair to be taken
   * already and a club that had a skipper all along never left the dugout
   * empty.
   *
   * "Every other seat" means the roster plus, in Open Market, the owner and
   * the ballpark: the game ends the spin the club completes, so a hire made
   * with everything else filled IS the hire made on the final spin.
   *
   * Optional for the `age` reason. */
  managerLast?: boolean;
  /** The Konami code was entered on a physical keyboard during this game.
   *
   * Optional for the `age` reason: a save written before the field existed
   * restores as "not entered" rather than failing to type-check, which is also
   * the honest answer — nobody typed it, because there was nothing to type it
   * into. */
  konami?: boolean;
  /** A move was taken back with the HUD's undo during this game.
   *
   * Optional for `konami`'s reason and it fails the same way: a fact set built
   * before the field existed reports no rewind rather than a free badge. */
  undone?: boolean;
  /** Undo was used AND the very next committed action was the exact same move —
   * 🔂 DÉJÀ VU.
   *
   * Optional for `konami`'s reason and it fails the same way: a fact set built
   * before the field existed reports no redo rather than a free badge. */
  redone?: boolean;
  /** Three or more moves were taken back in one game — 🎠 MERRY-GO-ROUND.
   * (Read total undos: the once-per-spin rule closed the same-move carousel
   * — see the engine's `repeatedUndo` note.)
   *
   * Optional for `konami`'s reason and it fails the same way: a fact set built
   * before the field existed reports no repeated undo rather than a free badge. */
  repeatedUndo?: boolean;
  /** `Game.pedigree.rings`. */
  rings: number;
  /** `Game.pedigree.pennants`. Optional and fail-safe: a fact set assembled
   * before the field existed — a lab fixture, a restored save — reads as zero
   * near-misses, and 💐 cannot fire on an unknown. */
  pennants?: number;
  /** `Game.pedigree.wbcChampions`. Optional for the `pennants` reason and it
   * fails the same way: absent reads as no golds, which is the direction that
   * WITHHOLDS 💐 — the badge's no-golds gate wants a known zero, and an
   * unknown zero passing that gate is the fail-safe reading only because the
   * pennant count is absent from the same old fact sets. */
  wbcChampions?: number;
  /** `Game.pedigree.wbcRunnersUp`. Optional for the `pennants` reason: absent
   * reads as zero silvers and earns nothing. */
  wbcRunnersUp?: number;
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
   * Only Open Market can set it, and no mode gate is needed for that:
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
  /** The PREVIOUS finished season's points total — the newest scored row of
   * the local history log, read by the engine before this game's own row is
   * appended (`recordHistory`), exactly the seed flags' sequencing. Quits
   * carry no total and are skipped: a walked-out season is not a season, so
   * it neither extends nor breaks a back-to-back run.
   *
   * A total rather than a pre-chewed boolean because both career badges press
   * it through `recordFromTotal`, the same press that stamped that season's
   * own finale — the badge and the record the player saw that day agree by
   * construction, and a second career badge added later reads the same fact
   * instead of asking the engine for another flag.
   *
   * Optional for the `age` reason, and it fails safe: absent — a first career
   * game, a fixture built before the field existed — reads as no previous
   * season, and neither career badge can fire. */
  prevTotal?: number;
  /** Which bank this season was played under. 📈 alone reads it: "would've
   * won Moneyball" is a counterfactual, and under the real $51.5M cap it is
   * just the game. Optional for the `age` reason, failing safe: absent reads
   * as unknown, which earns nothing. */
  bank?: Bank;
}

const FARM_TAX_M = 15; // $M over the bankroll before the overrun earns its pill
// spend/cap at or above this, without going over, is 💵's claim — the number
// its copy states. Compared on the raw dollars, NOT on ScoreParts.budgetBonus:
// that figure reaches the facts rounded to one decimal, and `rounded ≥ 9.9`
// admits spends from 99.25% while the copy promises 99.5%.
const DIME_PCT = 0.995;
const CHEAP_PCT = 0.6; // spend/cap at or under this is a pocketed payroll
const PINCH_PCT = 0.5; // …and this cheap WITH a winning record is a skill brag
const PINCH_WINS = 95;
const CRYSTAL_HITS = 7; // dream-team picks found (of 8, or 9 with a manager)
/** The whole club: eight roster seats plus the dugout. 🌠 THE DREAM TEAM asks
 * for this number twice — the dream club has to HOLD nine seats and the player
 * has to have matched all nine — so a reel too thin to fill the ninth chair
 * takes the badge off the table rather than handing it over for a smaller
 * match. See `BadgeFacts.dreamSeats`. */
const DREAM_SEATS = 9;
/* 🕶️ needs a result as well as the nerve, and CHEAP_PCT is the number that
 * supplies it. Above 60% of the cap the club has genuinely committed the
 * payroll it did not know it had; at or below it, signing eight cheap men and
 * finishing well under is timidity rather than daring. Reusing 🧾 POCKETED THE
 * DIFFERENCE's own line makes the two badges exact complements — 🧾 wants
 * spend ≤ 60%, 🕶️ wants spend > 60%, so they can never co-fire and say
 * opposite things about the same payroll. */
const RING_BEARERS = 4;
/** Near-misses — pennants plus WBC silvers — before 💐 reads as a pattern.
 * The badge is a 9-seat club (eight players and the chair), so three is a
 * third of the club coming up one short; two is a coincidence a .500 roster
 * can stumble into, and asking for four would push a joke badge toward 💍's
 * difficulty when its whole point is that these men did NOT win. Tunable —
 * the number is a taste call, not a measured rung. */
const BRIDESMAID = 3;
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
 * same clubs as 🔪 MURDERERS' ROW — Hall of Famers ARE the highest-WAR
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
/** Four of eight from ONE season year. Study 20 (2,000 reference games): a
 * same-year PAIR is background noise (59.50%), three is 5.00%, four is 0.30%
 * and the reference bots never reach five — but the bots also never chase
 * it, and 🎟️ Season Ticket rerolls the year on purpose, so the human rate
 * runs above the measured one for whoever wants it. Four is the rung where
 * the cohort is a decision rather than a coincidence. */
const SAMEYEAR_COUNT = 4;
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

/** 🪙 LEAGUE MINIMUM's price, and how many seats have to carry it.
 *
 * The price is the league minimum this card set actually has, and it is
 * era-shaped rather than flat. Measured off `cost` in data/cards: the cheapest
 * season available is $1.6M in 1985, $1.1–1.4M through 1991, and $1.0M from
 * 1992 on. A rung written at $1.0M would be unreachable for a mid-eighties
 * seat that IS at its league minimum, so the price is the HIGHEST floor in the
 * window rather than the lowest. It buys 42.1% of the set's 35,720
 * player-seasons, against 20.5% at $1.0M.
 *
 * Four is the rung. Measured over 4,000 reference seasons (study 17): three
 * seats is 35.13%, which is the shape a club lands on without meaning to; four
 * is 10.22%, beside 🔮 CRYSTAL BALL (9.60), 🧢 (9.91) and 📆 (9.43); five is
 * 1.35%, a coin that rarely comes up. Same ladder that picked AGE_COUNT and
 * DECADE_COUNT — the rung is the one that is neither an accident nor a myth.
 * The mean club carries 2.17 of them.
 *
 * The count includes a 🏠 Homegrown seat, which is signed at a flat $1M and is
 * therefore at the minimum by construction. That is at most ONE seat, because
 * the powerup is one-shot, and the badge is not a Homegrown badge in disguise:
 * counting only seats NOT signed at the flat price the reference arm lands
 * four 2.33% of the time — but the VANILLA arm, which has no Homegrown at all,
 * lands four 15.65% of the time, half again as often as the reference arm
 * does. The powerups are mostly spent making a club richer (a reroll shops for
 * a bigger bankroll), so the arm that has them buys fewer minimum men, not
 * more.
 *
 * Exported for the reason CROWN_WINS and WORST_WINS are: the price is a claim
 * about data/cards, and badges-supply.test.ts pins it against the cards
 * themselves so a regen that raises a year's floor above it fails there rather
 * than quietly locking one era out of the badge. */
export const MINIMUM_M = 1.6;
export const MINIMUM_SEATS = 4;

/* ---- the two position badges, and why they are keyed to `pos` ----
 *
 * 🚒 THE FIREMAN and 🧤 THE FIELD GENERAL both ask the same question about a
 * payroll — which seat did the club spend the most on — and answer it for the
 * two positions nobody spends on.
 *
 * They read `pos`, the position the card prints, rather than the SLOT the man
 * sits in. The two are not the same thing: eligibility.ts fills the C seat
 * from anyone with ten games behind the plate, so a man listed at C can sit in
 * IF or FLEX and a man listed at 1B can sit at C. `pos` is what the player is
 * looking at when they sign him, so it is what the badge counts. The RP seat
 * is the one place the two readings coincide — it takes `pos === "RP"` and
 * nothing else — so a full club holds exactly one reliever, measured at
 * 100.00% over 8,000 bot seasons.
 *
 * The comparison is a STRICT maximum, and that is not a detail: 20.5% of the
 * set's player-seasons cost exactly $1.0M, so ties at the bottom of the market
 * are the common case, and a `>=` reading would hand a club of eight
 * minimum-salary men every position badge at once. A tie at the top counts for
 * nobody — measured at 0.45% of full reference clubs.
 *
 * They do NOT share a tier, and the split is forced rather than chosen. 🧤 is
 * 7.35% and 🚒 is 1.07%, six and a half times apart, and the bands cannot be
 * made to meet: sending 🧤 to `ultra` would make the ultra band's ceiling 7.35
 * against 🏭 COMPANY TOWN's 1.90 rare floor, which is the disjointness
 * badges.test.ts pins and the 🧓/🍼 pair stands on; sending 🚒 to `uncommon`
 * would seat a 1% badge in a band whose floor is 5%. Same conclusion 📆 and
 * 🕰️ reach from the other direction — one idea, two ends, too far apart in
 * frequency to render as one thing.
 *
 * Neither is an anti-trophy. The relief seat is the weakest on the field (no
 * relief season in the set reaches 8.0 WAR; see the ceiling note beside
 * GOLD_WAR), so paying the most for it looks like a misallocation — and over
 * 4,000 reference seasons it costs nothing measurable: the catcher's clubs
 * score 138.54 against the population's 136.78 at n = 294, and the reliever's
 * 138.06 at n = 43, which is a sample too small to say more than "no visible
 * penalty". Neither shape is a mistake; the catcher's side is the better
 * supported of the two.
 *
 * The shape 🚒 actually names is worth recording, because it is not the one
 * the label suggests. The priciest seat on a typical club costs $44.53M and
 * returns 7.36 WAR; on a club whose reliever tops the payroll it costs $29.52M
 * and returns 2.60. So the badge is rarely "you paid a fortune for a closer"
 * and usually "nobody on this club cost very much, and the closer cost the
 * most of them" — a flat payroll with a bullpen at the top of it. That is a
 * real and rare club, and it is the honest reading of the number. */

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
 * is where the reason this set has no ALL-GOLD badge lives. 🔪 counts stars
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
 * on any one man. The `how` names the class (MLB gambling suspensions) rather
 * than each man's individual status, which dates quickly and cannot be
 * summarized without risking an assertion of guilt on open cases.
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

/** The consensus true submariners of the 1985–2025 card window — the men who
 * released the ball from below the hip, knuckles an inch off the mound dirt.
 *
 * The line the list draws is submarine, not sidearm, and it is drawn on
 * purpose: the low-slot sidearmers a broadcast calls "submariners" on a loose
 * day — Pat Neshek, Joe Smith, Steve Cishek, Mike Myers, Peter Moylan, Tim
 * Hill — are deliberately excluded, and hold a club of their own below
 * (🐍 SIDEWINDERS). Sidearm is a slot; submarine is a
 * different delivery, and diluting the club to "threw kind of low" would make
 * the badge a count of funky relievers rather than a sighting of a genuinely
 * rare animal. Every id here is the consensus reading of the delivery, not a
 * measured release height — the dataset carries no arm-angle field, so the
 * list is curated the way 💊 and 🎲 are, and badges-supply pins that each man
 * is still on a card. */
export const SUBMARINERS: ReadonlySet<string> = new Set([
  "tekulke01", // Kent Tekulve — PHI/PIT/CIN, 1985–89
  "quiseda01", // Dan Quisenberry — KCR/STL, 1985–89
  "bradfch01", // Chad Bradford — CHW/OAK/BOS/NYM/BAL/TBR, 1998–2008
  "zieglbr01", // Brad Ziegler — OAK/ARI/BOS/MIA, 2008–18
  "kimby01", // Byung-Hyun Kim — ARI/BOS/COL/FLA, 1999–2007
  "rogerty01", // Tyler Rogers — SFG/NYM, 2020–25
  "meredcl01", // Cla Meredith — SDP/BAL, 2006–09
  "cimbead01", // Adam Cimber — CLE/SDP/MIA/TOR/LAA, 2018–24
  "odayda01", // Darren O'Day — LAA/NYM/TEX/BAL/ATL, 2008–22
]);

/** The low-slot sidearmers the submarine club's comment turns away — the men a
 * broadcast calls "submariners" on a loose day. Splitting them out keeps both
 * lists honest: 🤿 stays a sighting of a genuinely rare animal, and the
 * likeliest bad edit to it — a well-meaning addition of one of these names —
 * has somewhere correct to go instead. Curated the way SUBMARINERS is, on the
 * consensus reading of the delivery rather than a measured release height (the
 * dataset carries no arm-angle field), and badges-supply pins that each man is
 * still on a card and that the two clubs never share a member. */
export const SIDEWINDERS: ReadonlySet<string> = new Set([
  "neshepa01", // Pat Neshek — MIN/SDP/OAK/STL/HOU/COL/PHI, 2006–18
  "smithjo05", // Joe Smith — NYM/CLE/LAA/CHC/TOR/HOU/SEA/MIN, 2007–22
  "cishest01", // Steve Cishek — FLA/MIA/STL/SEA/TBR/CHC/CHW/LAA/WSN, 2011–22
  "myersmi01", // Mike Myers — DET/MIL/COL/ARI/BOS/SEA/NYY/CHW, 1996–2007
  "moylape01", // Peter Moylan — ATL/KCR, 2007–18
  "hillti01", // Tim Hill — KCR/SDP/CHW/NYY, 2018–25
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
    // The peak, and the peak is a secret. See `secret` on BadgeDef: a locked
    // slot reading "👑 BEST RECORD OF ALL TIME" spends the surprise the top of
    // the ladder exists to deliver, on a case where nothing has been found yet.
    secret: true,
    emoji: "👑",
    label: "BEST RECORD OF ALL TIME",
    name: "Best Record of All Time",
    rarity: "legendary",
    axis: "onfield",
    freq: 1.33,
    // Two records, both named. "Baseline wins" is the finale ledger's own
    // label for the row that reads `50 + WAR + skipper`, and "final record" is
    // the giant W–L stamped above it. 👑 beside a stamp that disagreed with it
    // is what the second gate exists to prevent, so the copy can say plainly
    // that both cleared 117 rather than hedging about which one counts. The
    // ledger already prints the arithmetic; this string does not repeat it.
    how: "117 baseline wins or more, and a final record that held there.",
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
    name: "Matched the 2001 Mariners",
    rarity: "ultra",
    axis: "onfield",
    freq: 0.63,
    how: "Exactly 116 baseline wins, and a final record no worse.",
  },
  {
    key: "yankees",
    secret: true,
    emoji: "🗽",
    label: "MATCHED THE 1998 YANKEES",
    name: "Matched the 1998 Yankees",
    rarity: "ultra",
    axis: "onfield",
    freq: 1.4,
    how: "Exactly 114 baseline wins, and a final record no worse.",
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
    name: "Matched the 1986 Mets",
    rarity: "rare",
    axis: "onfield",
    freq: 4.29,
    how: "Exactly 108 baseline wins, and a final record no worse.",
  },
  {
    key: "astros",
    secret: true,
    emoji: "🚀",
    label: "MATCHED THE 2022 ASTROS",
    name: "Matched the 2022 Astros",
    rarity: "rare",
    axis: "onfield",
    freq: 4.92,
    how: "Exactly 106 baseline wins, and a final record no worse.",
  },
  {
    key: "cubs",
    secret: true,
    emoji: "🐻",
    label: "MATCHED THE 2016 CUBS",
    name: "Matched the 2016 Cubs",
    rarity: "uncommon",
    axis: "onfield",
    freq: 5.95,
    how: "Exactly 103 baseline wins, and a final record no worse.",
  },
  {
    key: "redsox",
    secret: true,
    emoji: "🧦",
    label: "MATCHED THE 2004 RED SOX",
    name: "Matched the 2004 Red Sox",
    rarity: "uncommon",
    axis: "onfield",
    freq: 4.99,
    how: "Exactly 98 baseline wins, and a final record no worse.",
  },
  {
    // The one rung on the axis that is NOT secret, and the reason the rest can
    // be: a locked case still names a hundred wins, so the ladder has a
    // direction. Everything above this rung is a discovery.
    key: "hundred",
    emoji: "💯",
    label: "100-WIN CLUB",
    name: "100-Win Club",
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
    name: "Don't Quit Your Day Job",
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
    how: "An 0–162 season on the record the finale stamps.",
  },
  {
    key: "worst",
    emoji: "📉",
    label: "WORST RECORD OF ALL TIME",
    name: "Worst Record of All Time",
    rarity: "ironic",
    axis: "onfield",
    ironic: true,
    freq: 0,
    how: "40 wins or fewer on the record the finale stamps.",
  },
  {
    key: "skull",
    emoji: "💀",
    label: "100-LOSS CLUB",
    name: "100-Loss Club",
    rarity: "ironic",
    axis: "onfield",
    ironic: true,
    freq: 0,
    how: "100 losses or more on the record the finale stamps.",
  },
  /* The hole the stamped-record gate leaves, filled. `onFieldBadge` awards
   * NOTHING when a baseline earns a rung and the stamp cannot hold it — the
   * rung is vetoed rather than dropped, for the reasons written out beside
   * that function — so a club worth 106 wins on the field that taxes itself
   * back to 94 clears no rung at all. This is the anti-trophy for exactly that
   * season, and nothing else can reach it: it is
   * the LAST arm of the same else-chain, under 👔 / 📉 / 💀, so a club whose
   * stamp sank far enough to post a record low still reads 📉. The axis stays
   * exclusive, and the ladder's own ordering is untouched.
   *
   * `ironic`, because a 106-win club that scored 94 is a joke told by the
   * ledger rather than an achievement. Not `secret` — no badge in this file
   * carries both, and an anti-trophy already wears an anonymized locked slot.
   *
   * The over-the-payroll gate is measured rather than assumed. A stamp can
   * fall below its baseline without a tax — the payroll bonus bottoms out at
   * −10 — but of every club that lost a rung across 8,000 bot seasons (study
   * 17), 5 of 5 were past the cap. The gate makes the label and the copy
   * exactly true and costs nothing that was ever observed; without it the
   * measured rate is the same number to two decimal places.
   *
   * 0.03% is one season in 4,000, and it is low for the reason 👔, 📉, 💀, 🧾,
   * 🕸️ and 🏖️ all read zero: the reference arm treats the cap as a hard
   * feasibility gate, so it almost never busts a payroll on purpose. The arm
   * that does bust one lands this five times as often — study 17's overspend
   * arm crosses the cap whenever the WAR pays for it and reads 0.15% — and
   * study 14 measures the same clubs from the other side. A player who signs
   * the roster first and reads the bill afterwards is the population this is
   * for. The one reference season that earned it was worth 117 baseline wins
   * and stamped 115: it lost 👑 by two. */
  {
    key: "taxed",
    emoji: "💳",
    label: "THE BILL CAME DUE",
    name: "The Bill Came Due",
    rarity: "ironic",
    axis: "onfield",
    ironic: true,
    freq: 0.03,
    how: "Baseline wins worth a badge, a payroll past the cap, and a final record too low to keep it.",
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
    name: "Perfect Season",
    rarity: "legendary",
    axis: "goal",
    freq: 1.01,
    how: "Stamped a perfect 162–0.",
  },
  /* Keyed to BASELINE WINS against the dream club — the talent comparison,
   * not the ledger. "Beat the dream team" is a claim about out-BUILDING a
   * club: more expected wins from WAR and the skipper than the best club
   * your own cards could field. The whole-ledger comparison is 🦉's alone
   * (through the stamp press); when both badges read the total they were one
   * claim at two strictnesses, and the owner split them (round twelve) so
   * each names its own feat. The axis stacks, so a season can honestly earn
   * this, 🏆 and 🦉 together.
   *
   * It is deliberately NOT on `scout`. That axis is exclusive and asks how
   * many of the dream club's picks you found; this asks whether your club
   * OUT-TALENTED theirs, which a club that matched almost none of their
   * picks can do. 🌠 and 🔮 measure agreement, this measures the roster.
   *
   * Not `secret`, unlike 🌠 above it. The finale prints both clubs' win
   * values on screen, so the target is not a secret to give away — naming
   * the badge is the direction the case owes a player who has read the dream
   * team's column and wondered whether it can be out-built.
   *
   * Measured under the new rule in study 20 (2,000 reference games, classic +
   * all powerups): 11.20%, against the old total-comparison's 2.50% — which
   * moved the badge down a tier, rare → uncommon (📆 ALL-DECADE TEAM's own
   * 9.43% band). The gap between the two rules is the measurement's finding:
   * the solver maximizes POINTS under budget, so a WAR-first club out-BUILDS
   * the point-optimal solve far more often than it out-SCORES it — awards,
   * pedigree and the payroll bonus are most of the ceiling's edge. That is
   * exactly why the split reads: this rung is the roster, 🦉 is the ledger.
   *
   * One solvency gate rides the roster claim (beatDreamDecision): the final
   * total must sit above the club's own baseline, or blowing past the luxury
   * tax to stack WAR the solver's budget can't touch would farm the badge
   * with a season that finished underwater. The `how` line stays as written —
   * the claim is unchanged; the gate only refuses the degenerate build. */
  {
    key: "beatdream",
    // 📝 with the round-34 rename: the claim lives on paper now, and 🧠
    // belonged to the old out-thinking framing. Same single code point, so
    // the share line's width ledger is untouched.
    emoji: "📝",
    // "Better on paper", not "beat the dream team": the claim is about
    // BASELINE wins — talent on paper — not the final ledger, and the old
    // label collided with 🌠 THE DREAM TEAM, which is a scout-agreement
    // claim. The key stays: it is storage, not copy.
    label: "BETTER ON PAPER",
    name: "Better on Paper",
    rarity: "uncommon",
    axis: "goal",
    freq: 11.2,
    how: "More baseline wins than the best club your cards could field.",
  },
  /* The peak of the goal axis: outscoring the solver's own theoretical
   * ceiling, not merely the dream team it printed. The ceiling is the best
   * the solver can find given the cards in play; exceeding it requires that
   * the cards contain something the solver's model missed — most commonly a
   * Double Play pairing that lets one dominant card fill two seats.
   *
   * `secret` for 👑's reason: the reward is the discovery, not the target.
   * Named OUTSCOUTED rather than anything money-flavored: "moneyball" is
   * already the OAK-2002 payroll mode's id, and a badge sharing that word
   * would read as a mode reward instead of what it is. */
  {
    key: "outscouted",
    secret: true,
    emoji: "🦉",
    label: "OUTSCOUTED",
    name: "Outscouted",
    rarity: "legendary",
    axis: "goal",
    freq: null,
    how: "Outscored the finale's own ceiling — the best total it could find in your cards.",
  },
  /* The goal axis's anti-trophy: the cards on the table could have stamped a
   * perfect 162–0 — the solver's own ceiling rounds to the full record — and
   * the club that got built didn't. Keyed to the STAMPED record on both
   * sides, through the same `recordFromTotal` the finale prints with: the
   * claim is about the record a player can see, exactly the floor rungs'
   * rule. A season that stamps 162–0 itself can never earn it, whatever the
   * margin between the two totals.
   *
   * `ironic` and therefore anonymous while locked, for 💀's reason — an
   * anti-trophy's name is an invitation to farm it, and "go find a perfect
   * board and lose it" inverts the one instinct the game wants.
   *
   * Study 18 (2,000 games/arm, medal-aware solver and bots): in the
   * reference population a perfect board turns up in 15.15% of games and the
   * bots convert 0.45%, so the badge fires at 14.70% — common as
   * anti-trophies go, and honestly so: with all six powerups the cards
   * regularly hold a perfect club nobody builds. Vanilla classic the board
   * is perfect 0.20% of the time; Moneyball's $51.5M cap almost forecloses
   * it (0.45% with powerups, 0.00% without). */
  {
    key: "gotaway",
    ironic: true,
    emoji: "🎣",
    label: "THE ONE THAT GOT AWAY",
    name: "The One That Got Away",
    rarity: "ironic",
    axis: "goal",
    freq: 14.7,
    how: "A perfect 162–0 was on the table, and the club let it get away.",
  },
  /* The counterfactual the payroll box invites all game: the club won big
   * without ever needing more than the $51.5M the 2002 A's played under.
   *
   * The result bar is the finale's own gold stamp — the color the record
   * prints (the floor rungs' rule), read through `recordFromTotal` like
   * 🎒's. "Would've WON Moneyball" is a claim about the season the screen
   * shows, and 95 baseline wins is merely a good one: a gold record on the
   * A's money is the feat the name promises. 🤏 keeps the 95-baseline bar at
   * the club's OWN cap, so the two measure different denominators AND
   * different bars, and a club can hold either without the other. This one
   * sits on `goal` and stacks rather than joining the exclusive payroll
   * chain: its benchmark is a season-against-a-target claim, not a fourth
   * face of the club's own payroll.
   *
   * 📈 rather than the elephant: 🐘 is Moneyball's own mode face, and
   * mode emojis stay out of the badge set (share.test's one-emoji-one-meaning
   * rule) — the KEY keeps the white-elephant name, the Athletics' own symbol,
   * where no glyph collision applies. The chart is the sabermetric claim
   * itself: value per dollar. The LABEL names Moneyball because the
   * counterfactual is the point; the key stays clear of the mode id
   * (🦉's naming note above).
   *
   * `banks` lists the two banks that can earn it. Under Moneyball itself the
   * trigger's own gate refuses — not a mechanics impossibility like Clean
   * House's, but the same display consequence: under a Moneyball lens the
   * trophy case must not show a silhouette that cannot be aimed at. */
  {
    key: "elephant",
    emoji: "📈",
    label: "WOULD'VE WON MONEYBALL",
    name: "Would've Won Moneyball",
    // `ultra`, not `legendary`: the top tier is membership by axis-maximum
    // (RARITY_ORDER's note), and the goal axis's maximum is 💰. A gold season
    // on the A's money is a rarity claim — the strongest kind, since the gold
    // stamp alone is a ~4% event before the spend gate bites.
    rarity: "ultra",
    axis: "goal",
    banks: ["classic", "blankcheck"],
    freq: null,
    how: "A gold final record, spending no more than Moneyball's $51.5M.",
  },

  // ---- payroll: exactly one fires ----
  {
    key: "farm",
    // 🚜, not 💸: the money-with-wings is the Blank Check bank's face, and a
    // share string can carry a bank emoji on its title line and badge emoji
    // on its last — one glyph meaning two things in one string. The tractor
    // IS the farm, and no other surface spends it.
    emoji: "🚜",
    label: "MORTGAGED THE FARM",
    name: "Mortgaged the Farm",
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
    name: "Spent Every Dime",
    // Rare since the trigger moved to the raw dollars: the old rounded gate
    // really fired from 99.25% and measured 4.98 (uncommon); the strict
    // 99.5% the copy states measures 3.60 (study 21), inside the rare band.
    rarity: "rare",
    axis: "payroll",
    freq: 3.6,
    how: "Spent 99.5% or more of your payroll, without going over.",
  },
  {
    key: "pinch",
    emoji: "🧮",
    label: "PINCHED EVERY PENNY",
    name: "Pinched Every Penny",
    rarity: "rare",
    axis: "payroll",
    freq: 2.33,
    how: "95 baseline wins or more on half your payroll or less.",
  },
  {
    key: "pocket",
    emoji: "🧾",
    label: "POCKETED THE DIFFERENCE",
    name: "Pocketed the Difference",
    rarity: "ironic",
    axis: "payroll",
    ironic: true,
    freq: 0,
    how: "Left 40% of your payroll unspent and still finished under .500 on baseline wins.",
  },

  // ---- scouting: exactly one fires, the exact match superseding the near miss ----
  /* 🌠 sits on the `scout` axis rather than beside it, and the axis being
   * exclusive is the whole design: nine of nine IS seven-or-more, so a bare
   * second `if` would hand a perfect scouting game both pills and spend two of
   * the finale's four slots saying one thing twice. The chain gives the top of
   * the axis the slot and 🔮 keeps everything under it, exactly the way 👑
   * supersedes a named rung.
   *
   * `legendary` for the reason 👑 and 🏆 are: it is the top of an axis, not a
   * rare event on one. `secret` for the same reason again — the ladder's peaks
   * are the surprise the case exists to deliver, and a locked slot reading
   * "🌠 THE DREAM TEAM" spends it before anyone has played for it. It is also
   * a fact about a club nobody can see until the finale, so naming it would
   * advertise a target the draft screen gives no way to aim at.
   *
   * The exactness is load-bearing twice over. `scoutHits === 9` alone is a
   * badge a five-card game could earn with five hits against a five-seat dream
   * club, which is why `dreamSeats === 9` is asked first: the club has to have
   * been a full club before matching it means anything. */
  {
    key: "dreamteam",
    secret: true,
    emoji: "🌠",
    label: "THE DREAM TEAM",
    name: "The Dream Team",
    rarity: "legendary",
    axis: "scout",
    // Null for the 🔮 population's own reason inverted. Study 10 measures the
    // hit DISTRIBUTION under bot arms that maximize WAR at every pick, and 🔮
    // at seven fires 9.60% there — but nine of nine is the tail of that
    // distribution rather than a point on it, and a greedy solver's tail is an
    // upper bound on a player's, not an estimate of it. The number belongs in
    // a study report, not in a field that documents itself as the rate in the
    // reference population.
    freq: null,
    how: "Matched the dream team's whole club, all nine seats.",
  },
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
    name: "Crystal Ball",
    rarity: "uncommon",
    axis: "scout",
    freq: 9.6,
    how: "Drafted seven or more of the players the dream team wanted.",
  },
  /* The scout axis's other pole: nine chairs filled, ZERO of them the dream
   * club's. Sharing 🌠's axis and its gates is the design — the same
   * nine-seat dream club (`dreamSeats === 9`), the same "the club has to be
   * whole" rule (full roster AND a hired skipper, since an empty dugout
   * misses the ninth seat by forfeit rather than by conviction). Zero and
   * nine are the two ends of one agreement scale, and the case shows both
   * ends as feats.
   *
   * `secret` for 🌠's own reason: the dream club is invisible until the
   * finale, so a locked slot naming total disagreement advertises a target
   * the draft screen gives no way to aim at. Not `ironic` — a club that
   * shares nothing with the optimizer and still posts a season is a
   * conviction badge, not a citation.
   *
   * `freq` null for 🌠's reason inverted: the study bots maximize WAR at
   * every pick, which CORRELATES them with the dream club — a bot's
   * zero-overlap rate is a lower bound on a player's, not an estimate. */
  {
    key: "maverick",
    secret: true,
    emoji: "🧭",
    label: "WENT MY OWN WAY",
    name: "Went My Own Way",
    rarity: "rare",
    axis: "scout",
    freq: null,
    how: "Filled all nine seats without a single dream-team pick.",
  },


  // ---- roster shape: these stack ----
  {
    key: "allstars",
    emoji: "🏅",
    label: "ALL-STAR ROSTER",
    name: "All-Star Roster",
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
    name: "The Two-Way Guy",
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
    name: "No Scrubs",
    rarity: "rare",
    freq: 3.04,
    axis: "roster",
    how: "Every player on the roster posted 4.0 WAR or better.",
  },
  {
    key: "topheavy",
    emoji: "⛰️",
    label: "STARS AND SCRUBS",
    name: "Stars and Scrubs",
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
    name: "No Drop-Off",
    rarity: "rare",
    axis: "roster",
    freq: null,
    how: "Every seat at 3.0 WAR or better, and all within 4.0 WAR of each other.",
  },
  {
    key: "gold",
    // 🔪, not 🌟: the name is the 1927 Yankees' — a lineup of killers — and
    // a star said "great club", which is what half the badge set already
    // says. The knife says the name.
    emoji: "🔪",
    label: "MURDERERS' ROW",
    name: "Murderers' Row",
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
  /* 🎒 CARRIED HIM — a gold final record with a below-replacement seat
   * aboard. Murderers' Row's inversion: that badge counts the great seats,
   * this one notices the club won gold anyway with a seat that cost it wins.
   *
   * Always co-fires with 🕳️ BELOW REPLACEMENT — the same seat, two
   * verdicts: the citation for wasting it and the brag for winning gold
   * anyway (the ✊/🚫 arrangement: opposite claims about one fact, both
   * true, so one club can carry both).
   *
   * The STAMP, not the baseline — "gold record" is the color the finale
   * prints (the record ladder's 155-win top band), and the claim is that the
   * screen said gold while one seat pulled the other way. Read through the
   * same `recordFromTotal` press the finale stamps with, the floor rungs'
   * rule.
   *
   * `secret` for 🃏's reason: named on a locked slot it is an instruction
   * to go sign a bad player, and discovering that the club carried one is
   * the reward. `ultra` by judgment: a gold stamp is 4.2% of strong-play
   * games and a negative seat is exactly what strong play avoids, so the
   * intersection is a real feat — but no bot arm signs negative WAR on
   * purpose, so there is no measured population behind it. */
  {
    key: "carried",
    secret: true,
    emoji: "🎒",
    label: "CARRIED HIM",
    name: "Carried Him",
    rarity: "ultra",
    axis: "roster",
    freq: null,
    how: "A gold record with a below-replacement player on the club.",
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
    name: "Hardware Store",
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
    name: "Cooperstown Class",
    rarity: "uncommon",
    axis: "roster",
    freq: null,
    how: "Four Hall of Famers, counting the skipper.",
  },
  {
    // `secret` for a reason that is unusual in this table: nothing in the app
    // shows a player's birth country. Not the market rows, not the roster
    // rail, not the finale. So this is not a badge a player can aim at even in
    // principle — the fact is invisible until it is already collected — and a
    // named locked slot reading "🌎 WORLD TOUR" would advertise a target
    // the UI gives no way to hunt. That is the exact case `secret` exists for.
    key: "worldtour",
    secret: true,
    emoji: "🌎",
    label: "WORLD TOUR",
    name: "World Tour",
    rarity: "rare",
    axis: "roster",
    freq: null,
    how: "Eight players born in five different countries.",
  },
  {
    key: "rings",
    emoji: "💍",
    label: "RING BEARERS",
    name: "Ring Bearers",
    rarity: "ultra",
    axis: "roster",
    freq: 1.48,
    how: "Four or more players wearing a World Series ring.",
  },
  /* 💍's shadow: a club built out of the men who got to the last day and lost.
   * The gates are as much of the badge as the count — three near-misses with a
   * ring anywhere on the roster is just a decorated club, so a single ring or
   * a single WBC gold takes the badge away, and pennants and WBC silvers pool
   * into one count because "lost the final" is one experience wearing two
   * uniforms. NOT secret, unlike the family badges beside it: the pennant and
   * medal glyphs are printed on the market rows and the finale, so this is a
   * club a player can actually assemble on purpose — a named locked slot is a
   * direction the UI backs up, which is exactly the chaseable case the secret
   * doctrine leaves named. */
  {
    key: "bridesmaid",
    emoji: "💐",
    label: "ALWAYS THE BRIDESMAID",
    name: "Always the Bridesmaid",
    rarity: "rare",
    axis: "roster",
    // Unmeasured: the fact fields are new and no bot study has run over them.
    // Run one before writing a number here.
    freq: null,
    how: "3 or more pennants or WBC silvers, no rings, no golds.",
  },
  {
    key: "brothers",
    emoji: "👬",
    label: "BROTHERLY LOVE",
    name: "Brotherly Love",
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
    name: "Like Father, Like Son",
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
    name: "Family Reunion",
    rarity: "ultra",
    axis: "roster",
    secret: true,
    freq: null,
    how: "Signed three brothers from one family.",
  },
  {
    // `secret` for 🌎 WORLD TOUR's reason: nothing in the app shows a
    // pitcher's arm angle. Not the market rows, not the roster rail, not the
    // finale — the fact is invisible until the badge is already collected, so
    // a named locked slot would advertise a target the UI gives no way to
    // hunt. The club itself is SUBMARINERS, curated above.
    key: "submarine",
    secret: true,
    emoji: "🤿",
    label: "FROM DOWN UNDER",
    name: "From Down Under",
    rarity: "rare",
    axis: "roster",
    // Unmeasured: the list is new and no bot study has run over it. Run one
    // before writing a number here.
    freq: null,
    how: "Signed a submarine pitcher.",
  },
  {
    // `secret` for 🤿's reason, which is 🌎 WORLD TOUR's: nothing in the app
    // shows a pitcher's arm angle. Not the market rows, not the roster rail,
    // not the finale — the fact is invisible until the badge is already
    // collected, so a named locked slot would advertise a target the UI gives
    // no way to hunt. The club itself is SIDEWINDERS, curated above.
    key: "sidewinder",
    secret: true,
    emoji: "🐍",
    label: "SIDEWINDERS",
    name: "Sidewinders",
    rarity: "rare",
    axis: "roster",
    // Unmeasured: the list is new and no bot study has run over it. Run one
    // before writing a number here.
    freq: null,
    how: "Signed a sidearm pitcher.",
  },
  {
    key: "playermanager",
    secret: true,
    emoji: "📋",
    label: "PLAYER-MANAGER",
    name: "Player-Manager",
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
    name: "Pushed the Right Buttons",
    rarity: "uncommon",
    axis: "roster",
    freq: 9.91,
    how: "Hired a Manager of the Year and finished above 105 baseline wins.",
  },
  /* The dugout out-earning the whole field, and the exchange rate that makes
   * it a real question rather than a formality. A skipper is worth
   * (W − L) × MANAGER_PER_NET_WIN in WINS, i.e. 0.2 apiece: the best card in
   * the set, Lou Piniella's 116–46 Mariners, is worth 14.0, the worst — Pedro
   * Grifol's 41–121 White Sox — is worth −16.0, and a .500 dugout is worth
   * nothing at all. Half the cards in the set are on the wrong side of that.
   *
   * So the badge asks a top-decile dugout to beat a whole draft's best pick.
   * Measured over 4,000 reference seasons (study 17): the median skipper is
   * worth 4.0 wins and the median club's best seat posts 9.6 WAR, and the two
   * cross 8.63% of the time. The ninetieth-percentile skipper is worth 9.0,
   * which is roughly where the crossing starts.
   *
   * It reads the club's BEST season, never the roster's total. Against the
   * total it is not a rare badge, it is an impossible one — 0.00% across
   * 8,000 seasons, because no dugout in the set is worth what eight men are.
   *
   * Both gates hold weight the measurement cannot show. `full` is 🏅's gate:
   * "more than any player" over a club with two seats filled is a claim about
   * a club that does not exist. Strictly positive is what keeps this a trophy
   * rather than an accidental anti-trophy — a −16-win skipper over eight
   * negative-WAR seats also beats every seat on the roster, and that club has
   * earned 👔, not this. Every bot club is full and every bot skipper who
   * clears the roster is a winning one, so both gates measure identically in
   * the harness and neither is removable.
   *
   * That positive test also makes 🫡 and 🪑 THE INTERIM exclusive BY
   * CONSTRUCTION, the way ⚖️/⛰️ and 🕶️/🙈 are: both read `managerNetWins`,
   * 🫡 wants it above .500 and 🪑 wants it below, so no resolver is needed and
   * both stay on the stacking `roster` axis. One skipper cannot be the reason
   * a club won and the chair nobody wanted. */
  {
    key: "fearless",
    emoji: "🫡",
    label: "FEARLESS LEADER",
    name: "Fearless Leader",
    rarity: "uncommon",
    axis: "roster",
    freq: 8.63,
    how: "Your skipper was worth more wins than any player on the roster.",
  },
  /* 🧢's opposite number, and the dugout's version of the gamble 🕶️ names on
   * the payroll. The club is built, every other seat is filled, and the last
   * spin has to produce a skipper out of whatever card the reel deals — so
   * this is the badge for finding out that the only chair left came with a
   * losing record attached.
   *
   * It reads a MOMENT, not the finished club. `managerLast` is written when
   * the hire happens, because by the finale a full club with a manager in it
   * looks the same whichever order the seats filled — the identical problem
   * `ownerLast` solves and the identical solution. The engine's note beside
   * `managerHiredLast` carries which paths write it.
   *
   * `ironic` and not `secret`: an anti-trophy already wears an anonymized
   * locked slot, and no badge in this file carries both flags — the
   * anonymizing predicate treats either one as sufficient.
   *
   * The .500 line is the skipper's own (W − L), never the club's stamp. The
   * stamp folds in eight roster seats, awards, rings and the payroll bonus, so
   * a losing stamp is a verdict on the whole club; this badge is about the one
   * chair the player ran out of spins to shop for. */
  {
    key: "interim",
    emoji: "🪑",
    label: "THE INTERIM",
    name: "The Interim",
    rarity: "ironic",
    axis: "roster",
    ironic: true,
    // Null for the 🕶️ reason: every bot arm carries its own front-office
    // policy, and when to take the manager IS that policy — a measured rate
    // would describe the arm's patience rather than the badge's difficulty.
    freq: null,
    how: "Left the dugout to the final spin and hired a losing manager.",
  },
  /* 🎒's inverse for the dugout: the roster carried the chair. 🫡's exact
   * mirror — that one asks whether the skipper out-earned every seat, this
   * one whether every seat out-earned the skipper — and the two are exclusive
   * by arithmetic, since strict inequalities cannot hold both ways at once.
   * Deliberately NO losing-record gate (the owner's call): a winning skipper
   * on a club of stars is still the least valuable man aboard, and that is
   * the whole observation. It can co-fire with 🗿 when the chair's season is
   * dead even and every seat is positive; the claims differ (a comparison
   * against the club vs an exact record) and both stack on `roster`.
   *
   * `freq: null` for 🪑's reason: whether the skipper is worth 1 win or 7 is
   * a fact about which manager the arm chose to hire, so a measured rate
   * would describe the bots' dugout policy rather than the badge. */
  {
    key: "ride",
    emoji: "🎫",
    label: "ALONG FOR THE RIDE",
    name: "Along for the Ride",
    rarity: "uncommon",
    axis: "roster",
    freq: null,
    how: "Every player on the roster was worth more wins than the skipper.",
  },
  /* The exact-record cousin of the dugout pair: not a winner (🫡's chair),
   * not a liability (🪑's), but a chair worth precisely nothing. An exact
   * equality like MATCHED THE 2004 RED SOX, and hunt-able the same way: 27
   * of the 1,188 cards carry a dead-even manager season, so the badge is a
   * deliberate hire, not an accident. Exclusive with 🫡 and 🪑 by arithmetic
   * (their gates want the same number strictly positive or negative).
   *
   * `freq: null` for the reason above — the bots' EV-driven dugout policy
   * prices a 0.0-win chair at nothing and never hires one. */
  {
    key: "figurehead",
    emoji: "🗿",
    label: "THE FIGUREHEAD",
    name: "The Figurehead",
    rarity: "rare",
    axis: "roster",
    freq: null,
    how: "Hired a skipper whose own season was dead even, with as many wins as losses.",
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
    name: "Old Heads",
    rarity: "ultra",
    axis: "roster",
    freq: 0.95,
    how: "Three players aged 35 or older.",
  },
  {
    key: "youngguns",
    emoji: "🍼",
    label: "YOUNG GUNS",
    name: "Young Guns",
    rarity: "ultra",
    axis: "roster",
    freq: 1.73,
    how: "Three players aged 23 or younger.",
  },
  {
    key: "division",
    emoji: "🗺️",
    label: "RAIDED THE DIVISION",
    name: "Raided the Division",
    rarity: "rare",
    axis: "roster",
    freq: 3.83,
    how: "Five players out of one division.",
  },
  {
    key: "homefield",
    banks: ["classic"],
    emoji: "⛲",
    label: "HOME FIELD ADVANTAGE",
    name: "Home Field Advantage",
    rarity: "rare",
    axis: "roster",
    freq: 2.98,
    how: "Bought a ballpark and signed a player from that exact season.",
  },
  {
    key: "companytown",
    banks: ["classic"],
    emoji: "🏭",
    label: "COMPANY TOWN",
    name: "Company Town",
    rarity: "rare",
    axis: "roster",
    freq: 1.9,
    how: "Your owner, your ballpark, and one of your players, all from one club.",
  },
  {
    key: "franchiseplayer",
    emoji: "💎",
    label: "THE FRANCHISE PLAYER",
    name: "The Franchise Player",
    rarity: "uncommon",
    axis: "roster",
    freq: 6.47,
    // Half of what you SPENT, not half of the cap — the denominator is the
    // outlay, so a $40M man on an $80M club earns this under a $200M payroll.
    // 🚜 and 🤏 measure against the budget and say "payroll" for it; this one
    // says "spent" because that is the number it divides by.
    how: "Half of everything you spent went to one player.",
  },
  /* 💎's question asked of the two seats a payroll is never aimed at. See the
   * block beside MINIMUM_M for why both read `pos` rather than the slot, why
   * the maximum is strict, and why neither is an anti-trophy. */
  {
    key: "fireman",
    emoji: "🚒",
    label: "THE FIREMAN",
    name: "The Fireman",
    rarity: "ultra",
    axis: "roster",
    // 1.07% over 4,000 reference seasons, and the least settled number added
    // this round: the binomial SE at that rate and that n is 0.16pp, and the
    // ultra/rare band line sits at 1.5. The two context arms disagree with it
    // by far more than the SE does — 2.40% with no powerups, 1.45%
    // overspending — because the arm decides how much the top of a payroll
    // costs, and this badge is a fact about the top of a payroll. The tier is
    // worth re-reading after any change to how the bots value a seat. `rare`
    // would also put it under 🏭 COMPANY TOWN's 1.90 floor and break the band
    // disjointness the 🧓/🍼 pair stands on.
    freq: 1.07,
    how: "Your reliever was the most expensive man on the club.",
  },
  {
    key: "fieldgeneral",
    emoji: "🧤",
    label: "THE FIELD GENERAL",
    name: "The Field General",
    rarity: "uncommon",
    axis: "roster",
    // 7.35%, against 1.07% for the reliever, and the gap is SEATS rather than
    // supply — relievers are 30.3% of the set's player-seasons and catchers
    // 6.3%, which points the wrong way. The RP seat takes `pos === "RP"` and
    // nothing else, so a full club holds exactly one reliever and the badge
    // draws on one chance; a man listed at C can sit at C, in the infield or
    // at FLEX, so the catcher badge draws on several. 99.10% of full clubs
    // hold at least one man listed at catcher.
    freq: 7.35,
    how: "Your catcher was the most expensive man on the club.",
  },
  /* The priciest-seat question turned into an anti-trophy: the man the club
   * spent the most on was the worst man on it. The albatross is the contract
   * around the club's neck, so the article earns its place the way THE
   * FRANCHISE PLAYER's does — it names the one guy.
   *
   * Strict on BOTH comparisons: the seat must outcost every other seat (the
   * 🚒/🧤 tie rule — 20.5% of player-seasons cost exactly $1.0M, and a `>=`
   * would hand a club of eight minimum men the badge for free) and every
   * other seat must strictly out-WAR it, so a WAR tie favors the player and
   * the badge fails toward not firing. Full clubs only: "worst of eight" is
   * not a claim a five-man club can make.
   *
   * The rung is WORST, not "outside the top half". Study 19 (2,000 reference
   * games): the strict-priciest seat misses the club's top four 30.95% of
   * the time — that is the shape of the market rather than a mistake worth
   * naming — and is the outright worst 2.70%, which is the reading that
   * stings. The bots maximize value at every pick, so the human rate should
   * run higher, not lower. */
  {
    key: "albatross",
    ironic: true,
    emoji: "⚓",
    label: "THE ALBATROSS",
    name: "The Albatross",
    rarity: "ironic",
    axis: "roster",
    freq: 2.7,
    how: "Your most expensive man was the worst on the club.",
  },
  /* The other way to waste a seat: a player worth less than nothing. 0.0 is
   * replacement level — the exact line the game's own win math stands on
   * (50 wins plus roster WAR) — so a negative seat is the one signing that
   * subtracts wins, worse than the empty chair it filled. The bots, which
   * maximize WAR at every pick, do it in 0.30% of reference games (study
   * 19); a human signing a name they love does it rather more often, which
   * is the population this is for. No `full` gate for 🪙's reason: one
   * negative seat is one negative seat, whatever else is signed. */
  {
    key: "belowzero",
    ironic: true,
    emoji: "🕳️",
    label: "BELOW REPLACEMENT",
    name: "Below Replacement",
    rarity: "ironic",
    axis: "roster",
    freq: 0.3,
    how: "Rostered a player worth less than 0.0 WAR.",
  },
  {
    key: "minimum",
    emoji: "🪙",
    label: "LEAGUE MINIMUM",
    name: "League Minimum",
    rarity: "uncommon",
    axis: "roster",
    freq: 10.22,
    // The price is named in the copy because it is not a number a player can
    // read off any screen: the market rows print what a man costs, never what
    // the floor was that year.
    // "$1.6M or less", not "at the league minimum": $1.6M IS the minimum in
    // 1985 and the floor falls to $1.0M from 1992, so a $1.6M season out of
    // 2010 is cheap without being minimum. The threshold is the window's
    // highest floor on purpose (see MINIMUM_M) and the copy states the price
    // rather than claiming something about each man's own year.
    how: "Four players signed for $1.6M or less.",
  },
  /* Drafting against an unknown payroll — the one nerve play Open Market sets
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
    banks: ["classic"],
    emoji: "🕶️",
    label: "FLYING BLIND",
    name: "Flying Blind",
    rarity: "rare",
    axis: "roster",
    // Likely null permanently, for the 🧗 / 🧰 reason: every bot arm carries
    // its own front-office policy, and when to take the owner IS that policy.
    // A measured rate would describe the arm's patience rather than the
    // badge's difficulty. Study 11 measures it anyway; if the arms disagree
    // wildly with each other, that is the evidence the number is about them.
    freq: null,
    how: "Filled all eight seats before hiring an owner, then spent over 60% of the payroll and stayed under it.",
  },
  /* 🕶️'s other ending, and the pair is exclusive BY CONSTRUCTION rather than
   * by a resolver — the technique 🧾 POCKETED THE DIFFERENCE and 🕶️ already
   * share, recorded beside CHEAP_PCT. Both badges ask for the same club (all
   * eight seats filled before the owner was hired) and then split on one
   * comparison against one number: 🕶️ wants `spend <= budget`, this wants
   * `spend > budget`. There is no threshold to keep in sync and no ordering to
   * get right, so the two can never co-fire and say opposite things about one
   * payroll.
   *
   * The split is not a partition, and that is deliberate: a blind club that
   * came in under 60% of its payroll earns neither, because timid is its own
   * thing and 🧾 already names it. Between them 🕶️ and 🙈 cover nerve that
   * paid and nerve that did not.
   *
   * `ironic` and not `secret`, for the reason beside 🪑. */
  {
    key: "blindbust",
    banks: ["classic"],
    emoji: "🙈",
    label: "DIDN'T ASK THE PRICE",
    name: "Didn't Ask the Price",
    rarity: "ironic",
    axis: "roster",
    ironic: true,
    // Null for 🕶️'s reason — it is the same club, measured from the other
    // side of the same line, and the arm's front-office policy sets both.
    freq: null,
    how: "Filled all eight seats before hiring an owner, then finished over the payroll he turned out to have.",
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
    name: "Homegrown Superstar",
    rarity: "uncommon",
    axis: "roster",
    freq: null,
    how: "Signed an 8-WAR season for the Homegrown price of $1M.",
  },
  {
    key: "hardway",
    emoji: "🧗",
    label: "THE HARD WAY",
    name: "The Hard Way",
    rarity: "rare",
    axis: "roster",
    freq: null,
    how: "100 baseline wins without spending a single powerup.",
  },
  {
    key: "toolbox",
    emoji: "🧰",
    label: "THE WHOLE TOOLBOX",
    name: "The Whole Toolbox",
    rarity: "common",
    axis: "roster",
    freq: null,
    how: "Spent every powerup you had.",
  },
  {
    key: "nohardware",
    emoji: "🕸️",
    label: "EMPTY TROPHY CASE",
    name: "Empty Trophy Case",
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
    name: "Nobody Made the Trip",
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
    name: "Picket Line",
    rarity: "uncommon",
    axis: "era",
    freq: 19.14,
    how: "Rostered a 1994 season.",
  },
  {
    key: "covid",
    secret: true,
    emoji: "🦠",
    label: "SOCIAL DISTANCING",
    name: "Social Distancing",
    rarity: "uncommon",
    axis: "era",
    freq: 18.51,
    how: "Rostered a 2020 season.",
  },
  {
    key: "signstealing",
    secret: true,
    emoji: "🗑️",
    label: "STOLEN SIGNS",
    name: "Stolen Signs",
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
    name: "Deferred Money",
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
    name: "Crossed the Line",
    rarity: "ultra",
    axis: "era",
    freq: 0.74,
    how: "Signed a 1995 replacement player.",
  },
  {
    key: "recordbook",
    secret: true,
    emoji: "📖",
    label: "REWROTE THE RECORD BOOK",
    name: "Rewrote the Record Book",
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
    name: "The Chase",
    rarity: "rare",
    axis: "era",
    freq: null,
    how: "Signed McGwire or Sosa in 1998, or Bonds in 2001.",
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
    name: "Failed the Test",
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
    how: "Signed a player MLB suspended under its drug program.",
  },
  {
    key: "gambling",
    secret: true,
    emoji: "🎲",
    label: "BET ON BASEBALL",
    name: "Bet on Baseball",
    rarity: "ultra",
    axis: "era",
    // Eleven of the 1,188 cards can trip it, and the manager path carries most
    // of that: two of the four men have four draftable player-seasons between
    // them, against Rose's five seasons in the Reds dugout.
    freq: 1.0,
    // The label is a category — the rule on the clubhouse wall — and the `how`
    // keeps it that way: it names the class (MLB suspensions under its gambling
    // rules) without detailing each man's status, which dates quickly and
    // cannot be shortened without risking an assertion of guilt on open cases.
    how: "Signed or hired a player MLB suspended under its gambling rules.",
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
    name: "All-Decade Team",
    rarity: "uncommon",
    axis: "era",
    freq: 9.43,
    how: "Five players from the same decade.",
  },
  /* The decade badge's sharper sibling: not five from one ERA, four from one
   * SUMMER — half the roster played the same season, against each other.
   * SAMEYEAR_COUNT's comment carries the study-20 rung derivation; the short
   * version is that a pair is noise, three is a coincidence, and four is a
   * collection someone assembled — usually with 🎟️ Season Ticket doing the
   * year-hunting, which is what makes it a chase rather than a lottery. */
  {
    key: "sameyear",
    emoji: "⏳",
    label: "TIME CAPSULE",
    name: "Time Capsule",
    rarity: "ultra",
    axis: "era",
    freq: 0.3,
    how: "Four players from the same season.",
  },
  {
    key: "fortyyears",
    emoji: "🕰️",
    label: "FORTY YEARS APART",
    name: "Forty Years Apart",
    rarity: "rare",
    axis: "era",
    freq: 2.95,
    how: "Rostered seasons forty years apart.",
  },

  // ---- meta: what you did to the app, not to a club — these stack ----
  /* Five badges that read no roster, no record and no payroll. Two are about
   * where a seed came from, one is about leaving, one is about a keyboard, one
   * is about changing your mind. None of them can be earned by playing better,
   * and none of them is measurable against a bot population: no arm quits, no
   * arm types a seed, no arm has hands, and no arm takes a pick back. */
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
    name: "Packed It In",
    rarity: "ironic",
    axis: "meta",
    ironic: true,
    // No bot arm quits — every harness game runs to the finale — so there is
    // no population to measure this against.
    freq: null,
    how: "Walked out on a season in progress.",
  },
  /* The two seed badges. Both are jokes about provenance rather than facts
   * about baseball, and they are a matched pair pointed in opposite
   * directions: 📼 is what you did to yourself, 🤝 is what someone did for
   * you. */
  {
    // THE KEY IS HISTORY, THE FACE IS NOT. This badge wore ✳️ THE ASTERISK
    // from launch until the undo button earned the name better — an asterisk
    // in baseball is a tainted record, and a season with a move taken back is
    // the tainted one, not a season replayed on a known code. The ✳️ identity
    // moved to `secondthoughts` (the undo badge, below) and this one became
    // the RERUN, which is what a replayed seed literally is. The KEYS did not
    // move: history rows store keys, and re-keying either badge would orphan
    // every earned copy in every player's trophy case.
    key: "asterisk",
    // No `secret: true`. It would be redundant — BadgePill and TrophyModal's
    // anonymous predicate both treat `ironic` OR `secret` as sufficient to
    // withhold the name, and no shipped badge carries both.
    emoji: "📼",
    label: "THE RERUN",
    name: "The Rerun",
    rarity: "ironic",
    axis: "meta",
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
    name: "Word of Mouth",
    rarity: "rare",
    axis: "meta",
    // Unmeasurable for the 📼 reason: no bot arm types a seed in.
    freq: null,
    how: "Played a seed someone else gave you.",
  },
  /* The Konami code, and it does NOTHING. No extra spin, no free powerup, no
   * cheaper players, no change to any number the finale prints — the badge is
   * the entire effect, and that is deliberate: a code that altered play would
   * make every score after it unshareable, and the game's one social artifact
   * is a comparable result.
   *
   * `secret` for the doctrine's discovery case. The name is the reward here in
   * the most literal way in the file — "🎮 CHEAT CODES" on a locked slot tells
   * a player there is a code and invites them to guess it, which is the whole
   * of the thing.
   *
   * `ultra` rather than `rare`, and the reason is the platform rather than the
   * secret. This game is phone-first by every decision in its layout, and the
   * sequence is ten keystrokes on a physical keyboard: the majority of players
   * cannot enter it at all on the device they are holding. A badge whose gate
   * is "own a keyboard and know a 1986 cheat code" sits with the ultras.
   *
   * The listener lives in App.svelte and the fact lives on the Game, saved
   * with everything else — iOS Safari evicts background tabs, and a badge
   * earned by a keystroke that a reload erased would be worse than no badge. */
  {
    key: "cheatcodes",
    secret: true,
    emoji: "🎮",
    label: "CHEAT CODES",
    name: "Cheat Codes",
    rarity: "ultra",
    axis: "meta",
    // Unmeasurable for the 📼 / 🤝 reason, one step further along: a bot arm
    // drives the engine directly and never touches a keyboard at all.
    freq: null,
    how: "Entered the Konami code.",
  },
  /* The undo button, which the HUD offers openly and which takes back exactly
   * one committed move — a spin, a signing, a hire — by restoring the position
   * that stood before it, RNG cursor included, so re-doing the same thing
   * deals the same card.
   *
   * `ironic` for 📼 THE RERUN's reason rather than 🧳 PACKED IT IN's. A
   * mulligan is a joke at your own expense: the season you finished is one
   * decision less committed than the one the seed dealt you, which is the
   * same shrug 📼 makes about replaying a code you had already played. Both
   * belong beside the result and neither belongs in the progress fraction —
   * and the locked slot has to stay anonymous for 💀's reason, because "✳️
   * THE ASTERISK" printed on an empty case is an instruction to go press the
   * button, in a game whose whole shape is living with the card you were
   * dealt.
   *
   * THE ASTERISK is the undo badge's face, and it earned it over the replayed
   * seed: an asterisk in baseball is the mark on a tainted record, and the
   * season with a move taken back is the tainted one. The face moved here
   * from the replayed-seed badge (see the note on `asterisk` above); the key
   * stays `secondthoughts` because history rows store keys and a re-key
   * orphans every earned copy. */
  {
    key: "secondthoughts",
    emoji: "✳️",
    label: "THE ASTERISK",
    name: "The Asterisk",
    rarity: "ironic",
    axis: "meta",
    ironic: true,
    // Unmeasurable one step past 🎮: a bot arm drives the engine directly and
    // never presses a button at all, so every harness game runs start to
    // finish with nothing taken back. There is no population behind this.
    freq: null,
    how: "Took back a move.",
  },
  /* The instant replay — undo, then the exact same move immediately after.
   *
   * `secret: true` for 🎮's reason: "🔂 DÉJÀ VU" on an empty case tells the
   * player there is a condition they can discover, and the condition itself is
   * the reward. Always co-fires with ✳️ THE ASTERISK — a redo requires
   * an undo.
   *
   * NOT ironic, unlike its neighbor. Replaying your own move after taking it
   * back is not a joke at your expense the way a mulligan is; it is a curious
   * thing to do on purpose, and it belongs in the progress fraction as
   * something to chase.
   *
   * `rare` like 🤝 WORD OF MOUTH and for a parallel reason: both stand
   * outside the ironic cluster, both belong in the progress fraction, and
   * neither has a bot-arm population behind them — no harness game ever
   * presses undo. The label is what the player experienced (DÉJÀ VU, not
   * "the redo mechanic"), following the axis's own voice: PACKED IT IN,
   * WORD OF MOUTH, SECOND THOUGHTS.
   *
   * "Same move" is defined conservatively: kind + player id + card team +
   * card year + slot index for player picks; kind + franchise/team + year for
   * front-office picks. The card's season is in the string so a Prime re-hire
   * of a different year of the same manager into the same chair does not fire
   * falsely. */
  {
    key: "rewind",
    emoji: "🔂",
    label: "DÉJÀ VU",
    name: "Déjà Vu",
    rarity: "rare",
    axis: "meta",
    secret: true,
    // Same unmeasurability as ✳️, one gate narrower: the player also has to
    // repeat the move they just took back.
    freq: null,
    how: "Took back a move, then immediately made the same one again.",
  },
  /* The indecisive loop — three or more moves taken back in one game. It
   * used to ask for the same actionSig undone three times, but the
   * once-per-spin undo rule (engine `undoSpent`) closed the make → undo →
   * remake carousel that trigger was written for. Three rewinds across a
   * season is the same joke, still earnable — and every copy earned under
   * the old trigger was earned under a strictly harder condition, so the
   * history stays honest.
   *
   * `ironic: true` like ✳️ THE ASTERISK — it is a joke at the player's
   * expense and excluded from the progress fraction. An anonymous locked slot
   * means the player discovers it rather than farming it, matching the axis
   * voice that names the experience rather than the mechanic. */
  {
    key: "merrygoround",
    emoji: "🎠",
    label: "MERRY-GO-ROUND",
    name: "Merry-Go-Round",
    rarity: "ironic",
    axis: "meta",
    ironic: true,
    freq: null,
    how: "Took back three or more moves in one game.",
  },

  // ---- career: the log, not the season — both stack (exclusive by arithmetic) ----
  /* 🏰 THE DYNASTY — back-to-back gold. The first badge whose subject is
   * the RUN of seasons: it reads the previous finished season off the log
   * (`prevTotal`), pressed through `recordFromTotal` so the badge agrees
   * with the two finales the player actually saw. Gold is the record
   * ladder's own top band — 155 wins or better stamps in gold — so the claim
   * is "the screen said gold twice in a row", never a number of this file's
   * own.
   *
   * Named rather than secret, for 💯's reason: it is the direction the
   * case owes the player — the one badge that says seasons accumulate into
   * something. `ultra` by judgment rather than measurement (a bot arm plays
   * one game and can never earn it, so there is no population): a gold stamp
   * is 4.2% of strong-play games, and two in a row gets no help from
   * variance. */
  {
    key: "dynasty",
    emoji: "🏰",
    label: "THE DYNASTY",
    name: "The Dynasty",
    rarity: "ultra",
    axis: "career",
    freq: null,
    how: "Back-to-back seasons in the gold band.",
  },
  /* 🧱 THE REBUILD — back-to-back losing seasons, the dynasty's dark
   * twin, reading the same fact through the same press. `ironic` for 💀's
   * reason: an anti-trophy about a result, anonymous while locked because
   * its name is an instruction to go lose twice. The word is the joke — a
   * rebuild is what a front office calls it on purpose. 🧱 bricks, not the
   * crane: 🏗️ was the mode face of Open Market's "From the Ground Up" era, and mode faces stay
   * out of the badge set (share.test's one-emoji-one-meaning rule). */
  {
    key: "rebuild",
    emoji: "🧱",
    label: "THE REBUILD",
    name: "The Rebuild",
    rarity: "ironic",
    axis: "career",
    ironic: true,
    freq: null,
    how: "Back-to-back losing seasons.",
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

/** Whether a bank lens leaves this badge with no bank it can fire in — the
 * trophy case's read of `banks` above. An empty `want` is an unfiltered axis
 * (CaseFilter's own rule), which locks nothing. */
export function bankLocked(b: BadgeDef, want: readonly Bank[]): boolean {
  return want.length > 0 && b.banks !== undefined && !b.banks.some((x) => want.includes(x));
}

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
 * This function returns null on a veto, and that is what it is for. What the
 * veto costs is named elsewhere: `earnedBadges` runs 💳 THE BILL CAME DUE off
 * exactly this condition, at the bottom of the same else-chain, so a vetoed
 * club collects an anti-trophy rather than a lower rung.
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
  // The last arm, and the hole the veto above leaves. A rung picked by the
  // baseline and refused by the stamp earns nothing from `onFieldBadge`; this
  // catches that club and only that club. Asking the ladder itself — "would
  // this baseline have earned a rung on its own?" — rather than naming a win
  // total means the two can never drift apart: a rung added at 96 tomorrow is
  // covered here the day it ships.
  //
  // Under 💀, never over it. A 103 baseline taxed to a 30–132 stamp reads 📉,
  // because 30–132 is the record on the screen and the floor rungs are about
  // what the player can see. This rung is for the club that lost its badge
  // without earning a worse one.
  else if (
    f.spendM > f.budgetM &&
    onFieldBadge(f.baselineWins, f.baselineWins) !== null
  )
    out.push("taxed");

  // 🏆 reads the STAMPED record, not the raw total: the finale prints 162–0
  // for any total from 161.5 up (recordFromTotal rounds), and a screen that
  // says 162–0 — and a record book that files it as the personal best — while
  // the case withholds PERFECT SEASON is the badge calling the screen a liar,
  // the same rule that keys the floor rungs to the stamp. `recordFromTotal`'s
  // defaults are the engine's own stamp arguments, so the two reads agree to
  // the pixel. 🎣 reads the ceiling through the identical press, which keeps
  // the pair exact complements on a perfect board: one of the two always
  // fires, never both.
  if (recordFromTotal(f.total).losses === 0) out.push("perfect");
  // Stacks with 🏆 on purpose: one says the season hit the game's stated goal,
  // the other says it beat the best club those same cards could have built.
  if (f.beatDream === true) out.push("beatdream");
  // Stacks with both above: exceeding the solver's own ceiling is a strictly
  // stronger claim than hitting the goal or beating the dream team's score.
  if (f.beatCeiling === true) out.push("outscouted");
  // 🎣 — the ceiling could have stamped a perfect record and the club's own
  // stamp didn't. Both sides read through `recordFromTotal`, the finale's own
  // press: the badge is about two records a player can see, not about two
  // raw totals. `floor` is the stamp with the pre-stamp fallback, the same
  // pair the floor rungs read. Fails safe twice — an unknown ceiling
  // (`undefined`) cannot have gotten away, and a club that stamped 162–0
  // itself has nothing to mourn.
  if (
    f.ceilingTotal !== undefined &&
    recordFromTotal(f.ceilingTotal).losses === 0 &&
    floor.losses > 0
  )
    out.push("gotaway");
  // 📈 stacks with the payroll chain rather than joining it: its
  // denominator is Moneyball's own constant, not the club's cap, so it is a
  // season-against-a-benchmark claim — a goal — and 🤏 can honestly co-fire
  // (different bar, different denominator; see the def). The result bar is
  // the gold STAMP, read the way 🎒 reads it: "gold record" is the color the
  // finale prints, so the badge and the screen agree to the pixel. The bank
  // gate fails safe: an absent bank is unknown, and unknown earns nothing.
  if (
    f.bank != null &&
    f.bank !== "moneyball" &&
    f.spendM <= MONEYBALL_BUDGET_M &&
    recordFromTotal(f.total).tier === "elite"
  )
    out.push("elephant");

  // Four faces of one axis, ordered from busted to stingiest.
  if (f.spendM - f.budgetM >= FARM_TAX_M) out.push("farm");
  else if (f.budgetM > 0 && f.spendM <= f.budgetM && f.spendM >= f.budgetM * DIME_PCT)
    out.push("dime");
  else if (f.baselineWins >= PINCH_WINS && f.spendM <= f.budgetM * PINCH_PCT)
    out.push("pinch");
  else if (
    f.spendM <= f.budgetM * CHEAP_PCT &&
    f.baselineWins < f.baselineLosses
  )
    out.push("pocket");

  const full = roster.length === ROSTER_SLOTS;
  // The scouting axis, resolved top down like the on-field one: a perfect
  // match IS a seven-or-better match, so 🌠 takes the slot and 🔮 keeps the
  // near misses. The nine-seat gate on the DREAM club is what stops a thin
  // reel — five cards, five dream seats, five hits — from reading as perfect.
  //
  // Both halves are exact equalities rather than floors, so every way of not
  // knowing the denominator fails the same way: an absent `dreamSeats`, a zero
  // from a solve that never ran, and a genuine partial club all miss, and 🔮
  // catches whatever the hits alone earn.
  //
  // 🧭 is the axis's other end, in the same chain because the axis is
  // exclusive by design (zero can never also be seven, but the chain says so
  // structurally). Its gates mirror 🌠's: the dream club whole
  // (`dreamSeats === DREAM_SEATS`), and the player's club whole too — every
  // roster seat filled AND the dugout hired, because an empty chair misses
  // its dream pick by forfeit, and this badge is a claim about conviction.
  if (f.dreamSeats === DREAM_SEATS && f.scoutHits === DREAM_SEATS)
    out.push("dreamteam");
  else if (f.scoutHits >= CRYSTAL_HITS) out.push("crystal");
  else if (
    full &&
    f.managerName !== null &&
    f.dreamSeats === DREAM_SEATS &&
    f.scoutHits === 0
  )
    out.push("maverick");
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
  // 🎒 — a gold STAMP with a below-replacement seat aboard. The stamp
  // because "gold record" is the color the finale prints (the floor rungs'
  // rule); not gated on a full club — carrying one bad seat on a short club
  // is the same feat.
  if (recordFromTotal(f.total).tier === "elite" && roster.some((p) => p.war < 0))
    out.push("carried");
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
  // 💐 — the near-miss count against both hard gates. The optional fields
  // read through `?? 0`, and the fail-safe direction is on the count side: a
  // fact set with no pennant fields at all — a save from before they existed
  // — adds nothing to the near-miss sum and earns nothing. On the GATE side
  // `?? 0` reads absent as "no golds", which is the honest reading of the one
  // caller that omits it: the lab's fixtures carry no WBC seats, so their
  // absent count IS zero rather than unknown. Stacks beside 💍 by arithmetic
  // — the rings-zero gate makes the pair exclusive in the world, so no
  // resolver is needed.
  if (
    f.rings === 0 &&
    (f.wbcChampions ?? 0) === 0 &&
    (f.pennants ?? 0) + (f.wbcRunnersUp ?? 0) >= BRIDESMAID
  )
    out.push("bridesmaid");
  if (f.managerMoty && f.baselineWins > SKIPPER_WINS) out.push("skipper");
  // The dugout against the field. `managerNetWins` is the skipper's own
  // (W − L); MANAGER_PER_NET_WIN turns it into the WINS term the ledger prints
  // beside him, so the two sides of the comparison are in the same units.
  // `?? 0` reads an absent record as .500 exactly, which fails the strictly
  // positive test and withholds the badge — the fail-safe direction, and the
  // same reading 🪑 takes of the same field.
  const managerWins = (f.managerNetWins ?? 0) * MANAGER_PER_NET_WIN;
  if (full && managerWins > 0 && roster.every((p) => managerWins > p.war))
    out.push("fearless");
  // 🎫 — 🫡's mirror: every seat strictly out-earned the chair. Gated on the
  // record EXISTING rather than on ?? 0's .500 read: an unknown chair cannot
  // have been carried, but a genuinely dead-even one can be (and 🗿 stacks).
  if (
    full &&
    f.managerNetWins != null &&
    roster.every((p) => p.war > managerWins)
  )
    out.push("ride");
  // 🗿 — exactly dead even, the one number 🫡 and 🪑 both refuse. Strict
  // equality so an absent record (null) reads as unknown, not as .500.
  if (f.managerNetWins === 0) out.push("figurehead");
  // The dugout left to the last spin, and the chair that was still there when
  // the player got to it. `managerLast` is the recorded moment; the net wins
  // are the skipper's own, never the club's stamp. `?? 0` makes an absent
  // record read as .500 exactly, which withholds the badge — the fail-safe
  // direction for an optional fact.
  if (f.managerLast === true && (f.managerNetWins ?? 0) < 0) out.push("interim");
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
  // One seat strictly outcosts every other, compared by index rather than by
  // object identity so a fact set that reuses one entry object across seats
  // still answers the question about seats. Strict for the reason recorded
  // beside MINIMUM_M: ties at the bottom of the market are the common case.
  const priciestAt = (pos: string): boolean =>
    full &&
    roster.some(
      (p, i) =>
        p.pos === pos &&
        roster.every((q, j) => j === i || q.costPaid < p.costPaid),
    );
  if (priciestAt("RP")) out.push("fireman");
  if (priciestAt("C")) out.push("fieldgeneral");
  // ⚓ — the strict-priciest seat is also the club's outright worst. Cost
  // strict for priciestAt's reason; WAR strict the other way (every OTHER
  // seat strictly better), so a WAR tie counts for the player and the badge
  // fails toward silence. `full` gate: "worst of eight" needs the eight.
  if (
    full &&
    roster.some(
      (p, i) =>
        roster.every((q, j) => j === i || q.costPaid < p.costPaid) &&
        roster.every((q, j) => j === i || q.war > p.war),
    )
  )
    out.push("albatross");
  // 🕳️ — any seat under replacement. The one signing that subtracts wins.
  if (roster.some((p) => p.war < 0)) out.push("belowzero");
  // No `full` gate, unlike the two above: a count badge cannot be earned by
  // vacancy, and four minimum men on a club with a seat still open is four
  // minimum men.
  if (roster.filter((p) => p.costPaid <= MINIMUM_M).length >= MINIMUM_SEATS)
    out.push("minimum");
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
  // 🕶️'s other ending. Same club, same `full` gate, same `budgetM > 0` guard,
  // and the one comparison flipped — `spend > budget` where 🕶️ asks
  // `spend <= budget` — so the two are complements on one line rather than two
  // thresholds somebody has to keep in step. They are separate `if`s on a
  // stacking axis and stay exclusive anyway, by construction.
  if (
    f.ownerLast === true &&
    full &&
    f.budgetM > 0 &&
    f.spendM > f.budgetM
  )
    out.push("blindbust");
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
  if (roster.some((p) => SUBMARINERS.has(p.id))) out.push("submarine");
  // Both stack on the roster axis and the two lists are disjoint, so a club
  // holding one of each legitimately earns both — no resolver needed.
  if (roster.some((p) => SIDEWINDERS.has(p.id))) out.push("sidewinder");
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
  // Same default-false reading, same reason: a fact set assembled before the
  // field existed reports no keyboard rather than a free badge.
  if (f.konami === true) out.push("cheatcodes");
  if (f.undone === true) out.push("secondthoughts");
  // Same default-false reading: a fact set assembled before the field existed
  // reports no redo rather than a free badge.
  if (f.redone === true) out.push("rewind");
  // Same default-false reading: a fact set assembled before the field existed
  // reports no repeated undo rather than a free badge.
  if (f.repeatedUndo === true) out.push("merrygoround");
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
  // ⏳ stacks with 📆 by design (era stacks; four of one year IS five of one
  // decade short a man, and a club can honestly hold both facts at once).
  if (maxBucket(roster.map((p) => p.year)) >= SAMEYEAR_COUNT)
    out.push("sameyear");
  const years = roster.map((p) => p.year);
  if (years.length > 0 && Math.max(...years) - Math.min(...years) >= SPAN_YEARS)
    out.push("fortyyears");

  // ---- career: both read the PREVIOUS finished season through the same
  // recordFromTotal press that stamped it (prevTotal's note). Gold and
  // losing are disjoint by arithmetic, so the pair needs no resolver. ----
  if (f.prevTotal !== undefined) {
    const prev = recordFromTotal(f.prevTotal);
    const cur = recordFromTotal(f.total);
    if (prev.tier === "elite" && cur.tier === "elite") out.push("dynasty");
    if (prev.wins < prev.losses && cur.wins < cur.losses) out.push("rebuild");
  }

  return out;
}

/** One pill on the finale's brag row: the badge, and whether this is the
 * first time it has ever been earned. */
export interface Brag {
  def: BadgeDef;
  fresh: boolean;
}

/** The finale's brag row: every badge the club earned, in order.
 *
 * Lives here rather than in the component because it is a rule about badges,
 * not about rendering — and because the component can only run it behind a
 * reveal animation, which puts it out of reach of a test.
 *
 * UNCAPPED. The row used to keep four pills and cut the rest, on the reasoning
 * that pills cost pixels; what that actually cost was the player's own result.
 * A club that earns seven badges did something worth seven pills, the row wraps
 * on its own, and a badge dropped for space is indistinguishable from a badge
 * not earned. `cap` survives as an optional argument because the tests that
 * pin the ORDER need a cut to observe it against, and because a future surface
 * with a real width budget should get the same sorted list rather than its own.
 *
 * First-time badges still sort to the FRONT, now for emphasis rather than for
 * survival: the pill a player most wants to see should not be seventh. Within
 * each group the RAREST leads — the finale is a brag surface and the flex
 * belongs at the head of the row, the same axis the trophy case's bands are
 * stacked on. The sort is stable, so badges sharing a rung keep the engine's
 * order.
 *
 * Keys that resolve to no definition are dropped, which covers a finale
 * restored from a save written before a badge was retired — 2️⃣ RE2PECT and
 * 🎆 THE WALK-OFF are both in that state as of this round. */
export function bragRow(
  keys: string[],
  newKeys: string[],
  cap: number = Infinity,
): Brag[] {
  const fresh = new Set(newKeys);
  return keys
    .map((k) => BADGE_BY_KEY[k])
    .filter((d): d is BadgeDef => d !== undefined)
    .map((def) => ({ def, fresh: fresh.has(def.key) }))
    .sort(
      (a, b) =>
        Number(b.fresh) - Number(a.fresh) ||
        RARITY_ORDER.indexOf(a.def.rarity) - RARITY_ORDER.indexOf(b.def.rarity),
    )
    .slice(0, cap);
}

/** Badge keys → the emoji the share string spends. */
export function badgeEmoji(keys: string[]): string[] {
  return keys.map((k) => BADGE_BY_KEY[k]?.emoji ?? "").filter(Boolean);
}

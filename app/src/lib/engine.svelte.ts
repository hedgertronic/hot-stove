/** Game state machine. Implements SPEC.md's rules, DECISIONS.md's gap fills.
 * All gameplay randomness flows through `this.rng` (one mulberry32 stream per
 * seed). The displayed record is deterministic (rounded expected wins). */
import { track } from "./analytics";
import { earnedBadges } from "./badges";
import { bestRoster, type BestRoster } from "./bestroster";
import { loadCard, loadSpecials, ownerFor } from "./data";
import { eligibleTypes, visiblePlayers } from "./eligibility";
import { localDateStamp, recordFromTotal, type WarTier } from "./format";
import {
  FINALE_VERSION,
  appendHistory,
  archiveGame,
  earnedBadgeKeys,
  loadArchive,
} from "./history";
import { Rng, randomSeed } from "./rng";
import {
  GAMES,
  MARINERS_WINS,
  WBC_CHAMPION_ID,
  WBC_CHAMPION_POINTS,
  WBC_RUNNERUP_ID,
  WBC_RUNNERUP_POINTS,
  displayRecord,
  score,
} from "./scoring";
import { SLOT_TYPES } from "./types";
import type {
  Card,
  CardPlayer,
  GameIndex,
  IndexEntry,
  Meta,
  Owners,
  ScoreParts,
  SpecialSeason,
} from "./types";

export { SLOT_TYPES };

export type Phase = "preSpin" | "spinning" | "landed" | "finale";
export type PowerupKey =
  | "seasonTicket"
  | "relocate"
  | "doublePlay"
  | "tradeDeadline"
  | "prime"
  | "hometown";
export type PowerupState = "ready" | "armed" | "spent";
export type PlayerRowState = "open" | "dead";

export type Difficulty = "standard" | "scout";
export type Bank = "classic" | "moneyball" | "blankcheck";

export interface GameConfig {
  difficulty: Difficulty;
  bank: Bank;
}

export const DEFAULT_CONFIG: GameConfig = {
  difficulty: "standard",
  bank: "classic",
};

/** 2002 A's top-4 contracts (Dye/Justice/Durham/Tejada) through the bankroll
 * curve (widen × scale) — must equal the OAK_2002 card's budget. */
export const MONEYBALL_BUDGET_M = 51.5;
/** 2005 Yankees top-4 — the fattest payroll in the league — through the same
 * curve — must equal the NYY_2005 card's budget. */
export const BLANK_CHECK_BUDGET_M = 203.2;

/** What the reel animates on a given spin: powerup rerolls hold the other
 * half of the banner constant (Season Ticket keeps the team, Relocate keeps
 * the year). */
export type SpinKind = "full" | "year" | "team";

export interface Signed {
  id: string;
  name: string;
  pos: string;
  war: number;
  awards: string[];
  ws: boolean;
  pen: boolean;
  year: number;
  team: string;
  teamName: string;
  franchise: string;
  costPaid: number;
  /** Signed at the 🏠 Homegrown flat price. (The field name predates the
   * powerup; it stays for save and finale compatibility.) */
  hero: boolean;
  prorated: number;
  /** Seasonal age, carried from the card. Optional so a pre-v6 save restores
   * as-is: those players read as ageless and earn neither age badge. It is
   * copied onto the signing rather than looked up at the finale because a
   * ⭐ Prime Time signing comes from a card that never enters `seen`. */
  age?: number;
  /** Birth country as the cards spell it ("Dominican Republic", "Curaçao"),
   * feeding 🌎 THE WORLD TOUR and the lifetime passport. Carried on the
   * signing for the same reason `age` is: a ⭐ Prime Time signing comes from a
   * card that never enters `seen`, so there is nothing to look it up on later.
   * Optional so a save written before the field restores as-is — a missing
   * country counts as NO country, never as an unknown one. */
  bc?: string;
  /** In the Hall of Fame, elected as a player. Career-level, so it rides every
   * season of his. Optional on the same terms as `bc`. */
  hof?: boolean;
  /** World Baseball Classic medal for this exact season, already in Ring-
   * chasing points (2 champion, 1 losing finalist). Copied onto the signing
   * rather than looked up at the finale for `age`'s reason — a ⭐ Prime Time
   * signing comes from a card that never enters `seen`. Optional, so a save
   * written before the field restores as no medal rather than as an unknown
   * that pads the tally. */
  wbc?: number;
}

export interface OwnerPick {
  name: string;
  budget: number;
  franchise: string;
  year: number;
  teamName: string;
}

export interface StadiumPick {
  park: string;
  mult: number;
  franchise: string;
  year: number;
}

export interface ManagerPick {
  name: string;
  wins: number;
  losses: number;
  year: number;
  team: string;
  teamName: string;
  ws: boolean;
  pen: boolean;
  /** Won the BBWAA Manager of the Year that season (+2 trophy-case points).
   * Optional so pre-MotY saves restore as-is (absent reads as false). */
  moty?: boolean;
  /** In the Hall of Fame on a MANAGER's plaque — a skipper elected as a player
   * (Frank Robinson, Paul Molitor) does not carry it. The chair is one of the
   * seats 🏛️ counts, so it is stored here rather than re-derived at the finale.
   * Optional on the same terms as `moty`. */
  hof?: boolean;
}

/** The dream club's skipper, solved jointly with its roster — the manager
 * seat competes for the same scarce resource the bats do, since a card
 * supplies one pick and the dugout is one of them. Valued at
 * netWins × MANAGER_PER_NET_WIN + (MotY ? MANAGER_MOTY_POINTS : 0), the
 * skipper's full score contribution. */
export interface BestManager {
  name: string;
  team: string;
  year: number;
  teamName: string;
  ws: boolean;
  pen: boolean;
  netWins: number;
  moty?: boolean;
}

export type SpecialKey = "owner" | "stadium" | "manager";

export interface SpinLogEntry {
  kind: "sign" | "owner" | "stadium" | "manager" | "swap";
  war?: number;
}

export interface FinaleResult {
  parts: ScoreParts;
  wins: number;
  losses: number;
  spend: number;
  budget: number;
  spinCount: number;
  totalWar: number;
  /** Score-optimal club over every card this game landed on (null if the
   * cards couldn't be reloaded — score falls back to zero scout hits). */
  best: BestRoster | null;
  bestManager: BestManager | null;
  /** THE CEILING: the highest finale total this game's cards could have
   * produced — the same score() the stamp above comes from, so "you could have
   * gone 141–21" is a real record and never below the one actually earned.
   * Null only when the dream solve could not run (offline mid-game). Optional
   * so a finale restored from an older save reads as "no ceiling known".
   *
   * It assumes perfect play of the cards the reel showed: every roster seat,
   * the skipper, the owner and the ballpark chosen with hindsight, one pick per
   * card plus a ✌️ Double Play second pick off one of them, at list prices,
   * plus the one off-reel season ⭐ Prime Time reached, which the search treats
   * as an extra card rather than charging it the spin it cost. */
  bestPossibleTotal?: number | null;
  /** That total on the finale's own ladder (`format.recordFromTotal`) — the
   * identical function the stamp uses, so the two can never disagree. */
  bestPossibleRecord?: { wins: number; losses: number; tier: WarTier } | null;
  /** True when the ceiling IS the club the player built, i.e. the search found
   * nothing better. Two different situations reach it and the display should
   * know which it has: the player really did play the best club available, or
   * the search lost to a line it does not model (measured at 0.4% of no-powerup
   * games and 3.2% of full-powerup bot games — study 12). `best.total` is the
   * solver's own unclamped answer, so `best.total < parts.total` distinguishes
   * the second case; in it the dream club rendered below the stamp genuinely
   * scores less than the ceiling printed above it, so "you matched the best club
   * we found" is the honest wording rather than "you were perfect". */
  playedTheCeiling?: boolean;
  /** True when the player's final win total (from recordFromTotal) strictly
   * exceeds the dream team's win total from the solver's unclamped answer. The
   * comparison uses clamped wins [0,162] so it matches what the player reads on
   * screen — two clubs that both exceed 162 points tie at 162 wins and neither
   * beats the other. When true, scoutHits is upgraded to the dream club's own
   * fill count so the scoring doesn't penalise the player for not copying a
   * club they already beat.
   *
   * NOTE: a badges.ts agent keys a legendary badge off this field. The win
   * comparison is win-based and clamps at 162 (round 28). */
  beatCeiling?: boolean;
  /** True when the hired manager IS the dream team's manager. */
  managerHit: boolean;
  scoutHits: number;
  /** Badge KEYS (lib/badges), resolved once here so the pill row, the share
   * string, and the history entry can never disagree about what was earned. */
  badges: string[];
  /** The subset of `badges` this player had never earned before — the finale's
   * "NEW" flags. Resolved here because it is a question about the history log
   * as it stood BEFORE this game was written to it; by the time the finale
   * renders, every badge on it is in the log and none of them look new.
   *
   * Optional: a finale restored from a save written before this field existed
   * has no answer, and "no highlights" is the right reading of that — not a
   * crash, and not every pill flagged. */
  newBadges?: string[];
}

/** 🏠 Homegrown's flat sticker price ($1.0M normalized), clamped per-player
 * to the listed price — the discount must never cost MORE than a plain sign
 * (floor-priced players in cheap-floor years list below $1M). */
export const HOMEGROWN_PRICE_M = 1.0;

/** Decide whether the played club beat the dream team on wins and resolve the
 * scout-hit count. Pure function, exported so tests can pin the boundary
 * without running a full game.
 *
 * Comparison uses clamped wins [0,162], matching what the player reads on
 * screen. Two clubs that both exceed 162 points tie at 162 wins and neither
 * beats the other (beatCeiling false). When true, scoutHits upgrades to
 * Math.max(rawScoutHits, dreamSeats) — monotone, never lowers the count.
 *
 * The caller must pass the INITIAL parts.total (before any scoutHits upgrade)
 * so this is circular-free: it reads the total once, computes the verdict,
 * and the caller re-scores only if the scout count changed. */
export function beatCeilingDecision(
  playerTotal: number,
  solvedTotal: number | null,
  rawScoutHits: number,
  dreamSeats: number,
): { beatCeiling: boolean; scoutHits: number } {
  if (solvedTotal === null) return { beatCeiling: false, scoutHits: rawScoutHits };
  const pw = recordFromTotal(playerTotal, GAMES, MARINERS_WINS).wins;
  const dw = recordFromTotal(solvedTotal, GAMES, MARINERS_WINS).wins;
  const beatCeiling = pw > dw;
  return {
    beatCeiling,
    scoutHits: beatCeiling ? Math.max(rawScoutHits, dreamSeats) : rawScoutHits,
  };
}

const SAVE_KEY = "hotstove.current";
/** v6 = signings carry their seasonal age (the 🧓/🍼 input). v5 = 🏠 Homegrown
 * is a sixth powerup; v4 saves migrate on restore (heroUsed → the hometown
 * powerup's ready/spent state).
 *
 * v5 and v4 saves restore and finish normally — `Signed.age` is optional, so
 * an in-flight club simply has no ages and earns neither age badge. Nothing is
 * discarded; the migration is the optional field. */
const SAVE_VERSION = 6;

/* ---------- the last finished game ---------- */

/** The finale lives outside `hotstove.current` on purpose: a game in progress
 * and the last game finished are different objects with different lifetimes,
 * and the home screen has to tell them apart. `save()` still refuses to write
 * a finale into the in-progress key, and `finishGame` still deletes that key —
 * a finished game is not a resumable one.
 *
 * TWO keys, not one record with a flag:
 *
 * - `hotstove.finale` is the ARCHIVE — everything the finale screen renders.
 *   Written once when the game ends, deleted only when a new game starts.
 * - `hotstove.finale.open` is the BOOT CLAIM — "the finale screen is where the
 *   player is standing". A reload holding the claim lands back on the finale;
 *   ✕ and Modes drop the claim and leave the archive behind, which is what the
 *   home screen's way back reads.
 *
 * Split because the two change at different moments and for different reasons:
 * every exit is then a one-byte delete rather than a read-modify-write of a
 * multi-kilobyte blob, and "claim with no readable archive" resolves to the
 * home screen instead of a crash.
 *
 * THE CLAIM ALSO SAYS WHICH FINALE. Two screens are the finale screen: the
 * game that just ended, which is `hotstove.finale`, and any older season the
 * seasons list walked back into, which lives in `hotstove.archive`. A claim
 * that could only mean the first would resurrect the LAST game under a player
 * who reloaded while looking at a season from a month ago — the wrong club, the
 * wrong record, and no way to tell that it happened. So the claim's VALUE is
 * the answer:
 *
 *   "1"        the live finale, in `hotstove.finale`
 *   "a:<id>"   the archived season with that id, in `hotstove.archive`
 *
 * The prefix is what makes the two unmistakable whatever `finishGame` mints an
 * id out of, and "1" is what every claim written before archived seasons could
 * be claimed already says. The key's PRESENCE is still the whole of "is the
 * player on the finale", so `finaleClaimed` and `clearStoredFinale` are
 * unchanged by any of it. */
const FINALE_KEY = "hotstove.finale";
const FINALE_OPEN_KEY = "hotstove.finale.open";

/** Everything the finale screen reads off a Game, plus the result itself.
 *
 * Deliberately less than the in-progress save: the rng stream, the spin log,
 * the pending card and the powerup states have no reader once the game is
 * over. `seen` and the front office are here because they are a few hundred
 * bytes and a restored Game should not lie about state that cheap.
 *
 * Every field is plain JSON — `FinaleResult` bottoms out in numbers, strings,
 * arrays and object literals (no Map, Set, Date or class instance anywhere in
 * `ScoreParts`, `BestRoster` or `Signed`), so the round trip is lossless. */
export interface StoredFinale {
  v: number;
  seed: number;
  config: GameConfig;
  spinCount: number;
  seen: { team: string; year: number }[];
  slots: (Signed | null)[];
  owner: OwnerPick | null;
  stadium: StadiumPick | null;
  manager: ManagerPick | null;
  finale: FinaleResult;
}

/** The archived finale, or null when there is none, it is corrupt, or it was
 * written by a version this build cannot render. Same defensive shape as
 * `loadSettings` / `loadCues` / `loadHistory`: an unreadable record is no
 * record, never a throw — the home screen simply offers no way back. */
export function loadStoredFinale(): StoredFinale | null {
  try {
    const raw = localStorage.getItem(FINALE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s?.v !== FINALE_VERSION) return null;
    // The two things every surface dereferences: the ledger's numbers and the
    // roster it renders a seat per. A record missing either is not a finale.
    if (typeof s.finale?.parts?.total !== "number") return null;
    if (!Array.isArray(s.slots)) return null;
    return s as StoredFinale;
  } catch {
    return null;
  }
}

/** Is the finale screen where the player left off? (The boot claim.) */
export function finaleClaimed(): boolean {
  try {
    return localStorage.getItem(FINALE_OPEN_KEY) !== null;
  } catch {
    return false;
  }
}

/** Standing on the finale: a reload lands back here. Set when the game ends,
 * and when the seasons list opens a finished season.
 *
 * `archiveId` names WHICH season, for the second case: the id of its
 * `hotstove.archive` row. Omitted — the game that just ended, and the newest
 * season when it is being reopened out of `hotstove.finale` rather than out of
 * the archive — the claim means the live finale. */
export function claimFinale(archiveId?: string): void {
  try {
    localStorage.setItem(FINALE_OPEN_KEY, archiveId ? `a:${archiveId}` : "1");
  } catch {
    /* storage unavailable */
  }
}

/** The archived season the claim names, or null when it names the live finale
 * (and when there is no claim at all — `finaleClaimed` is what answers that). */
export function claimedArchiveId(): string | null {
  try {
    const v = localStorage.getItem(FINALE_OPEN_KEY);
    return v !== null && v.startsWith("a:") ? v.slice(2) : null;
  } catch {
    return null;
  }
}

/** Left the finale (✕, Modes): a reload goes home from now on. The archive
 * stays — being able to walk back in is the whole point of item two. */
export function releaseFinale(): void {
  try {
    localStorage.removeItem(FINALE_OPEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** A new game supersedes the last finished one: archive and claim both go, so
 * "an in-progress save AND a stored finale" is unreachable by construction
 * rather than by a boot-time tiebreak. */
export function clearStoredFinale(): void {
  try {
    localStorage.removeItem(FINALE_KEY);
    localStorage.removeItem(FINALE_OPEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class Game {
  meta: Meta;
  index: GameIndex;
  owners: Owners;
  seed: number;
  rng: Rng;
  config: GameConfig;

  phase = $state<Phase>("preSpin");
  card = $state<Card | null>(null);
  slots = $state<(Signed | null)[]>(Array(SLOT_TYPES.length).fill(null));
  owner = $state<OwnerPick | null>(null);
  /** The roster was already full when the owner was hired — the whole club
   * drafted without knowing the payroll, which is 🤝 FLYING BLIND.
   *
   * A moment rather than a fact about the finished club, so it can only be
   * recorded as it happens: by the finale a full roster and a hired owner look
   * the same whichever order they arrived in. Only `hireOwner` writes it,
   * because that is the only path that hires a FIRST owner — the Trade
   * Deadline swap requires the seat to be taken already, and a club that had a
   * budget all along was never flying blind however late it changed owners. */
  ownerHiredLast = $state(false);
  stadium = $state<StadiumPick | null>(null);
  manager = $state<ManagerPick | null>(null);
  /** Every OTHER seat was already filled when the skipper was hired — the club
   * built, the dugout left to the final spin, which is 🪑 THE INTERIM.
   *
   * A moment rather than a fact about the finished club, for `ownerHiredLast`'s
   * reason exactly: at the finale a full club with a manager in it looks the
   * same whichever order the chairs filled. "Every other seat" is the roster
   * plus, in Clean House, the owner and the ballpark — the game ends the spin
   * the club completes, so a hire made with everything else filled IS the hire
   * made on the last spin.
   *
   * Two paths write it, not one: `hireManager` (the FRONT OFFICE row) and
   * `applyPrimeSpecial` (⭐ Prime Time's manager career sheet) are both
   * first-hire paths and both return early once the chair is taken. The Trade
   * Deadline swap does not write it, because that path REQUIRES the chair to
   * be taken already, and a club that had a skipper all along never left the
   * dugout empty however late it changed him. */
  managerHiredLast = $state(false);
  /** The Konami code was entered on a physical keyboard during this game.
   *
   * State on the Game rather than a module variable in App.svelte because it
   * has to survive a reload: iOS Safari evicts background tabs, and a badge
   * earned by a keystroke that the eviction erased is worse than no badge. It
   * rides `save()` with everything else and restores with everything else.
   *
   * It changes NOTHING about play. No spin, no powerup, no price, no number
   * the finale prints — the badge is the entire effect, deliberately, because
   * a code that altered the game would make every score after it
   * incomparable. */
  konami = $state(false);
  /** A move was taken back during this game — ↩️ SECOND THOUGHTS.
   *
   * A fact about the RUN, not about the position, which is exactly why
   * `hydrate` does not carry it (see the note there): every snapshot was taken
   * BEFORE the undo that restores it, so a hydrate that put this field back
   * would clear it on the one call that earns it.
   *
   * On the Game and inside `save()` for `konami`'s reason — iOS Safari evicts
   * background tabs, and a player who undoes, reloads, then finishes would
   * otherwise lose the badge silently. */
  undoUsed = $state(false);
  /** Undo was used AND the very next committed action was the exact same move —
   * 🔂 DÉJÀ VU.
   *
   * Sticky like `undoUsed`: set once and never reset inside a run. A redo
   * always co-fires with ↩️ SECOND THOUGHTS — a redo requires an undo.
   *
   * The same RUN / POSITION distinction as `undoUsed` applies: `hydrate` does
   * not carry it (a snapshot taken before the action that earns it would clear
   * it on the one call that sets it), and `restore` reads it off the save
   * directly. */
  redone = $state(false);
  powerups = $state<Record<PowerupKey, PowerupState>>({
    seasonTicket: "ready",
    relocate: "ready",
    doublePlay: "ready",
    tradeDeadline: "ready",
    prime: "ready",
    hometown: "ready",
  });
  choicesLeft = $state(0);
  choicesUsed = $state(0);
  spinCount = $state(0);
  spinLog = $state<SpinLogEntry[]>([]);
  spinKind = $state<SpinKind>("full");
  /** Which spin the reel is on — a counter, bumped by every `beginSpin` and by
   * every `undo`, and never anything but a tiebreaker between an in-flight
   * async result and the state it was meant for.
   *
   * `spinCount` cannot do this job: 🎟️/🚚/the cold-stove respin all decrement
   * it (same spin, new card) and `hydrate` restores it wholesale, so it repeats
   * values and a stale land could match one. This only ever counts up, and a
   * rewind counts it up too, which is exactly what makes the two sides differ.
   *
   * Reactive because SpinBanner keys its reel on it: the banner has to start a
   * reel per spin, ignore the re-runs its own `display` writes provoke, and
   * still start cleanly on the spin AFTER a mid-reel rewind — one boolean
   * "running" flag could do the first two but latched on forever on the third,
   * leaving the reel frozen. */
  spinEpoch = $state(0);
  /** Every distinct card this game has landed on — the scouting yardstick. */
  seen = $state<{ team: string; year: number }[]>([]);
  /** Sign-time slot ambiguity: rail becomes a slot picker for this player. */
  slotPick = $state<string | null>(null);
  /** TD release picker: rail cells the incoming player could replace. */
  releasePick = $state<string | null>(null);
  /** Prime picker: id of the LISTED player whose career is being browsed. */
  primePick = $state<string | null>(null);
  /** Prime picker, front-office flavor: the manager tile is the only
   * browsable special — owner and stadium are never Prime targets. */
  primeSpecial = $state<"manager" | null>(null);
  finale = $state<FinaleResult | null>(null);
  /** The pending card's fetch failed (connection dropped mid-spin) — the
   * banner offers a retry instead of leaving the reel spinning forever. */
  loadFailed = $state(false);
  /** This game resumed onto a spin that a ✌️ Double Play had half-used, and
   * `restore` forfeited the pick that never happened — so the spin is over
   * before the player has touched anything. The banner reads this to hold the
   * card for a beat and say what happened; a committed pick sets it never, and
   * rolls on with no pause at all. Deliberately NOT serialized: it describes
   * one boot, not the run. */
  resumedForfeit = $state(false);

  private pendingCard: Promise<Card> | null = null;
  private pendingEntry: IndexEntry | null = null;

  /** Signature of the LAST COMMITTED action — set in each action method just
   * before `snapshot()` where the card, player, and slot are fully resolved,
   * and KEPT after `consumeChoice` so that `undo()` can read it as the
   * signature of whatever it is about to revert. Format:
   *
   *   sign|{playerId}|{cardTeam}|{cardYear}|{slotIdx}   — player sign
   *   swap|{playerId}|{cardTeam}|{cardYear}|{slotIdx}   — player swap (TD)
   *   owner|{franchise}|{year}                          — hire owner
   *   stadium|{franchise}|{year}                        — buy stadium
   *   manager|{team}|{year}                             — hire manager (any path)
   *   swapspecial|{which}|{team}|{year}                 — TD special swap
   *
   * The card's team and year are in every string so a Prime re-sign of a
   * different season of the same man into the same slot cannot falsely match.
   *
   * Never serialized. Nulled by 🎟️/🚚/cold-respin (which take snapshots but
   * bypass consumeChoice) so they cannot bridge a pending redo across a
   * re-deal. Overwritten by the next action's sig on the next commit. */
  private actionSig: string | null = null;

  /** Set by `undo()` to `actionSig` at the moment of the rewind. Compared
   * by the very next `consumeChoice` call: a match sets `redone`. Any
   * committed action — match or miss — clears it immediately.
   * Never serialized — cleared by every committed action. */
  private pendingRedoSig: string | null = null;

  /** The game as it stood before the last committed move: its serialized state
   * plus the card that was on the reel at that moment. Everything `undo()`
   * puts back.
   *
   * ONE point, never a stack. It is consumed the moment it is used, so undo
   * cannot run twice in a row, and the next committed move takes a fresh one —
   * "go back one move", repeatable, with no history to keep consistent.
   *
   * IT IS THE SAVE'S OWN SHAPE, and that is the load-bearing part.
   * `serialize()`/`hydrate()` already round-trip a complete resumable game. A
   * second serializer written for undo would be free to drift from that one,
   * and a drifted undo does not fail loudly: it silently hands back a game
   * missing whatever the two disagreed about. There is one description of a
   * game in flight and both readers go through it.
   *
   * `rngState` IS THE WHOLE POINT. This game is seeded and seeds are
   * shareable: two players on one seed must be dealt the same cards. `Rng` is
   * a cursor, so rewinding the game without rewinding `rng.state` would leave
   * the cursor past the draw that was taken back — undo a spin, spin again,
   * and a DIFFERENT card comes up. That is an unlimited reroll and it makes a
   * seed mean nothing. With the cursor rewound, repeating the same action
   * reproduces the same result exactly. Whatever else `serialize()` gains or
   * loses, `rngState` stays in it.
   *
   * IN MEMORY ONLY, in a file where every other fact is written to storage:
   *
   *  - The snapshot IS a serialized game. Putting it inside the serialized
   *    game embeds the previous save in every save, and that one inside the
   *    next. Keeping it finite needs a rule ("exclude this field from its own
   *    serialization") that a later edit breaks with no symptom until the
   *    quota does.
   *  - `restore()` deliberately VOIDS state a reload cannot honor: it forfeits
   *    a ✌️ Double Play's unspent second pick. A snapshot that survived the
   *    reload would hand that forfeited pick straight back, undoing a decision
   *    the reload had already made.
   *
   * So an eviction costs the one-move rewind and nothing else. The position is
   * saved, `undoUsed` is saved, and undo simply comes back unavailable — which
   * is the same thing a fresh spin says.
   *
   * Reactive because the HUD's pill reads `canUndo` to decide whether it is
   * live, and that getter short-circuits on this field: with a plain field the
   * FIRST read (null, no move made yet) returns before `phase` is ever
   * touched, so no dependency is registered and the pill stays dead for the
   * rest of the game however many moves are made.
   *
   * `$state.raw` rather than `$state`, because the point is REPLACED wholesale
   * and never edited in place: nothing ever writes `undoPoint.card` or
   * `undoPoint.state`, so there is nothing inside it worth tracking. Plain
   * `$state` would deep-proxy the whole `Card` on every committed move to
   * observe writes that never come. (It would not corrupt anything — svelte's
   * proxy is idempotent, so re-storing an already-proxied card yields the same
   * object, which undo.dom.test.ts pins. Raw is the cheaper and more honest
   * declaration, not a bug fix.) */
  private undoPoint = $state.raw<{
    state: string;
    card: Card | null;
    /** The phase the point was taken in, which is what says whether it holds a
     * MOVE. "landed" is a pick, a swap, a hire, a 🎟️/🚚 re-pick, a cold-stove
     * respin — things the player did on a card. "preSpin" is the automatic
     * roll and nothing else: the stove spins itself, so a point taken there
     * has no tap behind it. `canUndo` reads it to decide what a mid-reel
     * rewind is allowed to reach. */
    phase: Phase;
  } | null>(null);

  constructor(
    meta: Meta,
    index: GameIndex,
    owners: Owners,
    seed?: number,
    config: GameConfig = DEFAULT_CONFIG,
  ) {
    this.meta = meta;
    this.index = index;
    this.owners = owners;
    this.seed = seed ?? randomSeed();
    this.rng = new Rng(this.seed);
    this.config = { ...config };
  }

  // ---------- mode visibility (difficulty ladder) ----------

  get showWar(): boolean {
    return this.config.difficulty === "standard";
  }

  /** Salary shows in every difficulty — Eye Test hides talent signals (WAR,
   * awards), not the price tag; the cap game is the same either way. */
  get showCost(): boolean {
    return true;
  }

  get showAwards(): boolean {
    return this.config.difficulty === "standard";
  }

  get scout(): boolean {
    return this.config.difficulty === "scout";
  }

  /** Moneyball and Blank Check are fixed-cap modes: no owners, no stadiums. */
  get fixedCap(): boolean {
    return this.config.bank !== "classic";
  }

  // ---------- derived ----------

  get rosterFull(): boolean {
    return this.slots.every((s) => s !== null);
  }

  /** The club is complete when every seat that can be filled is: the whole
   * roster, a manager, and (classic bank only) an owner and a stadium. The
   * game keeps spinning until this is true. */
  get complete(): boolean {
    return (
      this.rosterFull &&
      this.manager !== null &&
      (this.fixedCap || (this.owner !== null && this.stadium !== null))
    );
  }

  /** Every seat except the dugout is filled — `complete` with the manager
   * taken out of it. A hire made while this holds is the hire that completes
   * the club, which is what makes it the hire made on the final spin, which is
   * what 🪑 THE INTERIM asks about. */
  get otherSeatsFull(): boolean {
    return (
      this.rosterFull &&
      (this.fixedCap || (this.owner !== null && this.stadium !== null))
    );
  }

  get totalWar(): number {
    return this.slots.reduce((sum, s) => sum + (s?.war ?? 0), 0);
  }

  /** Everything the club won: 💍/🚩 October counts, manager included, plus the
   * March medals from the World Baseball Classic. One tally, read by scoring,
   * the finale chips, and the share string.
   *
   * `rings` and `pennants` keep their exact meaning and their exact arithmetic
   * — bestroster.ts, share.ts and badges.ts all read them, and 💍 RING BEARERS
   * counts World Series rings, not medals. The Classic counts are two more
   * fields beside them rather than a term folded into either.
   *
   * The medal counts carry NO manager term, unlike the rings. The curated
   * medal roster is players only: a Classic manager is not on it, so adding
   * `this.manager?.wbc` would be reading a field nothing ever writes. */
  get pedigree(): {
    rings: number;
    pennants: number;
    wbcChampions: number;
    wbcRunnersUp: number;
  } {
    return {
      rings:
        this.slots.filter((s) => s?.ws).length + (this.manager?.ws ? 1 : 0),
      pennants:
        this.slots.filter((s) => s?.pen).length + (this.manager?.pen ? 1 : 0),
      wbcChampions: this.slots.filter((s) => s?.wbc === WBC_CHAMPION_ID)
        .length,
      wbcRunnersUp: this.slots.filter((s) => s?.wbc === WBC_RUNNERUP_ID)
        .length,
    };
  }

  get spend(): number {
    return this.slots.reduce((sum, s) => sum + (s?.costPaid ?? 0), 0);
  }

  get effectiveBudget(): number {
    if (this.config.bank === "moneyball") return MONEYBALL_BUDGET_M;
    if (this.config.bank === "blankcheck") return BLANK_CHECK_BUDGET_M;
    return (
      (this.owner?.budget ?? this.meta.minBudget) * (this.stadium?.mult ?? 1)
    );
  }

  /** Whether the cap means anything yet: fixed banks always; Owner's Box only
   * once an owner is hired. Before that, effectiveBudget falls back to the
   * league-minimum floor (meta.minBudget) — real math, but not the player's
   * cap, so the UI shouldn't present it as one. */
  get capKnown(): boolean {
    return this.fixedCap || this.owner !== null;
  }

  get ownerName(): string {
    if (!this.card) return "";
    return ownerFor(this.owners, this.card.franchise, this.card.year);
  }

  get managerAvailable(): boolean {
    return this.card?.manager != null;
  }

  /** Open slot indices a player could fill right now, specialist types first. */
  openSlotsFor(p: CardPlayer): number[] {
    const types = eligibleTypes(p);
    return SLOT_TYPES.map((t, i) => i).filter(
      (i) => this.slots[i] === null && types.includes(SLOT_TYPES[i]),
    );
  }

  /** One human per roster, any season (B-R ids are stable across years). */
  isRostered(p: CardPlayer): boolean {
    return this.slots.some((s) => s?.id === p.id);
  }

  playerState(p: CardPlayer): PlayerRowState {
    if (this.isRostered(p)) return "dead";
    return this.openSlotsFor(p).length > 0 ? "open" : "dead";
  }

  /** Card players the list actually shows. The rule is eligibility.ts's — the
   * dream-team solver reads the same function, and it has to. */
  get visiblePlayers(): CardPlayer[] {
    return this.card ? visiblePlayers(this.card.players) : [];
  }

  /** Whether a listed row is tappable right now — the single gate the UI
   * uses for signing, Trade Deadline swaps, AND Prime Time browsing. */
  rowPlayable(p: CardPlayer): boolean {
    if (this.phase !== "landed" || this.choicesLeft === 0) return false;
    if (this.marketBlocks(p)) return false;
    return this.playerState(p) === "open" || this.tdCandidate(p);
  }

  /** THE INTERSECTION RULE. Every armed market powerup narrows the market to
   * its own targets — 🏠 to debut matches, 🔁 to trade candidates, ⭐ to
   * browsable careers — and arming several narrows it to rows that answer
   * ALL of them. Rows outside the intersection gray out and are untappable
   * until a powerup is disarmed; rows inside it light the armed orange.
   *
   * The alternative (each armed powerup highlighting its own set and leaving
   * everything else live) was tried and rejected: one orange channel cannot
   * say WHICH powerup lit a row, and with 🔁 + 🏠 armed together the row
   * that answers both — one tap that trades AND discounts, spending both —
   * was indistinguishable from a row that answers either alone. Under the
   * intersection, orange has exactly one meaning: "this row answers
   * everything you have armed."
   *
   * The raw per-powerup target tests live beside this so no clause can
   * recurse through the gates that consult it. */
  private marketBlocks(p: CardPlayer): boolean {
    if (this.powerups.hometown === "armed" && !this.discountEligible(p))
      return true;
    if (this.powerups.tradeDeadline === "armed" && !this.tdTargetRaw(p))
      return true;
    if (this.primeArmed && !this.primeTargetRaw(p)) return true;
    return false;
  }

  /** 🔁's own target test, before the intersection: any unrostered player
   * with at least one occupied eligible seat. */
  /** The intersection rule's front-office arm: 🏠 has NO front-office
   * targets — the discount reprices market rows and nothing else — so while
   * it is armed the whole FRONT OFFICE grays: no hires, no 🔁 special
   * swaps, no ⭐ manager browse, until the discount is disarmed. One
   * predicate, consulted by every special-action entry point, so the UI's
   * gray and the engine's refusal can never disagree. */
  private frontOfficeBlocks(): boolean {
    return this.powerups.hometown === "armed";
  }

  private tdTargetRaw(p: CardPlayer): boolean {
    return !this.isRostered(p) && this.occupiedSlotsFor(p).length > 0;
  }

  /** ⭐'s own target test, before the intersection: an unrostered man whose
   * listed season fits some seat (see primeBrowsable for why the listed
   * season stands in for the career). */
  private primeTargetRaw(p: CardPlayer): boolean {
    return !this.isRostered(p) && this.primeSlotFor(p) !== null;
  }

  /** Whether an armed Trade Deadline claims this row's tap: any unrostered
   * player with at least one occupied eligible seat is a trade candidate —
   * even when an open seat could also take them directly (a catcher can
   * replace the rostered C while the FLEX seat sits open; disarm to sign
   * plainly into the open seat instead). Intersected with the other armed
   * powerups' targets per the rule above. */
  tdCandidate(p: CardPlayer): boolean {
    return (
      this.powerups.tradeDeadline === "armed" &&
      this.tdTargetRaw(p) &&
      !this.marketBlocks(p)
    );
  }

  /** Whether an armed 🏠 Homegrown reprices this row: the player debuted
   * with the current spin's franchise. Signing gates (rostered, no open
   * seat) are handled by the usual tappability rules, not here. */
  discountEligible(p: CardPlayer): boolean {
    return (
      this.powerups.hometown === "armed" &&
      this.card !== null &&
      p.debut === this.card.franchise
    );
  }

  priceFor(p: CardPlayer): number {
    return this.discountEligible(p)
      ? Math.min(HOMEGROWN_PRICE_M, p.cost)
      : p.cost;
  }

  /** Whether an armed 🏠 Homegrown reprices a SPECIFIC SEASON in the career
   * sheet. The check is per-season, not per-player: only seasons played for
   * the debut franchise are eligible. McGwire on the A's card — his Oakland
   * seasons sign at $1M, his Cardinals seasons at full price. The landed card
   * does NOT appear in this check; what matters is the season's own club.
   *
   * The season is identified by its card's FRANCHISE id, never its team code:
   * `p.debut` is a franchise id, and clubs that renamed (CAL/ANA Angels,
   * MON/WSN, FLA/MIA) have seasons whose team code will never equal any
   * debut value. Comparing team to franchise priced every Angels season at
   * list even with 🏠 armed. */
  primeDiscountEligible(p: CardPlayer, seasonFranchise: string): boolean {
    return this.powerups.hometown === "armed" && seasonFranchise === p.debut;
  }

  primePriceFor(p: CardPlayer, seasonFranchise: string): number {
    return this.primeDiscountEligible(p, seasonFranchise)
      ? Math.min(HOMEGROWN_PRICE_M, p.cost)
      : p.cost;
  }

  /** Occupied slot indices the incoming player could replace (TD). */
  occupiedSlotsFor(p: CardPlayer): number[] {
    const types = eligibleTypes(p);
    return SLOT_TYPES.map((t, i) => i).filter(
      (i) => this.slots[i] !== null && types.includes(SLOT_TYPES[i]),
    );
  }

  specialTaken(which: SpecialKey): boolean {
    return (
      { owner: this.owner, stadium: this.stadium, manager: this.manager }[
        which
      ] !== null
    );
  }

  /** Can any choice still be committed on this card? (DECISIONS.md #3) */
  anyActionable(): boolean {
    if (!this.card) return false;
    const specialsOpen = this.fixedCap
      ? !this.manager && this.managerAvailable
      : !this.owner ||
        !this.stadium ||
        (!this.manager && this.managerAvailable);
    if (specialsOpen) return true;
    if (
      !this.rosterFull &&
      this.visiblePlayers.some((p) => this.playerState(p) === "open")
    )
      return true;
    if (this.powerups.tradeDeadline !== "spent") {
      if (
        this.visiblePlayers.some(
          (p) => this.playerState(p) === "dead" && !this.isRostered(p),
        )
      )
        return true;
      if (this.owner || this.stadium || (this.manager && this.managerAvailable))
        return true;
    }
    return false;
  }

  /** Dead spin: landed, nothing committed, nothing possible → free respin. */
  get coldStove(): boolean {
    return (
      this.phase === "landed" && this.choicesUsed === 0 && !this.anyActionable()
    );
  }

  // ---------- spin flow ----------

  /** Begin a spin. UI animates the reel, then awaits land(). Stray taps
   * (double-tap on SPIN, taps mid-animation) are no-ops, never errors. */
  spin(): void {
    if (this.phase !== "preSpin") return;
    // Before the draw, so undo rewinds the cursor with the rest of the game
    // and a re-spin deals this exact card again.
    //
    // KEPT, not overwritten, when a choice already holds the point. The stove
    // never idles: committing a pick drops `choicesLeft` to zero and
    // SpinBanner's effect spins on the very next turn of the event loop, with
    // no tap in between. A fresh point here would therefore replace the
    // player's signing with the auto-spin that followed it a millisecond later
    // — undo would rewind to just after the choice, having spent the one point
    // that could have taken the choice back, and no pick in the game would ever
    // be undoable. The point a player means is the last thing they DID, and an
    // automatic spin is not one of those.
    //
    // The point is therefore filled exactly when nothing is holding it: the
    // first spin of a game, and the spin after an undo, since `undo()` consumes
    // what it restores. Both are the last thing the player did.
    if (this.undoPoint === null) this.snapshot();
    this.disarmToggles();
    const entry = this.rng.pick(this.index.cards);
    this.beginSpin(entry, "full");
  }

  private beginSpin(entry: IndexEntry, kind: SpinKind): void {
    this.spinEpoch += 1;
    this.phase = "spinning";
    // The reel is leaving; whatever the resume notice had to say has been said.
    this.resumedForfeit = false;
    this.spinKind = kind;
    this.spinCount += 1;
    this.pendingEntry = entry;
    this.loadFailed = false;
    this.pendingCard = loadCard(entry.team, entry.year);
  }

  /** Re-issue a failed card fetch (the cache evicts rejections, so this hits
   * the network again). The caller awaits land() afterward, same as a spin. */
  retrySpin(): void {
    if (!this.loadFailed || !this.pendingEntry) return;
    this.loadFailed = false;
    this.pendingCard = loadCard(this.pendingEntry.team, this.pendingEntry.year);
  }

  /** Resolve the spin in flight onto the reel.
   *
   * Nothing is written until the fetch has come back AND the epoch still
   * matches the one this call started on. The await is the whole reason: a
   * rewind taken mid-reel (see `canUndo`) restores the position underneath a
   * promise that is still outstanding, and a land that wrote its card after
   * that would overwrite the rewind with the spin it took back. Clearing
   * `pendingCard` in `undo()` covers the land that has not started; the epoch
   * covers the one already parked on the await, which nothing else can reach. */
  async land(): Promise<void> {
    const pending = this.pendingCard;
    if (!pending) return;
    const epoch = this.spinEpoch;
    let landing: Card;
    try {
      landing = await pending;
    } catch {
      if (epoch !== this.spinEpoch) return;
      this.pendingCard = null;
      this.loadFailed = true;
      return;
    }
    if (epoch !== this.spinEpoch) return;
    this.card = landing;
    this.pendingCard = null;
    this.phase = "landed";
    this.choicesLeft = 1;
    this.choicesUsed = 0;
    if (
      !this.seen.some(
        (s) => s.team === this.card!.team && s.year === this.card!.year,
      )
    )
      this.seen = [
        ...this.seen,
        { team: this.card.team, year: this.card.year },
      ];
    this.clearTransients();
    this.save();
  }

  // ---------- powerups ----------

  yearsForFranchise(franchise: string): number[] {
    return this.index.cards
      .filter((c) => c.franchise === franchise)
      .map((c) => c.year)
      .sort((a, b) => a - b);
  }

  /** Season Ticket grid decoration: year → "ws" | "pen" for this franchise's
   * flagged seasons (era-correct team codes come free — the index rows carry
   * the flags). Unflagged years are simply absent. */
  yearPedigree(franchise: string): Record<number, "ws" | "pen"> {
    const out: Record<number, "ws" | "pen"> = {};
    for (const c of this.index.cards) {
      if (c.franchise !== franchise) continue;
      if (c.ws) out[c.year] = "ws";
      else if (c.pen) out[c.year] = "pen";
    }
    return out;
  }

  /** 🎟️ Season Ticket: re-pick any other season of this franchise. Pre-choice only. */
  seasonTicket(year: number): void {
    if (this.phase !== "landed" || this.powerups.seasonTicket !== "ready")
      return;
    if (this.choicesUsed > 0 || !this.card || year === this.card.year) return;
    const entry = this.index.cards.find(
      (c) => c.franchise === this.card!.franchise && c.year === year,
    );
    if (!entry) return;
    // Not a committed choice — bypasses consumeChoice — so clear any pending
    // redo sig rather than letting it outlive the re-deal.
    this.actionSig = null;
    this.pendingRedoSig = null;
    this.snapshot();
    this.spendPowerup("seasonTicket");
    this.disarmToggles();
    this.spinCount -= 1; // same spin, new card
    this.beginSpin(entry, "year");
  }

  /** Teams available to Relocate to (any club, same season). */
  teamsForYear(year: number): IndexEntry[] {
    return this.index.cards
      .filter((c) => c.year === year)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** 🚚 Relocate: re-pick any other team from this same season. Pre-choice only. */
  relocate(team: string): void {
    if (this.phase !== "landed" || this.powerups.relocate !== "ready") return;
    if (this.choicesUsed > 0 || !this.card || team === this.card.team) return;
    const entry = this.index.cards.find(
      (c) => c.year === this.card!.year && c.team === team,
    );
    if (!entry) return;
    // Not a committed choice — bypasses consumeChoice — so clear any pending
    // redo sig rather than letting it outlive the re-deal.
    this.actionSig = null;
    this.pendingRedoSig = null;
    this.snapshot();
    this.spendPowerup("relocate");
    this.disarmToggles();
    this.spinCount -= 1;
    this.beginSpin(entry, "team");
  }

  /** ✌️ Double Play: arming grants a second choice this spin. Only consumed
   * when the SECOND pick actually commits — disarming or moving on with one
   * pick refunds it. */
  toggleDoublePlay(): void {
    if (this.phase !== "landed") return;
    if (this.powerups.doublePlay === "ready") {
      if (this.choicesUsed > 0) return;
      this.powerups.doublePlay = "armed";
      this.choicesLeft += 1;
    } else if (this.powerups.doublePlay === "armed") {
      this.powerups.doublePlay = "ready";
      this.choicesLeft -= 1;
      if (this.choicesLeft === 0 && this.choicesUsed > 0) {
        this.endSpin();
        return;
      }
    }
    this.save();
  }

  /** 🔁 Trade Deadline arming toggle: gray rows become swappable. */
  toggleTradeDeadline(): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (this.powerups.tradeDeadline === "ready") {
      this.powerups.tradeDeadline = "armed";
    } else if (this.powerups.tradeDeadline === "armed") {
      this.powerups.tradeDeadline = "ready";
      this.releasePick = null;
    }
    this.save();
  }

  /** ⭐ Prime Time arming toggle: listed (unsigned) players become
   * career-browsable. Browsing costs nothing until a season is signed. */
  togglePrime(): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (this.powerups.prime === "ready") {
      this.powerups.prime = "armed";
    } else if (this.powerups.prime === "armed") {
      this.powerups.prime = "ready";
      this.primePick = null;
      this.primeSpecial = null;
    }
    this.save();
  }

  get primeArmed(): boolean {
    return this.powerups.prime === "armed";
  }

  /** 🏠 Homegrown arming toggle (the hometown discount): while armed, the
   * market filters to unsigned players who DEBUTED with this spin's
   * franchise, repriced to the flat HOMEGROWN_PRICE_M; every other row
   * grays. Signing one at the discount spends the powerup; disarming
   * restores the list without spending it. A card with no debut-eligible
   * players still arms — the whole list grays until disarm. (The internal
   * powerup key stays "hometown".) */
  toggleHometown(): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (this.powerups.hometown === "ready") {
      this.powerups.hometown = "armed";
    } else if (this.powerups.hometown === "armed") {
      this.powerups.hometown = "ready";
    }
    this.save();
  }

  /** Whether an armed ⭐ Prime Time claims this row's tap — i.e. whether
   * tapping it opens the career sheet.
   *
   * Deliberately NOT `rowPlayable`, and the difference is 🏠 Homegrown. The
   * discount filters the LANDED CARD'S MARKET: it grays every row that did not
   * debut with this franchise, because those rows are what it reprices and
   * those are the rows it can sell. A career sheet is a different market — it
   * sells seasons off a card the reel never landed on, at list price, with no
   * discount travelling — so the filter has no claim on it. Routing Prime
   * through `rowPlayable` made an armed 🏠 silently shrink Prime to the debut
   * players, which is the pair the player is most likely to arm together.
   *
   * Reachability is still asked, just not the 🏠 filter: there has to be a
   * chair this man could take — an open seat, or an armed 🔁 Trade Deadline and
   * an occupied one. Dropping that half as well would open a sheet in which
   * every season grays, which is the dead end the swap branch exists to close.
   *
   * The listed season stands in for the whole career, which is a proxy and can
   * be wrong: a man listed at catcher may have outfield years that would fit a
   * seat his catching year cannot. Loading a career to decide whether the
   * career is worth loading is not an option, and graying a row whose other
   * years might have fit is a smaller failure than opening a sheet with
   * nothing in it. */
  primeBrowsable(p: CardPlayer): boolean {
    if (this.phase !== "landed" || this.choicesLeft === 0) return false;
    if (!this.primeArmed || this.isRostered(p)) return false;
    // The intersection rule: with 🏠 or 🔁 armed alongside ⭐, only rows
    // that answer those too stay browsable — the rest gray with the market.
    if (this.marketBlocks(p)) return false;
    return this.primeSlotFor(p) !== null;
  }

  /** Armed Prime, tap a listed player: browse their whole career. */
  primeTapPlayer(p: CardPlayer): void {
    if (!this.primeBrowsable(p)) return;
    this.primePick = p.id;
  }

  /** Armed Prime, tap the OPEN manager tile: browse that skipper's whole
   * career. Prime targets are PLAYERS and MANAGERS only — owner and stadium
   * tiles never open a timeline (DECISIONS.md Round 17: owner-Priming was
   * pure bank-shopping, and banning it is score-neutral). A taken tile
   * isn't browsable — the seat is filled. */
  primeTapSpecial(which: SpecialKey): void {
    if (this.frontOfficeBlocks()) return;
    if (which !== "manager") return;
    if (!this.primeArmed || this.specialTaken(which) || !this.card) return;
    if (!this.managerAvailable) return;
    this.primeSpecial = which;
  }

  /** The seat a ⭐ Prime Time signing lands in, or null when the browsed season
   * fits nowhere. The career sheet reads it through `primeFits` to gray the
   * rows it cannot sell.
   *
   * An OPEN seat always wins over a 🔁 Trade Deadline swap, which is the
   * opposite of `tdCandidate`'s rule on the market rows — and the asymmetry is
   * the escape hatch, not an inconsistency. On a market row an armed TD claims
   * the tap even when a seat is open, because disarming the pill and signing
   * plainly is one tap away. Inside the career sheet that exit does not exist:
   * closing the sheet disarms ⭐, not 🔁. Letting the swap win there would
   * vacate a chair the club did not need to vacate, with nothing to undo it —
   * and it would spend Trade Deadline on a trade that was never required.
   *
   * Both branches auto-resolve specialist-first, because "no nested picker
   * inside the career sheet" is the rule the open-seat path has always
   * followed. The swap branch resolves further, to the LOWEST-WAR eligible
   * occupied seat (ties to the earliest), because vacating a chair is
   * destructive in a way that filling an empty one is not: the least damaging
   * deterministic answer is to trade away the weakest man the incoming season
   * could replace, which is what a trade is for. */
  private primeSlotFor(p: CardPlayer): number | null {
    const open = this.openSlotsFor(p);
    if (open.length > 0) {
      const specialist = open.filter((i) => SLOT_TYPES[i] !== "FLEX");
      return specialist.length > 0 ? specialist[0] : open[0];
    }
    if (this.powerups.tradeDeadline !== "armed") return null;
    const taken = this.occupiedSlotsFor(p);
    if (taken.length === 0) return null;
    const specialist = taken.filter((i) => SLOT_TYPES[i] !== "FLEX");
    const pool = specialist.length > 0 ? specialist : taken;
    return pool.reduce((a, b) =>
      (this.slots[b]?.war ?? 0) < (this.slots[a]?.war ?? 0) ? b : a,
    );
  }

  /** Whether a browsed career season can be signed right now — an open seat
   * fits it, or an armed 🔁 Trade Deadline can clear one for it. The career
   * sheet grays every row this rejects.
   *
   * THE INTERSECTION RULE reaches inside the sheet: with 🏠 armed beside ⭐,
   * only the discount's own seasons — the ones played for the debut
   * franchise, priced at the flat $1M — stay signable, and every full-price
   * season grays with the rest of the market. The caller passes the season
   * card's FRANCHISE id (never its team code — see primeDiscountEligible for
   * the rename trap). `applyPrime` re-checks the same condition, so the gray
   * and the engine's refusal cannot disagree. */
  primeFits(p: CardPlayer, seasonFranchise: string): boolean {
    if (
      this.powerups.hometown === "armed" &&
      !this.primeDiscountEligible(p, seasonFranchise)
    )
      return false;
    return this.primeSlotFor(p) !== null;
  }

  /** Sign a DIFFERENT season of the browsed player's career, at that season's
   * real cost. Consumes the powerup and the spin's choice. Slot ambiguity
   * auto-resolves (see `primeSlotFor`) — no nested picker inside the career
   * sheet. The browsed card does not count as scouted (`seen`): only cards the
   * reel landed on do.
   *
   * With 🏠 Homegrown armed, the discount travels per-season: only seasons
   * whose card FRANCHISE matches the player's debut franchise sign at $1M
   * (DECISIONS.md round 28 supersedes round 5). A's McGwire on an OAK card —
   * Oakland seasons cost $1M, Cardinals seasons cost full price. The check is
   * `primeDiscountEligible(p, card.franchise)` off the loaded season card
   * (franchise, not team code — see that method), and `primePriceFor`
   * applies the $1M cap.
   *
   * 🔁 Trade Deadline armed and no seat open is the one combination that
   * resolves here rather than being refused: the season takes an occupied
   * chair and spends Trade Deadline, on gap rule 8's precedent that an armed
   * pair resolves and spends both. Without it the pair is armable, the row
   * lights up as Prime-able, the sheet opens, and every season in it is dead —
   * a state the player can enter and cannot resolve. */
  async applyPrime(team: string, year: number): Promise<boolean> {
    if (this.powerups.prime !== "armed" || this.primePick === null)
      return false;
    if (this.phase !== "landed" || this.choicesLeft === 0) return false;
    const id = this.primePick;
    if (this.slots.some((s) => s?.id === id)) return false;
    const card = await loadCard(team, year);
    const p = card.players.find((pl) => pl.id === id);
    if (!p) return false;
    // The intersection rule, engine-side: primeFits grays these rows in the
    // sheet, and this is the refusal the gray cannot be allowed to disagree
    // with — with 🏠 armed, only the discount's own seasons sign.
    if (!this.primeFits(p, card.franchise)) return false;
    const idx = this.primeSlotFor(p);
    if (idx === null) return false;
    this.actionSig = `${this.slots[idx] !== null ? "swap" : "sign"}|${id}|${team}|${year}|${idx}`;
    this.snapshot();
    const trade = this.slots[idx] !== null;
    const discounted = this.primeDiscountEligible(p, card.franchise);
    this.slots[idx] = this.makeSigned(card, p, this.primePriceFor(p, card.franchise), discounted);
    if (discounted) this.spendPowerup("hometown");
    this.spendPowerup("prime");
    if (trade) this.spendPowerup("tradeDeadline");
    this.primePick = null;
    this.consumeChoice({ kind: trade ? "swap" : "sign", war: p.war });
    return true;
  }

  /** Hire a DIFFERENT season of the browsed manager's career — that
   * season's record, with pedigree flags (💍/🚩) from the index rows.
   * Mirrors applyPrime: consumes the powerup and the spin's choice. The
   * manager is Prime's only front-office target (see primeTapSpecial). */
  async applyPrimeSpecial(team: string, year: number): Promise<boolean> {
    if (this.powerups.prime !== "armed" || this.primeSpecial !== "manager")
      return false;
    if (this.phase !== "landed" || this.choicesLeft === 0) return false;
    if (this.specialTaken("manager")) return false;
    const specials = await loadSpecials();
    let entry: SpecialSeason | undefined;
    for (const list of Object.values(specials)) {
      const e = list.find((s) => s.team === team && s.year === year);
      if (e) {
        entry = e;
        break;
      }
    }
    if (!entry || entry.mgr == null) return false;
    const idx = this.index.cards.find(
      (c) => c.team === team && c.year === year,
    );
    this.actionSig = `manager|${team}|${year}`;
    this.snapshot();
    // Read BEFORE the hire lands, the same way `hireOwner` reads its own
    // moment: this pick can be the one that completes the club, and the
    // question is what the rest of the club looked like walking in. ⭐ Prime
    // Time is a first-hire path exactly like the FRONT OFFICE row above it, so
    // both write the flag.
    this.managerHiredLast = this.otherSeatsFull;
    this.manager = {
      name: entry.mgr,
      wins: entry.w,
      losses: entry.l,
      year,
      team,
      teamName: entry.name,
      ws: idx?.ws === true,
      pen: idx?.pen === true,
      moty: entry.moty === true,
      hof: entry.hof === true,
    };
    this.spendPowerup("prime");
    this.primeSpecial = null;
    this.consumeChoice({ kind: "manager" });
    return true;
  }

  /** Burn a powerup, and report it.
   *
   * Every one of the six is spent through here so the analytics event has one
   * emitter rather than eight. Spending is the only powerup transition worth
   * counting — arming and disarming are browsing, and a pill armed and thought
   * better of is not a use — and routing it through the state change means a
   * seventh powerup is reported by construction instead of by remembering.
   *
   * `track()` is a no-op without gtag, on localhost, and on the ?lab route, so
   * this costs a function call in tests and in the harness. */
  private spendPowerup(key: PowerupKey): void {
    this.powerups[key] = "spent";
    track("powerup_used", { key });
  }

  private disarmToggles(): void {
    if (this.powerups.doublePlay === "armed") {
      this.powerups.doublePlay = "ready";
      this.choicesLeft = Math.max(0, this.choicesLeft - 1);
    }
    if (this.powerups.tradeDeadline === "armed")
      this.powerups.tradeDeadline = "ready";
    if (this.powerups.prime === "armed") this.powerups.prime = "ready";
    if (this.powerups.hometown === "armed") this.powerups.hometown = "ready";
    this.clearTransients();
  }

  private clearTransients(): void {
    this.slotPick = null;
    this.releasePick = null;
    this.primePick = null;
    this.primeSpecial = null;
  }

  // ---------- choices ----------

  private makeSigned(
    c: Card,
    p: CardPlayer,
    costPaid: number,
    discounted: boolean,
  ): Signed {
    return {
      id: p.id,
      name: p.name,
      pos: p.pos,
      war: p.war,
      awards: p.awards,
      ws: p.ws,
      pen: p.pen,
      year: c.year,
      team: c.team,
      teamName: c.name,
      franchise: c.franchise,
      costPaid,
      hero: discounted,
      prorated: c.prorated,
      age: p.age,
      bc: p.bc,
      hof: p.hof,
      wbc: p.wbc,
    };
  }

  private consumeChoice(entry: SpinLogEntry): void {
    // 🔂 DÉJÀ VU: the pending sig from undo() matches this action's sig.
    // Sticky — once set it stays for the rest of the run.
    if (
      !this.redone &&
      this.pendingRedoSig !== null &&
      this.pendingRedoSig === this.actionSig
    )
      this.redone = true;
    // Clear the pending sig regardless of match — any committed action closes
    // the redo window. actionSig is kept so undo() can capture it: it holds
    // the signature of the LAST committed action, and undo() reads it as the
    // signature of whatever it is about to revert.
    this.pendingRedoSig = null;
    this.choicesUsed += 1;
    this.choicesLeft -= 1;
    // Double Play burns only when its second pick lands.
    if (this.powerups.doublePlay === "armed" && this.choicesUsed >= 2)
      this.spendPowerup("doublePlay");
    this.spinLog = [...this.spinLog, entry];
    this.clearTransients();
    if (this.choicesLeft === 0 || !this.anyActionable()) this.endSpin();
    else this.save();
  }

  /** Forfeit a remaining Double Play pick and move on (DP refunds). The UI
   * has no button for this — disarming the ✌️ pill is the player's exit —
   * but bots and tests use it as the programmatic equivalent. */
  finishSpin(): void {
    if (this.phase !== "landed" || this.choicesUsed === 0) return;
    this.endSpin();
  }

  /** Free respin out of a dead card. */
  coldRespin(): void {
    if (!this.coldStove) return;
    // Not a committed choice — bypasses consumeChoice — so clear any pending
    // redo sig rather than letting it outlive the re-deal.
    this.actionSig = null;
    this.pendingRedoSig = null;
    this.snapshot();
    this.spinCount -= 1;
    this.phase = "preSpin";
    this.save();
  }

  private endSpin(): void {
    if (this.powerups.doublePlay === "armed")
      this.powerups.doublePlay = "ready";
    if (this.powerups.tradeDeadline === "armed")
      this.powerups.tradeDeadline = "ready";
    if (this.powerups.prime === "armed") this.powerups.prime = "ready";
    if (this.powerups.hometown === "armed") this.powerups.hometown = "ready";
    if (this.complete) {
      // A complete club ends the game — unspent powerups are just left money.
      void this.finishGame();
    } else {
      this.phase = "preSpin";
      this.save();
    }
  }

  /** Sign an open player. When more than one specialist slot type is open the
   * rail becomes a slot picker (DECISIONS.md #4) — re-call with slotIdx. */
  signPlayer(p: CardPlayer, slotIdx?: number): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (this.marketBlocks(p)) return;
    if (this.playerState(p) !== "open") return;
    const open = this.openSlotsFor(p);
    const specialist = open.filter((i) => SLOT_TYPES[i] !== "FLEX");
    let idx: number;
    if (slotIdx !== undefined) {
      if (!open.includes(slotIdx)) return;
      idx = slotIdx;
    } else if (specialist.length === 0) {
      idx = open[0]; // FLEX only
    } else {
      const types = new Set(specialist.map((i) => SLOT_TYPES[i]));
      if (types.size === 1) idx = specialist[0];
      else {
        this.slotPick = p.id; // ambiguous: rail picker
        this.save();
        return;
      }
    }
    // After the slot picker's early return above: opening the picker commits
    // nothing, and a point taken there would overwrite the real one with the
    // position the player is already standing in.
    this.actionSig = `sign|${p.id}|${this.card!.team}|${this.card!.year}|${idx}`;
    this.snapshot();
    const discounted = this.discountEligible(p);
    this.slots[idx] = this.makeSigned(
      this.card!,
      p,
      this.priceFor(p),
      discounted,
    );
    if (discounted) this.spendPowerup("hometown");
    this.consumeChoice({ kind: "sign", war: p.war });
  }

  /** Tapping the pending row again answers an open picker with "never mind" —
   * the same toggle gesture a SIGN confirm already honors. One method for
   * both pickers: at most one of the two ids is ever set, and the caller has
   * already matched the row to it. Clearing costs no choice and rewinds
   * nothing — opening a picker committed nothing to rewind. */
  cancelPick(): void {
    this.slotPick = null;
    this.releasePick = null;
    this.save();
  }

  /** Rail cells pickable during slotPick: open eligible specialist cells. */
  pickableSlotCells(p: CardPlayer): number[] {
    const specialist = this.openSlotsFor(p).filter(
      (i) => SLOT_TYPES[i] !== "FLEX",
    );
    return specialist.length > 0 ? specialist : this.openSlotsFor(p);
  }

  hireOwner(): void {
    if (this.frontOfficeBlocks()) return;
    if (this.fixedCap) return;
    if (
      this.phase !== "landed" ||
      this.choicesLeft === 0 ||
      this.owner ||
      !this.card
    )
      return;
    const c = this.card;
    this.actionSig = `owner|${c.franchise}|${c.year}`;
    this.snapshot();
    // Read BEFORE the choice is consumed: this hire can itself be the pick
    // that ends the game, and the question is what the roster looked like
    // walking in.
    this.ownerHiredLast = this.rosterFull;
    this.owner = {
      name: this.ownerName,
      budget: c.budget,
      franchise: c.franchise,
      year: c.year,
      teamName: c.name,
    };
    this.consumeChoice({ kind: "owner" });
  }

  buyStadium(): void {
    if (this.frontOfficeBlocks()) return;
    if (this.fixedCap) return;
    if (
      this.phase !== "landed" ||
      this.choicesLeft === 0 ||
      this.stadium ||
      !this.card
    )
      return;
    const c = this.card;
    this.actionSig = `stadium|${c.franchise}|${c.year}`;
    this.snapshot();
    this.stadium = {
      park: c.park,
      mult: c.stadiumMult,
      franchise: c.franchise,
      year: c.year,
    };
    this.consumeChoice({ kind: "stadium" });
  }

  hireManager(): void {
    if (this.frontOfficeBlocks()) return;
    if (
      this.phase !== "landed" ||
      this.choicesLeft === 0 ||
      this.manager ||
      !this.card
    )
      return;
    const c = this.card;
    if (c.manager == null) return;
    this.actionSig = `manager|${c.team}|${c.year}`;
    this.snapshot();
    // The moment 🪑 THE INTERIM reads, recorded as it happens for the reason
    // beside `managerHiredLast`.
    this.managerHiredLast = this.otherSeatsFull;
    this.manager = {
      name: c.manager,
      wins: c.wins,
      losses: c.losses,
      year: c.year,
      team: c.team,
      teamName: c.name,
      ws: c.ws,
      pen: c.pen,
      moty: c.managerMoty === true,
      hof: c.managerHof === true,
    };
    this.consumeChoice({ kind: "manager" });
  }

  // ---------- Trade Deadline swaps ----------

  /** Armed TD, tap a trade candidate: pick who they replace (or complete if
   * only one seat is eligible). Open rows count too — arming TD routes the
   * tap through the trade, so an open seat elsewhere never blocks a swap. */
  tdTapPlayer(p: CardPlayer): void {
    if (this.phase !== "landed" || this.choicesLeft === 0) return;
    if (!this.tdCandidate(p)) return;
    const occupied = this.occupiedSlotsFor(p);
    if (occupied.length === 0) return;
    if (occupied.length === 1) this.completeSwap(p, occupied[0]);
    else {
      this.releasePick = p.id;
      this.save();
    }
  }

  tdRelease(p: CardPlayer, slotIdx: number): void {
    if (this.powerups.tradeDeadline !== "armed" || this.releasePick !== p.id)
      return;
    if (!this.occupiedSlotsFor(p).includes(slotIdx)) return;
    this.completeSwap(p, slotIdx);
  }

  private completeSwap(p: CardPlayer, idx: number): void {
    this.actionSig = `swap|${p.id}|${this.card!.team}|${this.card!.year}|${idx}`;
    this.snapshot();
    // TD + 🏠 both armed: a debut-eligible trade-in commits at the discounted
    // price and consumes both powerups.
    const discounted = this.discountEligible(p);
    this.slots[idx] = this.makeSigned(
      this.card!,
      p,
      this.priceFor(p),
      discounted,
    );
    if (discounted) this.spendPowerup("hometown");
    this.spendPowerup("tradeDeadline");
    this.consumeChoice({ kind: "swap", war: p.war });
  }

  /** Armed TD, tap a taken special: 1-for-1 replacement, no picker. */
  tdTapSpecial(which: SpecialKey): void {
    if (this.frontOfficeBlocks()) return;
    if (
      this.powerups.tradeDeadline !== "armed" ||
      this.choicesLeft === 0 ||
      !this.card
    )
      return;
    if (!this.specialTaken(which)) return;
    const c = this.card;
    // Hoisted above the branch so every refusal is behind us before the point
    // is taken: a snapshot on a tap that then bails would overwrite a real one
    // with the position the club is already standing in.
    if (which === "manager" && c.manager == null) return;
    this.actionSig = `swapspecial|${which}|${c.team}|${c.year}`;
    this.snapshot();
    if (which === "owner") {
      this.owner = {
        name: this.ownerName,
        budget: c.budget,
        franchise: c.franchise,
        year: c.year,
        teamName: c.name,
      };
    } else if (which === "stadium") {
      this.stadium = {
        park: c.park,
        mult: c.stadiumMult,
        franchise: c.franchise,
        year: c.year,
      };
    } else {
      this.manager = {
        name: c.manager!,
        wins: c.wins,
        losses: c.losses,
        year: c.year,
        team: c.team,
        teamName: c.name,
        ws: c.ws,
        pen: c.pen,
        moty: c.managerMoty === true,
        hof: c.managerHof === true,
      };
    }
    this.spendPowerup("tradeDeadline");
    this.consumeChoice({ kind: "swap" });
  }

  // ---------- the code ----------

  /** Record the Konami code, and persist it immediately.
   *
   * Idempotent and side-effect-free beyond the flag: entering the sequence a
   * second time is not a second badge and not a second write. The finale is
   * refused because a finished game has already resolved its badges and
   * `save()` refuses to write a finale into the in-progress key — a keystroke
   * there would be recorded nowhere and read by nobody.
   *
   * It grants nothing. See the `konami` field above and the 🎮 definition in
   * lib/badges. */
  markKonami(): void {
    if (this.phase === "finale" || this.konami) return;
    this.konami = true;
    this.save();
  }

  // ---------- finale ----------

  /** Seasons this club holds that the reel never landed on — ⭐ Prime Time is
   * the only way to reach one. Each comes back narrowed to the single item the
   * powerup actually bought, so the dream solver can match what the player did
   * without inheriting a whole card nobody ever saw. */
  private async offReelCards(): Promise<Card[]> {
    const seen = new Set(this.seen.map((s) => `${s.team}|${s.year}`));
    const wanted = new Map<string, { team: string; year: number; players: Set<string>; manager: boolean }>();
    const want = (team: string, year: number) => {
      const key = `${team}|${year}`;
      if (seen.has(key)) return null;
      let entry = wanted.get(key);
      if (!entry) {
        entry = { team, year, players: new Set(), manager: false };
        wanted.set(key, entry);
      }
      return entry;
    };
    for (const s of this.slots) {
      if (!s) continue;
      want(s.team, s.year)?.players.add(s.id);
    }
    if (this.manager) {
      const e = want(this.manager.team, this.manager.year);
      if (e) e.manager = true;
    }
    // One card that won't load must not cost the whole yardstick: the pool of
    // spun cards is the yardstick, and these are an extra on top of it.
    const loaded = await Promise.all(
      [...wanted.values()].map(async (w) => {
        try {
          const card = await loadCard(w.team, w.year);
          return {
            ...card,
            players: card.players.filter((p) => w.players.has(p.id)),
            manager: w.manager ? card.manager : null,
          };
        } catch {
          return null;
        }
      }),
    );
    return loaded.filter((c): c is Card => c !== null);
  }

  private async finishGame(): Promise<void> {
    // Dropped first, before a single await. `endSpin` hands a complete club to
    // this method and returns, leaving the phase on "landed" until the dream
    // solve below resolves — a window with the HUD up in which `canUndo` would
    // otherwise still be true, and a rewind taken inside it would have this
    // method finish a game that no longer exists.
    this.undoPoint = null;
    const players = this.slots.filter((s): s is Signed => s !== null);
    // Reload every card this game landed on (all memoized from play) and solve
    // for the best club those cards could have produced — the finale's scouting
    // yardstick. Roster and skipper come out of one joint solve: a spin buys one
    // thing from the card it lands on, so the dream manager competes with the
    // dream team for cards (bestroster.ts carries the full rules).
    let best: BestRoster | null = null;
    let bestManager: BestManager | null = null;
    try {
      const cards = await Promise.all(
        this.seen.map((s) => loadCard(s.team, s.year)),
      );
      best = bestRoster(cards, {
        // Moneyball / Blank Check hand out the cap, so the dream club has no
        // owner or ballpark to solve for.
        fixedBudgetM: this.fixedCap ? this.effectiveBudget : null,
        offReel: await this.offReelCards(),
      });
      bestManager = best.manager ?? null;
    } catch {
      /* offline mid-game: finish without the yardstick */
    }
    const playerHits =
      best?.picks.filter(
        (b) =>
          b != null &&
          players.some(
            (p) => p.id === b.id && p.year === b.year && p.team === b.team,
          ),
      ).length ?? 0;
    const managerHit =
      bestManager !== null &&
      this.manager !== null &&
      this.manager.team === bestManager.team &&
      this.manager.year === bestManager.year;
    const scoutHitsRaw = playerHits + (managerHit ? 1 : 0);
    // solvedTotal is computed here, before score(), so beatCeilingDecision can
    // compare the initial parts.total against it without circularity.
    const solvedTotal = best?.total ?? null;
    let parts = score({
      totalWar: this.totalWar,
      spendM: this.spend,
      budgetM: this.effectiveBudget,
      awardLists: players.map((p) => p.awards),
      rings: this.pedigree.rings,
      pennants: this.pedigree.pennants,
      managerRecord: this.manager
        ? [this.manager.wins, this.manager.losses]
        : null,
      scoutHits: scoutHitsRaw,
      managerMoty: this.manager?.moty === true,
      wbcChampions: this.pedigree.wbcChampions,
      wbcRunnersUp: this.pedigree.wbcRunnersUp,
    });
    let stamp = recordFromTotal(parts.total, GAMES, MARINERS_WINS);
    // beatCeiling: evaluated on the pre-upgrade total so the comparison is
    // circular-free. If true, scoutHits upgrades to the dream club's fill count
    // and the score is recomputed with the new count before anything else reads
    // it — wins, losses, badges, and the finale object all use the final parts.
    const { beatCeiling, scoutHits } = beatCeilingDecision(
      parts.total,
      solvedTotal,
      scoutHitsRaw,
      best?.dreamSeats ?? 0,
    );
    if (scoutHits !== scoutHitsRaw) {
      parts = score({
        totalWar: this.totalWar,
        spendM: this.spend,
        budgetM: this.effectiveBudget,
        awardLists: players.map((p) => p.awards),
        rings: this.pedigree.rings,
        pennants: this.pedigree.pennants,
        managerRecord: this.manager
          ? [this.manager.wins, this.manager.losses]
          : null,
        scoutHits,
        managerMoty: this.manager?.moty === true,
        wbcChampions: this.pedigree.wbcChampions,
        wbcRunnersUp: this.pedigree.wbcRunnersUp,
      });
      stamp = recordFromTotal(parts.total, GAMES, MARINERS_WINS);
    }
    const [wins, losses] = displayRecord(parts.expectedWins);
    // 🗺️ reads the alignment each player's OWN season played in, off the index
    // rows: pre-1994 there was no Central, Houston was NL through 2012,
    // Milwaukee AL through 1997. A single modern map would have the badge
    // assert that 1992 Houston played in a division that did not exist yet.
    // A row missing lg/div contributes no division rather than a guessed one.
    const alignment = new Map(
      this.index.cards
        .filter((c) => c.lg && c.div)
        .map((c) => [`${c.team}|${c.year}`, `${c.lg}/${c.div}`]),
    );
    const powerupStates = Object.values(this.powerups);
    // The record the finale actually stamps, which is a different ladder from
    // the baseline above: `wins` is expected wins alone, and this is the total
    // after awards, rings, the payroll bonus and the luxury tax. The on-field
    // rungs are gated on both — the baseline names the rung, the stamp decides
    // whether it held — so this has to be built from the same call
    // `Finale.svelte` renders from or the badge and the screen can disagree.
    // `stamp` is computed above (before and after any beatCeiling scout upgrade).
    // 🧠's fact, and it reads the solver's RAW answer rather than the ceiling
    // the finale prints. `bestPossibleTotal` below is `max(solved, total)` —
    // the played club is a proven-reachable incumbent, so the printed ceiling
    // can never sit under it — which means only `best.total` can say whether
    // the club actually passed the solve. Strictly greater: a tie is
    // `playedTheCeiling`, not a win.
    const beatDream = solvedTotal !== null && parts.total > solvedTotal;
    const badges = earnedBadges({
      baselineWins: wins,
      baselineLosses: losses,
      stamp: { wins: stamp.wins, losses: stamp.losses },
      total: parts.total,
      beatDream,
      spendM: this.spend,
      budgetM: this.effectiveBudget,
      budgetBonus: parts.budgetBonus,
      scoutHits,
      // 🌠's denominator. Zero when the dream solve could not run at all
      // (offline mid-game), which is the same answer as a partial club as far
      // as the badge is concerned — it asks for nine on the nose.
      dreamSeats: best?.dreamSeats ?? 0,
      roster: players.map((p) => ({
        id: p.id,
        name: p.name,
        war: p.war,
        awards: p.awards,
        year: p.year,
        team: p.team,
        pos: p.pos,
        franchise: p.franchise,
        costPaid: p.costPaid,
        hero: p.hero,
        age: p.age,
        country: p.bc,
        hof: p.hof,
      })),
      managerHof: this.manager?.hof === true,
      ownerLast: this.ownerHiredLast,
      managerLast: this.managerHiredLast,
      // The skipper's own net, never the club's stamp — 🪑 is a verdict on the
      // chair. Absent dugout reads as zero, which is not under .500.
      managerNetWins: this.manager
        ? this.manager.wins - this.manager.losses
        : 0,
      konami: this.konami,
      undone: this.undoUsed,
      redone: this.redone,
      managerTeam: this.manager?.team ?? null,
      managerYear: this.manager?.year ?? null,
      managerName: this.manager?.name ?? null,
      rings: this.pedigree.rings,
      awardPoints: parts.awardPoints,
      managerMoty: this.manager?.moty === true,
      owner: this.owner,
      stadium: this.stadium,
      divisions: players.flatMap(
        (p) => alignment.get(`${p.team}|${p.year}`) ?? [],
      ),
      powerups: {
        spent: powerupStates.filter((s) => s === "spent").length,
        total: powerupStates.length,
      },
      beatCeiling,
    });
    // Strictly before recordHistory below, which appends this game's keys.
    // The very first game flags everything it earns, which is correct rather
    // than noisy: on an empty log every badge genuinely is a first.
    const seenBefore = earnedBadgeKeys();
    const newBadges = badges.filter((k) => !seenBefore.has(k));
    // The club actually built is a proven-reachable club, so it is the search's
    // incumbent: the ceiling is never below it. The solver normally clears it by
    // a wide margin; it can lose only on a line the search does not model (✌️
    // Double Play taking two picks off one card, or the reel landing on one card
    // twice), and printing "your best was worse than what you did" would be a
    // bug on screen either way.
    // `solvedTotal` is the raw solve read above for 🧠; the ceiling is that
    // clamped up to the played club.
    const bestPossibleTotal =
      best === null || solvedTotal === null
        ? null
        : Math.max(solvedTotal, parts.total);
    this.finale = {
      parts,
      wins,
      losses,
      badges,
      newBadges,
      spend: this.spend,
      budget: this.effectiveBudget,
      spinCount: this.spinCount,
      totalWar: this.totalWar,
      best,
      bestManager,
      managerHit,
      scoutHits,
      bestPossibleTotal,
      bestPossibleRecord:
        bestPossibleTotal === null
          ? null
          : recordFromTotal(bestPossibleTotal, GAMES, MARINERS_WINS),
      playedTheCeiling: bestPossibleTotal !== null && bestPossibleTotal <= parts.total,
      beatCeiling,
    };
    this.phase = "finale";
    // The id tying this season's log row to its archive record. Minted here,
    // once, and handed to both writers: the row is what the seasons list draws
    // and the record is what it opens, so a row pointing at nothing would be a
    // season that silently refuses to reopen.
    //
    // `crypto.randomUUID` is not reached for. The collision this has to survive
    // is two games finishing in the same millisecond, and one player on one
    // device cannot do that; the seed rides along only so a seed replayed twice
    // in a day still writes two distinct ids.
    const id = `${Date.now().toString(36)}-${(this.seed >>> 0).toString(36)}`;
    this.recordHistory(id);
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
    // Strictly after the in-progress save is dropped: the two keys describe
    // states that must never both hold, and this order means a storage failure
    // leaves the older, smaller record rather than both.
    this.archiveFinale(id);
  }

  /** Write the finale the screen is about to render, claim the screen, and add
   * the season to the replayable archive.
   *
   * TWO writes, in this order, and the order is the point. `hotstove.finale` is
   * the LAST game and backs both the boot claim and the finale a reload lands
   * on, so it is written first and on its own budget — a quota failure in the
   * archive must never cost the player the finale they are looking at. The
   * archive is the bounded tail of every season and evicts its own oldest
   * record to fit, so it competes with neither the key above nor
   * `hotstove.current`.
   *
   * A `FINALE_VERSION` bump retires archived rows on its own: `loadArchive`
   * checks `v` (the constant lives in lib/history for exactly this reason), so
   * a record this build can no longer render is dropped there just as
   * `loadStoredFinale` drops it from `hotstove.finale`.
   *
   * Guarded like every other write here: a full or disabled localStorage costs
   * the reload, never the finale the player already earned. The claim is set
   * only after the archive lands, so a quota failure can't leave a boot claim
   * pointing at nothing. */
  private archiveFinale(id: string): void {
    if (!this.finale) return;
    const rec = {
      v: FINALE_VERSION,
      seed: this.seed,
      config: this.config,
      spinCount: this.spinCount,
      seen: this.seen,
      slots: this.slots,
      owner: this.owner,
      stadium: this.stadium,
      manager: this.manager,
      finale: this.finale,
    } satisfies StoredFinale;
    try {
      localStorage.setItem(FINALE_KEY, JSON.stringify(rec));
      claimFinale();
    } catch {
      /* storage unavailable */
    }
    // Outside that try on purpose: `archiveGame` swallows its own failure and
    // evicts to make room, so catching here would only hide which write failed.
    archiveGame({ ...rec, id });
  }

  private recordHistory(id: string): void {
    if (!this.finale) return;
    // Player ids by birth country. The passport counts unique PEOPLE across a
    // career, so a man rostered in three separate seasons has to be recognizable
    // as the same man three times — names collide and a count cannot be unioned,
    // so it is ids or nothing.
    const countryPlayers: Record<string, string[]> = {};
    for (const p of this.slots) {
      if (!p || typeof p.bc !== "string" || p.bc === "") continue;
      const ids = (countryPlayers[p.bc] ??= []);
      if (!ids.includes(p.id)) ids.push(p.id);
    }
    // Sorted so two identical clubs write identical rows.
    for (const ids of Object.values(countryPlayers)) ids.sort();
    appendHistory({
      v: 2, // two-rung ladder era; disambiguates "scout" from the old stats mode
      date: localDateStamp(),
      seed: this.seed,
      // Beside the seed because both identify the game — this one points the
      // seasons list at the record it opens.
      id,
      total: this.finale.parts.total,
      record: `${this.finale.wins}-${this.finale.losses}`,
      spins: this.finale.spinCount,
      difficulty: this.config.difficulty,
      bank: this.config.bank,
      // Keys, never labels — the trophy case unions these across every game
      // ever played, so a copy edit must not orphan an earned badge.
      badges: this.finale.badges,
      // Distinct, so the row says which countries the club held rather than how
      // many men came from each — the passport counts one visit per season per
      // country. Sorted so two identical clubs write identical rows.
      // Derived from the map's own keys rather than gathered a second time, so
      // the two fields cannot disagree about which countries a club held.
      countries: Object.keys(countryPlayers).sort(),
      countryPlayers,
    });
  }

  // ---------- undo (one move back) ----------

  /** Is there a move to take back?
   *
   * The finale is refused on `save()`'s boundary exactly — a finished season
   * has resolved its badges and written its history row, and there is nothing
   * left that a rewind could mean.
   *
   * MID-REEL IS ALLOWED, and it is the only window that matters. The stove
   * never idles: committing a pick drops `choicesLeft` to zero and SpinBanner
   * spins on the next turn of the event loop, so "landed" and "preSpin" are
   * both gone within a millisecond of the tap that earned the point. A rule
   * that stopped there left the pill dead for the two seconds a player spends
   * looking at the pick he just regretted, and live only once the NEXT card had
   * already landed on top of it. The reel is exactly when a player wants out.
   *
   * What makes it safe is `spinEpoch`: `undo()` bumps it, and `land()` writes
   * nothing once the epoch it started on has moved, so the fetch still in
   * flight cannot land on top of the rewind.
   *
   * A MOVE only — a point taken at "landed" — is reachable from EVERY phase.
   * A point taken at "preSpin" belongs to the automatic roll, which no tap
   * asked for and which would re-deal the identical card (the cursor rewinds
   * with everything else), so taking it back spends the one rewind a game gets
   * on nothing at all. Exactly one such point exists: the game's opening deal,
   * whose snapshot spin() takes because nothing has taken one yet. Before this
   * gate covered the landed phase too, the pill lit up on that first card with
   * a rewind to an identical position behind it. */
  get canUndo(): boolean {
    if (this.undoPoint === null || this.undoPoint.phase !== "landed") return false;
    return this.phase === "preSpin" || this.phase === "landed" || this.phase === "spinning";
  }

  /** Hold the position, for `undo()` to put back.
   *
   * Called at the top of every COMMITTED move, before it mutates anything: a
   * spin, a re-spin off 🎟️/🚚, a cold-stove respin, and every choice the spin
   * buys (sign, swap, owner, ballpark, skipper, both ⭐ Prime Time paths).
   * Arming a powerup and opening a picker are not moves and take no point —
   * the player reverses those by tapping the same pill again, and spending an
   * undo on one would cost them the move behind it. */
  private snapshot(): void {
    this.undoPoint = {
      state: JSON.stringify(this.serialize()),
      card: this.card,
      phase: this.phase,
    };
  }

  /** Take back the last committed move, once. The point is consumed here, so
   * undo cannot run twice in a row; the next committed move takes a fresh one
   * and undo is available again. */
  undo(): void {
    if (!this.canUndo) return;
    const point = this.undoPoint!;
    this.undoPoint = null;
    this.undoUsed = true;
    // Capture the undone action's signature so the very next consumeChoice
    // can check for an instant redo (🔂 DÉJÀ VU). If no action had been
    // committed yet, actionSig is null and no redo can fire — correct.
    this.pendingRedoSig = this.actionSig;
    // The reel in flight is abandoned here, before a single field moves.
    // Dropping the pending fetch stops a `land()` that has not started; the
    // epoch stops the one already parked on the await, which has its own
    // reference to the promise and cannot be reached any other way. Both are
    // needed, and the epoch is the one that closes the race. `loadFailed` goes
    // with them: a rewind out of a stranded SIGNAL LOST spin must not leave the
    // retry notice up over a position that has no fetch to retry.
    this.spinEpoch += 1;
    this.pendingCard = null;
    this.pendingEntry = null;
    this.loadFailed = false;
    const s = JSON.parse(point.state);
    this.hydrate(s);
    // The card object itself rather than its reference: `undo` is synchronous
    // because the snapshot kept the card it was standing on, and a rewind the
    // player waits on a fetch for is a rewind they can tap through.
    this.card = point.card;
    this.phase = s.phase;
    // No transient is serialized, so a half-open picker has nothing to put
    // back — the base landed state, the same answer `restore()` gives a reload
    // that lands mid-picker.
    this.clearTransients();
    this.save();
  }

  // ---------- persistence (iOS Safari evicts tabs; resume must be exact) ----------

  /** The one description of a game in flight: what `save()` writes, what
   * `undo()` holds, and what `hydrate()` reads back. Written once so the
   * resume path and the rewind path cannot drift apart.
   *
   * `rngState` is load-bearing for both of them — it is what makes a resumed
   * game and an undone move deal the cards the seed says they deal. */
  private serialize() {
    return {
      v: SAVE_VERSION,
      config: this.config,
      seed: this.seed,
      rngState: this.rng.state,
      spinCount: this.spinCount,
      seen: this.seen,
      phase: this.phase === "spinning" ? "preSpin" : this.phase,
      cardRef: this.card
        ? { team: this.card.team, year: this.card.year }
        : null,
      slots: this.slots,
      owner: this.owner,
      ownerHiredLast: this.ownerHiredLast,
      stadium: this.stadium,
      manager: this.manager,
      managerHiredLast: this.managerHiredLast,
      konami: this.konami,
      undoUsed: this.undoUsed,
      redone: this.redone,
      powerups: this.powerups,
      choicesLeft: this.choicesLeft,
      choicesUsed: this.choicesUsed,
      spinLog: this.spinLog,
    };
  }

  /** Put a serialized POSITION back on this Game — where the club stands, and
   * nothing about the run it belongs to.
   *
   * `seed` and `config` are absent because they are constructor arguments and
   * never change. `konami` and `undoUsed` are absent for a sharper reason:
   * both are facts about the RUN, and `undo()` restores a snapshot taken
   * BEFORE the thing they record. Carrying them here would let a rewind erase
   * a keystroke typed after the move, and would clear `undoUsed` on the very
   * call that sets it. `restore()` reads both straight off the save instead,
   * where the save genuinely is the whole run.
   *
   * `phase` and `card` are the callers' business too: `restore()` re-fetches
   * the card by reference and decides between landed and preSpin, `undo()`
   * already holds the card object and the phase it snapshotted.
   *
   * The argument is untyped because it genuinely is: it is `JSON.parse` output
   * from any of three save versions, and v4/v5 records are missing fields by
   * design (the file migrates nothing — it tolerates absences). */
  private hydrate(s: any): void {
    this.rng.state = s.rngState;
    this.spinCount = s.spinCount;
    this.seen = s.seen ?? [];
    this.slots = s.slots;
    this.owner = s.owner;
    this.ownerHiredLast = s.ownerHiredLast === true;
    this.stadium = s.stadium;
    this.manager = s.manager;
    this.managerHiredLast = s.managerHiredLast === true;
    this.powerups = s.powerups;
    this.choicesLeft = s.choicesLeft;
    this.choicesUsed = s.choicesUsed;
    this.spinLog = s.spinLog;
  }

  save(): void {
    if (this.phase === "finale") return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize()));
    } catch {
      /* storage unavailable */
    }
  }

  /** Abandon any saved game (the header's restart action). */
  static clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  /** Rebuild the finished game the finale screen renders, from the archive.
   *
   * Field assignment only — `finishGame` never runs a second time, so the
   * history row is not re-appended and the badges are not re-resolved. The
   * result is a read-only Game: `phase === "finale"` means `save()` refuses to
   * write it into the in-progress key, exactly as it always has. Synchronous
   * because a finale needs no card fetch: everything on screen was resolved
   * when the game ended and travels inside the record. */
  static fromStoredFinale(
    meta: Meta,
    index: GameIndex,
    owners: Owners,
    rec: StoredFinale | null = loadStoredFinale(),
  ): Game | null {
    if (!rec) return null;
    const game = new Game(
      meta,
      index,
      owners,
      rec.seed,
      rec.config ?? DEFAULT_CONFIG,
    );
    game.spinCount = rec.spinCount ?? 0;
    game.seen = rec.seen ?? [];
    game.slots = rec.slots;
    game.owner = rec.owner ?? null;
    game.stadium = rec.stadium ?? null;
    game.manager = rec.manager ?? null;
    game.finale = rec.finale;
    game.phase = "finale";
    return game;
  }

  /** Boot: the finale the player never dismissed, or null to land home.
   *
   * The claim says which one — the live finale, or the archived season the
   * seasons list was reopened into — so a reload puts back the club that was on
   * screen rather than the most recent one.
   *
   * A claim whose record has gone missing or unreadable drops the claim and
   * lands home. That is the ordinary end of an old season, not an error: the
   * archive holds a bounded tail, so a claimed season can be evicted by the
   * fifty games played after it. A boot claim can never resurrect a finale that
   * cannot be rendered. */
  static resumeFinale(meta: Meta, index: GameIndex, owners: Owners): Game | null {
    if (!finaleClaimed()) return null;
    const id = claimedArchiveId();
    const rec =
      id === null ? loadStoredFinale() : (loadArchive().find((r) => r.id === id) ?? null);
    const game = Game.fromStoredFinale(meta, index, owners, rec);
    if (!game) releaseFinale();
    return game;
  }

  static async restore(
    meta: Meta,
    index: GameIndex,
    owners: Owners,
  ): Promise<Game | null> {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (s.v !== SAVE_VERSION && s.v !== 5 && s.v !== 4) return null;
      // v4 → v5: the Hometown Hero combo became the 🏠 Homegrown powerup; an
      // in-flight save's heroUsed maps to the powerup's spent/ready state.
      if (s.v === 4)
        s.powerups = {
          ...s.powerups,
          hometown: s.heroUsed ? "spent" : "ready",
        };
      const game = new Game(
        meta,
        index,
        owners,
        s.seed,
        s.config ?? DEFAULT_CONFIG,
      );
      // The position, through the same reader `undo()` uses. Absent fields read
      // conservatively inside it — `ownerHiredLast` on a save written before
      // that field means "not flying blind", the same way every optional fact
      // here fails: a badge is withheld, never invented. (Older saves also
      // carry a tdBonus field from the retired bonus-spin rule — ignored; a
      // restored complete club simply finishes on its next endSpin.)
      game.hydrate(s);
      // The two RUN facts, read here rather than in `hydrate` because a rewind
      // must not erase them (see the note there). Both default false on a save
      // written before their field: an unrecorded keystroke is not a keystroke,
      // and an unrecorded rewind is not a rewind.
      game.konami = s.konami === true;
      game.undoUsed = s.undoUsed === true;
      game.redone = s.redone === true;
      if (s.cardRef && s.phase === "landed") {
        game.card = await loadCard(s.cardRef.team, s.cardRef.year);
        game.phase = "landed";
        // A reload mid-picker restores to the base landed state.
        if (game.powerups.tradeDeadline === "armed")
          game.powerups.tradeDeadline = "ready";
        if (game.powerups.prime === "armed") game.powerups.prime = "ready";
        if (game.powerups.hometown === "armed")
          game.powerups.hometown = "ready";
        if (game.powerups.doublePlay === "armed") {
          game.powerups.doublePlay = "ready";
          game.choicesLeft = Math.max(0, game.choicesLeft - 1);
          // Reloading between a Double Play's two picks forfeits the second
          // one, and a forfeited last choice ends the spin — the same rule
          // `toggleDoublePlay` applies when the pill is disarmed by hand, run
          // through the same `endSpin` so the two paths cannot drift.
          //
          // Ending it is not a nicety. Every action on a landed card is gated
          // on `choicesLeft > 0`, and the only exits from a landed card are
          // committing a choice or disarming the pill. Restoring to "landed,
          // nothing left, no armed pill" satisfies neither, so the club sits
          // on a card it can never leave.
          //
          // Ending it here is the one spin end no tap asked for, so it is the
          // one the banner has to explain: `resumedForfeit` tells it to hold
          // the card the pick was spent on instead of rolling straight off it.
          // Set after `endSpin`, and only if the run continues — a club that
          // completed on that pick goes to the finale, which has no reel to
          // hold and nothing to explain. (`complete` rather than the resulting
          // phase: `endSpin` hands a finished club to the async `finishGame`,
          // so "preSpin" is not yet false when this line runs.)
          if (game.choicesLeft === 0 && game.choicesUsed > 0) {
            game.endSpin();
            if (!game.complete) game.resumedForfeit = true;
          }
        }
      } else {
        game.phase = "preSpin";
      }
      return game;
    } catch {
      return null;
    }
  }
}

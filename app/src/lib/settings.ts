/** Mode selection persists across visits (BUILD.md: localStorage
 * `hotstove.settings`), as do the two corner-button attention cues
 * (`hotstove.cues`). */
import { BADGE_BY_KEY, BADGES, COLLECTIBLE, RARITY_ORDER } from "./badges";
import {
  DEFAULT_CONFIG,
  type Bank,
  type Difficulty,
  type GameConfig,
} from "./engine.svelte";
import { loadHistory } from "./history";

const SETTINGS_KEY = "hotstove.settings";
/** v2 = the two-rung ladder. "scout" is a colliding name: pre-v2 it meant the
 * stats mode (now folded into standard); v2+ it means the old eyetest. The
 * version stamp is what disambiguates a stored "scout". */
const SETTINGS_VERSION = 2;
const DIFFICULTIES = new Set<string>(["standard", "scout"]);
const BANKS = new Set<string>(["classic", "moneyball", "blankcheck"]);

/** Pre-v2 difficulties: rookie/standard/scout(stats) → standard, eyetest → scout. */
function legacyDifficulty(d: unknown): Difficulty {
  return d === "eyetest" ? "scout" : "standard";
}

function normalizeBank(s: { bank?: unknown; moneyball?: unknown }): Bank {
  if (typeof s.bank === "string" && BANKS.has(s.bank)) return s.bank as Bank;
  return s.moneyball === true ? "moneyball" : DEFAULT_CONFIG.bank;
}

export function loadSettings(): GameConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const s = JSON.parse(raw);
    const difficulty =
      typeof s.v === "number" && s.v >= 2
        ? DIFFICULTIES.has(s.difficulty)
          ? (s.difficulty as Difficulty)
          : DEFAULT_CONFIG.difficulty
        : legacyDifficulty(s.difficulty);
    return { difficulty, bank: normalizeBank(s) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveSettings(config: GameConfig): void {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ v: SETTINGS_VERSION, ...config }),
    );
  } catch {
    /* storage unavailable */
  }
}

/* ---------- attention cues ---------- */

const CUES_KEY = "hotstove.cues";
const CUES_VERSION = 1;

/** The state behind the two corner-button cues. */
export interface CueState {
  /** Badge keys earned for the first time ever and not yet looked at. A
   * non-empty list lights the trophy pill. Keys rather than a bare boolean so
   * the same finale can be noted twice without double-counting, and so the
   * label can say how many. */
  pendingBadges: string[];
  /** The help sheet has been opened at least once, ever. */
  helpSeen: boolean;
}

/** Fresh, unlit, and what every unreadable store resolves to. */
function noCues(): CueState {
  return { pendingBadges: [], helpSeen: false };
}

/** The cue record, or an unlit one.
 *
 * Deliberately a log of things that happened AFTER this key existed, never a
 * diff against `hotstove.history`: a player who already owns thirty badges
 * must not be told on their next load that all thirty are new. An absent key,
 * a corrupt value, and an unrecognised version all read the same unlit way, so
 * the only path to a lit trophy is a finale this build actually watched.
 *
 * Storage-guarded like everything else in here: both cues are decoration over
 * a game that stays playable without them. */
export function loadCues(): CueState {
  try {
    const raw = localStorage.getItem(CUES_KEY);
    if (!raw) return noCues();
    const s = JSON.parse(raw);
    if (s?.v !== CUES_VERSION) return noCues();
    return {
      pendingBadges: Array.isArray(s.pendingBadges)
        ? s.pendingBadges.filter((k: unknown) => typeof k === "string")
        : [],
      helpSeen: s.helpSeen === true,
    };
  } catch {
    return noCues();
  }
}

function saveCues(cues: CueState): CueState {
  try {
    localStorage.setItem(CUES_KEY, JSON.stringify({ v: CUES_VERSION, ...cues }));
  } catch {
    /* storage unavailable */
  }
  return cues;
}

/** Light the trophy for badges the finale flagged as first-time-ever. Unions
 * rather than replaces: a second finale before the case is opened must not
 * drop the first one's news. */
export function noteNewBadges(keys: readonly string[]): CueState {
  const cues = loadCues();
  const pending = [...cues.pendingBadges];
  for (const k of keys) {
    if (typeof k === "string" && !pending.includes(k)) pending.push(k);
  }
  return saveCues({ ...cues, pendingBadges: pending });
}

/** What the last `clearBadgeCue()` took away, kept in memory only.
 *
 * The trophy case needs the list the cue was holding, but the button clears the
 * cue on the way to opening the case — by the time the sheet mounts, storage
 * has already forgotten. Rather than reorder that (the glow must go out on the
 * tap, not on the sheet's mount), the clear hands its list on. In memory on
 * purpose: a reload has genuinely already shown these, and the stored cue is
 * empty by then, so there is nothing to restore. */
let justCleared: string[] = [];

/** The case has been opened — the trophy goes dark and stays dark. */
export function clearBadgeCue(): CueState {
  const cues = loadCues();
  justCleared = cues.pendingBadges;
  return saveCues({ ...cues, pendingBadges: [] });
}

/** The badges that were still unseen when the case was last opened, for
 * flagging them inside it. Read-once: the second call in a session returns
 * nothing, which is what makes closing and reopening the case show a clean
 * board — "new since you last looked" stops being true the moment you look. */
export function takeOpenedBadgeCue(): string[] {
  const keys = justCleared;
  justCleared = [];
  return keys;
}

/** The help sheet has been opened — the ? goes dark and stays dark. */
export function markHelpSeen(): CueState {
  return saveCues({ ...loadCues(), helpSeen: true });
}

/** Nobody has ever finished a game here. Mid-first-game counts as first-ever
 * on purpose: the player still has not been shown the rules. */
export function firstEverPlay(): boolean {
  return loadHistory().length === 0;
}

/** Best score, best record, and game count for one mode combo. Legacy entries
 * (no v stamp) get the same difficulty mapping as settings; pre-bank entries
 * carry a `moneyball` boolean instead of `bank`. Best record = most wins,
 * fewest losses on ties; entries without a parseable record still count
 * toward games and best score. */
export function bestFor(
  difficulty: Difficulty,
  bank: Bank,
): { best: number | null; bestRecord: string | null; games: number } {
  let best: number | null = null;
  let games = 0;
  let recW = -1;
  let recL = -1;
  for (const e of loadHistory()) {
    if (typeof e?.total !== "number") continue;
    const d =
      typeof e.v === "number" && e.v >= 2
        ? e.difficulty
        : legacyDifficulty(e.difficulty);
    const b = normalizeBank(e);
    if (d !== difficulty || b !== bank) continue;
    games += 1;
    if (best === null || e.total > best) best = e.total;
    const m =
      typeof e.record === "string" ? /^(\d+)[-–](\d+)$/.exec(e.record) : null;
    if (m) {
      const w = Number(m[1]);
      const l = Number(m[2]);
      if (w > recW || (w === recW && l < recL)) {
        recW = w;
        recL = l;
      }
    }
  }
  return { best, bestRecord: recW >= 0 ? `${recW}–${recL}` : null, games };
}

/** One earned badge and how many games earned it. */
export interface CaseTile {
  key: string;
  count: number;
}

/** Ties inside a tier resolve on the badge table's own order, so the case is
 * a pure function of the table and never of which game finished first. */
const TABLE_ORDER = new Map(BADGES.map((b, i) => [b.key, i]));

/** The lifetime trophy case: every badge ever earned, with the number of games
 * that earned it.
 *
 * GLOBAL across difficulty and bank, unlike the record book beside it.
 * Measured rarity differs 2–3x by bank, so per-combo cases would fragment one
 * collection into three half-empty ones. A record book is a leaderboard; a
 * trophy case is a collection. Different objects, different scoping.
 *
 * Derived from `hotstove.history` rather than a `hotstove.badges` key of its
 * own: a second key can drift from history, and a player who cleared one would
 * be surprised by the other surviving.
 *
 * `count` is games, not array elements — an entry listing a key twice still
 * counts once. Keys with no badge definition are dropped: a renamed or retired
 * badge must not inflate the fraction or render a blank tile.
 *
 * `earned`/`total` are the progress fraction, and both exclude anti-trophies.
 * Nobody chases a 100-loss season, so it belongs to neither side of the ratio —
 * but it still gets a tile once it happens, which is the joke.
 */
export function badgeCase(): {
  tiles: CaseTile[];
  earned: number;
  total: number;
} {
  const counts = new Map<string, number>();
  for (const e of loadHistory()) {
    if (!Array.isArray(e?.badges)) continue;
    const seen = new Set<string>();
    for (const k of e.badges) {
      if (typeof k !== "string" || !BADGE_BY_KEY[k] || seen.has(k)) continue;
      seen.add(k);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const tiles = [...counts].map(([key, count]) => ({ key, count }));
  tiles.sort((a, a2) => {
    const ra = RARITY_ORDER.indexOf(BADGE_BY_KEY[a.key].rarity);
    const rb = RARITY_ORDER.indexOf(BADGE_BY_KEY[a2.key].rarity);
    return ra !== rb
      ? ra - rb
      : TABLE_ORDER.get(a.key)! - TABLE_ORDER.get(a2.key)!;
  });
  return {
    tiles,
    earned: tiles.filter((t) => !BADGE_BY_KEY[t.key].ironic).length,
    total: COLLECTIBLE.length,
  };
}

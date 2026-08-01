/** The finished-game log, and the only module that touches its storage key.
 *
 * It sits below both the engine (which appends a row) and settings (which
 * reads rows back as the record book and the trophy case) because those two
 * already point at each other: settings imports the engine's config types, so
 * an engine that imported settings would close a cycle. History is the third
 * thing both of them actually depend on, so it owns the key, the row shape,
 * and the tolerance for rows written by older builds. */

const HISTORY_KEY = "hotstove.history";

/** One finished game. Every field past `date`/`total`/`record`/`spins` is
 * optional because rows written by earlier builds are never migrated — they
 * are read with the fields they happen to carry. */
export interface HistoryEntry {
  date: string;
  total: number;
  record: string;
  spins: number;
  seed?: number;
  difficulty?: string;
  bank?: string;
  /** Pre-bank rows carry this boolean instead of `bank`. */
  moneyball?: boolean;
  v?: number;
  /** Badge KEYS earned by that game — never labels, so a copy edit cannot
   * orphan an earned badge. Absent on rows written before badges existed. */
  badges?: string[];
}

/** Every row ever written, oldest first. A corrupt or absent store reads as
 * no history rather than throwing: the record book and the trophy case are
 * both decoration over a game that has to stay playable without them. */
export function loadHistory(): HistoryEntry[] {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(h) ? h : [];
  } catch {
    return [];
  }
}

/** Append one finished game. Silent on storage failure, for the same reason
 * `loadHistory` is: a full or disabled localStorage must not break a finale
 * the player already earned. */
export function appendHistory(entry: HistoryEntry): void {
  try {
    const hist = loadHistory();
    hist.push(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(hist));
  } catch {
    /* storage unavailable */
  }
}

/** Every badge key earned in any game so far.
 *
 * Deliberately unfiltered against the badge table: this answers "has the
 * player seen this key before", and a key the set no longer owns is still a
 * key they have seen. Surfaces that render badges do their own
 * BADGE_BY_KEY lookup and drop what they cannot resolve.
 *
 * Read this BEFORE appending the current game — afterwards every badge it
 * earned is in the log, and nothing can read as new. */
export function earnedBadgeKeys(): Set<string> {
  const keys = new Set<string>();
  for (const e of loadHistory()) {
    if (!Array.isArray(e?.badges)) continue;
    for (const k of e.badges) if (typeof k === "string") keys.add(k);
  }
  return keys;
}

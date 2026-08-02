/** The finished-game log, and the only module that touches its storage key.
 *
 * It sits below both the engine (which appends a row) and settings (which
 * reads rows back as the record book and the trophy case) because those two
 * already point at each other: settings imports the engine's config types, so
 * an engine that imported settings would close a cycle. History is the third
 * thing both of them actually depend on, so it owns the key, the row shape,
 * and the tolerance for rows written by older builds. */

const HISTORY_KEY = "hotstove.history";

/** One logged game. Every field past `date` is optional because rows written
 * by earlier builds are never migrated — they are read with the fields they
 * happen to carry.
 *
 * Two kinds of row live here, and the score is what tells them apart:
 *
 * - A FINISHED game carries `total`, `record` and `spins`. It feeds the record
 *   book, the trophy case and the passport.
 * - A QUIT carries a `date` and a `badges` list, and nothing else. There is no
 *   score to write: quitting clears the save and goes straight home without
 *   ever reaching a finale, so no result was ever resolved.
 *
 * An UNSCORED row is therefore invisible to everything that measures play —
 * `bestFor` skips any row whose `total` is not a number, so the record book's
 * G never counts a quit and no best column can see one — and visible only to
 * the two surfaces that union `badges` and `countries` across the log. That is
 * the whole mechanism behind 🧳 PACKED IT IN: a trophy for a thing that
 * produces no season. */
export interface HistoryEntry {
  date: string;
  /** Absent on an unscored row (a quit). Its absence IS the marker: every
   * reader that measures play already guards on it being a number. */
  total?: number;
  record?: string;
  spins?: number;
  seed?: number;
  difficulty?: string;
  bank?: string;
  /** Pre-bank rows carry this boolean instead of `bank`. */
  moneyball?: boolean;
  v?: number;
  /** Badge KEYS earned by that game — never labels, so a copy edit cannot
   * orphan an earned badge. Absent on rows written before badges existed. */
  badges?: string[];
  /** The distinct birth countries that season's club was made of, as the cards
   * spell them ("Dominican Republic", "Curaçao"). The passport in settings.ts
   * is the lifetime union of these, the way the trophy case is the lifetime
   * union of `badges` — one durable log, no second key to drift from it.
   *
   * Absent on every row written before the field existed, and on any row whose
   * club carried no country at all. Both read as "this season contributed no
   * stamps", which is the conservative answer. */
  countries?: string[];
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

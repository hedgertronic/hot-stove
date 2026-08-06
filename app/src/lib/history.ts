/** The finished-game log, and the only module that touches its storage key.
 *
 * It sits below both the engine (which appends a row) and settings (which
 * reads rows back as the record book and the trophy case) because those two
 * already point at each other: settings imports the engine's config types, so
 * an engine that imported settings would close a cycle. History is the third
 * thing both of them actually depend on, so it owns the key, the row shape,
 * and the tolerance for rows written by older builds.
 *
 * It owns a SECOND key beside the log — the replayable archive at the bottom of
 * the file — because the two are the same games at two very different sizes and
 * the difference is what makes one of them cappable. They live together so that
 * the rule keeping the cap off the log is written next to the log it protects.
 *
 * `StoredFinale` is imported as a TYPE only. That import is erased at build
 * time and adds no runtime edge, so the engine still depends on this module and
 * never the other way around. */
import type { StoredFinale } from "./engine.svelte";

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
  /** Shared with this game's record in the replayable archive at the bottom of
   * this file — the one thing tying a 420-byte log row to the ~5.4KB finale it
   * can be walked back into. Minted by `finishGame` as the season ends, so it
   * is absent on every row written before the archive existed and on every
   * unscored row: a quit reaches no finale, so there is nothing to point at.
   *
   * An id naming no surviving archive record is the normal end state of an old
   * season — still counted, still stamped, no longer openable. */
  id?: string;
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
  /** Player IDS by birth country — `{ "Venezuela": ["cabremi01", "altuvjo01"] }`
   * — distinct within a country, as the cards spell the country and as the
   * corpus spells the id.
   *
   * The passport counts unique PEOPLE across a career, so a man rostered in
   * three separate seasons has to be recognizable as the same man three times.
   * Ids are the only thing that can do that: names collide and a count cannot
   * be unioned. `countries` remains the list of which countries a club held,
   * and these are the same countries with their rosters attached — either field
   * alone is enough to stamp, which is what lets the two be read
   * independently.
   *
   * ABSENT ON EVERY ROW WRITTEN BEFORE THE FIELD EXISTED, AND THERE IS NO WAY
   * TO BACKFILL IT. A history row records badges, countries and a record and
   * has never recorded a roster, so which players an already-played season held
   * is not recoverable from anything the app still has. Those rows keep their
   * stamp and their first-seen date and contribute nothing to the count;
   * `PassportStamp.counted` is what makes that visible instead of silent. */
  countryPlayers?: Record<string, string[]>;
}

/** Every row ever written, oldest first. A corrupt or absent store reads as
 * no history rather than throwing: the record book and the trophy case are
 * both decoration over a game that has to stay playable without them.
 *
 * MEMBERS ARE VETTED HERE, at the one boundary, not by every reader: a
 * `null` or a bare number inside an otherwise-valid array reached a dozen
 * call sites, and while the trophy case's own readers guard with `e?.`, the
 * home screen's season count and the seasons sheet read `e.total` plainly —
 * one hand-corrupted row bricked the home screen and, worse, threw inside
 * `finishGame`'s history append, leaving a finished season unrecorded. A row
 * that is not a plain object is not a row. */
export function loadHistory(): HistoryEntry[] {
  try {
    const h = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(h)) return [];
    return h.filter(
      (e): e is HistoryEntry => typeof e === "object" && e !== null && !Array.isArray(e),
    );
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

/* ---------- the replayable archive ---------- */

/** The finished games that can still be REOPENED, oldest first.
 *
 * A log row is ~420 bytes and says what a season scored. The finale screen
 * needs the whole club, the ledger and the dream team — ~5.4KB per game. Those
 * two appetites cannot share one store, and here they do not: the log above
 * stays uncapped and complete, and this key holds a bounded tail of
 * `StoredFinale` records, each carrying the id of the row it belongs to.
 *
 * ---- Why the cap is HERE, and never on the log ----
 *
 * The trophy case (`earnedBadgeKeys`) and the passport (`settings.passport`)
 * are lifetime UNIONS over the log. Trimming its oldest row to buy space would
 * permanently un-earn a badge and un-stamp a country, and a player would watch
 * their own collection shrink as they kept playing. So the log is never
 * trimmed, by this or by anything.
 *
 * Evicting from THIS key costs exactly one thing: that season can no longer be
 * walked back into. It still counts toward the record book, still holds its
 * badges, still carries its stamps. The seasons list draws such a row as one it
 * cannot open rather than dropping it, so the loss is visible rather than
 * silent.
 *
 * ---- The number ----
 *
 * 50 × ~5.4KB ≈ 270KB against the ~5MB an origin gets — roughly 18× headroom.
 * The ceiling is not what sets the cap, though; `hotstove.current` is. A live
 * game that cannot write its save loses a season outright to iOS Safari's tab
 * eviction, which is strictly worse than losing the ability to reopen a season
 * already played and already scored. At 1,000 lifetime games the log is ~420KB
 * and this key is still 270KB, so the whole origin sits under 0.8MB and the
 * in-progress save is never the thing being squeezed. (~5.4KB is a real finale
 * over the real corpus — the one-card fixture the tests play understates it.)
 *
 * ---- One obligation ----
 *
 * The shape check is `renderableFinale` below, and `loadStoredFinale` calls
 * the same predicate — sharing runs DOWN the stack (the engine imports this
 * module), so one definition serves both without the upward import this
 * module's position exists to avoid. (Version skew needs no obligation: rows
 * carry `v`, and
 * `loadArchive` drops any row whose version this build doesn't render, exactly
 * as `loadStoredFinale` does for `hotstove.finale`. A bump silently retires
 * the old rows instead of relying on someone remembering to clear the key.) */
const ARCHIVE_KEY = "hotstove.archive";

/** v1 = the first stored finale. Bump whenever a stored finale stops being
 * renderable by the finale screen; an unrecognized version reads as no stored
 * finale, exactly like a corrupt one. Lives here rather than in the engine so
 * `loadArchive` can check it without importing upward. */
export const FINALE_VERSION = 1;
/** Exported because the seasons list says the number out loud once a season has
 * aged out — a cap the player can see explained is the difference between a
 * dead row and a broken one. */
export const ARCHIVE_CAP = 50;

/** One archived finale: everything the finale screen renders, plus the id
 * shared with its log row. */
export type ArchivedFinale = StoredFinale & { id: string };

/** Everything the finale screen dereferences WITHOUT guards, checked as one
 * predicate so the two storage readers (`loadStoredFinale` in the engine, and
 * `loadArchive` below) cannot drift apart on what "renderable" means. It
 * lives HERE, at the bottom of the stack, because the engine already imports
 * this module and the reverse import would be a cycle.
 *
 * The parts sweep is the reason this exists: the ledger calls `.toFixed()` on
 * every `ScoreParts` number (expected wins, luxury tax, the bonuses), and the
 * old check stopped at `parts.total` — a record that parsed, carried the
 * right version, and held a truncated `parts` passed the reader and
 * white-screened the finale on `undefined.toFixed`. */
export function renderableFinale(f: unknown): boolean {
  const fin = f as {
    parts?: Record<string, unknown>;
    badges?: unknown;
  } & Record<string, unknown>;
  if (typeof fin !== "object" || fin === null) return false;
  for (const k of ["wins", "losses", "spend", "budget", "totalWar", "spinCount"])
    if (typeof fin[k] !== "number") return false;
  const parts = fin.parts;
  if (typeof parts !== "object" || parts === null) return false;
  for (const k of [
    "expectedWins",
    "managerWins",
    "budgetBonus",
    "awardPoints",
    "ringPoints",
    "scoutBonus",
    "luxuryTax",
    "total",
  ])
    if (typeof parts[k] !== "number") return false;
  return Array.isArray(fin.badges);
}

/** Every reopenable game, oldest first. Rows missing an id or missing what the
 * finale screen dereferences are dropped rather than handed on: an archive
 * record exists to be rendered, and one that cannot be is no record. Corrupt or
 * absent storage reads as an empty archive, like the log above. */
export function loadArchive(): ArchivedFinale[] {
  try {
    const a = JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? "[]");
    if (!Array.isArray(a)) return [];
    return a.filter(
      (r) =>
        r?.v === FINALE_VERSION &&
        typeof r?.id === "string" &&
        renderableFinale(r.finale) &&
        Array.isArray(r.slots),
    );
  } catch {
    return [];
  }
}

/** Archive one finished game, evicting the oldest once the cap is reached.
 *
 * A quota failure evicts and retries rather than giving up on the first throw —
 * the same principle as the swallowed writes above, one step further. The
 * newest season is the one most likely to be reopened, so it is the last thing
 * surrendered; and if not even a single record will fit, the archive already in
 * storage is left standing rather than emptied. Either way the finale the
 * player just earned is untouched, because it was written and claimed before
 * this ran. */
export function archiveGame(rec: ArchivedFinale): void {
  const rows = [...loadArchive(), rec];
  if (rows.length > ARCHIVE_CAP) rows.splice(0, rows.length - ARCHIVE_CAP);
  while (rows.length > 0) {
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(rows));
      return;
    } catch {
      rows.shift();
    }
  }
}

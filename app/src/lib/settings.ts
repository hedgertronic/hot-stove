/** Mode selection persists across visits (BUILD.md: localStorage
 * `hotstove.settings`), as do the two corner-button attention cues
 * (`hotstove.cues`). */
import {
  BADGE_BY_KEY,
  BADGES,
  bankLocked,
  COLLECTIBLE,
  RARITY_ORDER,
  type Rarity,
} from "./badges";
import {
  DEFAULT_CONFIG,
  type Bank,
  type Difficulty,
  type GameConfig,
} from "./engine.svelte";
import { localDateStamp } from "./format";
import { appendHistory, earnedBadgeKeys, loadHistory } from "./history";

const SETTINGS_KEY = "hotstove.settings";
/** 🧳 PACKED IT IN's key, spelled once. Nothing in `earnedBadges` pushes it —
 * see `recordQuit` below — so the badge table is the only other place it
 * appears, and badgeCase drops any key the table no longer owns. A test
 * asserts the two still agree. */
const PACKED_IN = "packedin";
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
  /** The INSTRUCTS spotlight tour ran to its end or was skipped. Absent in
   * records written before the field existed, which reads as false — safe,
   * because the tour also gates on firstEverPlay(), so a veteran's store
   * never shows it either way. */
  tourSeen: boolean;
}

/** Fresh, unlit, and what every unreadable store resolves to. */
function noCues(): CueState {
  return { pendingBadges: [], helpSeen: false, tourSeen: false };
}

/** The cue record, or an unlit one.
 *
 * Deliberately a log of things that happened AFTER this key existed, never a
 * diff against `hotstove.history`: a player who already owns thirty badges
 * must not be told on their next load that all thirty are new. An absent key,
 * a corrupt value, and an unrecognized version all read the same unlit way, so
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
      tourSeen: s.tourSeen === true,
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

/** INSTRUCTS finished or was skipped — either way it never runs again. */
export function markTourSeen(): CueState {
  return saveCues({ ...loadCues(), tourSeen: true });
}

/** Nobody has ever FINISHED a game here. Mid-first-game counts as first-ever
 * on purpose: the player still has not been shown the rules.
 *
 * Unscored rows are skipped for exactly that reason. A player who quit their
 * first game has a row in the log and still has not seen a result — putting
 * the help cue out on their next visit would be the cue answering "have you
 * pressed PLAY" when it is asking "do you know how this works". */
export function firstEverPlay(): boolean {
  return loadHistory().every((e) => typeof e?.total !== "number");
}

/** 🧳 PACKED IT IN: the player quit a game in progress.
 *
 * The one badge no resolver can ever push. Badges are computed inside
 * `finishGame` from the season the game produced, and a quit produces no
 * season — it drops the save and goes home without a finale. So it is written
 * straight into the log instead, as an UNSCORED row (see `HistoryEntry`): a
 * `date`, the key, and nothing the record book could count.
 *
 * The trophy cue is lit on a first-ever quit for the same reason a finale's
 * first-ever badge lights it — the case has news, and the news is a tile the
 * player has never seen. `earnedBadgeKeys()` is read BEFORE the append, the
 * same order `finishGame` uses, because afterwards the key is in the log and
 * nothing can read as new.
 *
 * Repeats are counted, not deduped: the case shows 🧳 ×4 after four quits, the
 * way it shows any badge ×4 after four games that earned it. An anti-trophy is
 * a citation rather than a target, so the tally reads as the joke it is — and
 * it never moves `N OF M`, which counts from COLLECTIBLE and excludes ironic
 * badges outright.
 *
 * Called on the CONFIRMED quit only, and never from the finale's ✕ — a
 * finished game has nothing left to abandon. */
export function recordQuit(difficulty: Difficulty, bank: Bank): void {
  const first = !earnedBadgeKeys().has(PACKED_IN);
  // The abandoned game's own mode, stamped the way a finished game's row is —
  // without it the quit row named no mode, so 🧳 showed under ALL but
  // vanished under every trophy-case lens. `v` rides along for the same
  // reason the engine writes it: it disambiguates the stored difficulty.
  appendHistory({
    v: 2,
    date: localDateStamp(),
    difficulty,
    bank,
    badges: [PACKED_IN],
  });
  if (first) noteNewBadges([PACKED_IN]);
}

/** Best score, best record, game count, and archive id for one mode combo.
 * Legacy entries (no v stamp) get the same difficulty mapping as settings;
 * pre-bank entries carry a `moneyball` boolean instead of `bank`. Best record
 * = most wins, fewest losses on ties; entries without a parseable record still
 * count toward games and best score.
 *
 * `bestId` tracks the archive id of the best-total entry. On ties, the NEWER
 * entry's id wins — `>=` on the comparison — matching the seasons sheet's own
 * tie-break (its shelf iterates newest-first and keeps the first match). The
 * numeric `best` is the same either way; only the id differs. */
export function bestFor(
  difficulty: Difficulty,
  bank: Bank,
): { best: number | null; bestRecord: string | null; games: number; bestId?: string } {
  let best: number | null = null;
  let bestId: string | undefined = undefined;
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
    if (best === null || e.total >= best) {
      best = e.total;
      bestId = e.id;
    }
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
  return { best, bestRecord: recW >= 0 ? `${recW}–${recL}` : null, games, bestId };
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
/** A mode lens over the case. One axis at a time — a difficulty OR a bank —
 * because that is what the filter chips offer; `undefined` is the lifetime
 * ALL view. */
/** The trophy case's mode lens, multi-select on both axes. Within an axis the
 * selections are OR (Box Score + Eye Test = games from either ladder); across
 * axes they are AND (Box Score + Moneyball = Box Score games played on the
 * Moneyball bank). An empty or absent array on an axis means "no lens on this
 * axis", so `{}` and `undefined` both read as ALL. */
export interface CaseFilter {
  difficulties?: Difficulty[];
  banks?: Bank[];
}

/** The bank a history row was played under, reading the legacy spelling too:
 * pre-bank rows carried a `moneyball` boolean (true = Moneyball, false =
 * classic), and rows older than THAT carry neither — those return null and
 * appear only in the ALL view, which is the honest reading of a row that
 * never said. */
function rowBank(e: { bank?: string; moneyball?: boolean }): Bank | null {
  if (e.bank === "classic" || e.bank === "moneyball" || e.bank === "blankcheck") return e.bank;
  if (typeof e.moneyball === "boolean") return e.moneyball ? "moneyball" : "classic";
  return null;
}

/** Whether a history row is inside the case's lens — ONE predicate for every
 * surface the lens reaches (the badge board and the passport), so the two can
 * never disagree about which games a lens shows. Axes AND together;
 * selections within an axis OR; an empty axis is no lens on that axis.
 *
 * The difficulty read is bestFor's, version stamp and all: a pre-v2 "eyetest"
 * is today's scout, and a pre-v2 "scout" was the retired stats mode —
 * standard's ancestor, not Eye Test's. A row naming NO mode on a filtered
 * axis shows only under ALL rather than falling to a legacy default, which
 * would dress every pre-mode row as Box Score / classic. */
function rowInLens(
  e: { v?: number; difficulty?: string; bank?: string; moneyball?: boolean },
  filter?: CaseFilter,
): boolean {
  const wantDiff = filter?.difficulties ?? [];
  const wantBank = filter?.banks ?? [];
  if (wantDiff.length > 0) {
    const d =
      typeof e.difficulty !== "string"
        ? null
        : typeof e.v === "number" && e.v >= 2
          ? e.difficulty
          : legacyDifficulty(e.difficulty);
    if (d === null || !wantDiff.some((x) => x === d)) return false;
  }
  if (wantBank.length > 0) {
    const bank = rowBank(e);
    if (bank === null || !wantBank.includes(bank)) return false;
  }
  return true;
}

export function badgeCase(filter?: CaseFilter): {
  tiles: CaseTile[];
  earned: number;
  total: number;
} {
  const counts = new Map<string, number>();
  // Only the bank axis is read here (the denominator's bankLocked drop) — the
  // row-level lens itself lives in `rowInLens`.
  const wantBank = filter?.banks ?? [];
  for (const e of loadHistory()) {
    if (!Array.isArray(e?.badges)) continue;
    // The lens: a row that doesn't name any asked-for mode is excluded, and a
    // row too old to name any mode shows only under ALL. Every badge the row
    // earned filters together — a badge has no mode of its own, the game that
    // earned it does. The predicate is `rowInLens`, shared with the passport.
    if (!rowInLens(e, filter)) continue;
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
    // A badge no wanted bank can mechanically produce (the four front-office
    // badges under a fixed-cap lens) leaves the denominator with the board —
    // an N OF M that counts unreachable slots reads as unfinished forever.
    total: COLLECTIBLE.filter((b) => !bankLocked(b, wantBank)).length,
  };
}

/* ---------- the passport ---------- */

/** What one country is worth as a STAMP: the flag it prints, the tier that
 * flag wears, and the measured chance of ever seeing it. */
export interface CountryDef {
  /** The flag, as a single emoji. See COUNTRIES for what "single" costs. */
  flag: string;
  /** The collection ladder's own tier, from lib/badges. The passport uses the
   * four middle rungs and no others: `legendary` is the top of a badge axis
   * and a country is not an axis, and `ironic` is an anti-trophy, which no
   * birthplace is. */
  rarity: Rarity;
  /** Percent of eight-man clubs that hold at least one player born here,
   * measured over data/cards: `100 × (1 − (1 − share)^8)`, where `share` is
   * the country's slice of the corpus's 35,720 player-seasons.
   *
   * This is the rarity of a STAMP rather than of a PLAYER, which is the only
   * measure the panel can honestly wear — a stamp is what the player collects,
   * and one Venezuelan and three Venezuelans are the same stamp. The two
   * numbers are far apart at the top: USA is 76% of player-seasons and 100% of
   * clubs.
   *
   * It lives beside the definition, the way `freq` lives beside a BadgeDef, so
   * it cannot go stale in a comment somewhere else — and tests/passport.test.ts
   * recomputes every one of them off data/cards, so a data regen that moves the
   * supply fails the table rather than quietly outdating it.
   *
   * Eight independent draws is an approximation of the draft, not a simulation
   * of it: a real club comes off ~11 cards under position constraints. It is
   * close enough to place a country in a band and is not used for anything
   * else. */
  freq: number;
}

/** Every birth country in the corpus, with its flag, its tier and its measured
 * rate. Keyed by the country string EXACTLY as the cards spell it, because
 * that string is what the engine copies onto a signing and writes into the
 * history row — no normalization anywhere in between. "Curaçao" is NFC in the
 * data (one U+00E7), and so is the key here.
 *
 * ---- The tiers decorate; they still never invite ----
 *
 * A country is not collectible. Nothing in the game shows a birth country
 * before the finale, and no move a player can make produces a Lithuanian — so a
 * tier here is a fact about how unlikely a stamp was, never a target.
 *
 * No surface walks these keys to draw a board. A country a career has never
 * reached is not on the passport at all — see `passportBoard()` for why the
 * grayed slots that used to fill it are gone. The table is read one country at
 * a time, to decorate a stamp that has already been earned. The rule that
 * matters is unchanged: nothing here is ever shown DURING a game, where it
 * could steer a signing.
 *
 * The bands are the badge ladder's own, one rung per order of magnitude of
 * club rate: 20%+ common, 5–20% uncommon, 1–5% rare, under 1% ultra. The split
 * lands cleanly — Puerto Rico at 21.65 and Cuba at 10.32 sit well clear of the
 * 20% line, and Nicaragua at 1.58 clears 1% by half a band.
 *
 * ---- What a flag does when it cannot render ----
 *
 * Every flag here is either a regional-indicator pair (🇯🇵 = two letters) or
 * one of the two subdivision tag sequences, 🏴󠁧󠁢󠁥󠁮󠁧󠁿 and 🏴󠁧󠁢󠁳󠁣󠁴󠁿. The tag sequences
 * do not render everywhere, and the failure is not tofu: tag characters are
 * default-ignorable, so a platform that does not know the sequence draws the
 * base 🏴 and drops the rest. A black flag beside the word ENGLAND is a poorer
 * stamp than a perfect one and is still a stamp; the name is printed on every
 * one of them, so no stamp is ever ambiguous about which country it is.
 * iOS, macOS and Android render everything here natively. WINDOWS RENDERS NO
 * FLAG AT ALL — a regional-indicator pair draws as two letter glyphs — so
 * main.ts runs the country-flag-emoji-polyfill: on flag-less platforms it
 * registers "Twemoji Country Flags" (flags only, tag sequences included),
 * which leads the --disp stack in app.css. Everywhere else it is a no-op
 * that fetches nothing.
 *
 * A country this table does not know — a data regen that adds a fortieth —
 * degrades to no flag and no tier: the stamp renders its name on the plain
 * paper an untiered stamp wears. `countryDef` returns null and every caller
 * treats null as "no decoration", which is why an unknown country costs a row
 * its color rather than costing the panel its row. */
export const COUNTRIES: Record<string, CountryDef> = {
  // ---- common: a fifth of clubs or more ----
  USA: { flag: "🇺🇸", rarity: "common", freq: 100.0 },
  "Dominican Republic": { flag: "🇩🇴", rarity: "common", freq: 52.18 },
  Venezuela: { flag: "🇻🇪", rarity: "common", freq: 34.02 },
  "Puerto Rico": { flag: "🇵🇷", rarity: "common", freq: 22.62 },
  // ---- uncommon: one club in ten to one in five ----
  Cuba: { flag: "🇨🇺", rarity: "uncommon", freq: 10.23 },
  Mexico: { flag: "🇲🇽", rarity: "uncommon", freq: 9.3 },
  Canada: { flag: "🇨🇦", rarity: "uncommon", freq: 8.49 },
  Japan: { flag: "🇯🇵", rarity: "uncommon", freq: 6.18 },
  // ---- rare: one club in twenty to one in a hundred ----
  Panama: { flag: "🇵🇦", rarity: "rare", freq: 4.29 },
  Colombia: { flag: "🇨🇴", rarity: "rare", freq: 2.66 },
  "South Korea": { flag: "🇰🇷", rarity: "rare", freq: 2.37 },
  "Curaçao": { flag: "🇨🇼", rarity: "rare", freq: 2.08 },
  Germany: { flag: "🇩🇪", rarity: "rare", freq: 1.89 },
  Australia: { flag: "🇦🇺", rarity: "rare", freq: 1.72 },
  Nicaragua: { flag: "🇳🇮", rarity: "rare", freq: 1.53 },
  // ---- ultra: under one club in a hundred. Twenty-four countries, and 15 of
  // them have exactly one draftable man in the whole corpus. ----
  Jamaica: { flag: "🇯🇲", rarity: "ultra", freq: 0.87 },
  Aruba: { flag: "🇦🇼", rarity: "ultra", freq: 0.69 },
  Taiwan: { flag: "🇹🇼", rarity: "ultra", freq: 0.67 },
  Netherlands: { flag: "🇳🇱", rarity: "ultra", freq: 0.45 },
  "U.S. Virgin Islands": { flag: "🇻🇮", rarity: "ultra", freq: 0.42 },
  Brazil: { flag: "🇧🇷", rarity: "ultra", freq: 0.42 },
  England: { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", rarity: "ultra", freq: 0.4 },
  Honduras: { flag: "🇭🇳", rarity: "ultra", freq: 0.27 },
  Vietnam: { flag: "🇻🇳", rarity: "ultra", freq: 0.27 },
  Bahamas: { flag: "🇧🇸", rarity: "ultra", freq: 0.16 },
  Peru: { flag: "🇵🇪", rarity: "ultra", freq: 0.16 },
  France: { flag: "🇫🇷", rarity: "ultra", freq: 0.2 },
  "Saudi Arabia": { flag: "🇸🇦", rarity: "ultra", freq: 0.13 },
  Philippines: { flag: "🇵🇭", rarity: "ultra", freq: 0.11 },
  China: { flag: "🇨🇳", rarity: "ultra", freq: 0.09 },
  Lithuania: { flag: "🇱🇹", rarity: "ultra", freq: 0.07 },
  "South Africa": { flag: "🇿🇦", rarity: "ultra", freq: 0.07 },
  Belize: { flag: "🇧🇿", rarity: "ultra", freq: 0.04 },
  Afghanistan: { flag: "🇦🇫", rarity: "ultra", freq: 0.04 },
  Guam: { flag: "🇬🇺", rarity: "ultra", freq: 0.04 },
  Scotland: { flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", rarity: "ultra", freq: 0.02 },
  Spain: { flag: "🇪🇸", rarity: "ultra", freq: 0.02 },
  Indonesia: { flag: "🇮🇩", rarity: "ultra", freq: 0.02 },
  Portugal: { flag: "🇵🇹", rarity: "ultra", freq: 0.02 },
};

/** A Map rather than a plain lookup on COUNTRIES, because the key comes out of
 * localStorage: `COUNTRIES["constructor"]` on the object resolves up the
 * prototype chain and hands back a function, and a Map has no chain to walk. */
const COUNTRY_BY_NAME = new Map(Object.entries(COUNTRIES));

/** A country's decoration, or null for one the table does not know. Null is
 * "no flag, no tier" and never a default tier: guessing `common` for an
 * unrecognized country would print a rarity the data never measured. */
export function countryDef(country: string): CountryDef | null {
  return COUNTRY_BY_NAME.get(country) ?? null;
}

/** One country the player has been to: where, when they first went, how many
 * clubs since have carried someone born there, and how many different people
 * those clubs turned out to be. */
export interface PassportStamp {
  /** Birth country as the cards spell it — "Dominican Republic", "Curaçao". */
  country: string;
  /** The flag, or an empty string for a country the table does not know. */
  flag: string;
  /** The tier the stamp wears, or null for a country the table does not
   * know. */
  rarity: Rarity | null;
  /** The measured club rate, or null for a country the table does not know. */
  freq: number | null;
  /** The `date` of the first game whose club held a player born there, or an
   * empty string on a row that carries no parseable date. Display only. */
  first: string;
  /** Games, not players. A club with three Venezuelans is one visit, the same
   * way a history row naming a badge three times is one earn. */
  visits: number;
  /** Different PEOPLE born here that the player has ever rostered, counted by
   * player id across every game. A man signed in three separate seasons is one;
   * two different Venezuelans are two.
   *
   * Counted only from rows that carry `countryPlayers`, and that is a
   * degradation with a hard floor under it: a history row records badges,
   * countries and a record, never a roster, so there is NO way to recover which
   * players an already-played season held. Older rows keep their stamp, keep
   * their first-seen date, and contribute nothing here. Zero therefore means
   * "no season on record named anybody", which is a different claim from "you
   * have fielded nobody" — `counted` is what tells the two apart, and the panel
   * renders no number at all rather than a zero. */
  players: number;
  /** How many of `visits` carried at least one player id. Always `<= visits`,
   * and zero exactly when `players` is zero.
   *
   * This is the honesty channel. `counted === visits` means the player count is
   * complete; `0 < counted < visits` means it covers part of the history;
   * `counted === 0` means nothing is known and no number is shown. */
  counted: number;
}

/** The per-country player ids one history row carries, cleaned.
 *
 * A country key survives with an EMPTY id list, because the key itself is
 * evidence the club held that country and the stamp should exist either way.
 * The caller is what refuses to count an empty list toward `counted`, which is
 * what keeps `players === 0` and `counted === 0` the same statement. */
function rowPlayers(entry: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const raw = (entry as { countryPlayers?: unknown } | null)?.countryPlayers;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    const country = key.trim();
    if (country === "" || !Array.isArray(list)) continue;
    out.set(
      country,
      list.filter((id): id is string => typeof id === "string" && id.trim() !== ""),
    );
  }
  return out;
}

/** The lifetime passport: every birth country the player has ever fielded, in
 * order of discovery, most recent first.
 *
 * A SOUVENIR, never a checklist, and that is a design constraint rather than a
 * presentation choice. Nothing anywhere in the game shows a player's birth
 * country — not the market rows, not the roster rail, not the finale until the
 * season is over and nothing can be chosen in response to it — so a country is
 * something a club turns out to have contained, never something a player can go
 * looking for. The dataset makes that worse rather than better: of the 39
 * countries in it, 23 have five or fewer draftable men and 15 have exactly one.
 * A panel that showed the 39 and grayed out the 27 you have not met would be
 * inviting a hunt the interface gives no tools for.
 *
 * So this returns only what has been FOUND. There is no total, no denominator,
 * and no entry for a country never fielded — a caller has nothing to render an
 * empty slot from. TrophyModal hides the panel and its tab outright until the
 * first stamp lands, which is also what keeps it out of the case's `N OF M`
 * fraction: that number is counted from COLLECTIBLE, and no country is a badge.
 *
 * The tiers on the stamps decorate what is already here for the same reason.
 * They say how lucky a stamp was AFTER it landed; they name nothing to go get.
 *
 * 🌎 THE WORLD TOUR is the badge and stays one. It asks for five countries in
 * ONE club, which is a season; this is every country across every season,
 * which is a career. The two never show the same thing.
 *
 * Lifetime by default, with the case's mode lens available on top: no filter
 * (the finale) reads every game, and a `CaseFilter` narrows the stamps to the
 * games the lens shows, through the same `rowInLens` the badge board uses.
 * Derived from `hotstove.history` rather than a key of its own — for the
 * reasons `badgeCase()` gives. A
 * second key can drift from the log, and a player who cleared their history
 * would be startled to find their passport had survived it. Deriving also
 * makes the discovery ORDER and the first-seen DATE free, which is what lets
 * this render as stamps rather than as a list of names.
 *
 * A row establishes a country through EITHER of the two fields that can name
 * one — the `countries` list or a key of `countryPlayers` — so a row that
 * carries only ids still stamps, and a row that carries only names still
 * stamps without a player count.
 *
 * Rows are read with the same suspicion the rest of this file reads storage
 * with: an absent field, a non-array, a non-string member and an empty string
 * all contribute nothing, and a corrupt store resolves to an empty passport
 * through `loadHistory()`. */
export function passport(filter?: CaseFilter): PassportStamp[] {
  const stamps = new Map<string, PassportStamp>();
  /** Ids per country, live alongside `stamps` — the stamp carries the SIZE of
   * these sets, and the sets themselves are what make a player rostered in
   * four seasons count once. */
  const people = new Map<string, Set<string>>();
  for (const e of loadHistory()) {
    // The case's mode lens reaches the stamps the same way it reaches the
    // badges — `rowInLens` is the shared predicate — so a Moneyball lens
    // shows the countries MONEYBALL games fielded, not the career's. The
    // finale passes no filter and keeps the lifetime passport.
    if (!rowInLens(e ?? {}, filter)) continue;
    const date = typeof e?.date === "string" ? e.date : "";
    const ids = rowPlayers(e);
    // One visit per GAME per country, so a club with three men from one
    // country — or a row that names it three times — still counts once.
    const seen = new Set<string>();
    if (Array.isArray(e?.countries)) {
      for (const raw of e.countries) {
        if (typeof raw !== "string") continue;
        const country = raw.trim();
        if (country !== "") seen.add(country);
      }
    }
    // Already trimmed and non-empty by `rowPlayers`.
    for (const country of ids.keys()) seen.add(country);
    for (const country of seen) {
      let stamp = stamps.get(country);
      if (stamp) {
        stamp.visits += 1;
      } else {
        const def = countryDef(country);
        stamp = {
          country,
          flag: def?.flag ?? "",
          rarity: def?.rarity ?? null,
          freq: def?.freq ?? null,
          first: date,
          visits: 1,
          players: 0,
          counted: 0,
        };
        stamps.set(country, stamp);
        people.set(country, new Set<string>());
      }
      const list = ids.get(country);
      if (list === undefined || list.length === 0) continue;
      const set = people.get(country)!;
      for (const id of list) set.add(id);
      stamp.counted += 1;
      stamp.players = set.size;
    }
  }
  // `loadHistory` is oldest first, so insertion order IS discovery order.
  // Reversed, because the newest stamp is the one worth looking at. Rarity
  // deliberately does not re-sort this: a list ordered rarest-first is a ladder,
  // and a ladder is a thing to climb.
  return [...stamps.values()].reverse();
}

/** One stamp as a surface draws it. Both the trophy case and the finale render
 * countries, and they now render the SAME LIST — every country a career has
 * fielded, with the same number on each — so the shape they hand
 * `Passport.svelte` lives here, beside the table the decoration comes out of,
 * and so does the function that builds it. Two surfaces hand-assembling the
 * same stamp is exactly how the two drifted apart before. */
export interface PassportItem {
  country: string;
  /** Empty for a country the table does not know; the stamp then shows its
   * name alone. */
  flag: string;
  /** Null for a country the table does not know; the stamp then wears plain
   * paper instead of a tier. */
  rarity: Rarity | null;
  /** Different players fielded from here, or null when no season on record
   * names anybody. Null renders no number — never a zero, which would read as
   * "you have fielded nobody from a country you have a stamp for". */
  count: number | null;
  /** First time this country has ever been fielded. Finale only: in the case
   * every stamp is already found, so the flag would mark all of them. */
  fresh: boolean;
}

/** WHAT A STAMP SAYS WHEN IT IS TAPPED, and it is the same sentence wherever
 * the stamp is met. The finale and the trophy case draw their stamps into
 * different rows now — a strip of its own down there, inline among the badges
 * of its rarity band up here — so the one thing that must not depend on which
 * row it landed in lives beside the table it is built from rather than in
 * either component.
 *
 * "A player", singular, at any count: the sentence says why the stamp EXISTS,
 * and how many men are behind it is already drawn on the stamp. */
export function stampReveal(s: Pick<PassportItem, "country">): string {
  return `Rostered a player from ${s.country}.`;
}

/** What a stamp announces to a screen reader.
 *
 * It carries the NEW chip, the country and the count, because `aria-label`
 * REPLACES everything inside the element it sits on and every one of those
 * three is drawn rather than written — the country hardest of all, since the
 * flag IS the stamp and a flag is not a name. It leads with NEW, the way the
 * eye does.
 *
 * It stops there: the sentence above is the panel's, announced when the panel
 * is opened, the same division a badge draws between its pill and its
 * trigger. */
export function stampLabel(s: Pick<PassportItem, "country" | "count" | "fresh">): string {
  // Above one only, matching the drawn chip: the reader hears what the eye
  // sees, and at one the stamp's existence already says it.
  return `${s.fresh ? "New. " : ""}${s.country}${s.count !== null && s.count > 1 ? `, ${s.count}` : ""}`;
}

/* A stamp carries NO per-surface sentence. It used to: the case's stamps spelled
 * out a career — first fielded, N players across M of K seasons — while the
 * finale's carried none, so one mark meant two different amounts depending on
 * which screen it was read from. `Passport.svelte` now says the same single
 * sentence about every stamp on both surfaces, built from the country's name,
 * which is why neither this shape nor the reader below carries the prose any
 * more. The numbers it spelled out are still on the stamp itself: `count` is
 * the players, and `PassportStamp` still holds the visit log for anything that
 * wants to reason about it. */

/** The stamps a career has actually collected, as the panel draws them.
 *
 * The number on a stamp is unique PLAYERS, so a man rostered in four seasons
 * counts once and two different Venezuelans count twice. The stamp DRAWS it
 * only above one, the badge pills' own rule — round nine's owner call: a ×1
 * on a collectible restates what the chip's existence already says. `count`
 * still records the true number (including 1) for anything that reasons about
 * it; null alone keeps meaning "no season on record named anybody".
 *
 * `fresh` names the countries this game was the first to field. The caller
 * supplies them because only the caller knows whether a game just ended; the
 * case passes nothing and flags nothing, since in the case every stamp is
 * already found.
 *
 * New ones lead, the same order `bragRow` puts the finale's badge pills in and
 * for the same reason: the flagged one is what the player is here to see. The
 * rest keep `passport()`'s newest-first order. */
export function passportItems(
  fresh: ReadonlySet<string> = new Set<string>(),
  filter?: CaseFilter,
): PassportItem[] {
  return passport(filter)
    .map((s) => ({
      country: s.country,
      flag: s.flag,
      rarity: s.rarity,
      count: s.counted > 0 ? s.players : null,
      fresh: fresh.has(s.country),
    }))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh));
}

/** The trophy case's board: the countries this career has fielded, rarest
 * first. Nothing else — a country nobody has been to is not on it.
 *
 * ---- The empty slots are gone ----
 *
 * The board was the whole table for a while, with every unreached country
 * drawn as a grayed slot, on the reasoning that a player who has fielded
 * eleven countries cannot tell whether that is most of them or a tenth, and a
 * souvenir with no scale is one you cannot tell a story about.
 *
 * The scale cost more than it bought. Most of the table is somewhere nobody
 * has been — 24 of the 39 are ultra — so the board opened as a wall of what
 * the player does not have, with the handful they do have as a short row on
 * top. That is a checklist however carefully the slots are worded, and it is
 * the shape the passport exists to not be. The stamps are the souvenir; the
 * absences were never the point.
 *
 * RARITY orders what is left, rarest first. The case is a collection board and
 * the badge bands above it are already stacked that way, so the passport reads
 * on the same axis as the sheet it sits at the bottom of rather than
 * introducing a second one. Within a tier the sort is stable, so
 * `passportItems`' newest-first order survives underneath it. The finale draws
 * the same stamps in an order of its own and is meant to: that surface is one
 * night's scoreboard, not a collection.
 *
 * A country the table does not know sorts last. It has no measured tier, and
 * an unmeasured country at the head of a board ordered by rarity would read as
 * the rarest thing on it. */
export function passportBoard(filter?: CaseFilter): PassportItem[] {
  const rank = (r: Rarity | null) =>
    r === null ? RARITY_ORDER.length : RARITY_ORDER.indexOf(r);
  return passportItems(undefined, filter).sort((a, b) => rank(a.rarity) - rank(b.rarity));
}


/** Mode selection persists across visits (BUILD.md: localStorage
 * `hotstove.settings`), as do the two corner-button attention cues
 * (`hotstove.cues`). */
import {
  BADGE_BY_KEY,
  BADGES,
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
export function recordQuit(): void {
  const first = !earnedBadgeKeys().has(PACKED_IN);
  // No `v`: that stamp only disambiguates a row's stored difficulty, and an
  // unscored row carries none.
  appendHistory({
    date: new Date().toISOString().slice(0, 10),
    badges: [PACKED_IN],
  });
  if (first) noteNewBadges([PACKED_IN]);
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
 * `passportBoard()` DOES walk these keys, to draw the countries a career has
 * not reached as grayed slots. That is a scale for the stamps beside them
 * rather than a checklist: an unvisited slot names no player, suggests no
 * action, and the ones a player will actually see next are the ones already at
 * the top. The rule the panel still keeps is the one that matters — nothing
 * here is ever shown DURING a game, where it could steer a signing.
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
 * one of them, so no stamp is ever ambiguous about which country it is. This
 * is a phone-first game, and iOS renders both.
 *
 * A country this table does not know — a data regen that adds a fortieth —
 * degrades to no flag and no tier: the stamp renders its name on the plain
 * paper an untiered stamp wears. `countryDef` returns null and every caller
 * treats null as "no decoration", which is why an unknown country costs a row
 * its color rather than costing the panel its row. */
export const COUNTRIES: Record<string, CountryDef> = {
  // ---- common: a fifth of clubs or more ----
  USA: { flag: "🇺🇸", rarity: "common", freq: 100.0 },
  "Dominican Republic": { flag: "🇩🇴", rarity: "common", freq: 52.94 },
  Venezuela: { flag: "🇻🇪", rarity: "common", freq: 33.12 },
  "Puerto Rico": { flag: "🇵🇷", rarity: "common", freq: 21.65 },
  // ---- uncommon: one club in ten to one in five ----
  Cuba: { flag: "🇨🇺", rarity: "uncommon", freq: 10.32 },
  Mexico: { flag: "🇲🇽", rarity: "uncommon", freq: 9.3 },
  Canada: { flag: "🇨🇦", rarity: "uncommon", freq: 8.55 },
  Japan: { flag: "🇯🇵", rarity: "uncommon", freq: 6.38 },
  // ---- rare: one club in twenty to one in a hundred ----
  Panama: { flag: "🇵🇦", rarity: "rare", freq: 4.22 },
  Colombia: { flag: "🇨🇴", rarity: "rare", freq: 2.57 },
  "South Korea": { flag: "🇰🇷", rarity: "rare", freq: 2.42 },
  "Curaçao": { flag: "🇨🇼", rarity: "rare", freq: 2.15 },
  Germany: { flag: "🇩🇪", rarity: "rare", freq: 1.89 },
  Australia: { flag: "🇦🇺", rarity: "rare", freq: 1.78 },
  Nicaragua: { flag: "🇳🇮", rarity: "rare", freq: 1.58 },
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
  France: { flag: "🇫🇷", rarity: "ultra", freq: 0.13 },
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
 * GLOBAL across difficulty and bank, and derived from `hotstove.history`
 * rather than a key of its own — both for the reasons `badgeCase()` gives. A
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
export function passport(): PassportStamp[] {
  const stamps = new Map<string, PassportStamp>();
  /** Ids per country, live alongside `stamps` — the stamp carries the SIZE of
   * these sets, and the sets themselves are what make a player rostered in
   * four seasons count once. */
  const people = new Map<string, Set<string>>();
  for (const e of loadHistory()) {
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
  /** Never been fielded at all — a slot rather than a stamp. The board in the
   * trophy case shows every country there is, so an unvisited one is drawn
   * grayed out with its flag and its name and no number. */
  locked: boolean;
  /** Hover/assistive detail. Null draws no title attribute at all. */
  title: string | null;
}

/** What one stamp says on hover, and to a screen reader.
 *
 * It spells out the two numbers the stamp itself cannot: which of the games
 * behind a country actually named the people in it, and how many seasons those
 * were. A stamp with `counted === 0` says so in words rather than showing a
 * zero — a country nobody is counted for is a gap in the log, not a club with
 * nobody in it. */
export function stampTitle(s: PassportStamp): string {
  const when = s.first ? `First fielded ${s.first}. ` : "";
  const seasons = `${s.visits} ${s.visits === 1 ? "season" : "seasons"}`;
  if (s.counted === 0) return `${when}${seasons}, none carrying a roster.`;
  const players = `${s.players} ${s.players === 1 ? "player" : "players"}`;
  if (s.counted === s.visits) return `${when}${players} across ${seasons}.`;
  return `${when}${players} across ${s.counted} of ${seasons}.`;
}

/** The stamps a career has actually collected, as the panel draws them.
 *
 * The number on a stamp is unique PLAYERS, so a man rostered in four seasons
 * counts once and two different Venezuelans count twice — and it is shown at
 * one as readily as at four, which breaks the badge pills' "only mark above
 * one" convention on purpose. A blank has to mean exactly one thing here, and
 * the thing it means is "no season on record named anybody".
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
): PassportItem[] {
  return passport()
    .map((s) => ({
      country: s.country,
      flag: s.flag,
      rarity: s.rarity,
      count: s.counted > 0 ? s.players : null,
      fresh: fresh.has(s.country),
      locked: false,
      title: stampTitle(s),
    }))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh));
}

/** The whole board: every country there is, collected ones first.
 *
 * ---- This reverses a rule, on purpose ----
 *
 * The panel used to show found stamps and nothing else, on the reasoning that
 * a country is not collectible — nothing in the game shows a birth country
 * before the finale, so a grid of grayed-out slots would point a player at a
 * hunt they have no way to run.
 *
 * That reasoning was about INVITATION and it held; what it got wrong is what
 * the empty slots are for. A player who has fielded eleven countries has no way
 * to know whether that is most of them or a tenth of them, and a souvenir with
 * no scale is a souvenir you cannot tell a story about. The slots answer that
 * and still invite nothing: they are unsorted by anything actionable, they name
 * no player, and there is no move that produces a Lithuanian. Landing one
 * remains an accident — the board just tells you how unlikely the accident was.
 *
 * The unvisited half runs commonest first, which is the honest order for a
 * thing nobody chases: the countries near the top are the ones a few more
 * seasons will turn up on their own, and 🇱🇹 sits at the bottom where it
 * belongs. Sorting them by name would imply the list is for looking things up
 * in, which it is not.
 *
 * A country the table does not know cannot appear as a slot — there is nothing
 * to draw — but it still appears as a STAMP once fielded, on plain paper. The
 * board is `COUNTRIES` plus whatever the log turned up. */
export function passportBoard(): PassportItem[] {
  const found = passportItems();
  const seen = new Set(found.map((i) => i.country));
  const locked = Object.entries(COUNTRIES)
    .filter(([country]) => !seen.has(country))
    .sort((a, b) => b[1].freq - a[1].freq)
    .map(([country, def]) => ({
      country,
      flag: def.flag,
      rarity: def.rarity,
      count: null,
      fresh: false,
      locked: true,
      title: "Never fielded.",
    }));
  return [...found, ...locked];
}


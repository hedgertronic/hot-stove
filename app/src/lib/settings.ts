/** Mode selection persists across visits (BUILD.md: localStorage `hotstove.settings`). */
import { BADGE_BY_KEY, BADGES, COLLECTIBLE } from "./badges";
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

/** Rarest first; anti-trophies last, where they read as a punchline. */
const RARITY_ORDER = [
  "legend",
  "ultra",
  "rare",
  "uncommon",
  "common",
  "ironic",
];
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

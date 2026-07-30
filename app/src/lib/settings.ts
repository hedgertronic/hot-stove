/** Mode selection persists across visits (BUILD.md: localStorage `hotstove.settings`). */
import { DEFAULT_CONFIG, type Bank, type Difficulty, type GameConfig } from "./engine.svelte";

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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ v: SETTINGS_VERSION, ...config }));
  } catch {
    /* storage unavailable */
  }
}

export interface HistoryEntry {
  date: string;
  total: number;
  record: string;
  spins: number;
  difficulty?: string;
  bank?: string;
  moneyball?: boolean;
  v?: number;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const h = JSON.parse(localStorage.getItem("hotstove.history") ?? "[]");
    return Array.isArray(h) ? h : [];
  } catch {
    return [];
  }
}

/** Best score + game count for one mode combo. Legacy entries (no v stamp)
 * get the same difficulty mapping as settings; pre-bank entries carry a
 * `moneyball` boolean instead of `bank`. */
export function bestFor(
  difficulty: Difficulty,
  bank: Bank,
): { best: number | null; games: number } {
  let best: number | null = null;
  let games = 0;
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
  }
  return { best, games };
}

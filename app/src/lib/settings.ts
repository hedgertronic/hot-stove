/** Mode selection persists across visits (BUILD.md: localStorage `hotstove.settings`). */
import { DEFAULT_CONFIG, type GameConfig } from "./engine.svelte";

const SETTINGS_KEY = "hotstove.settings";
const DIFFICULTIES = new Set(["standard", "scout", "eyetest"]);
const BANKS = new Set(["classic", "moneyball", "blankcheck"]);

export function loadSettings(): GameConfig {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const s = JSON.parse(raw);
    return {
      // "rookie" merged into "standard" when the ladder went to three rungs.
      difficulty: DIFFICULTIES.has(s.difficulty) ? s.difficulty : DEFAULT_CONFIG.difficulty,
      bank: BANKS.has(s.bank) ? s.bank : s.moneyball === true ? "moneyball" : DEFAULT_CONFIG.bank,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveSettings(config: GameConfig): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
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
}

export function loadHistory(): HistoryEntry[] {
  try {
    const h = JSON.parse(localStorage.getItem("hotstove.history") ?? "[]");
    return Array.isArray(h) ? h : [];
  } catch {
    return [];
  }
}

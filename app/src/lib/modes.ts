import {
  BLANK_CHECK_BUDGET_M,
  MONEYBALL_BUDGET_M,
  type Bank,
  type Difficulty,
} from "./engine.svelte";
import { money } from "./format";

/** The one table naming each difficulty and bank — emoji, display name, and
 * the home-screen card copy. The HUD chip, the finale share tag, and the home
 * pickers all read from here, so a mode is renamed in exactly one place.
 * `standard` and `classic` are the defaults: the HUD chip and share tag show
 * nothing for them, only for the opt-in modes. */

export interface DifficultyInfo {
  emoji: string;
  name: string;
  /** Home-screen card subtitle. */
  desc: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyInfo> = {
  standard: { emoji: "📊", name: "Box Score", desc: "Stats, salaries, and awards" },
  scout: { emoji: "🔭", name: "Eye Test", desc: "No stats, no awards" },
};

export interface BankInfo {
  emoji: string;
  name: string;
  /** Home-screen payroll pill ("$ · · ·" until the owner is hired in classic). */
  cash: string;
  /** Home-screen team-identity pill; empty for classic (no team yet). */
  team: string;
  /** Home-screen pill styling hook (open / oak / nyy). */
  cls: string;
}

export const BANKS: Record<Bank, BankInfo> = {
  classic: { emoji: "💼", name: "Owner's Box", cash: "$ · · ·", team: "", cls: "open" },
  moneyball: {
    emoji: "⚾",
    name: "Moneyball",
    cash: money(MONEYBALL_BUDGET_M),
    team: "OAK 2002",
    cls: "oak",
  },
  blankcheck: {
    emoji: "💸",
    name: "Blank Check",
    cash: money(BLANK_CHECK_BUDGET_M),
    team: "NYY 2005",
    cls: "nyy",
  },
};

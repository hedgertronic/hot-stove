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
  /** Home-screen row meta — terse dot-joined terms, rendered in caps. */
  desc: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyInfo> = {
  standard: { emoji: "📊", name: "Box Score", desc: "Stats · salaries · awards" },
  scout: { emoji: "🔭", name: "Eye Test", desc: "No stats · no awards" },
};

export interface BankInfo {
  emoji: string;
  name: string;
  /** Home-screen payroll pill. Classic's is a blank — payroll is unknown
   * until an owner is hired in-game — and Home draws it dashed. */
  cash: string;
  /** Home-screen team-identity chip beside the name; empty for classic
   * (no team yet). */
  team: string;
  /** Home-screen chip styling hook (open / oak / nyy). */
  cls: string;
}

export const BANKS: Record<Bank, BankInfo> = {
  /* "Clean House" is the empty-front-office start: no owner, no stadium, no
   * skipper, and a payroll nobody knows until you hire one. It's the only
   * bank where those rows exist at all (Game.fixedCap gates them off for the
   * two fixed-cap banks), and it shares a register with its siblings — three
   * baseball-business idioms rather than one label and two nicknames. The key
   * stays `classic`: saves and the record book index on it. */
  classic: { emoji: "💼", name: "Clean House", cash: "$ · · ·", team: "", cls: "open" },
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

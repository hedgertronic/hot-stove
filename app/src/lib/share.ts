import type { Bank, Difficulty } from "./engine.svelte";
import { recordFromTotal, seedCode, warTier, type WarTier } from "./format";
import { BANKS, DIFFICULTIES } from "./modes";
import { GAMES, GOAL_POINTS, MARINERS_WINS } from "./scoring";

/* ---------------------------------------------------------------------------
 * The shareable result string. Exactly five lines, every game, forever:
 *
 *   HOT STOVE 📊💼        HOT STOVE 🔭⚾
 *   🟩🟢🔵                 🟨🟡🟣
 *   🟢🔵⚪                 🟡🟣🔵
 *   🟣🟢⚪                 🟡🟣🔵
 *   104–58               162–0 🔱 🏆 💵 🔮
 *
 *   1.   Title — the game, and the two mode emoji that qualify the score.
 *   2-4. The finished roster as a fixed 3×3: the manager, then the eight
 *        slots in SLOT_TYPES order.
 *   5.   The record, trailed by any badges that fired.
 *
 * Five lines is the format's core invariant, not an outcome of what happened
 * to fit. Two results pasted one after the other line up row for row, which is
 * the same property the 3×3 grid buys inside a single string — badges ride the
 * record rather than taking a line of their own precisely so a decorated
 * season and a quiet one stay the same height.
 *
 * The grid is a ROSTER, not a spin log. A spin log runs 7–16 entries and mixes
 * players with owner/stadium/swap events, so no two strings share a shape and
 * there is nothing to compare cell against cell. The roster is always the same
 * nine things in the same nine places, which is the property that makes
 * Wordle's rectangle scannable: your top-left is my top-left. Row three lands
 * as SP·SP·RP, so the pitching staff reads as its own line.
 *
 * One number, and it comes last — the grid tells the story and the record is
 * the punchline, so nothing competes with the grid on the way down. The title
 * line is deliberately digit-free for the same reason.
 *
 * Everything survives a text message: five short lines, nothing wider than a
 * dozen characters, no columns, no alignment a proportional font can break.
 *
 * Nothing here spoils anything. No player, team, year, or card is named, so a
 * friend who plays the same cards learns only how well you did with them. The
 * grid is a result, not an answer key — the inverse of Wordle's constraint,
 * where the grid must hide the word.
 * ------------------------------------------------------------------------ */

/** Player cells: circles on the six-rung WAR ladder (lib/format.warTier),
 * cold to hot with gold on top — the same ramp the roster chips paint. */
const PLAYER_EMOJI: Record<WarTier, string> = {
  neg: "🔴",
  low: "⚪",
  mid: "🟢",
  high: "🔵",
  star: "🟣",
  elite: "🟡",
};

/** The manager cell: the same six hues, square instead of round. Same color
 * means what it means for a player, so the ladder is read once; the shape is
 * what says "this one is the skipper" without spending a legend on it. */
const MANAGER_EMOJI: Record<WarTier, string> = {
  neg: "🟥",
  low: "⬜",
  mid: "🟩",
  high: "🟦",
  star: "🟪",
  elite: "🟨",
};

/** No manager hired, or a roster slot left open. Black is the one fill in the
 * palette that sits on neither ladder, so an absence can never be misread as a
 * tier — ⬜ is already the manager's replacement-level rung, and every other
 * neutral candidate is a player circle. */
const EMPTY_CELL = "⬛";

/** The grid's shape is a constant of the game — eight roster slots plus one
 * manager — not a formatting choice. */
const COLS = 3;
const CELLS = 9;

/** Everything the string prints, and nothing else.
 *
 * `total` is the only score input: the record is derived from it here, so the
 * shared record and the record stamp the player watched land on the finale
 * screen are the same number by construction — both resolve through
 * `format.recordFromTotal`. Baseline wins (50 + WAR + manager) are a different
 * number answering a different question and deliberately do not appear. */
export interface ShareInput {
  difficulty: Difficulty;
  bank: Bank;
  /** Final points. Drives the record line via `recordFromTotal`. */
  total: number;
  /** The hired manager's win contribution — `ScoreParts.managerWins`, i.e.
   * (team W − team L) × MANAGER_PER_NET_WIN. `null` when no skipper was
   * hired. Tiered on the same ladder as WAR, which its ≈ −6…+9 range fits. */
  managerWins: number | null;
  /** WAR per roster slot in SLOT_TYPES order (C, IF, IF, OF, FLEX, SP, SP,
   * RP); `null` for an unfilled slot. Short and long arrays are padded and
   * truncated to eight, so the grid is 3×3 whatever arrives. */
  roster: (number | null)[];
  /** Off by default. When supplied, the seed code trails the record line as
   * `104–58 #WDU` — the code the home screen's PLAY A SEED input takes, which
   * turns the string from a scorecard back into a replayable challenge. It
   * rides the record line rather than the title so the title stays free of
   * digits. */
  seed?: number;
  /** Badge emoji, already chosen, in display order — `shareBadges` produces
   * the current set. An empty list leaves the record line bare, with no
   * trailing space. Badges arrive finished rather than as facts to re-derive,
   * so a badge redesign never touches the formatting path. */
  badges?: string[];
}

/** The facts the badge set is keyed to.
 *
 * Records here are BASELINE wins (50 + WAR + manager), deliberately not the
 * total-derived record the string prints: awards, rings, and the payroll bonus
 * would make the 💯/🔱 rungs trivial to clear. Two different numbers answering
 * two different questions, which is why they live in different types. */
export interface BadgeFacts {
  baselineWins: number;
  baselineLosses: number;
  /** Final points — 🏆 fires at the 162 goal. */
  total: number;
  spendM: number;
  budgetM: number;
  /** `ScoreParts.budgetBonus`; 💵 wants it near its 10-point ceiling. */
  budgetBonus: number;
  scoutHits: number;
}

/* Badge triggers, calibrated against the 2000-game bot runs in tests/bots/:
 *   on-field  🔱 >116 baseline wins ⊃ 💯 ≥100 | 💀 ≥100 losses
 *   goal      🏆 total ≥162
 *   money     💸 ≥$25M over the bankroll | 💵 payroll bonus ≥9.5 (≥97.5% of
 *             the bankroll spent, unbusted) | 🧾 ≤60% spent AND a losing record
 *   scout     🔮 ≥7 of the dream team actually drafted
 * The three money faces are mutually exclusive by construction: busting the
 * bankroll zeroes the bonus, and ≥97.5% spent cannot also be ≤60%. */
const FARM_TAX_M = 25;
const DIME_BONUS = 9.5;
const CHEAP_PCT = 0.6;
const CRYSTAL_HITS = 7;

/** The badge set for a finale, in the same order the finale's own pill row
 * deals them out: on-field rung, the goal, money rung, scout. Uncapped — the
 * pill row caps at three because pills cost pixels; emoji in a text message
 * cost nothing.
 *
 * Most seasons produce an empty list, which is the point: the badge line is
 * the exception, not furniture, so a string that carries one is saying
 * something happened. */
export function shareBadges(f: BadgeFacts): string[] {
  const out: string[] = [];
  if (f.baselineWins > MARINERS_WINS) out.push("🔱");
  else if (f.baselineWins >= 100) out.push("💯");
  else if (f.baselineLosses >= 100) out.push("💀");
  if (f.total >= GOAL_POINTS) out.push("🏆");
  if (f.spendM - f.budgetM >= FARM_TAX_M) out.push("💸");
  else if (f.budgetBonus >= DIME_BONUS) out.push("💵");
  else if (f.spendM <= f.budgetM * CHEAP_PCT && f.baselineWins < f.baselineLosses) out.push("🧾");
  if (f.scoutHits >= CRYSTAL_HITS) out.push("🔮");
  return out;
}

/** The nine cells in reading order: manager, then the eight roster slots.
 * Always exactly nine, whatever the caller hands over. */
export function shareCells(roster: (number | null)[], managerWins: number | null): string[] {
  const cells = [managerWins === null ? EMPTY_CELL : MANAGER_EMOJI[warTier(managerWins)]];
  for (let i = 0; i < CELLS - 1; i++) {
    const war = roster[i];
    cells.push(war === null || war === undefined ? EMPTY_CELL : PLAYER_EMOJI[warTier(war)]);
  }
  return cells;
}

/** The 3×3 grid as three newline-separated rows:
 *
 *     MGR  C   IF
 *     IF   OF  UTIL
 *     SP   SP  RP
 */
export function shareGrid(roster: (number | null)[], managerWins: number | null): string {
  const cells = shareCells(roster, managerWins);
  const rows: string[] = [];
  for (let i = 0; i < CELLS; i += COLS) rows.push(cells.slice(i, i + COLS).join(""));
  return rows.join("\n");
}

/** The title line: the game, then both mode emoji, and no digits.
 *
 * Both emoji always print, including the `standard`/`classic` defaults the HUD
 * chip suppresses. The HUD can suppress them because you already know your own
 * settings; a share string is read by someone who does not, and a score in Eye
 * Test is not comparable to one in Box Score. A fixed four-character mode
 * stamp keeps every string the same shape, so a friend never has to notice an
 * emoji that isn't there. */
export function shareTitle(difficulty: Difficulty, bank: Bank): string {
  return `HOT STOVE ${DIFFICULTIES[difficulty].emoji}${BANKS[bank].emoji}`;
}

/** The record, from the same ladder the finale stamp and the home record book
 * read (`format.recordFromTotal`), so the three can never disagree. */
export function shareRecord(total: number): string {
  const { wins, losses } = recordFromTotal(total, GAMES, MARINERS_WINS);
  return `${wins}–${losses}`;
}

/** The last line: the record, then any badges, then the seed if one was asked
 * for. Assembled by joining only the parts that exist, so a bare record has no
 * trailing space — the emoji separate themselves, and a lone space at the end
 * of a line is invisible in a diff and permanent in a text message.
 *
 * Badges ride this line rather than taking their own because five lines is the
 * invariant; a decorated season and a quiet one must be the same height. */
export function shareScoreLine(total: number, badges: string[] = [], seed?: number): string {
  const parts = [shareRecord(total), ...badges];
  if (seed !== undefined) parts.push(`#${seedCode(seed)}`);
  return parts.join(" ");
}

/** The full shareable string: title, the 3×3 grid, and the score line.
 * Exactly five lines, whatever the game did. */
export function shareText(input: ShareInput): string {
  return [
    shareTitle(input.difficulty, input.bank),
    shareGrid(input.roster, input.managerWins),
    shareScoreLine(input.total, input.badges, input.seed),
  ].join("\n");
}

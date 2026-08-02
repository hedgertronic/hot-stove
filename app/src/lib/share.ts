import { badgeEmoji } from "./badges";
import type { Bank, Difficulty } from "./engine.svelte";
import { recordFromTotal, seedCode, warTier, type WarTier } from "./format";
import { BANKS, DIFFICULTIES } from "./modes";
import { GAMES, MARINERS_WINS } from "./scoring";

/* ---------------------------------------------------------------------------
 * The shareable result string. Exactly five lines, every game, forever:
 *
 *   HOT STOVE 📊💼        HOT STOVE 🔭⚾
 *   🟩🟢🔵                 🟨🟡🟣
 *   🟢🔵⚪                 🟡🟣🔵
 *   🟣🟢⚪                 🟡🟣🔵
 *   104–58               162–0 🔱🏆💵🔮
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
  /** Badge KEYS (lib/badges), in the order `earnedBadges` deals them out —
   * `FinaleResult.badges` verbatim. The string resolves them to emoji itself,
   * so lib/badges stays the one place a badge's face is written down and a
   * caller can never spend an emoji the badge set doesn't own. Unknown keys
   * are dropped. An empty list leaves the record line bare, with no trailing
   * space. Uncapped: the finale's pill row caps itself because pills cost
   * pixels, and emoji in a text message do not. */
  badges?: string[];
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

/** The last line: the record, then the emoji of any badge that fired, then the
 * seed if one was asked for. `badges` arrives as KEYS and is resolved through
 * `badges.badgeEmoji` here. Assembled by joining only the parts that exist, so
 * a bare record has no trailing space — a lone space at the end of a line is
 * invisible in a diff and permanent in a text message.
 *
 * The badges are ONE part, not one part each: emoji butt against each other
 * and the line spends a single space separating the run from the record. They
 * are a haul rather than a list — the same reason the grid's cells touch —
 * and spacing them out made four badges read as four separate remarks.
 * Everything else on the line is a different KIND of thing, so the record, the
 * haul, and the seed each keep their own space.
 *
 * Badges ride this line rather than taking their own because five lines is the
 * invariant; a decorated season and a quiet one must be the same height. */
export function shareScoreLine(total: number, badges: string[] = [], seed?: number): string {
  const parts = [shareRecord(total), badgeEmoji(badges).join("")];
  if (seed !== undefined) parts.push(`#${seedCode(seed)}`);
  return parts.filter(Boolean).join(" ");
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

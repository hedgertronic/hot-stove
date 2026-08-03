import { badgeEmoji } from "./badges";
import type { Bank, Difficulty } from "./engine.svelte";
import { recordFromTotal, seedCode, warTier, type WarTier } from "./format";
import { BANKS, DIFFICULTIES } from "./modes";
import { GAMES, MARINERS_WINS } from "./scoring";

/* ---------------------------------------------------------------------------
 * The shareable result string. Five lines for a clean game, six for one
 * where at least one badge fired:
 *
 *   HOT STOVE 📊💼        HOT STOVE 🔭⚾
 *   🟩🟢🔵                 🟨🟡🟣
 *   🟢🔵⚪                 🟡🟣🔵
 *   🟣🟢⚪                 🟡🟣🔵
 *   💚 104–58 #CODE        💛 162–0
 *                          🔱🏆💵🔮
 *
 *   1.   Title — the game, and the two mode emoji that qualify the score.
 *   2-4. The finished roster as a fixed 3×3: the manager, then the eight
 *        slots in SLOT_TYPES order.
 *   5.   The record line: one heart in the season's tier color, then the
 *        win-loss record, then the seed code when one was shared. The heart
 *        is the tier signal; the record is the punchline.
 *   6.   The badge run — the emoji of every badge that fired, butting against
 *        each other with no separator, on their own line. Absent when no badge
 *        fires, so a clean game and a decorated one differ by exactly one line.
 *
 * The grid is a ROSTER, not a spin log. A spin log runs 7–16 entries and mixes
 * players with owner/stadium/swap events, so no two strings share a shape and
 * there is nothing to compare cell against cell. The roster is always the same
 * nine things in the same nine places, which is the property that makes
 * Wordle's rectangle scannable: your top-left is my top-left. Row three lands
 * as SP·SP·RP, so the pitching staff reads as its own line.
 *
 * The record line's leading heart uses a color vocabulary distinct from the
 * grid's circles and squares, so the tier signal never reads as a stray roster
 * cell. The color ramp is the same ladder: 💔 for a losing season, 🤍 at .500,
 * 💚 at the century mark, 💙 at the Mariners record, 💜 for 135+, 💛 for 155+.
 * A reader who knows 💙 on a player's WAR chip means "star-caliber" reads 💙 on
 * the record line as "star-caliber season" — one ramp, two uses.
 *
 * Badges live on their own line below the record rather than trailing the
 * record so they are free of its width. The title and grid lines always occupy
 * lines 1–4 and the record always occupies line 5, so two results pasted side
 * by side still align row for row through the grid whether or not badges fired.
 *
 * Everything survives a text message: short lines, no columns, no alignment a
 * proportional font can break.
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

/** The record line's tier heart: one colored heart per rung on the record
 * ladder (lib/format.recordFromTotal, thresholds at 81 / 100 / 116 / 135 /
 * 155 wins), using hearts rather than the grid's circles and squares so the
 * glyph reads as "season quality" and never as a stray roster cell.
 *
 * The same six hues as the WAR ladder — brick → gray → green → blue →
 * violet → gold — but the thresholds are different: the WAR ladder steps at
 * 0 / 2 / 4 / 6 / 8 WAR, while this ladder steps at win landmarks a baseball
 * fan already knows. Never derive the record tier from `warTier(wins)` —
 * `warTier(104)` returns "elite" because 104 ≥ 8, which would stamp a
 * 104-win season gold instead of green. Always read `tier` from
 * `recordFromTotal`. */
const RECORD_TIER_EMOJI: Record<WarTier, string> = {
  neg: "💔",
  low: "🤍",
  mid: "💚",
  high: "💙",
  star: "💜",
  elite: "💛",
};

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
   * `💚 104–58 #WDU` — the code the home screen's PLAY A SEED input takes,
   * which turns the string from a scorecard back into a replayable challenge.
   * It rides the record line rather than the title so the title stays free of
   * digits, and rather than the badge line so the seed is always on line five
   * regardless of what badges fired. */
  seed?: number;
  /** Badge KEYS (lib/badges), in the order `earnedBadges` deals them out —
   * `FinaleResult.badges` verbatim. The string resolves them to emoji itself,
   * so lib/badges stays the one place a badge's face is written down and a
   * caller can never spend an emoji the badge set doesn't own. Unknown keys
   * are dropped. An empty list produces no badge line. Uncapped: the finale's
   * pill row caps itself because pills cost pixels, and emoji on their own line
   * do not; they now have the full line to themselves. */
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

/** The win-loss record from the same ladder the finale stamp and the home
 * record book read (`format.recordFromTotal`), so the three can never disagree.
 * Returns only the record string ("104–58") — the tier glyph lives in
 * `shareRecordLine` alongside the other record-line parts. */
export function shareRecord(total: number): string {
  const { wins, losses } = recordFromTotal(total, GAMES, MARINERS_WINS);
  return `${wins}–${losses}`;
}

/** The fifth line: a tier heart, the win-loss record, and the seed code when
 * one was asked for.
 *
 * The heart encodes which rung of the record ladder the season landed on —
 * the same thresholds `format.recordFromTotal` uses, so the heart and the
 * colored stamp the finale displays can never disagree. It reads `tier` from
 * `recordFromTotal` directly rather than calling `warTier(wins)`: the record
 * ladder's rungs sit at 81 / 100 / 116 / 135 / 155 wins, and `warTier(104)`
 * returns "elite" (since 104 ≥ 8 WAR) — the wrong answer.
 *
 * The seed, when supplied, follows the record with a single space, so the
 * line reads as "what you scored, then how to replay it." It is here rather
 * than on the badge line so the code is always on line five, independent of
 * what badges the game earned. */
export function shareRecordLine(total: number, seed?: number): string {
  const { wins, losses, tier } = recordFromTotal(total, GAMES, MARINERS_WINS);
  const heart = RECORD_TIER_EMOJI[tier];
  const parts = [`${heart} ${wins}–${losses}`];
  if (seed !== undefined) parts.push(`#${seedCode(seed)}`);
  return parts.join(" ");
}

/** The sixth line (absent when empty): the emoji of every badge that fired,
 * resolved by key through `badges.badgeEmoji` and butted against each other
 * with no separator.
 *
 * Returns an empty string when the list is empty or every key is unknown —
 * `shareText` omits the line entirely in that case, so a clean game never
 * produces a blank sixth line. Unknown keys vanish without a trailing space:
 * a lone space at the end of a line is invisible in a diff and permanent in
 * a text message. */
export function shareBadgeLine(badges: string[] = []): string {
  return badgeEmoji(badges).join("");
}

/** The full shareable string: title, the 3×3 grid, the record line, and
 * the badge run on its own line when at least one badge fired.
 *
 * Five lines for a clean game, six for a decorated one. Lines 1–4 (title +
 * grid) are always the same height, so two results pasted side by side
 * compare row for row through the grid regardless of what badges fired. */
export function shareText(input: ShareInput): string {
  const badgeLine = shareBadgeLine(input.badges);
  const lines = [
    shareTitle(input.difficulty, input.bank),
    shareGrid(input.roster, input.managerWins),
    shareRecordLine(input.total, input.seed),
  ];
  if (badgeLine) lines.push(badgeLine);
  return lines.join("\n");
}

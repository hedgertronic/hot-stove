import { badgeEmoji } from "./badges";
import { Game } from "./engine.svelte";
import type { Bank, Difficulty, CompactAction, DecisionLogHeader, GameConfig } from "./engine.svelte";
import { recordFromTotal, seedCode, warTier, type WarTier } from "./format";
import { BANKS, DIFFICULTIES } from "./modes";
import { GAMES, MARINERS_WINS } from "./scoring";
import type { GameIndex, Meta, Owners } from "./types";

/* ---------------------------------------------------------------------------
 * The shareable result string. Five lines for a clean game, six for one
 * where at least one badge fired:
 *
 *   HOT STOVE              HOT STOVE 🔭🐘
 *   🟩🟢🔵                 🟨🟡🟣
 *   🟢🔵⚪                 🟡🟣🔵
 *   🟣🟢⚪                 🟡🟣🔵
 *   104–58 💚 #CODE        162–0 💛
 *                          🔱🏆💵🔮
 *
 *   1.   Title — the game, and a mode emoji for each OPT-IN mode in play.
 *   2-4. The finished roster as a fixed 3×3: the manager, then the eight
 *        slots in SLOT_TYPES order.
 *   5.   The record line: the win-loss record, then one heart in the
 *        season's tier color, then the seed code when one was shared. The
 *        record leads because it is the punchline; the heart stamps the
 *        verdict on it.
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
 * The record line's trailing heart uses a color vocabulary distinct from the
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
   * `104–58 💚 #WDU` — the code the home screen's PLAY A SEED input takes,
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

/** The title line: the game, then a mode emoji per OPT-IN mode, and no
 * digits. Difficulty leads, bank follows — the HUD chip's order.
 *
 * The defaults print NOTHING, exactly as the HUD chip shows nothing for
 * them: a plain "HOT STOVE" IS the ordinary game, and an emoji only appears
 * when something out of the ordinary qualifies the score — Eye Test, the
 * elephant, the blank check. (The title printed both emoji unconditionally
 * for a round, on the theory that a fixed stamp kept every string one shape;
 * in practice the default stamps were noise a reader had to learn to skip,
 * and the HUD had already taught players that emoji mean opt-ins.) */
export function shareTitle(difficulty: Difficulty, bank: Bank): string {
  const marks =
    (difficulty === "standard" ? "" : DIFFICULTIES[difficulty].emoji) +
    (bank === "classic" ? "" : BANKS[bank].emoji);
  return marks === "" ? "HOT STOVE" : `HOT STOVE ${marks}`;
}

/** The win-loss record from the same ladder the finale stamp and the home
 * record book read (`format.recordFromTotal`), so the three can never disagree.
 * Returns only the record string ("104–58") — the tier glyph lives in
 * `shareRecordLine` alongside the other record-line parts. */
export function shareRecord(total: number): string {
  const { wins, losses } = recordFromTotal(total, GAMES, MARINERS_WINS);
  return `${wins}–${losses}`;
}

/** The fifth line: the win-loss record, a tier heart, and the seed code when
 * one was asked for. The record leads — it is the punchline — and the heart
 * trails it as the verdict stamp.
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
  const parts = [`${wins}–${losses} ${heart}`];
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

/* ---------------------------------------------------------------------------
 * Compact decision log — shortcode format v2
 *
 * The log is COMPLETE with respect to outcome-relevant free choices: every
 * decision that changes what commits is a token here, so re-running the tokens
 * against a Game on the same seed and settings reproduces the season exactly
 * (lib/engine `driveReplay`, and `replayShortcode` below). The two arming
 * toggles that change a committed outcome — ✌️ Double Play, which buys a
 * second pick off the same card, and 🏠 Homegrown, which changes the price
 * paid — carry their own verbs for that reason. 🔁 Trade Deadline and ⭐ Prime
 * Time do not: arming them only gates refusals, and the commits they enable
 * (W / V / P / Q) say so themselves.
 *
 * v1 → v2 added the D and H toggles. A v1 code is not replayable — its DP and
 * discount states are unrecoverable, and a v1 token stream for a doubled spin
 * is byte-identical to one for two ordinary spins — so `replayShortcode`
 * refuses it. `decodeDecisionLog` still reads it, since a bug report pasted
 * into `window.__hotstove.decodeLog` is worth reading whatever minted it.
 *
 * HEADER (12 chars, fixed-width):
 *   [0]     Format version: '2' ('1' decodes, but does not replay)
 *   [1..7]  Seed: 7 uppercase base36 chars (same encoding as seedCode())
 *   [8]     Difficulty: 's'=standard, 'c'=scout
 *   [9]     Bank: 'c'=classic, 'm'=moneyball, 'k'=blankcheck
 *   [10]    Save-schema version: single base36 char 0–z
 *   [11]    Source: 'f'=finale, 'n'=current, '-'=absent/direct
 *
 * BODY: sequence of tokens, no separators
 *   Each token is an uppercase verb letter followed by fixed-width lowercase
 *   base36 params whose count is determined by the verb:
 *
 *   Verb  Params     Meaning
 *   S     pi si      sign from reel card; pi=player idx(1), si=slot idx(1)
 *   W     pi si      swap (trade) from reel card; same params as S
 *   P     ci pi si   prime sign; ci=card idx(2), pi=player idx(1), si=slot(1)
 *   V     ci pi si   prime swap; same params as P
 *   O                hire owner from reel card
 *   A                buy stadium from reel card
 *   M                hire manager from reel card (any path incl. TD tap)
 *   Q     ci         prime manager; ci=card idx(2)
 *   T     ci         season ticket; ci=target card idx(2)
 *   R     ci         relocate; ci=target card idx(2)
 *   U                undo
 *   C                cold respin
 *   D                ✌️ Double Play toggle (arm or disarm)
 *   H                🏠 Homegrown toggle (arm or disarm)
 *
 *   Param widths:
 *     pi  — 1 base36 char, index into card.players (data order, not UI sort)
 *     si  — 1 base36 char, slot index 0–7 (SLOT_TYPES order)
 *     ci  — 2 base36 chars, index into index.cards (data order); covers
 *            up to 1295 cards (36²), sufficient for the 1985–2025 window
 *
 *   Note: the Homegrown ($1M) discount rides the H toggle rather than the
 *   signing token — the price a sign commits at follows from the arm state,
 *   so the arm state is what the log records.
 * ------------------------------------------------------------------------ */

/** Encode a compact action sequence to a body string (no header). */
function encodeBody(actions: CompactAction[]): string {
  let s = "";
  for (const a of actions) {
    if (a.verb === "S" || a.verb === "W") {
      s += a.verb + a.pi.toString(36) + a.si.toString(36);
    } else if (a.verb === "P" || a.verb === "V") {
      s += a.verb + a.ci.toString(36).padStart(2, "0") + a.pi.toString(36) + a.si.toString(36);
    } else if (a.verb === "Q" || a.verb === "T" || a.verb === "R") {
      s += a.verb + a.ci.toString(36).padStart(2, "0");
    } else {
      s += a.verb; // O, A, M, U, C, D, H
    }
  }
  return s;
}

/** Decode a compact body string to CompactAction[]. Returns [] on corrupt input. */
function decodeBody(body: string): CompactAction[] {
  const actions: CompactAction[] = [];
  let i = 0;
  while (i < body.length) {
    const verb = body[i++];
    if (verb === "S" || verb === "W") {
      const pi = parseInt(body[i++], 36);
      const si = parseInt(body[i++], 36);
      actions.push({ verb, pi, si });
    } else if (verb === "P" || verb === "V") {
      const ci = parseInt(body.slice(i, i + 2), 36); i += 2;
      const pi = parseInt(body[i++], 36);
      const si = parseInt(body[i++], 36);
      actions.push({ verb, ci, pi, si });
    } else if (verb === "Q" || verb === "T" || verb === "R") {
      const ci = parseInt(body.slice(i, i + 2), 36); i += 2;
      actions.push({ verb, ci });
    } else if (
      verb === "O" || verb === "A" || verb === "M" ||
      verb === "U" || verb === "C" || verb === "D" || verb === "H"
    ) {
      actions.push({ verb } as CompactAction);
    } else {
      return []; // unrecognized — corrupt
    }
  }
  return actions;
}

/** The format version this build MINTS. Decoding accepts older versions —
 * replaying does not (see the grammar note above). */
const LOG_VERSION = "2";

/** Build the 12-char header string from a DecisionLogHeader. */
function encodeHeader(h: DecisionLogHeader): string {
  const seed7 = (h.seed >>> 0).toString(36).toUpperCase().padStart(7, "0");
  const diff = h.diff === "scout" ? "c" : "s";
  const bank = h.bank === "moneyball" ? "m" : h.bank === "blankcheck" ? "k" : "c";
  const sv = (h.sv ?? 0).toString(36);
  const src = h.src === "finale" ? "f" : h.src === "current" ? "n" : "-";
  return LOG_VERSION + seed7 + diff + bank + sv + src;
}

/** Encode a decision log header + actions as a compact shortcode string. */
export function encodeDecisionLog(
  header: DecisionLogHeader,
  actions: CompactAction[],
): string {
  return encodeHeader(header) + encodeBody(actions);
}

/** Decode a string produced by `encodeDecisionLog` (or `Game#debugLog`).
 * Returns null when the string is too short, starts with an unrecognized
 * version char, or contains an unrecognized verb. */
export function decodeDecisionLog(
  s: string,
): { header: DecisionLogHeader; log: CompactAction[] } | null {
  if (s.length < 12) return null;
  // The version the string CARRIES, not the one this build mints: a v1 code
  // still decodes for a bug report; `replayShortcode` is where v1 is refused.
  const v = s[0] === "1" ? 1 : s[0] === "2" ? 2 : 0;
  if (v === 0) return null;
  const seed = parseInt(s.slice(1, 8), 36);
  if (!Number.isInteger(seed) || isNaN(seed)) return null;
  const diffChar = s[8];
  const diff = diffChar === "s" ? "standard" : diffChar === "c" ? "scout" : "";
  if (!diff) return null;
  const bankChar = s[9];
  const bank =
    bankChar === "c" ? "classic" : bankChar === "m" ? "moneyball" : bankChar === "k" ? "blankcheck" : "";
  if (!bank) return null;
  const sv = parseInt(s[10], 36);
  const srcChar = s[11];
  const src: "finale" | "current" | undefined =
    srcChar === "f" ? "finale" : srcChar === "n" ? "current" : undefined;
  const header: DecisionLogHeader = { v, seed, sv, src, diff, bank };
  const log = decodeBody(s.slice(12));
  return { header, log };
}

/** Rebuild a finished season from a shortcode — the shareable replay.
 *
 * Returns an inert `Game` parked on its finale, or null when the code cannot
 * be replayed on this build: a format version this build does not drive (v1
 * codes, whose ✌️/🏠 states were never recorded), a header that does not
 * parse, a token that no longer applies (a data rebuild shifts what a player
 * index means), or a log that runs out before the club is complete. Null is
 * the whole error vocabulary — a partial finale is never handed back.
 *
 * The Game is marked `inert` BEFORE the first action, so nothing about the
 * replay reaches storage: not the viewer's in-progress save, not the history
 * log, not the archive, not the boot claim.
 *
 * The save-schema char (`sv`) is deliberately NOT checked. It means different
 * things depending on where the log was read from — SAVE_VERSION off
 * `hotstove.current`, FINALE_VERSION off `hotstove.finale` — so it identifies
 * a record shape this code never touches. What has to hold is the FORMAT
 * version and the tokens themselves, and `driveReplay` checks the tokens by
 * replaying them. */
export async function replayShortcode(
  meta: Meta,
  index: GameIndex,
  owners: Owners,
  code: string,
): Promise<Game | null> {
  const decoded = decodeDecisionLog(code.trim());
  if (!decoded || decoded.header.v !== 2) return null;
  const { header, log } = decoded;
  const game = new Game(meta, index, owners, header.seed, {
    difficulty: header.diff as GameConfig["difficulty"],
    bank: header.bank as GameConfig["bank"],
  });
  game.inert = true;
  try {
    return (await game.driveReplay(log)) === -1 ? game : null;
  } catch {
    // Nothing in the drive is expected to throw — a refused action returns
    // silently and shows up as a parity failure — but a card fetch can, and a
    // replay that cannot finish is a replay that cannot be shown.
    return null;
  }
}

/** Read the decision log from localStorage and encode it as a compact
 * shortcode string, without requiring a live Game reference.
 *
 * Prefers `hotstove.finale` over `hotstove.current` so the log is available
 * after the game ends. The `src` field in the header identifies which record
 * was read: `"finale"` records carry FINALE_VERSION; `"current"` records carry
 * SAVE_VERSION — the two `sv` values belong to different schemas.
 *
 * Returns null when localStorage is unavailable, empty, or corrupt. */
export function debugLogFromStorage(): string | null {
  try {
    const finaleRaw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("hotstove.finale")
        : null;
    const currentRaw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("hotstove.current")
        : null;
    const raw = finaleRaw ?? currentRaw;
    if (!raw) return null;
    const src: "finale" | "current" = finaleRaw !== null ? "finale" : "current";
    const s = JSON.parse(raw);
    const actions: CompactAction[] =
      typeof s.decisionLog === "string" ? decodeBody(s.decisionLog) : [];
    return encodeDecisionLog(
      {
        v: 2,
        seed: s.seed,
        sv: s.v,
        src,
        diff: s.config?.difficulty ?? "standard",
        bank: s.config?.bank ?? "classic",
      },
      actions,
    );
  } catch {
    return null;
  }
}

/* Register browser-console helpers when running in a browser environment.
 * `window.__hotstove.debugLog()` reads from localStorage so it works both
 * during a game (hotstove.current) and after one finishes (hotstove.finale),
 * with no live Game reference required. Guard prevents a throw in Node/Vitest. */
if (typeof window !== "undefined") {
  const w = window as Window & { __hotstove?: Record<string, unknown> };
  w.__hotstove ??= {};
  /** Encode the current or most-recently-finished game's decision log as a
   * compact shortcode. Copy the output and include it in a bug report.
   * Decode it with `window.__hotstove.decodeLog(str)`. */
  w.__hotstove.debugLog = debugLogFromStorage;
  /** Decode a string produced by `debugLog()` or `Game#debugLog()`. */
  w.__hotstove.decodeLog = decodeDecisionLog;
}

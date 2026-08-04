import { awardRank } from "./awards";
import { eligibleTypes, isPitcher } from "./eligibility";
import type { CardPlayer } from "./types";

/** Today as `YYYY-MM-DD` in the PLAYER'S timezone. History rows carry this
 * stamp and the seasons list prints it back; `toISOString()` would shift an
 * evening game to tomorrow's date for anyone west of Greenwich. */
export function localDateStamp(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Normalized display dollars, always in millions ("$136.3M", "$110M", "$0.9M"). */
export function money(m: number): string {
  return `$${m.toFixed(1).replace(/\.0$/, "")}M`;
}

/** Surname-ish display for roster cells: drop the first given name only. */
export function lastName(full: string): string {
  const parts = full.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : full;
}

/** Tier buckets from BUILD.md — WAR chip color, cold-to-hot with a medal on
 * top: gray = replacement (0–2), blue = everyday starter (2–4), green =
 * all-star (4–6), violet = MVP candidate (6–8), gold = generational (8+);
 * brick marks below-replacement. Gold caps the ramp because elite = gold
 * medal is the one universal sports color. */
export type WarTier = "neg" | "low" | "mid" | "high" | "star" | "elite";
export function warTier(war: number): WarTier {
  if (war >= 8) return "elite";
  if (war >= 6) return "star";
  if (war >= 4) return "high";
  if (war >= 2) return "mid";
  if (war >= 0) return "low";
  return "neg";
}

/** Tier buckets from BUILD.md — salary text color. */
export type CostTier = "cheap" | "mid" | "spendy";
export function costTier(costM: number): CostTier {
  if (costM < 8) return "cheap";
  if (costM > 25) return "spendy";
  return "mid";
}

/** Canonical hardware order for award pill rows: prestige first (MVP ballot,
 * then Cy Young ballot, then ROY), fielding/hitting hardware after, All-Star
 * always last. The order itself is `rank` in lib/awards.ts, beside the label
 * and the hue family the pill spends — one registry, so a code cannot be
 * orderable here and nameless there. Unknown codes sort behind everything,
 * original order kept (`sort` is stable, and every unranked code shares one
 * rank). */
export function sortAwards(awards: string[]): string[] {
  return [...awards].sort((a, b) => awardRank(a) - awardRank(b));
}

/** Display label for a roster slot. Internal slot keys are frozen (saves and
 * data reference them); only the label shifts — FLEX reads as UTIL on screen. */
export function slotLabel(slot: string): string {
  return slot === "FLEX" ? "UTIL" : slot;
}

/** Which specialist slot group a primary position already implies. DH implies
 * none (UTIL-only); pitchers never reach this map. */
const POS_GROUP: Record<string, string> = {
  C: "C",
  "1B": "IF",
  "2B": "IF",
  "3B": "IF",
  SS: "IF",
  LF: "OF",
  CF: "OF",
  RF: "OF",
};

/** Position-chip label: the raw position plus any EXTRA specialist slot
 * groups the season's games earn (C→IF→OF order) — "2B/OF", "C/IF/OF".
 * Two-way seasons (pos already "/"-joined, e.g. Ohtani's "SP/DH") pass
 * through whole; pure pitchers stay bare "SP"/"RP". UTIL is implied for
 * every hitter, so it's never listed. */
export function posLabel(p: CardPlayer): string {
  if (p.pos.includes("/")) return p.pos;
  if (isPitcher(p)) return p.pos;
  const primary = POS_GROUP[p.pos];
  const extras = eligibleTypes(p).filter((t) => t !== "FLEX" && t !== primary);
  return [p.pos, ...extras].join("/");
}

export function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  return n >= 0 ? `+${v}` : `−${v.replace("-", "")}`;
}

/** A stat as a CHIP prints it: a positive reads bare, a negative keeps its
 * minus — and the typographic one `signed` sets, not a hyphen.
 *
 * WAR has always read this way ("5.2", never "+5.2"), so a manager's wins read
 * this way too. The two numbers sit in the same six-rung chip on the same rows
 * and answer the same question, and a plus on one of them made the pair look
 * like different scales when the only difference is the unit beside them. The
 * unit is what says which scale this is; the sign is not.
 *
 * NOT for arithmetic. The finale's ledger spells out a sum — "50 + 36.9 WAR +
 * Piniella +4.0" — where the plus is an operator and `signed` is still right. */
export function statValue(n: number, digits = 1): string {
  return n < 0 ? signed(n, digits) : n.toFixed(digits);
}

/** Game seed ⇄ shareable code: uppercase base36 of the uint32 seed (≤7 chars). */
export function seedCode(seed: number): string {
  return (seed >>> 0).toString(36).toUpperCase();
}

/** Parse a user-entered seed code (case-insensitive, optional leading #).
 * Returns null on anything that isn't a uint32 base36 code. */
export function parseSeedCode(code: string): number | null {
  const c = code.trim().replace(/^#/, "").toUpperCase();
  if (!/^[0-9A-Z]{1,7}$/.test(c)) return null;
  const n = parseInt(c, 36);
  if (!Number.isInteger(n) || n > 0xffffffff) return null;
  return n;
}

/** The season record a points total resolves into, with its rung on the WAR
 * ladder the whole game speaks: round the points to a win count, clamp to the
 * 162-game season (a blown-out negative total is an 0–162 season; ≥162 caps
 * at 162–0 and the exact points disambiguate).
 *
 * Every rung sits on a landmark a baseball fan already knows: .500 (81) grays
 * out, the century mark (100) goes green, the Mariners line (116) the 🔱 badge
 * celebrates goes blue, 135 takes the violet, and 155 takes the gold. A losing
 * season — anything under .500 — goes brick.
 *
 * The ramp is calibrated so a color means roughly the same "how impressive is
 * this" here as it does on a WAR chip, measured over 20,000 paired bot seeds
 * per population: gold fires in 4.2% of strong-play games (was 22.3% at the old
 * 145) and violet in 52%; against no-powerup play, violet is 2.4% versus the
 * 2.5% of visible card seasons that earn a violet WAR chip.
 *
 * Exact rarity-matching is unreachable and deliberately not attempted: wins
 * clamp at 162, and strong play already crosses 162 in ~1% of games — above the
 * 0.67% of seasons that earn gold. Matching the lower rungs would mean printing
 * a 138–24 season in blue as below-average, which is incoherent next to a
 * literal win-loss record no matter how correct its frequency. Landmarks win
 * below gold; the math only sets the top.
 *
 * Used by the finale stamp and the home record book — one ladder, two screens.
 * Note the record book reads a personal best (a max over many games), so its
 * stamp runs hotter than these per-game rates by construction. */
export function recordFromTotal(
  total: number,
  games = 162,
  marinersWins = 116,
): { wins: number; losses: number; tier: WarTier } {
  const wins = Math.min(Math.max(Math.round(total), 0), games);
  const tier: WarTier =
    wins >= 155 ? "elite"
    : wins >= 135 ? "star"
    : wins >= marinersWins ? "high"
    : wins >= 100 ? "mid"
    : wins >= games / 2 ? "low"
    : "neg";
  return { wins, losses: games - wins, tier };
}

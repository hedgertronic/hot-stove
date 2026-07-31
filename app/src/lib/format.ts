import { eligibleTypes, isPitcher } from "./eligibility";
import type { CardPlayer } from "./types";

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
 * always last. Unknown codes sort behind everything, original order kept. */
const AWARD_ORDER = ["MVP", "MVP2", "MVP3", "CY", "CY2", "CY3", "ROY", "GG", "SS", "AS"];
export function sortAwards(awards: string[]): string[] {
  const rank = (a: string) => {
    const i = AWARD_ORDER.indexOf(a);
    return i === -1 ? AWARD_ORDER.length : i;
  };
  return [...awards].sort((a, b) => rank(a) - rank(b));
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

/** Rate stat in baseball notation: 0.292 → ".292" (1.000+ keeps its digit). */
function dot3(a: number): string {
  return a.toFixed(3).replace(/^0\./, ".");
}

/** Scout-mode trad stat line. Pitchers read W–L / ERA / K; everyone else reads
 * the triple slash plus HR·RBI·SB. Two-way seasons show the pitching line. */
export function statLine(p: {
  pos: string;
  bat?: { avg: number; obp: number; slg: number; hr: number; rbi: number; sb: number };
  pit?: { w: number; l: number; sv: number; era: number; so: number };
}): string {
  if (isPitcher(p) && p.pit)
    return `${p.pit.w}–${p.pit.l} · ${p.pit.era.toFixed(2)} ERA · ${p.pit.so} K`;
  if (p.bat)
    return `${dot3(p.bat.avg)}/${dot3(p.bat.obp)}/${dot3(p.bat.slg)} · ${p.bat.hr} HR · ${p.bat.rbi} RBI · ${p.bat.sb} SB`;
  return "";
}

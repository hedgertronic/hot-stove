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
 * all-star (4–6), gold = MVP (6+); brick marks below-replacement. Gold caps
 * the ramp because elite = gold medal is the one universal sports color. */
export type WarTier = "neg" | "low" | "mid" | "high" | "elite";
export function warTier(war: number): WarTier {
  if (war >= 6) return "elite";
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

export function signed(n: number, digits = 1): string {
  const v = n.toFixed(digits);
  return n >= 0 ? `+${v}` : `−${v.replace("-", "")}`;
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
  const pitcher = p.pos.startsWith("SP") || p.pos === "RP";
  if (pitcher && p.pit)
    return `${p.pit.w}–${p.pit.l} · ${p.pit.era.toFixed(2)} ERA · ${p.pit.so} K`;
  if (p.bat)
    return `${dot3(p.bat.avg)}/${dot3(p.bat.obp)}/${dot3(p.bat.slg)} · ${p.bat.hr} HR · ${p.bat.rbi} RBI · ${p.bat.sb} SB`;
  return "";
}

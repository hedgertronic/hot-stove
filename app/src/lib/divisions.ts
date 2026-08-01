import type { IndexEntry } from "./types";

/** Fallback only: current MLB divisions keyed by Lahman franchise ID
 * (ANA=Angels, TBD=Rays, FLA=Marlins, WSN=Expos/Nationals). Used when index
 * rows lack the per-season `lg`/`div` fields (older cached data). */
export const DIVISIONS: { label: string; franchises: string[] }[] = [
  { label: "AL EAST", franchises: ["BAL", "BOS", "NYY", "TBD", "TOR"] },
  { label: "AL CENTRAL", franchises: ["CHW", "CLE", "DET", "KCR", "MIN"] },
  { label: "AL WEST", franchises: ["ANA", "HOU", "OAK", "SEA", "TEX"] },
  { label: "NL EAST", franchises: ["ATL", "FLA", "NYM", "PHI", "WSN"] },
  { label: "NL CENTRAL", franchises: ["CHC", "CIN", "MIL", "PIT", "STL"] },
  { label: "NL WEST", franchises: ["ARI", "COL", "LAD", "SDP", "SFG"] },
];

const DIV_NAMES: Record<string, string> = { E: "EAST", C: "CENTRAL", W: "WEST" };
const GROUP_ORDER = ["AL/E", "AL/C", "AL/W", "NL/E", "NL/C", "NL/W"];

export interface DivisionGroup {
  label: string;
  teams: IndexEntry[];
}

/** Groups one season's index rows by that season's actual league + division
 * (`lg`/`div`, emitted from Lahman Teams). Era-correct: pre-1994 years yield
 * four groups (no Central), Houston is NL through 2012, Milwaukee AL through
 * 1997, etc. Rows keep their incoming order within each group. Falls back to
 * the current-division map if any row lacks the fields. */
export function divisionsForYear(rows: IndexEntry[]): DivisionGroup[] {
  if (rows.length > 0 && rows.every((r) => r.lg && r.div)) {
    const groups = new Map<string, IndexEntry[]>();
    for (const r of rows) {
      const key = `${r.lg}/${r.div}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(r);
      else groups.set(key, [r]);
    }
    return GROUP_ORDER.filter((key) => groups.has(key)).map((key) => {
      const [lg, div] = key.split("/");
      return { label: `${lg} ${DIV_NAMES[div]}`, teams: groups.get(key)! };
    });
  }
  // Fallback: group by the current-division franchise map. Expansion clubs
  // missing from an early year just leave a shorter row.
  const byFranchise = new Map(rows.map((t) => [t.franchise, t]));
  return DIVISIONS.map((d) => ({
    label: d.label,
    teams: d.franchises.flatMap((f) => byFranchise.get(f) ?? []),
  })).filter((d) => d.teams.length > 0);
}

/** Current MLB divisions keyed by Lahman franchise ID (ANA=Angels, TBD=Rays,
 * FLA=Marlins, WSN=Expos/Nationals). Picker layout only — historical
 * realignments (pre-1994 two-division leagues, Astros in the NL) are ignored. */
export const DIVISIONS: { label: string; franchises: string[] }[] = [
  { label: "AL EAST", franchises: ["BAL", "BOS", "NYY", "TBD", "TOR"] },
  { label: "AL CENTRAL", franchises: ["CHW", "CLE", "DET", "KCR", "MIN"] },
  { label: "AL WEST", franchises: ["ANA", "HOU", "OAK", "SEA", "TEX"] },
  { label: "NL EAST", franchises: ["ATL", "FLA", "NYM", "PHI", "WSN"] },
  { label: "NL CENTRAL", franchises: ["CHC", "CIN", "MIL", "PIT", "STL"] },
  { label: "NL WEST", franchises: ["ARI", "COL", "LAD", "SDP", "SFG"] },
];

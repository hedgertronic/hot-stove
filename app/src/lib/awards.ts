/** The award registry — one row per hardware code, and the only place a code's
 * LABEL, its visual FAMILY and its sort RANK are written down. Those three used
 * to live in three files: AwardPill held the class map and the medal text,
 * format.ts held the order, and the two had no way of noticing when they
 * disagreed about which codes exist. A code added to one and not the other
 * rendered as a bare gray pill or sorted behind the All-Stars, silently.
 *
 * POINTS ARE NOT HERE, deliberately. `scoring.ts` mirrors `pipeline/scoring.py`
 * line for line and `pipeline/gen_fixtures.py` is what proves the two agree, so
 * AWARD_POINTS stays on that side of the parity boundary and scoring.ts imports
 * nothing from this file. A registry that reached across it would put a balance
 * constant one refactor away from drifting out of the fixture's reach. MOY's
 * value is not even in AWARD_POINTS — it is MANAGER_MOTY_POINTS, a manager
 * term — which is the second reason the two tables are not one.
 */

export interface AwardDef {
  /** The code as it appears in card data and on a season's `awards` list. */
  code: string;
  /** What the pill prints. The medal finishes carry their place as a glyph;
   * everything else prints its own code. */
  label: string;
  /** The pill's hue family — a CSS class on `.qb`, not a color. Ballot
   * finishes share their award's family, so 🥇MVP and 🥉MVP are one gold
   * ladder and the medal tells the places apart. */
  family: string;
  /** Position in the canonical display order: prestige first (MVP ballot, then
   * Cy Young ballot, then ROY), fielding/hitting hardware after, All-Star
   * always last. UNRANKED means "no seat in that row" — see below. */
  rank: number;
}

/** The rank of anything the row does not order: an unknown code, and MOY.
 * MOY is a MANAGER's award and never shares a row with player hardware, so it
 * has no place in a player's ladder and takes the same seat an unrecognized
 * code would. Sorting is stable, so everything at this rank keeps the order it
 * arrived in. */
export const UNRANKED = 10;

export const AWARDS: AwardDef[] = [
  { code: "MVP", label: "🥇MVP", family: "mvp", rank: 0 },
  { code: "MVP2", label: "🥈MVP", family: "mvp", rank: 1 },
  { code: "MVP3", label: "🥉MVP", family: "mvp", rank: 2 },
  { code: "CY", label: "🥇CY", family: "cy", rank: 3 },
  { code: "CY2", label: "🥈CY", family: "cy", rank: 4 },
  { code: "CY3", label: "🥉CY", family: "cy", rank: 5 },
  { code: "ROY", label: "ROY", family: "roy", rank: 6 },
  { code: "GG", label: "GG", family: "gg", rank: 7 },
  { code: "SS", label: "SS", family: "ss", rank: 8 },
  { code: "AS", label: "AS", family: "as", rank: 9 },
  /* Manager of the Year wears the skipper's pink — manager surfaces are pink
     throughout — and the text is what tells it apart from ROY, which only ever
     sits on player rows. */
  { code: "MOY", label: "MOY", family: "moy", rank: UNRANKED },
];

const BY_CODE = new Map(AWARDS.map((a) => [a.code, a]));

/** The registry row for a code, or undefined for one the game does not know. */
export function awardDef(code: string): AwardDef | undefined {
  return BY_CODE.get(code);
}

/** What the pill prints. An unknown code prints itself: a card carrying
 * hardware this build has never heard of still shows the player earned
 * something. */
export function awardLabel(code: string): string {
  return BY_CODE.get(code)?.label ?? code;
}

/** The pill's hue family, empty for an unknown code — which lands it on the
 * plain cardstock `.qb` base rather than inventing a color for it. */
export function awardFamily(code: string): string {
  return BY_CODE.get(code)?.family ?? "";
}

/** Where the code sits in a pill row's canonical order. */
export function awardRank(code: string): number {
  return BY_CODE.get(code)?.rank ?? UNRANKED;
}

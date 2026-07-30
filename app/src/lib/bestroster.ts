/** WAR-optimal roster from the cards a game actually spun — the finale's
 * "best possible squad" yardstick. Money is ignored on purpose: the yardstick
 * answers "did you spot the talent?", not "could you afford it?".
 *
 * Exact solve: slot types have tiny capacities (C1 IF2 OF1 FLEX1 SP2 RP1), so
 * a DP over the 2·3·2·2·3·2 = 144 capacity states is instant. Players are
 * grouped by B-R id first (one human per roster, same rule the draft enforces),
 * and within a group at most one season may be used. Deterministic: stable
 * iteration order + strict-improvement updates, so ties always resolve the
 * same way on every device. */
import { eligibleTypes } from "./eligibility";
import type { Card, CardPlayer, SlotType } from "./types";

export interface BestPick {
  id: string;
  name: string;
  pos: string;
  war: number;
  year: number;
  team: string;
  teamName: string;
  ws: boolean;
  pen: boolean;
  awards: string[];
}

export interface BestRoster {
  /** One entry per roster slot, SLOT_TYPES order (null = best play is empty). */
  picks: (BestPick | null)[];
  totalWar: number;
}

const TYPE_ORDER: SlotType[] = ["C", "IF", "OF", "FLEX", "SP", "RP"];
const CAPACITY = [1, 2, 1, 1, 2, 1];
/** Roster-rail slot index for the nth filled seat of each type. */
const SLOT_INDICES: Record<SlotType, number[]> = {
  C: [0],
  IF: [1, 2],
  OF: [3],
  FLEX: [4],
  SP: [5, 6],
  RP: [7],
};

interface Season {
  pick: BestPick;
  types: number[]; // TYPE_ORDER indices
}

const RADIX = CAPACITY.map((c) => c + 1);
const STATES = RADIX.reduce((a, b) => a * b, 1); // 144

function fill(state: number, type: number): number {
  let stride = 1;
  for (let t = 0; t < type; t++) stride *= RADIX[t];
  const used = Math.floor(state / stride) % RADIX[type];
  return used < CAPACITY[type] ? state + stride : -1;
}

export function bestRoster(cards: Card[]): BestRoster {
  // Group every card appearance by player id; one season per human may play.
  const groups = new Map<string, Season[]>();
  for (const card of cards) {
    for (const p of card.players) {
      if (p.war <= 0) continue; // can never improve a WAR-max roster
      const season: Season = {
        pick: {
          id: p.id,
          name: p.name,
          pos: p.pos,
          war: p.war,
          year: card.year,
          team: card.team,
          teamName: card.name,
          ws: p.ws,
          pen: p.pen,
          awards: p.awards,
        },
        types: eligibleTypes(p).map((t) => TYPE_ORDER.indexOf(t)),
      };
      const list = groups.get(p.id);
      if (list) list.push(season);
      else groups.set(p.id, [season]);
    }
  }
  const groupList = [...groups.values()];

  // dp[state] = best WAR after considering groups so far; parents rebuild picks.
  let dp = new Float64Array(STATES).fill(-1);
  dp[0] = 0;
  const parents: Int32Array[] = []; // packed: prevState*4096 + seasonIdx*8 + typeIdx (or -1 = skip)
  for (const seasons of groupList) {
    const next = Float64Array.from(dp);
    const parent = new Int32Array(STATES).fill(-1);
    for (let s = 0; s < STATES; s++) {
      if (dp[s] < 0) continue;
      for (let si = 0; si < seasons.length; si++) {
        const season = seasons[si];
        for (let ti = 0; ti < season.types.length; ti++) {
          const ns = fill(s, season.types[ti]);
          if (ns < 0) continue;
          const w = dp[s] + season.pick.war;
          if (w > next[ns]) {
            next[ns] = w;
            parent[ns] = s * 4096 + si * 8 + season.types[ti];
          }
        }
      }
    }
    dp = next;
    parents.push(parent);
  }

  let bestState = 0;
  for (let s = 1; s < STATES; s++) if (dp[s] > dp[bestState]) bestState = s;

  // Walk parents back to the chosen (season, type) pairs.
  const chosen: { pick: BestPick; type: number }[] = [];
  let state = bestState;
  for (let g = groupList.length - 1; g >= 0; g--) {
    const packed = parents[g][state];
    if (packed < 0) continue; // group skipped (or state predates it)
    const prev = Math.floor(packed / 4096);
    const si = Math.floor((packed % 4096) / 8);
    // Only unwind if this group actually produced the state (parent set during
    // this group's pass); packed >= 0 guarantees that by construction.
    chosen.push({ pick: groupList[g][si].pick, type: packed % 8 });
    state = prev;
  }

  const picks: (BestPick | null)[] = Array(8).fill(null);
  const seats: Record<number, number> = {};
  for (const { pick, type } of chosen.sort((a, b) => b.pick.war - a.pick.war)) {
    const seat = seats[type] ?? 0;
    seats[type] = seat + 1;
    picks[SLOT_INDICES[TYPE_ORDER[type]][seat]] = pick;
  }
  return { picks, totalWar: Math.round(dp[bestState] * 10) / 10 };
}

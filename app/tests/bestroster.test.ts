import { describe, expect, it } from "vitest";
import { bestRoster } from "../src/lib/bestroster";
import type { Card, CardPlayer } from "../src/lib/types";

let pid = 0;
function player(over: Partial<CardPlayer>): CardPlayer {
  return {
    id: `p${pid++}`,
    name: "Test Player",
    pos: "1B",
    war: 3,
    warRaw: 3,
    cost: 5,
    contract: 5,
    salary: 5_000_000,
    est: false,
    awards: [],
    ws: false,
    pen: false,
    pa: 500,
    gs: 0,
    relIP: 0,
    posG: { c: 0, if: 100, of: 0, dh: 0 },
    debut: "SEA",
    teams: ["SEA"],
    ...over,
  };
}

function card(players: CardPlayer[], over: Partial<Card> = {}): Card {
  return {
    year: 2001,
    team: "SEA",
    franchise: "SEA",
    name: "Seattle Mariners",
    park: "Safeco Field",
    wins: 116,
    losses: 46,
    manager: "Lou Piniella",
    ws: false,
    pen: false,
    attendance: 3_507_326,
    attendancePct: 0.99,
    stadiumMult: 1.15,
    budget: 100,
    budgetRaw: 60_000_000,
    contracts: [],
    prorated: 1,
    players,
    ...over,
  };
}

const IF = { c: 0, if: 100, of: 0, dh: 0 };
const OF = { c: 0, if: 0, of: 100, dh: 0 };
const C = { c: 100, if: 0, of: 0, dh: 0 };
const NONE = { c: 0, if: 0, of: 0, dh: 0 };

describe("bestRoster", () => {
  it("fills every slot type from a rich card and maximizes WAR", () => {
    const players = [
      player({ pos: "C", posG: C, war: 5 }),
      player({ pos: "SS", posG: IF, war: 7 }),
      player({ pos: "2B", posG: IF, war: 6 }),
      player({ pos: "3B", posG: IF, war: 4 }), // best FLEX
      player({ pos: "CF", posG: OF, war: 8 }),
      player({ pos: "SP", posG: NONE, gs: 30, war: 6 }),
      player({ pos: "SP", posG: NONE, gs: 30, war: 5 }),
      player({ pos: "RP", posG: NONE, relIP: 60, war: 2 }),
    ];
    const best = bestRoster([card(players)]);
    expect(best.totalWar).toBeCloseTo(5 + 7 + 6 + 4 + 8 + 6 + 5 + 2, 1);
    expect(best.picks.every((p) => p !== null)).toBe(true);
  });

  it("routes an infielder to FLEX when both IF seats are taken by better years", () => {
    const players = [
      player({ pos: "SS", posG: IF, war: 9 }),
      player({ pos: "2B", posG: IF, war: 8 }),
      player({ pos: "3B", posG: IF, war: 7 }), // must land in FLEX
    ];
    const best = bestRoster([card(players)]);
    expect(best.totalWar).toBeCloseTo(24, 1);
    expect(best.picks[4]?.war).toBe(7); // FLEX seat
  });

  it("uses at most one season per human across cards", () => {
    const early = player({ pos: "CF", posG: OF, war: 6, id: "trout" });
    const later = player({ pos: "CF", posG: OF, war: 9, id: "trout" });
    const best = bestRoster([
      card([early], { year: 2012 }),
      card([later], { year: 2016 }),
    ]);
    const trouts = best.picks.filter((p) => p?.id === "trout");
    expect(trouts).toHaveLength(1);
    expect(trouts[0]?.war).toBe(9);
    expect(trouts[0]?.year).toBe(2016);
  });

  it("never rosters negative-WAR players and leaves unfillable slots empty", () => {
    const best = bestRoster([card([player({ pos: "C", posG: C, war: -1 })])]);
    expect(best.totalWar).toBe(0);
    expect(best.picks.every((p) => p === null)).toBe(true);
  });
});

describe("bestRoster awards in the objective", () => {
  it("an award-heavy lower-WAR season beats a plain higher-WAR one", () => {
    // Same human, two seasons (one may play): 7.0 WAR + MVP (3 pts) = 10
    // value > 9.0 WAR plain. A same-slot rival wouldn't work here — FLEX
    // catches every hitter, so two catchers would simply both roster.
    const mvpSeason = player({ pos: "C", posG: C, war: 7, awards: ["MVP"], id: "star" });
    const plainSeason = player({ pos: "C", posG: C, war: 9, id: "star" });
    const best = bestRoster([
      card([mvpSeason], { year: 2001 }),
      card([plainSeason], { year: 2002 }),
    ]);
    const chosen = best.picks.filter((p) => p?.id === "star");
    expect(chosen).toHaveLength(1);
    expect(chosen[0]?.year).toBe(2001);
    // totalWar reports the WAR of the chosen picks, not the objective value.
    expect(best.totalWar).toBeCloseTo(7, 1);
  });

  it("awards break a WAR tie deterministically", () => {
    // Same human, equal WAR, one season has a Gold Glove: the award is worth
    // a real point, so that season wins regardless of card order.
    const gg = player({ pos: "C", posG: C, war: 6, awards: ["GG"], id: "dup" });
    const plain = player({ pos: "C", posG: C, war: 6, id: "dup" });
    for (const cards of [
      [card([plain], { year: 2001 }), card([gg], { year: 2002 })],
      [card([gg], { year: 2002 }), card([plain], { year: 2001 })],
    ]) {
      const chosen = bestRoster(cards).picks.filter((p) => p?.id === "dup");
      expect(chosen).toHaveLength(1);
      expect(chosen[0]?.year).toBe(2002);
      expect(chosen[0]?.awards).toEqual(["GG"]);
    }
  });

  it("matches the WAR-only objective when no season has awards", () => {
    const players = [
      player({ pos: "SS", posG: IF, war: 9 }),
      player({ pos: "2B", posG: IF, war: 8 }),
      player({ pos: "3B", posG: IF, war: 7 }),
      player({ pos: "CF", posG: OF, war: 5 }),
    ];
    const best = bestRoster([card(players)]);
    expect(best.totalWar).toBeCloseTo(29, 1);
    expect(best.picks[4]?.war).toBe(7); // 3B still routes to FLEX
  });

  it("a below-replacement season with a big award can now make the roster", () => {
    // −0.5 WAR + MVP (3 pts) = 2.5 value: the objective says it belongs.
    const oddMvp = player({ pos: "C", posG: C, war: -0.5, awards: ["MVP"], id: "odd" });
    const best = bestRoster([card([oddMvp])]);
    expect(best.picks[0]?.id).toBe("odd");
    expect(best.totalWar).toBeCloseTo(-0.5, 1);
  });
});

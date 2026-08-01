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

/** One card per player: distinct team-seasons, no skipper. A spin buys one
 * thing from the card it lands on, so a roster test that wants eight players
 * needs eight cards — and no manager competing for them. */
function soloCards(players: CardPlayer[]): Card[] {
  return players.map((p, i) =>
    card([p], {
      team: `T${i}`,
      franchise: `T${i}`,
      name: `Team ${i}`,
      year: 1980 + i,
      manager: null,
    }),
  );
}

/** "team year" keys for every filled seat plus the skipper — the unit the
 * one-pick-per-card rule counts. */
function cardKeys(best: ReturnType<typeof bestRoster>): string[] {
  const keys = best.picks.filter((p) => p !== null).map((p) => `${p!.team} ${p!.year}`);
  if (best.manager) keys.push(`${best.manager.team} ${best.manager.year}`);
  return keys;
}

const IF = { c: 0, if: 100, of: 0, dh: 0 };
const OF = { c: 0, if: 0, of: 100, dh: 0 };
const C = { c: 100, if: 0, of: 0, dh: 0 };
const NONE = { c: 0, if: 0, of: 0, dh: 0 };

/** Eight players covering every slot type, one per card. */
const fullSquad = (): CardPlayer[] => [
  player({ pos: "C", posG: C, war: 5 }),
  player({ pos: "SS", posG: IF, war: 7 }),
  player({ pos: "2B", posG: IF, war: 6 }),
  player({ pos: "3B", posG: IF, war: 4 }), // best FLEX
  player({ pos: "CF", posG: OF, war: 8 }),
  player({ pos: "SP", posG: NONE, gs: 30, war: 6 }),
  player({ pos: "SP", posG: NONE, gs: 30, war: 5 }),
  player({ pos: "RP", posG: NONE, relIP: 60, war: 2 }),
];

describe("bestRoster", () => {
  it("fills every slot type from eight cards and maximizes WAR", () => {
    const best = bestRoster(soloCards(fullSquad()));
    expect(best.totalWar).toBeCloseTo(5 + 7 + 6 + 4 + 8 + 6 + 5 + 2, 1);
    expect(best.picks.every((p) => p !== null)).toBe(true);
  });

  it("routes an infielder to FLEX when both IF seats are taken by better years", () => {
    const best = bestRoster(
      soloCards([
        player({ pos: "SS", posG: IF, war: 9 }),
        player({ pos: "2B", posG: IF, war: 8 }),
        player({ pos: "3B", posG: IF, war: 7 }), // must land in FLEX
      ]),
    );
    expect(best.totalWar).toBeCloseTo(24, 1);
    expect(best.picks[4]?.war).toBe(7); // FLEX seat
  });

  it("uses at most one season per human across cards", () => {
    const early = player({ pos: "CF", posG: OF, war: 6, id: "trout" });
    const later = player({ pos: "CF", posG: OF, war: 9, id: "trout" });
    const best = bestRoster([
      card([early], { year: 2012, manager: null }),
      card([later], { year: 2016, manager: null }),
    ]);
    const trouts = best.picks.filter((p) => p?.id === "trout");
    expect(trouts).toHaveLength(1);
    expect(trouts[0]?.war).toBe(9);
    expect(trouts[0]?.year).toBe(2016);
  });

  it("never rosters negative-WAR players and leaves unfillable slots empty", () => {
    const best = bestRoster([
      card([player({ pos: "C", posG: C, war: -1 })], { manager: null }),
    ]);
    expect(best.totalWar).toBe(0);
    expect(best.picks.every((p) => p === null)).toBe(true);
    expect(best.manager).toBeNull();
    expect(best.dreamSeats).toBe(0);
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
      card([mvpSeason], { year: 2001, manager: null }),
      card([plainSeason], { year: 2002, manager: null }),
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
      [card([plain], { year: 2001, manager: null }), card([gg], { year: 2002, manager: null })],
      [card([gg], { year: 2002, manager: null }), card([plain], { year: 2001, manager: null })],
    ]) {
      const chosen = bestRoster(cards).picks.filter((p) => p?.id === "dup");
      expect(chosen).toHaveLength(1);
      expect(chosen[0]?.year).toBe(2002);
      expect(chosen[0]?.awards).toEqual(["GG"]);
    }
  });

  it("matches the WAR-only objective when no season has awards", () => {
    const best = bestRoster(
      soloCards([
        player({ pos: "SS", posG: IF, war: 9 }),
        player({ pos: "2B", posG: IF, war: 8 }),
        player({ pos: "3B", posG: IF, war: 7 }),
        player({ pos: "CF", posG: OF, war: 5 }),
      ]),
    );
    expect(best.totalWar).toBeCloseTo(29, 1);
    expect(best.picks[4]?.war).toBe(7); // 3B still routes to FLEX
  });

  it("a below-replacement season with a big award can now make the roster", () => {
    // −0.5 WAR + MVP (3 pts) = 2.5 value: the objective says it belongs.
    const oddMvp = player({ pos: "C", posG: C, war: -0.5, awards: ["MVP"], id: "odd" });
    const best = bestRoster([card([oddMvp], { manager: null })]);
    expect(best.picks[0]?.id).toBe("odd");
    expect(best.totalWar).toBeCloseTo(-0.5, 1);
  });
});

describe("bestRoster one pick per card", () => {
  it("takes at most one player from a stacked card", () => {
    // Three cards, eight great players apiece: the dream team can still only
    // be three deep, because three spins is three choices.
    const stacked = [0, 1, 2].map((i) =>
      card(fullSquad(), {
        team: `S${i}`,
        franchise: `S${i}`,
        name: `Stack ${i}`,
        year: 1990 + i,
        manager: null,
      }),
    );
    const best = bestRoster(stacked);
    const filled = best.picks.filter((p) => p !== null);
    expect(filled).toHaveLength(3);
    expect(new Set(cardKeys(best)).size).toBe(3);
  });

  it("never repeats a team-season across seats or the dugout", () => {
    const cards = [0, 1, 2, 3, 4].map((i) =>
      card(fullSquad(), {
        team: `S${i}`,
        franchise: `S${i}`,
        name: `Stack ${i}`,
        year: 1990 + i,
        wins: 100 - i,
        losses: 62 + i,
      }),
    );
    const best = bestRoster(cards);
    const keys = cardKeys(best);
    expect(keys).toHaveLength(5); // four seats + the skipper, one per card
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("collapses duplicate team-seasons in the input to a single card", () => {
    const one = card(fullSquad(), { manager: null });
    const dupe = bestRoster([one, card(fullSquad(), { manager: null })]);
    expect(dupe.picks.filter((p) => p !== null)).toHaveLength(1);
    expect(bestRoster([one]).totalWar).toBe(dupe.totalWar);
  });

  it("keeps the skipper's card out of the player picks", () => {
    // The dugout card also holds the single best bat in the pool. A solver that
    // billed the manager separately would take both off one spin.
    const boss = card([player({ pos: "C", posG: C, war: 12 })], {
      team: "BOS",
      franchise: "BOS",
      name: "Boss Nine",
      year: 1975,
      wins: 130,
      losses: 32, // net +98 → 19.6, far and away the best skipper
    });
    const rest = [1, 2, 3].map((i) =>
      card([player({ pos: "CF", posG: OF, war: 4 })], {
        team: `R${i}`,
        franchise: `R${i}`,
        name: `Rest ${i}`,
        year: 1990 + i,
        wins: 81,
        losses: 81,
      }),
    );
    const best = bestRoster([boss, ...rest]);
    const fromBoss = cardKeys(best).filter((k) => k === "BOS 1975");
    expect(fromBoss).toHaveLength(1);
  });
});

describe("bestRoster joint manager solve", () => {
  it("beats manager-first greedy when the best skipper's card holds the best bat", () => {
    // A: skipper +100 net (20.0) and a 9.0 WAR catcher. B: skipper +90 (18.0)
    // and a 1.0 WAR catcher. Greedy hires A's skipper and is left with B's
    // filler bat: 21.0. The joint solve hires B and takes A's catcher: 27.0.
    const a = card([player({ pos: "C", posG: C, war: 9 })], {
      team: "AAA", franchise: "AAA", name: "A Nine", year: 1991,
      wins: 131, losses: 31, manager: "Skipper A",
    });
    const b = card([player({ pos: "C", posG: C, war: 1 })], {
      team: "BBB", franchise: "BBB", name: "B Nine", year: 1992,
      wins: 126, losses: 36, manager: "Skipper B",
    });
    const best = bestRoster([a, b]);
    expect(best.manager?.name).toBe("Skipper B");
    expect(best.totalWar).toBeCloseTo(9, 1);
    expect(best.picks.filter((p) => p !== null)).toHaveLength(1);
    expect(best.picks.find((p) => p !== null)?.team).toBe("AAA");
  });

  it("hires the plain skipper when no player competes for his card", () => {
    // Same two skippers, but the bats now sit on their own cards: nothing
    // stops the solve from taking the better manager.
    const a = card([], {
      team: "AAA", franchise: "AAA", name: "A Nine", year: 1991,
      wins: 131, losses: 31, manager: "Skipper A",
    });
    const b = card([], {
      team: "BBB", franchise: "BBB", name: "B Nine", year: 1992,
      wins: 126, losses: 36, manager: "Skipper B",
    });
    const best = bestRoster([a, b, ...soloCards([player({ pos: "C", posG: C, war: 9 })])]);
    expect(best.manager?.name).toBe("Skipper A");
    expect(best.totalWar).toBeCloseTo(9, 1);
  });

  it("counts Manager of the Year as +2 in the skipper's value", () => {
    // +5 net = 1.0; +10 net = 2.0. The MotY bonus is worth more than that
    // 1.0 gap, so the trophy flips the pick — and only the trophy.
    const mk = (moty: boolean): Card[] => [
      card([], {
        team: "MOY", franchise: "MOY", name: "Moty Nine", year: 1991,
        wins: 84, losses: 79, manager: "Trophy Skip", managerMoty: moty,
      }),
      card([], {
        team: "PLN", franchise: "PLN", name: "Plain Nine", year: 1992,
        wins: 86, losses: 76, manager: "Plain Skip",
      }),
    ];
    expect(bestRoster(mk(true)).manager?.name).toBe("Trophy Skip");
    expect(bestRoster(mk(false)).manager?.name).toBe("Plain Skip");
  });

  it("hires a skipper even when every available record is losing", () => {
    // The game makes a manager mandatory, so the yardstick spends a card on
    // one too — the least-bad dugout, not an empty one.
    const best = bestRoster([
      card([], {
        team: "BAD", franchise: "BAD", name: "Bad Nine", year: 1991,
        wins: 50, losses: 112, manager: "Worse Skip",
      }),
      card([], {
        team: "MEH", franchise: "MEH", name: "Meh Nine", year: 1992,
        wins: 75, losses: 87, manager: "Less Bad Skip",
      }),
    ]);
    expect(best.manager?.name).toBe("Less Bad Skip");
  });

  it("leaves the dugout empty when no spun card carried a manager", () => {
    const best = bestRoster(soloCards(fullSquad()));
    expect(best.manager).toBeNull();
    expect(best.dreamSeats).toBe(8);
  });
});

describe("bestRoster human uniqueness under the card cap", () => {
  it("seats a two-card human once and backfills from the other card", () => {
    // Both cards carry the same star; only one of them also carries a spare
    // bat. Optimal: the star off the card that has nothing else, the spare
    // off the other.
    const star = (): CardPlayer => player({ pos: "C", posG: C, war: 8, id: "star" });
    const cards = [
      card([star()], { team: "X1", franchise: "X1", name: "X One", year: 1991, manager: null }),
      card([star(), player({ pos: "CF", posG: OF, war: 5, id: "spare" })], {
        team: "X2", franchise: "X2", name: "X Two", year: 1992, manager: null,
      }),
    ];
    const best = bestRoster(cards);
    const ids = best.picks.filter((p) => p !== null).map((p) => p!.id);
    expect(ids.sort()).toEqual(["spare", "star"]);
    expect(best.picks.find((p) => p?.id === "star")?.team).toBe("X1");
    expect(best.totalWar).toBeCloseTo(13, 1);
    expect(new Set(cardKeys(best)).size).toBe(2);
  });

  it("holds both rules at once across a crowded pool", () => {
    // Five cards, three shared humans, a skipper on each: whatever the solve
    // returns, no human repeats and no team-season repeats.
    const shared = ["ace", "bat", "arm"];
    const cards = [0, 1, 2, 3, 4].map((i) =>
      card(
        [
          player({ pos: "C", posG: C, war: 6 + i, id: shared[0] }),
          player({ pos: "SS", posG: IF, war: 9 - i, id: shared[1] }),
          player({ pos: "SP", posG: NONE, gs: 30, war: 4 + i, id: shared[2] }),
          player({ pos: "RP", posG: NONE, relIP: 60, war: 1 + i }),
        ],
        {
          team: `M${i}`, franchise: `M${i}`, name: `Mix ${i}`, year: 1990 + i,
          wins: 90 + i, losses: 72 - i,
        },
      ),
    );
    const best = bestRoster(cards);
    const ids = best.picks.filter((p) => p !== null).map((p) => p!.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = cardKeys(best);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeLessThanOrEqual(5);
  });
});

describe("bestRoster with a small card pool", () => {
  /** n cards, one usable player and one skipper apiece — the shape of a game
   * that skipped every optional special. */
  const pool = (n: number): Card[] => {
    const kinds: Partial<CardPlayer>[] = [
      { pos: "C", posG: C },
      { pos: "SS", posG: IF },
      { pos: "2B", posG: IF },
      { pos: "CF", posG: OF },
      { pos: "3B", posG: IF }, // FLEX
      { pos: "SP", posG: NONE, gs: 30 },
      { pos: "SP", posG: NONE, gs: 30 },
      { pos: "RP", posG: NONE, relIP: 60 },
      { pos: "1B", posG: IF },
    ];
    return Array.from({ length: n }, (_, i) =>
      card([player({ ...kinds[i % kinds.length], war: 9 - i })], {
        team: `P${i}`, franchise: `P${i}`, name: `Pool ${i}`, year: 1990 + i,
        wins: 90 - i, losses: 72 + i,
      }),
    );
  };

  it("fills only eight of nine seats from eight cards", () => {
    // Eight spins buy eight things, and one of them has to be the skipper.
    const best = bestRoster(pool(8));
    expect(best.manager).not.toBeNull();
    expect(best.picks.filter((p) => p !== null)).toHaveLength(7);
    expect(best.dreamSeats).toBe(8);
    expect(new Set(cardKeys(best)).size).toBe(8);
  });

  it("fills all nine seats from nine cards", () => {
    const best = bestRoster(pool(9));
    expect(best.manager).not.toBeNull();
    expect(best.picks.every((p) => p !== null)).toBe(true);
    expect(best.dreamSeats).toBe(9);
  });

  it("counts only reachable seats when most cards have no usable player", () => {
    // Six of eight cards are all-replacement: those spins could only ever have
    // bought a skipper, so the honest denominator is 3, not 9.
    const cards = pool(8).map((c, i) =>
      i < 6 ? { ...c, players: [player({ pos: "C", posG: C, war: -2 })] } : c,
    );
    const best = bestRoster(cards);
    expect(best.picks.filter((p) => p !== null)).toHaveLength(2);
    expect(best.manager).not.toBeNull();
    expect(best.dreamSeats).toBe(3);
  });

  it("survives an empty card pool", () => {
    const best = bestRoster([]);
    expect(best.picks.every((p) => p === null)).toBe(true);
    expect(best.manager).toBeNull();
    expect(best.dreamSeats).toBe(0);
    expect(best.totalWar).toBe(0);
  });
});

describe("bestRoster determinism", () => {
  it("returns an identical club on repeated calls", () => {
    const cards = [0, 1, 2, 3, 4, 5].map((i) =>
      card(
        [
          player({ pos: "C", posG: C, war: 5, id: "tie-c" }),
          player({ pos: "SS", posG: IF, war: 5, id: `ss${i}` }),
          player({ pos: "SP", posG: NONE, gs: 30, war: 5, id: `sp${i}` }),
        ],
        {
          team: `D${i}`, franchise: `D${i}`, name: `Dup ${i}`, year: 1990 + i,
          wins: 90, losses: 72, // identical skipper value on every card
        },
      ),
    );
    const first = bestRoster(cards);
    for (let n = 0; n < 4; n++) expect(bestRoster(cards)).toEqual(first);
  });

  it("does not depend on which order equal cards arrive in", () => {
    // Same pool, reversed: the optimum's VALUE must not move (which of two
    // equal-value clubs wins may, and that is fine — one run is one order).
    const cards = pool6();
    const fwd = bestRoster(cards);
    const rev = bestRoster([...cards].reverse());
    expect(rev.totalWar).toBeCloseTo(fwd.totalWar, 5);
    expect(rev.manager?.netWins).toBe(fwd.manager?.netWins);
  });

  function pool6(): Card[] {
    return [0, 1, 2, 3, 4, 5].map((i) =>
      card(
        [
          player({ pos: "C", posG: C, war: 4 + i }),
          player({ pos: "CF", posG: OF, war: 7 - i }),
        ],
        {
          team: `O${i}`, franchise: `O${i}`, name: `Ord ${i}`, year: 1990 + i,
          wins: 85 + i, losses: 77 - i,
        },
      ),
    );
  }
});

/** The dream-club solver. Two halves:
 *
 * - ROSTER MECHANICS (one pick per card, one season per human, slot capacity,
 *   the joint manager solve) run through `dream()`, which hands the solver a
 *   fixed bank. A fixed bank has no owner and no ballpark to buy, so no card is
 *   spent on the front office and these tests say what they used to say. The
 *   cap is deliberately enormous, which makes the payroll slope (20/budget)
 *   negligible and leaves the objective reading as plain value.
 * - THE FINALE OBJECTIVE (payroll bonus, luxury tax, owner, ballpark) runs
 *   through the classic-bank entry point, where the front office is solved.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bestRoster } from "../src/lib/bestroster";
import { GAMES, MANAGER_PER_NET_WIN, score } from "../src/lib/scoring";
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

/** A cap so large the payroll slope rounds away: the objective is value alone,
 * and (being a fixed bank) no card is spent on an owner or a ballpark. This is
 * the harness for every rule that is not about money. */
const HUGE = 1e7;
const dream = (cards: Card[]): ReturnType<typeof bestRoster> =>
  bestRoster(cards, { fixedBudgetM: HUGE });

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

/** How many cards supplied two things. ✌️ Double Play allows exactly one. */
function doubledCards(best: ReturnType<typeof bestRoster>): number {
  const counts = new Map<string, number>();
  for (const k of cardKeys(best)) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts.values()].filter((n) => n > 1).length;
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
    const best = dream(soloCards(fullSquad()));
    expect(best.totalWar).toBeCloseTo(5 + 7 + 6 + 4 + 8 + 6 + 5 + 2, 1);
    expect(best.picks.every((p) => p !== null)).toBe(true);
  });

  it("routes an infielder to FLEX when both IF seats are taken by better years", () => {
    const best = dream(
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
    const best = dream([
      card([early], { year: 2012, manager: null }),
      card([later], { year: 2016, manager: null }),
    ]);
    const trouts = best.picks.filter((p) => p?.id === "trout");
    expect(trouts).toHaveLength(1);
    expect(trouts[0]?.war).toBe(9);
    expect(trouts[0]?.year).toBe(2016);
  });

  it("rosters a season that costs more than the scout point it pays, because a seat must be filled", () => {
    // A seat on the dream club is worth SCOUT_HIT_POINTS (1.0) all by itself,
    // so on value alone the bar is −1.0 WAR and this catcher is under it: at
    // −2.0 he still loses the club half a win.
    //
    // He is signed anyway, and the reason is the game's rule rather than the
    // arithmetic. There is no passing (DECISIONS.md 2) and a club must be
    // complete to finish, so a player handed this one card takes this one
    // catcher. A yardstick that declined him would be measuring a season
    // nobody was allowed to play.
    const best = dream([card([player({ pos: "C", posG: C, war: -2 })], { manager: null })]);
    expect(best.picks[0]?.war).toBe(-2);
    expect(best.totalWar).toBe(-2);
    expect(best.manager).toBeNull();
    expect(best.dreamSeats).toBe(1);
  });

  it("rosters a slightly below-replacement season, because the seat itself scores", () => {
    // −0.5 WAR costs half a win and pays a whole scout point: net +0.5.
    const best = dream([card([player({ pos: "C", posG: C, war: -0.5 })], { manager: null })]);
    expect(best.picks[0]?.war).toBe(-0.5);
    expect(best.dreamSeats).toBe(1);
  });
});

describe("bestRoster awards in the objective", () => {
  it("an award-heavy lower-WAR season beats a plain higher-WAR one", () => {
    // Same human, two seasons (one may play): 7.0 WAR + MVP (3 pts) = 10
    // value > 9.0 WAR plain. A same-slot rival wouldn't work here — FLEX
    // catches every hitter, so two catchers would simply both roster.
    const mvpSeason = player({ pos: "C", posG: C, war: 7, awards: ["MVP"], id: "star" });
    const plainSeason = player({ pos: "C", posG: C, war: 9, id: "star" });
    const best = dream([
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
      const chosen = dream(cards).picks.filter((p) => p?.id === "dup");
      expect(chosen).toHaveLength(1);
      expect(chosen[0]?.year).toBe(2002);
      expect(chosen[0]?.awards).toEqual(["GG"]);
    }
  });

  it("matches the WAR-only objective when no season has awards", () => {
    const best = dream(
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
    const best = dream([card([oddMvp], { manager: null })]);
    expect(best.picks[0]?.id).toBe("odd");
    expect(best.totalWar).toBeCloseTo(-0.5, 1);
  });
});

describe("bestRoster one pick per card, plus one ✌️", () => {
  it("takes one player per stacked card, and two off exactly one of them", () => {
    // Three cards, eight great players apiece. Three spins is three choices —
    // plus the Double Play every game starts holding, which buys a second pick
    // off one of those spins. Four picks, never five.
    const stacked = [0, 1, 2].map((i) =>
      card(fullSquad(), {
        team: `S${i}`,
        franchise: `S${i}`,
        name: `Stack ${i}`,
        year: 1990 + i,
        manager: null,
      }),
    );
    const best = dream(stacked);
    expect(best.picks.filter((p) => p !== null)).toHaveLength(4);
    expect(new Set(cardKeys(best)).size).toBe(3);
    expect(doubledCards(best)).toBe(1);
  });

  it("spends its one Double Play on a single card, never two", () => {
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
    const best = dream(cards);
    const keys = cardKeys(best);
    expect(keys).toHaveLength(6); // five cards, one of them twice
    expect(doubledCards(best)).toBe(1);
  });

  it("collapses duplicate team-seasons in the input to a single card", () => {
    const one = card(fullSquad(), { manager: null });
    const dupe = dream([one, card(fullSquad(), { manager: null })]);
    // One card in the pool: one pick, plus the Double Play's second.
    expect(dupe.picks.filter((p) => p !== null)).toHaveLength(2);
    expect(dream([one]).totalWar).toBe(dupe.totalWar);
  });

  it("never takes three things off one card", () => {
    // The dugout card also holds the three best bats in the pool. One spin
    // plus one Double Play is two picks — a solver that billed the manager
    // separately would take all four.
    const boss = card(
      [
        player({ pos: "C", posG: C, war: 12 }),
        player({ pos: "CF", posG: OF, war: 11 }),
        player({ pos: "SP", posG: NONE, gs: 30, war: 10 }),
      ],
      {
        team: "BOS",
        franchise: "BOS",
        name: "Boss Nine",
        year: 1975,
        wins: 130,
        losses: 32, // net +98 → 19.6, far and away the best skipper
      },
    );
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
    const best = dream([boss, ...rest]);
    expect(cardKeys(best).filter((k) => k === "BOS 1975")).toHaveLength(2);
  });
});

describe("bestRoster joint manager solve", () => {
  it("beats manager-first greedy when the best skipper's card holds the best bat", () => {
    // A: skipper +100 net (20.0) and a 9.0 WAR catcher. B: skipper +90 (18.0)
    // and a 1.0 WAR catcher. Greedy hires A's skipper and is left with B's
    // filler bat: 21.0. The joint solve hires B and takes A's catcher: 27.0.
    // Card D is the richest place to spend the Double Play (two 9-WAR seats off
    // one spin), which keeps A down to the single pick the rule gives it.
    const a = card([player({ pos: "C", posG: C, war: 9 })], {
      team: "AAA", franchise: "AAA", name: "A Nine", year: 1991,
      wins: 131, losses: 31, manager: "Skipper A",
    });
    const b = card([player({ pos: "C", posG: C, war: 1 })], {
      team: "BBB", franchise: "BBB", name: "B Nine", year: 1992,
      wins: 126, losses: 36, manager: "Skipper B",
    });
    const d = card(
      [
        player({ pos: "CF", posG: OF, war: 9 }),
        player({ pos: "SP", posG: NONE, gs: 30, war: 9 }),
      ],
      { team: "DDD", franchise: "DDD", name: "D Nine", year: 1993, manager: null },
    );
    const best = dream([a, b, d]);
    expect(best.manager?.name).toBe("Skipper B");
    expect(best.picks.find((p) => p?.war === 9 && p?.pos === "C")?.team).toBe("AAA");
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
    const best = dream([a, b, ...soloCards([player({ pos: "C", posG: C, war: 9 })])]);
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
    expect(dream(mk(true)).manager?.name).toBe("Trophy Skip");
    expect(dream(mk(false)).manager?.name).toBe("Plain Skip");
  });

  it("hires a skipper even when every available record is losing", () => {
    // The game makes a manager mandatory, so the yardstick spends a card on
    // one too — the least-bad dugout, not an empty one.
    const best = dream([
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
    const best = dream(soloCards(fullSquad()));
    expect(best.manager).toBeNull();
    expect(best.dreamSeats).toBe(8);
  });
});

describe("bestRoster human uniqueness under the card cap", () => {
  it("seats a two-card human once and backfills from the other card", () => {
    // Both cards carry the same star; only one of them also carries a spare
    // bat. Whichever card seats the star, the human may only play once.
    const star = (): CardPlayer => player({ pos: "C", posG: C, war: 8, id: "star" });
    const cards = [
      card([star()], { team: "X1", franchise: "X1", name: "X One", year: 1991, manager: null }),
      card([star(), player({ pos: "CF", posG: OF, war: 5, id: "spare" })], {
        team: "X2", franchise: "X2", name: "X Two", year: 1992, manager: null,
      }),
    ];
    const best = dream(cards);
    const ids = best.picks.filter((p) => p !== null).map((p) => p!.id);
    expect(ids.sort()).toEqual(["spare", "star"]);
    expect(best.totalWar).toBeCloseTo(13, 1);
  });

  it("holds both rules at once across a crowded pool", () => {
    // Five cards, three shared humans, a skipper on each: whatever the solve
    // returns, no human repeats and no card gives up more than two things.
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
    const best = dream(cards);
    const ids = best.picks.filter((p) => p !== null).map((p) => p!.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(doubledCards(best)).toBeLessThanOrEqual(1);
    expect(new Set(cardKeys(best)).size).toBeLessThanOrEqual(5);
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

  it("fills all nine seats from eight cards, one of them doubled", () => {
    // Eight spins buy eight things; the Double Play buys the ninth off a card
    // that already gave up a bat, which is exactly the line the game allows.
    const best = dream(pool(8));
    expect(best.manager).not.toBeNull();
    expect(best.picks.filter((p) => p !== null)).toHaveLength(8);
    expect(best.dreamSeats).toBe(9);
    expect(doubledCards(best)).toBe(1);
  });

  it("fills only three seats from three cards plus the doubled one", () => {
    const best = dream(pool(3));
    expect(best.dreamSeats).toBe(4);
    expect(new Set(cardKeys(best)).size).toBe(3);
  });

  it("counts only reachable seats when most cards have no usable player", () => {
    // Six of eight cards carry nothing but a replacement-level catcher, and
    // there is one catcher seat. So those six spins can supply, between them,
    // one catcher and one skipper however badly they are wanted — the rest of
    // their offer is a seat that is already taken.
    //
    // The denominator is what the pool can REACH, not what it can afford. The
    // replacement catcher is signed (a seat that can be filled is filled), and
    // the club still stops short of nine because four of these cards have no
    // legal seat left to give.
    const cards = pool(8).map((c, i) =>
      i < 6 ? { ...c, players: [player({ pos: "C", posG: C, war: -2 })] } : c,
    );
    const best = dream(cards);
    expect(best.dreamSeats).toBeLessThan(9);
    expect(best.manager).not.toBeNull();
    // The catcher seat is filled by the only man who can fill it.
    expect(best.picks[0]?.war).toBe(-2);
    // Every seat the pool can reach is reached: two good cards plus the
    // doubled one, the replacement catcher, and the skipper.
    expect(best.picks.filter((p) => p !== null)).toHaveLength(4);
    expect(best.dreamSeats).toBe(5);
  });

  it("survives an empty card pool", () => {
    const best = dream([]);
    expect(best.picks.every((p) => p === null)).toBe(true);
    expect(best.manager).toBeNull();
    expect(best.dreamSeats).toBe(0);
    expect(best.totalWar).toBe(0);
    expect(best.total).toBe(0);
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
    expect(rev.total).toBeCloseTo(fwd.total!, 5);
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

// ---------------------------------------------------------------------------
// The finale objective: front office and payroll
// ---------------------------------------------------------------------------

/** Rebuild the finale total from the club the solver handed back, exactly the
 * way engine.finishGame does. The solver's `total` must equal this or the
 * ceiling on screen is not the score of the club on screen. */
function rescore(best: ReturnType<typeof bestRoster>): number {
  const picks = best.picks.filter((p) => p !== null);
  const mgr = best.manager;
  return score({
    totalWar: picks.reduce((t, p) => t + p!.war, 0),
    spendM: picks.reduce((t, p) => t + (p!.cost ?? 0), 0),
    budgetM: best.budget!,
    awardLists: picks.map((p) => p!.awards),
    rings: picks.filter((p) => p!.ws).length + (mgr?.ws ? 1 : 0),
    pennants: picks.filter((p) => p!.pen).length + (mgr?.pen ? 1 : 0),
    managerRecord: mgr ? [mgr.netWins, 0] : null,
    scoutHits: best.dreamSeats!,
    managerMoty: mgr?.moty === true,
  }).total;
}

/** Nine cards, distinct budgets and ballparks, one bat apiece. */
function frontOfficePool(over: (i: number) => Partial<Card> = () => ({})): Card[] {
  const kinds: Partial<CardPlayer>[] = [
    { pos: "C", posG: C },
    { pos: "SS", posG: IF },
    { pos: "2B", posG: IF },
    { pos: "CF", posG: OF },
    { pos: "3B", posG: IF },
    { pos: "SP", posG: NONE, gs: 30 },
    { pos: "SP", posG: NONE, gs: 30 },
    { pos: "RP", posG: NONE, relIP: 60 },
    { pos: "1B", posG: IF },
  ];
  return Array.from({ length: 9 }, (_, i) =>
    card([player({ ...kinds[i], war: 6, cost: 10 })], {
      team: `F${i}`, franchise: `F${i}`, name: `Front ${i}`, year: 1990 + i,
      wins: 90, losses: 72,
      budget: 20 + 20 * i,
      stadiumMult: 0.85 + 0.03 * i,
      ...over(i),
    }),
  );
}

describe("bestRoster front office", () => {
  it("hires an owner and buys a ballpark, each off its own card", () => {
    const best = bestRoster(frontOfficePool());
    expect(best.owner).not.toBeNull();
    expect(best.park).not.toBeNull();
    expect(`${best.owner!.team} ${best.owner!.year}`).not.toBe(
      `${best.park!.team} ${best.park!.year}`,
    );
    expect(best.budget).toBeCloseTo(best.owner!.budget * best.park!.mult, 6);
    // Neither front-office card may also fill a seat: one pick per card, and
    // the Double Play may double at most one of them.
    expect(doubledCards(best)).toBeLessThanOrEqual(1);
  });

  it("a fixed bank hires nobody and keeps the cap it was handed", () => {
    const best = bestRoster(frontOfficePool(), { fixedBudgetM: 51.5 });
    expect(best.owner).toBeNull();
    expect(best.park).toBeNull();
    expect(best.budget).toBe(51.5);
  });

  it("the reported total is the score of the club it returns", () => {
    for (const cards of [frontOfficePool(), frontOfficePool((i) => ({ budget: 90 - 5 * i }))]) {
      const best = bestRoster(cards);
      expect(best.total).toBeCloseTo(rescore(best), 6);
    }
  });

  it("picks the bankroll its roster can actually fill, not the fattest one", () => {
    // Every bat costs $10M and nine seats are on offer, so a club spends about
    // $80M. A $400M owner would leave the payroll 80% empty and give back most
    // of the bonus; the solve is expected to shop nearer its own spend.
    const best = bestRoster(
      frontOfficePool((i) => ({ budget: [40, 60, 80, 100, 400, 400, 400, 400, 400][i], stadiumMult: 1 })),
    );
    expect(best.budget).toBeLessThan(400);
    expect(best.spend! / best.budget!).toBeGreaterThan(0.5);
  });

  it("crosses the payroll when one monster season is worth the tax", () => {
    // Every bankroll is $40M and the ordinary bats cost $1M, so a legal club
    // banks about −6 on the bonus. One card holds a 30-WAR season at $45M:
    // signing him blows past the cap, forfeits the bonus and pays ~$12M of tax,
    // and still wins by 18 points. The search must be able to reach that club —
    // a solver that treats the cap as a wall never sees it at all.
    const cards = frontOfficePool(() => ({ budget: 40, stadiumMult: 1 })).map((c) => ({
      ...c,
      players: c.players.map((p) => ({ ...p, cost: 1 })),
    }));
    cards[0] = card([player({ pos: "C", posG: C, war: 30, cost: 45 })], {
      team: "MON", franchise: "MON", name: "Monster", year: 1927,
      wins: 90, losses: 72, budget: 40, stadiumMult: 1,
    });
    const best = bestRoster(cards);
    expect(best.picks.some((p) => p?.war === 30)).toBe(true);
    expect(best.spend!).toBeGreaterThan(best.budget!);
    expect(best.total!).toBeGreaterThan(best.underBudgetTotal!);
  });

  it("stays under the payroll when the tax would cost more than the talent", () => {
    const best = bestRoster(frontOfficePool(() => ({ budget: 200, stadiumMult: 1 })));
    expect(best.spend!).toBeLessThanOrEqual(best.budget!);
    expect(best.total).toBe(best.underBudgetTotal);
  });
});

describe("bestRoster off-reel seasons (⭐ Prime Time)", () => {
  const offReelCard = card([player({ pos: "CF", posG: OF, war: 12, cost: 8, id: "prime" })], {
    team: "OFF", franchise: "OFF", name: "Off Reel", year: 1955,
    budget: 999, stadiumMult: 1.15, manager: null,
  });

  it("seats a season the reel never landed on", () => {
    const best = bestRoster(frontOfficePool(), { offReel: [offReelCard] });
    expect(best.picks.some((p) => p?.id === "prime")).toBe(true);
  });

  it("never hires an owner or a ballpark off one", () => {
    // Prime Time reaches players and skippers only, so a season it reached
    // cannot also hand over its bankroll — which would be a free $999M cap.
    const best = bestRoster(frontOfficePool(), { offReel: [offReelCard] });
    expect(best.owner?.team).not.toBe("OFF");
    expect(best.park?.team).not.toBe("OFF");
    expect(best.budget).toBeLessThan(999);
  });
});

describe("bestRoster ceiling sanity", () => {
  it("the ceiling never asks for more than a 162-game season's worth of wins", () => {
    const best = bestRoster(frontOfficePool(() => ({ budget: 100, stadiumMult: 1 })));
    const picks = best.picks.filter((p) => p !== null);
    expect(50 + picks.reduce((t, p) => t + p!.war, 0) + (best.manager?.netWins ?? 0) * MANAGER_PER_NET_WIN)
      .toBeLessThanOrEqual(GAMES);
  });
});

/* THE EMPTY-SEAT REGRESSION, replayed on the pools that actually produced one.
 *
 * Every seed below is a real Classic game a bot played end to end, recorded as
 * the exact inputs the finale handed the solver: the distinct team-seasons the
 * reel landed on, and the one off-reel season a ⭐ Prime Time signing reached.
 * Against the solver as it stood, each of these printed a dream club with eight
 * seats and an empty ninth, and each printed a total that no complete club in
 * the same pool could match — which is the whole point, since the incomplete
 * club won BECAUSE it was incomplete. The seat it skipped was the one that put
 * payroll over the cap, and under the finale's own arithmetic the luxury tax it
 * dodged is worth more than the win it gave up.
 *
 * Real cards rather than fixtures, because the price is the mechanism. Fixture
 * cards cost $5M a man against a $999M cap, so no fixture pool can make an open
 * seat pay; these carry the corpus's real salaries and the game's real banks.
 *
 * Pinned by team-season rather than by seed: the pool is the input the solver
 * sees, so these keep testing the same thing if the reel's RNG or a bot policy
 * ever moves. If a data regen retires one of these cards the test fails loudly
 * on the missing file, which is the right outcome — it needs a new pool, not a
 * softer assertion. */
describe("bestRoster fills every seat, on the pools that left one open", () => {
  const CARD_DIR = path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../..",
    "data",
    "cards",
  );
  const readCard = (key: string): Card =>
    JSON.parse(fs.readFileSync(path.join(CARD_DIR, `${key}.json`), "utf8")) as Card;

  /** The off-reel pool the engine builds for ⭐ Prime Time: that season's card
   * narrowed to the one player the powerup bought, with its skipper stripped —
   * Prime Time buys one named thing, not the run of the card. */
  const primeCard = (key: string, id: string): Card => {
    const c = readCard(key);
    return { ...c, players: c.players.filter((p: CardPlayer) => p.id === id), manager: null };
  };

  interface Replay {
    /** The bot arm and seed this pool came off, for anyone re-deriving it. */
    label: string;
    /** Distinct team-seasons the reel landed on, in landing order. */
    seen: string[];
    /** The ⭐ Prime Time season, as [card key, player id]. */
    prime: [string, string];
  }

  const REPLAYS: Replay[] = [
    {
      label: "seed 898010623 (all powerups)",
      seen: ["COL_2018", "KCR_2002", "TEX_2002", "NYY_2007", "DET_2014", "ARI_2000", "ARI_2006",
        "PIT_1986", "CHC_1991", "MON_1989", "PIT_2018", "CIN_1989", "KCR_1989"],
      prime: ["STL_2022", "arenano01"],
    },
    {
      label: "seed 2595044816 (all powerups)",
      seen: ["HOU_2007", "NYM_1994", "CHC_2001", "CHC_2018", "LAA_2017", "CHW_1993", "NYM_1986",
        "SDP_2017", "LAD_2010", "TOR_1990", "TBR_2008"],
      prime: ["KCR_1989", "saberbr01"],
    },
    {
      label: "seed 3517525175 (all powerups)",
      seen: ["LAD_1996", "MON_1990", "TOR_2011", "TBR_2024", "TEX_2024", "DET_2025", "CHC_1993",
        "TOR_1995", "PHI_2003", "OAK_1989", "TBD_1999", "TBR_2021", "CLE_2024"],
      prime: ["LAD_1997", "piazzmi01"],
    },
    {
      label: "seed 2229349348 (all powerups)",
      seen: ["CIN_2015", "TEX_2021", "CLE_2016", "PIT_2021", "KCR_1992", "NYM_1992", "BAL_2000",
        "NYY_2013", "CIN_1993", "KCR_2004", "PHI_1995", "PHI_1987", "MIL_2014"],
      prime: ["CIN_2017", "vottojo01"],
    },
    {
      label: "seed 4257157800 (all powerups)",
      seen: ["BOS_1990", "CLE_2006", "DET_2008", "NYM_2013", "BOS_1987", "BOS_2016", "TOR_1993",
        "CAL_1989", "CHW_2023", "TEX_2023", "CHC_2009", "CHW_1997", "STL_1997"],
      prime: ["TOR_1997", "clemero02"],
    },
    {
      label: "seed 3391180099 (all powerups)",
      seen: ["PHI_2002", "COL_2006", "LAD_1990", "FLA_2004", "OAK_1992", "BOS_2009", "BOS_1986",
        "KCR_2012", "LAA_2012", "PIT_2018", "MON_1996", "SEA_1988", "ARI_1998"],
      prime: ["STL_2004", "rolensc01"],
    },
    {
      label: "seed 1524637932 (all powerups, overspending)",
      seen: ["COL_2016", "PHI_1999", "MIA_2012", "STL_2020", "STL_1985", "LAD_1990", "HOU_2021",
        "SEA_1985", "CHW_2015", "WSN_2015", "SFG_2001", "MIN_2017", "KCR_2014"],
      prime: ["STL_2022", "arenano01"],
    },
    {
      label: "seed 3334677441 (all powerups, overspending)",
      seen: ["PIT_1990", "PHI_2022", "KCR_1985", "STL_2003", "CHC_1987", "CHC_2001", "SEA_2001",
        "BAL_2025", "BAL_1992", "NYY_1995", "KCR_1992", "ARI_2022"],
      prime: ["SFG_2002", "bondsba01"],
    },
  ];

  for (const replay of REPLAYS) {
    it(`fills all nine seats from ${replay.label}`, () => {
      const best = bestRoster(
        replay.seen.map(readCard),
        { offReel: [primeCard(replay.prime[0], replay.prime[1])] },
      );
      expect(best.picks.filter((p) => p === null)).toHaveLength(0);
      expect(best.manager).not.toBeNull();
      expect(best.dreamSeats).toBe(9);
    });
  }

  /* The same question with no live pool behind it: a pool where the ONLY
   * complete club is over the cap, and the club that skips a seat is the one
   * that scores highest. Four cards, one bank, no ambiguity — the two starters
   * cost $70M between them against a $60M cap, so the ninth seat costs its own
   * salary in luxury tax and buys back barely a win.
   *
   * The right answer is the complete club anyway, and this test says so in the
   * one shape where "the search just found a better club" cannot be the
   * explanation: here the incomplete club really is worth more points, and it
   * is still not a club anybody was allowed to build. */
  it("takes the complete club even when skipping a seat would score higher", () => {
    const priced = (over: Partial<CardPlayer>): CardPlayer =>
      player({ war: 1, cost: 35, ...over });
    const own = (i: number): Partial<Card> => ({
      team: `T${i}`,
      franchise: `T${i}`,
      year: 1980 + i,
      manager: null,
      budget: 60,
      stadiumMult: 1,
    });
    const cards: Card[] = [
      card([priced({ pos: "C", posG: C })], own(0)),
      card([priced({ pos: "SS", posG: IF })], own(1)),
      card([priced({ pos: "SP", posG: NONE, gs: 30 })], own(2)),
      card([priced({ pos: "RP", posG: NONE, relIP: 60 })], own(3)),
    ];
    // A $60M bank against $35M seats: any two of these men bust the cap, so
    // every extra seat past the first is worth 1 win and −$35M of tax.
    const best = bestRoster(cards, { fixedBudgetM: 60 });
    const filled = best.picks.filter((p) => p !== null);
    expect(filled).toHaveLength(4);
    expect(best.dreamSeats).toBe(4);
    // And the club it printed genuinely scores less than the one-man club it
    // was allowed to prefer on points alone — which is the assertion that
    // makes this a rule test rather than a search test.
    const oneMan = bestRoster([cards[0]], { fixedBudgetM: 60 });
    expect(best.total!).toBeLessThan(oneMan.total!);
  });
});

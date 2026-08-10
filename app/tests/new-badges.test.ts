/** First-time badges: the history reader that answers "have I earned this
 * before", and the finale flag it drives.
 *
 * The question is a sequencing one, which is why it is worth its own file.
 * `recordHistory()` appends the finished game to the same log the answer is
 * read from, so a diff taken one line too late reports nothing new, forever —
 * and would still pass any test that only checked "a new badge renders NEW"
 * against a hand-built finale. The engine-order test below is the one that can
 * actually fail on that mistake.
 *
 * The row's ORDER is asserted against `bragRow` rather than against rendered
 * Finale markup, because the pill row lives behind the finale's reveal
 * animation: `bragsShown` flips inside an $effect, which SSR never runs, so a
 * rendered assertion would find no pills at all and pass vacuously on the
 * branch that matters most. The pill's own markup is asserted against
 * BadgePill directly.
 *
 * The file also holds the trigger pins for the badges added after the round-19
 * table settled — 2️⃣ 🎆 🌠 📝 🎮 🪑 🙈. Those forge facts the way
 * badges.test.ts does rather than seeding history, because a trigger is a pure
 * function of the fact set; the two helpers below are that file's, imported in
 * spirit and kept side by side here so the whole of a new badge (definition,
 * trigger, supply) reads in one place while it is still new.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "svelte/server";
import BadgePill from "../src/components/BadgePill.svelte";
import TrophyModal from "../src/components/TrophyModal.svelte";
import {
  BADGES,
  BADGE_BY_KEY,
  bragRow,
  earnedBadges,
  type BadgeFacts,
  type BadgeRosterEntry,
} from "../src/lib/badges";
import {
  appendHistory,
  earnedBadgeKeys,
  loadHistory,
} from "../src/lib/history";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

/** Seed the log with raw rows — untyped on purpose, since the malformed shapes
 * under test are exactly what HistoryEntry forbids. */
function seed(...entries: unknown[]): void {
  store.set("hotstove.history", JSON.stringify(entries));
}

function row(badges: unknown): unknown {
  return {
    v: 2,
    date: "2026-08-01",
    total: 120,
    record: "95-67",
    spins: 3,
    badges,
  };
}

beforeEach(() => store.clear());

describe("earnedBadgeKeys", () => {
  it("is empty before anything has ever been played", () => {
    expect(earnedBadgeKeys().size).toBe(0);
  });

  it("unions keys across every game in the log", () => {
    seed(row(["mariners", "dime"]), row(["dime", "crystal"]));
    expect([...earnedBadgeKeys()].sort()).toEqual([
      "crystal",
      "dime",
      "mariners",
    ]);
  });

  it("tolerates every shape the oldest store in the app can hold", () => {
    // A pre-badge row, a corrupt badges value, a non-string key, and a row
    // that is not an object at all. None may throw; none may contribute.
    seed(
      { date: "2020-01-01", total: 90 },
      row("nope"),
      row([42, null]),
      null,
      row(["dime"]),
    );
    expect([...earnedBadgeKeys()]).toEqual(["dime"]);
  });

  it("reads a corrupt store as no history rather than throwing", () => {
    store.set("hotstove.history", "{not json");
    expect(earnedBadgeKeys().size).toBe(0);
    expect(loadHistory()).toEqual([]);
  });

  it("keeps a key the badge table no longer defines", () => {
    // Deliberate: this answers "has the player seen this key", and a retired
    // badge is still one they saw. Rendering surfaces drop what they cannot
    // resolve; this reader must not, or a retired-then-restored badge would
    // wrongly flag as new.
    seed(row(["retiredbadge"]));
    expect(earnedBadgeKeys().has("retiredbadge")).toBe(true);
    expect(BADGE_BY_KEY["retiredbadge"]).toBeUndefined();
  });
});

describe("appendHistory", () => {
  it("adds one row without disturbing the rows already there", () => {
    seed(row(["dime"]));
    appendHistory({
      date: "2026-08-02",
      total: 130,
      record: "99-63",
      spins: 4,
      badges: ["crystal"],
    });
    expect(loadHistory()).toHaveLength(2);
    expect([...earnedBadgeKeys()].sort()).toEqual(["crystal", "dime"]);
  });
});

/** The brag row's shape as keys, for readable assertions. */
const keysOf = (row: ReturnType<typeof bragRow>) => row.map((b) => b.def.key);
const freshOf = (row: ReturnType<typeof bragRow>) =>
  row.filter((b) => b.fresh).map((b) => b.def.key);

describe("bragRow", () => {
  it("leads with the rarest when nothing is new", () => {
    // allstars is uncommon; noweak and cooperstown are rare and tie, so the
    // engine's order breaks that tie.
    const row = bragRow(["allstars", "noweak", "cooperstown"], [], 4);
    expect(keysOf(row)).toEqual(["noweak", "cooperstown", "allstars"]);
    expect(freshOf(row)).toEqual([]);
  });

  it("flags exactly the first-time badges", () => {
    const row = bragRow(["mariners", "dime"], ["dime"], 4);
    expect(freshOf(row)).toEqual(["dime"]);
  });

  it("sorts a first-time badge ahead of the cap that would have cut it", () => {
    // 🗓️ decade sits fifth in the engine's order, past a four-pill cap — the
    // exact case the sort exists for. Without it the player never sees the one
    // badge they have never earned.
    const earned = ["allstars", "noweak", "cooperstown", "rings", "decade"];
    const row = bragRow(earned, ["decade"], 4);
    // Behind the fresh pill the rest stack rarest first: rings is ultra,
    // noweak and cooperstown rare, and allstars (uncommon) is what gets cut.
    expect(keysOf(row)).toEqual(["decade", "rings", "noweak", "cooperstown"]);
    // The row does not widen to fit it: the tail is still what gets cut.
    expect(row).toHaveLength(4);
  });

  it("sorts rarest first inside both groups", () => {
    const earned = ["allstars", "noweak", "cooperstown", "rings", "decade"];
    const row = bragRow(earned, ["cooperstown", "decade"], 5);
    // Fresh pills lead and stack rarest first (cooperstown rare over decade
    // uncommon); the rest do the same (rings ultra, noweak rare, allstars
    // uncommon).
    expect(keysOf(row)).toEqual([
      "cooperstown",
      "decade",
      "rings",
      "noweak",
      "allstars",
    ]);
  });

  it("flags nothing when the first-time list is empty", () => {
    expect(freshOf(bragRow(["mariners", "dime"], [], 4))).toEqual([]);
  });

  it("drops a key the badge table no longer defines", () => {
    const row = bragRow(["retiredbadge", "dime"], ["retiredbadge"], 4);
    expect(keysOf(row)).toEqual(["dime"]);
  });

  it("holds the cap", () => {
    const many = [
      "allstars",
      "noweak",
      "cooperstown",
      "rings",
      "decade",
      "crystal",
    ];
    expect(bragRow(many, [], 4)).toHaveLength(4);
    expect(bragRow(many, many, 4)).toHaveLength(4);
  });
});

describe("the NEW flag on the pill", () => {
  const pill = (key: string, fresh: boolean) =>
    render(BadgePill, { props: { badge: BADGE_BY_KEY[key], fresh } }).body;

  it("prints NEW on a first-time badge", () => {
    const body = pill("mariners", true);
    expect(body).toContain("NEW");
    expect(body).toContain("MATCHED THE 2001 MARINERS");
  });

  it("prints no flag on a badge the player already owns", () => {
    expect(pill("mariners", false)).not.toContain("NEW");
  });

  it("defaults off, so no surface flags a badge by accident", () => {
    expect(
      render(BadgePill, { props: { badge: BADGE_BY_KEY["mariners"] } }).body,
    ).not.toContain("NEW");
  });

  it("never flags a badge in the trophy case", () => {
    // The case holds only earned badges, so a flag there would mark every one.
    seed(row(["mariners", "dime"]));
    expect(
      render(TrophyModal, { props: { onclose: () => {} } }).body,
    ).not.toContain("NEW");
  });
});

/* ================= the triggers of the newest badges ================= */

/** A season that earns nothing, so a badge that appears is a badge that fired.
 * Same shape and same purpose as badges.test.ts's BASE. */
const BASE: BadgeFacts = {
  baselineWins: 81,
  baselineLosses: 81,
  total: 100,
  spendM: 100,
  budgetM: 140,
  scoutHits: 2,
  roster: [],
  managerTeam: null,
  managerYear: null,
  managerName: null,
  rings: 0,
  awardPoints: 10,
  managerMoty: false,
  owner: null,
  stadium: null,
  divisions: [],
  powerups: { spent: 0, total: 6 },
};
const f = (over: Partial<BadgeFacts> = {}): BadgeFacts => ({ ...BASE, ...over });

const guy = (over: Partial<BadgeRosterEntry> = {}): BadgeRosterEntry => ({
  id: "someguy01",
  name: "Some Guy",
  war: 3.0,
  awards: [],
  year: 2004,
  team: "BOS",
  pos: "SS",
  franchise: "BOS",
  costPaid: 8,
  hero: false,
  age: 28,
  ...over,
});
/** Eight filled seats — the gate 🕶️ and 🙈 both stand on. */
const fullClub = (over: Partial<BadgeRosterEntry> = {}) =>
  Array.from({ length: 8 }, () => guy(over));

/** The exclusive on-field axis, read off the table so a rung added to it is
 * covered here without being listed twice. */
const ONFIELD = BADGES.filter((b) => b.axis === "onfield").map((b) => b.key);

describe("🌠 THE DREAM TEAM", () => {
  it("fires on nine of nine, and takes 🔮's slot", () => {
    const got = earnedBadges(f({ dreamSeats: 9, scoutHits: 9 }));
    expect(got).toContain("dreamteam");
    expect(got).not.toContain("crystal");
  });

  it("refuses a five-seat dream club matched five ways", () => {
    // The degenerate case the denominator exists for: a thin reel cannot
    // produce a nine-seat club, so matching all of a five-seat one is not the
    // legendary. 🔮 does not fire either — five is under its seven.
    const got = earnedBadges(f({ dreamSeats: 5, scoutHits: 5 }));
    expect(got).not.toContain("dreamteam");
    expect(got).not.toContain("crystal");
  });

  it("refuses eight of nine, and 🔮 catches it", () => {
    const got = earnedBadges(f({ dreamSeats: 9, scoutHits: 8 }));
    expect(got).not.toContain("dreamteam");
    expect(got).toContain("crystal");
  });

  it("cannot fire without the denominator", () => {
    // The stampWins trap, avoided: an absent optional fact withholds the badge
    // rather than passing the gate. Nine hits alone is not nine of nine.
    const got = earnedBadges(f({ scoutHits: 9 }));
    expect(got).not.toContain("dreamteam");
    expect(got).toContain("crystal");
    expect(earnedBadges(f({ dreamSeats: 0, scoutHits: 9 }))).not.toContain(
      "dreamteam",
    );
  });
});

describe("📝 BETTER ON PAPER", () => {
  it("fires when the engine says the club outscored the solve", () => {
    expect(earnedBadges(f({ beatDream: true }))).toContain("beatdream");
  });

  it("withholds itself on an absent or false fact", () => {
    expect(earnedBadges(f())).not.toContain("beatdream");
    expect(earnedBadges(f({ beatDream: false }))).not.toContain("beatdream");
  });

  it("stacks with 🏆 rather than displacing it", () => {
    // Different claims: one is the game's stated goal, the other is the club
    // the same cards could have built.
    const got = earnedBadges(f({ beatDream: true, total: 162 }));
    expect(got).toContain("beatdream");
    expect(got).toContain("perfect");
  });
});

describe("🎮 CHEAT CODES", () => {
  it("fires on the recorded keystroke and nothing else", () => {
    expect(earnedBadges(f({ konami: true }))).toContain("cheatcodes");
    expect(earnedBadges(f())).not.toContain("cheatcodes");
    expect(earnedBadges(f({ konami: false }))).not.toContain("cheatcodes");
  });

  it("changes nothing else about the season", () => {
    // It is a badge and nothing else — no other trigger reads the flag, so
    // the earned list differs by exactly one key.
    const without = earnedBadges(f());
    const with_ = earnedBadges(f({ konami: true }));
    expect(with_.filter((k) => k !== "cheatcodes")).toEqual(without);
  });
});

describe("🪑 THE INTERIM", () => {
  it("fires on a last-spin hire with a losing record", () => {
    expect(
      earnedBadges(f({ managerLast: true, managerNetWins: -12 })),
    ).toContain("interim");
  });

  it("spares a last-spin hire who won", () => {
    expect(
      earnedBadges(f({ managerLast: true, managerNetWins: 20 })),
    ).not.toContain("interim");
  });

  it("spares an exactly .500 skipper — under, not at", () => {
    expect(
      earnedBadges(f({ managerLast: true, managerNetWins: 0 })),
    ).not.toContain("interim");
  });

  it("spares a losing skipper hired early", () => {
    // The badge is about leaving the dugout to the last spin, not about the
    // record: a bad manager taken on spin two is just a bad manager.
    expect(
      earnedBadges(f({ managerLast: false, managerNetWins: -30 })),
    ).not.toContain("interim");
  });

  it("cannot fire on facts assembled before either field existed", () => {
    expect(earnedBadges(f({ managerNetWins: -30 }))).not.toContain("interim");
    expect(earnedBadges(f({ managerLast: true }))).not.toContain("interim");
  });
});

describe("🙈 DIDN'T ASK THE PRICE", () => {
  const blind = (over: Partial<BadgeFacts> = {}) =>
    earnedBadges(f({ ownerLast: true, roster: fullClub(), ...over }));

  it("fires on a blind club that finished over the payroll", () => {
    expect(blind({ spendM: 150, budgetM: 140 })).toContain("blindbust");
  });

  it("is exclusive with 🕶️ by construction, at every spend", () => {
    // The pair splits on one comparison against one number, so no spend can
    // satisfy both. Sweep the whole range rather than assert the boundary.
    for (let spend = 0; spend <= 300; spend += 1) {
      const got = blind({ spendM: spend, budgetM: 140 });
      const both =
        got.includes("blindbust") && got.includes("flyingblind");
      expect(both, `spend ${spend}`).toBe(false);
    }
  });

  it("hands the boundary to 🕶️ — exactly at the payroll is not over it", () => {
    const at = blind({ spendM: 140, budgetM: 140 });
    expect(at).not.toContain("blindbust");
    expect(at).toContain("flyingblind");
    const over = blind({ spendM: 140.1, budgetM: 140 });
    expect(over).toContain("blindbust");
    expect(over).not.toContain("flyingblind");
  });

  it("needs the whole club drafted blind, like its twin", () => {
    expect(
      earnedBadges(
        f({ ownerLast: false, roster: fullClub(), spendM: 150, budgetM: 140 }),
      ),
    ).not.toContain("blindbust");
    expect(
      earnedBadges(
        f({
          ownerLast: true,
          roster: [guy(), guy(), guy()],
          spendM: 150,
          budgetM: 140,
        }),
      ),
    ).not.toContain("blindbust");
  });

  it("cannot fire on facts assembled before ownerLast existed", () => {
    expect(
      earnedBadges(f({ roster: fullClub(), spendM: 150, budgetM: 140 })),
    ).not.toContain("blindbust");
  });
});

describe("🫡 FEARLESS LEADER", () => {
  /** A full club whose best season is 5.0 WAR, so the skipper's line is the
   * only thing under test. */
  const club = (war = 5.0) => fullClub({ war });
  const led = (netWins: number, over: Partial<BadgeFacts> = {}) =>
    earnedBadges(f({ roster: club(), managerNetWins: netWins, ...over }));

  it("fires when the dugout out-earns every seat", () => {
    // 30 net wins × 0.2 = 6.0, against a best seat of 5.0.
    expect(led(30)).toContain("fearless");
  });

  it("measures in wins, not in net record", () => {
    // 20 net wins is 4.0 — a bigger number than any WAR on the club until the
    // exchange rate is applied, and the badge applies it.
    expect(led(20)).not.toContain("fearless");
  });

  it("wants strictly more, so a tie goes to the roster", () => {
    // 25 × 0.2 = 5.0 exactly, matching the best seat.
    expect(led(25)).not.toContain("fearless");
  });

  it("reads the club's best season, never its total", () => {
    // Eight 1.0-WAR men total 8.0, which no skipper in the set can beat; the
    // badge asks about the best one, so a 1.2-win skipper clears it.
    const seats = fullClub({ war: 1.0 });
    expect(
      earnedBadges(f({ roster: seats, managerNetWins: 6 })),
    ).toContain("fearless");
  });

  it("refuses a losing skipper, however bad the roster", () => {
    // −80 net is −16.0 wins, the worst card in the set, and it beats every
    // seat on a club of −20 WAR men. That club has earned an anti-trophy.
    const seats = fullClub({ war: -20 });
    expect(
      earnedBadges(f({ roster: seats, managerNetWins: -80 })),
    ).not.toContain("fearless");
  });

  it("needs the whole club, so two good seats are not a roster", () => {
    expect(
      earnedBadges(f({ roster: [guy({ war: 5.0 }), guy({ war: 5.0 })], managerNetWins: 30 })),
    ).not.toContain("fearless");
  });

  it("cannot fire on facts assembled before managerNetWins existed", () => {
    expect(earnedBadges(f({ roster: club() }))).not.toContain("fearless");
  });
});

describe("🎫 ALONG FOR THE RIDE", () => {
  /** A full club whose WORST season is 2.0 WAR, so the skipper's line is the
   * only thing under test (the badge reads the floor, not the star). */
  const club = (war = 2.0) => fullClub({ war });
  const rode = (netWins: number, over: Partial<BadgeFacts> = {}) =>
    earnedBadges(f({ roster: club(), managerNetWins: netWins, ...over }));

  it("fires when every seat out-earns the chair — no losing record required", () => {
    // 5 net wins is a WINNING skipper worth 1.0, under a floor of 2.0.
    expect(rode(5)).toContain("ride");
  });

  it("wants strictly more, so a tie goes to the chair", () => {
    // 10 × 0.2 = 2.0 exactly, matching the worst seat.
    expect(rode(10)).not.toContain("ride");
  });

  it("one seat below the chair breaks the claim", () => {
    const seats = [...fullClub({ war: 5.0 }).slice(0, 7), guy({ war: 0.5 })];
    expect(
      earnedBadges(f({ roster: seats, managerNetWins: 5 })),
    ).not.toContain("ride");
  });

  it("is 🫡's exact mirror — the two can never co-fire", () => {
    for (const net of [-40, -10, 0, 10, 25, 40]) {
      const got = rode(net);
      expect(
        got.includes("ride") && got.includes("fearless"),
        `both fired at net ${net}`,
      ).toBe(false);
    }
  });

  it("needs the whole club, and an unknown chair earns nothing", () => {
    expect(
      earnedBadges(f({ roster: [guy({ war: 5.0 })], managerNetWins: 0 })),
    ).not.toContain("ride");
    expect(earnedBadges(f({ roster: club() }))).not.toContain("ride");
  });
});

describe("🗿 THE FIGUREHEAD", () => {
  it("fires only on a dead-even chair", () => {
    expect(earnedBadges(f({ managerNetWins: 0 }))).toContain("figurehead");
    expect(earnedBadges(f({ managerNetWins: 2 }))).not.toContain("figurehead");
    expect(earnedBadges(f({ managerNetWins: -2 }))).not.toContain("figurehead");
  });

  it("an absent record is unknown, never .500", () => {
    expect(earnedBadges(f({}))).not.toContain("figurehead");
  });

  it("stacks with 🎫 when the even chair rides a positive club", () => {
    const got = earnedBadges(
      f({ roster: fullClub({ war: 2.0 }), managerNetWins: 0 }),
    );
    expect(got).toContain("figurehead");
    expect(got).toContain("ride");
  });
});

describe("🚒 THE FIREMAN and 🧤 THE FIELD GENERAL", () => {
  /** Seven $8M men plus one seat under test. */
  const clubWith = (seat: BadgeRosterEntry) => [
    ...Array.from({ length: 7 }, () => guy({ pos: "SS", costPaid: 8 })),
    seat,
  ];

  it("hands the reliever his badge when he outcosts the club", () => {
    const got = earnedBadges(f({ roster: clubWith(guy({ pos: "RP", costPaid: 20 })) }));
    expect(got).toContain("fireman");
    expect(got).not.toContain("fieldgeneral");
  });

  it("hands the catcher his", () => {
    const got = earnedBadges(f({ roster: clubWith(guy({ pos: "C", costPaid: 20 })) }));
    expect(got).toContain("fieldgeneral");
    expect(got).not.toContain("fireman");
  });

  it("wants a strict maximum, so a tie at the top counts for nobody", () => {
    // The shape a club of minimum-salary men lands on: everyone at one price.
    const flat = [
      ...Array.from({ length: 6 }, () => guy({ pos: "SS", costPaid: 1 })),
      guy({ pos: "RP", costPaid: 1 }),
      guy({ pos: "C", costPaid: 1 }),
    ];
    const got = earnedBadges(f({ roster: flat }));
    expect(got).not.toContain("fireman");
    expect(got).not.toContain("fieldgeneral");
  });

  it("counts seats rather than objects, so a reused entry still ties", () => {
    // A fact set that reuses one object across seats must answer the question
    // about seats: eight references to one $20M catcher is eight seats at $20M,
    // which is a tie, not a maximum.
    const one = guy({ pos: "C", costPaid: 20 });
    expect(
      earnedBadges(f({ roster: Array.from({ length: 8 }, () => one) })),
    ).not.toContain("fieldgeneral");
  });

  it("both need the whole club", () => {
    expect(
      earnedBadges(f({ roster: [guy({ pos: "C", costPaid: 20 }), guy({ costPaid: 1 })] })),
    ).not.toContain("fieldgeneral");
  });

  it("reads the position the card prints, not the seat he fills", () => {
    // Nothing here knows which slot a man sits in, and that is deliberate: the
    // C seat takes anyone with ten games behind the plate, so the badge would
    // otherwise mean something the player cannot see. A man listed at C who
    // played every game at first base is still the catcher this badge names.
    expect(
      earnedBadges(f({ roster: clubWith(guy({ pos: "C", costPaid: 20 })) })),
    ).toContain("fieldgeneral");
    expect(
      earnedBadges(f({ roster: clubWith(guy({ pos: "1B", costPaid: 20 })) })),
    ).not.toContain("fieldgeneral");
  });
});

describe("🪙 LEAGUE MINIMUM", () => {
  const at = (prices: number[]) =>
    earnedBadges(
      f({
        roster: prices.map((costPaid) => guy({ costPaid })),
      }),
    );

  it("fires on four seats at the minimum", () => {
    expect(at([1.0, 1.2, 1.6, 1.6, 20, 20, 20, 20])).toContain("minimum");
  });

  it("holds the line at three", () => {
    expect(at([1.0, 1.2, 1.6, 1.7, 20, 20, 20, 20])).not.toContain("minimum");
  });

  it("takes $1.6M as the minimum — the 1985 floor, not the modern one", () => {
    // The card set's cheapest season is $1.6M in 1985 and $1.0M from 1992 on,
    // so the price has to be the highest floor in the window or a mid-eighties
    // club at its own minimum could never earn it.
    expect(at([1.6, 1.6, 1.6, 1.6])).toContain("minimum");
    expect(at([1.7, 1.7, 1.7, 1.7])).not.toContain("minimum");
  });

  it("needs no full club — a count cannot be padded by vacancy", () => {
    expect(at([1.0, 1.0, 1.0, 1.0])).toContain("minimum");
    expect(at([])).not.toContain("minimum");
  });
});

describe("💳 THE BILL CAME DUE", () => {
  const busted = (baselineWins: number, stampWins: number) =>
    earnedBadges(
      f({
        baselineWins,
        baselineLosses: 162 - baselineWins,
        stamp: { wins: stampWins, losses: 162 - stampWins },
        spendM: 200,
        budgetM: 140,
      }),
    );

  it("fires where the on-field ladder awards nothing", () => {
    // A 106-win club taxed back to 94: 🚀 is vetoed, and before this rung the
    // season walked away from the axis with nothing.
    const got = busted(106, 94);
    expect(got).toContain("taxed");
    expect(got.filter((k) => ONFIELD.includes(k))).toEqual(["taxed"]);
  });

  it("catches the century as well as the named rungs", () => {
    expect(busted(101, 88)).toContain("taxed");
  });

  it("stays off a club whose stamp held its rung", () => {
    const got = busted(106, 130);
    expect(got).toContain("astros");
    expect(got).not.toContain("taxed");
  });

  it("stays off a club that never earned a rung to lose", () => {
    // 99 baseline wins is the most common unbadged total in the game; losing
    // nothing is not an anti-trophy.
    expect(busted(99, 60)).not.toContain("taxed");
  });

  it("yields to the floor rungs, which name a record the player can see", () => {
    // A 103 baseline taxed to a 30–132 stamp reads 📉: that is the record on
    // the screen, and the floor rungs are about what the screen says.
    const deep = busted(103, 30);
    expect(deep).toContain("worst");
    expect(deep).not.toContain("taxed");
    const hundredLosses = busted(103, 60);
    expect(hundredLosses).toContain("skull");
    expect(hundredLosses).not.toContain("taxed");
  });

  it("needs the payroll to have gone over", () => {
    // The stamp can fall below the baseline without a tax — the payroll bonus
    // bottoms out at −10 — and that club is not what this badge names.
    expect(
      earnedBadges(
        f({
          baselineWins: 106,
          baselineLosses: 56,
          stamp: { wins: 94, losses: 68 },
          spendM: 40,
          budgetM: 140,
        }),
      ),
    ).not.toContain("taxed");
  });

  it("cannot fire on facts assembled before the stamp existed", () => {
    // Absent, the stamp reads as the baseline, which always holds its own rung.
    expect(
      earnedBadges(
        f({ baselineWins: 106, baselineLosses: 56, spendM: 200, budgetM: 140 }),
      ),
    ).not.toContain("taxed");
  });

  it("names both records in its copy, the way the whole axis does", () => {
    // "final record" is the stamp under the ladder's own name — the term 👑
    // and the champion rungs use. The copy pass retired the longer "a record
    // the finale stamps" phrasing, which garden-pathed ("stamps too low").
    const how = BADGE_BY_KEY.taxed.how.toLowerCase();
    expect(how).toContain("baseline wins");
    expect(how).toContain("final record");
  });
});

describe("every new badge resolves to a definition", () => {
  it("has a table entry for each key the triggers above emit", () => {
    for (const key of [
      "dreamteam",
      "beatdream",
      "cheatcodes",
      "interim",
      "blindbust",
      "fearless",
      "fireman",
      "fieldgeneral",
      "minimum",
      "taxed",
      "outscouted",
    ]) {
      expect(BADGE_BY_KEY[key], `${key} is undefined`).toBeDefined();
    }
  });
});

describe("the outscouted badge", () => {
  it("earns outscouted when beatCeiling is true", () => {
    expect(earnedBadges(f({ beatCeiling: true }))).toContain("outscouted");
  });

  it("does not earn outscouted when beatCeiling is false", () => {
    expect(earnedBadges(f({ beatCeiling: false }))).not.toContain("outscouted");
  });

  it("does not earn outscouted when beatCeiling is absent", () => {
    // BASE has no beatCeiling; absent reads as "did not beat it" — the safe direction.
    expect(earnedBadges(f({}))).not.toContain("outscouted");
  });

  it("stacks with perfect and beatdream when all conditions are met", () => {
    const badges = earnedBadges(f({ total: 162, beatDream: true, beatCeiling: true }));
    expect(badges).toContain("perfect");
    expect(badges).toContain("beatdream");
    expect(badges).toContain("outscouted");
  });
});

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
 * table settled — 2️⃣ 🎆 🌠 🧠 🎮 🪑 🙈. Those forge facts the way
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
  it("keeps the engine's order when nothing is new", () => {
    const row = bragRow(["allstars", "noweak", "cooperstown"], [], 4);
    expect(keysOf(row)).toEqual(["allstars", "noweak", "cooperstown"]);
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
    expect(keysOf(row)).toEqual([
      "decade",
      "allstars",
      "noweak",
      "cooperstown",
    ]);
    // The row does not widen to fit it: the tail is still what gets cut.
    expect(row).toHaveLength(4);
  });

  it("is stable within each group", () => {
    const earned = ["allstars", "noweak", "cooperstown", "rings", "decade"];
    const row = bragRow(earned, ["cooperstown", "decade"], 5);
    // New ones first in their original relative order, then the rest in theirs.
    expect(keysOf(row)).toEqual([
      "cooperstown",
      "decade",
      "allstars",
      "noweak",
      "rings",
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
  budgetBonus: 4,
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

describe("🧠 BEAT THE DREAM TEAM", () => {
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

describe("every new badge resolves to a definition", () => {
  it("has a table entry for each key the triggers above emit", () => {
    for (const key of [
      "dreamteam",
      "beatdream",
      "cheatcodes",
      "interim",
      "blindbust",
    ]) {
      expect(BADGE_BY_KEY[key], `${key} is undefined`).toBeDefined();
    }
  });
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BLANK_CHECK_BUDGET_M,
  Game,
  MONEYBALL_BUDGET_M,
  SLOT_TYPES,
  type GameConfig,
} from "../src/lib/engine.svelte";
import { recordFromTotal, type WarTier } from "../src/lib/format";
import { bestFor, loadSettings, saveSettings } from "../src/lib/settings";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: SLOT_TYPES,
  minBudget: 18.2,
  avgSlot8: { "2016": 87497175 },
  salaryFloor: { "2016": 508500 },
  proration: {},
};

const index: GameIndex = {
  yearMin: 1985,
  yearMax: 2024,
  cards: [{ team: "CHC", year: 2016, franchise: "CHC", name: "Chicago Cubs" }],
};

const owners: Owners = {
  franchises: {
    CHC: { name: "Chicago Cubs", owners: [{ name: "Ricketts family", from: 2009, to: null }] } } };

let pid = 0;
function player(over: Partial<CardPlayer>): CardPlayer {
  return {
    id: `p${pid++}`,
    name: "Test Player",
    pos: "1B",
    war: 3,
    cost: 5,
    awards: [],
    ws: false,
    pen: false,
    posG: { c: 0, if: 100, of: 0},
    debut: "SEA",
    ...over,
  };
}

function card(players: CardPlayer[], over: Partial<Card> = {}): Card {
  return {
    year: 2016,
    team: "CHC",
    franchise: "CHC",
    name: "Chicago Cubs",
    park: "Wrigley Field",
    wins: 103,
    losses: 58,
    manager: "Joe Maddon",
    ws: true,
    pen: false,
    attendance: 3_232_420,
    attendancePct: 0.86,
    stadiumMult: 1.11,
    budget: 136.3,
    prorated: 1,
    players,
    ...over,
  };
}

function landedGame(c: Card, config?: GameConfig): Game {
  const g = new Game(meta, index, owners, 42, config);
  g.card = c;
  g.phase = "landed";
  g.choicesLeft = 1;
  g.choicesUsed = 0;
  return g;
}

beforeEach(() => {
  store.clear();
  pid = 0;
});

describe("difficulty visibility gating", () => {
  it("standard sees WAR, salary, and awards", () => {
    const g = landedGame(card([]), { difficulty: "standard", bank: "classic" });
    expect([g.showWar, g.showCost, g.showAwards]).toEqual([true, true, true]);
    expect(g.scout).toBe(false);
  });

  it("scout hides talent signals (WAR, awards) but still shows salary", () => {
    const g = landedGame(card([]), { difficulty: "scout", bank: "classic" });
    expect([g.showWar, g.showCost, g.showAwards]).toEqual([false, true, false]);
    expect(g.scout).toBe(true);
  });

  it("the spin banner's team pedigree rides the showAwards gate", () => {
    // Every hardware glyph in the game hides behind showAwards on Eye Test
    // (market badges, career sheet, both pickers). The banner's 💍/🚩 is the
    // one that historically didn't; this pin holds it on the same gate.
    const src = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components/SpinBanner.svelte"),
      "utf8",
    );
    expect(src).toContain('game.phase === "landed" && game.card && game.showAwards');
  });
});

describe("moneyball", () => {
  const MB: GameConfig = { difficulty: "standard", bank: "moneyball" };

  it("locks the cap to the 2002 A's bankroll regardless of specials", () => {
    const g = landedGame(card([]), MB);
    expect(g.effectiveBudget).toBe(MONEYBALL_BUDGET_M);
  });

  it("owner and stadium can never be hired", () => {
    const g = landedGame(card([player({})]), MB);
    g.hireOwner();
    g.buyStadium();
    expect(g.owner).toBeNull();
    expect(g.stadium).toBeNull();
    expect(g.choicesUsed).toBe(0);
    expect(g.effectiveBudget).toBe(MONEYBALL_BUDGET_M);
  });

  it("the manager still hires and consumes the choice", () => {
    const g = landedGame(card([player({})]), MB);
    g.hireManager();
    expect(g.manager?.name).toBe("Joe Maddon");
  });

  it("missing owner/stadium is not actionable — only players and the manager count", () => {
    // Roster one signable player, take him and the manager; card must go cold.
    const p = player({});
    const g = landedGame(card([p]), MB);
    g.choicesLeft = 3; // room to exhaust everything on one card
    g.powerups.tradeDeadline = "spent"; // else the taken manager stays swappable
    g.signPlayer(p);
    g.hireManager();
    expect(g.anyActionable()).toBe(false);
  });

  it("standard game with same card IS still actionable via owner/stadium", () => {
    const p = player({});
    const g = landedGame(card([p]));
    g.choicesLeft = 3;
    g.powerups.tradeDeadline = "spent";
    g.signPlayer(p);
    g.hireManager();
    expect(g.anyActionable()).toBe(true);
  });

  it("capKnown: fixed banks always, Owner's Box only once an owner is hired", () => {
    const mb = landedGame(card([]), MB);
    expect(mb.capKnown).toBe(true);
    const ob = landedGame(card([]), { difficulty: "standard", bank: "classic" });
    expect(ob.capKnown).toBe(false);
    ob.owner = { name: "x", budget: 100, franchise: "CHC", year: 2016, teamName: "Cubs" };
    expect(ob.capKnown).toBe(true);
  });

  it("config round-trips through save/restore", async () => {
    const g = landedGame(card([player({})]), { difficulty: "scout", bank: "moneyball" });
    g.save();
    // restore() re-fetches the card; strip the ref so it resumes preSpin w/o fetch.
    const saved = JSON.parse(store.get("hotstove.current")!);
    saved.cardRef = null;
    store.set("hotstove.current", JSON.stringify(saved));
    const back = await Game.restore(meta, index, owners);
    expect(back?.config).toEqual({ difficulty: "scout", bank: "moneyball" });
  });
});

describe("blank check", () => {
  const BC: GameConfig = { difficulty: "standard", bank: "blankcheck" };

  it("locks the cap to the 2005 Yankees bankroll and disables specials", () => {
    const g = landedGame(card([]), BC);
    expect(g.effectiveBudget).toBe(BLANK_CHECK_BUDGET_M);
    g.hireOwner();
    g.buyStadium();
    expect(g.owner).toBeNull();
    expect(g.stadium).toBeNull();
  });
});

describe("manager pedigree", () => {
  it("hiring a champ's manager records the ring and the team", () => {
    const g = landedGame(card([player({})]));
    g.hireManager();
    expect(g.manager?.ws).toBe(true);
    expect(g.manager?.pen).toBe(false);
    expect(g.manager?.team).toBe("CHC");
  });
});

describe("settings persistence", () => {
  it("round-trips and falls back to defaults on garbage", () => {
    saveSettings({ difficulty: "scout", bank: "moneyball" });
    expect(loadSettings()).toEqual({ difficulty: "scout", bank: "moneyball" });
    store.set("hotstove.settings", "{not json");
    expect(loadSettings()).toEqual({ difficulty: "standard", bank: "classic" });
    store.set("hotstove.settings", JSON.stringify({ v: 2, difficulty: "impossible", bank: 3 }));
    expect(loadSettings()).toEqual({ difficulty: "standard", bank: "classic" });
  });

  it("migrates legacy rungs: eyetest becomes scout; old scout/rookie fold into standard", () => {
    store.set("hotstove.settings", JSON.stringify({ difficulty: "eyetest", bank: "classic" }));
    expect(loadSettings().difficulty).toBe("scout");
    store.set("hotstove.settings", JSON.stringify({ difficulty: "scout", bank: "classic" }));
    expect(loadSettings().difficulty).toBe("standard"); // pre-v2 "scout" was the stats mode
    store.set("hotstove.settings", JSON.stringify({ difficulty: "rookie", moneyball: true }));
    expect(loadSettings()).toEqual({ difficulty: "standard", bank: "moneyball" });
  });

  it("a v2 'scout' selection sticks (no re-migration)", () => {
    saveSettings({ difficulty: "scout", bank: "classic" });
    expect(loadSettings().difficulty).toBe("scout");
  });
});

describe("bestFor leaderboard", () => {
  it("groups history by mode combo, normalizing legacy entries", () => {
    store.set(
      "hotstove.history",
      JSON.stringify([
        // legacy eyetest + moneyball flag → (scout, moneyball)
        { date: "2026-07-29", total: 90, record: "88-74", spins: 12, difficulty: "eyetest", moneyball: true },
        // legacy stats-scout → (standard, classic)
        { date: "2026-07-29", total: 120, record: "98-64", spins: 11, difficulty: "scout", bank: "classic" },
        // v2 scout stays scout
        { v: 2, date: "2026-07-30", total: 100, record: "91-71", spins: 13, difficulty: "scout", bank: "classic" },
        { v: 2, date: "2026-07-30", total: 131.5, record: "104-58", spins: 10, difficulty: "standard", bank: "classic" },
        { v: 2, date: "2026-07-30", total: 110, record: "95-67", spins: 10, difficulty: "standard", bank: "classic" },
      ]),
    );
    // `tiers` is asserted alongside `games` on purpose: the distribution the
    // home band draws is cut by THIS filter, so the rung counts have to sum
    // to the same number the record book's numeral shows, on the same legacy
    // spellings. Rungs come from recordFromTotal — 90 → 90 wins (over .500),
    // 100 → the century mark, 120 and 131.5 → past the Mariners' 116.
    const rungs = (t: Partial<Record<WarTier, number>>): Record<WarTier, number> => ({
      neg: 0, low: 0, mid: 0, high: 0, star: 0, elite: 0, ...t,
    });
    expect(bestFor("scout", "moneyball")).toEqual({
      best: 90, bestRecord: "88–74", games: 1, tiers: rungs({ low: 1 }),
    });
    expect(bestFor("standard", "classic")).toEqual({
      best: 131.5, bestRecord: "104–58", games: 3, tiers: rungs({ mid: 1, high: 2 }),
    });
    expect(bestFor("scout", "classic")).toEqual({
      best: 100, bestRecord: "91–71", games: 1, tiers: rungs({ mid: 1 }),
    });
    expect(bestFor("standard", "blankcheck")).toEqual({
      best: null, bestRecord: null, games: 0, tiers: rungs({}),
    });
  });

  it("the home BEST SEASON derives from the best TOTAL, not the stored record", () => {
    store.set(
      "hotstove.history",
      JSON.stringify([
        // The stored record is the OLD expected-wins record and must be ignored:
        // 131.5 points resolve to 132–30 (high tier), not the stored "104-58".
        { v: 2, date: "2026-07-30", total: 131.5, record: "104-58", spins: 10, difficulty: "standard", bank: "classic" },
        { v: 2, date: "2026-07-30", total: 110, record: "95-67", spins: 10, difficulty: "standard", bank: "classic" },
      ]),
    );
    const best = bestFor("standard", "classic");
    expect(best.best).toBe(131.5);
    expect(recordFromTotal(best.best!)).toEqual({ wins: 132, losses: 30, tier: "high" });
  });
});

describe("recordFromTotal ladder (home record book + finale stamp)", () => {
  it("rounds points to wins, clamps to the 162-game season", () => {
    expect(recordFromTotal(90.4)).toEqual({ wins: 90, losses: 72, tier: "low" });
    expect(recordFromTotal(-12)).toEqual({ wins: 0, losses: 162, tier: "neg" });
    expect(recordFromTotal(185)).toEqual({ wins: 162, losses: 0, tier: "elite" });
  });

  it("tier thresholds sit on the game's landmarks", () => {
    expect(recordFromTotal(80).tier).toBe("neg"); // a losing season goes brick
    expect(recordFromTotal(81).tier).toBe("low"); // .500
    expect(recordFromTotal(100).tier).toBe("mid"); // the 100-win club
    expect(recordFromTotal(116).tier).toBe("high"); // the Mariners line
    expect(recordFromTotal(135).tier).toBe("star"); // violet
    expect(recordFromTotal(155).tier).toBe("elite"); // gold
  });

  /* Each rung is pinned one win below its threshold too, so a boundary that
   * drifts by a single win can't slip through. */
  it("holds the rung immediately below each landmark", () => {
    expect(recordFromTotal(154).tier).toBe("star");
    expect(recordFromTotal(134).tier).toBe("high");
    expect(recordFromTotal(115).tier).toBe("mid");
    expect(recordFromTotal(99).tier).toBe("low");
  });
});

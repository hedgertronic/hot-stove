import { beforeEach, describe, expect, it } from "vitest";
import {
  BLANK_CHECK_BUDGET_M,
  Game,
  MONEYBALL_BUDGET_M,
  SLOT_TYPES,
  type GameConfig,
} from "../src/lib/engine.svelte";
import { statLine } from "../src/lib/format";
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
    CHC: { name: "Chicago Cubs", owners: [{ name: "Ricketts family", from: 2009, to: null }] },
  },
};

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
    teams: ["CHC"],
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
    budgetRaw: 74_555_288,
    contracts: [],
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
    expect(bestFor("scout", "moneyball")).toEqual({ best: 90, bestRecord: "88–74", games: 1 });
    expect(bestFor("standard", "classic")).toEqual({ best: 131.5, bestRecord: "104–58", games: 3 });
    expect(bestFor("scout", "classic")).toEqual({ best: 100, bestRecord: "91–71", games: 1 });
    expect(bestFor("standard", "blankcheck")).toEqual({ best: null, bestRecord: null, games: 0 });
  });
});

describe("stat lines", () => {
  it("hitters read slash/HR/RBI/SB", () => {
    expect(
      statLine({ pos: "3B", bat: { avg: 0.292, obp: 0.385, slg: 0.544, hr: 39, rbi: 102, sb: 8 } }),
    ).toBe(".292/.385/.544 · 39 HR · 102 RBI · 8 SB");
  });
  it("pitchers read W–L/ERA/K", () => {
    expect(statLine({ pos: "SP", pit: { w: 19, l: 5, sv: 0, era: 2.44, so: 284 } })).toBe(
      "19–5 · 2.44 ERA · 284 K",
    );
  });
});

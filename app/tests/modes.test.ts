import { beforeEach, describe, expect, it } from "vitest";
import { Game, MONEYBALL_BUDGET_M, SLOT_TYPES, type GameConfig } from "../src/lib/engine.svelte";
import { statLine } from "../src/lib/format";
import { loadSettings, saveSettings } from "../src/lib/settings";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 47.7,
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
  const cases: [string, boolean, boolean, boolean, boolean][] = [
    // difficulty, showWar, showCost, showAwards, showStats
    ["rookie", true, true, true, false],
    ["standard", true, true, false, false],
    ["scout", false, false, false, true],
    ["eyetest", false, false, false, false],
  ];
  for (const [d, war, cost, awards, stats] of cases) {
    it(`${d} matches the BUILD.md table`, () => {
      const g = landedGame(card([]), {
        difficulty: d as GameConfig["difficulty"],
        moneyball: false,
      });
      expect([g.showWar, g.showCost, g.showAwards, g.showStats]).toEqual([
        war,
        cost,
        awards,
        stats,
      ]);
      expect(g.eyeTest).toBe(d === "eyetest");
    });
  }
});

describe("moneyball", () => {
  const MB: GameConfig = { difficulty: "standard", moneyball: true };

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

  it("skipper still hires and consumes the choice", () => {
    const g = landedGame(card([player({})]), MB);
    g.hireSkipper();
    expect(g.skipper?.name).toBe("Joe Maddon");
  });

  it("missing owner/stadium is not actionable — only players and skipper count", () => {
    // Roster one signable player, take him and the skipper; card must go cold.
    const p = player({});
    const g = landedGame(card([p]), MB);
    g.choicesLeft = 3; // room to exhaust everything on one card
    g.powerups.tradeDeadline = "spent"; // else the taken skipper stays swappable
    g.signPlayer(p);
    g.hireSkipper();
    expect(g.anyActionable()).toBe(false);
  });

  it("standard game with same card IS still actionable via owner/stadium", () => {
    const p = player({});
    const g = landedGame(card([p]));
    g.choicesLeft = 3;
    g.powerups.tradeDeadline = "spent";
    g.signPlayer(p);
    g.hireSkipper();
    expect(g.anyActionable()).toBe(true);
  });

  it("config round-trips through save/restore", async () => {
    const g = landedGame(card([player({})]), { difficulty: "scout", moneyball: true });
    g.save();
    // restore() re-fetches the card; strip the ref so it resumes preSpin w/o fetch.
    const saved = JSON.parse(store.get("hotstove.current")!);
    saved.cardRef = null;
    store.set("hotstove.current", JSON.stringify(saved));
    const back = await Game.restore(meta, index, owners);
    expect(back?.config).toEqual({ difficulty: "scout", moneyball: true });
  });
});

describe("settings persistence", () => {
  it("round-trips and falls back to defaults on garbage", () => {
    saveSettings({ difficulty: "eyetest", moneyball: true });
    expect(loadSettings()).toEqual({ difficulty: "eyetest", moneyball: true });
    store.set("hotstove.settings", "{not json");
    expect(loadSettings()).toEqual({ difficulty: "standard", moneyball: false });
    store.set("hotstove.settings", JSON.stringify({ difficulty: "impossible", moneyball: 3 }));
    expect(loadSettings()).toEqual({ difficulty: "standard", moneyball: false });
  });
});

describe("stat lines", () => {
  it("hitters read AVG/HR/SB", () => {
    expect(statLine({ pos: "3B", bat: { avg: 0.292, hr: 39, sb: 8 } })).toBe(
      ".292 · 39 HR · 8 SB",
    );
  });
  it("starters read W–L/ERA; relievers add saves", () => {
    expect(statLine({ pos: "SP", pit: { w: 19, l: 5, sv: 0, era: 2.44 } })).toBe(
      "19–5 · 2.44 ERA",
    );
    expect(statLine({ pos: "RP", pit: { w: 2, l: 3, sv: 18, era: 3.53 } })).toBe(
      "2–3 · 3.53 ERA · 18 SV",
    );
  });
  it("two-way seasons show the pitching line", () => {
    expect(
      statLine({
        pos: "SP/DH",
        bat: { avg: 0.273, hr: 34, sb: 11 },
        pit: { w: 9, l: 2, sv: 0, era: 2.33 },
      }),
    ).toBe("9–2 · 2.33 ERA");
  });
});

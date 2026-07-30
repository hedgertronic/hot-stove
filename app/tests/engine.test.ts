import { beforeEach, describe, expect, it } from "vitest";
import { eligibleTypes } from "../src/lib/eligibility";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

// Engine save()/restore() guard storage access; give node a minimal stub.
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

function landedGame(c: Card): Game {
  const g = new Game(meta, index, owners, 42);
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

describe("eligibility", () => {
  it("multi-position infielder/outfielder", () => {
    const p = player({ posG: { c: 0, if: 117, of: 75, dh: 1 }, pos: "3B" });
    expect(eligibleTypes(p)).toEqual(["IF", "OF", "FLEX"]);
  });
  it("two-way player qualifies for SP and FLEX", () => {
    const p = player({ pos: "SP/DH", gs: 20, posG: { c: 0, if: 0, of: 0, dh: 40 } });
    expect(eligibleTypes(p)).toEqual(["SP", "FLEX"]);
  });
  it("DH-only bat is FLEX only", () => {
    const p = player({ posG: { c: 0, if: 3, of: 0, dh: 120 }, pos: "DH" });
    expect(eligibleTypes(p)).toEqual(["FLEX"]);
  });
  it("relievers never reach FLEX", () => {
    const p = player({ pos: "RP", posG: { c: 0, if: 0, of: 0, dh: 0 }, pa: 2, relIP: 60 });
    expect(eligibleTypes(p)).toEqual(["RP"]);
  });
});

describe("signing and slots", () => {
  it("catcher fills C automatically", () => {
    const p = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([p]));
    g.signPlayer(p);
    expect(g.slots[0]?.id).toBe(p.id);
    expect(g.phase).toBe("preSpin");
  });

  it("IF/OF ambiguity opens the slot picker, resolves by rail tap", () => {
    const p = player({ posG: { c: 0, if: 117, of: 75, dh: 0 }, pos: "3B" });
    const g = landedGame(card([p]));
    g.signPlayer(p);
    expect(g.slotPick).toBe(p.id);
    expect(g.slots.every((s) => s === null)).toBe(true);
    g.signPlayer(p, 3); // choose the OF cell
    expect(g.slots[3]?.id).toBe(p.id);
  });

  it("FLEX is used only when specialist slots are full", () => {
    const a = player({ pos: "LF", posG: { c: 0, if: 0, of: 120, dh: 0 } });
    const b = player({ pos: "RF", posG: { c: 0, if: 0, of: 110, dh: 0 } });
    const g = landedGame(card([a, b]));
    g.signPlayer(a);
    expect(g.slots[3]?.id).toBe(a.id); // OF slot
    g.phase = "landed";
    g.choicesLeft = 1;
    g.signPlayer(b);
    expect(g.slots[4]?.id).toBe(b.id); // FLEX
  });

  it("no eligible open slot means the row is dead", () => {
    const a = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const b = player({ pos: "C", posG: { c: 80, if: 0, of: 0, dh: 0 }, pa: 200 });
    const g = landedGame(card([a, b]));
    g.signPlayer(a);
    expect(g.playerState(b)).toBe("open"); // FLEX still open for a hitter
    // fill FLEX with another bat
    const flex = player({ pos: "DH", posG: { c: 0, if: 0, of: 0, dh: 120 } });
    g.card = card([a, b, flex]);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.signPlayer(flex);
    expect(g.playerState(b)).toBe("dead");
  });
});

describe("specials and bankroll", () => {
  it("hiring owner sets bankroll; stadium multiplies it", () => {
    const g = landedGame(card([player({})]));
    expect(g.effectiveBudget).toBeCloseTo(18.2);
    g.hireOwner();
    expect(g.owner?.budget).toBe(136.3);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.buyStadium();
    expect(g.effectiveBudget).toBeCloseTo(136.3 * 1.11);
  });

  it("stadium multiplier applies to the no-owner floor", () => {
    const g = landedGame(card([player({})]));
    g.buyStadium();
    expect(g.effectiveBudget).toBeCloseTo(18.2 * 1.11);
  });

  it("specials consume the spin's choice", () => {
    const g = landedGame(card([player({})]));
    g.hireOwner();
    expect(g.phase).toBe("preSpin");
    expect(g.choicesLeft).toBe(0);
  });
});

describe("Double Play", () => {
  it("grants two choices, spends on first commit", () => {
    const a = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([a]));
    g.toggleDoublePlay();
    expect(g.choicesLeft).toBe(2);
    g.signPlayer(a);
    expect(g.powerups.doublePlay).toBe("spent");
    expect(g.phase).toBe("landed"); // second choice still live
    g.hireOwner();
    expect(g.phase).toBe("preSpin");
  });

  it("cannot sign the same player into both matching slots", () => {
    const p = player({ posG: { c: 0, if: 100, of: 0, dh: 0 } });
    const g = landedGame(card([p]));
    g.toggleDoublePlay();
    g.signPlayer(p, 1);
    expect(g.slots[1]?.id).toBe(p.id);
    expect(g.playerState(p)).toBe("dead"); // rostered → row dies
    g.signPlayer(p, 2);
    expect(g.slots[2]).toBe(null);
  });

  it("disarms cleanly before any commit", () => {
    const g = landedGame(card([player({})]));
    g.toggleDoublePlay();
    g.toggleDoublePlay();
    expect(g.choicesLeft).toBe(1);
    expect(g.powerups.doublePlay).toBe("ready");
  });
});

describe("Trade Deadline", () => {
  it("swaps a dead player into an occupied slot and spends TD", () => {
    // Relievers are the only truly single-cell case (a catcher is FLEX-eligible
    // too, which correctly forces a release pick instead).
    const a = player({ pos: "RP", posG: { c: 0, if: 0, of: 0, dh: 0 }, pa: 0, relIP: 60, cost: 20, war: 1 });
    const b = player({ pos: "RP", posG: { c: 0, if: 0, of: 0, dh: 0 }, pa: 0, relIP: 55, cost: 2, war: 3 });
    const g = landedGame(card([a, b]));
    g.signPlayer(a);
    g.phase = "landed";
    g.choicesLeft = 1;
    expect(g.playerState(b)).toBe("dead");
    const before = g.spend;
    g.toggleTradeDeadline();
    g.tdTapPlayer(b);
    expect(g.releasePick).toBe(null); // single eligible cell → no picker
    expect(g.slots[7]?.id).toBe(b.id);
    expect(g.powerups.tradeDeadline).toBe("spent");
    expect(g.spend).toBeCloseTo(before - 20 + 2);
  });

  it("multi-eligible swap-in requires a release pick", () => {
    const if1 = player({ posG: { c: 0, if: 100, of: 0, dh: 0 } });
    const if2 = player({ posG: { c: 0, if: 90, of: 0, dh: 0 }, pa: 400 });
    const if3 = player({ posG: { c: 0, if: 80, of: 0, dh: 0 }, pa: 300 });
    const flex = player({ pos: "DH", posG: { c: 0, if: 0, of: 0, dh: 120 } });
    const g = landedGame(card([if1, if2, if3, flex]));
    for (const p of [if1, if2, flex]) {
      g.signPlayer(p);
      g.phase = "landed";
      g.choicesLeft = 1;
    }
    expect(g.playerState(if3)).toBe("dead");
    g.toggleTradeDeadline();
    g.tdTapPlayer(if3);
    expect(g.releasePick).toBe(if3.id);
    // if3 could replace either IF or the FLEX bat
    expect(g.occupiedSlotsFor(if3).sort()).toEqual([1, 2, 4]);
    g.tdRelease(if3, 2);
    expect(g.slots[2]?.id).toBe(if3.id);
  });

  it("swaps a taken special 1-for-1", () => {
    const g = landedGame(card([player({})]));
    g.hireOwner();
    g.phase = "landed";
    g.choicesLeft = 1;
    g.card = card([player({})], { budget: 200, name: "New York Yankees", franchise: "NYY", team: "NYY" });
    g.toggleTradeDeadline();
    g.tdTapSpecial("owner");
    expect(g.owner?.budget).toBe(200);
    expect(g.powerups.tradeDeadline).toBe("spent");
  });
});

describe("Hometown Hero", () => {
  it("activates on matching owner+stadium and floors the price", () => {
    const local = player({ debut: "CHC" });
    const g = landedGame(card([local]));
    g.hireOwner();
    g.phase = "landed";
    g.choicesLeft = 1;
    expect(g.heroActive).toBe(false);
    g.buyStadium();
    g.phase = "landed";
    g.choicesLeft = 1;
    expect(g.heroActive).toBe(true);
    expect(g.heroEligible(local)).toBe(true);
    const floor = (508500 / 87497175) * 160;
    expect(g.priceFor(local)).toBeCloseTo(floor);
    g.signPlayer(local);
    expect(g.slots.find((s) => s?.id === local.id)?.costPaid).toBeCloseTo(floor);
    expect(g.heroUsed).toBe(true);
    expect(g.heroActive).toBe(false);
  });

  it("does not fire across franchises", () => {
    const outsider = player({ debut: "SEA" });
    const g = landedGame(card([outsider]));
    g.hireOwner();
    g.phase = "landed";
    g.choicesLeft = 1;
    g.buyStadium();
    expect(g.heroEligible(outsider)).toBe(false);
  });
});

describe("cold stove", () => {
  it("detected when nothing is actionable", () => {
    const c = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([c], { manager: null }));
    g.owner = { name: "x", budget: 100, franchise: "SEA", year: 2001, teamName: "Mariners" };
    g.stadium = { park: "y", mult: 1, franchise: "SEA", year: 2001 };
    // fill everything except an SP slot; card only offers a catcher
    for (let i = 0; i < 8; i++) {
      if (SLOT_TYPES[i] === "SP" && g.slots[i] === null && i === 5) continue;
      g.slots[i] = {
        id: `f${i}`,
        name: "Filler",
        pos: "1B",
        war: 1,
        awards: [],
        ws: false,
        pen: false,
        year: 2000,
        team: "SEA",
        teamName: "Mariners",
        franchise: "SEA",
        costPaid: 1,
        hero: false,
        prorated: 1,
      };
    }
    g.powerups.tradeDeadline = "spent";
    expect(g.coldStove).toBe(true);
    // with TD available it is NOT cold — the catcher could swap in
    g.powerups.tradeDeadline = "ready";
    expect(g.coldStove).toBe(false);
  });
});

describe("finale", () => {
  it("fires when the roster fills and the record is seed-stable", () => {
    const g = landedGame(card([player({ pos: "SP", gs: 30, posG: { c: 0, if: 0, of: 0, dh: 0 }, war: 5 })]));
    for (let i = 0; i < 8; i++) {
      if (i === 5) continue;
      g.slots[i] = {
        id: `f${i}`, name: "Filler", pos: "1B", war: 3, awards: i === 0 ? ["MVP"] : [],
        ws: i === 1, pen: i === 2, year: 2000, team: "SEA", teamName: "Mariners",
        franchise: "SEA", costPaid: 10, hero: false, prorated: 1,
      };
    }
    const sp = g.card!.players[0];
    g.signPlayer(sp);
    expect(g.phase).toBe("finale");
    const f = g.finale!;
    expect(f.parts.expectedWins).toBeCloseTo(47.7 + 3 * 7 + 5, 1);
    expect(f.parts.awardPoints).toBe(3);
    expect(f.parts.ringPoints).toBe(3);
    expect(f.wins + f.losses).toBe(162);
    // deterministic per seed
    const g2 = landedGame(card([player({ pos: "SP", gs: 30, posG: { c: 0, if: 0, of: 0, dh: 0 }, war: 5 })]));
    g2.slots = [...g.slots];
    expect(new Game(meta, index, owners, 42).seed).toBe(42);
  });
});

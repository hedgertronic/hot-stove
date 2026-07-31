import { beforeEach, describe, expect, it, vi } from "vitest";
import { eligibleTypes } from "../src/lib/eligibility";
import { Game, SLOT_TYPES, type Signed } from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

// Engine save()/restore() guard storage access; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// loadCard goes through fetch; serve registered cards, 404 anything else
// (finale reloads of unregistered cards fail → best roster falls back to null).
const fetchCards: Record<string, Card> = {};
vi.stubGlobal("fetch", async (url: unknown) => {
  const m = String(url).match(/cards\/([A-Z0-9]+)_(\d{4})\.json$/);
  const c = m ? fetchCards[`${m[1]}_${m[2]}`] : undefined;
  return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
});

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
    ws: false,
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

function landedGame(c: Card): Game {
  const g = new Game(meta, index, owners, 42);
  g.card = c;
  g.phase = "landed";
  g.choicesLeft = 1;
  g.choicesUsed = 0;
  return g;
}

function filler(i: number, over: Partial<Signed> = {}): Signed {
  return {
    id: `f${i}`,
    name: "Filler",
    pos: "1B",
    war: 3,
    awards: [],
    ws: false,
    pen: false,
    year: 2000,
    team: "SEA",
    teamName: "Mariners",
    franchise: "SEA",
    costPaid: 10,
    hero: false,
    prorated: 1,
    ...over,
  };
}

function fillSlots(g: Game, except: number[] = []): void {
  for (let i = 0; i < SLOT_TYPES.length; i++) {
    if (except.includes(i)) continue;
    g.slots[i] = filler(i);
  }
}

function hiredManager(g: Game): void {
  g.manager = {
    name: "Lou Piniella",
    wins: 116,
    losses: 46,
    year: 2001,
    team: "SEA",
    teamName: "Seattle Mariners",
    ws: false,
    pen: true,
  };
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

  it("hiring the manager records team, record, and pedigree", () => {
    const g = landedGame(card([player({})], { ws: true }));
    g.hireManager();
    expect(g.manager).toMatchObject({
      name: "Joe Maddon",
      team: "CHC",
      wins: 103,
      losses: 58,
      ws: true,
    });
  });
});

describe("Double Play", () => {
  it("grants two choices; burns only when the second pick commits", () => {
    const a = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([a]));
    g.toggleDoublePlay();
    expect(g.choicesLeft).toBe(2);
    g.signPlayer(a);
    expect(g.powerups.doublePlay).toBe("armed"); // still refundable
    expect(g.phase).toBe("landed"); // second choice still live
    g.hireOwner();
    expect(g.powerups.doublePlay).toBe("spent");
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

  it("refunds when the second pick is forfeited via DONE", () => {
    const a = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([a]));
    g.toggleDoublePlay();
    g.signPlayer(a);
    expect(g.phase).toBe("landed");
    g.finishSpin();
    expect(g.powerups.doublePlay).toBe("ready");
    expect(g.phase).toBe("preSpin");
  });

  it("disarming after the first pick refunds and ends the spin", () => {
    const a = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([a]));
    g.toggleDoublePlay();
    g.signPlayer(a);
    expect(g.phase).toBe("landed");
    g.toggleDoublePlay(); // change of heart
    expect(g.powerups.doublePlay).toBe("ready");
    expect(g.phase).toBe("preSpin");
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

describe("Prime Time", () => {
  const C_POS = { c: 90, if: 0, of: 0, dh: 0 };

  function primeSetup() {
    const now = player({ id: "star", pos: "C", posG: C_POS, war: 2, cost: 3 });
    const then = player({ id: "star", pos: "C", posG: C_POS, war: 7, cost: 12 });
    fetchCards.PRM_2014 = card([then], {
      year: 2014,
      team: "PRM",
      franchise: "PRM",
      name: "Prime City",
    });
    return { now, g: landedGame(card([now])) };
  }

  it("signs another season of a listed player at that season's cost", async () => {
    const { now, g } = primeSetup();
    g.togglePrime();
    expect(g.primeArmed).toBe(true);
    g.primeTapPlayer(now);
    expect(g.primePick).toBe("star");
    const ok = await g.applyPrime("PRM", 2014);
    expect(ok).toBe(true);
    expect(g.slots[0]).toMatchObject({ id: "star", year: 2014, costPaid: 12, war: 7 });
    expect(g.powerups.prime).toBe("spent");
    expect(g.choicesUsed).toBe(1);
    expect(g.phase).toBe("preSpin"); // consumed the spin's choice
    expect(g.seen).toEqual([]); // browsed card is not "scouted"
  });

  it("cannot arm or apply without a choice left", async () => {
    const { now, g } = primeSetup();
    g.choicesLeft = 0;
    g.togglePrime();
    expect(g.primeArmed).toBe(false);
    g.powerups.prime = "armed"; // force past the toggle guard
    g.primeTapPlayer(now);
    expect(await g.applyPrime("PRM", 2014)).toBe(false);
    expect(g.slots[0]).toBe(null);
  });

  it("ignores taps on rostered players", () => {
    const { now, g } = primeSetup();
    g.slots[0] = filler(0, { id: "star" });
    g.togglePrime();
    g.primeTapPlayer(now);
    expect(g.primePick).toBe(null);
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

describe("visiblePlayers", () => {
  it("hides below-replacement players", () => {
    const good = player({ war: 2.5 });
    const bad = player({ war: -0.8, pa: 300 });
    const zero = player({ war: 0, pa: 200 });
    const g = landedGame(card([good, bad, zero]));
    expect(g.visiblePlayers.map((p) => p.id)).toEqual([good.id, zero.id]);
  });

  it("rescues the best player at a position that would vanish entirely", () => {
    const c1 = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 }, war: -0.4 });
    const c2 = player({ pos: "C", posG: { c: 60, if: 0, of: 0, dh: 0 }, war: -1.9, pa: 200 });
    const ifPos = player({ war: 4 });
    const g = landedGame(card([c1, c2, ifPos]));
    // c1 is the least-bad catcher → kept; c2 stays hidden
    expect(g.visiblePlayers.map((p) => p.id)).toEqual([c1.id, ifPos.id]);
  });

  it("cold stove judges by visible players, not the full card", () => {
    // A (war 3, catcher) is already rostered at FLEX; B (war −1, catcher) is
    // the only body for the open C seat but is hidden → the card is cold.
    const a = player({ id: "vetC", pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 }, war: 3 });
    const b = player({ pos: "C", posG: { c: 80, if: 0, of: 0, dh: 0 }, war: -1, pa: 150 });
    const g = landedGame(card([a, b], { manager: null }));
    g.owner = { name: "x", budget: 100, franchise: "SEA", year: 2001, teamName: "Mariners" };
    g.stadium = { park: "y", mult: 1, franchise: "SEA", year: 2001 };
    hiredManager(g);
    fillSlots(g, [0]);
    g.slots[4] = filler(4, { id: "vetC" });
    g.powerups.tradeDeadline = "spent";
    expect(g.visiblePlayers.map((p) => p.id)).toEqual(["vetC"]);
    expect(g.coldStove).toBe(true);
  });
});

describe("rowPlayable", () => {
  it("true for an open row, false with no choice left", () => {
    const p = player({});
    const g = landedGame(card([p]));
    expect(g.rowPlayable(p)).toBe(true);
    g.choicesLeft = 0;
    expect(g.rowPlayable(p)).toBe(false);
  });

  it("dead rows come alive only under an armed Trade Deadline", () => {
    const if1 = player({});
    const if2 = player({ pa: 400 });
    const g = landedGame(card([if1, if2]));
    g.slots[1] = filler(1);
    g.slots[2] = filler(2);
    g.slots[4] = filler(4);
    expect(g.playerState(if1)).toBe("dead");
    expect(g.rowPlayable(if1)).toBe(false);
    g.toggleTradeDeadline();
    expect(g.rowPlayable(if1)).toBe(true);
  });

  it("stays false for rostered players even when TD is armed", () => {
    const p = player({ id: "mine" });
    const g = landedGame(card([p]));
    g.slots[4] = filler(4, { id: "mine" });
    g.toggleTradeDeadline();
    expect(g.rowPlayable(p)).toBe(false);
  });
});

describe("Season Ticket and Relocate franchise resolution", () => {
  const wsnIndex: GameIndex = {
    yearMin: 1985,
    yearMax: 2024,
    cards: [
      { team: "WSN", year: 2010, franchise: "WSN", name: "Washington Nationals" },
      { team: "MON", year: 1994, franchise: "WSN", name: "Montreal Expos" },
      { team: "ATL", year: 1994, franchise: "ATL", name: "Atlanta Braves" },
    ],
  };
  const expos = () =>
    card([], { year: 1994, team: "MON", franchise: "WSN", name: "Montreal Expos" });
  const nats = () =>
    card([], { year: 2010, team: "WSN", franchise: "WSN", name: "Washington Nationals" });

  function landedOn(c: Card): Game {
    const g = new Game(meta, wsnIndex, owners, 42);
    g.card = c;
    g.phase = "landed";
    g.choicesLeft = 1;
    g.choicesUsed = 0;
    return g;
  }

  it("yearsForFranchise lists only seasons the franchise has cards for", () => {
    const g = landedOn(nats());
    expect(g.yearsForFranchise("WSN")).toEqual([1994, 2010]);
  });

  it("rejects a year outside the franchise's card list without burning the powerup", () => {
    const g = landedOn(nats());
    g.seasonTicket(1993);
    expect(g.phase).toBe("landed");
    expect(g.powerups.seasonTicket).toBe("ready");
  });

  it("Season Ticket crosses the relocation: 2010 Nationals → 1994 loads MON", async () => {
    fetchCards.MON_1994 = expos();
    const g = landedOn(nats());
    g.seasonTicket(1994);
    expect(g.phase).toBe("spinning");
    await g.land();
    expect(g.card?.team).toBe("MON");
    expect(g.card?.name).toBe("Montreal Expos");
    expect(g.powerups.seasonTicket).toBe("spent");
  });

  it("Relocate resolves the era-correct team code for a franchise", async () => {
    fetchCards.MON_1994 = expos();
    const g = landedOn(card([], { year: 1994, team: "ATL", franchise: "ATL", name: "Atlanta Braves" }));
    expect(g.teamsForYear(1994).map((e) => e.team).sort()).toEqual(["ATL", "MON"]);
    g.relocate("MON");
    await g.land();
    expect(g.card?.team).toBe("MON");
  });
});

describe("cold stove", () => {
  it("detected when nothing is actionable", () => {
    const c = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([c], { manager: null }));
    g.owner = { name: "x", budget: 100, franchise: "SEA", year: 2001, teamName: "Mariners" };
    g.stadium = { park: "y", mult: 1, franchise: "SEA", year: 2001 };
    hiredManager(g);
    // fill everything except an SP slot; card only offers a catcher
    fillSlots(g, [5]);
    g.powerups.tradeDeadline = "spent";
    expect(g.coldStove).toBe(true);
    // with TD available it is NOT cold — the catcher could swap in
    g.powerups.tradeDeadline = "ready";
    expect(g.coldStove).toBe(false);
  });
});

describe("completion and the hunt", () => {
  it("a full roster alone doesn't end the game — the hunt for the front office continues", () => {
    const c = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([c]));
    fillSlots(g, [0]);
    g.signPlayer(c);
    expect(g.rosterFull).toBe(true);
    expect(g.complete).toBe(false);
    expect(g.phase).toBe("preSpin"); // spun onward, no finale
    expect(g.finale).toBe(null);
  });

  it("fixed-cap: hiring the manager completes the club; TD spent → straight to finale", async () => {
    const g = new Game(meta, index, owners, 42, { difficulty: "standard", bank: "moneyball" });
    g.card = card([]);
    g.phase = "landed";
    g.choicesLeft = 1;
    fillSlots(g);
    g.powerups.tradeDeadline = "spent";
    g.hireManager();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    expect(g.finale?.parts.managerWins).toBeCloseTo((103 - 58) * 0.1, 5);
  });

  it("classic also needs owner and stadium", async () => {
    const g = landedGame(card([]));
    fillSlots(g);
    hiredManager(g);
    g.owner = { name: "x", budget: 100, franchise: "CHC", year: 2016, teamName: "Cubs" };
    g.powerups.tradeDeadline = "spent";
    expect(g.complete).toBe(false);
    g.buyStadium();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
  });

  it("an unspent Trade Deadline earns one bonus spin before the finale", async () => {
    const g = new Game(meta, index, owners, 42, { difficulty: "standard", bank: "moneyball" });
    g.card = card([]);
    g.phase = "landed";
    g.choicesLeft = 1;
    fillSlots(g);
    g.hireManager(); // complete, TD still ready
    expect(g.phase).toBe("preSpin");
    expect(g.inTdBonus).toBe(true);
    expect(g.finale).toBe(null);
    // the bonus card lands; player waves it off
    g.card = card([]);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.choicesUsed = 0;
    expect(g.willFinishOnPass).toBe(true);
    g.passSpin();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
  });
});

describe("passSpin", () => {
  it("is a no-op before the roster is full", () => {
    const g = landedGame(card([player({})]));
    g.passSpin();
    expect(g.phase).toBe("landed");
  });

  it("skips a hunt card without consuming anything", () => {
    const g = landedGame(card([]));
    fillSlots(g);
    expect(g.willFinishOnPass).toBe(false);
    g.passSpin();
    expect(g.phase).toBe("preSpin");
    expect(g.finale).toBe(null);
    expect(g.choicesUsed).toBe(0);
  });
});

describe("finale", () => {
  it("the record equals rounded expected wins on the 50-win base", async () => {
    const g = landedGame(
      card([player({ pos: "SP", gs: 30, posG: { c: 0, if: 0, of: 0, dh: 0 }, war: 5 })]),
    );
    for (let i = 0; i < 8; i++) {
      if (i === 5) continue;
      g.slots[i] = filler(i, { awards: i === 0 ? ["MVP"] : [], ws: i === 1, pen: i === 2 });
    }
    hiredManager(g); // 116–46 → +7.0 wins
    g.owner = { name: "x", budget: 100, franchise: "CHC", year: 2016, teamName: "Cubs" };
    g.stadium = { park: "y", mult: 1, franchise: "CHC", year: 2016 };
    g.powerups.tradeDeadline = "spent";
    const sp = g.card!.players[0];
    g.signPlayer(sp);
    // finishGame awaits the best-roster card reloads (a microtask here).
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    const f = g.finale!;
    expect(f.parts.expectedWins).toBeCloseTo(50 + 3 * 7 + 5 + 7, 1);
    expect(f.parts.managerWins).toBeCloseTo(7.0, 5);
    expect(f.parts.awardPoints).toBe(5);
    expect(f.parts.ringPoints).toBe(3 + 1); // two player flags + manager pennant
    expect(f.wins).toBe(Math.round(f.parts.expectedWins));
    expect(f.wins + f.losses).toBe(162);
  });
});

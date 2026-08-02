import { beforeEach, describe, expect, it, vi } from "vitest";
import { eligibleTypes } from "../src/lib/eligibility";
import { recordFromTotal } from "../src/lib/format";
import { GAMES, MARINERS_WINS } from "../src/lib/scoring";
import {
  Game,
  HOMEGROWN_PRICE_M,
  SLOT_TYPES,
  type Signed,
} from "../src/lib/engine.svelte";
import type {
  Card,
  CardPlayer,
  GameIndex,
  Meta,
  Owners,
} from "../src/lib/types";

// Engine save()/restore() guard storage access; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// loadCard/loadSpecials go through fetch; serve registered cards and the
// specials index, 404 anything else (finale reloads of unregistered cards
// fail → best roster falls back to null).
const fetchCards: Record<string, Card> = {};
const fetchSpecials: Record<string, unknown[]> = {};
vi.stubGlobal("fetch", async (url: unknown) => {
  if (String(url).endsWith("data/specials.json"))
    return { ok: true, json: async () => fetchSpecials };
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
    CHC: {
      name: "Chicago Cubs",
      owners: [{ name: "Ricketts family", from: 2009, to: null }],
    },
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
    const p = player({
      pos: "SP/DH",
      gs: 20,
      posG: { c: 0, if: 0, of: 0, dh: 40 },
    });
    expect(eligibleTypes(p)).toEqual(["SP", "FLEX"]);
  });
  it("DH-only bat is FLEX only", () => {
    const p = player({ posG: { c: 0, if: 3, of: 0, dh: 120 }, pos: "DH" });
    expect(eligibleTypes(p)).toEqual(["FLEX"]);
  });
  it("relievers never reach FLEX", () => {
    const p = player({
      pos: "RP",
      posG: { c: 0, if: 0, of: 0, dh: 0 },
      pa: 2,
      relIP: 60,
    });
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
    const b = player({
      pos: "C",
      posG: { c: 80, if: 0, of: 0, dh: 0 },
      pa: 200,
    });
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

  it("refunds when the remaining second pick is forfeited (finishSpin)", () => {
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
    const a = player({
      pos: "RP",
      posG: { c: 0, if: 0, of: 0, dh: 0 },
      pa: 0,
      relIP: 60,
      cost: 20,
      war: 1,
    });
    const b = player({
      pos: "RP",
      posG: { c: 0, if: 0, of: 0, dh: 0 },
      pa: 0,
      relIP: 55,
      cost: 2,
      war: 3,
    });
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

  it("trades for a catcher even though UTIL is open — releases the rostered C", () => {
    const oldC = player({
      pos: "C",
      posG: { c: 90, if: 0, of: 0, dh: 0 },
      cost: 8,
      war: 2,
    });
    const newC = player({
      pos: "C",
      posG: { c: 85, if: 0, of: 0, dh: 0 },
      cost: 15,
      war: 6,
      pa: 450,
    });
    const g = landedGame(card([oldC, newC]));
    g.signPlayer(oldC);
    g.phase = "landed";
    g.choicesLeft = 1;
    // FLEX is open, so the row reads "open" — the old logic refused the trade here.
    expect(g.playerState(newC)).toBe("open");
    g.toggleTradeDeadline();
    expect(g.tdCandidate(newC)).toBe(true);
    expect(g.rowPlayable(newC)).toBe(true);
    const before = g.spend;
    g.tdTapPlayer(newC);
    expect(g.releasePick).toBe(null); // only the C seat is occupied → no picker
    expect(g.slots[0]?.id).toBe(newC.id); // new catcher at C
    expect(g.slots.some((s) => s?.id === oldC.id)).toBe(false); // old C released
    expect(g.spend).toBeCloseTo(before - 8 + 15); // release refunds his salary
    expect(g.powerups.tradeDeadline).toBe("spent");
    expect(g.spinLog.at(-1)?.kind).toBe("swap");
  });

  it("trades out a rostered IF while the second IF seat sits open", () => {
    const if1 = player({ cost: 4, war: 1 });
    const if2 = player({ pa: 400, cost: 9, war: 5 });
    const g = landedGame(card([if1, if2]));
    g.signPlayer(if1, 1);
    g.phase = "landed";
    g.choicesLeft = 1;
    expect(g.playerState(if2)).toBe("open"); // IF seat 2 and FLEX both open
    g.toggleTradeDeadline();
    g.tdTapPlayer(if2);
    expect(g.releasePick).toBe(null); // seat 1 is the only occupied eligible cell
    expect(g.slots[1]?.id).toBe(if2.id); // exchanged for the rostered IF
    expect(g.slots[2]).toBe(null); // the open IF seat is untouched — trade, not sign
    expect(g.powerups.tradeDeadline).toBe("spent");
  });

  it("disarmed, the same row signs plainly into the open seat — no TD spent", () => {
    const oldC = player({
      pos: "C",
      posG: { c: 90, if: 0, of: 0, dh: 0 },
      cost: 8,
    });
    const newC = player({
      pos: "C",
      posG: { c: 85, if: 0, of: 0, dh: 0 },
      cost: 15,
      pa: 450,
    });
    const g = landedGame(card([oldC, newC]));
    g.signPlayer(oldC);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.toggleTradeDeadline();
    g.toggleTradeDeadline(); // change of heart
    expect(g.tdCandidate(newC)).toBe(false);
    g.tdTapPlayer(newC); // no-op while disarmed
    expect(g.slots[0]?.id).toBe(oldC.id);
    g.signPlayer(newC);
    expect(g.slots[4]?.id).toBe(newC.id); // plain sign into the open FLEX seat
    expect(g.slots[0]?.id).toBe(oldC.id); // rostered C untouched
    expect(g.powerups.tradeDeadline).toBe("ready");
    expect(g.spinLog.at(-1)?.kind).toBe("sign");
  });

  it("an open row with several occupied seats opens the release picker over all of them", () => {
    const if1 = player({});
    const flexBat = player({
      pos: "DH",
      posG: { c: 0, if: 0, of: 0, dh: 120 },
    });
    const if2 = player({ pa: 400 });
    const g = landedGame(card([if1, flexBat, if2]));
    for (const p of [if1, flexBat]) {
      g.signPlayer(p);
      g.phase = "landed";
      g.choicesLeft = 1;
    }
    expect(g.playerState(if2)).toBe("open"); // second IF seat is still open
    g.toggleTradeDeadline();
    g.tdTapPlayer(if2);
    expect(g.releasePick).toBe(if2.id);
    expect(g.occupiedSlotsFor(if2)).toEqual([1, 4]); // every seat he could take over
    g.tdRelease(if2, 4);
    expect(g.slots[4]?.id).toBe(if2.id);
    expect(g.slots[2]).toBe(null); // open IF seat untouched
    expect(g.powerups.tradeDeadline).toBe("spent");
  });

  it("swaps a taken special 1-for-1", () => {
    const g = landedGame(card([player({})]));
    g.hireOwner();
    g.phase = "landed";
    g.choicesLeft = 1;
    g.card = card([player({})], {
      budget: 200,
      name: "New York Yankees",
      franchise: "NYY",
      team: "NYY",
    });
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
    const then = player({
      id: "star",
      pos: "C",
      posG: C_POS,
      war: 7,
      cost: 12,
    });
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
    expect(g.slots[0]).toMatchObject({
      id: "star",
      year: 2014,
      costPaid: 12,
      war: 7,
    });
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

describe("Homegrown (the hometown discount)", () => {
  // The flat sticker price every discounted sign commits at.
  const floor = HOMEGROWN_PRICE_M;

  it("armed, a debut-match row reprices to the flat $1M and signing spends it", () => {
    const local = player({ debut: "CHC" });
    const g = landedGame(card([local]));
    expect(g.priceFor(local)).toBe(5); // not armed → full price
    g.toggleHometown();
    expect(g.powerups.hometown).toBe("armed");
    expect(g.discountEligible(local)).toBe(true);
    expect(g.priceFor(local)).toBeCloseTo(floor);
    g.signPlayer(local);
    const signed = g.slots.find((s) => s?.id === local.id);
    expect(signed?.costPaid).toBeCloseTo(floor);
    expect(signed?.hero).toBe(true);
    expect(g.powerups.hometown).toBe("spent");
    expect(g.choicesUsed).toBe(1); // the sign consumed the spin's choice as usual
  });

  it("never charges more than the listed price — a sub-$1M player signs at his own price", () => {
    const bargain = player({ debut: "CHC", cost: 0.8 });
    const g = landedGame(card([bargain]));
    g.toggleHometown();
    expect(g.priceFor(bargain)).toBeCloseTo(0.8);
    g.signPlayer(bargain);
    const signed = g.slots.find((s) => s?.id === bargain.id);
    expect(signed?.costPaid).toBeCloseTo(0.8);
    expect(signed?.hero).toBe(true); // still a discounted sign…
    expect(g.powerups.hometown).toBe("spent"); // …and it still spends the powerup
  });

  it("armed, a non-debut row grays out — unplayable and unsignable until disarm", () => {
    const outsider = player({ debut: "SEA" });
    const g = landedGame(card([outsider]));
    expect(g.rowPlayable(outsider)).toBe(true);
    g.toggleHometown();
    expect(g.discountEligible(outsider)).toBe(false);
    expect(g.rowPlayable(outsider)).toBe(false); // armed 🏠 filters the market
    g.signPlayer(outsider); // no-op while filtered out
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.choicesUsed).toBe(0);
    g.toggleHometown(); // disarm → plain sign at full price works
    expect(g.rowPlayable(outsider)).toBe(true);
    g.signPlayer(outsider);
    const signed = g.slots.find((s) => s?.id === outsider.id);
    expect(signed?.costPaid).toBe(5);
    expect(signed?.hero).toBe(false);
    expect(g.powerups.hometown).toBe("ready"); // never spent
  });

  it("disarming restores prices and the grayed rows with nothing consumed", () => {
    const local = player({ debut: "CHC" });
    const outsider = player({ debut: "SEA", pa: 400 });
    const g = landedGame(card([local, outsider]));
    g.toggleHometown();
    expect(g.priceFor(local)).toBeCloseTo(floor);
    expect(g.rowPlayable(local)).toBe(true); // eligible row keeps active styling
    expect(g.rowPlayable(outsider)).toBe(false);
    g.toggleHometown();
    expect(g.powerups.hometown).toBe("ready");
    expect(g.priceFor(local)).toBe(5);
    expect(g.rowPlayable(outsider)).toBe(true);
    expect(g.choicesUsed).toBe(0);
    expect(g.choicesLeft).toBe(1);
  });

  it("a card with no debut-eligible players still arms — whole list grays, disarm restores", () => {
    const a = player({ debut: "SEA" });
    const b = player({ debut: "NYY", pa: 400 });
    const g = landedGame(card([a, b]));
    g.toggleHometown();
    expect(g.powerups.hometown).toBe("armed");
    expect(g.rowPlayable(a)).toBe(false);
    expect(g.rowPlayable(b)).toBe(false);
    g.toggleHometown(); // clean disarm from the all-gray state
    expect(g.powerups.hometown).toBe("ready");
    expect(g.rowPlayable(a)).toBe(true);
    expect(g.rowPlayable(b)).toBe(true);
  });

  it("committing a special while armed disarms the discount without spending it", () => {
    const local = player({ debut: "CHC" });
    const g = landedGame(card([local]));
    g.toggleHometown();
    g.hireOwner(); // specials stay live while armed — the filter is market-only
    expect(g.owner).not.toBe(null);
    expect(g.choicesUsed).toBe(1);
    expect(g.powerups.hometown).toBe("ready"); // disarmed at spin end, not spent
  });

  it("a reroll powerup disarms the discount without spending it", () => {
    const twoYears: GameIndex = {
      yearMin: 1985,
      yearMax: 2024,
      cards: [
        { team: "CHC", year: 2016, franchise: "CHC", name: "Chicago Cubs" },
        { team: "CHC", year: 2015, franchise: "CHC", name: "Chicago Cubs" },
      ],
    };
    fetchCards.CHC_2015 = card([], { year: 2015 });
    const g = new Game(meta, twoYears, owners, 42);
    g.card = card([player({ debut: "CHC" })]);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.choicesUsed = 0;
    g.toggleHometown();
    g.seasonTicket(2015);
    expect(g.phase).toBe("spinning");
    expect(g.powerups.seasonTicket).toBe("spent");
    expect(g.powerups.hometown).toBe("ready"); // disarmed, not spent
  });

  it("TD + discount both armed: a debut-eligible swap-in commits at the discount, both spend", () => {
    const a = player({
      pos: "RP",
      posG: { c: 0, if: 0, of: 0, dh: 0 },
      pa: 0,
      relIP: 60,
      cost: 20,
      war: 1,
    });
    const b = player({
      pos: "RP",
      posG: { c: 0, if: 0, of: 0, dh: 0 },
      pa: 0,
      relIP: 55,
      cost: 12,
      war: 3,
      debut: "CHC",
    });
    const g = landedGame(card([a, b]));
    g.signPlayer(a);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.toggleTradeDeadline();
    g.toggleHometown();
    g.tdTapPlayer(b);
    expect(g.slots[7]?.id).toBe(b.id);
    expect(g.slots[7]?.hero).toBe(true);
    expect(g.slots[7]?.costPaid).toBeCloseTo(floor);
    expect(g.powerups.hometown).toBe("spent");
    expect(g.powerups.tradeDeadline).toBe("spent");
  });

  it("stacks with Double Play: discounted pick 1, normal-price pick 2, filter lifts mid-spin", () => {
    const local = player({
      debut: "CHC",
      pos: "C",
      posG: { c: 90, if: 0, of: 0, dh: 0 },
      cost: 8,
    });
    const outsider = player({ debut: "SEA" });
    const g = landedGame(card([local, outsider]));
    g.toggleDoublePlay();
    g.toggleHometown();
    expect(g.rowPlayable(outsider)).toBe(false); // grayed while armed
    g.signPlayer(local);
    expect(g.slots[0]?.costPaid).toBeCloseTo(floor);
    expect(g.slots[0]?.hero).toBe(true);
    expect(g.powerups.hometown).toBe("spent"); // spent once, on the discounted pick
    expect(g.phase).toBe("landed"); // DP's second pick still live
    expect(g.rowPlayable(outsider)).toBe(true); // filter lifted mid-spin
    expect(g.priceFor(outsider)).toBe(5); // prices restored
    g.signPlayer(outsider);
    const second = g.slots.find((s) => s?.id === outsider.id);
    expect(second?.costPaid).toBe(5);
    expect(second?.hero).toBe(false);
    expect(g.powerups.doublePlay).toBe("spent");
    expect(g.powerups.hometown).toBe("spent");
  });

  it("the triple stack: DP + TD + 🏠 — a discounted swap-in is one of DP's two picks", () => {
    const a = player({
      pos: "RP",
      posG: { c: 0, if: 0, of: 0, dh: 0 },
      pa: 0,
      relIP: 60,
      cost: 20,
      war: 1,
    });
    const b = player({
      pos: "RP",
      posG: { c: 0, if: 0, of: 0, dh: 0 },
      pa: 0,
      relIP: 55,
      cost: 12,
      war: 3,
      debut: "CHC",
    });
    const c = player({ debut: "SEA" });
    const g = landedGame(card([a, b, c]));
    g.signPlayer(a);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.choicesUsed = 0;
    g.toggleDoublePlay();
    g.toggleTradeDeadline();
    g.toggleHometown();
    g.tdTapPlayer(b); // pick 1: the discounted trade
    expect(g.slots[7]?.id).toBe(b.id);
    expect(g.slots[7]?.costPaid).toBeCloseTo(floor);
    expect(g.slots[7]?.hero).toBe(true);
    expect(g.powerups.tradeDeadline).toBe("spent");
    expect(g.powerups.hometown).toBe("spent");
    expect(g.powerups.doublePlay).toBe("armed"); // pick 2 still refundable
    expect(g.phase).toBe("landed");
    expect(g.priceFor(c)).toBe(5); // pick 2 shops at normal prices
    g.signPlayer(c);
    expect(g.slots.find((s) => s?.id === c.id)?.costPaid).toBe(5);
    expect(g.powerups.doublePlay).toBe("spent");
  });

  it("owner + stadium from one franchise no longer discounts anything", () => {
    const local = player({ debut: "CHC" });
    const g = landedGame(card([local]));
    g.hireOwner();
    g.phase = "landed";
    g.choicesLeft = 1;
    g.buyStadium();
    g.phase = "landed";
    g.choicesLeft = 1;
    expect(g.owner?.franchise).toBe(g.stadium?.franchise); // the old combo trigger
    expect(g.discountEligible(local)).toBe(false);
    expect(g.priceFor(local)).toBe(5);
    g.signPlayer(local);
    const signed = g.slots.find((s) => s?.id === local.id);
    expect(signed?.costPaid).toBe(5);
    expect(signed?.hero).toBe(false);
    expect(g.powerups.hometown).toBe("ready");
  });

  it("works in fixed-cap banks — no owner spins needed", () => {
    const g = new Game(meta, index, owners, 42, {
      difficulty: "standard",
      bank: "moneyball",
    });
    const local = player({ debut: "CHC" });
    g.card = card([local]);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.toggleHometown();
    expect(g.priceFor(local)).toBeCloseTo(floor);
  });

  it("a v4 save restores with heroUsed mapped onto the discount", async () => {
    const g = landedGame(card([player({})]));
    g.save();
    const saved = JSON.parse(store.get("hotstove.current")!) as Record<
      string,
      unknown
    >;
    saved.v = 4;
    delete (saved.powerups as Record<string, unknown>).hometown;
    saved.heroUsed = true;
    saved.cardRef = null; // resume preSpin without a card fetch
    store.set("hotstove.current", JSON.stringify(saved));
    const spentBack = await Game.restore(meta, index, owners);
    expect(spentBack?.powerups.hometown).toBe("spent");
    saved.heroUsed = false;
    store.set("hotstove.current", JSON.stringify(saved));
    const readyBack = await Game.restore(meta, index, owners);
    expect(readyBack?.powerups.hometown).toBe("ready");
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
    const c1 = player({
      pos: "C",
      posG: { c: 90, if: 0, of: 0, dh: 0 },
      war: -0.4,
    });
    const c2 = player({
      pos: "C",
      posG: { c: 60, if: 0, of: 0, dh: 0 },
      war: -1.9,
      pa: 200,
    });
    const ifPos = player({ war: 4 });
    const g = landedGame(card([c1, c2, ifPos]));
    // c1 is the least-bad catcher → kept; c2 stays hidden
    expect(g.visiblePlayers.map((p) => p.id)).toEqual([c1.id, ifPos.id]);
  });

  it("cold stove judges by visible players, not the full card", () => {
    // A (war 3, catcher) is already rostered at FLEX; B (war −1, catcher) is
    // the only body for the open C seat but is hidden → the card is cold.
    const a = player({
      id: "vetC",
      pos: "C",
      posG: { c: 90, if: 0, of: 0, dh: 0 },
      war: 3,
    });
    const b = player({
      pos: "C",
      posG: { c: 80, if: 0, of: 0, dh: 0 },
      war: -1,
      pa: 150,
    });
    const g = landedGame(card([a, b], { manager: null }));
    g.owner = {
      name: "x",
      budget: 100,
      franchise: "SEA",
      year: 2001,
      teamName: "Mariners",
    };
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
      {
        team: "WSN",
        year: 2010,
        franchise: "WSN",
        name: "Washington Nationals",
      },
      { team: "MON", year: 1994, franchise: "WSN", name: "Montreal Expos" },
      { team: "ATL", year: 1994, franchise: "ATL", name: "Atlanta Braves" },
    ],
  };
  const expos = () =>
    card([], {
      year: 1994,
      team: "MON",
      franchise: "WSN",
      name: "Montreal Expos",
    });
  const nats = () =>
    card([], {
      year: 2010,
      team: "WSN",
      franchise: "WSN",
      name: "Washington Nationals",
    });

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
    const g = landedOn(
      card([], {
        year: 1994,
        team: "ATL",
        franchise: "ATL",
        name: "Atlanta Braves",
      }),
    );
    expect(
      g
        .teamsForYear(1994)
        .map((e) => e.team)
        .sort(),
    ).toEqual(["ATL", "MON"]);
    g.relocate("MON");
    await g.land();
    expect(g.card?.team).toBe("MON");
  });
});

describe("cold stove", () => {
  it("detected when nothing is actionable", () => {
    const c = player({ pos: "C", posG: { c: 90, if: 0, of: 0, dh: 0 } });
    const g = landedGame(card([c], { manager: null }));
    g.owner = {
      name: "x",
      budget: 100,
      franchise: "SEA",
      year: 2001,
      teamName: "Mariners",
    };
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
    const g = new Game(meta, index, owners, 42, {
      difficulty: "standard",
      bank: "moneyball",
    });
    g.card = card([]);
    g.phase = "landed";
    g.choicesLeft = 1;
    fillSlots(g);
    g.powerups.tradeDeadline = "spent";
    g.hireManager();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    expect(g.finale?.parts.managerWins).toBeCloseTo((103 - 58) * 0.2, 5);
  });

  it("classic also needs owner and stadium", async () => {
    const g = landedGame(card([]));
    fillSlots(g);
    hiredManager(g);
    g.owner = {
      name: "x",
      budget: 100,
      franchise: "CHC",
      year: 2016,
      teamName: "Cubs",
    };
    g.powerups.tradeDeadline = "spent";
    expect(g.complete).toBe(false);
    g.buyStadium();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
  });

  it("an unspent Trade Deadline does not delay the finale — a complete club ends the game", async () => {
    const g = new Game(meta, index, owners, 42, {
      difficulty: "standard",
      bank: "moneyball",
    });
    g.card = card([]);
    g.phase = "landed";
    g.choicesLeft = 1;
    fillSlots(g);
    expect(g.powerups.tradeDeadline).toBe("ready");
    g.hireManager(); // complete, TD still ready
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    expect(g.finale).not.toBe(null);
  });

  it("a save from the retired bonus-spin rule (tdBonus field) still restores", async () => {
    const g = landedGame(card([player({})]));
    g.save();
    const saved = JSON.parse(store.get("hotstove.current")!);
    saved.tdBonus = true; // legacy field
    saved.cardRef = null; // resume preSpin without a card fetch
    store.set("hotstove.current", JSON.stringify(saved));
    const back = await Game.restore(meta, index, owners);
    expect(back).not.toBeNull();
    expect(back!.phase).toBe("preSpin");
  });
});

describe("the front-office hunt has no pass", () => {
  it("the engine exposes no pass path — skipping a hunt card is impossible", () => {
    const g = landedGame(card([]));
    fillSlots(g);
    expect((g as unknown as Record<string, unknown>).passSpin).toBeUndefined();
    expect(
      (g as unknown as Record<string, unknown>).willFinishOnPass,
    ).toBeUndefined();
  });

  it("a hunt card stays landed until a front-office pick commits", () => {
    const g = landedGame(card([]));
    fillSlots(g);
    expect(g.phase).toBe("landed");
    expect(g.coldStove).toBe(false); // the manager tile is always takeable
    g.hireManager();
    expect(g.choicesUsed).toBe(1);
    expect(g.phase).toBe("preSpin"); // owner + stadium still open → next spin
  });
});

describe("applyPrimeSpecial", () => {
  const specialsFixture = [
    // 2015 Maddon really was the NL Manager of the Year — the moty flag rides
    // the specials timeline into a Prime Time hire.
    {
      team: "CHC",
      year: 2015,
      name: "Chicago Cubs",
      park: "Wrigley Field",
      mgr: "Joe Maddon",
      w: 97,
      l: 65,
      att: 0.81,
      mult: 1.09,
      budget: 120.4,
      moty: true,
    },
    {
      team: "CHC",
      year: 2016,
      name: "Chicago Cubs",
      park: "Wrigley Field",
      mgr: "Joe Maddon",
      w: 103,
      l: 58,
      att: 0.86,
      mult: 1.11,
      budget: 136.3,
    },
  ];

  function primedGame(bank: "classic" | "moneyball" = "classic"): Game {
    fetchSpecials.CHC = specialsFixture;
    const g = new Game(meta, index, owners, 42, {
      difficulty: "standard",
      bank,
    });
    g.card = card([player({})]);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.powerups.prime = "armed";
    g.primeSpecial = "manager";
    return g;
  }

  it("hires the chosen year's manager, with pedigree from the index rows", async () => {
    const g = primedGame();
    expect(await g.applyPrimeSpecial("CHC", 2015)).toBe(true);
    expect(g.manager).toMatchObject({
      name: "Joe Maddon",
      wins: 97,
      losses: 65,
      year: 2015,
      team: "CHC",
      ws: false,
      pen: false,
      moty: true,
    });
    expect(g.powerups.prime).toBe("spent");
    expect(g.choicesUsed).toBe(1);
    expect(g.primeSpecial).toBe(null);
  });

  it("owner and stadium tiles are not Prime targets — the tap never opens a browse", () => {
    const g = primedGame();
    g.primeSpecial = null;
    g.primeTapSpecial("owner");
    expect(g.primeSpecial).toBe(null);
    g.primeTapSpecial("stadium");
    expect(g.primeSpecial).toBe(null);
    g.primeTapSpecial("manager"); // the manager tile is the one special that opens
    expect(g.primeSpecial).toBe("manager");
  });

  it("a forced owner browse cannot commit — applyPrimeSpecial hires managers only", async () => {
    const g = primedGame();
    (g as unknown as { primeSpecial: string }).primeSpecial = "owner";
    expect(await g.applyPrimeSpecial("CHC", 2015)).toBe(false);
    expect(g.owner).toBe(null);
    expect(g.stadium).toBe(null);
    expect(g.powerups.prime).toBe("armed"); // nothing consumed
    expect(g.choicesUsed).toBe(0);
  });

  it("fixed-cap banks still prime the manager", async () => {
    const g = primedGame("moneyball");
    g.primeSpecial = null;
    g.primeTapSpecial("manager");
    expect(g.primeSpecial).toBe("manager");
    expect(await g.applyPrimeSpecial("CHC", 2015)).toBe(true);
    expect(g.manager?.year).toBe(2015);
  });

  it("is a no-op when prime is not armed or the year is unknown", async () => {
    const g = primedGame();
    g.powerups.prime = "ready";
    expect(await g.applyPrimeSpecial("CHC", 2015)).toBe(false);
    g.powerups.prime = "armed";
    expect(await g.applyPrimeSpecial("CHC", 1901)).toBe(false);
    expect(g.manager).toBe(null);
    expect(g.choicesUsed).toBe(0);
  });

  it("primeTapSpecial only opens for armed prime on an open tile", () => {
    const g = primedGame();
    g.primeSpecial = null;
    g.primeTapSpecial("manager");
    expect(g.primeSpecial).toBe("manager");
    g.primeSpecial = null;
    hiredManager(g); // seat now taken
    g.primeTapSpecial("manager");
    expect(g.primeSpecial).toBe(null);
  });
});

describe("finale", () => {
  it("the record equals rounded expected wins on the 50-win base", async () => {
    const g = landedGame(
      card([
        player({
          pos: "SP",
          gs: 30,
          posG: { c: 0, if: 0, of: 0, dh: 0 },
          war: 5,
        }),
      ]),
    );
    for (let i = 0; i < 8; i++) {
      if (i === 5) continue;
      g.slots[i] = filler(i, {
        awards: i === 0 ? ["MVP"] : [],
        ws: i === 1,
        pen: i === 2,
      });
    }
    hiredManager(g); // 116–46 → +14.0 wins at M=0.2
    g.owner = {
      name: "x",
      budget: 100,
      franchise: "CHC",
      year: 2016,
      teamName: "Cubs",
    };
    g.stadium = { park: "y", mult: 1, franchise: "CHC", year: 2016 };
    g.powerups.tradeDeadline = "spent";
    const sp = g.card!.players[0];
    g.signPlayer(sp);
    // finishGame awaits the best-roster card reloads (a microtask here).
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    const f = g.finale!;
    expect(f.parts.expectedWins).toBeCloseTo(50 + 3 * 7 + 5 + 14, 1);
    expect(f.parts.managerWins).toBeCloseTo(14.0, 5);
    expect(f.parts.awardPoints).toBe(3);
    expect(f.parts.ringPoints).toBe(4 + 1); // player ring 3 + player pennant 1, + manager pennant 1
    expect(f.wins).toBe(Math.round(f.parts.expectedWins));
    expect(f.wins + f.losses).toBe(162);
  });

  /** The on-field ladder is gated on BOTH records, and this is the half that
   * only an end-to-end finale can prove.
   *
   * `onFieldBadge` takes the stamp as a second argument and vetoes a rung the
   * stamp does not hold — that much is covered against the function directly.
   * What that unit test cannot see is whether the ENGINE ever hands it a stamp.
   * `stampWins` defaults to `baselineWins`, so a call site that omits the fact
   * type-checks, runs, and satisfies the gate by construction on every club
   * ever built: the veto is dead and every direct test of it still passes.
   *
   * So the assertion here is deliberately made through `finishGame` rather than
   * against `earnedBadges`: a club worth 108 on the field that taxes itself to
   * an 89–73 stamp must not keep 💯, and the only way to be sure is to let the
   * engine assemble the facts itself. */
  function taxedClub(costPaid: number): Game {
    const g = landedGame(
      card([
        player({
          pos: "SP",
          gs: 30,
          posG: { c: 0, if: 0, of: 0, dh: 0 },
          war: 5.5,
          cost: costPaid,
        }),
      ]),
    );
    for (let i = 0; i < 8; i++) {
      if (i === 5) continue;
      g.slots[i] = filler(i, { war: 5.5, costPaid });
    }
    hiredManager(g); // 116–46 → +14.0 wins, and one pennant point
    g.owner = { name: "x", budget: 100, franchise: "CHC", year: 2016, teamName: "Cubs" };
    g.stadium = { park: "y", mult: 1, franchise: "CHC", year: 2016 }; // cap = $100M
    g.powerups.tradeDeadline = "spent";
    g.signPlayer(g.card!.players[0]);
    return g;
  }

  it("keeps the rung when the stamp holds what the baseline earned", async () => {
    const g = taxedClub(10); // $80M of a $100M cap: under, so a payroll BONUS
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    const f = g.finale!;
    expect(f.wins).toBe(108); // 50 + 44 WAR + 14 manager — the '86 Mets' rung
    expect(Math.round(f.parts.total)).toBeGreaterThanOrEqual(108);
    expect(f.badges).toContain("mets");
  });

  it("vetoes the rung when the luxury tax drops the stamp under it", async () => {
    const g = taxedClub(15); // $120M of a $100M cap: $20M over, 20 points of tax
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    const f = g.finale!;
    // The same club on the field as the test above — the bill is the only
    // difference, and an 89–73 stamp has not matched the '86 Mets.
    expect(f.wins).toBe(108);
    expect(f.parts.luxuryTax).toBeCloseTo(20, 5);
    expect(Math.round(f.parts.total)).toBe(89);
    expect(f.badges).not.toContain("mets");
    // A vetoed rung earns NOTHING rather than cascading to a lower one, or the
    // tax would hand a taxed-out club a consolation 💯 and turn the penalty
    // back into a prize.
    expect(f.badges).not.toContain("hundred");
  });

  /** First-time badges are a question about the history log as it stood BEFORE
   * this game joined it. finishGame reads the log and then appends to it, and
   * the two must stay in that order: swap them and every badge reads as
   * already-owned, forever, on every game. That failure is invisible to any
   * test that hands `newBadges` to a component directly, so it is asserted
   * here, against a real finished game. */
  function finishedClub(): Game {
    const g = landedGame(
      card([
        player({
          pos: "SP",
          gs: 30,
          posG: { c: 0, if: 0, of: 0, dh: 0 },
          war: 5,
        }),
      ]),
    );
    for (let i = 0; i < 8; i++) {
      if (i === 5) continue;
      g.slots[i] = filler(i);
    }
    hiredManager(g);
    // Clean House is the default bank, so the club is not complete until the
    // front office is filled too.
    g.owner = {
      name: "x",
      budget: 100,
      franchise: "CHC",
      year: 2016,
      teamName: "Cubs",
    };
    g.stadium = { park: "y", mult: 1, franchise: "CHC", year: 2016 };
    g.powerups.tradeDeadline = "spent";
    g.signPlayer(g.card!.players[0]);
    return g;
  }

  it("flags every badge on the very first game ever played", async () => {
    store.clear();
    const g = finishedClub();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    // An empty log means everything earned is genuinely a first — deliberate,
    // not noise. If the club earned nothing, there is nothing to flag either.
    expect(g.finale!.newBadges).toEqual(g.finale!.badges);
  });

  it("flags nothing the second time the same club is built", async () => {
    store.clear();
    const first = finishedClub();
    await vi.waitFor(() => expect(first.phase).toBe("finale"));
    const earned = first.finale!.badges;
    expect(earned.length).toBeGreaterThan(0); // the test is vacuous otherwise

    const second = finishedClub();
    await vi.waitFor(() => expect(second.phase).toBe("finale"));
    expect(second.finale!.badges).toEqual(earned);
    // The read happened before the append, so the FIRST game still flagged
    // them; the second sees them already in the log.
    expect(second.finale!.newBadges).toEqual([]);
  });

  it("flags only the badge the earlier game did not earn", async () => {
    store.clear();
    const first = finishedClub();
    await vi.waitFor(() => expect(first.phase).toBe("finale"));
    // Rewrite history so one earned badge is missing from the log, as though
    // an earlier season had come up short of it.
    const hist = JSON.parse(store.get("hotstove.history")!);
    const held = first.finale!.badges[0];
    hist[0].badges = first.finale!.badges.filter((k: string) => k !== held);
    store.set("hotstove.history", JSON.stringify(hist));

    const second = finishedClub();
    await vi.waitFor(() => expect(second.phase).toBe("finale"));
    expect(second.finale!.newBadges).toEqual([held]);
  });
});

/** Facts the badge layer reads off a finished club that the ENGINE has to put
 * there. Each of these is optional on the way in and fails SAFE when missing —
 * an absent country counts as no country, an absent `hof` as not inducted — so
 * a call site that never supplies them earns nothing, silently, forever. The
 * badges simply never fire and no test of `earnedBadges` can tell, because
 * those hand the facts in directly.
 *
 * So these run end to end: build a club whose players carry the data, and
 * assert the badge comes out the far side. */
describe("facts the finale collects off the roster", () => {
  const COUNTRIES = [
    "USA",
    "Dominican Republic",
    "Venezuela",
    "Japan",
    "Cuba",
    "Canada",
    "Mexico",
  ];

  it("counts birth countries and Hall of Famers, and logs the countries", async () => {
    store.clear();
    const g = landedGame(
      card([
        player({
          pos: "SP",
          gs: 30,
          posG: { c: 0, if: 0, of: 0, dh: 0 },
          bc: "Curaçao",
          hof: true,
        }),
      ]),
    );
    let n = 0;
    for (let i = 0; i < 8; i++) {
      if (i === 5) continue; // the seat the card's pitcher signs into
      // Three inducted players; the skipper below is the fourth seat 🏛️ counts.
      g.slots[i] = filler(i, { bc: COUNTRIES[n++], hof: i < 3 });
    }
    hiredManager(g);
    g.manager!.hof = true;
    g.owner = { name: "x", budget: 100, franchise: "CHC", year: 2016, teamName: "Cubs" };
    g.stadium = { park: "y", mult: 1, franchise: "CHC", year: 2016 };
    g.powerups.tradeDeadline = "spent";
    // The signed player's country and plaque have to survive `makeSigned` —
    // the fillers are placed into slots directly and would not prove that.
    g.signPlayer(g.card!.players[0]);
    await vi.waitFor(() => expect(g.phase).toBe("finale"));

    expect(g.slots[5]!.bc).toBe("Curaçao");
    expect(g.slots[5]!.hof).toBe(true);
    // 3 inducted players + the skipper = the four 🏛️ asks for.
    expect(g.finale!.badges).toContain("hall");
    // 8 distinct countries, well past the five 🌎 asks for.
    expect(g.finale!.badges).toContain("worldtour");

    const [row] = JSON.parse(store.get("hotstove.history")!);
    expect(row.countries).toEqual([...COUNTRIES, "Curaçao"].sort());
  });

  /** A pitcher for the SP seat at index 5, so a signing can be the pick that
   * completes the club. */
  const arm = () =>
    player({ pos: "SP", gs: 30, posG: { c: 0, if: 0, of: 0, dh: 0 } });

  it("earns 🤝 only when the owner is hired after the roster is full", async () => {
    store.clear();
    const g = landedGame(card([arm()]));
    // A complete roster, a ballpark and a skipper, and no owner: the whole club
    // drafted without ever knowing the payroll.
    for (let i = 0; i < 8; i++) g.slots[i] = filler(i, { costPaid: 12 });
    g.stadium = { park: "y", mult: 1, franchise: "CHC", year: 2016 };
    hiredManager(g);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.powerups.tradeDeadline = "spent";
    expect(g.rosterFull).toBe(true);
    g.hireOwner(); // $96M against the card's $136.3M — under, and not pocketed
    expect(g.ownerHiredLast).toBe(true);
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    expect(g.finale!.badges).toContain("flyingblind");
  });

  it("does not earn 🤝 when the owner was hired along the way", async () => {
    store.clear();
    const g = landedGame(card([arm()]));
    // One seat still open when the owner signs, so the last pick knew the
    // budget — the same finished club, assembled in a different order.
    for (let i = 0; i < 8; i++) {
      if (i === 5) continue;
      g.slots[i] = filler(i, { costPaid: 12 });
    }
    g.stadium = { park: "y", mult: 1, franchise: "CHC", year: 2016 };
    hiredManager(g);
    expect(g.rosterFull).toBe(false);
    g.hireOwner();
    expect(g.ownerHiredLast).toBe(false);

    g.phase = "landed";
    g.choicesLeft = 1;
    g.powerups.tradeDeadline = "spent";
    g.signPlayer(g.card!.players[0]);
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    expect(g.finale!.badges).not.toContain("flyingblind");
  });
});

describe("seed reproducibility", () => {
  // Six distinct cards so the RNG walk has room to differ if it ever drifts.
  const seedIndex: GameIndex = {
    yearMin: 1985,
    yearMax: 2024,
    cards: [
      { team: "CHC", year: 2016, franchise: "CHC", name: "Chicago Cubs" },
      { team: "SEA", year: 2001, franchise: "SEA", name: "Seattle Mariners" },
      { team: "NYY", year: 2000, franchise: "NYY", name: "New York Yankees" },
      { team: "OAK", year: 2002, franchise: "OAK", name: "Oakland Athletics" },
      { team: "BOS", year: 2004, franchise: "BOS", name: "Boston Red Sox" },
      { team: "ATL", year: 1995, franchise: "ATL", name: "Atlanta Braves" },
    ],
  };

  function registerSeedCards(): void {
    for (const e of seedIndex.cards) {
      fetchCards[`${e.team}_${e.year}`] = card(
        [
          player({
            id: `${e.team}${e.year}`,
            pos: "1B",
            posG: { c: 0, if: 100, of: 0, dh: 0 },
          }),
        ],
        { team: e.team, year: e.year, franchise: e.franchise, name: e.name },
      );
    }
  }

  async function sequence(
    seed: number,
    act: (g: Game) => void,
    spins: number,
  ): Promise<string[]> {
    const g = new Game(meta, seedIndex, owners, seed);
    const seen: string[] = [];
    for (let i = 0; i < spins; i++) {
      g.spin();
      await g.land();
      seen.push(`${g.card!.team}_${g.card!.year}`);
      act(g);
      // Force the next spin regardless of what the action left behind — the
      // claim under test is that the RNG stream only advances inside spin().
      g.phase = "preSpin";
    }
    return seen;
  }

  it("same seed → same card sequence, regardless of player actions", async () => {
    registerSeedCards();
    const passive = await sequence(1234567, () => {}, 8);
    const active = await sequence(
      1234567,
      (g) => {
        const p = g.card!.players[0];
        if (g.playerState(p) === "open") g.signPlayer(p);
        else if (g.card!.manager && !g.manager) g.hireManager();
      },
      8,
    );
    expect(active).toEqual(passive);
    expect(new Set(passive).size).toBeGreaterThan(1); // the walk actually moves
  });
});

describe("yearPedigree", () => {
  const pedIndex: GameIndex = {
    yearMin: 1985,
    yearMax: 2024,
    cards: [
      {
        team: "ATL",
        year: 1991,
        franchise: "ATL",
        name: "Atlanta Braves",
        pen: true,
      },
      {
        team: "ATL",
        year: 1995,
        franchise: "ATL",
        name: "Atlanta Braves",
        ws: true,
      },
      { team: "ATL", year: 2003, franchise: "ATL", name: "Atlanta Braves" },
      { team: "MON", year: 1994, franchise: "WSN", name: "Montreal Expos" },
    ],
  };

  it("maps flagged years and omits plain ones", () => {
    const g = new Game(meta, pedIndex, owners, 1);
    expect(g.yearPedigree("ATL")).toEqual({ 1991: "pen", 1995: "ws" });
    expect(g.yearPedigree("WSN")).toEqual({});
  });
});

describe("index pedigree (real data)", () => {
  it("exactly one champion per year except strike-1994; SEA has no pennants", async () => {
    const real = (await import("../../data/index.json")) as unknown as {
      cards: {
        team: string;
        year: number;
        franchise: string;
        ws?: boolean;
        pen?: boolean;
      }[];
    };
    const champs = new Map<number, string>();
    for (const c of real.cards) if (c.ws) champs.set(c.year, c.team);
    // Every year the index carries has one champion and one pennant loser,
    // except strike-1994 — derived from the cards so the pin survives the
    // dataset gaining a season.
    const expectYears = [...new Set(real.cards.map((c) => c.year))]
      .sort((a, b) => a - b)
      .filter((y) => y !== 1994);
    expect([...champs.keys()].sort((a, b) => a - b)).toEqual(expectYears);
    expect(champs.get(2000)).toBe("NYY");
    // The Mariners have never won a pennant — data must agree, not flatter.
    expect(
      real.cards.some((c) => c.franchise === "SEA" && (c.ws || c.pen)),
    ).toBe(false);
    expect(real.cards.filter((c) => c.pen).length).toBe(expectYears.length);
  });
});

describe("mid-spin fetch failure", () => {
  const seaIndex: GameIndex = {
    yearMin: 1985,
    yearMax: 2024,
    cards: [
      { team: "SEA", year: 1995, franchise: "SEA", name: "Seattle Mariners" },
    ],
  };
  const seaCard = () =>
    card([player({})], {
      year: 1995,
      team: "SEA",
      franchise: "SEA",
      name: "Seattle Mariners",
    });

  it("a dropped fetch sets loadFailed instead of sticking the spin", async () => {
    delete fetchCards.SEA_1995;
    const g = new Game(meta, seaIndex, owners, 42);
    g.spin();
    expect(g.phase).toBe("spinning");
    await g.land();
    expect(g.loadFailed).toBe(true);
    expect(g.phase).toBe("spinning");
    expect(g.card).toBe(null);
  });

  it("retrySpin refetches (rejections aren't cached) and the game continues", async () => {
    delete fetchCards.SEA_1995;
    const g = new Game(meta, seaIndex, owners, 42);
    g.spin();
    await g.land();
    expect(g.loadFailed).toBe(true);
    fetchCards.SEA_1995 = seaCard(); // connection restored
    g.retrySpin();
    expect(g.loadFailed).toBe(false);
    await g.land();
    expect(g.loadFailed).toBe(false);
    expect(g.phase).toBe("landed");
    expect(g.card?.team).toBe("SEA");
    delete fetchCards.SEA_1995;
  });

  it("retrySpin is a no-op unless a fetch actually failed", () => {
    const g = new Game(meta, seaIndex, owners, 42);
    g.retrySpin();
    expect(g.phase).toBe("preSpin");
    expect(g.loadFailed).toBe(false);
  });
});

describe("Manager of the Year", () => {
  /** Fastest complete club: moneyball bank, full roster, hire the card's
   * manager — straight to the finale. */
  async function quickFinale(over: Partial<Card>): Promise<Game> {
    const g = new Game(meta, index, owners, 42, {
      difficulty: "standard",
      bank: "moneyball",
    });
    g.card = card([], over);
    g.phase = "landed";
    g.choicesLeft = 1;
    fillSlots(g);
    g.powerups.tradeDeadline = "spent";
    g.hireManager();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    return g;
  }

  it("hiring a MotY manager adds exactly +2 award points; the win column is untouched", async () => {
    const moty = await quickFinale({ managerMoty: true });
    const plain = await quickFinale({});
    expect(moty.manager?.moty).toBe(true);
    expect(plain.manager?.moty).toBe(false);
    expect(plain.finale!.parts.awardPoints).toBe(0); // filler roster, no hardware
    expect(moty.finale!.parts.awardPoints).toBe(2);
    expect(moty.finale!.parts.managerWins).toBe(
      plain.finale!.parts.managerWins,
    );
    expect(moty.finale!.parts.expectedWins).toBe(
      plain.finale!.parts.expectedWins,
    );
    expect(moty.finale!.parts.total).toBeCloseTo(
      plain.finale!.parts.total + 2,
      5,
    );
  });

  it("the dream team's manager maximizes netWins × 0.1 + the MotY bonus", async () => {
    // 103–58 MotY = 4.5 + 2 = 6.5 beats 95–67 plain = 5.6, even though the
    // plain skipper has more net wins — the bonus flips the pick. Fresh
    // team codes: loadCard memoizes, so reused pairs would serve stale cards.
    const motyCard = card([], {
      team: "TBM",
      year: 2015,
      franchise: "TBM",
      name: "Testburg Motys",
      managerMoty: true,
      wins: 103,
      losses: 58,
    });
    fetchCards.TBM_2015 = motyCard;
    fetchCards.PLN_2001 = card([], {
      team: "PLN",
      year: 2001,
      franchise: "PLN",
      name: "Plainville Nine",
      manager: "Lou Piniella",
      wins: 95,
      losses: 67,
    });
    const g = new Game(meta, index, owners, 42, {
      difficulty: "standard",
      bank: "moneyball",
    });
    g.card = motyCard;
    g.phase = "landed";
    g.choicesLeft = 1;
    g.seen = [
      { team: "TBM", year: 2015 },
      { team: "PLN", year: 2001 },
    ];
    fillSlots(g);
    g.powerups.tradeDeadline = "spent";
    g.hireManager();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    expect(g.finale!.bestManager).toMatchObject({
      name: "Joe Maddon",
      team: "TBM",
      year: 2015,
      netWins: 45,
      moty: true,
    });
    expect(g.finale!.managerHit).toBe(true); // hired him → a scouting hit
  });
});

describe("the dream-club ceiling", () => {
  const POS_IF = { c: 0, if: 100, of: 0, dh: 0 };
  const POS_OF = { c: 0, if: 0, of: 100, dh: 0 };
  const POS_C = { c: 100, if: 0, of: 0, dh: 0 };
  const NO_POS = { c: 0, if: 0, of: 0, dh: 0 };

  /** Six spun cards, each stacked with a star at every position. One pick per
   * card means the dream club can still only be six deep (plus the ✌️ Double
   * Play second pick), but every one of those picks beats the 3-WAR fillers the
   * roster below settles for. */
  function spinSixStackedCards(): void {
    for (let i = 0; i < 6; i++) {
      fetchCards[`CE${i}_2010`] = card(
        [
          player({ id: `c${i}`, pos: "C", posG: POS_C, war: 9, cost: 20 }),
          player({ id: `if${i}`, pos: "SS", posG: POS_IF, war: 9, cost: 20 }),
          player({ id: `of${i}`, pos: "CF", posG: POS_OF, war: 9, cost: 20 }),
          player({ id: `sp${i}`, pos: "SP", posG: NO_POS, gs: 30, war: 9, cost: 20 }),
          player({ id: `rp${i}`, pos: "RP", posG: NO_POS, relIP: 60, war: 9, cost: 20 }),
        ],
        {
          team: `CE${i}`,
          franchise: `CE${i}`,
          year: 2010,
          name: `Ceiling ${i}`,
          manager: "Skip Ceiling",
          wins: 100,
          losses: 62,
          budget: 60 + 10 * i,
          stadiumMult: 1,
        },
      );
    }
  }

  async function finishedGame(): Promise<Game> {
    spinSixStackedCards();
    const g = landedGame(fetchCards.CE0_2010);
    g.seen = [0, 1, 2, 3, 4, 5].map((i) => ({ team: `CE${i}`, year: 2010 }));
    fillSlots(g); // eight 3-WAR fillers at $10M — a club the cards easily beat
    g.owner = { name: "x", budget: 100, franchise: "CE0", year: 2010, teamName: "Ceiling 0" };
    g.stadium = { park: "y", mult: 1, franchise: "CE0", year: 2010 };
    g.powerups.tradeDeadline = "spent";
    g.hireManager();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    return g;
  }

  it("prints a ceiling at or above the total the player actually scored", async () => {
    const f = (await finishedGame()).finale!;
    expect(f.bestPossibleTotal).not.toBeNull();
    expect(f.bestPossibleTotal!).toBeGreaterThan(f.parts.total);
    expect(f.playedTheCeiling).toBe(false);
  });

  it("resolves the ceiling's record through the same ladder as the stamp", async () => {
    const f = (await finishedGame()).finale!;
    expect(f.bestPossibleRecord).toEqual(
      recordFromTotal(f.bestPossibleTotal!, GAMES, MARINERS_WINS),
    );
    expect(f.bestPossibleRecord!.wins + f.bestPossibleRecord!.losses).toBe(GAMES);
  });

  it("solves the front office too — the dream club has an owner and a ballpark", async () => {
    const f = (await finishedGame()).finale!;
    expect(f.best!.owner).not.toBeNull();
    expect(f.best!.park).not.toBeNull();
    expect(f.best!.budget).toBeCloseTo(f.best!.owner!.budget * f.best!.park!.mult, 6);
    // The payroll bonus is in the objective, so the dream club spends most of
    // the bankroll it chose rather than banking a WAR-max club on a fat cap.
    expect(f.best!.spend! / f.best!.budget!).toBeGreaterThan(0.5);
  });

  it("has no ceiling to print when the spun cards cannot be reloaded", async () => {
    const g = landedGame(
      card([player({ pos: "SP", gs: 30, posG: NO_POS, war: 5 })], {
        team: "GONE",
        franchise: "GONE",
        year: 1999,
      }),
    );
    g.seen = [{ team: "GONE", year: 1999 }]; // never registered with fetch
    fillSlots(g);
    g.owner = { name: "x", budget: 100, franchise: "GONE", year: 1999, teamName: "Gone" };
    g.stadium = { park: "y", mult: 1, franchise: "GONE", year: 1999 };
    g.powerups.tradeDeadline = "spent";
    g.hireManager();
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    const f = g.finale!;
    expect(f.best).toBeNull();
    expect(f.bestPossibleTotal).toBeNull();
    expect(f.bestPossibleRecord).toBeNull();
  });
});

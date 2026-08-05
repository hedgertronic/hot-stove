// @vitest-environment jsdom
/** ⭐ Prime Time hands a two-way season to the rail's slot picker.
 *
 * The career sheet has no nested picker — the rule every ⭐ path follows — so
 * a confirmed season eligible for MORE THAN ONE open seat type cannot resolve
 * inside the sheet. It resolves the way the market's own two-way signings do
 * (tests/twoway-slot.dom.test.ts): the sheet closes, the rail's seats arm
 * orange, the row shows ↑ PICK A SLOT, and the seat tap commits — at the PRIME
 * price, into the tapped chair.
 *
 * ⭐ is spent at that COMMIT, never at the handoff: a cancelled pick leaves the
 * powerup armed and the career browsable again. The P token is appended at the
 * commit too, carrying the chosen `si`, which is what lets `driveReplay` hand
 * the recorded seat straight back through `applyPrime(team, year, si)`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import PlayerList from "../src/components/PlayerList.svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

// The rail measures itself (bind:clientHeight) for its phone pin; jsdom has no
// ResizeObserver and the measurement is irrelevant to what this file asserts.
(globalThis as Record<string, unknown>).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// Career cards are fetched by team+year; keys here are unique to this file so
// data.ts's card cache cannot be tainted by (or taint) another suite.
const fetchCards: Record<string, Card> = {};
vi.stubGlobal("fetch", async (url: unknown) => {
  if (String(url).endsWith("data/specials.json"))
    return { ok: true, json: async () => ({}) };
  const m = String(url).match(/cards\/([A-Z0-9]+)_(\d{4})\.json$/);
  const c = m ? fetchCards[`${m[1]}_${m[2]}`] : undefined;
  return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
});

const FLEX = SLOT_TYPES.indexOf("FLEX"); // 4
const SP1 = SLOT_TYPES.indexOf("SP"); // 5
const SP2 = SP1 + 1; // 6

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: SLOT_TYPES,
  minBudget: 18.2,
  avgSlot8: { "2001": 87.5 },
  salaryFloor: { "2001": 0.5 },
  proration: {},
};

const index: GameIndex = {
  yearMin: 1985,
  yearMax: 2024,
  cards: [
    { team: "SEA", year: 2001, franchise: "SEA", name: "Seattle Mariners" },
    { team: "TWO", year: 2021, franchise: "TWO", name: "Two Way Club" },
    { team: "TWO", year: 2018, franchise: "TWO", name: "Two Way Club" },
    { team: "TWO", year: 2015, franchise: "TWO", name: "Two Way Club" },
  ],
};

const owners: Owners = { franchises: {} };

function player(over: Partial<CardPlayer> & { id: string; pos: string }): CardPlayer {
  return {
    name: "Shohei Ohtani",
    war: 9,
    cost: 20,
    awards: [],
    ws: false,
    pen: false,
    posG: { c: 0, if: 0, of: 0 },
    debut: "XXX",
    ...over,
  };
}

function card(team: string, year: number, players: CardPlayer[]): Card {
  return {
    year,
    team,
    franchise: team,
    name: `${team} club`,
    park: "Ballpark",
    wins: 90,
    losses: 72,
    manager: "Skipper",
    ws: false,
    pen: false,
    attendance: 2_000_000,
    attendancePct: 0.9,
    stadiumMult: 1,
    budget: 90,
    prorated: 1,
    players,
  };
}

/** A landed game with ⭐ armed and the listed man's career open in the sheet.
 * `listedPos` is the season the reel landed on; the career season lives on the
 * TWO card the sheet confirms. */
function primed(listedPos: string, careerYear = 2021, careerPos = "SP/DH") {
  const listed = player({ id: "two_way", pos: listedPos });
  const season = player({ id: "two_way", pos: careerPos, war: 9.5, cost: 24 });
  fetchCards[`TWO_${careerYear}`] = card("TWO", careerYear, [season]);

  const g = new Game(meta, index, owners, 42);
  g.card = card("SEA", 2001, [listed]);
  g.phase = "landed";
  g.choicesLeft = 1;
  g.choicesUsed = 0;
  g.powerups.prime = "armed";
  g.primeTapPlayer(listed);
  return { g, listed, season, careerYear };
}

let target: HTMLElement;
beforeEach(() => {
  store.clear();
  target = document.createElement("div");
  document.body.appendChild(target);
});
afterEach(() => {
  target.remove();
});

function mountList(game: Game) {
  const comp = mount(PlayerList, {
    target,
    props: { game, confirmKey: null, setConfirm: () => {} },
  });
  flushSync();
  return comp;
}

function mountRail(game: Game) {
  const comp = mount(RosterRail, { target, props: { game } });
  flushSync();
  return comp;
}

describe("prime a two-way season with two open seat types", () => {
  it("hands off instead of signing: sheet closed, rail armed, nothing committed", async () => {
    const { g } = primed("SP/DH");
    const ok = await g.applyPrime("TWO", 2021);

    expect(ok).toBe(false); // nothing committed — this is a handoff
    expect(g.primeSlotPending).toBe(true);
    expect(g.primePick).toBeNull(); // the sheet closes
    expect(g.slotPick).toBe("two_way"); // the rail asks
    expect(g.pickableSlotCells(g.card!.players[0])).toEqual([FLEX, SP1, SP2]);
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.choicesLeft).toBe(1);
    expect(g.decisionLog).toEqual([]);
    // Spent at the commit, not at the handoff.
    expect(g.powerups.prime).toBe("armed");
  });

  it("the pending row shows the PICK A SLOT hint", async () => {
    const { g } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    const comp = mountList(g);
    expect(target.textContent).toContain("PICK A SLOT");
    unmount(comp);
  });

  it("the rail arms exactly the three eligible seats", async () => {
    const { g } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    const comp = mountRail(g);
    const armed = target.querySelectorAll("button.cell.pickable");
    expect(armed.length).toBe(3);
    unmount(comp);
  });

  it("a rail tap seats the PRIMED season, at the prime price, in the tapped chair", async () => {
    const { g, season } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.signPlayer(g.card!.players[0], FLEX);

    expect(g.slots[FLEX]?.id).toBe("two_way");
    expect(g.slots[FLEX]?.year).toBe(2021); // the career season, not the landed one
    expect(g.slots[FLEX]?.team).toBe("TWO");
    expect(g.slots[FLEX]?.costPaid).toBe(g.primePriceFor(season, "TWO"));
    expect(g.slots.filter((s) => s !== null).length).toBe(1);
    expect(g.powerups.prime).toBe("spent");
    expect(g.primeSlotPending).toBe(false);
    expect(g.slotPick).toBeNull();
    expect(g.choicesUsed).toBe(1);
  });

  it("the other chair is just as available — the seat tap is the choice", async () => {
    const { g } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.signPlayer(g.card!.players[0], SP1);
    expect(g.slots[SP1]?.id).toBe("two_way");
    expect(g.slots[FLEX]).toBeNull();
  });

  it("clicking the armed seat in the rail commits it", async () => {
    const { g } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    const comp = mountRail(g);
    const armed = target.querySelectorAll<HTMLButtonElement>("button.cell.pickable");
    armed[armed.length - 1].click(); // the last armed chair is SP2
    flushSync();
    expect(g.slots[SP2]?.id).toBe("two_way");
    expect(g.powerups.prime).toBe("spent");
    unmount(comp);
  });

  it("the P token is appended at the commit, carrying the chosen seat", async () => {
    const { g } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    expect(g.decisionLog).toEqual([]);
    g.signPlayer(g.card!.players[0], SP2);
    expect(g.decisionLog).toEqual([{ verb: "P", ci: 1, pi: 0, si: SP2 }]);
  });

  it("the armed seats come from the PRIMED season, not the listed one", async () => {
    // Listed as a DH (FLEX only); the 2018 season is the two-way one.
    const { g, listed } = primed("DH", 2018);
    expect(g.pickableSlotCells(listed)).toEqual([FLEX]);
    await g.applyPrime("TWO", 2018);
    expect(g.pickableSlotCells(listed)).toEqual([FLEX, SP1, SP2]);
    g.signPlayer(listed, SP1);
    expect(g.slots[SP1]?.id).toBe("two_way");
  });
});

describe("cancelling a pending prime seat pick", () => {
  it("spends nothing and leaves ⭐ armed and the career browsable", async () => {
    const { g, listed } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.cancelPick();

    expect(g.primeSlotPending).toBe(false);
    expect(g.slotPick).toBeNull();
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.powerups.prime).toBe("armed");
    expect(g.choicesLeft).toBe(1);
    expect(g.decisionLog).toEqual([]);
    expect(g.primeBrowsable(listed)).toBe(true);
  });

  it("a cancelled pick can be primed again and committed", async () => {
    const { g, listed } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.cancelPick();
    g.primeTapPlayer(listed);
    await g.applyPrime("TWO", 2021);
    g.signPlayer(listed, FLEX);
    expect(g.slots[FLEX]?.id).toBe("two_way");
    expect(g.powerups.prime).toBe("spent");
  });

  it("the dropped season is gone: a later sign takes the LANDED one", async () => {
    const { g, listed } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.cancelPick();
    // The rail no longer offers anything here (slotPick is null), so this is
    // the plain market path — and it must sign the season the reel landed on.
    g.signPlayer(listed, SP1);
    expect(g.slots[SP1]?.year).toBe(2001);
    expect(g.powerups.prime).not.toBe("spent"); // the handoff cost nothing
  });

  it("browsing another career abandons the pending pick, ⭐ unspent", async () => {
    const other = player({ id: "other_man", pos: "C", name: "Backstop" });
    other.posG = { c: 100, if: 0, of: 0 };
    const { g } = primed("SP/DH");
    g.card!.players.push(other);
    await g.applyPrime("TWO", 2021);

    g.primeTapPlayer(other);
    expect(g.primeSlotPending).toBe(false);
    expect(g.slotPick).toBeNull();
    expect(g.primePick).toBe("other_man");
    expect(g.powerups.prime).toBe("armed");
  });
});

describe("a powerup toggle while the board is prompting for the seat", () => {
  it("disarming ⭐ abandons the pick: no sign, no token, powerup re-armable", async () => {
    const { g, listed } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.togglePrime();

    expect(g.primeSlotPending).toBe(false);
    expect(g.slotPick).toBeNull();
    expect(g.primePick).toBeNull();
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.decisionLog).toEqual([]);
    expect(g.choicesLeft).toBe(1);
    expect(g.choicesUsed).toBe(0);
    expect(g.powerups.prime).toBe("ready"); // re-armable, never spent
    // Re-arming brings the whole path back.
    g.togglePrime();
    expect(g.powerups.prime).toBe("armed");
    expect(g.primeBrowsable(listed)).toBe(true);
  });

  it("the rail disarms with it — no seat is armed after the disarm", async () => {
    const { g } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.togglePrime();
    const comp = mountRail(g);
    expect(target.querySelectorAll("button.cell.pickable").length).toBe(0);
    unmount(comp);
  });

  it("no dangling season: an ordinary sign after the disarm takes the LANDED one", async () => {
    const { g, listed } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.togglePrime();
    g.signPlayer(listed, FLEX);
    expect(g.slots[FLEX]?.year).toBe(2001);
    expect(g.decisionLog).toEqual([{ verb: "S", pi: 0, si: FLEX }]);
  });

  it("arming another powerup abandons it too — the price it was confirmed at is gone", async () => {
    const { g } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.toggleHometown();
    expect(g.primeSlotPending).toBe(false);
    expect(g.slotPick).toBeNull();
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.powerups.prime).toBe("armed");
    expect(g.powerups.hometown).toBe("armed");
  });

  it("🔁 does the same", async () => {
    const { g } = primed("SP/DH");
    await g.applyPrime("TWO", 2021);
    g.toggleTradeDeadline();
    expect(g.primeSlotPending).toBe(false);
    expect(g.slotPick).toBeNull();
    expect(g.slots.every((s) => s === null)).toBe(true);
  });

  it("an undo taken while prompting leaves nothing pending", async () => {
    const other = player({ id: "other_man", pos: "C", name: "Backstop", war: 3 });
    other.posG = { c: 100, if: 0, of: 0 };
    const { g, listed } = primed("SP/DH");
    g.card!.players.push(other);
    g.choicesLeft = 2; // as a ✌️ Double Play spin leaves it

    g.powerups.prime = "ready";
    g.signPlayer(other); // a committed move, so there is an undo point
    g.powerups.prime = "armed";
    g.primeTapPlayer(listed);
    await g.applyPrime("TWO", 2021);
    expect(g.primeSlotPending).toBe(true);

    g.undo();
    expect(g.primeSlotPending).toBe(false);
    expect(g.slotPick).toBeNull();
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.powerups.prime).not.toBe("spent");
  });
});

describe("a reload while the board is prompting for the seat", () => {
  it("restores to the base landed state: nothing pending, ⭐ still available", async () => {
    // The landed card has to be fetchable for restore() to put it back.
    const listed = player({ id: "reload_man", pos: "SP/DH" });
    const season = player({ id: "reload_man", pos: "SP/DH", war: 9.5 });
    fetchCards["SEA_2001"] = card("SEA", 2001, [listed]);
    fetchCards["TWO_2011"] = card("TWO", 2011, [season]);
    const idx: GameIndex = {
      ...index,
      cards: [...index.cards, { team: "TWO", year: 2011, franchise: "TWO", name: "Two Way Club" }],
    };

    const g = new Game(meta, idx, owners, 42);
    g.card = fetchCards["SEA_2001"];
    g.phase = "landed";
    g.choicesLeft = 1;
    g.powerups.prime = "armed";
    g.primeTapPlayer(listed);
    await g.applyPrime("TWO", 2011); // handoff — and it saves
    expect(g.primeSlotPending).toBe(true);

    const back = await Game.restore(meta, idx, owners);
    expect(back).not.toBeNull();
    expect(back!.primeSlotPending).toBe(false);
    expect(back!.slotPick).toBeNull();
    expect(back!.primePick).toBeNull();
    expect(back!.slots.every((s) => s === null)).toBe(true);
    expect(back!.decisionLog).toEqual([]);
    expect(back!.choicesLeft).toBe(1);
    expect(back!.powerups.prime).toBe("ready"); // put down by the reload, not spent
  });
});

describe("one open seat type still commits straight from the sheet", () => {
  it("only the pitcher seats open: no handoff", async () => {
    const { g } = primed("SP/DH");
    g.slots[FLEX] = {
      id: "filler", name: "Filler", pos: "1B", war: 2, awards: [], ws: false,
      pen: false, year: 2001, team: "SEA", teamName: "Seattle", franchise: "SEA",
      costPaid: 5, hero: false, prorated: 1,
    };
    const ok = await g.applyPrime("TWO", 2021);
    expect(ok).toBe(true);
    expect(g.primeSlotPending).toBe(false);
    expect(g.slotPick).toBeNull();
    expect(g.slots[SP1]?.id).toBe("two_way");
    expect(g.powerups.prime).toBe("spent");
    expect(g.decisionLog).toEqual([{ verb: "P", ci: 1, pi: 0, si: SP1 }]);
  });

  it("an ordinary one-position season: no handoff", async () => {
    const listed = player({ id: "solo_c", pos: "C", name: "Backstop" });
    listed.posG = { c: 100, if: 0, of: 0 };
    const season = player({ id: "solo_c", pos: "C", name: "Backstop" });
    season.posG = { c: 100, if: 0, of: 0 };
    fetchCards["TWO_2015"] = card("TWO", 2015, [season]);

    const g = new Game(meta, index, owners, 42);
    g.card = card("SEA", 2001, [listed]);
    g.phase = "landed";
    g.choicesLeft = 1;
    g.powerups.prime = "armed";
    g.primeTapPlayer(listed);

    const ok = await g.applyPrime("TWO", 2015);
    expect(ok).toBe(true);
    expect(g.slots[0]?.id).toBe("solo_c");
  });
});

describe("an explicit seat (the replay driver's path) skips the handoff", () => {
  it("applyPrime with the recorded si commits straight into it", async () => {
    const { g } = primed("SP/DH");
    const ok = await g.applyPrime("TWO", 2021, SP2);
    expect(ok).toBe(true);
    expect(g.slots[SP2]?.id).toBe("two_way");
    expect(g.primeSlotPending).toBe(false);
    expect(g.decisionLog).toEqual([{ verb: "P", ci: 1, pi: 0, si: SP2 }]);
  });

  it("a seat the season cannot take is refused, and nothing hands off", async () => {
    const { g } = primed("SP/DH");
    const ok = await g.applyPrime("TWO", 2021, 0); // the C seat
    expect(ok).toBe(false);
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.primeSlotPending).toBe(false);
  });
});

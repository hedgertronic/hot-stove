/** Self-season Trade Deadline swap.
 *
 * The Trade Deadline allows swapping a rostered player's season for a
 * DIFFERENT season of the same person from the current card: same player id,
 * different (team, year) pair. The end state holds exactly one copy of the
 * player (new season replaces old).
 *
 * Four cases:
 *   ALLOW  — same person, different season
 *   BLOCK  — same person, same season (would create a duplicate)
 *   BLOCK  — plain SIGN of a rostered person (isRostered blocks normal sign path)
 *   BLOCK  — releasing a different squad member's slot for a rostered player
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Game, SLOT_TYPES, type Signed } from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// A stable player who appears on two different seasonal cards.
const SELF_PLAYER: CardPlayer = {
  id: "ohtansh01",
  name: "Shohei Ohtani",
  pos: "DH",
  war: 9,
  cost: 30,
  awards: [],
  ws: false,
  pen: false,
  posG: { c: 0, if: 100, of: 0 }, // eligible for IF slots
  debut: "AAA",
};

// A second player who occupies a slot (for the "wrong slot" test).
const OTHER_PLAYER: CardPlayer = {
  id: "zother01",
  name: "Other Player",
  pos: "1B",
  war: 4,
  cost: 10,
  awards: [],
  ws: false,
  pen: false,
  posG: { c: 0, if: 100, of: 0 },
  debut: "AAA",
};

function makeCard(team: string, year: number, players: CardPlayer[]): Card {
  return {
    year,
    team,
    franchise: team,
    name: `${team} ${year}`,
    park: `${team} Park`,
    wins: 90,
    losses: 72,
    manager: `${team} Skipper`,
    ws: false,
    pen: false,
    attendance: 2_000_000,
    attendancePct: 0.7,
    stadiumMult: 1.1,
    budget: 130,
    prorated: 1,
    players,
  };
}

// Card set: two seasons of Ohtani on different cards.
const CARD_AAA_2001 = makeCard("AAA", 2001, [SELF_PLAYER]);
const CARD_AAA_2003 = makeCard("AAA", 2003, [SELF_PLAYER]);
// A separate card with the other player only.
const CARD_BBB_2002 = makeCard("BBB", 2002, [OTHER_PLAYER]);
// Filler cards so the index is wide enough for the engine.
const CARD_CCC_2004 = makeCard("CCC", 2004, [{ ...SELF_PLAYER, id: "filler01" }]);

const CARDS = [CARD_AAA_2001, CARD_AAA_2003, CARD_BBB_2002, CARD_CCC_2004];
const byKey = new Map(CARDS.map((c) => [`${c.team}_${c.year}`, c]));

vi.stubGlobal("fetch", async (url: unknown) => {
  const m = String(url).match(/cards\/([A-Z0-9]+)_(\d{4})\.json$/);
  const c = m ? byKey.get(`${m[1]}_${m[2]}`) : undefined;
  return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
});

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: SLOT_TYPES,
  minBudget: 18.2,
  avgSlot8: { "2001": 87497175 },
  salaryFloor: { "2001": 508500 },
  proration: {},
};

const index: GameIndex = {
  yearMin: 2001,
  yearMax: 2004,
  cards: CARDS.map((c) => ({
    team: c.team,
    year: c.year,
    franchise: c.franchise,
    name: c.name,
  })),
};

const owners: Owners = {
  franchises: Object.fromEntries(
    CARDS.map((c) => [
      c.franchise,
      { name: c.name, owners: [{ name: "The Group", from: 1900, to: null }] },
    ]),
  ),
};

function filler(i: number): Signed {
  return {
    id: `filler_slot${i}`,
    name: `Filler Slot ${i}`,
    pos: SLOT_TYPES[i],
    war: 1,
    awards: [],
    ws: false,
    pen: false,
    year: 2001,
    team: "AAA",
    teamName: "AAA 2001",
    franchise: "AAA",
    costPaid: 5,
    hero: false,
    prorated: 1,
  };
}

/** Set up a game standing on AAA_2003 (Ohtani 2003) with Ohtani 2001 already
 * rostered in slot 1 (IF seat) and Trade Deadline armed. */
async function gameWithSelfOnCard(): Promise<Game> {
  const g = new Game(meta, index, owners, 42);
  // Manually force the card to AAA_2003 (the newer season).
  g.card = CARD_AAA_2003;
  g.phase = "landed" as any;
  g.choicesLeft = 1;
  g.choicesUsed = 0;

  // Seat Ohtani 2001 in slot 1 (the first IF slot).
  g.slots[1] = {
    id: "ohtansh01",
    name: "Shohei Ohtani",
    pos: "DH",
    war: 9,
    awards: [],
    ws: false,
    pen: false,
    year: 2001,
    team: "AAA",
    teamName: "AAA 2001",
    franchise: "AAA",
    costPaid: 25,
    hero: false,
    prorated: 1,
  };

  g.toggleTradeDeadline();
  return g;
}

beforeEach(() => store.clear());

describe("self-season swap (ALLOW)", () => {
  it("player is visible and the game is not a cold stove (no free respin)", async () => {
    const g = await gameWithSelfOnCard();
    // The card is AAA_2003 which contains SELF_PLAYER (war: 9 ≥ 0, always visible).
    expect(g.visiblePlayers.some((p) => p.id === "ohtansh01")).toBe(true);
    // With a valid self-trade candidate, the game must not be a cold stove —
    // a cold stove here would trigger a free respin, swallowing the trade.
    expect(g.anyActionable()).toBe(true);
    expect(g.coldStove).toBe(false);
  });

  it("allows trading Ohtani 2001 → Ohtani 2003 via completeSwap", async () => {
    const g = await gameWithSelfOnCard();
    expect(g.powerups.tradeDeadline).toBe("armed");

    // Ohtani 2003 on the card IS rostered (ohtansh01 is in slot 1 as 2001)
    expect(g.isRostered(SELF_PLAYER)).toBe(true);
    // But tdCandidate should be true because it's a different season.
    expect(g.tdCandidate(SELF_PLAYER)).toBe(true);

    const before_year = g.slots[1]!.year;
    expect(before_year).toBe(2001);

    // Tap the player — should auto-complete (only one self-slot).
    g.tdTapPlayer(SELF_PLAYER);

    // Slot 1 should now hold Ohtani 2003, not 2001.
    expect(g.slots[1]!.id).toBe("ohtansh01");
    expect(g.slots[1]!.year).toBe(2003);
    // No duplicate: exactly one copy of ohtansh01 on the roster.
    const copies = g.slots.filter((s) => s?.id === "ohtansh01");
    expect(copies).toHaveLength(1);
    // TD is spent.
    expect(g.powerups.tradeDeadline).toBe("spent");
  });

  it("reports releasePick as null (auto-complete, no picker needed)", async () => {
    const g = await gameWithSelfOnCard();
    g.tdTapPlayer(SELF_PLAYER);
    // Auto-completed: releasePick was never set.
    expect(g.releasePick).toBeNull();
  });
});

describe("self-season swap (BLOCK — same season)", () => {
  it("blocks trading the exact same (player, year, team) into its own slot", async () => {
    const g = new Game(meta, index, owners, 42);
    // Card is AAA_2001 — same year as the rostered copy.
    g.card = CARD_AAA_2001;
    g.phase = "landed" as any;
    g.choicesLeft = 1;
    g.choicesUsed = 0;
    // Ohtani 2001 is already in slot 1.
    g.slots[1] = {
      id: "ohtansh01",
      name: "Shohei Ohtani",
      pos: "DH",
      war: 9,
      awards: [],
      ws: false,
      pen: false,
      year: 2001,
      team: "AAA",
      teamName: "AAA 2001",
      franchise: "AAA",
      costPaid: 25,
      hero: false,
      prorated: 1,
    };
    g.toggleTradeDeadline();

    // tdCandidate must be false: same season as what is rostered.
    expect(g.tdCandidate(SELF_PLAYER)).toBe(false);

    const slotsBefore = JSON.stringify(g.slots);
    g.tdTapPlayer(SELF_PLAYER);
    // No change.
    expect(JSON.stringify(g.slots)).toBe(slotsBefore);
  });
});

describe("plain SIGN of a rostered person (BLOCK)", () => {
  it("still refuses a plain sign when Trade Deadline is disarmed", async () => {
    const g = await gameWithSelfOnCard();
    // Disarm TD so the card is in plain-sign mode.
    g.toggleTradeDeadline();
    expect(g.powerups.tradeDeadline).toBe("ready");

    // playerState for a rostered player is "dead" — signPlayer refuses it.
    expect(g.playerState(SELF_PLAYER)).toBe("dead");
    const slotsBefore = JSON.stringify(g.slots);
    g.signPlayer(SELF_PLAYER);
    expect(JSON.stringify(g.slots)).toBe(slotsBefore);
  });
});

describe("wrong-slot block for self-trade", () => {
  it("blocks tdRelease into a slot occupied by a DIFFERENT player", async () => {
    const g = await gameWithSelfOnCard();
    // Also fill slot 2 with OTHER_PLAYER.
    g.slots[2] = {
      id: "zother01",
      name: "Other Player",
      pos: "1B",
      war: 4,
      awards: [],
      ws: false,
      pen: false,
      year: 2002,
      team: "BBB",
      teamName: "BBB 2002",
      franchise: "BBB",
      costPaid: 10,
      hero: false,
      prorated: 1,
    };

    // With two IF-eligible occupied slots, tapping should open a picker
    // (releasePick = SELF_PLAYER.id).
    // But for a SELF-trade, only slot 1 (Ohtani's OWN slot) is valid.
    // Slot 2 holds OTHER_PLAYER — tdRelease there must be refused.
    const savedRelease = g.releasePick;
    // Simulate what tdTapPlayer would do: set releasePick manually
    // (since in this test there may be exactly one selfTradeSlot, so it
    // auto-completes; we test tdRelease directly to verify the guard).
    g.releasePick = SELF_PLAYER.id;
    const slotsBefore = JSON.stringify(g.slots);

    // Attempt to release slot 2 — this is OTHER_PLAYER's slot, not Ohtani's.
    g.tdRelease(SELF_PLAYER, 2);

    // Must have been blocked — slot 2 still holds OTHER_PLAYER.
    expect(g.slots[2]?.id).toBe("zother01");
    // releasePick is still set (not consumed by a blocked call).
    expect(g.releasePick).toBe(SELF_PLAYER.id);

    // But slot 1 IS the valid slot — tdRelease there should succeed.
    g.tdRelease(SELF_PLAYER, 1);
    expect(g.slots[1]!.id).toBe("ohtansh01");
    expect(g.slots[1]!.year).toBe(2003);
  });
});

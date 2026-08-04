/** Round 28: 🏠 Homegrown discount travels to ⭐ Prime Time (per-season rule).
 *
 * The discount is PER SEASON, not per player. A career-sheet season signs at
 * $1M only when the season card's FRANCHISE matches the player's debut
 * franchise. On an A's card with 🏠 armed, McGwire's Oakland seasons get the
 * $1M; his Cardinals seasons pay full price. The check is
 * `primeDiscountEligible(p, card.franchise)` — the season's franchise id,
 * NOT the landed card and NOT the team code (see the renamed-club describe).
 *
 * When a season is discounted:
 *   - `makeSigned` receives discounted=true → hero=true on the slot
 *   - `spendPowerup("hometown")` is called before `consumeChoice`
 *   - prime powerup is always spent regardless
 *
 * PrimePicker display also routes through
 * `game.primePriceFor(sea.p, sea.franchise)` so the $1M price shows before
 * the player clicks — verified via the method directly. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Game,
  HOMEGROWN_PRICE_M,
  SLOT_TYPES,
  type Signed,
} from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

// Stub storage
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// Stub fetch: each key is a team+year code like "OAK_1987".
// Using unique keys per describe avoids the data.ts card cache tainting tests.
const fetchCards: Record<string, Card> = {};
vi.stubGlobal("fetch", async (url: unknown) => {
  if (String(url).endsWith("data/specials.json"))
    return { ok: true, json: async () => ({}) };
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
  cards: [{ team: "OAK", year: 2001, franchise: "OAK", name: "Oakland Athletics" }],
};

const owners: Owners = { franchises: {} };

let pid = 0;

function player(over: Partial<CardPlayer>): CardPlayer {
  return {
    id: `p${pid++}`,
    name: "Test Player",
    pos: "C",
    war: 3,
    warRaw: 3,
    cost: 20, // above HOMEGROWN_PRICE_M so the discount matters
    contract: 3,
    salary: 20_000_000,
    est: false,
    awards: [],
    ws: false,
    pen: false,
    pa: 400,
    gs: 0,
    relIP: 0,
    posG: { c: 120, if: 0, of: 0, dh: 0 }, // catcher — single C slot, no ambiguity
    debut: "OAK",
    teams: ["OAK"],
    ...over,
  };
}

function oakCard(year: number, players: CardPlayer[]): Card {
  return {
    year, team: "OAK", franchise: "OAK", name: "Oakland Athletics",
    park: "Oakland Coliseum", wins: 99, losses: 63, manager: "Tony La Russa",
    ws: false, pen: false, attendance: 2_500_000, attendancePct: 0.9,
    stadiumMult: 1.0, budget: 70, budgetRaw: 0, contracts: [], prorated: 1,
    players,
  };
}

function stlCard(year: number, players: CardPlayer[]): Card {
  return {
    year, team: "STL", franchise: "STL", name: "St. Louis Cardinals",
    park: "Busch Stadium", wins: 83, losses: 79, manager: "Tony La Russa",
    ws: false, pen: false, attendance: 3_000_000, attendancePct: 0.9,
    stadiumMult: 1.0, budget: 80, budgetRaw: 0, contracts: [], prorated: 1,
    players,
  };
}

function primedHometown(landedCard: Card): Game {
  const g = new Game(meta, index, owners, 42);
  g.card = landedCard;
  g.phase = "landed";
  g.choicesLeft = 1;
  g.choicesUsed = 0;
  g.powerups.prime = "armed";
  g.powerups.hometown = "armed";
  return g;
}

function filler(i: number, over: Partial<Signed> = {}): Signed {
  return {
    id: `f${i}`,
    name: "Filler",
    pos: "1B",
    war: 2,
    awards: [],
    ws: false,
    pen: false,
    year: 2000,
    team: "OAK",
    teamName: "Athletics",
    franchise: "OAK",
    costPaid: 5,
    hero: false,
    prorated: 1,
    ...over,
  };
}

beforeEach(() => {
  store.clear();
  pid = 0;
  for (const key of Object.keys(fetchCards)) delete fetchCards[key];
});

describe("prime + hometown: eligible season (seasonTeam === debut franchise)", () => {
  // Career season registered under "OAK_1987" so applyPrime("OAK", 1987) fetches it.
  // seasonTeam "OAK" === p.debut "OAK" → primeDiscountEligible → $1M.
  // Unique player ID "mgw_elig" avoids data.ts card-cache collisions with other describes.
  function cleanSetup() {
    const mcgwire = player({ id: "mgw_elig", debut: "OAK" });
    const landedCard = oakCard(2001, [mcgwire]);

    const oakSeason = player({ id: "mgw_elig", debut: "OAK" });
    fetchCards["OAK_1987"] = oakCard(1987, [oakSeason]);

    const g = primedHometown(landedCard);
    g.primeTapPlayer(mcgwire);
    return { g, mcgwire, oakSeason };
  }

  it("applyPrime signs at $1M (HOMEGROWN_PRICE_M)", async () => {
    const { g } = cleanSetup();
    const ok = await g.applyPrime("OAK", 1987);
    expect(ok).toBe(true);
    expect(g.slots[0]?.costPaid).toBe(HOMEGROWN_PRICE_M);
  });

  it("signed slot has hero=true", async () => {
    const { g } = cleanSetup();
    await g.applyPrime("OAK", 1987);
    expect(g.slots[0]?.hero).toBe(true);
  });

  it("hometown powerup is spent", async () => {
    const { g } = cleanSetup();
    await g.applyPrime("OAK", 1987);
    expect(g.powerups.hometown).toBe("spent");
  });

  it("prime powerup is spent", async () => {
    const { g } = cleanSetup();
    await g.applyPrime("OAK", 1987);
    expect(g.powerups.prime).toBe("spent");
  });

  it("primePriceFor returns $1M for an OAK season of an OAK-debut player", () => {
    const { g, oakSeason } = cleanSetup();
    expect(g.primePriceFor(oakSeason, "OAK")).toBe(HOMEGROWN_PRICE_M);
  });
});

describe("prime + hometown: ineligible season (seasonTeam !== debut franchise)", () => {
  // Career key STL_1998 — different franchise from debut "OAK" → full price.
  function cleanSetup() {
    const mcgwire = player({ id: "mgw_inelig", debut: "OAK" });
    const landedCard = oakCard(2001, [mcgwire]);

    // STL career season: seasonTeam "STL" !== debut "OAK" → full price
    const stlSeason = player({ id: "mgw_inelig", debut: "OAK", cost: 25 });
    fetchCards["STL_1998"] = stlCard(1998, [stlSeason]);

    const g = primedHometown(landedCard);
    g.primeTapPlayer(mcgwire);
    return { g, mcgwire, stlSeason };
  }

  it("applyPrime signs at list price (not $1M)", async () => {
    const { g, stlSeason } = cleanSetup();
    const ok = await g.applyPrime("STL", 1998);
    expect(ok).toBe(true);
    expect(g.slots[0]?.costPaid).toBe(stlSeason.cost); // $25M list
  });

  it("hero is false for the ineligible season", async () => {
    const { g } = cleanSetup();
    await g.applyPrime("STL", 1998);
    expect(g.slots[0]?.hero).toBe(false);
  });

  it("hometown powerup reverts to ready (endSpin resets unarmed)", async () => {
    // hometown was armed, not spent → endSpin resets armed→ready
    const { g } = cleanSetup();
    await g.applyPrime("STL", 1998);
    expect(g.powerups.hometown).toBe("ready");
  });

  it("prime powerup is spent", async () => {
    const { g } = cleanSetup();
    await g.applyPrime("STL", 1998);
    expect(g.powerups.prime).toBe("spent");
  });

  it("primePriceFor returns list price for a STL season of an OAK-debut player", () => {
    const { g, stlSeason } = cleanSetup();
    expect(g.primePriceFor(stlSeason, "STL")).toBe(stlSeason.cost);
  });
});

describe("WBC pedigree counts use ID constants, not scoring points", () => {
  it("a slot with wbc=2 (WBC_CHAMPION_ID) counts as a champion", () => {
    const g = new Game(meta, index, owners, 42);
    g.slots[0] = filler(0, { wbc: 2 });
    expect(g.pedigree.wbcChampions).toBe(1);
    expect(g.pedigree.wbcRunnersUp).toBe(0);
  });

  it("a slot with wbc=1 (WBC_RUNNERUP_ID) counts as a runner-up", () => {
    const g = new Game(meta, index, owners, 42);
    g.slots[0] = filler(0, { wbc: 1 });
    expect(g.pedigree.wbcChampions).toBe(0);
    expect(g.pedigree.wbcRunnersUp).toBe(1);
  });

  it("pedigree counts work correctly after scoring constants changed to 1.5/0.5", () => {
    // Regression guard: if pedigree used WBC_CHAMPION_POINTS (1.5) as the
    // discriminant instead of WBC_CHAMPION_ID (2), this count would be 0.
    const g = new Game(meta, index, owners, 42);
    g.slots[0] = filler(0, { wbc: 2 });
    g.slots[1] = filler(1, { wbc: 1 });
    g.slots[2] = filler(2, { wbc: 2 });
    expect(g.pedigree.wbcChampions).toBe(2);
    expect(g.pedigree.wbcRunnersUp).toBe(1);
  });
});


describe("prime + hometown: renamed club (team code differs from franchise id)", () => {
  // THE BUG THIS PINS: comparing the season's TEAM CODE to `p.debut` prices
  // every Angels season at list even with 🏠 armed, because debut is a
  // FRANCHISE id ("ANA") and the 1986 card's team code is "CAL". Witnessed
  // live on the 1986 California Angels card before the fix. The eligible
  // value is the season card's `franchise`, which survives renames.
  function calCard(year: number, players: CardPlayer[]): Card {
    return {
      year, team: "CAL", franchise: "ANA", name: "California Angels",
      park: "Anaheim Stadium", wins: 92, losses: 70, manager: "Gene Mauch",
      ws: false, pen: false, attendance: 2_600_000, attendancePct: 0.9,
      stadiumMult: 1.0, budget: 60, budgetRaw: 0, contracts: [], prorated: 1,
      players,
    };
  }

  function cleanSetup() {
    const witt = player({ id: "witt_cal", debut: "ANA", teams: ["CAL"] });
    const landedCard = calCard(1986, [witt]);
    const calSeason = player({ id: "witt_cal", debut: "ANA", teams: ["CAL"] });
    fetchCards["CAL_1985"] = calCard(1985, [calSeason]);
    const g = primedHometown(landedCard);
    g.primeTapPlayer(witt);
    return { g, witt, calSeason };
  }

  it("applyPrime signs a CAL season at $1M off the card's ANA franchise", async () => {
    const { g } = cleanSetup();
    expect(await g.applyPrime("CAL", 1985)).toBe(true);
    expect(g.slots[0]?.costPaid).toBe(HOMEGROWN_PRICE_M);
    expect(g.powerups.hometown).toBe("spent");
  });

  it("the franchise id is the eligible value; the team code never is", () => {
    const { g, calSeason } = cleanSetup();
    expect(g.primePriceFor(calSeason, "ANA")).toBe(HOMEGROWN_PRICE_M);
    // The old comparison — season team code — must NOT discount.
    expect(g.primePriceFor(calSeason, "CAL")).toBe(calSeason.cost);
  });
});

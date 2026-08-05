/** 🎠 MERRY-GO-ROUND — repeated undo of the same move.
 *
 * The badge fires when the same actionSig is undone three or more times in
 * one game: make a move, undo it, remake it exactly, undo it, remake it,
 * undo it. The counter (`undoCounts`) is a run fact that is never
 * decremented and never reset by a rewind (a snapshot was taken before the
 * move it records, so a hydrate that carried it would clear it on the one
 * call that earns it). */
import { beforeEach, describe, expect, it } from "vitest";
import { earnedBadges, BADGE_BY_KEY, type BadgeFacts } from "../src/lib/badges";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const SAVE_KEY = "hotstove.current";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let pid = 0;
function player(over: Partial<CardPlayer> = {}): CardPlayer {
  return {
    id: `p${pid++}`,
    name: "Test Player",
    pos: "1B",
    war: 3,
    cost: 5,
    awards: [],
    ws: false,
    pen: false,
    posG: { c: 0, if: 100, of: 0 },
    debut: "AAA",
    ...over,
  };
}

const SHARED_PLAYER = player({ id: "shared01", pos: "1B" });

function card(team: string, year: number): Card {
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
    // All cards share the same player so the same action sig can be repeated.
    players: [SHARED_PLAYER],
  };
}

const CARDS: Card[] = [
  card("AAA", 2001),
  card("BBB", 2002),
  card("CCC", 2003),
  card("DDD", 2004),
];
const byKey = new Map(CARDS.map((c) => [`${c.team}_${c.year}`, c]));

import { vi } from "vitest";
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

/** A fresh game spun once and landed on a specific card, found by searching seeds. */
async function spunOn(team: string): Promise<Game> {
  for (let seed = 1; seed < 500; seed++) {
    const g = new Game(meta, index, owners, seed);
    g.spin();
    await g.land();
    if (g.card!.team === team) return g;
  }
  throw new Error(`No seed 1..500 opens on ${team}`);
}

beforeEach(() => store.clear());

const facts = (over: Partial<BadgeFacts>): BadgeFacts => ({
  baselineWins: 81,
  baselineLosses: 81,
  total: 81,
  spendM: 50,
  budgetM: 100,
  budgetBonus: 0,
  scoutHits: 0,
  roster: [],
  managerTeam: null,
  managerYear: null,
  managerName: null,
  rings: 0,
  awardPoints: 0,
  managerMoty: false,
  owner: null,
  stadium: null,
  divisions: [],
  powerups: { spent: 0, total: 6 },
  ...over,
});

describe("🎠 MERRY-GO-ROUND", () => {
  it("resolves from the fact the engine hands the badge table", () => {
    expect(earnedBadges(facts({ repeatedUndo: true }))).toContain("merrygoround");
    expect(earnedBadges(facts({ repeatedUndo: false }))).not.toContain("merrygoround");
    // Absent reads as no repeated undo — older saves never pay out.
    expect(earnedBadges(facts({}))).not.toContain("merrygoround");
  });

  it("is an ironic anti-trophy on the meta axis", () => {
    const def = BADGE_BY_KEY.merrygoround;
    expect(def.label).toBe("MERRY-GO-ROUND");
    expect(def.emoji).toBe("🎠");
    expect(def.axis).toBe("meta");
    expect(def.ironic).toBe(true);
    expect(def.freq).toBeNull();
  });

  it("is NOT set after only two undos of the same move", async () => {
    // Two undos: make → undo → remake → undo. One short of the threshold.
    const g = await spunOn("AAA");
    const p = g.card!.players[0];

    g.signPlayer(p);
    g.undo();
    g.signPlayer(p);
    g.undo();
    expect(g.repeatedUndo).toBe(false);
  });

  it("is set on the third undo of the same action sig", async () => {
    const g = await spunOn("AAA");
    const p = g.card!.players[0];

    // Spin 1: sign → undo (count 1)
    g.signPlayer(p);
    expect(g.repeatedUndo).toBe(false);
    g.undo();
    expect(g.repeatedUndo).toBe(false);

    // Spin 2: same player, same card → same sig → undo (count 2)
    g.signPlayer(p);
    g.undo();
    expect(g.repeatedUndo).toBe(false);

    // Spin 3: same player again → undo (count 3 → badge)
    g.signPlayer(p);
    g.undo();
    expect(g.repeatedUndo).toBe(true);
  });

  it("is sticky — stays true once set", async () => {
    const g = await spunOn("AAA");
    const p = g.card!.players[0];

    g.signPlayer(p); g.undo();
    g.signPlayer(p); g.undo();
    g.signPlayer(p); g.undo();
    expect(g.repeatedUndo).toBe(true);

    // A fourth undo: stays true.
    g.signPlayer(p);
    g.undo();
    expect(g.repeatedUndo).toBe(true);
  });

  it("does not fire for undos of DIFFERENT action sigs", async () => {
    // Each card's spin produces a sign|SHARED01|<team>|<year>|<slot> —
    // switching cards changes the team/year part, so even though the player
    // id is the same, the sigs differ.
    const g = await spunOn("AAA");
    const p = g.card!.players[0];

    // Two undos on AAA 2001
    g.signPlayer(p); g.undo();
    g.signPlayer(p); g.undo();
    expect(g.repeatedUndo).toBe(false);

    // Move to a different card (manually force a different card to avoid
    // spinning into the same one again)
    const bbb = CARDS.find((c) => c.team === "BBB")!;
    g.card = bbb;
    const pBbb = bbb.players[0];

    // One undo on BBB 2002 — different sig, so NOT a third undo for AAA
    g.signPlayer(pBbb); g.undo();
    expect(g.repeatedUndo).toBe(false);
  });

  it("survives the save/restore round trip", async () => {
    const g = await spunOn("AAA");
    const p = g.card!.players[0];

    g.signPlayer(p); g.undo();
    g.signPlayer(p); g.undo();
    g.signPlayer(p); g.undo();
    expect(g.repeatedUndo).toBe(true);
    expect(store.has(SAVE_KEY)).toBe(true);

    const back = await Game.restore(meta, index, owners);
    expect(back!.repeatedUndo).toBe(true);
  });

  it("old saves without repeatedUndo restore as false (never a free badge)", async () => {
    const g = await spunOn("AAA");
    const p = g.card!.players[0];
    g.signPlayer(p);
    const raw = JSON.parse(store.get(SAVE_KEY)!);
    delete raw.repeatedUndo;
    delete raw.undoCounts;
    store.set(SAVE_KEY, JSON.stringify(raw));

    const back = await Game.restore(meta, index, owners);
    expect(back!.repeatedUndo).toBe(false);
  });
});

/** 🎠 MERRY-GO-ROUND — three or more moves taken back in one game.
 *
 * The trigger reads TOTAL undos: the once-per-spin rule (engine
 * `undoSpent`) closed the old make → undo → remake carousel, so the badge
 * now asks for three rewinds across a season. The counters (`undoCounts`)
 * are a run fact, never decremented and never reset by a rewind (a snapshot
 * was taken before the move it records, so a hydrate that carried them would
 * clear them on the one call that earns them). */
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
    // A bench per card, one man per slot family: the reel draws with
    // replacement, so a re-spun card can come back with some men already
    // rostered — the tests sign "whoever is open" and need someone to be.
    players: [
      player({ id: `${team.toLowerCase()}C`, pos: "C", posG: { c: 100, if: 0, of: 0 } }),
      player({ id: `${team.toLowerCase()}IF`, pos: "1B", posG: { c: 0, if: 100, of: 0 } }),
      player({ id: `${team.toLowerCase()}OF`, pos: "CF", posG: { c: 0, if: 0, of: 100 } }),
      player({ id: `${team.toLowerCase()}SP`, pos: "SP", posG: { c: 0, if: 0, of: 0 } }),
      player({ id: `${team.toLowerCase()}RP`, pos: "RP", posG: { c: 0, if: 0, of: 0 } }),
    ],
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

  /** The landed card's first signable man — the reel draws with replacement,
   * so a returning card can hold men already rostered. */
  function openPlayer(g: Game) {
    const p = g.card!.players.find((x) => g.playerState(x) === "open");
    if (!p) throw new Error("no open player on the landed card");
    return p;
  }

  /** Rewind the current turn, re-commit, and move the reel on — the only way
   * to spend more than one undo now that a turn holds exactly one. */
  async function undoAndMoveOn(g: Game) {
    g.undo();
    g.signPlayer(openPlayer(g));
    g.spin();
    await g.land();
  }

  it("is NOT set after only two undos", async () => {
    const g = await spunOn("AAA");
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g); // undo 1, next turn
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g); // undo 2, next turn
    expect(g.repeatedUndo).toBe(false);
  });

  it("is set on the third undo of the game", async () => {
    const g = await spunOn("AAA");
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g); // undo 1
    expect(g.repeatedUndo).toBe(false);
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g); // undo 2
    expect(g.repeatedUndo).toBe(false);
    g.signPlayer(openPlayer(g));
    g.undo(); // undo 3 → badge
    expect(g.repeatedUndo).toBe(true);
  });

  it("is sticky — stays true once set", async () => {
    const g = await spunOn("AAA");
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g);
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g);
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g); // undo 3 → true
    expect(g.repeatedUndo).toBe(true);

    // A fourth, on the fourth turn: stays true.
    g.signPlayer(openPlayer(g));
    g.undo();
    expect(g.repeatedUndo).toBe(true);
  });

  it("a turn holds exactly one rewind — THE ONCE-PER-TURN RULE", async () => {
    const g = await spunOn("AAA");
    const p = openPlayer(g);
    g.signPlayer(p);
    expect(g.canUndo).toBe(true);
    g.undo();
    // Re-committing on the same landed card takes a fresh point, but this
    // turn's rewind is spent: the pill stays dark and a second undo is a
    // no-op.
    g.signPlayer(p);
    expect(g.canUndo).toBe(false);
    const slotsAfter = JSON.stringify(g.slots);
    g.undo();
    expect(JSON.stringify(g.slots)).toBe(slotsAfter);
    expect(g.repeatedUndo).toBe(false);

    // The reel moving on does NOT resurrect the re-commit — its point was
    // taken on a spent turn and is dead for good. Undo from the new card's
    // window would land the player back on the audited card with the loop
    // reopened, which is exactly what the rule closes.
    g.spin();
    await g.land();
    expect(g.canUndo).toBe(false);

    // The NEXT decision is what re-arms the pill: a fresh point, flag down.
    g.signPlayer(openPlayer(g));
    expect(g.canUndo).toBe(true);
  });

  it("the spent flag survives the save/restore round trip", async () => {
    const g = await spunOn("AAA");
    const p = openPlayer(g);
    g.signPlayer(p);
    g.undo();
    g.signPlayer(p); // same window, spent — and save() has run
    expect(g.canUndo).toBe(false);

    // A reload must not hand the same window a second rewind: the restored
    // game holds no undo point at all (that is the reload's own rule), and
    // the spent flag comes back with it.
    const back = (await Game.restore(meta, index, owners))!;
    expect(back.canUndo).toBe(false);
    expect(back.undoSpent).toBe(true);
  });

  it("survives the save/restore round trip", async () => {
    const g = await spunOn("AAA");
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g);
    g.signPlayer(openPlayer(g));
    await undoAndMoveOn(g);
    g.signPlayer(openPlayer(g));
    g.undo();
    expect(g.repeatedUndo).toBe(true);
    expect(store.has(SAVE_KEY)).toBe(true);

    const back = await Game.restore(meta, index, owners);
    expect(back!.repeatedUndo).toBe(true);
  });

  it("old saves without repeatedUndo restore as false (never a free badge)", async () => {
    const g = await spunOn("AAA");
    const p = openPlayer(g);
    g.signPlayer(p);
    const raw = JSON.parse(store.get(SAVE_KEY)!);
    delete raw.repeatedUndo;
    delete raw.undoCounts;
    store.set(SAVE_KEY, JSON.stringify(raw));

    const back = await Game.restore(meta, index, owners);
    expect(back!.repeatedUndo).toBe(false);
  });
});

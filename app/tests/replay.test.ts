/** The shareable replay — a shortcode driven back through the engine.
 *
 * `replayShortcode` (share.ts) is the exact inverse of play → `appendDecision`:
 * it rebuilds a Game on the code's seed and settings and re-applies every
 * recorded decision, so the reconstructed season scores what the original one
 * scored. The spins come off the seeded cursor; the tokens are the only free
 * choices there are.
 *
 * Three contracts live here:
 *
 *  1. ROUND-TRIP. Play a game, take its `debugLog()`, replay it, and the record,
 *     the points, and the roster match — through the CURRENT encoder against
 *     the CURRENT card data.
 *  2. READ-ONLY. A replay writes NOTHING. Not the viewer's in-progress save,
 *     not the history log, not the archive, not the boot claim. Every key in
 *     storage is snapshotted before the drive and compared byte for byte after.
 *  3. THE GUARD. An unknown format version or a token that no longer applies
 *     returns null — never a partial or wrong-but-plausible finale. The check
 *     is token parity, not a try/catch: no action method throws, they refuse
 *     silently, so the driver asserts the log grew by exactly the token it
 *     asked for.
 *
 * The scripted game deliberately USES ✌️ Double Play and 🏠 Homegrown, because
 * those two are what format v2 exists for. Neither arm state was in v1: a
 * doubled spin's token stream is byte-identical to one where two ordinary spins
 * were picked from, and the discount changes only the price, which token parity
 * cannot see. Both now carry their own verb, and these are the cases that prove
 * it — including a price assertion, since price is the thing parity misses.
 *
 * Fixtures follow decision-log.test.ts / finale-persist.test.ts — hand-built
 * cards, a stubbed localStorage, a fetch that serves them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Game, HOMEGROWN_PRICE_M, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { CompactAction, GameConfig } from "../src/lib/engine.svelte";
import { decodeDecisionLog, replayShortcode } from "../src/lib/share";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

function player(over: Partial<CardPlayer> = {}): CardPlayer {
  return {
    id: "x",
    name: "Test Player",
    pos: "1B",
    war: 3,
    cost: 8,
    awards: [],
    ws: false,
    pen: false,
    posG: { c: 0, if: 140, of: 0 },
    // Never the card's own franchise: 🏠 Homegrown must not be reachable in
    // the scripted game (see the header note).
    debut: "ZZZ",
    age: 28,
    ...over,
  };
}

/** Nine men, one per seat in SLOT_TYPES order plus a spare, so a single card
 * can fill a club: C, IF, IF, OF, FLEX (DH), SP, SP, RP. The `tag` keeps ids
 * and WAR distinct per card, which is what makes a desynced replay — the same
 * player index read off the wrong card — visible in the roster. */
function squad(tag: string, franchise: string, warBase: number): CardPlayer[] {
  return [
    player({ id: `${tag}c1`, pos: "C", posG: { c: 120, if: 0, of: 0 } }),
    player({ id: `${tag}if1`, pos: "1B" }),
    player({ id: `${tag}if2`, pos: "2B" }),
    player({ id: `${tag}of1`, pos: "CF", posG: { c: 0, if: 0, of: 150 } }),
    player({ id: `${tag}dh1`, pos: "DH", posG: { c: 0, if: 0, of: 0 } }),
    player({ id: `${tag}sp1`, pos: "SP", posG: { c: 0, if: 0, of: 0 } }),
    player({ id: `${tag}sp2`, pos: "SP", posG: { c: 0, if: 0, of: 0 } }),
    player({ id: `${tag}rp1`, pos: "RP", posG: { c: 0, if: 0, of: 0 } }),
    // The one debut-eligible man on each card — 🏠 Homegrown's target.
    player({ id: `${tag}if3`, pos: "3B", debut: franchise }),
  ].map((p, i) => ({ ...p, war: warBase + i * 0.5, cost: 6 + i }));
}

const CARDS: Card[] = [
  {
    year: 2016,
    team: "CHC",
    franchise: "CHC",
    name: "Chicago Cubs",
    park: "Wrigley Field",
    wins: 103,
    losses: 58,
    manager: "Joe Maddon",
    managerMoty: true,
    ws: true,
    pen: false,
    attendance: 3_232_420,
    attendancePct: 0.86,
    stadiumMult: 1.11,
    budget: 136.3,
    prorated: 1,
    players: squad("a", "CHC", 2),
  },
  {
    year: 2004,
    team: "BOS",
    franchise: "BOS",
    name: "Boston Red Sox",
    park: "Fenway Park",
    wins: 98,
    losses: 64,
    manager: "Terry Francona",
    ws: true,
    pen: false,
    attendance: 2_837_294,
    attendancePct: 0.94,
    stadiumMult: 1.05,
    budget: 127.5,
    prorated: 1,
    players: squad("b", "BOS", 3),
  },
];
const byKey = new Map(CARDS.map((c) => [`${c.team}_${c.year}`, c]));

vi.stubGlobal("fetch", async (url: unknown) => {
  const m = String(url).match(/cards\/([A-Z]+)_(\d{4})\.json$/);
  const c = m ? byKey.get(`${m[1]}_${m[2]}`) : undefined;
  return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
});

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: SLOT_TYPES,
  minBudget: 18.2,
  avgSlot8: { "2016": 87497175, "2004": 87497175 },
  salaryFloor: { "2016": 508500, "2004": 508500 },
  proration: {},
};

const index: GameIndex = {
  yearMin: 2004,
  yearMax: 2016,
  cards: [
    { team: "CHC", year: 2016, franchise: "CHC", name: "Chicago Cubs", lg: "NL", div: "C" },
    { team: "BOS", year: 2004, franchise: "BOS", name: "Boston Red Sox", lg: "AL", div: "E" },
  ],
};

const owners: Owners = {
  franchises: {
    CHC: {
      name: "Chicago Cubs",
      owners: [{ name: "Ricketts family", from: 2009, to: null }],
    },
    BOS: {
      name: "Boston Red Sox",
      owners: [{ name: "John Henry", from: 2002, to: null }],
    },
  },
};

/** Both fixture squads are built in SLOT_TYPES order, so `players[i]` fits
 * seat `i` on whichever club the reel deals — the script never has to look at
 * which card landed, and the seeded cursor still decides. */
async function landed(g: Game): Promise<void> {
  if (g.phase === "preSpin") g.spin();
  if (g.phase === "spinning") await g.land();
}

/** A full classic-bank season, exercising every replay hazard the grammar has
 * to carry: an undo, a ✌️ doubled spin, a 🏠 discounted signing, the owner, the
 * ballpark, and the skipper. */
async function playFullGame(
  seed = 42,
  config: GameConfig = { difficulty: "standard", bank: "classic" },
): Promise<Game> {
  const g = new Game(meta, index, owners, seed, config);
  await landed(g);
  // Sign, take it back, sign it again — the U token, and the one path that
  // rewinds the seeded cursor mid-log.
  g.signPlayer(g.card!.players[0], 0);
  g.undo();
  await landed(g);
  g.signPlayer(g.card!.players[0], 0);
  // Two picks off one card. Without the D token this is indistinguishable from
  // one pick apiece off two cards, and the replay lands the second man on the
  // wrong club.
  await landed(g);
  g.toggleDoublePlay();
  g.signPlayer(g.card!.players[1], 1);
  g.signPlayer(g.card!.players[2], 2);
  // The discount: index 8 is the debut-eligible man on either club, and the
  // FLEX seat takes him. Signing at $1M spends the powerup.
  await landed(g);
  g.toggleHometown();
  g.signPlayer(g.card!.players[8], 4);
  for (const i of [3, 5, 6, 7]) {
    await landed(g);
    g.signPlayer(g.card!.players[i], i);
  }
  // Moneyball and Blank Check hand out the cap: no owner, no ballpark to buy.
  if (!g.fixedCap) {
    await landed(g);
    g.hireOwner();
    await landed(g);
    g.buyStadium();
  }
  await landed(g);
  g.hireManager();
  await vi.waitFor(() => expect(g.phase).toBe("finale"));
  return g;
}

const snapshot = () => JSON.stringify([...store.entries()].sort());

const roster = (g: Game) =>
  g.slots.map((s) => (s === null ? null : { id: s.id, year: s.year, team: s.team, costPaid: s.costPaid }));

beforeEach(() => store.clear());

// ---------- 1. round-trip ----------

describe("encode → replay round-trip", () => {
  it("reproduces the record, the points, and the roster of the played game", async () => {
    const g = await playFullGame();
    const code = g.debugLog();

    const back = await replayShortcode(meta, index, owners, code);
    expect(back).not.toBeNull();
    expect(back!.phase).toBe("finale");
    expect(back!.finale!.wins).toBe(g.finale!.wins);
    expect(back!.finale!.losses).toBe(g.finale!.losses);
    expect(back!.finale!.parts.total).toBe(g.finale!.parts.total);
    expect(roster(back!)).toEqual(roster(g));
    expect(back!.manager).toEqual(g.manager);
    expect(back!.owner).toEqual(g.owner);
    expect(back!.stadium).toEqual(g.stadium);
    expect(back!.spinCount).toBe(g.spinCount);
  });

  it("re-encodes to the same shortcode it was replayed from", async () => {
    const g = await playFullGame(7);
    const code = g.debugLog();
    const back = await replayShortcode(meta, index, owners, code);
    expect(back!.debugLog()).toBe(code);
  });

  it("carries the mode settings out of the header", async () => {
    const g = await playFullGame(5, { difficulty: "scout", bank: "moneyball" });
    const back = await replayShortcode(meta, index, owners, g.debugLog());
    expect(back).not.toBeNull();
    expect(back!.config).toEqual({ difficulty: "scout", bank: "moneyball" });
    expect(back!.finale!.parts.total).toBe(g.finale!.parts.total);
    expect(roster(back!)).toEqual(roster(g));
  });

  it("reproduces the 🏠 discount, which token parity cannot see", async () => {
    const g = await playFullGame();
    const paid = g.slots[4]!;
    // The flat price, not the sticker — proof the powerup was armed at the
    // moment the man signed rather than merely available.
    expect(paid.hero).toBe(true);
    expect(paid.costPaid).toBe(HOMEGROWN_PRICE_M);

    const back = await replayShortcode(meta, index, owners, g.debugLog());
    expect(back!.slots[4]!.costPaid).toBe(paid.costPaid);
    expect(back!.slots[4]!.hero).toBe(true);
    expect(back!.finale!.spend).toBe(g.finale!.spend);
  });

  it("puts a ✌️ doubled spin's second pick on the same card", async () => {
    const g = await playFullGame();
    const back = await replayShortcode(meta, index, owners, g.debugLog());
    // Seats 1 and 2 were bought off one card; a replay that spun between them
    // fills them off two, which the ids and the spin count both report.
    expect(back!.slots[1]!.id).toBe(g.slots[1]!.id);
    expect(back!.slots[2]!.id).toBe(g.slots[2]!.id);
    expect(back!.spinCount).toBe(g.spinCount);
  });
});

describe("legacy rewind grammar", () => {
  it("drives a double rewind in one window (v2 codes minted before once-per-spin)", async () => {
    // Live play can no longer produce S U S U on one landed card — the
    // once-per-spin rule darkens the pill after the first U — but shared
    // codes minted before the rule legally carry it, and a replay is history,
    // not a live request. The driver lifts the gate per recorded U; a build
    // that forgot would refuse the second U, log three tokens, and reject
    // every such code in the wild.
    const g = new Game(meta, index, owners, 42, { difficulty: "standard", bank: "classic" });
    const actions: CompactAction[] = [
      { verb: "S", pi: 0, si: 0 },
      { verb: "U" },
      { verb: "S", pi: 0, si: 0 },
      { verb: "U" },
    ];
    const n = await g.driveReplay(actions);
    // Every token applied; the drive stops short of a finale (the club is
    // unfinished), which driveReplay reports as actions.length.
    expect(n).toBe(actions.length);
    expect(g.decisionLog.map((a) => a.verb)).toEqual(["S", "U", "S", "U"]);
    expect(g.slots.every((sl) => sl === null)).toBe(true);
  });
});

// ---------- 2. read-only ----------

describe("a replay writes nothing", () => {
  it("leaves every storage key exactly as it found it", async () => {
    const g = await playFullGame();
    const code = g.debugLog();
    // Everything the finished game filed — the finale, the boot claim, the
    // history row, the archive — plus whatever else is in there.
    const before = snapshot();
    expect(store.size).toBeGreaterThan(0);

    const back = await replayShortcode(meta, index, owners, code);
    expect(back).not.toBeNull();
    expect(snapshot()).toBe(before);
  });

  it("does not clobber a live game's in-progress save", async () => {
    const g = await playFullGame();
    const code = g.debugLog();
    store.clear();
    // A different game in flight, exactly as a player's own would be.
    const live = new Game(meta, index, owners, 999, {
      difficulty: "standard",
      bank: "classic",
    });
    await landed(live);
    live.signPlayer(live.card!.players[3], 3);
    const saved = store.get("hotstove.current");
    expect(saved).toBeDefined();

    await replayShortcode(meta, index, owners, code);
    expect(store.get("hotstove.current")).toBe(saved);
  });

  it("files no history row and no archive record for someone else's season", async () => {
    const g = await playFullGame();
    const code = g.debugLog();
    store.clear();

    const back = await replayShortcode(meta, index, owners, code);
    expect(back!.phase).toBe("finale");
    expect(store.size).toBe(0);
  });

  it("marks the replayed game inert", async () => {
    const g = await playFullGame();
    const back = await replayShortcode(meta, index, owners, g.debugLog());
    expect(back!.inert).toBe(true);
    // The flag holds after the finale, so nothing that runs later can write.
    back!.save();
    expect(store.has("hotstove.current")).toBe(false);
  });
});

// ---------- 3. the guard ----------

describe("the version guard", () => {
  it("refuses an unknown format version", async () => {
    const g = await playFullGame();
    expect(await replayShortcode(meta, index, owners, "3" + g.debugLog().slice(1))).toBeNull();
  });

  it("refuses a v1 code, whose ✌️ and 🏠 states were never recorded", async () => {
    const g = await playFullGame();
    const v1 = "1" + g.debugLog().slice(1);
    // Still readable for a bug report — just not replayable.
    expect(decodeDecisionLog(v1)!.header.v).toBe(1);
    expect(await replayShortcode(meta, index, owners, v1)).toBeNull();
  });

  it("refuses a header that does not parse", async () => {
    expect(await replayShortcode(meta, index, owners, "")).toBeNull();
    expect(await replayShortcode(meta, index, owners, "1ABC")).toBeNull();
    expect(await replayShortcode(meta, index, owners, "not a game code at all")).toBeNull();
  });

  it("refuses an out-of-range player index (the data-rebuild case)", async () => {
    const g = await playFullGame();
    const code = g.debugLog();
    // The first body token is S<pi><si>; 'z' is base36 35, past the end of any
    // card's players array — exactly what a rebuilt card set can produce.
    const tampered = code.slice(0, 13) + "z" + code.slice(14);
    expect(tampered).not.toBe(code);
    expect(await replayShortcode(meta, index, owners, tampered)).toBeNull();
  });

  it("refuses an illegal slot index", async () => {
    const g = await playFullGame();
    const code = g.debugLog();
    // Same token, the slot param: 'z' is no seat on any roster.
    const tampered = code.slice(0, 14) + "z" + code.slice(15);
    expect(await replayShortcode(meta, index, owners, tampered)).toBeNull();
  });

  it("refuses a log that runs out before the club is complete", async () => {
    const g = new Game(meta, index, owners, 42, {
      difficulty: "standard",
      bank: "classic",
    });
    await landed(g);
    g.signPlayer(g.card!.players[0], 0);
    expect(await replayShortcode(meta, index, owners, g.debugLog())).toBeNull();
  });

  it("writes nothing on a refused replay either", async () => {
    const g = await playFullGame();
    const code = g.debugLog();
    store.clear();
    await replayShortcode(meta, index, owners, "3" + code.slice(1));
    await replayShortcode(meta, index, owners, code.slice(0, 13) + "z" + code.slice(14));
    expect(store.size).toBe(0);
  });
});

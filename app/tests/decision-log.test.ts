/** Decision log — compact shortcode audit trail and encode/decode.
 *
 * The decision log is a monotonically-growing list of CompactAction values.
 * Every committed action appends an entry; undo appends its own entry rather
 * than removing the one it reverses (the log is an audit trail, not a
 * position representation). The log is a RUN fact: `restore()` reads it
 * directly, `hydrate()` does not carry it, and a rewind cannot delete entries
 * already appended.
 *
 * `encodeDecisionLog` / `decodeDecisionLog` in share.ts produce a compact
 * shortcode that can be pasted into a bug report and decoded without a live
 * game. `Game#debugLog()` uses the same format inline (no import from share.ts,
 * to avoid a circular dependency). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { CompactAction } from "../src/lib/engine.svelte";
import { encodeDecisionLog, decodeDecisionLog, debugLogFromStorage } from "../src/lib/share";
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
    players: [player(), player()],
  };
}

const CARDS: Card[] = [
  card("AAA", 2001),
  card("BBB", 2002),
  card("CCC", 2003),
  card("DDD", 2004),
];
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

async function spun(seed = 42): Promise<Game> {
  const g = new Game(meta, index, owners, seed);
  g.spin();
  await g.land();
  return g;
}

beforeEach(() => store.clear());

// ---------- encode / decode round-trip ----------

describe("encodeDecisionLog / decodeDecisionLog", () => {
  it("round-trips an empty log", () => {
    const header = { v: 2, seed: 42, sv: 6, diff: "standard", bank: "classic" };
    const encoded = encodeDecisionLog(header, []);
    const result = decodeDecisionLog(encoded);
    expect(result).not.toBeNull();
    expect(result!.header.seed).toBe(42);
    expect(result!.header.sv).toBe(6);
    expect(result!.header.diff).toBe("standard");
    expect(result!.header.bank).toBe("classic");
    // The version this build MINTS. A v1 string still decodes (it just cannot
    // be replayed — see replay.test.ts), so the header reports what it carried.
    expect(result!.header.v).toBe(2);
    expect(result!.log).toEqual([]);
  });

  it("round-trips a diverse set of compact actions", () => {
    const header = { v: 2, seed: 99, sv: 6, diff: "scout", bank: "moneyball" };
    const log: CompactAction[] = [
      { verb: "S", pi: 0, si: 2 },
      { verb: "U" },
      { verb: "W", pi: 1, si: 3 },
      { verb: "O" },
      { verb: "A" },
      { verb: "M" },
      { verb: "T", ci: 14 },
      { verb: "R", ci: 7 },
      { verb: "P", ci: 23, pi: 2, si: 5 },
      { verb: "V", ci: 11, pi: 0, si: 1 },
      { verb: "Q", ci: 42 },
      { verb: "C" },
    ];
    const encoded = encodeDecisionLog(header, log);
    const result = decodeDecisionLog(encoded);
    expect(result).not.toBeNull();
    expect(result!.header.seed).toBe(99);
    expect(result!.header.diff).toBe("scout");
    expect(result!.header.bank).toBe("moneyball");
    expect(result!.log).toEqual(log);
  });

  it("produces a URL-safe string (no +, /, or = characters)", () => {
    const header = { v: 2, seed: 12345678, sv: 6, diff: "standard", bank: "classic" };
    const log: CompactAction[] = [{ verb: "S", pi: 0, si: 0 }];
    const encoded = encodeDecisionLog(header, log);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("is well under 120 chars for a full-game action sequence", () => {
    const header = { v: 2, seed: 42, sv: 6, diff: "standard", bank: "classic" };
    // 15 actions: season ticket, 8 signs, relocate, undo, owner, stadium, manager, cold spin
    const log: CompactAction[] = [
      { verb: "T", ci: 2 },
      { verb: "S", pi: 0, si: 0 },
      { verb: "R", ci: 5 },
      { verb: "S", pi: 1, si: 1 },
      { verb: "U" },
      { verb: "S", pi: 0, si: 1 },
      { verb: "O" },
      { verb: "A" },
      { verb: "S", pi: 0, si: 2 },
      { verb: "S", pi: 1, si: 3 },
      { verb: "M" },
      { verb: "S", pi: 0, si: 4 },
      { verb: "S", pi: 1, si: 5 },
      { verb: "S", pi: 0, si: 6 },
      { verb: "S", pi: 1, si: 7 },
    ];
    const encoded = encodeDecisionLog(header, log);
    expect(encoded.length).toBeLessThan(120);
  });

  it("returns null for too-short or unrecognized input", () => {
    expect(decodeDecisionLog("")).toBeNull();
    expect(decodeDecisionLog("1")).toBeNull();
    expect(decodeDecisionLog("not-valid!!!")).toBeNull();
    expect(decodeDecisionLog("XINVALIDHEADR")).toBeNull();
  });
});

// ---------- log accumulates in the engine ----------

describe("log accumulates with actions", () => {
  it("starts empty and grows by one per action", async () => {
    const g = await spun();
    expect(g.decisionLog).toHaveLength(0);

    g.signPlayer(g.card!.players[0]);
    expect(g.decisionLog).toHaveLength(1);
    expect(g.decisionLog[0].verb).toBe("S");
    expect((g.decisionLog[0] as { verb: "S"; pi: number; si: number }).pi).toBe(0);
  });

  it("undo appends a log entry rather than removing the signed one", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);
    expect(g.decisionLog).toHaveLength(1);

    g.undo();
    expect(g.decisionLog).toHaveLength(2);
    expect(g.decisionLog[0].verb).toBe("S");
    expect(g.decisionLog[1].verb).toBe("U");
  });

  it("survives the save/restore round trip with compact log intact", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);
    g.undo();
    const verbsBefore = g.decisionLog.map((e) => e.verb).join("");

    const back = await Game.restore(meta, index, owners);
    expect(back!.decisionLog.map((e) => e.verb).join("")).toBe(verbsBefore);
    expect(back!.decisionLog).toHaveLength(2);
  });

  it("old saves without decisionLog restore as empty array (no throw, no free data)", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);

    // Strip the field to simulate an older save.
    const raw = JSON.parse(store.get(SAVE_KEY)!);
    delete raw.decisionLog;
    store.set(SAVE_KEY, JSON.stringify(raw));

    const back = await Game.restore(meta, index, owners);
    expect(back!.decisionLog).toEqual([]);
  });

  it("old saves with array-format decisionLog restore as empty (graceful ignore)", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);

    // Overwrite with the old array format to simulate a pre-compact save.
    const raw = JSON.parse(store.get(SAVE_KEY)!);
    raw.decisionLog = [{ k: "sign", id: "p0", t: "AAA", y: 2001, s: 0, c: 5 }];
    store.set(SAVE_KEY, JSON.stringify(raw));

    const back = await Game.restore(meta, index, owners);
    expect(back!.decisionLog).toEqual([]);
  });

  it("undo does NOT remove existing log entries (hydrate never touches the log)", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);
    g.undo();

    g.signPlayer(g.card!.players[0]);
    g.undo();
    expect(g.decisionLog).toHaveLength(4);
    const verbs = g.decisionLog.map((e) => e.verb);
    expect(verbs).toEqual(["S", "U", "S", "U"]);
  });
});

// ---------- Game#debugLog ----------

describe("Game#debugLog()", () => {
  it("returns a non-empty string", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);
    const s = g.debugLog();
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
  });

  it("decodes to a payload containing the game's seed and log entries", async () => {
    const g = new Game(meta, index, owners, 77);
    g.spin();
    await g.land();
    g.signPlayer(g.card!.players[0]);

    const encoded = g.debugLog();
    const result = decodeDecisionLog(encoded);
    expect(result).not.toBeNull();
    expect(result!.header.seed).toBe(77);
    expect(result!.header.diff).toBe("standard");
    expect(result!.log).toHaveLength(1);
    expect(result!.log[0].verb).toBe("S");
  });

  it("encoded string grows as more actions are taken", async () => {
    const g = await spun();
    const initial = g.debugLog().length;

    g.signPlayer(g.card!.players[0]);
    const after = g.debugLog().length;
    expect(after).toBeGreaterThan(initial);
  });

  it("full-game log decodes to the action sequence that was played", async () => {
    const g = await spun(42);
    g.signPlayer(g.card!.players[0]);
    g.undo();
    g.signPlayer(g.card!.players[1]);

    const encoded = g.debugLog();
    const result = decodeDecisionLog(encoded);
    expect(result).not.toBeNull();
    const verbs = result!.log.map((a) => a.verb);
    expect(verbs).toEqual(["S", "U", "S"]);
    const lastSign = result!.log[2] as { verb: "S"; pi: number; si: number };
    expect(lastSign.pi).toBe(1);
  });
});

// ---------- debugLogFromStorage ----------
// The share.ts module-level `if (typeof window !== "undefined")` guard
// prevents the window helper from running under Vitest. The core logic lives
// in the exported `debugLogFromStorage()` function, which tests can call
// directly — same code path, no window stub required.

const FINALE_KEY = "hotstove.finale";

describe("debugLogFromStorage()", () => {
  it("returns null when localStorage is empty", () => {
    expect(debugLogFromStorage()).toBeNull();
  });

  it("reads from hotstove.current and sets src='current'", async () => {
    const g = await spun(11);
    g.signPlayer(g.card!.players[0]);

    const encoded = debugLogFromStorage();
    expect(encoded).not.toBeNull();
    const result = decodeDecisionLog(encoded!);
    expect(result).not.toBeNull();
    expect(result!.header.src).toBe("current");
    expect(result!.header.seed).toBe(11);
    expect(result!.log).toHaveLength(1);
    expect(result!.log[0].verb).toBe("S");
  });

  it("prefers hotstove.finale over hotstove.current when both present", () => {
    const currentRecord = JSON.stringify({
      v: 6,
      seed: 100,
      config: { difficulty: "standard", bank: "classic" },
      decisionLog: "S00",
    });
    const finaleRecord = JSON.stringify({
      v: 3,
      seed: 200,
      config: { difficulty: "scout", bank: "moneyball" },
      decisionLog: "S00U",
    });
    store.set(SAVE_KEY, currentRecord);
    store.set(FINALE_KEY, finaleRecord);

    const encoded = debugLogFromStorage();
    expect(encoded).not.toBeNull();
    const result = decodeDecisionLog(encoded!);
    expect(result).not.toBeNull();
    expect(result!.header.seed).toBe(200);
    expect(result!.header.src).toBe("finale");
    expect(result!.header.sv).toBe(3);
    expect(result!.header.diff).toBe("scout");
    expect(result!.log).toHaveLength(2);
  });

  it("returns empty log when record lacks decisionLog field (old save)", () => {
    store.set(SAVE_KEY, JSON.stringify({ v: 6, seed: 42, config: { difficulty: "standard", bank: "classic" } }));
    const encoded = debugLogFromStorage();
    expect(encoded).not.toBeNull();
    const result = decodeDecisionLog(encoded!);
    expect(result!.log).toEqual([]);
  });

  it("returns empty log when record has old array-format decisionLog (graceful ignore)", () => {
    store.set(SAVE_KEY, JSON.stringify({
      v: 6,
      seed: 42,
      config: { difficulty: "standard", bank: "classic" },
      decisionLog: [{ k: "sign", id: "p0" }],
    }));
    const encoded = debugLogFromStorage();
    expect(encoded).not.toBeNull();
    const result = decodeDecisionLog(encoded!);
    expect(result!.log).toEqual([]);
  });

  it("returns null for corrupt JSON in localStorage", () => {
    store.set(SAVE_KEY, "not-valid-json{{{");
    expect(debugLogFromStorage()).toBeNull();
  });
});

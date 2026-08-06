/** Release hardening — the persistence floor and the seed-provenance bit.
 *
 * Two readers gained structural validation (a parseable-but-hollow record
 * must read as NO record, never as a Game or finale that throws later), and
 * the engine gained `seedTyped`, the one bit the two seed badges divide:
 * typed + already in the local log is ✳️, typed + never seen is 🤝.
 *
 * Fixtures are hand-built to the pattern in restore-doubleplay.test.ts.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { Game, SLOT_TYPES, loadStoredFinale } from "../src/lib/engine.svelte";
import type { GameIndex, Meta, Owners } from "../src/lib/types";

const SAVE_KEY = "hotstove.current";
const FINALE_KEY = "hotstove.finale";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

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
const owners: Owners = { franchises: {} };

beforeEach(() => store.clear());

describe("the save reader refuses a hollow record", () => {
  it("a right-version save with no body is no save", async () => {
    // Parses, carries the current version, and holds nothing hydrate needs.
    // Before the structural floor this came back as a Game whose slots were
    // undefined — the white screen arrived on the first thing that read them.
    store.set(SAVE_KEY, JSON.stringify({ v: 6 }));
    expect(await Game.restore(meta, index, owners)).toBeNull();
  });

  it("one missing structural field is enough to refuse", async () => {
    const g = new Game(meta, index, owners, 123);
    g.save();
    const good = JSON.parse(store.get(SAVE_KEY)!);
    for (const field of ["seed", "rngState", "slots", "powerups", "spinLog"]) {
      const bad = { ...good };
      delete bad[field];
      store.set(SAVE_KEY, JSON.stringify(bad));
      expect(await Game.restore(meta, index, owners), field).toBeNull();
    }
  });

  it("a fresh game's own save still round-trips", async () => {
    new Game(meta, index, owners, 123).save();
    expect(await Game.restore(meta, index, owners)).not.toBeNull();
  });
});

describe("the finale reader refuses a hollow record", () => {
  /** The smallest record the screen can actually render. */
  const whole = () => ({
    v: 1,
    seed: 1,
    config: { difficulty: "standard", bank: "classic" },
    spinCount: 9,
    seen: [],
    slots: [],
    owner: null,
    stadium: null,
    manager: null,
    finale: {
      parts: {
        expectedWins: 0, managerWins: 0, budgetBonus: 0, awardPoints: 0,
        ringPoints: 0, scoutBonus: 0, luxuryTax: 0, total: 100,
      },
      wins: 100,
      losses: 62,
      badges: [],
      spend: 90,
      budget: 100,
      spinCount: 9,
      totalWar: 40 } });

  it("accepts the whole record (with the version this build writes)", () => {
    // The literal above pins v to what FINALE_VERSION was when this test was
    // written; if the version moved, update the literal alongside a reader
    // that still refuses hollow bodies.
    store.set(FINALE_KEY, JSON.stringify(whole()));
    expect(loadStoredFinale()).not.toBeNull();
  });

  it("refuses a record missing what the screen dereferences", () => {
    for (const strip of ["wins", "losses", "spend", "budget", "totalWar", "badges"]) {
      const rec = whole() as unknown as { finale: Record<string, unknown> };
      delete rec.finale[strip];
      store.set(FINALE_KEY, JSON.stringify(rec));
      expect(loadStoredFinale(), strip).toBeNull();
    }
  });
});

describe("seedTyped, the provenance bit the seed badges read", () => {
  it("only the explicit flag marks a seed typed — a passed seed alone does not", () => {
    // The bot studies and every test fixture hand seeds in programmatically;
    // provenance is the constructor's separate final argument.
    expect(new Game(meta, index, owners, 42).seedTyped).toBe(false);
    expect(
      new Game(meta, index, owners, 42, { difficulty: "standard", bank: "classic" }, true)
        .seedTyped,
    ).toBe(true);
    expect(new Game(meta, index, owners).seedTyped).toBe(false);
  });

  it("survives the save round trip", async () => {
    new Game(meta, index, owners, 42, { difficulty: "standard", bank: "classic" }, true).save();
    expect((await Game.restore(meta, index, owners))!.seedTyped).toBe(true);
  });

  // The constructor is handed the saved seed explicitly on restore and must
  // not mistake that for typing.
  it("a rolled seed stays rolled through restore", async () => {
    new Game(meta, index, owners).save();
    expect((await Game.restore(meta, index, owners))!.seedTyped).toBe(false);
  });
});

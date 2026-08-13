import { describe, expect, it, vi } from "vitest";
import {
  MIGRATION_FRAGMENT_BUDGET,
  buildSourceTransfer,
  commitAdoption,
  decodeMigrationPayload,
  encodeMigrationPayload,
  normalizeHistoryRow,
  planAdoption,
  type MigrationPayload,
} from "../src/lib/migration";

class MemoryStorage {
  readonly values = new Map<string, string>();
  failOnceOn: string | null = null;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnceOn === key) {
      this.failOnceOn = null;
      throw new DOMException("full", "QuotaExceededError");
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const row = (name: string, extra: Record<string, unknown> = {}) => ({
  date: "2026-08-13",
  record: name,
  ...extra,
});

const finale = (id?: string) => ({
  ...(id ? { id } : {}),
  v: 1,
  seed: 17,
  config: { difficulty: "standard", bank: "classic" },
  spinCount: 9,
  seen: [],
  slots: [],
  owner: null,
  stadium: null,
  manager: null,
  finale: {
    wins: 90,
    losses: 72,
    spend: 100,
    budget: 120,
    totalWar: 40,
    spinCount: 9,
    badges: [],
    parts: {
      expectedWins: 90,
      managerWins: 0,
      budgetBonus: 1,
      awardPoints: 0,
      ringPoints: 0,
      scoutBonus: 0,
      luxuryTax: 0,
      total: 91,
    },
  },
});

function payload(
  rows: Record<string, unknown>[],
  options: Partial<MigrationPayload> & {
    start?: number;
    total?: number;
    done?: boolean;
  } = {},
): MigrationPayload {
  const start = options.start ?? 0;
  const total = options.total ?? start + rows.length;
  const done = options.done ?? start + rows.length === total;
  return {
    v: 1,
    nonce: "12345678-1234-4234-8234-123456789abc",
    source: "https://hedgertronic.com",
    history: {
      start,
      end: start + rows.length,
      total,
      done,
      rows,
    },
    ...options,
  } as MigrationPayload;
}

const parsed = (storage: MemoryStorage, key: string) =>
  JSON.parse(storage.getItem(key) ?? "null") as unknown;

describe("migration history invariants", () => {
  it("keeps byte-identical quit rows as separate events", async () => {
    const storage = new MemoryStorage();
    storage.setItem("hotstove.history", JSON.stringify([row("target", { total: 1 })]));
    const quit = row("quit", { badges: ["packedin"] });

    await commitAdoption(storage, payload([quit, quit, quit, quit]));

    expect(parsed(storage, "hotstove.history")).toEqual([
      quit,
      quit,
      quit,
      quit,
      row("target", { total: 1 }),
    ]);
  });

  it("inserts every initial chunk before target play, then appends late legacy play", async () => {
    const storage = new MemoryStorage();
    const target = row("target", { total: 10 });
    storage.setItem("hotstove.history", JSON.stringify([target]));

    await commitAdoption(storage, payload([row("s0"), row("s1")], { total: 3, done: false }));
    await commitAdoption(storage, payload([row("s2")], { start: 2, total: 3, done: true }));
    expect(parsed(storage, "hotstove.history")).toEqual([
      row("s0"),
      row("s1"),
      row("s2"),
      target,
    ]);

    await commitAdoption(storage, payload([row("late")], { start: 3, total: 4, done: true }));
    expect(parsed(storage, "hotstove.history")).toEqual([
      row("s0"),
      row("s1"),
      row("s2"),
      target,
      row("late"),
    ]);
  });

  it("is a no-op when the same completed payload returns", async () => {
    const storage = new MemoryStorage();
    const transfer = payload([row("one"), row("one")]);
    await commitAdoption(storage, transfer);
    const before = [...storage.values];
    await commitAdoption(storage, transfer);
    expect([...storage.values]).toEqual(before);
  });

  it("rejects a missing history range rather than skipping it", () => {
    const storage = new MemoryStorage();
    expect(() => planAdoption(storage, payload([row("gap")], { start: 2, total: 3 }))).toThrow(
      "gap",
    );
  });
});

describe("migration state merge", () => {
  it("keeps target singular state, unions cues, dedupes archives by id", async () => {
    const storage = new MemoryStorage();
    const targetSave = { v: 6, seed: 1 };
    storage.setItem("hotstove.current", JSON.stringify(targetSave));
    storage.setItem("hotstove.archive", JSON.stringify([finale("shared"), finale("target")]));
    storage.setItem(
      "hotstove.cues",
      JSON.stringify({ v: 1, pendingBadges: ["target"], helpSeen: true }),
    );
    const sourceSave = {
      v: 6,
      seed: 2,
      rngState: 2,
      spinCount: 1,
      choicesLeft: 1,
      choicesUsed: 0,
      slots: [],
      spinLog: [],
      powerups: {},
    };

    await commitAdoption(
      storage,
      payload([], {
        archive: [finale("source"), finale("shared")],
        current: sourceSave,
        cues: {
          v: 1,
          pendingBadges: ["source", "target"],
          helpSeen: false,
          tourSeen: true,
          finaleTourSeen: false,
        },
      }),
    );

    expect(parsed(storage, "hotstove.current")).toEqual(targetSave);
    expect((parsed(storage, "hotstove.archive") as { id: string }[]).map((item) => item.id)).toEqual([
      "source",
      "shared",
      "target",
    ]);
    expect(parsed(storage, "hotstove.cues")).toEqual({
      v: 1,
      pendingBadges: ["source", "target"],
      helpSeen: true,
      tourSeen: true,
      finaleTourSeen: false,
    });
  });

  it("drops an archive pointer when its row did not cross", async () => {
    const storage = new MemoryStorage();
    await commitAdoption(
      storage,
      payload([], { finale: finale(), finaleOpen: "a:not-carried" }),
    );
    expect(storage.getItem("hotstove.finale")).not.toBeNull();
    expect(storage.getItem("hotstove.finale.open")).toBeNull();
  });

  it("updates a late legacy save only while the target copy is untouched", async () => {
    const storage = new MemoryStorage();
    const save = (seed: number) => ({
      v: 6,
      seed,
      rngState: seed,
      spinCount: 1,
      choicesLeft: 1,
      choicesUsed: 0,
      slots: [],
      spinLog: [],
      powerups: {},
    });
    await commitAdoption(storage, payload([], { current: save(1) }));
    await commitAdoption(storage, payload([], { current: save(2) }));
    expect(parsed(storage, "hotstove.current")).toEqual(save(2));

    storage.setItem("hotstove.current", JSON.stringify(save(99)));
    await commitAdoption(storage, payload([], { current: save(3) }));
    expect(parsed(storage, "hotstove.current")).toEqual(save(99));
  });

  it("removes a source-owned save that a late legacy tab finished", async () => {
    const storage = new MemoryStorage();
    const save = {
      v: 6,
      seed: 1,
      rngState: 1,
      spinCount: 1,
      choicesLeft: 1,
      choicesUsed: 0,
      slots: [],
      spinLog: [],
      powerups: {},
    };
    await commitAdoption(storage, payload([], { current: save }));
    await commitAdoption(storage, payload([]));
    expect(storage.getItem("hotstove.current")).toBeNull();
  });
});

describe("write-ahead recovery", () => {
  const allState = payload([row("source")], {
    archive: [finale("source")],
    current: {
      v: 6,
      seed: 2,
      rngState: 2,
      spinCount: 1,
      choicesLeft: 1,
      choicesUsed: 0,
      slots: [],
      spinLog: [],
      powerups: {},
    },
    finale: finale(),
    finaleOpen: "1",
    settings: { v: 2, difficulty: "standard", bank: "classic" },
    cues: {
      v: 1,
      pendingBadges: ["source"],
      helpSeen: true,
      tourSeen: true,
      finaleTourSeen: true,
    },
    theme: "dark",
  });

  for (const key of [
    "hotstove.adopting",
    "hotstove.history",
    "hotstove.archive",
    "hotstove.current",
    "hotstove.finale",
    "hotstove.finale.open",
    "hotstove.settings",
    "hotstove.cues",
    "hotstove.theme",
    "hotstove.adopted",
  ]) {
    it(`recovers without duplicate data when ${key} fails once`, async () => {
      const storage = new MemoryStorage();
      storage.failOnceOn = key;
      await expect(commitAdoption(storage, allState)).rejects.toThrow();
      await commitAdoption(storage, allState);
      expect(parsed(storage, "hotstove.history")).toEqual([row("source")]);
      expect(parsed(storage, "hotstove.adopted")).toMatchObject({
        historyCount: 1,
        initialComplete: true,
      });
      expect(storage.getItem("hotstove.adopting")).toBeNull();
    });
  }

  it("finishes an old journal before applying a newer source snapshot", async () => {
    const storage = new MemoryStorage();
    storage.failOnceOn = "hotstove.settings";
    await expect(commitAdoption(storage, allState)).rejects.toThrow();
    const newer = payload([row("source"), row("late")], {
      nonce: "abcdefab-1234-4234-8234-123456789abc",
      settings: { v: 2, difficulty: "scout", bank: "classic" },
    });
    await commitAdoption(storage, newer);
    expect(parsed(storage, "hotstove.history")).toEqual([row("source"), row("late")]);
    expect(parsed(storage, "hotstove.settings")).toEqual({
      v: 2,
      difficulty: "scout",
      bank: "classic",
    });
    expect(storage.getItem("hotstove.adopting")).toBeNull();
  });
});

describe("payload boundary", () => {
  it("round-trips a validated compressed payload", async () => {
    const transfer = payload([row("one")]);
    expect(await decodeMigrationPayload(await encodeMigrationPayload(transfer))).toEqual(transfer);
  });

  it("rejects malformed and oversized fragments", async () => {
    await expect(decodeMigrationPayload("g.not-gzip")).rejects.toThrow();
    await expect(
      decodeMigrationPayload(`u.${"A".repeat(MIGRATION_FRAGMENT_BUDGET)}`),
    ).rejects.toThrow("too large");
  });

  it("falls back to uncompressed transfer when CompressionStream is missing", async () => {
    const original = globalThis.CompressionStream;
    vi.stubGlobal("CompressionStream", undefined);
    try {
      const encoded = await encodeMigrationPayload(payload([row("fallback")]));
      expect(encoded.startsWith("u.")).toBe(true);
      expect((await decodeMigrationPayload(encoded)).history.rows).toEqual([row("fallback")]);
    } finally {
      vi.stubGlobal("CompressionStream", original);
    }
  });

  it("rejects a small gzip that expands beyond the hard cap", async () => {
    const oversized = new TextEncoder().encode("x".repeat(1024 * 1024 + 1));
    const compressed = new Uint8Array(
      await new Response(
        new Blob([oversized.buffer]).stream().pipeThrough(new CompressionStream("gzip")),
      ).arrayBuffer(),
    );
    let binary = "";
    for (const byte of compressed) binary += String.fromCharCode(byte);
    const encoded = `g.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    expect(encoded.length).toBeLessThan(MIGRATION_FRAGMENT_BUDGET);
    await expect(decodeMigrationPayload(encoded)).rejects.toThrow("safety limit");
  });

  it("filters unknown history fields instead of persisting them", () => {
    expect(normalizeHistoryRow({ date: "2026-08-13", total: 10, attack: "no" })).toEqual({
      date: "2026-08-13",
      total: 10,
    });
  });

  it("splits a large career into contiguous bounded transfers", async () => {
    const storage = new MemoryStorage();
    const rows = Array.from({ length: 5_200 }, (_, i) =>
      row(`record-${i}-${(i * 2_654_435_761).toString(36)}`, {
        seed: i,
        countries: [`country-${i}-${(i * 1_103_515_245).toString(36)}`],
      }),
    );
    storage.setItem("hotstove.history", JSON.stringify(rows));
    const first = await buildSourceTransfer(
      storage,
      "12345678-1234-4234-8234-123456789abc",
      0,
    );
    expect(first.encoded.length).toBeLessThanOrEqual(MIGRATION_FRAGMENT_BUDGET);
    expect(first.payload.history.start).toBe(0);
    expect(first.payload.history.end).toBeGreaterThan(0);
    expect(first.payload.history.end).toBeLessThan(rows.length);
    expect(first.payload.history.done).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  MIGRATION_FRAGMENT_BUDGET,
  buildSourceTransfer,
  commitAdoption,
  decodeMigrationPayload,
  encodeMigrationPayload,
  missingArchiveIds,
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

/* ---------- the completion sweep (phase 2.5) ---------- */

describe("the completion sweep", () => {
  const NONCE = "12345678-1234-4234-8234-123456789abc";
  const marker = (historyCount: number, initialComplete = true) =>
    JSON.stringify({
      v: 1,
      source: "https://hedgertronic.com",
      historyCount,
      initialComplete,
    });

  it("splices recovered legacy rows over the adopted prefix, keeping .io play", async () => {
    const storage = new MemoryStorage();
    const a = row("a", { total: 1 });
    const b = row("b", { total: 2 });
    const c = row("c", { total: 3 });
    const io = row("io", { total: 9 });
    // The first pass landed only a and c (b was rejected by the old
    // normalizer); a game has since been played on .io.
    storage.setItem("hotstove.history", JSON.stringify([a, c, io]));
    storage.setItem("hotstove.adopted", marker(2));

    await commitAdoption(storage, payload([a, b, c], { sweep: true, archiveIds: [] }));

    expect(parsed(storage, "hotstove.history")).toEqual([a, b, c, io]);
    const m = parsed(storage, "hotstove.adopted") as { historyCount: number };
    expect(m.historyCount).toBe(3);
    expect(storage.getItem("hotstove.migration.sweep")).toBeNull();
  });

  it("keeps a target row the fresh list does not contain, wherever it sits", async () => {
    // z landed inside the adopted range but has no fresh twin (the row shape
    // no target build ever wrote — or simply an .io game between two source
    // eras, the late-source-retry layout). The greedy match keeps it: the
    // sweep has no divergence failure because it never drops anything.
    const storage = new MemoryStorage();
    storage.setItem(
      "hotstove.history",
      JSON.stringify([row("a", { total: 1 }), row("z", { total: 7 })]),
    );
    storage.setItem("hotstove.adopted", marker(2));

    await commitAdoption(
      storage,
      payload([row("a", { total: 1 }), row("b", { total: 2 })], { sweep: true }),
    );
    expect(parsed(storage, "hotstove.history")).toEqual([
      row("a", { total: 1 }),
      row("b", { total: 2 }),
      row("z", { total: 7 }),
    ]);
  });

  it("re-interleaves a late-source retry into true date order", async () => {
    // After the initial migration, play continued on BOTH origins: t0 on .io,
    // then `late` back on the source, which the signature retry appended
    // AFTER t0. The adopted source rows are no longer a prefix — the exact
    // layout that rules out prefix-splicing — and the sweep's date merge
    // puts the recovered row and the retry row back in chronological order.
    const storage = new MemoryStorage();
    const s0 = { ...row("s0", { total: 1 }), date: "2026-08-11" };
    const mid = { ...row("mid", { total: 2 }), date: "2026-08-12" };
    const t0 = { ...row("t0", { total: 9 }), date: "2026-08-13" };
    const late = { ...row("late", { total: 3 }), date: "2026-08-14" };
    storage.setItem("hotstove.history", JSON.stringify([s0, t0, late]));
    storage.setItem("hotstove.adopted", marker(2));

    await commitAdoption(storage, payload([s0, mid, late], { sweep: true }));
    expect(parsed(storage, "hotstove.history")).toEqual([s0, mid, t0, late]);
    const m = parsed(storage, "hotstove.adopted") as { historyCount: number };
    expect(m.historyCount).toBe(3);
  });

  it("refuses to sweep before the initial migration completed", async () => {
    const storage = new MemoryStorage();
    storage.setItem("hotstove.adopted", marker(0, false));
    await expect(
      commitAdoption(storage, payload([row("a")], { sweep: true })),
    ).rejects.toThrow(/completed migration/);
  });

  it("stages non-final sweep chunks without touching the log", async () => {
    const storage = new MemoryStorage();
    const a = row("a", { total: 1 });
    const b = row("b", { total: 2 });
    const io = row("io", { total: 9 });
    storage.setItem("hotstove.history", JSON.stringify([a, io]));
    storage.setItem("hotstove.adopted", marker(1));

    await commitAdoption(storage, payload([a], { sweep: true, total: 2, done: false }));
    expect(parsed(storage, "hotstove.history")).toEqual([a, io]);
    expect(parsed(storage, "hotstove.migration.sweep")).toEqual([a]);

    await commitAdoption(storage, payload([b], { sweep: true, start: 1, total: 2, done: true }));
    expect(parsed(storage, "hotstove.history")).toEqual([a, b, io]);
    expect(storage.getItem("hotstove.migration.sweep")).toBeNull();
  });

  it("merges need-hop archive rows after the history already swept", async () => {
    const storage = new MemoryStorage();
    const a = row("a", { total: 1, id: "g1" });
    storage.setItem("hotstove.history", JSON.stringify([a]));
    storage.setItem("hotstove.adopted", marker(1));

    await commitAdoption(
      storage,
      payload([], {
        sweep: true,
        start: 1,
        total: 1,
        done: true,
        archive: [finale("g1")],
        archiveIds: ["g1"],
      }),
    );
    expect(parsed(storage, "hotstove.history")).toEqual([a]);
    const archive = parsed(storage, "hotstove.archive") as { id: string }[];
    expect(archive.map((r) => r.id)).toEqual(["g1"]);
  });

  it("orders the merged archive by the log and keeps record-book doors under the cap", async () => {
    const storage = new MemoryStorage();
    // 53 scored games: the oldest ("best") is the combo best; two .io games
    // are the newest and already archived here.
    const history = [
      row("best", { total: 160, id: "best", difficulty: "standard", bank: "classic" }),
      ...Array.from({ length: 50 }, (_, i) =>
        row(`old-${i}`, { total: 100 + i * 0.1, id: `old-${i}`, difficulty: "standard", bank: "classic" }),
      ),
      row("io-1", { total: 120, id: "io-1", difficulty: "standard", bank: "classic" }),
      row("io-2", { total: 121, id: "io-2", difficulty: "standard", bank: "classic" }),
    ];
    storage.setItem("hotstove.history", JSON.stringify(history));
    storage.setItem("hotstove.adopted", JSON.stringify({
      v: 1,
      source: "https://hedgertronic.com",
      historyCount: 53,
      initialComplete: true,
    }));
    storage.setItem("hotstove.archive", JSON.stringify([finale("io-1"), finale("io-2")]));

    await commitAdoption(
      storage,
      payload([], {
        sweep: true,
        start: 53,
        total: 53,
        done: true,
        archive: [finale("best"), ...Array.from({ length: 49 }, (_, i) => finale(`old-${i}`))],
        archiveIds: ["best", ...Array.from({ length: 49 }, (_, i) => `old-${i}`)],
      }),
    );
    const ids = (parsed(storage, "hotstove.archive") as { id: string }[]).map((r) => r.id);
    expect(ids).toHaveLength(50);
    // The best's door survives the cap even as the oldest row…
    expect(ids[0]).toBe("best");
    // …the two oldest non-best rows are the ones evicted, and the order is
    // the log's own (oldest first, .io newest at the tail).
    expect(ids).not.toContain("old-0");
    expect(ids).not.toContain("old-1");
    expect(ids.slice(-2)).toEqual(["io-1", "io-2"]);
  });

  it("computes the missing archive ids the loop asks for", () => {
    const storage = new MemoryStorage();
    const history = [
      row("best", { total: 160, id: "best", difficulty: "standard", bank: "classic" }),
      row("mid", { total: 100, id: "mid", difficulty: "standard", bank: "classic" }),
      row("new", { total: 110, id: "new", difficulty: "standard", bank: "classic" }),
    ];
    storage.setItem("hotstove.history", JSON.stringify(history));
    storage.setItem("hotstove.archive", JSON.stringify([finale("new")]));
    expect(missingArchiveIds(storage, ["best", "mid", "new"]).sort()).toEqual(["best", "mid"]);
  });

  it("marks sweep transfers and answers a need list with exactly those rows", async () => {
    const storage = new MemoryStorage();
    storage.setItem("hotstove.history", JSON.stringify([row("a", { total: 1, id: "g1" })]));
    storage.setItem(
      "hotstove.archive",
      JSON.stringify([finale("g1"), finale("g2"), finale("g3")]),
    );
    const transfer = await buildSourceTransfer(storage, NONCE, 0, { sweep: true, need: ["g2"] });
    expect(transfer.payload.sweep).toBe(true);
    expect(transfer.payload.archiveIds).toEqual(["g1", "g2", "g3"]);
    expect((transfer.payload.archive ?? []).map((r) => r.id)).toEqual(["g2"]);
    // And the encoded form round-trips with both sweep fields intact.
    const back = await decodeMigrationPayload(transfer.encoded);
    expect(back.sweep).toBe(true);
    expect(back.archiveIds).toEqual(["g1", "g2", "g3"]);
  });
});

describe("field-tolerant history normalization", () => {
  it("keeps a row whose optional field an old build corrupted", () => {
    expect(normalizeHistoryRow({ date: "2026-01-01", total: 5, seed: "oops" })).toEqual({
      date: "2026-01-01",
      total: 5,
    });
  });

  it("keeps a scored row whose date is missing", () => {
    expect(normalizeHistoryRow({ total: 5 })).toEqual({ date: "", total: 5 });
  });
});

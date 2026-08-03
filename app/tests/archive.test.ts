/** The replayable archive, and the log it must never touch.
 *
 * A finale is ~5.4KB and a log row is ~420 bytes, so only one of the two can be
 * kept forever. The split is the whole design: `hotstove.history` stays
 * uncapped and complete because the trophy case and the passport are lifetime
 * UNIONS over it, and `hotstove.archive` holds a bounded tail of the finales
 * those rows can be walked back into.
 *
 * The trap this file exists to nail down is that the cap never reaches the log.
 * A season evicted from the archive loses exactly one thing — the ability to be
 * reopened — and keeps its badges, its stamps, its record and its place in the
 * count.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  ARCHIVE_CAP,
  appendHistory,
  archiveGame,
  earnedBadgeKeys,
  loadArchive,
  loadHistory,
  type ArchivedFinale,
} from "../src/lib/history";
import { passport } from "../src/lib/settings";

const ARCHIVE_KEY = "hotstove.archive";
const HISTORY_KEY = "hotstove.history";

/** Every storage access in these modules is guarded; node needs a stub to
 * guard. `limit` is the quota: a write past it throws the way a real
 * localStorage throws when the origin is full. */
const store = new Map<string, string>();
let limit = Infinity;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (v.length > limit) throw new Error("QuotaExceededError");
    store.set(k, v);
  },
  removeItem: (k: string) => void store.delete(k),
};

/** The smallest record `loadArchive` accepts: an id, a total the ledger can
 * dereference, and a roster array. Hand-shaped rather than played — the cap is
 * a storage rule, and 51 real games would test the engine instead. */
function rec(id: string, total = 100): ArchivedFinale {
  return {
    id,
    v: 1,
    seed: 42,
    config: { difficulty: "standard", bank: "classic" },
    spinCount: 8,
    seen: [],
    slots: [],
    owner: null,
    stadium: null,
    manager: null,
    finale: { parts: { total } },
  } as unknown as ArchivedFinale;
}

/** One finished season in the log, pointing at the archive record of the same
 * id — the pairing the seasons list resolves a row against. */
function logged(id: string, over: Record<string, unknown> = {}): void {
  appendHistory({
    v: 2,
    id,
    date: "2026-08-02",
    seed: 42,
    total: 100,
    record: "100-62",
    difficulty: "standard",
    bank: "classic",
    ...over,
  });
}

beforeEach(() => {
  store.clear();
  limit = Infinity;
});

describe("the cap", () => {
  it("keeps everything up to the cap, oldest first", () => {
    for (let i = 0; i < ARCHIVE_CAP; i++) archiveGame(rec(`g${i}`));
    const rows = loadArchive();
    expect(rows).toHaveLength(ARCHIVE_CAP);
    expect(rows[0].id).toBe("g0");
    expect(rows.at(-1)!.id).toBe(`g${ARCHIVE_CAP - 1}`);
  });

  it("evicts the oldest once it is full, never the newest", () => {
    for (let i = 0; i <= ARCHIVE_CAP; i++) archiveGame(rec(`g${i}`));
    const rows = loadArchive();
    expect(rows).toHaveLength(ARCHIVE_CAP);
    // The first game archived is the first one gone.
    expect(rows.map((r) => r.id)).not.toContain("g0");
    expect(rows[0].id).toBe("g1");
    expect(rows.at(-1)!.id).toBe(`g${ARCHIVE_CAP}`);
  });

  it("holds the cap over a long career instead of growing", () => {
    for (let i = 0; i < ARCHIVE_CAP * 4; i++) archiveGame(rec(`g${i}`));
    expect(loadArchive()).toHaveLength(ARCHIVE_CAP);
    expect(loadArchive().at(-1)!.id).toBe(`g${ARCHIVE_CAP * 4 - 1}`);
  });
});

describe("what the cap must never cost", () => {
  it("leaves the log complete, so an evicted season still counts", () => {
    // A career past the cap: every game logged, every game archived.
    const games = ARCHIVE_CAP + 12;
    for (let i = 0; i < games; i++) {
      logged(`g${i}`, {
        badges: [`badge${i}`],
        countries: [`Country ${i}`],
        countryPlayers: { [`Country ${i}`]: [`p${i}`] },
      });
      archiveGame(rec(`g${i}`));
    }

    // THE TRAP, asserted directly: the archive is capped and the log is not.
    expect(loadArchive()).toHaveLength(ARCHIVE_CAP);
    expect(loadHistory()).toHaveLength(games);

    // g0 is long gone from the archive…
    const kept = new Set(loadArchive().map((r) => r.id));
    expect(kept.has("g0")).toBe(false);
    // …and every lifetime union still sees the season it played.
    expect(loadHistory()[0].id).toBe("g0");
    expect(earnedBadgeKeys().has("badge0")).toBe(true);
    expect(passport().map((s) => s.country)).toContain("Country 0");
    // Including the player it counted, which only the row can supply.
    expect(passport().find((s) => s.country === "Country 0")!.players).toBe(1);
  });

  it("never writes to the log's key at all", () => {
    logged("g0");
    const log = store.get(HISTORY_KEY);
    for (let i = 0; i < ARCHIVE_CAP * 2; i++) archiveGame(rec(`g${i}`));
    expect(store.get(HISTORY_KEY)).toBe(log);
  });
});

describe("quits", () => {
  it("never gain a score, an id, or an archive record", () => {
    // A quit as `recordQuit` writes one: a date, one badge, and nothing else.
    appendHistory({ date: "2026-08-02", badges: ["packedin"] });
    logged("g1");
    archiveGame(rec("g1"));

    const [quit, season] = loadHistory();
    expect(quit.total).toBeUndefined();
    expect(quit.id).toBeUndefined();
    expect(quit.seed).toBeUndefined();
    // Archiving a season leaves the quit exactly as it was written.
    expect(quit).toEqual({ date: "2026-08-02", badges: ["packedin"] });
    // And the archive holds only the row that resolved a season.
    expect(loadArchive().map((r) => r.id)).toEqual(["g1"]);
    expect(season.id).toBe("g1");
    // Which is what keeps the quit out of the seasons list: the list guards on
    // a numeric total, the same marker `bestFor` counts games with.
    expect(loadHistory().filter((e) => typeof e.total === "number")).toHaveLength(1);
    // The badge it earned is still the player's, forever.
    expect(earnedBadgeKeys().has("packedin")).toBe(true);
  });
});

describe("a full or unreadable store", () => {
  it("evicts the oldest until the write fits, keeping the newest", () => {
    for (let i = 0; i < 5; i++) archiveGame(rec(`g${i}`));
    expect(loadArchive()).toHaveLength(5);

    // Room for three records from here on.
    limit = store.get(ARCHIVE_KEY)!.length * (3 / 5);
    archiveGame(rec("g5"));

    const rows = loadArchive();
    expect(rows.length).toBeLessThan(5);
    expect(rows.at(-1)!.id).toBe("g5");
    // Evicting from the oldest end, exactly as the cap does.
    expect(rows.map((r) => r.id)).not.toContain("g0");
  });

  it("leaves the archive standing when not even one record fits", () => {
    for (let i = 0; i < 3; i++) archiveGame(rec(`g${i}`));
    const before = store.get(ARCHIVE_KEY);
    limit = 1;
    archiveGame(rec("g3"));
    // The seasons already reopenable stay reopenable; only the newest is lost.
    expect(store.get(ARCHIVE_KEY)).toBe(before);
    expect(loadArchive().map((r) => r.id)).toEqual(["g0", "g1", "g2"]);
  });

  it("reads corrupt or wrong-shaped storage as an empty archive", () => {
    store.set(ARCHIVE_KEY, "{not json at all");
    expect(loadArchive()).toEqual([]);
    store.set(ARCHIVE_KEY, JSON.stringify({ g0: rec("g0") }));
    expect(loadArchive()).toEqual([]);
  });

  it("drops records the finale screen could not render", () => {
    const good = rec("g1");
    store.set(
      ARCHIVE_KEY,
      JSON.stringify([
        { ...good, id: undefined },
        { ...good, id: "g2", finale: { parts: {} } },
        { ...good, id: "g3", slots: "not an array" },
        good,
      ]),
    );
    // The same two dereferences `loadStoredFinale` guards, plus the id that
    // ties a record to its row. A record that cannot be rendered is no record.
    expect(loadArchive().map((r) => r.id)).toEqual(["g1"]);
  });
});

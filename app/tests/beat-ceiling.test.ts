/** Unit tests for beatCeilingDecision — the pure function that decides whether
 * the played club beat the dream team and resolves the scout-hit count.
 *
 * beatCeiling is TRUE when the player's raw point total strictly exceeds the
 * solver's unclamped answer. Point-based, no [0,162] clamp: a margin too
 * small to move the on-screen record still counts, so two clubs that both
 * stamp 162–0 are separated by their totals. Strict greater-than only: a tie
 * is not a win.
 *
 * When true, scoutHits upgrades to Math.max(rawScoutHits, dreamSeats) so the
 * scoring doesn't penalise the player for not copying a club they already beat.
 * Math.max guarantees monotonicity — the upgrade never lowers the count. */
import { describe, expect, it } from "vitest";
import { beatCeilingDecision, beatDreamDecision } from "../src/lib/engine.svelte";

// Engine save()/restore() accesses localStorage; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe("beatCeilingDecision", () => {
  it("player total > dream total → beatCeiling true, scoutHits upgraded", () => {
    const result = beatCeilingDecision(120, 100, 4, 9);
    expect(result.beatCeiling).toBe(true);
    expect(result.scoutHits).toBe(9); // upgraded to dreamSeats
  });

  it("player total === dream total → beatCeiling false, scoutHits unchanged", () => {
    const result = beatCeilingDecision(100.4, 100.4, 4, 9);
    expect(result.beatCeiling).toBe(false);
    expect(result.scoutHits).toBe(4);
  });

  it("player total < dream total → beatCeiling false, scoutHits unchanged", () => {
    const result = beatCeilingDecision(95, 110, 7, 9);
    expect(result.beatCeiling).toBe(false);
    expect(result.scoutHits).toBe(7);
  });

  it("same clamped wins, higher total → beatCeiling true", () => {
    // 100.4 and 100.3 both stamp 100 wins on screen; the margin still counts.
    const result = beatCeilingDecision(100.4, 100.3, 4, 9);
    expect(result.beatCeiling).toBe(true);
    expect(result.scoutHits).toBe(9);
  });

  it("solvedTotal null (offline mid-game) → beatCeiling false, scoutHits unchanged", () => {
    const result = beatCeilingDecision(120, null, 5, 9);
    expect(result.beatCeiling).toBe(false);
    expect(result.scoutHits).toBe(5);
  });

  it("both stamp 162–0 — the higher total still wins", () => {
    // Player 180 points, dream 175: both read 162 wins on screen, but the
    // point comparison is unclamped.
    const above = beatCeilingDecision(180, 175, 6, 9);
    expect(above.beatCeiling).toBe(true);
    expect(above.scoutHits).toBe(9);
    const below = beatCeilingDecision(175, 180, 6, 9);
    expect(below.beatCeiling).toBe(false);
    expect(below.scoutHits).toBe(6);
  });

  it("exactly one point above the dream total → beatCeiling true", () => {
    const result = beatCeilingDecision(101, 100, 3, 8);
    expect(result.beatCeiling).toBe(true);
    expect(result.scoutHits).toBe(8);
  });

  it("scoutHits upgrade uses Math.max — never lowers below rawScoutHits", () => {
    // dreamSeats=2 is LESS than rawScoutHits=7 — upgrade must not lower it
    const result = beatCeilingDecision(120, 100, 7, 2);
    expect(result.beatCeiling).toBe(true);
    expect(result.scoutHits).toBe(7); // max(7, 2) = 7
  });

  it("scoutHits upgrade when dreamSeats > rawScoutHits", () => {
    const result = beatCeilingDecision(120, 100, 3, 9);
    expect(result.beatCeiling).toBe(true);
    expect(result.scoutHits).toBe(9); // max(3, 9) = 9
  });

  it("no beatCeiling → scoutHits is always the raw value regardless of dreamSeats", () => {
    const result = beatCeilingDecision(90, 110, 2, 9);
    expect(result.beatCeiling).toBe(false);
    expect(result.scoutHits).toBe(2);
  });
});

describe("the badges read RAW scout hits, never the beatCeiling upgrade", () => {
  /* Source-level pin, the chip-centering suite's technique: the engine's
   * earnedBadges call must feed `scoutHits: scoutHitsRaw`, so 🌠 THE DREAM
   * TEAM stays a claim about genuinely matching all nine seats. Feeding the
   * upgraded count made outscouting the solver (🦉's feat) auto-earn 🌠 while
   * the finale's dream-team column visibly differed from the player's club. */
  it("the engine's badge facts carry scoutHitsRaw", async () => {
    const fs = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const src = fs.default.readFileSync(
      fileURLToPath(new URL("../src/lib/engine.svelte.ts", import.meta.url)),
      "utf8",
    );
    const call = src.slice(src.indexOf("earnedBadges({"));
    expect(call).toContain("scoutHits: scoutHitsRaw,");
  });
});

/** 🧠's own rule since the round-twelve split: BASELINE WINS against the
 * dream club (expected wins from WAR + skipper), never the total — the
 * total is 🦉's, through the stamp press above. MANAGER_PER_NET_WIN is 0.25
 * in scoring.ts, so netWins 40 is worth ten expected wins here. */
describe("beatDreamDecision", () => {
  it("more baseline wins than the dream club → true", () => {
    // Player expectedWins 110 vs dream 50 + 55 WAR + 40·0.25 = 115? no —
    // 50 + 50 WAR = 100, no manager. 110 > 100.
    expect(beatDreamDecision(110, { totalWar: 50, manager: null })).toBe(true);
  });

  it("the dream skipper's net wins count against the player", () => {
    // Dream baseline = 50 + 55 + 40·0.25 = 115; player 110 falls short of
    // the same roster without the skipper's ten.
    expect(beatDreamDecision(110, { totalWar: 55, manager: { netWins: 40 } })).toBe(false);
    expect(beatDreamDecision(115.1, { totalWar: 55, manager: { netWins: 40 } })).toBe(true);
  });

  it("a rounding tie is a matched baseline, not a win", () => {
    // Both sides press through round1: dream 50 + 60 = 110.0 exactly.
    expect(beatDreamDecision(110, { totalWar: 60 })).toBe(false);
  });

  it("the comparison ignores totals entirely — awards cannot buy it", () => {
    // A club can hold MORE total points and still not out-build the dream
    // roster; the decision reads only expected wins, which the caller passes.
    // (Sanity of the contract: the function takes no total at all.)
    expect(beatDreamDecision(99.9, { totalWar: 50 })).toBe(false);
  });

  it("both clamp at 162 the way the ledger does — no phantom wins above the schedule", () => {
    // expectedWins clamps at GAMES, so a 130-WAR dream club still reads 162;
    // a player at the same clamp has not beaten it.
    expect(beatDreamDecision(162, { totalWar: 130 })).toBe(false);
  });

  it("a null solve fails safe", () => {
    expect(beatDreamDecision(162, null)).toBe(false);
  });
});

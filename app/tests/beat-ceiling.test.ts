/** Unit tests for beatCeilingDecision — the pure function that decides whether
 * the played club beat the dream team on wins and resolves the scout-hit count.
 *
 * beatCeiling is TRUE when the player's clamped win total (recordFromTotal of
 * parts.total) strictly exceeds the dream team's clamped win total (same
 * ladder applied to the solver's unclamped answer). Strict greater-than only:
 * a tie is not a win.
 *
 * When true, scoutHits upgrades to Math.max(rawScoutHits, dreamSeats) so the
 * scoring doesn't penalise the player for not copying a club they already beat.
 * Math.max guarantees monotonicity — the upgrade never lowers the count.
 *
 * The clamping means two clubs both above 162 points both read 162 wins and
 * neither beats the other (beatCeiling false, beatDream can still be true).
 * The badge agent keying off beatCeiling should know it is win-based and
 * clamps at 162 (round 28). */
import { describe, expect, it } from "vitest";
import { beatCeilingDecision } from "../src/lib/engine.svelte";

// Engine save()/restore() accesses localStorage; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

describe("beatCeilingDecision", () => {
  it("player wins > dream wins → beatCeiling true, scoutHits upgraded", () => {
    // Player 120 points (~120 wins), dream 100 points (~100 wins)
    const result = beatCeilingDecision(120, 100, 4, 9);
    expect(result.beatCeiling).toBe(true);
    expect(result.scoutHits).toBe(9); // upgraded to dreamSeats
  });

  it("player wins === dream wins → beatCeiling false, scoutHits unchanged", () => {
    // Both round to the same integer wins — tie is not a win
    const result = beatCeilingDecision(100.3, 100.4, 4, 9);
    expect(result.beatCeiling).toBe(false);
    expect(result.scoutHits).toBe(4);
  });

  it("player wins < dream wins → beatCeiling false, scoutHits unchanged", () => {
    const result = beatCeilingDecision(95, 110, 7, 9);
    expect(result.beatCeiling).toBe(false);
    expect(result.scoutHits).toBe(7);
  });

  it("solvedTotal null (offline mid-game) → beatCeiling false, scoutHits unchanged", () => {
    const result = beatCeilingDecision(120, null, 5, 9);
    expect(result.beatCeiling).toBe(false);
    expect(result.scoutHits).toBe(5);
  });

  it("both totals clamp to 162 wins — tie, beatCeiling false even if beatDream true", () => {
    // Player 175 points, dream 180 points: both exceed 162 games cap → 162 wins each
    const result = beatCeilingDecision(175, 180, 6, 9);
    expect(result.beatCeiling).toBe(false);
    expect(result.scoutHits).toBe(6); // unchanged despite player beating dream in points
  });

  it("exactly one point above the dream wins boundary → beatCeiling true", () => {
    // Player rounds to 101 wins, dream rounds to 100 wins
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

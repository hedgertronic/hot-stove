/** THE CEILING at the finale: what the dream club would have gone, and the two
 * front offices — the one hired and the one the solver would have hired.
 *
 * Rendered SSR (render() from svelte/server) rather than mounted, for the same
 * reason finale-reveal.test.ts is: mounting starts the reveal timers, the
 * requestAnimationFrame count-ups, and the canvas-confetti dynamic import, none
 * of which is the contract under test. Neither the ceiling block nor the
 * front-office rows are animated — both are pure functions of the finale's own
 * fields — so SSR sees them whole.
 *
 * Five contracts:
 * 1. The ceiling is TWO NUMBERS AND NOTHING ELSE — a record and its exact
 *    points, the stamp's own two lines. No tagline, no near-miss callout, no
 *    congratulation. The gap between the two records is the message.
 * 2. The caption is true of the ROSTER IT SITS ON: it prints the solved
 *    total (`best.total`) — the club actually listed — and only falls back to
 *    the stored `bestPossibleTotal` when a finale predates the field.
 * 3. The dream club's record prints even when the player's club beat it.
 *    🦉 OUTSCOUTED is a claim about exactly this number, and the badge only
 *    lands if the number it beat is on screen to be beaten.
 * 4. Each club's front office is a PAYROLL BLOCK, not two more roster rows —
 *    owner × ballpark = payroll, over the spend meter, in the bank box's own
 *    vocabulary. Both lists get one, in the same place, so they compare. Owner
 *    and ballpark earn no scout point, so nothing in either block carries a
 *    found cue and the ⭐ denominator stays 9.
 * 5. All the new fields are optional. A finale restored from a save older than
 *    them renders no ceiling — not a hole, and not the string "undefined".
 */
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import Finale from "../src/components/Finale.svelte";
import {
  finaleCeilingAbove,
  finaleCeilingFixedBank,
  finaleCeilingMatched,
  finaleCeilingMet,
  finaleCeilingPerfect,
  finaleCeilingSameRecord,
  finaleOver,
  finaleUnder,
} from "../src/lab/fixtures";
import { GAMES, MARINERS_WINS } from "../src/lib/scoring";
import { money, recordFromTotal } from "../src/lib/format";
import type { Game } from "../src/lib/engine.svelte";

// The engine's save()/restore() and the settings/history readers guard storage
// access; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ssr(component: Component<any>, props: Record<string, unknown>): string {
  return render(component, { props }).body;
}

/** The two roster lists as separate slices. Asserting on a slice rather than
 * the body is what lets "no ceiling record printed" fail: the player's own
 * stamp carries a record too, and both lists now carry an OWNER row. */
function lists(game: Game): { squad: string; dream: string } {
  const body = ssr(Finale, { game, onreplay: () => {}, onmodes: () => {} });
  const sq = body.indexOf("YOUR SQUAD");
  const dr = body.indexOf("⭐ THE DREAM TEAM");
  expect(sq).toBeGreaterThan(-1);
  expect(dr).toBeGreaterThan(sq);
  return { squad: body.slice(sq, dr), dream: body.slice(dr) };
}

const dreamOf = (game: Game) => lists(game).dream;

/** The payroll block of one list, as its own markup — so a cue assertion lands
 * on THAT block and not on the seats above it, which legitimately carry cues.
 * (Svelte appends a scoped class, hence the open-ended class match.) */
function payrollBlock(slice: string): string[] {
  // Opening tag through the close of its SPENT/LEFT legend — the whole block,
  // and nothing after it.
  const block = /<div class="pay disp[^"]*">[\s\S]*?<div class="paylbl[^"]*">[\s\S]*?<\/div>/g;
  return [...slice.matchAll(block)].map((m) => m[0]);
}

/** The record the player's own stamp shows, from the same ladder the stamp
 * uses — so a test comparing the two records compares what is on screen. */
function stampRecord(game: Game): string {
  const r = recordFromTotal(game.finale!.parts.total, GAMES, MARINERS_WINS);
  return `${r.wins}–${r.losses}`;
}

describe("the ceiling block", () => {
  it("is a record and its exact points, read from the engine's own fields", () => {
    const g = finaleCeilingAbove();
    const fin = g.finale!;
    const dream = dreamOf(g);
    // Read, not recomputed: the string on screen is bestPossibleRecord itself.
    expect(dream).toContain(`${fin.bestPossibleRecord!.wins}–${fin.bestPossibleRecord!.losses}`);
    expect(dream).toContain(`${fin.bestPossibleTotal!.toFixed(1)} PTS`);
    // And it really is a ceiling: above the club built, on both scales.
    expect(fin.bestPossibleTotal!).toBeGreaterThan(fin.parts.total);
    expect(fin.bestPossibleRecord!.wins).toBeGreaterThan(
      recordFromTotal(fin.parts.total, GAMES, MARINERS_WINS).wins,
    );
  });

  it("says nothing about itself — the gap between the two records is the message", () => {
    // The label element is the ONE place words can appear in this block, and it
    // exists for a single dishonest-number case. Anywhere else its absence is
    // the contract: no tagline, no near-miss callout, no consolation.
    for (const g of [finaleCeilingAbove(), finaleCeilingPerfect(), finaleCeilingMet()]) {
      const dream = dreamOf(g);
      expect(dream).not.toContain("ctag");
      expect(dream).not.toMatch(/WOULD HAVE|COULD HAVE|ON THE TABLE|PERFECT SEASON|YOU /);
    }
  });

  it("a ≥162 ceiling caps at 162–0 and keeps the number that earned it", () => {
    const g = finaleCeilingPerfect();
    const fin = g.finale!;
    expect(fin.bestPossibleRecord!.wins).toBe(GAMES);
    const dream = dreamOf(g);
    expect(dream).toContain(`${GAMES}–0`);
    expect(dream).toContain(`${fin.bestPossibleTotal!.toFixed(1)} PTS`);
    expect(fin.bestPossibleTotal!).toBeGreaterThan(GAMES);
  });

  it("a ceiling that rounds to the player's own record still reads honestly", () => {
    // The rounding edge: higher points, identical W–L. The points line beneath
    // carries the whole difference — the same job it does under the stamp — so
    // the two records matching is not a contradiction. If this fixture ever
    // stops landing on the edge, these assertions fail loudly rather than
    // silently retesting the ordinary case.
    const g = finaleCeilingSameRecord();
    const fin = g.finale!;
    expect(fin.playedTheCeiling).toBe(false);
    expect(fin.bestPossibleTotal!).toBeGreaterThan(fin.parts.total);
    expect(`${fin.bestPossibleRecord!.wins}–${fin.bestPossibleRecord!.losses}`).toBe(stampRecord(g));
    const dream = dreamOf(g);
    expect(dream).toContain(stampRecord(g));
    expect(dream).toContain(`${fin.bestPossibleTotal!.toFixed(1)} PTS`);
    // The points are what differ, and they must differ on screen too.
    expect(fin.bestPossibleTotal!.toFixed(1)).not.toBe(fin.parts.total.toFixed(1));
  });
});

describe("a solver club the player outbuilt", () => {
  it("the solver agreeing with the club built prints the numbers like any other", () => {
    const g = finaleCeilingMet();
    const fin = g.finale!;
    expect(fin.playedTheCeiling).toBe(true);
    expect(fin.best!.total).toBe(fin.parts.total);
    const dream = dreamOf(g);
    // Equal to the stamp, and true of the roster below — so it prints.
    expect(dream).toContain(stampRecord(g));
    expect(dream).toContain(`${fin.parts.total.toFixed(1)} PTS`);
  });

  it("the solver's own club scoring LESS prints ITS OWN numbers, beaten and all", () => {
    const g = finaleCeilingMatched();
    const fin = g.finale!;
    expect(fin.playedTheCeiling).toBe(true);
    // The search lost to a line it does not model — the player outbuilt it.
    expect(fin.best!.total!).toBeLessThan(fin.parts.total);
    const dream = dreamOf(g);
    // The caption is the SOLVED club's record and points, not the clamped
    // ceiling: it captions the roster listed beneath it, and a beaten number
    // on screen is what makes 🦉 OUTSCOUTED legible as an achievement.
    const solvedRec = recordFromTotal(fin.best!.total!, GAMES, MARINERS_WINS);
    expect(dream).toContain(`${solvedRec.wins}–${solvedRec.losses}`);
    expect(dream).toContain(`${fin.best!.total!.toFixed(1)} PTS`);
    expect(dream).not.toContain("BEST CLUB WE FOUND");
  });

  it("no solved total falls back to the stored ceiling number", () => {
    // best.total is optional: absent on saves and fixtures that predate it.
    // The stored bestPossibleTotal is the only number left, so it prints.
    const g = finaleCeilingMet();
    delete g.finale!.best!.total;
    const dream = dreamOf(g);
    expect(dream).toContain(`${g.finale!.bestPossibleTotal!.toFixed(1)} PTS`);
    expect(dream).not.toContain("BEST CLUB WE FOUND");
  });
});

describe("the two payroll blocks", () => {
  it("YOUR SQUAD's is the club's own payroll math, hires, and spend", () => {
    const { squad } = lists(finaleCeilingAbove());
    const g = finaleCeilingAbove();
    // owner budget × ballpark multiplier = payroll, and the product is the
    // finale's own budget field — the ledger's payroll row sums against it.
    expect(squad).toContain("💰 $92.1M");
    expect(squad).toContain("🏟️ 1.05");
    expect(squad).toContain(money(g.finale!.budget));
    expect(squad).toContain("Hiroshi Yamauchi");
    expect(squad).toContain("Safeco Field");
    // The meter's legend: what went out, and what was left.
    expect(squad).toContain("SPENT");
    expect(squad).toContain(money(g.finale!.spend));
    expect(squad).toContain(money(g.finale!.budget - g.finale!.spend));
    expect(squad).toContain("LEFT");
  });

  it("THE DREAM TEAM's is the same block, in the same place", () => {
    const g = finaleCeilingAbove();
    const best = g.finale!.best!;
    const { squad, dream } = lists(g);
    // The solver stores card coordinates, not a name (it never loads
    // owners.json); the finale resolves the name off the same table the draft
    // screen reads.
    expect(dream).toContain("Hiroshi Yamauchi");
    expect(dream).toContain("Network Associates Coliseum");
    expect(dream).toContain("🏟️ 0.86");
    expect(dream).toContain(money(best.budget!));
    expect(dream).toContain(money(best.spend!));
    // Exactly one block per list, and it closes the list rather than heading it
    // — the seats come first in both.
    for (const slice of [squad, dream]) {
      expect(payrollBlock(slice).length).toBe(1);
      expect(slice.indexOf("MGR")).toBeLessThan(slice.indexOf("SPENT"));
    }
  });

  it("carries no found cue in either list, even when the two owners match", () => {
    const g = finaleCeilingAbove();
    // The fixture hires the very card the solver would have: a coincidence the
    // display must not stage as an achievement.
    expect(g.owner!.franchise).toBe(g.finale!.best!.owner!.franchise);
    expect(g.owner!.year).toBe(g.finale!.best!.owner!.year);
    const { squad, dream } = lists(g);
    for (const slice of [squad, dream]) {
      for (const block of payrollBlock(slice)) {
        expect(block).not.toContain("qstar");
        expect(block).not.toContain("⭐");
        expect(block).not.toContain("dreamhit");
      }
    }
    // And the scouting denominator is untouched: nine seats, nine possible ⭐.
    expect(g.finale!.scoutHits).toBeLessThanOrEqual(9);
  });

  it("a fixed cap shows the payroll without the math it never did", () => {
    const g = finaleCeilingFixedBank();
    expect(g.owner).toBeNull();
    expect(g.stadium).toBeNull();
    expect(g.finale!.best!.owner).toBeUndefined();
    const { squad, dream } = lists(g);
    expect(dream).toContain(
      `${g.finale!.bestPossibleRecord!.wins}–${g.finale!.bestPossibleRecord!.losses}`,
    );
    for (const slice of [squad, dream]) {
      // The block is still there — the payroll and the meter are the point —
      // but there is no owner to hire, no ballpark to buy, and no × to show.
      expect(payrollBlock(slice).length).toBe(1);
      expect(slice).toContain("PAYROLL");
      expect(slice).toContain("SPENT");
      expect(slice).not.toContain("🏟️");
      expect(slice).not.toContain("undefined");
      // The hires line still names the club the mode borrows its payroll from
      // — Moneyball is the 2002 A's — which is what keeps the box ONE height
      // across every mode, in the finale exactly as in the game.
      expect(slice).toContain("Stephen Schott &amp; Ken Hofmann");
    }
  });

  it("an over-payroll club swaps the LEFT figure for the overrun", () => {
    const g = finaleOver();
    const { squad } = lists(g);
    expect(g.finale!.spend).toBeGreaterThan(g.finale!.budget);
    // The overrun reads as an amount and the word OVER, in the slot the
    // remaining bankroll would have used.
    expect(squad).toContain("OVER");
    expect(squad).toContain(money(g.finale!.spend - g.finale!.budget));
    expect(squad).not.toContain("LEFT");
  });
});

describe("a finale older than any of this", () => {
  it("renders no ceiling and no front office, and prints no hole", () => {
    const g = finaleUnder();
    const fin = g.finale!;
    // The fixture is the old-record path by construction: the fields never
    // existed on it.
    expect(fin.bestPossibleTotal).toBeUndefined();
    expect(fin.bestPossibleRecord).toBeUndefined();
    expect(fin.playedTheCeiling).toBeUndefined();
    const { squad, dream } = lists(g);
    expect(dream).not.toContain("BEST CLUB WE FOUND");
    expect(dream).not.toContain("PTS");
    // The player's payroll block still renders — spend and budget are required
    // fields on every finale ever written — but with no front office on record
    // it shows the payroll alone, and no hires line.
    expect(payrollBlock(squad).length).toBe(1);
    expect(squad).toContain(money(g.finale!.budget));
    expect(squad).toContain("SPENT");
    expect(squad).not.toContain("🏟️");
    // The dream club's is optional both ways and simply isn't there.
    expect(g.finale!.best!.budget).toBeUndefined();
    expect(payrollBlock(dream).length).toBe(0);
    for (const slice of [squad, dream]) {
      expect(slice).not.toContain("undefined");
      expect(slice).not.toContain("NaN");
    }
  });

  it("a missing stored record cannot hollow the caption — it derives its own", () => {
    // The caption computes its record from the total it prints
    // (recordFromTotal over the solved total), so a half-migrated record —
    // total present, `bestPossibleRecord` gone — still renders both lines,
    // and the two can never disagree.
    const g = finaleCeilingAbove();
    g.finale!.bestPossibleRecord = null;
    const dream = dreamOf(g);
    expect(dream).toContain("PTS");
    expect(dream).not.toContain("undefined");
    expect(dream).not.toContain("NaN");
  });
});

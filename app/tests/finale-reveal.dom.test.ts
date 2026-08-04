/** THE CHOREOGRAPHY: what the finale reveals, and in what order.
 *
 * The payoff is read in the order it was earned — the record, then what the
 * record won, then where the club that won it came from — and each beat waits
 * for the one before it to FINISH rather than firing on a clock of its own. The
 * badge row deals left to right, so the passport's cue is measured off the last
 * pill; a passport that opened with the badges would be a fourth object landing
 * in a beat already carrying nine.
 *
 * Mounted rather than SSR, unlike the two contracts in finale-reveal.test.ts:
 * the reveal lives in a client `$effect`, and svelte/server never runs one — an
 * SSR string is the unrevealed state for every finale and could not tell one
 * beat from another.
 *
 * Fake `setTimeout` only. Every beat is a `setTimeout`, so that is the whole
 * clock this file has to drive; `requestAnimationFrame` (the count-ups) is
 * stubbed to never call back, because an rAF-as-setTimeout stub re-schedules
 * itself inside the same virtual instant and `advanceTimersByTime` spins on it.
 * The counters therefore sit at zero here, which costs nothing: the contract is
 * WHEN each block appears, not what number it settles on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Finale from "../src/components/Finale.svelte";
import { finaleUnder } from "../src/lab/fixtures";
import type { Game } from "../src/lib/engine.svelte";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
// The stamp beat imports canvas-confetti; jsdom has no 2D context to draw on.
vi.mock("canvas-confetti", () => ({ default: () => {} }));
vi.stubGlobal("requestAnimationFrame", () => 0);

/** finaleUnder with birth countries on its seats — the passport is built off
 * `game.slots`, and no lab fixture carries a `bc`, so a club that has fielded
 * somebody is assembled here. USA and the Dominican Republic are spelled as the
 * country table in settings.ts spells them. */
function clubWithCountries(): Game {
  const g = finaleUnder();
  const countries = ["USA", "USA", "Dominican Republic", "USA", "Venezuela", "USA", "Cuba", "USA"];
  g.slots.forEach((s, i) => {
    if (s) s.bc = countries[i];
  });
  return g;
}

let host: HTMLElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any = null;

beforeEach(() => {
  store.clear();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  if (app) unmount(app);
  host?.remove();
  app = null;
  host = null;
  vi.useRealTimers();
});

function render(resolved = false, game: Game = clubWithCountries()): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = mount(Finale, {
    target: host,
    props: { game, onreplay: () => {}, onmodes: () => {}, resolved },
  });
  flushSync();
  return host;
}

const recordUp = (el: HTMLElement) => el.querySelector(".total-stamp")?.classList.contains("show");
const badgesUp = (el: HTMLElement) => el.querySelector(".brags") !== null;
const passUp = (el: HTMLElement) => el.querySelector(".clubpass")?.classList.contains("show");

/** The tick each block first appears on, walking the reveal 50ms at a time. */
function beats(el: HTMLElement): { record: number; badges: number; pass: number } {
  const at: Record<string, number> = {};
  for (let t = 0; t <= 15000; t += 50) {
    vi.advanceTimersByTime(50);
    flushSync();
    if (at.record === undefined && recordUp(el)) at.record = t;
    if (at.badges === undefined && badgesUp(el)) at.badges = t;
    if (at.pass === undefined && passUp(el)) at.pass = t;
  }
  return at as { record: number; badges: number; pass: number };
}

describe("the reveal's order", () => {
  it("lands the record, then the badges, then the passport", () => {
    const el = render();
    const at = beats(el);
    // Each has to actually arrive: an undefined here would make the
    // comparisons below vacuous.
    for (const b of [at.record, at.badges, at.pass]) expect(b).toBeGreaterThan(0);
    expect(at.record).toBeLessThan(at.badges);
    // STRICTLY after, not with: the badge row is still dealing pills when the
    // stamp beat's own timer has fired, and the passport waits out the deal.
    expect(at.badges).toBeLessThan(at.pass);
  });

  it("draws the three in that order down the page, too", () => {
    const el = render();
    beats(el);
    const stamp = el.querySelector(".total-stamp")!;
    const brags = el.querySelector(".brags")!;
    const pass = el.querySelector(".clubpass")!;
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(stamp, brags)).toBe(true);
    expect(follows(brags, pass)).toBe(true);
  });

  it("holds the passport's box from the first frame rather than inserting it", () => {
    // The passport sits between the badges and the exits, so a block that
    // appeared when its beat came would shove RUN IT BACK / SHARE down under a
    // thumb already reaching for them. It is mounted and transparent instead.
    const el = render();
    const pass = el.querySelector(".clubpass");
    expect(pass).not.toBeNull();
    expect(pass!.classList.contains("show")).toBe(false);
    expect(recordUp(el)).toBe(false);
    expect(badgesUp(el)).toBe(false);
  });

  it("renders no passport at all for a club whose seats carry no country", () => {
    // Every save written before birth countries existed. Nothing to reveal, so
    // nothing is drawn — not an empty box waiting on a beat.
    const el = render(false, finaleUnder());
    expect(el.querySelector(".clubpass")).toBeNull();
    beats(el);
    expect(el.querySelector(".clubpass")).toBeNull();
  });

  it("shows all three at once on a finale restored from storage", () => {
    // The reveal is the payoff for the game that produced it; a reopened season
    // is settled from the first frame, passport included.
    const el = render(true);
    expect(recordUp(el)).toBe(true);
    expect(badgesUp(el)).toBe(true);
    expect(passUp(el)).toBe(true);
  });
});

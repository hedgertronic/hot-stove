/** A restored finale opens already-resolved.
 *
 * The three-beat reveal — rows dealing out, the drumroll, the stamp popping
 * with its count-up and confetti — is the payoff for the game that produced it.
 * A reload is not that game. Re-watching it on every refresh turns the payoff
 * into a toll, so a finale restored from storage renders the settled state
 * directly, down the same branch `prefers-reduced-motion` already takes.
 *
 * Mounted, not SSR: the reveal lives in a client `$effect`, which svelte/server
 * never runs — an SSR string is the unrevealed state for every finale and could
 * not tell the two paths apart.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flushSync, mount, unmount } from "svelte";
import Finale from "../src/components/Finale.svelte";
import { finaleBad, finaleCeilingAbove, finaleCentury, finaleOver, finalePerfect } from "../src/lab/fixtures";
import type { Game } from "../src/lib/engine.svelte";

const FINALE_SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components/Finale.svelte"),
  "utf-8",
);

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
// jsdom has no matchMedia; the component treats its absence as "motion is
// fine", which is what makes `resolved` the thing under test rather than the
// reduced-motion path standing in for it.
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
  setTimeout(() => cb(performance.now()), 0),
);
// The library, not the effect: the component's dynamic import and try/catch
// stay under test, but real canvas-confetti starts a frame loop that crashes
// on jsdom's null 2D context an async tick later — OUTSIDE the catch, as an
// unhandled error vitest reports against whichever test is then running.
vi.mock("canvas-confetti", () => ({ default: () => {} }));

let host: HTMLElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any = null;
afterEach(() => {
  if (app) unmount(app);
  host?.remove();
  app = null;
  host = null;
});

function render(resolved: boolean, game: Game = finaleCeilingAbove()): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = mount(Finale, {
    target: host,
    props: { game, onreplay: () => {}, onmodes: () => {}, resolved },
  });
  flushSync();
  return host;
}

/** The bar in the budget row of the ledger, whoever drew it. */
function ledgerBar(el: HTMLElement): HTMLElement {
  return el.querySelector(".lrow .minimeter .pmeter") as HTMLElement;
}

describe("a restored finale", () => {
  it("renders settled on the first frame: every row, the stamp, the real numbers", () => {
    const el = render(true);
    const rows = el.querySelectorAll(".lrow");
    expect(rows.length).toBeGreaterThan(0);
    // Every ledger row is dealt, not none of them.
    expect([...rows].every((r) => r.classList.contains("show"))).toBe(true);
    const stamp = el.querySelector(".total-stamp");
    expect(stamp?.classList.contains("show")).toBe(true);
    // The counters are at their final values, not counting up from zero.
    expect(el.querySelector(".tamt")?.textContent).not.toBe("0–0");
    expect(el.querySelector(".tpts")?.textContent).not.toBe("0 PTS");
    expect(el.querySelector(".tpts")?.textContent).toContain(".");
  });

  it("leaves the brag pills visible rather than waiting on a beat that never comes", () => {
    const el = render(true);
    // This fixture earns at least one badge; the row exists and is populated.
    expect(el.querySelectorAll(".brags").length).toBe(1);
    expect(el.querySelectorAll(".brags button").length).toBeGreaterThan(0);
  });

  it("fires no confetti — the celebration already happened once", async () => {
    // canvas-confetti is imported dynamically inside the stamp beat, so the
    // beat not running is the whole assertion: jsdom has no canvas, and a real
    // call would surface here.
    const el = render(true);
    await Promise.resolve();
    expect(el.querySelector("canvas")).toBeNull();
  });

  it("draws the budget row's bar with the payroll box itself, at ledger scale", () => {
    // The class is the evidence: `.pmeter` is PayrollBox's own track, and
    // `mini` is the one thing the ledger asks it for. A lookalike built inside
    // Finale is the parallel copy that drifted last time — two greens on the
    // board and two others in the ledger — so the row goes through the
    // component or the drift comes back.
    const el = render(true);
    const bar = ledgerBar(el);
    expect(bar).not.toBeNull();
    expect(bar.classList.contains("mini")).toBe(true);
    // This fixture spends $88M of a $96.7M payroll: under, so the calm face.
    expect(bar.classList.contains("pover")).toBe(false);
    expect(bar.classList.contains("pnocap")).toBe(false);
    expect(bar.querySelector(".pfill")).not.toBeNull();
  });

  it("wears the same over-payroll alarm the board wears when the club went over", () => {
    // $116M spent against $96.7M — the luxury-tax face of the same row, and
    // the same orange track and drifting hatch the board showed all game.
    const el = render(true, finaleOver());
    const bar = ledgerBar(el);
    expect(bar.classList.contains("pover")).toBe(true);
    expect(bar.querySelector(".pfill")).not.toBeNull();
    // The row still names the overrun beside the bar, in the game's money
    // format: $116M spent against a $96.7M payroll is $19.3M over.
    expect(bar.closest(".lrow")?.querySelector(".why")?.textContent).toBe("$19.3M over");
  });

  it("shows the dream team on the first frame, with no beat to wait for", () => {
    // The ceiling is a withheld beat during the ceremony (see below). A finale
    // reopened from history has no ceremony, so the block that would be waiting
    // on a timer that never fires has to be shown outright — the same branch
    // that settles the rows, the stamp and the passport.
    const el = render(true);
    const dream = el.querySelector(".squad.dream");
    expect(dream).not.toBeNull();
    expect(dream!.classList.contains("show")).toBe(true);
  });

  it("a finale just earned still plays the reveal", () => {
    // The control: without the flag, nothing is shown on the first frame. If
    // this ever passes for the wrong reason — reduced motion, a changed
    // default — the assertions above stop meaning anything.
    const el = render(false);
    expect([...el.querySelectorAll(".lrow")].some((r) => r.classList.contains("show"))).toBe(false);
    expect(el.querySelector(".total-stamp")?.classList.contains("show")).toBe(false);
    expect(el.querySelector(".brags")).toBeNull();
    // The ceiling is withheld on the same frame, and this is the assertion that
    // makes the spoiler regression loud rather than silent.
    expect(el.querySelector(".squad.dream")?.classList.contains("show")).toBe(false);
  });
});

/** THE CEILING MUST NOT ARRIVE BEFORE THE RECORD.
 *
 * The dream team is the best club the player could have signed. Read while the
 * ledger is still dealing, it gives away the verdict before the season that
 * earned it — so it is the one beat of the reveal that exists to withhold
 * rather than to pace, and "after the stamp" is a rule about what the player is
 * allowed to know rather than a matter of rhythm.
 *
 * Timed by watching rather than by arithmetic. The exact cue is the badge
 * pills' and the ledger's length depends on the fixture, so the test steps the
 * clock and records WHEN each beat lands; what it pins is the ORDER, which is
 * the whole of the requirement and survives any retiming of the ceremony. */
describe("the dream team waits for the record", () => {
  /** The first tick at which a beat is on screen, stepping in small slices so
   * two beats on the same cue are recorded at the same time. */
  function landings(el: HTMLElement) {
    const shown = (sel: string) => {
      const node = el.querySelector(sel);
      return node !== null && (sel === ".brags" || node.classList.contains("show"));
    };
    const at: Record<string, number> = {};
    for (let t = 0; t <= 12000; t += 50) {
      for (const [name, sel] of [
        ["stamp", ".total-stamp"],
        ["brags", ".brags"],
        ["dream", ".squad.dream"],
      ] as const) {
        if (at[name] === undefined && shown(sel)) at[name] = t;
      }
      vi.advanceTimersByTime(50);
      flushSync();
    }
    return at;
  }

  /** A club whose seats carry birth countries, so the finale draws a passport
   * strip at all. The fixture's own seats carry none. */
  function withCountries(): Game {
    const g = finaleCeilingAbove();
    ["Japan", "Cuba", "Peru"].forEach((bc, i) => {
      const seat = g.slots[i];
      if (seat) seat.bc = bc;
    });
    return g;
  }

  it("deals the passport stamps AT their beat, not silently before it", () => {
    // THE BUG THIS EXISTS TO CATCH: `.clubpass` is mounted on the first frame
    // at `opacity: 0` — deliberately, so the row never displaces the buttons
    // mid-reveal — and a CSS animation on a child of a transparent box RUNS
    // ANYWAY. Opacity does not defer animations. So stamps that carried the
    // entrance class from mount finished their thunk-in inside the first
    // second, seconds before the passport beat, and the row then appeared
    // whole: the exact "all at once" the stagger was added to replace.
    //
    // The fix is that the entrance is applied AT the beat. What is pinned here
    // is that the class is absent before it and present after — a markup-only
    // stagger test cannot see this, because the delays are right either way.
    vi.useFakeTimers();
    try {
      const el = render(false, withCountries());
      const stamps = () => [...el.querySelectorAll<HTMLElement>(".stamps .pill")];
      const dealing = () => stamps().filter((s) => s.classList.contains("animate"));
      expect(stamps().length).toBeGreaterThan(1);
      // Mounted from the first frame, and NOT animating yet.
      expect(dealing()).toHaveLength(0);

      // Run the whole ceremony out.
      for (let t = 0; t <= 12000; t += 50) {
        vi.advanceTimersByTime(50);
        flushSync();
      }
      const strip = el.querySelector(".clubpass");
      expect(strip?.classList.contains("show")).toBe(true);
      // Every stamp deals, and it deals left to right off its own index.
      expect(dealing()).toHaveLength(stamps().length);
      expect(stamps().map((s) => s.style.animationDelay)).toEqual(["", "0.12s", "0.24s"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("lands after the stamp, on the badge pills' own cue", () => {
    vi.useFakeTimers();
    try {
      const el = render(false);
      const at = landings(el);
      // All three beats actually ran; a fixture that never revealed would make
      // every ordering assertion below vacuously true.
      expect(at.stamp).toBeGreaterThan(0);
      expect(at.brags).toBeGreaterThan(0);
      expect(at.dream).toBeGreaterThan(0);
      // THE RULE: never before the stamp.
      expect(at.dream).toBeGreaterThan(at.stamp);
      // And in parallel with the badges, which is the cue it rides — the beat
      // that annotates the record, which is what a ceiling does.
      expect(at.dream).toBe(at.brags);
    } finally {
      vi.useRealTimers();
    }
  });
});

/** STYLING AND LAYOUT CONTRACTS.
 *
 * Six items, all requiring tests per the spec. Four of these are CSS-only
 * claims that jsdom cannot verify via getComputedStyle (it does not parse
 * color-mix(), and component <style> blocks are not injected into the
 * test document). Those are asserted against the component source text —
 * the only assertion form that fails when the old value is restored. */
describe("styling and layout contracts", () => {
  /** Seats with birth countries so the finale draws a passport strip. */
  function withCountries(): Game {
    const g = finaleCeilingAbove();
    ["Japan", "Cuba", "Peru"].forEach((bc, i) => {
      const seat = g.slots[i];
      if (seat) seat.bc = bc;
    });
    return g;
  }

  it("(item 1) heading reads THE SCORECARD, not THE LEDGER", () => {
    const el = render(true);
    const headings = [...el.querySelectorAll(".psep")].map((p) => p.textContent?.trim());
    expect(headings).toContain("THE SCORECARD");
    expect(headings).not.toContain("THE LEDGER");
  });

  it("(item 3) signed dream rows carry .signed; missed rows never do", () => {
    // .signed is the class that carries the green wash — its presence on the
    // right rows is the contract, even if jsdom can't verify the color itself.
    const el = render(true);
    const dream = el.querySelector(".squad.dream");
    expect(dream).not.toBeNull();
    // The fixture earns at least one signed dream pick.
    const signed = [...(dream?.querySelectorAll(".qrow.signed") ?? [])];
    expect(signed.length).toBeGreaterThan(0);
    // A missed row is never also .signed — that would double-style it.
    const missedAndSigned = dream?.querySelectorAll(".qrow.missed.signed") ?? [];
    expect(missedAndSigned.length).toBe(0);
  });

  it("(item 5) stamps and badges flow inside the shared .badge-strip", () => {
    // With both badges and countries, .brags and .clubpass must share the
    // same .badge-strip parent so their pills lie in the same flex row.
    const el = render(true, withCountries());
    expect(el.querySelector(".badge-strip")).not.toBeNull();
    expect(el.querySelector(".badge-strip > .brags")).not.toBeNull();
    expect(el.querySelector(".badge-strip > .clubpass")).not.toBeNull();
    // Both share the same DOM parent — the strip itself.
    const bragsParent = el.querySelector(".brags")?.parentElement;
    const clubpassParent = el.querySelector(".clubpass")?.parentElement;
    expect(bragsParent).toBe(clubpassParent);
  });

  it("(items 2, 3, 4, 5b, 6) source: sticky, seed 12px, no stripe, green-wash, lrow tint", () => {
    // Item 2: left column sticky on desktop
    expect(FINALE_SRC).toContain("position: sticky");
    expect(FINALE_SRC).toContain("top: 10px");
    // Item 3: crosshatch removed; signed rows tinted green
    expect(FINALE_SRC).not.toContain("repeating-linear-gradient");
    expect(FINALE_SRC).toContain(".squad.dream .qrow.signed");
    expect(FINALE_SRC).toContain("var(--green-wash)");
    // Item 4: .lrow uses the app's parchment ground tinted into --card, not bare --card;
    // and the outer color-mix bleeds the tier's foreshadow wash (--fore) into the parchment.
    expect(FINALE_SRC).not.toMatch(/\.lrow\s*\{[^}]*background:\s*var\(--card\)/s);
    expect(FINALE_SRC).toContain("color-mix(in srgb, var(--ground) 55%, var(--card))");
    expect(FINALE_SRC).toContain("var(--fore");
    // Item 6: seed chip font larger than the old 10px
    const seedMatch = FINALE_SRC.match(/\.seedchip\s*\{[^}]*font-size:\s*(\d+)px/s);
    expect(parseInt(seedMatch?.[1] ?? "0", 10)).toBeGreaterThan(10);
  });
});

/** FORESHADOW TINT: scorecard rows carry the final tier color from the first frame.
 *
 * The tint is set as --fore on .ledger, a CSS custom property derived from
 * recTier — the exact same value the stamp's class carries. One derivation, two
 * surfaces, so neither can drift from the other. The tint is present before any
 * row deals, because fin.parts.total (the source of recTier) never moves during
 * the reveal — it is a property of the completed game, not an animated counter. */
describe("foreshadow tint", () => {
  /** The ledger element, which holds --fore as an inline custom property. */
  function ledger(el: HTMLElement): HTMLElement {
    return el.querySelector(".ledger") as HTMLElement;
  }

  it("elite total → gold wash on .ledger, elite class on .tamt", () => {
    // finalePerfect: 74.1 WAR + sweep + trophy case → total past 162 → elite.
    const el = render(true, finalePerfect());
    const style = ledger(el).getAttribute("style") ?? "";
    expect(style).toContain("--fore: var(--gold-2)");
    // Cross-check: both surfaces speak the same tier. A second derivation
    // could diverge; the stamp class is the canary.
    expect(el.querySelector(".tamt")?.classList.contains("elite")).toBe(true);
  });

  it("neg total → red wash on .ledger, neg class on .tamt", () => {
    // finaleBad: −2.0 WAR vs Piniella +14, spend over budget → total ≈ 60 → neg.
    const el = render(true, finaleBad());
    const style = ledger(el).getAttribute("style") ?? "";
    expect(style).toContain("--fore: var(--red-2)");
    expect(el.querySelector(".tamt")?.classList.contains("neg")).toBe(true);
  });

  it("low total → gray wash on .ledger, low class on .tamt", () => {
    // finaleOver: 8 rings but $19.3M luxury-tax drag → total ≈ 98 wins → low.
    // Gray uses --gray-bg (the warm near-parchment), not a standard -2 token.
    const el = render(true, finaleOver());
    const style = ledger(el).getAttribute("style") ?? "";
    expect(style).toContain("--fore: var(--gray-bg)");
    expect(el.querySelector(".tamt")?.classList.contains("low")).toBe(true);
  });

  it("mid total → green wash on .ledger, mid class on .tamt", () => {
    // finaleCentury: 2017 Astros 36 WAR + Piniella → total ≈ 114 wins → mid.
    const el = render(true, finaleCentury());
    const style = ledger(el).getAttribute("style") ?? "";
    expect(style).toContain("--fore: var(--green-2)");
    expect(el.querySelector(".tamt")?.classList.contains("mid")).toBe(true);
  });

  it("the tint is present on the first frame, before any rows deal (resolved=false)", () => {
    // The foreshadow is a property of the club, not of the reveal. It exists
    // from mount — no row needs to deal before the parchment knows its tier.
    const el = render(false, finalePerfect());
    const style = ledger(el).getAttribute("style") ?? "";
    expect(style).toContain("--fore: var(--gold-2)");
    // Confirm the rows are not yet dealt — the tint precedes the ceremony.
    expect([...el.querySelectorAll(".lrow")].some((r) => r.classList.contains("show"))).toBe(false);
  });
});

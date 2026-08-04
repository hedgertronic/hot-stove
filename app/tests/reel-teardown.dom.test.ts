// @vitest-environment jsdom
/** The reel must not outlive the banner that started it.
 *
 * The flicker chain reschedules itself — each tick books the next — so it is
 * not one timer the effect can forget about, it is a rolling one. Quitting
 * mid-spin unmounts the banner while a tick is still booked, and that tick
 * reads `game.phase` off a game the app has already released. The chain's own
 * `phase !== "spinning"` guard cannot save it: the read IS the guard.
 *
 * On screen the leak was only a console error, but a stray timer that survives
 * its component is the kind of thing that fails somewhere else later — it made
 * an unrelated DOM test die as an unhandled exception. The contract here is
 * flat: after unmount, the reel has nothing left booked.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import SpinBanner from "../src/components/SpinBanner.svelte";
import { forgeGame, mkCard } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";
import type { Colors } from "../src/lib/types";

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const colors: Colors = { franchises: { SEA: "#005c5c" } };

/** Mid-reel: the full-spin kind, which is the only one that flickers, over a
 * pool the cosmetic RNG can actually draw from. */
function spinning(): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard();
    g.index = {
      yearMin: 1985,
      yearMax: 2025,
      cards: [
        { team: "SEA", year: 2001, franchise: "SEA", name: "Seattle Mariners" },
        { team: "SEA", year: 1995, franchise: "SEA", name: "Seattle Mariners" },
      ],
    };
    g.spinKind = "full";
    g.phase = "spinning";
  });
}

// jsdom ships no Web Animations API, and every flicker tick pulses the two
// banner halves through it. Stubbing the animation is what lets the reel
// actually run here — muting it via prefers-reduced-motion instead would take
// the branch that books no timers at all, which is the branch under test.
beforeAll(() => {
  (Element.prototype as unknown as { animate: () => unknown }).animate ??= () => ({
    cancel: () => {},
    finish: () => {},
  });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("unmounting mid-reel", () => {
  it("leaves no tick booked, and lands nothing after the fact", () => {
    vi.useFakeTimers();
    const game = spinning();
    const land = vi.spyOn(game, "land").mockResolvedValue(undefined);
    const target = document.createElement("div");
    document.body.appendChild(target);
    const comp = mount(SpinBanner, { target, props: { game, colors } });
    flushSync();

    // A few decelerating ticks in, with the authoritative land timer pending.
    vi.advanceTimersByTime(120);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    expect(land).not.toHaveBeenCalled();

    // The player quits: the banner goes, and the reel must go with it.
    unmount(comp as never);
    flushSync();
    expect(vi.getTimerCount()).toBe(0);

    // Nothing throws, and the card the player walked away from never lands.
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
    expect(land).not.toHaveBeenCalled();
  });
});

describe("rewinding mid-reel", () => {
  it("still gives the spin that follows a reel of its own", () => {
    // Undo is offered during the reel, so a reel can now end in a way it never
    // used to: abandoned, with its own land still booked and the game already
    // back on the card behind it. The next spin has to start clean anyway.
    //
    // The banner used to gate its reel on a `running` boolean cleared by the
    // land it started, and an abandoned reel does not clear it in time: the
    // spin the player takes straight after the rewind finds the flag still up,
    // is refused, and leaves him watching a still banner with no flicker at all
    // until a leftover timer from the abandoned spin drops the card in at a
    // time that belongs to neither spin. Keyed on the
    // engine's `spinEpoch` instead, a stale reel finishing says nothing about
    // the one now in flight.
    //
    // Pulses are the witness, because a reel IS its flicker: every tick
    // animates the two banner halves, so an animation count is "the reel ran"
    // with nothing else in the way of it.
    vi.useFakeTimers();
    const pulses = vi.fn(() => ({ cancel: () => {}, finish: () => {} }));
    (Element.prototype as unknown as { animate: unknown }).animate = pulses;

    const game = spinning();
    // The engine's own rule, kept here so a stale land is as harmless in this
    // test as it is in the app: a land whose spin has been rewound writes
    // nothing (engine.svelte.ts `land`, and undo.test.ts pins it there).
    let landed = 0;
    vi.spyOn(game, "land").mockImplementation(async () => {
      if (game.phase !== "spinning") return;
      landed += 1;
      game.phase = "landed";
    });
    const target = document.createElement("div");
    document.body.appendChild(target);
    mount(SpinBanner, { target, props: { game, colors } });
    flushSync();
    vi.advanceTimersByTime(120);

    // The rewind, in the two fields `undo()` writes that this banner can see:
    // back on the card behind the move, and on a spin the abandoned reel no
    // longer belongs to.
    game.phase = "landed";
    game.spinEpoch += 1;
    flushSync();

    // The player commits a pick and the stove rolls straight on, exactly as
    // `beginSpin` rolls it.
    game.phase = "spinning";
    game.spinEpoch += 1;
    flushSync();

    pulses.mockClear();
    vi.advanceTimersByTime(400);
    expect(pulses.mock.calls.length).toBeGreaterThan(0);

    // And it finishes: the card lands on this reel's own timer.
    vi.advanceTimersByTime(10_000);
    expect(landed).toBe(1);
    expect(game.phase).toBe("landed");
  });
});

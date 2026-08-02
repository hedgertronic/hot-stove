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

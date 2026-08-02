// @vitest-environment jsdom
/** The banner's two spin ends.
 *
 * A committed pick rolls the next card with no beat in front of it — the reel
 * is the transition, and a pause before it read as buffering. A spin the
 * PLAYER never ended is the exception: resuming onto a half-used ✌️ Double
 * Play forfeits the second pick during boot, so at zero delay the card would
 * be gone on the first frame with nothing said about it.
 *
 * Mounted rather than SSR-rendered because the whole contract is a timer: what
 * is proved here is when `spin()` is called, which no static render can show.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import SpinBanner from "../src/components/SpinBanner.svelte";
import { forgeGame, mkCard } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";
import type { Colors } from "../src/lib/types";

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const colors: Colors = { franchises: { SEA: "#005c5c" } };

/** A game standing where a resumed forfeit leaves it: the spin is over, but
 * the card it was spent on is still on screen. `resumed` picks which of the
 * two ends it got there by. */
function endedSpin(resumed: boolean): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard();
    g.phase = "preSpin";
    g.choicesLeft = 0;
    g.choicesUsed = 1;
    g.resumedForfeit = resumed;
  });
}

function mountBanner(game: Game): { target: HTMLElement; comp: Record<string, unknown> } {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const comp = mount(SpinBanner, { target, props: { game, colors } });
  return { target, comp: comp as Record<string, unknown> };
}

const notice = (t: HTMLElement): string | null => t.querySelector(".coldmsg")?.textContent ?? null;

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("the beat in front of the reel", () => {
  it("rolls a committed pick with no pause at all", () => {
    vi.useFakeTimers();
    const game = endedSpin(false);
    const spin = vi.spyOn(game, "spin").mockImplementation(() => {});
    const { target, comp } = mountBanner(game);
    flushSync();

    expect(notice(target)).toBeNull();
    expect(spin).not.toHaveBeenCalled(); // deferred a turn, never called inline
    vi.advanceTimersByTime(0);
    expect(spin).toHaveBeenCalledTimes(1);
    unmount(comp as never);
  });

  it("holds the card, and says why, when the reload took the second pick", () => {
    vi.useFakeTimers();
    const game = endedSpin(true);
    const spin = vi.spyOn(game, "spin").mockImplementation(() => {});
    const { target, comp } = mountBanner(game);
    flushSync();

    // The card the pick was spent on is still the thing on screen…
    expect(target.querySelector(".tname")?.textContent).toBe("Seattle Mariners");
    // …with the refund named, so a ✌️ that came back is not read as one that
    // broke. The other two banner notices carry a button; this one cannot —
    // the spin is already over and there is nothing left to decide.
    expect(notice(target)).toContain("DOUBLE PLAY REFUNDED");
    expect(target.querySelector(".cold button")).toBeNull();

    // The reel waits long enough for that line to be read…
    vi.advanceTimersByTime(1000);
    expect(spin).not.toHaveBeenCalled();
    // …and then leaves on its own; there is no button to press.
    vi.advanceTimersByTime(1000);
    expect(spin).toHaveBeenCalledTimes(1);
    unmount(comp as never);
  });

  it("shows the notice only while the spin it explains is still standing", () => {
    const game = endedSpin(true);
    vi.spyOn(game, "spin").mockImplementation(() => {});
    const { target, comp } = mountBanner(game);
    flushSync();
    expect(notice(target)).toContain("DOUBLE PLAY REFUNDED");

    // beginSpin clears the flag; the notice goes with the card it described.
    game.resumedForfeit = false;
    flushSync();
    expect(notice(target)).toBeNull();
    unmount(comp as never);
  });
});

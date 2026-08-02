// @vitest-environment jsdom
/** The two-up row under PLAY: LAST GAME's availability, and PLAY A SEED's way
 * back out of the field it opens.
 *
 * The storage half — which situations leave an archive and which do not — is
 * asserted in finale-persist.test.ts, where the engine can actually finish a
 * game. What only a mounted component can show is the other half: that the
 * archive's absence reaches the DOM as a real `disabled` attribute rather than
 * a fade, that the row is always two cells whatever storage holds, and that
 * cancelling the seed field closes it, empties it, and hands focus back to the
 * button it replaced.
 *
 * Geometry (the row's box not moving between states) is a screenshot job:
 * jsdom has no layout, so a width assertion here would pass on zeroes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Home from "../src/components/Home.svelte";

const FINALE_KEY = "hotstove.finale";

/** The smallest record `loadStoredFinale` accepts: a v1 stamp, a total the
 * ledger can dereference, and a roster array. */
function archive(): void {
  localStorage.setItem(
    FINALE_KEY,
    JSON.stringify({
      v: 1,
      seed: 42,
      config: { difficulty: "standard", bank: "classic" },
      spinCount: 3,
      seen: [],
      slots: [],
      owner: null,
      stadium: null,
      manager: null,
      finale: { parts: { total: 120 } },
    }),
  );
}

function open() {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(Home, {
    target,
    props: {
      config: { difficulty: "standard", bank: "classic" },
      onplay: vi.fn(),
      onlast: vi.fn(),
    },
  });
  flushSync();
  const under = target.querySelector(".under") as HTMLElement;
  return {
    target,
    under,
    /** The row's two cells, in DOM order: LAST GAME, then the seed half. */
    cells: () => [...under.children] as HTMLElement[],
    last: () => under.querySelector(".ubtn") as HTMLButtonElement,
    seedBtn: () => [...under.querySelectorAll(".ubtn")][1] as HTMLButtonElement,
    input: () => under.querySelector(".seedin") as HTMLInputElement | null,
    cancel: () => under.querySelector(".seedx") as HTMLButtonElement | null,
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

beforeEach(() => localStorage.clear());
// `document.activeElement` is per-document, so a mount left standing by a
// failed assertion would hand the next test someone else's focused button.
afterEach(() => document.body.replaceChildren());

/** Cancelling hands focus back one tick after the swap renders, and the
 * component's tick and the test's are different promises — poll rather than
 * guess how many microtasks apart they land. */
function focused(): Promise<void> {
  return vi.waitFor(() => expect(document.activeElement?.tagName).toBe("BUTTON"));
}

describe("LAST GAME", () => {
  it("is disabled, not absent, when nothing has ever been finished", () => {
    const ui = open();
    // The row is two cells whether or not there is a game to go back to: the
    // control under the primary action must not move between visits.
    expect(ui.cells()).toHaveLength(2);
    expect(ui.last().textContent).toContain("LAST GAME");
    // Genuinely disabled — unfocusable and unclickable, not merely faded.
    expect(ui.last().disabled).toBe(true);
    ui.close();
  });

  it("refuses the tap and the focus while disabled", () => {
    const ui = open();
    const btn = ui.last();
    btn.focus();
    expect(document.activeElement).not.toBe(btn);
    ui.close();
  });

  it("is enabled the moment an archive exists, and calls back on tap", () => {
    archive();
    const onlast = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    const app = mount(Home, {
      target,
      props: { config: { difficulty: "standard", bank: "classic" }, onplay: vi.fn(), onlast },
    });
    flushSync();
    const btn = target.querySelector(".under .ubtn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(onlast).toHaveBeenCalledOnce();
    unmount(app);
    target.remove();
  });

  it("reads the archive fresh on every mount, so the state survives a reload", () => {
    // A reload is a fresh mount against the same storage — the same thing this
    // does twice. The disabled state is a read of localStorage, not of memory.
    const first = open();
    expect(first.last().disabled).toBe(true);
    first.close();

    archive();
    const second = open();
    expect(second.last().disabled).toBe(false);
    second.close();
  });
});

describe("cancelling PLAY A SEED", () => {
  it("opens the field in place, leaving the row two cells", () => {
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    expect(ui.cells()).toHaveLength(2);
    expect(ui.input()).not.toBeNull();
    expect(ui.cancel()).not.toBeNull();
    ui.close();
  });

  it("closes on the ✕, forgets what was typed, and hands focus back", async () => {
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    ui.input()!.value = "KF12";
    ui.input()!.dispatchEvent(new Event("input"));
    flushSync();

    ui.cancel()!.click();
    flushSync();
    expect(ui.input()).toBeNull();
    expect(ui.cells()).toHaveLength(2);
    // Focus lands on the button that opened the field, not on the body.
    await focused();
    expect(document.activeElement).toBe(ui.seedBtn());

    // Reopening starts clean: a half-typed code never comes back.
    ui.seedBtn().click();
    flushSync();
    expect(ui.input()!.value).toBe("");
    ui.close();
  });

  it("closes on Escape from inside the field", async () => {
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    const input = ui.input()!;
    input.value = "ZZ";
    input.dispatchEvent(new Event("input"));
    flushSync();

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    flushSync();
    expect(ui.input()).toBeNull();
    await focused();
    expect(document.activeElement).toBe(ui.seedBtn());
    ui.close();
  });

  it("leaves Escape alone while the field is closed", () => {
    // The handler is bound to the input, not the window: with no field open
    // there is nothing listening, so the badge panel's capture-phase Escape and
    // Sheet's bubbling one keep the key to themselves.
    const ui = open();
    const before = ui.under.innerHTML;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    flushSync();
    expect(ui.under.innerHTML).toBe(before);
    ui.close();
  });
});

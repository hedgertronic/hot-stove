// @vitest-environment jsdom
/** The row under the mode pickers — PLAY beside PLAY A SEED — and the record
 * book card that is now the one door into every season played.
 *
 * The card is enabled by the LOG, not by the archive and not by the punched
 * combo's own game count: every season a career has finished appears in the
 * list, and whether any given one can still be reopened is the modal's question
 * (seasons.dom.test.ts). What only a mounted component can show is that an
 * empty log reaches the DOM as a real `disabled` attribute rather than a fade,
 * that a career played entirely in another combo still has a book to open, that
 * the play row is always two cells whatever storage holds, and that cancelling
 * the seed field closes it, empties it, and hands focus back to the button it
 * replaced.
 *
 * Geometry (the row's box not moving between states) is a screenshot job:
 * jsdom has no layout, so a width assertion here would pass on zeroes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Home from "../src/components/Home.svelte";
import { appendHistory } from "../src/lib/history";

/** One finished season in the log. `total` is what makes it one. */
function season(over: Record<string, unknown> = {}): void {
  appendHistory({
    v: 2,
    date: "2026-08-02",
    seed: 42,
    total: 120,
    difficulty: "standard",
    bank: "classic",
    ...over,
  });
}

function open() {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(Home, {
    target,
    props: {
      config: { difficulty: "standard", bank: "classic" },
      onplay: vi.fn(),
      onopen: vi.fn(),
    },
  });
  flushSync();
  const under = target.querySelector(".under") as HTMLElement;
  return {
    target,
    under,
    /** The row's two cells, in DOM order: PLAY, then the seed half. */
    cells: () => [...under.children] as HTMLElement[],
    play: () => under.querySelector(".playbtn") as HTMLButtonElement,
    book: () => target.querySelector(".book") as HTMLButtonElement,
    seedBtn: () => under.querySelector(".ubtn") as HTMLButtonElement,
    input: () => under.querySelector(".seedin") as HTMLInputElement | null,
    go: () => under.querySelector(".seedgo:not(.seedx)") as HTMLButtonElement | null,
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

describe("the play row", () => {
  it("puts PLAY A SEED in line with PLAY, and nothing else in the row", () => {
    const ui = open();
    const cells = ui.cells();
    expect(cells).toHaveLength(2);
    expect(cells[0].textContent).toContain("PLAY");
    expect(cells[1].textContent).toContain("PLAY A SEED");
    // SEASONS is gone from here — it lives on the record book card now.
    expect(ui.under.textContent).not.toContain("SEASONS");
    ui.close();
  });

  it("keeps the row two cells while the seed field is open, so PLAY holds still", () => {
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    expect(ui.cells()).toHaveLength(2);
    expect(ui.play()).not.toBeNull();
    expect(ui.input()).not.toBeNull();
    ui.close();
  });
});

describe("the record book card", () => {
  it("is disabled, not absent, when nothing has ever been finished", () => {
    const ui = open();
    expect(ui.book().disabled).toBe(true);
    expect(ui.book().textContent).toContain("NO SEASONS YET");
    ui.close();
  });

  it("refuses the tap and the focus while disabled", () => {
    const ui = open();
    const card = ui.book();
    card.focus();
    expect(document.activeElement).not.toBe(card);
    card.click();
    flushSync();
    expect(ui.target.querySelector('[role="dialog"]')).toBeNull();
    ui.close();
  });

  it("stays disabled for a log holding nothing but quits", () => {
    // A quit is a row with no total, and the list is seasons that resolved.
    // Same guard the record book counts games with.
    appendHistory({ date: "2026-08-02", badges: ["packedin"] });
    const ui = open();
    expect(ui.book().disabled).toBe(true);
    ui.close();
  });

  it("opens the seasons sheet on tap the moment a season is logged", () => {
    season();
    const ui = open();
    expect(ui.book().disabled).toBe(false);
    expect(ui.target.querySelector('[role="dialog"]')).toBeNull();
    ui.book().click();
    flushSync();
    expect(ui.target.querySelector('[role="dialog"]')).not.toBeNull();
    ui.close();
  });

  it("stays a door for a career played entirely in another combo", () => {
    // The card's own numbers are scoped to the PUNCHED combo, and this season
    // is not in it — G reads 0 and BEST SEASON reads a dash. The book behind
    // the card is global, so the card is still openable.
    season({ bank: "moneyball" });
    const ui = open();
    expect(ui.book().disabled).toBe(false);
    expect(ui.book().querySelector(".bn")!.textContent).toBe("0");
    expect(ui.book().textContent).toContain("1 SEASON");
    ui.close();
  });

  it("counts every season played, whatever mode, in its footer", () => {
    season();
    season({ bank: "moneyball" });
    season({ difficulty: "scout" });
    appendHistory({ date: "2026-08-04", badges: ["packedin"] }); // a quit counts for nothing
    const ui = open();
    expect(ui.book().textContent).toContain("3 SEASONS");
    ui.close();
  });

  it("reads the log fresh on every mount, so the state survives a reload", () => {
    // A reload is a fresh mount against the same storage — the same thing this
    // does twice. The disabled state is a read of localStorage, not of memory.
    const first = open();
    expect(first.book().disabled).toBe(true);
    first.close();

    season();
    const second = open();
    expect(second.book().disabled).toBe(false);
    second.close();
  });
});

describe("cancelling PLAY A SEED", () => {
  it("stands its ✕ beside GO, both in the same pill shape", () => {
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    const go = ui.go()!;
    const x = ui.cancel()!;
    // Same class, so the same box: the ✕ is GO's secondary, not a loose glyph.
    expect(x.classList.contains("seedgo")).toBe(true);
    // And it stands after GO, on the far side of the field from the input.
    expect(go.nextElementSibling).toBe(x);
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

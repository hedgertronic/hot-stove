// @vitest-environment jsdom
/** The row under the mode pickers — PLAY above SEED — and the two record-book
 * cards (GAMES and BEST) that replace the single card.
 *
 * GAMES (`.book-g`): shows this combo's game count and the global log total;
 * disabled when nothing has ever been finished; tapping opens the seasons
 * sheet.
 *
 * BEST (`.book-b`): shows the best season for the punched combo; disabled when
 * no season has been played in that combo; tapping opens that season's finale
 * directly via the archive, or falls back to the seasons sheet when the record
 * has aged out.
 *
 * What only a mounted component can show: an empty log reaches the DOM as a
 * real `disabled` attribute rather than a fade; a career played entirely in
 * another combo still has a GAMES book to open; cancelling the seed field
 * closes it, empties it, and hands focus back to the button it replaced; the
 * BEST card always renders the same element structure regardless of whether the
 * combo has been played.
 *
 * Geometry (card heights not jumping between states) is a screenshot job:
 * jsdom has no layout, so a height assertion here would pass on zeroes.
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
    /** The row's two children in DOM order: PLAY button, then the seed zone. */
    cells: () => [...under.children] as HTMLElement[],
    play: () => under.querySelector(".playbtn") as HTMLButtonElement,
    /** GAMES card — the narrower left card, opens the seasons sheet. */
    gamesCard: () => target.querySelector(".book-g") as HTMLButtonElement,
    /** BEST card — the wider right card, opens the best season's finale. */
    bestCard: () => target.querySelector(".book-b") as HTMLButtonElement,
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
  it("puts SEED below PLAY, and nothing else in the row", () => {
    const ui = open();
    const cells = ui.cells();
    expect(cells).toHaveLength(2);
    expect(cells[0].textContent).toContain("PLAY");
    // SEED button is inside the second child (the seed zone)
    expect(cells[1].textContent).toContain("SEED");
    // SEASONS does not appear here — it lives on the record book cards now.
    expect(ui.under.textContent).not.toContain("SEASONS");
    ui.close();
  });

  it("keeps two children in the row while the seed field is open, so PLAY holds still", () => {
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    expect(ui.cells()).toHaveLength(2);
    expect(ui.play()).not.toBeNull();
    expect(ui.input()).not.toBeNull();
    ui.close();
  });
});

describe("the GAMES card", () => {
  it("is disabled, not absent, when nothing has ever been finished", () => {
    const ui = open();
    expect(ui.gamesCard().disabled).toBe(true);
    expect(ui.gamesCard().textContent).toContain("NO SEASONS YET");
    ui.close();
  });

  it("refuses the tap and the focus while disabled", () => {
    const ui = open();
    const card = ui.gamesCard();
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
    expect(ui.gamesCard().disabled).toBe(true);
    ui.close();
  });

  it("opens the seasons sheet on tap the moment a season is logged", () => {
    season();
    const ui = open();
    expect(ui.gamesCard().disabled).toBe(false);
    expect(ui.target.querySelector('[role="dialog"]')).toBeNull();
    ui.gamesCard().click();
    flushSync();
    expect(ui.target.querySelector('[role="dialog"]')).not.toBeNull();
    ui.close();
  });

  it("stays a door for a career played entirely in another combo", () => {
    // The card's own G is scoped to the PUNCHED combo, and this season is not
    // in it — G reads 0. The book behind the card is global, so it is still
    // openable.
    season({ bank: "moneyball" });
    const ui = open();
    expect(ui.gamesCard().disabled).toBe(false);
    expect(ui.gamesCard().querySelector(".bn")!.textContent).toBe("0");
    expect(ui.gamesCard().textContent).toContain("1 SEASON");
    ui.close();
  });

  it("counts every season played, whatever mode, in its footer", () => {
    season();
    season({ bank: "moneyball" });
    season({ difficulty: "scout" });
    appendHistory({ date: "2026-08-04", badges: ["packedin"] }); // a quit counts for nothing
    const ui = open();
    expect(ui.gamesCard().textContent).toContain("3 SEASONS");
    ui.close();
  });

  it("reads the log fresh on every mount, so the state survives a reload", () => {
    // A reload is a fresh mount against the same storage — the same thing this
    // does twice. The disabled state is a read of localStorage, not of memory.
    const first = open();
    expect(first.gamesCard().disabled).toBe(true);
    first.close();

    season();
    const second = open();
    expect(second.gamesCard().disabled).toBe(false);
    second.close();
  });
});

describe("the BEST card", () => {
  it("is disabled when no seasons have been played in this combo", () => {
    const ui = open();
    expect(ui.bestCard().disabled).toBe(true);
    ui.close();
  });

  it("stays disabled when seasons exist only in another combo", () => {
    season({ bank: "moneyball" });
    const ui = open();
    // standard/classic combo has no best — BEST card is disabled even though
    // the GAMES card is now open.
    expect(ui.bestCard().disabled).toBe(true);
    ui.close();
  });

  it("becomes enabled when a season is played in this combo", () => {
    season(); // standard/classic
    const ui = open();
    expect(ui.bestCard().disabled).toBe(false);
    ui.close();
  });

  it("always renders .brec and .bpts regardless of whether a best exists", () => {
    // The structural fix for height jitter: both elements are always in the
    // DOM; .bpts carries `visibility:hidden` when no season exists. jsdom has
    // no layout, so this is a DOM-presence assertion, not a height assertion.
    const ui = open();
    const card = ui.bestCard();
    expect(card.querySelector(".brec")).not.toBeNull();
    expect(card.querySelector(".bpts")).not.toBeNull();
    // When no season, .brec shows the placeholder and .bpts has the invis class.
    expect(card.querySelector(".brec")!.textContent).toBe("—");
    expect(card.querySelector(".bpts")!.classList.contains("invis")).toBe(true);
    ui.close();
  });

  it("shows the best record when a season exists in this combo", () => {
    season(); // total 120 → recordFromTotal gives 88–74 mid tier
    const ui = open();
    const card = ui.bestCard();
    expect(card.querySelector(".brec")!.textContent).not.toBe("—");
    // .bpts is visible and contains the points
    expect(card.querySelector(".bpts")!.classList.contains("invis")).toBe(false);
    expect(card.querySelector(".bpts")!.textContent).toContain("PTS");
    ui.close();
  });

  it("falls back to the seasons sheet when the best season has aged out of the archive", () => {
    // Archive is empty (localStorage cleared in beforeEach), so the season's
    // id has no matching archive record. openBest() falls back to seasonsOpen.
    season();
    const ui = open();
    expect(ui.bestCard().disabled).toBe(false);
    expect(ui.target.querySelector('[role="dialog"]')).toBeNull();
    ui.bestCard().click();
    flushSync();
    // The seasons sheet (role="dialog") opens as the fallback.
    expect(ui.target.querySelector('[role="dialog"]')).not.toBeNull();
    ui.close();
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

// @vitest-environment jsdom
/** The row under the mode pickers — PLAY above SEED — and the two record-book
 * cards (GAMES and BEST) that replace the single card.
 *
 * GAMES (`.book-g`): shows this combo's game count (`.bn`) big and the global
 * log total (`.btotal`) small beneath; disabled when nothing has ever been
 * finished; tapping opens the seasons sheet.
 *
 * BEST (`.book-b`): shows the best season for the punched combo (`.brec` big,
 * `.bpts` small beneath); disabled when no season has been played in that
 * combo; tapping opens that season's finale directly via the archive, or falls
 * back to the seasons sheet when the record has aged out.
 *
 * SEED zone: centered below PLAY, pinned to a fixed height pill so both the
 * closed button and the open input row share the same box — no height dip.
 *
 * What only a mounted component can show: an empty log reaches the DOM as a
 * real `disabled` attribute rather than a fade; a career played entirely in
 * another combo still has a GAMES book to open; cancelling the seed field
 * closes it, empties it, and hands focus back to the button it replaced; the
 * BEST card always renders the same element structure regardless of whether the
 * combo has been played.
 *
 * Geometry (card heights not jumping between states) is a screenshot job:
 * jsdom has no layout, so a height assertion here would pass on zeroes. The
 * structural contract — a fixed-height .seedzone container that holds both
 * states — is verified by DOM-presence assertions below.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
      onopen: vi.fn() } });
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
    // Three children: PLAY, the seed zone, and the permanent seed-error live
    // region — a status region inserted only when populated is unreliably
    // announced. The region is still a flex ITEM, so .seedstatus pulls back
    // .under's 13px gap (margin-top: -13px) to keep the empty reserve truly
    // layout-neutral; the class is pinned here because the phantom gap
    // shipped once.
    expect(cells).toHaveLength(3);
    expect(cells[2].classList.contains("seedstatus")).toBe(true);
    expect(cells[0].textContent).toContain("PLAY");
    // SEED button is inside the second child (the seed zone)
    expect(cells[1].textContent).toContain("SEED");
    expect(cells[2].getAttribute("role")).toBe("status");
    expect(cells[2].textContent).toBe("");
    // SEASONS does not appear here — it lives on the record book cards now.
    expect(ui.under.textContent).not.toContain("SEASONS");
    ui.close();
  });

  it("seed zone is centered and wrapped in a fixed-height container", () => {
    // The structural contract for height parity: both button and input states
    // render inside the same .seedzone wrapper. jsdom has no layout, so the
    // pinned height cannot be verified here — that is a screenshot job. What
    // can be verified is that .seedzone exists and wraps the seed content.
    const ui = open();
    const zone = ui.under.querySelector(".seedzone");
    expect(zone).not.toBeNull();
    // With no field open, the SEED button lives inside .seedzone.
    expect(zone!.querySelector(".ubtn")).not.toBeNull();
    ui.seedBtn().click();
    flushSync();
    // After opening, the input row lives inside the same .seedzone.
    expect(ui.under.querySelector(".seedzone")).not.toBeNull();
    expect(ui.under.querySelector(".seedzone .seedin")).not.toBeNull();
    ui.close();
  });

  it("keeps the same children in the row while the seed field is open, so PLAY holds still", () => {
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    expect(ui.cells()).toHaveLength(3);
    expect(ui.play()).not.toBeNull();
    expect(ui.input()).not.toBeNull();
    ui.close();
  });
});

describe("the GAMES card", () => {
  it("is disabled, not absent, when nothing has ever been finished", () => {
    const ui = open();
    expect(ui.gamesCard().disabled).toBe(true);
    // Count shows 0 for the current mode; no "ALL MODES" footer text.
    expect(ui.gamesCard().querySelector(".bn")!.textContent).toBe("0");
    expect(ui.gamesCard().textContent).not.toContain("ALL MODES");
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
    // The card's own count is scoped to the PUNCHED combo — this season is not
    // in it so the big number reads 0. The book behind the card is global, so
    // the card is still a door. The small .btotal line shows the global total.
    season({ bank: "moneyball" });
    const ui = open();
    expect(ui.gamesCard().disabled).toBe(false);
    expect(ui.gamesCard().querySelector(".bn")!.textContent).toBe("0");
    expect(ui.gamesCard().querySelector(".btotal")!.textContent).toContain("1 TOTAL");
    ui.close();
  });

  it("shows the global count in .btotal, whatever mode each season was played", () => {
    season();
    season({ bank: "moneyball" });
    season({ difficulty: "scout" });
    appendHistory({ date: "2026-08-04", badges: ["packedin"] }); // a quit counts for nothing
    const ui = open();
    expect(ui.gamesCard().querySelector(".btotal")!.textContent).toContain("3 TOTAL");
    // The "ALL MODES" footer is gone.
    expect(ui.gamesCard().textContent).not.toContain("ALL MODES");
    ui.close();
  });

  it("has a .bn count and a .btotal line — no ALL MODES text", () => {
    season();
    const ui = open();
    expect(ui.gamesCard().querySelector(".bn")).not.toBeNull();
    expect(ui.gamesCard().querySelector(".btotal")).not.toBeNull();
    expect(ui.gamesCard().textContent).not.toContain("ALL MODES");
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

  it("has .brec and .bpts — record big, points small", () => {
    // Structural contract: these two elements are always in the DOM on the
    // BEST card regardless of whether a season exists in this combo.
    const ui = open();
    const card = ui.bestCard();
    expect(card.querySelector(".brec")).not.toBeNull();
    expect(card.querySelector(".bpts")).not.toBeNull();
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
  it("offers GO alone — dismissal is Escape or a tap outside, never a ✕", () => {
    // The capsule used to carry a ✕ beside GO; it crowded a field whose whole
    // redesign was removing boxes from inside the pill, and both dismissal
    // paths below already cover the keyboard and the thumb.
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    expect(ui.go()).not.toBeNull();
    expect(ui.cancel()).toBeNull();
    ui.close();
  });

  it("forgets what was typed once dismissed — reopening starts clean", () => {
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    ui.input()!.value = "KF12";
    ui.input()!.dispatchEvent(new Event("input"));
    flushSync();

    // Click-away dismissal, the thumb's path.
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    flushSync();
    expect(ui.input()).toBeNull();
    expect(ui.cells()).toHaveLength(3);

    // A half-typed code never comes back.
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

describe("click-outside closes the seed field", () => {
  it("collapses on a pointerdown anywhere outside the pill", () => {
    // Capture-phase pointerdown on the document body (outside the pill)
    // reaches the window listener and closes the field without consuming
    // the event — the same behavior as CornerButtons' UNDO? dismiss.
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    expect(ui.input()).not.toBeNull();

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    flushSync();
    expect(ui.input()).toBeNull();
    ui.close();
  });

  it("stays open on a pointerdown inside the pill", () => {
    // The containment check in the away handler lets taps on the input and
    // GO through — only presses outside the pill close the field.
    const ui = open();
    ui.seedBtn().click();
    flushSync();

    ui.input()!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    flushSync();
    expect(ui.input()).not.toBeNull();
    ui.close();
  });

  it("does not install the listener while the field is closed", () => {
    // The $effect is gated on seedOpen; no window listener runs at rest.
    const ui = open();
    expect(ui.input()).toBeNull();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    flushSync();
    // Closed before and after the event — the listener was never installed.
    expect(ui.input()).toBeNull();
    expect(ui.seedBtn()).not.toBeNull();
    ui.close();
  });
});

describe("seed input placeholder and paste formats", () => {
  it("placeholder starts with # — matches the seed format a paste produces", () => {
    // Seeds are #-prefixed; the placeholder must start with # so a pasted seed
    // looks right in the field.
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    expect(ui.input()!.placeholder).toMatch(/^#/);
    ui.close();
  });

  it("accepts a hash-prefixed code (#CODE) and calls onplay with the parsed seed", () => {
    // Seeds are shared as "#" + 7-char base36.
    // 0xa3f2 → seedCode → "0000WDU" → token "#0000WDU"
    const onplay = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    const app = mount(Home, {
      target,
      props: { config: { difficulty: "standard", bank: "classic" }, onplay, onopen: vi.fn() },
    });
    flushSync();
    const under = target.querySelector(".under") as HTMLElement;
    (under.querySelector(".ubtn") as HTMLButtonElement).click();
    flushSync();
    const input = under.querySelector(".seedin") as HTMLInputElement;
    input.value = "#0000WDU";
    input.dispatchEvent(new Event("input"));
    flushSync();
    (under.querySelector(".seedgo") as HTMLButtonElement).click();
    flushSync();
    expect(onplay).toHaveBeenCalledWith({ difficulty: "standard", bank: "classic" }, 0xa3f2);
    unmount(app);
    target.remove();
  });

  it("accepts a bare code without # and calls onplay with the same seed", () => {
    const onplay = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    const app = mount(Home, {
      target,
      props: { config: { difficulty: "standard", bank: "classic" }, onplay, onopen: vi.fn() },
    });
    flushSync();
    const under = target.querySelector(".under") as HTMLElement;
    (under.querySelector(".ubtn") as HTMLButtonElement).click();
    flushSync();
    const input = under.querySelector(".seedin") as HTMLInputElement;
    input.value = "0000WDU";
    input.dispatchEvent(new Event("input"));
    flushSync();
    (under.querySelector(".seedgo") as HTMLButtonElement).click();
    flushSync();
    expect(onplay).toHaveBeenCalledWith({ difficulty: "standard", bank: "classic" }, 0xa3f2);
    unmount(app);
    target.remove();
  });

  it("pins the placeholder text to the seed-format example", () => {
    // Snapshot the exact placeholder so a future rename is a conscious choice.
    const ui = open();
    ui.seedBtn().click();
    flushSync();
    expect(ui.input()!.placeholder).toBe("#0KF12OY");
    ui.close();
  });
});

describe("seed zone geometry contract (CSS source text)", () => {
  // jsdom has no layout engine; computed heights cannot be verified here.
  // The source-text assertions below pin the CSS rules that enforce height
  // parity between the closed button and the open input row, and the
  // Safari-safe transition contract — the visual proof is a screenshot.
  const src = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components/Home.svelte"),
    "utf8",
  );
  const style = src.slice(src.indexOf("<style>"), src.indexOf("</style>"));

  it("gives .seedzone an explicit pixel height so both states share the same pill box", () => {
    // min-height was the prior approach — it reserves container space but
    // does not make the <input> fill it, because UA stylesheets reset
    // line-height to 'normal' on inputs regardless of inherited values.
    // A hard height: NNpx on the pill element is the correct fix.
    expect(style).toMatch(/\.seedzone\s*\{[^}]*\bheight\s*:\s*\d+px/);
    expect(style).not.toMatch(/\.seedzone\s*\{[^}]*\bmin-height\b/);
  });

  it("pins .seedzone.open width as a px literal for Safari-safe transition", () => {
    // CSS cannot interpolate transitions to/from 'auto' or 'fit-content'
    // in Safari. Both the closed and open widths must be concrete px values.
    expect(style).toMatch(/\.seedzone\.open\s*\{[^}]*width\s*:\s*\d+px/);
  });
});

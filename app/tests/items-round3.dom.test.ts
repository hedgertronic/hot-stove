// @vitest-environment jsdom
/** DOM contract tests for round-3 design items that require mounting.
 *
 * Item 6 — UNDO? pill width transition contract.
 *   The pill's armed state MUST be controlled by the CSS class `.undo.armed`,
 *   not by an inline `style` attribute. `width: auto` cannot be CSS-transitioned;
 *   `width: 62px` in a class CAN be. The test asserts the class contract that
 *   lets the transition fire, without measuring computed pixels (jsdom has no
 *   layout engine and all dimensions resolve to zero).
 *
 * The existing undo.dom.test.ts covers the confirm lifecycle; these tests add
 * the CSS contract the animation depends on.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import CornerButtons from "../src/components/CornerButtons.svelte";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { Card, GameIndex, Meta, Owners } from "../src/lib/types";

// ── minimal test fixtures (mirrors undo.dom.test.ts) ─────────────────────────

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: SLOT_TYPES,
  minBudget: 18.2,
  avgSlot8: { "2016": 87497175 },
  salaryFloor: { "2016": 508500 },
  proration: {},
};

const index: GameIndex = {
  yearMin: 2016,
  yearMax: 2016,
  cards: [{ team: "CHC", year: 2016, franchise: "CHC", name: "Chicago Cubs" }],
};

const owners: Owners = {
  franchises: {
    CHC: {
      name: "Chicago Cubs",
      owners: [{ name: "Ricketts family", from: 2009, to: null }],
    },
  },
};

const theCard: Card = {
  year: 2016,
  team: "CHC",
  franchise: "CHC",
  name: "Chicago Cubs",
  park: "Wrigley Field",
  wins: 103,
  losses: 58,
  manager: "Joe Maddon",
  ws: false,
  pen: false,
  attendance: 3_232_420,
  attendancePct: 0.86,
  stadiumMult: 1.11,
  budget: 136.3,
  budgetRaw: 74_555_288,
  contracts: [],
  prorated: 1,
  players: [],
};

function landed(): Game {
  const g = new Game(meta, index, owners, 42);
  g.card = theCard;
  g.phase = "landed";
  g.choicesLeft = 1;
  g.choicesUsed = 0;
  return g;
}

function open(game: Game | null, pushed = false) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const confirms: boolean[] = [];
  const app = mount(CornerButtons, {
    target,
    props: { game, pushed, onconfirm: (a: boolean) => confirms.push(a) },
  });
  flushSync();
  return {
    target,
    confirms,
    undo: () => target.querySelector(".undo") as HTMLButtonElement | null,
    tap: (btn: HTMLButtonElement) => {
      btn.click();
      flushSync();
    },
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());

// ── item 6: UNDO? pill — CSS transition contract ──────────────────────────────

describe("item 6 — UNDO? pill transition contract", () => {
  it("the pill rests with no inline style attribute (width is CSS-only)", () => {
    // An inline `style` on the button would take specificity precedence over
    // any CSS class rule, including `.undo.armed { width: 62px }`. No inline
    // style means the class is in full control of the width at all times.
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();
    const btn = ui.undo()!;
    expect(btn).not.toBeNull();
    expect(btn.hasAttribute("style")).toBe(false);
    ui.close();
  });

  it("the pill is armed by a CSS class, not an inline style", () => {
    // `width: 62px` is in the `.undo.armed` CSS rule, not set inline.
    // A CSS transition on `width` requires the value to be numeric at BOTH
    // ends of the transition. The resting state is `width: 28px` (in `.help`)
    // and the armed state is `width: 62px` (in `.undo.armed`) — both numeric,
    // so the browser can interpolate.
    //
    // If the component set `style="width: 62px"` on the button, the transition
    // rule on `.undo` would still fire, but the width would snap when the inline
    // style is removed (on disarm) because the transition targets the PROPERTY,
    // not the rule. The class carries both the value and the animation contract.
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();

    ui.tap(ui.undo()!);
    const btn = ui.undo()!;
    // Armed: the class is set.
    expect(btn.classList.contains("armed")).toBe(true);
    // No inline style overriding the class — the CSS class is the only source.
    expect(btn.hasAttribute("style")).toBe(false);
    // The text is "UNDO?" — confirming the armed branch rendered.
    expect(btn.textContent!.trim()).toBe("UNDO?");
    ui.close();
  });

  it("the pill disarms by removing the class, which lets the transition reverse", () => {
    // The reverse transition (62px → 28px) fires when `armed` is removed.
    // A component that removed the class AND set inline `style="width: 28px"`
    // would snap (inline takes precedence before the transition fires). No style
    // attribute on disarm confirms the reverse transition is the only width path.
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();

    ui.tap(ui.undo()!);
    expect(ui.undo()!.classList.contains("armed")).toBe(true);

    // Second tap: confirms the rewind and drops the armed class.
    ui.tap(ui.undo()!);
    const btn = ui.undo()!;
    expect(btn.classList.contains("armed")).toBe(false);
    expect(btn.hasAttribute("style")).toBe(false);
    // Pill is still in the corner (disabled, not gone).
    expect(btn.disabled).toBe(true);
    ui.close();
  });

  it("the pill's transition applies to width: the CSS class structure allows it", () => {
    // Resting state: `.undo` → width: 28px (from `.help`).
    // Armed state:  `.undo.armed` → width: 62px.
    // Both are numeric, so `transition: width 0.12s ease` can animate between them.
    // This test pins the shape of the state machine rather than computed pixels.
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();

    const btn = ui.undo()!;
    // Resting: no armed class.
    expect(btn.classList.contains("armed")).toBe(false);
    expect(btn.classList.contains("undo")).toBe(true);

    // Arm.
    ui.tap(btn);
    expect(btn.classList.contains("armed")).toBe(true);
    expect(btn.classList.contains("undo")).toBe(true);

    // Lapse via timeout: arm then wait (simulated by direct state inspection).
    // The class set after arming is the contract; we confirm the undo text is
    // showing so the armed branch is definitely active.
    expect(btn.textContent!.trim()).toBe("UNDO?");
    ui.close();
  });

  it("the pushed state never co-exists with armed (no two simultaneous confirms)", () => {
    // `.help.pushed` dims and slides the pill back from an armed neighbour.
    // When THIS pill is the one confirming, it must NOT also carry `pushed` —
    // that would dim the confirm itself and make the confirm harder to read.
    // App.svelte gates `.pushed` via `pushed && !undoArmed`.
    const game = landed();
    const ui = open(game, true); // start pushed (✕ is confirming)
    game.hireOwner();
    flushSync();

    expect(ui.undo()!.classList.contains("pushed")).toBe(true);
    ui.tap(ui.undo()!); // arm this pill
    expect(ui.undo()!.classList.contains("armed")).toBe(true);
    expect(ui.undo()!.classList.contains("pushed")).toBe(false);
    ui.close();
  });
});

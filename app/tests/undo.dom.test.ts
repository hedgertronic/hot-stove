// @vitest-environment jsdom
/** The undo pill in the corner group: when it is drawn, what it does with
 * nothing to do, and the two-tap confirm it asks for before spending the one
 * rewind a game gets.
 *
 * The rule the mount is here to hold is DISABLED, NOT GONE. A control that
 * appears and disappears inside a group of fixed pills moves its neighbours
 * under the player's thumb between taps, which is the same trade Home.svelte's
 * LAST GAME button makes and the same one it documents. That has to reach the
 * DOM as a real `disabled` attribute on an element that is still there — a
 * fade would satisfy a screenshot and still let a tap through.
 *
 * Geometry is not asserted here for home-under.dom.test.ts's reason: jsdom has
 * no layout, so a position assertion would pass on zeroes. The geometric
 * question this feature raised — an armed pill growing its word across its
 * neighbour, in both directions now that this one confirms too — was settled
 * off the font metrics and is recorded beside `.undo` in the component. What
 * reaches this file is the STATE that settlement is expressed in: the classes
 * each pill carries while the other is confirming, and the report upward that
 * lets the host push the ✕ and the wordmark back with them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import CornerButtons from "../src/components/CornerButtons.svelte";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { Card, GameIndex, Meta, Owners } from "../src/lib/types";

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
      owners: [{ name: "Ricketts family", from: 2009, to: null }] } } };

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
  prorated: 1,
  players: [],
};

/** A game standing on a landed card with its one choice — reached by
 * assignment rather than by a spin, so nothing here waits on a fetch. */
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
  // The armed state the component reports upward, recorded as the host records
  // it — App.svelte holds exactly this to step the ✕ and the wordmark back.
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
    pills: () => target.querySelectorAll("button.help").length,
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

describe("the undo pill", () => {
  it("is absent where there is no run to rewind", () => {
    // The home screen passes no game and keeps its pair.
    const ui = open(null);
    expect(ui.undo()).toBeNull();
    expect(ui.pills()).toBe(2);
    ui.close();
  });

  it("is drawn and genuinely disabled when there is nothing to take back", () => {
    const ui = open(landed());
    const btn = ui.undo();
    expect(btn).not.toBeNull();
    expect(btn!.disabled).toBe(true);
    // A word, not a bare glyph: the drawing is aria-hidden and the arrow has no
    // accessible name of its own.
    expect(btn!.getAttribute("aria-label")).toBe("Undo last move");
    expect(ui.pills()).toBe(3);
    ui.close();
  });

  it("lights after a move, takes it back on the second tap, and stays put afterward", () => {
    const game = landed();
    const ui = open(game);
    expect(ui.undo()!.disabled).toBe(true);

    const cardBeforeUndo = game.card;
    game.hireOwner();
    flushSync();
    expect(game.owner).not.toBeNull();
    expect(ui.undo()!.disabled).toBe(false);

    // The first tap only asks. A rewind is the one move a game gets and it
    // sits under the thumb beside the ✕, so it confirms exactly as the ✕ does.
    ui.tap(ui.undo()!);
    expect(game.owner).not.toBeNull();
    expect(game.undoUsed).toBe(false);
    expect(ui.undo()!.textContent!.trim()).toBe("UNDO?");
    expect(ui.undo()!.getAttribute("aria-label")).toBe(
      "Undo last move: tap again to confirm",
    );

    ui.tap(ui.undo()!);
    expect(game.owner).toBeNull();
    expect(game.undoUsed).toBe(true);
    // The card comes back as the SAME OBJECT the reel was already on — not a
    // fresh wrapper around it.
    //
    // `game.card` is a `$state` field, so what it holds is already a reactive
    // proxy of `theCard` and has been since before any of this — identity
    // against the literal is false on both sides of the rewind, and that is
    // the engine's normal state rather than the rewind's doing. What is
    // asserted is that the reel comes back pointing at the object it was
    // already on, so nothing downstream of the rewind is handed a second,
    // differently-wrapped view of the same card.
    //
    // Only jsdom can see this at all: the node suite runs svelte's server
    // runtime, where `$state` is inert and there is no proxy to compare.
    expect(game.card).toBe(cardBeforeUndo);
    // Consumed, and the pill is still in the corner holding its box rather
    // than vanishing and shifting the two beside it.
    expect(ui.undo()).not.toBeNull();
    expect(ui.undo()!.disabled).toBe(true);
    expect(ui.pills()).toBe(3);
    ui.close();
  });
});

describe("the confirm", () => {
  it("lapses on its own after the ✕'s 2500ms, taking back nothing", () => {
    vi.useFakeTimers();
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();

    ui.tap(ui.undo()!);
    expect(ui.undo()!.textContent!.trim()).toBe("UNDO?");
    // 2500ms exactly, the ✕'s number — one confirm in the corner cannot expire
    // on a different clock from the one beside it.
    vi.advanceTimersByTime(2499);
    flushSync();
    expect(ui.undo()!.textContent!.trim()).toBe("UNDO?");
    vi.advanceTimersByTime(1);
    flushSync();
    expect(ui.undo()!.textContent!.trim()).not.toBe("UNDO?");
    // A confirm the player let lapse is not a rewind, and must not be counted
    // as one — ↩️ SECOND THOUGHTS is earned by the second tap or not at all.
    expect(game.owner).not.toBeNull();
    expect(game.undoUsed).toBe(false);
    ui.close();
    vi.useRealTimers();
  });

  it("disarms on a tap anywhere else, and the tap is not consumed", () => {
    // A tap that is not the pill answers "UNDO?" with no — the lapse's
    // outcome without the wait. Capture-phase pointerdown, so it hears taps
    // whose CLICK a component swallows with stopPropagation.
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();
    ui.tap(ui.undo()!);
    expect(ui.undo()!.textContent!.trim()).toBe("UNDO?");

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    flushSync();
    expect(ui.undo()!.textContent!.trim()).not.toBe("UNDO?");
    // Disarmed, never confirmed: nothing was taken back.
    expect(game.owner).not.toBeNull();
    expect(game.undoUsed).toBe(false);
    ui.close();
  });

  it("does not disarm on the pointerdown of its own confirming tap", () => {
    // The second tap's pointerdown lands INSIDE the pill and must be ignored,
    // or the click behind it would arrive at a pill already disarmed and read
    // as a fresh arming tap instead of the confirm.
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();
    ui.tap(ui.undo()!);

    ui.undo()!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    flushSync();
    expect(ui.undo()!.textContent!.trim()).toBe("UNDO?");
    ui.close();
  });

  it("disarms when the rewind goes away underneath it", () => {
    // The reel lands, the club completes, the run is quit: a "UNDO?" left on a
    // control that has gone dead is asking for a tap that would do nothing.
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();
    ui.tap(ui.undo()!);
    expect(ui.undo()!.textContent!.trim()).toBe("UNDO?");

    game.phase = "finale";
    flushSync();
    expect(ui.undo()!.disabled).toBe(true);
    expect(ui.undo()!.textContent!.trim()).not.toBe("UNDO?");
    ui.close();
  });

  it("reports its armed state to the host, which is what steps the ✕ back", () => {
    const game = landed();
    const ui = open(game);
    game.hireOwner();
    flushSync();

    ui.tap(ui.undo()!);
    expect(ui.confirms.at(-1)).toBe(true);
    expect(ui.undo()!.classList.contains("armed")).toBe(true);
    ui.tap(ui.undo()!);
    expect(ui.confirms.at(-1)).toBe(false);
    ui.close();
  });

  it("steps back for the ✕'s confirm, and stops doing so once it has one of its own", () => {
    // Request #3 in one assertion: while either pill is asking for a second
    // tap, the other one is backdrop. The pill that IS confirming never steps
    // back, however the host has it flagged.
    const game = landed();
    const ui = open(game, true);
    game.hireOwner();
    flushSync();
    expect(ui.undo()!.classList.contains("pushed")).toBe(true);

    ui.tap(ui.undo()!);
    expect(ui.undo()!.classList.contains("armed")).toBe(true);
    expect(ui.undo()!.classList.contains("pushed")).toBe(false);
    ui.close();
  });
});

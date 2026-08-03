// @vitest-environment jsdom
/** The undo pill in the corner group: when it is drawn, and what it does with
 * nothing to do.
 *
 * The rule the mount is here to hold is DISABLED, NOT GONE. A control that
 * appears and disappears inside a group of fixed pills moves its neighbours
 * under the player's thumb between taps, which is the same trade Home.svelte's
 * LAST GAME button makes and the same one it documents. That has to reach the
 * DOM as a real `disabled` attribute on an element that is still there — a
 * fade would satisfy a screenshot and still let a tap through.
 *
 * Geometry is not asserted here for home-under.dom.test.ts's reason: jsdom has
 * no layout, so a position assertion would pass on zeroes. The one geometric
 * question this feature raised — whether the ✕ arming into "QUIT?" would grow
 * over the pill — was settled off the font metrics and is recorded beside
 * `.undo` in the component.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

function open(game: Game | null) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(CornerButtons, { target, props: { game } });
  flushSync();
  return {
    target,
    undo: () => target.querySelector(".undo") as HTMLButtonElement | null,
    pills: () => target.querySelectorAll("button.help").length,
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

  it("lights after a move, takes it back on the tap, and stays put afterward", () => {
    const game = landed();
    const ui = open(game);
    expect(ui.undo()!.disabled).toBe(true);

    const cardBeforeUndo = game.card;
    game.hireOwner();
    flushSync();
    expect(game.owner).not.toBeNull();
    expect(ui.undo()!.disabled).toBe(false);

    ui.undo()!.click();
    flushSync();
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

// @vitest-environment jsdom
/** Tapping a signed seat on the phone: the unfold wiring.
 *
 * rail-badges.test.ts pins the seat's markup (the mark row, SSR's resting
 * div). What is pinned here is the phone's state machine: a tap unfolds the
 * seat in place (`expanded` + aria-expanded — the class that carries the
 * full-width finale-row geometry), a second tap folds it, one seat unfolds
 * at a time, and the offer is WITHDRAWN entirely while a pick is armed —
 * one question at a time, and mid-pick the rail's seats belong to the
 * picker.
 *
 * jsdom has no layout, so nothing about the grid drop or what CSS reveals is
 * testable; that geometry is RailSeat's and checked by eye. matchMedia is
 * stubbed to "not desktop", which is what makes the rail wire the tap at
 * all — the same gate that leaves desktop seats as resting divs. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import { forgeGame, mkCard, mkPlayer, mkSigned } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";

// jsdom ships no ResizeObserver, and the rail's bind:clientHeight (the phone
// pin's spacer measurement) is implemented with one. Layout is not what this
// file is about — quit-badge.dom.test.ts documents the same stub.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
// Phone width: the rail asks "(min-width: 760px)" and takes NO for phone.
// Reduced motion answers YES so the peek's fly transition runs at duration 0
// — jsdom has no animation clock, and a 160ms outro would hold the closed
// panel in the DOM past the assertions.
vi.stubGlobal("matchMedia", (q: string) => ({
  matches: q.includes("prefers-reduced-motion"),
  media: q,
  addEventListener() {},
  removeEventListener() {},
}));

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };

let host: HTMLElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any = null;
afterEach(() => {
  if (app) unmount(app);
  host?.remove();
  app = null;
  host = null;
});

function board(game: Game): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = mount(RosterRail, { target: host, props: { game } });
  flushSync();
  return host;
}

function signedGame(mutate?: (g: Game) => void): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard({
      players: [mkPlayer({ id: "sp1", name: "Freddy Garcia", pos: "SP", war: 4.9, cost: 26.1 })],
    });
    g.slots[0] = mkSigned({ name: "Bret Boone", pos: "C", costPaid: 9, awards: ["SS"], ws: true });
    g.slots[1] = mkSigned({ name: "Edgar Martinez", pos: "IF", costPaid: 11, awards: ["AS"] });
    mutate?.(g);
  });
}

const seats = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>("button.cell.filled")];
const peeks = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(".peek")];

describe("signed-seat peek (phone)", () => {
  it("a tap opens the peek over the grid with the full read; tapping it closes", () => {
    const el = board(signedGame());
    const [boone] = seats(el);
    expect(boone.getAttribute("aria-expanded")).toBe("false");
    expect(peeks(el)).toHaveLength(0);

    boone.click();
    flushSync();
    expect(boone.getAttribute("aria-expanded")).toBe("true");
    const [peek] = peeks(el);
    expect(peek).toBeDefined();
    // The rail's seat says "Boone"; the peek has room for the whole card:
    // full name, season, paid price, and the season's hardware.
    expect(peek.textContent).toContain("Bret Boone");
    expect(peek.textContent).toContain("2001 SEA");
    expect(peek.textContent).toContain("$9M");
    expect(peek.textContent).toContain("💍");
    // The grid beneath washes out while the peek is up.
    expect(el.querySelector(".rail.peeking")).not.toBeNull();

    // The whole panel is the close button.
    peek.click();
    flushSync();
    expect(peeks(el)).toHaveLength(0);
    expect(boone.getAttribute("aria-expanded")).toBe("false");
  });

  it("a tap on another chair folds the open peek and opens nothing", () => {
    const el = board(signedGame());
    const [boone, edgar] = seats(el);
    boone.click();
    flushSync();
    expect(peeks(el)).toHaveLength(1);
    // A real tap is pointerdown then click. The capture-phase dismisser must
    // leave a press on a rail chair for tapInfo — which reads any tap while
    // a peek is up as a dismissal, not a switch (owner call).
    edgar.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    edgar.click();
    flushSync();
    expect(peeks(el)).toHaveLength(0);
    expect(boone.getAttribute("aria-expanded")).toBe("false");
    expect(edgar.getAttribute("aria-expanded")).toBe("false");

    // Switching costs two taps: the second one opens the other chair fresh.
    edgar.click();
    flushSync();
    const open = peeks(el);
    expect(open).toHaveLength(1);
    expect(open[0].textContent).toContain("Edgar Martinez");
    // A top-row seat's panel anchors high; the .low anchor is the bottom
    // row's, pinned in its own test below.
    expect(open[0].classList.contains("low")).toBe(false);
  });

  it("a bottom-row seat's peek anchors low", () => {
    const g = signedGame((gg) => {
      gg.slots[5] = mkSigned({ name: "Randy Johnson", pos: "SP", costPaid: 14 });
    });
    const el = board(g);
    const rj = seats(el).find((b) => b.textContent?.includes("Johnson"))!;
    rj.click();
    flushSync();
    expect(peeks(el)[0].classList.contains("low")).toBe(true);
  });

  it("the manager's chair peeks too — full name, season, MOY, pennant", () => {
    const g = signedGame((gg) => {
      gg.manager = {
        name: "Lou Piniella",
        wins: 116,
        losses: 46,
        year: 2001,
        team: "SEA",
        teamName: "Seattle Mariners",
        ws: false,
        pen: true,
        moty: true,
      };
    });
    const el = board(g);
    const mgr = el.querySelector<HTMLButtonElement>("button.mgr.filled");
    expect(mgr).not.toBeNull();
    mgr!.click();
    flushSync();
    const [peek] = peeks(el);
    expect(peek).toBeDefined();
    expect(peek.textContent).toContain("Lou Piniella");
    expect(peek.textContent).toContain("2001 SEA");
    expect(peek.textContent).toContain("MOY");
    expect(peek.textContent).toContain("🚩");
    // No salary line: the skipper's cost is not a Signed.costPaid.
    expect(peek.querySelector(".psal")).toBeNull();
    // The chair the box left goes dark (.mgrpeek → opacity 0, outline and
    // all): the MGR chair spans both grid rows, so unlike a player seat
    // the panel does not cover it — its lower half read as a second WAR
    // chip hanging under the panel's.
    expect(el.querySelector(".rail")!.classList.contains("mgrpeek")).toBe(true);
  });

  it("a player's peek does not empty the manager's chair", () => {
    const el = board(signedGame());
    seats(el)[0].click();
    flushSync();
    expect(peeks(el)).toHaveLength(1);
    expect(el.querySelector(".rail")!.classList.contains("mgrpeek")).toBe(false);
  });

  it("a tap anywhere outside the panel closes it", () => {
    const el = board(signedGame());
    seats(el)[0].click();
    flushSync();
    expect(peeks(el)).toHaveLength(1);
    // The dismissal listens on capture-phase pointerdown, PillSlot's
    // grammar — the tap that closes must not need to reach any button.
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    flushSync();
    expect(peeks(el)).toHaveLength(0);
  });

  it("left alone, the peek folds itself away — the quit pill's auto-disarm", () => {
    vi.useFakeTimers();
    try {
      const el = board(signedGame());
      seats(el)[0].click();
      flushSync();
      expect(peeks(el)).toHaveLength(1);
      // The beat is 4000ms exactly — long enough to read a badge row, and
      // pinned on both sides so a regression to a blink (or to forever)
      // fails here.
      vi.advanceTimersByTime(3999);
      flushSync();
      expect(peeks(el)).toHaveLength(1);
      vi.advanceTimersByTime(2);
      flushSync();
      expect(peeks(el)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("scrolling does NOT close the peek — the owner's no-scroll-dismiss call", () => {
    const el = board(signedGame());
    seats(el)[0].click();
    flushSync();
    window.dispatchEvent(new Event("scroll", { bubbles: true }));
    document.dispatchEvent(new Event("scroll", { bubbles: true }));
    flushSync();
    expect(peeks(el)).toHaveLength(1);
  });

  it("Escape folds the peek — a keyboard that opens a disclosure can shut it", () => {
    const el = board(signedGame());
    seats(el)[0].click();
    flushSync();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    flushSync();
    expect(peeks(el)).toHaveLength(0);
  });

  it("closing from inside the panel hands focus back to the chair", () => {
    const el = board(signedGame());
    const [boone] = seats(el);
    boone.click();
    flushSync();
    const [peek] = peeks(el);
    peek.focus();
    expect(document.activeElement).toBe(peek);
    peek.click();
    flushSync();
    expect(peeks(el)).toHaveLength(0);
    expect(document.activeElement).toBe(boone);
  });

  it("the peek folds when its occupant leaves, and does not haunt the refill", () => {
    const g = signedGame();
    const el = board(g);
    const [chair] = seats(el);
    chair.click();
    flushSync();
    expect(peeks(el)).toHaveLength(1);
    // Every closer funnels through fold(). Here the chair itself unmounts
    // with its occupant, so there is nothing to hand focus back to — the
    // isConnected guard is what keeps fold() from focusing a ghost. The
    // assertion below pins that this degrades quietly (focus falls to body,
    // no throw), not that it restores.
    peeks(el)[0].focus();

    // The seat empties under the open panel (an undo's rewind, the Trade
    // Deadline's release): the panel is ABOUT someone, so it folds rather
    // than lying open-but-blank and eating the next tap as a dismissal.
    g.slots[0] = null;
    flushSync();
    expect(peeks(el)).toHaveLength(0);
    expect(chair.isConnected).toBe(false);
    expect(document.activeElement).toBe(document.body);

    // A new man in the same chair does not inherit the old panel — no peek
    // opens without a tap, and the next tap opens HIS read.
    g.slots[0] = mkSigned({ name: "Dan Wilson", pos: "C", costPaid: 4 });
    flushSync();
    expect(peeks(el)).toHaveLength(0);
    seats(el)[0].click();
    flushSync();
    expect(peeks(el)[0].textContent).toContain("Dan Wilson");
  });

  it("the chair names its panel: aria-controls only while expanded", () => {
    const el = board(signedGame());
    const [boone] = seats(el);
    expect(boone.getAttribute("aria-controls")).toBeNull();
    boone.click();
    flushSync();
    expect(boone.getAttribute("aria-controls")).toBe("railpeek");
    expect(peeks(el)[0].id).toBe("railpeek");
    boone.click();
    flushSync();
    expect(boone.getAttribute("aria-controls")).toBeNull();
  });

  it("Eye Test peek: the paid price shows, the talent read stays enveloped", () => {
    const g = forgeGame({ difficulty: "scout", bank: "classic" }, (gg) => {
      gg.card = mkCard({
        players: [mkPlayer({ id: "sp1", name: "Freddy Garcia", pos: "SP", war: 4.9, cost: 26.1 })],
      });
      gg.slots[0] = mkSigned({ name: "Bret Boone", pos: "C", costPaid: 9, awards: ["SS"], ws: true });
    });
    const el = board(g);
    seats(el)[0].click();
    flushSync();
    const [peek] = peeks(el);
    // Salary is sunk cost — always visible. Awards, hardware, WAR and its
    // tier classes are talent reads and wait for the finale.
    expect(peek.textContent).toContain("$9M");
    expect(peek.querySelector(".pbadges")).toBeNull();
    expect(peek.querySelector(".warchip")).toBeNull();
    expect(peek.textContent).not.toContain("💍");
    expect(peek.innerHTML).not.toContain("war-");
  });

  it("arming a pick closes the peek and withdraws the offer", () => {
    const g = signedGame();
    const el = board(g);
    seats(el)[0].click();
    flushSync();
    expect(peeks(el)).toHaveLength(1);

    // The card's SP arms a slot pick: open SP seats become the picker's
    // buttons, Boone's occupied C seat falls back to the resting div, and
    // the peek folds away under the pick.
    g.slotPick = "sp1";
    flushSync();
    expect(peeks(el)).toHaveLength(0);
    expect(seats(el)).toHaveLength(0);
    expect(el.querySelector("button.cell.pickable")).not.toBeNull();
  });
});

// @vitest-environment jsdom
/** The landing thunk's state machine: WHEN a seat wears .landed.
 *
 * The animation itself is CSS (RailSeat's seat-land keyframe — jsdom has no
 * animation clock). What is pinned here is the diff that drives it: the
 * class appears on the empty→filled edge and ONLY there. A rail mounted
 * over an already-filled roster (a restore, a reload, an iOS tab eviction)
 * must never thunk — that replay toll is why the trigger is an occupancy
 * diff seeded at mount rather than keyed markup — and the mark clears once
 * the animation is over so later re-renders stay still. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import { forgeGame, mkCard, mkSigned } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
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

const landed = (el: HTMLElement) => [...el.querySelectorAll(".landed")];

describe("seat landing thunk", () => {
  it("a signing thunks its seat, and the mark clears after the animation", () => {
    vi.useFakeTimers();
    try {
      const g = forgeGame(CLASSIC, (gg) => {
        gg.card = mkCard();
      });
      const el = board(g);
      expect(landed(el)).toHaveLength(0);

      g.slots[0] = mkSigned({ name: "Bret Boone", pos: "C", costPaid: 9 });
      flushSync();
      const marks = landed(el);
      expect(marks).toHaveLength(1);
      expect(marks[0].classList.contains("cell")).toBe(true);
      expect(marks[0].textContent).toContain("Boone");

      // Transient: once the 0.45s thunk has played, the class is gone, so a
      // later re-render of the same seat has nothing left to replay.
      vi.advanceTimersByTime(600);
      flushSync();
      expect(landed(el)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a rail mounted over a filled roster does not thunk — restores are silent", () => {
    const g = forgeGame(CLASSIC, (gg) => {
      gg.card = mkCard();
      gg.slots[0] = mkSigned({ name: "Bret Boone", pos: "C", costPaid: 9 });
      gg.slots[5] = mkSigned({ name: "Greg Maddux", pos: "SP", costPaid: 34 });
    });
    const el = board(g);
    expect(landed(el)).toHaveLength(0);
  });

  it("the manager's hire thunks his chair", () => {
    const g = forgeGame(CLASSIC, (gg) => {
      gg.card = mkCard();
    });
    const el = board(g);
    g.manager = {
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
    flushSync();
    const marks = landed(el);
    expect(marks).toHaveLength(1);
    expect(marks[0].classList.contains("mgr")).toBe(true);
  });

  it("an emptied seat says nothing, and only the refilled one thunks", () => {
    const g = forgeGame(CLASSIC, (gg) => {
      gg.card = mkCard();
      gg.slots[0] = mkSigned({ name: "Bret Boone", pos: "C", costPaid: 9 });
    });
    const el = board(g);
    // The release itself is silent (the arrival is the beat, not the exit).
    g.slots[0] = null;
    flushSync();
    expect(landed(el)).toHaveLength(0);
    // The swap-in lands.
    g.slots[0] = mkSigned({ name: "Dan Wilson", pos: "C", costPaid: 4 });
    flushSync();
    expect(landed(el)).toHaveLength(1);
  });
});

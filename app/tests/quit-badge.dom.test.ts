// @vitest-environment jsdom
/** WHICH tap earns 🧳 PACKED IT IN.
 *
 * The badge's storage contract is asserted in quit-badge.test.ts. What only a
 * mounted App can show is the control flow around it: the quit is two taps,
 * and only the second one is a quit. Arming and thinking better of it must
 * leave the log exactly as it found it — otherwise the badge stops meaning
 * "you walked away" and starts meaning "you touched the ✕", which is a
 * different and much easier thing to do by accident.
 *
 * The game is reached by RESTORING a save rather than by pressing PLAY: boot
 * lands straight in a live game, with no reel animation and no card fetch to
 * wait on. That is the state a quit is actually taken from.
 *
 * The finale's ✕ is not covered here — that path needs a renderable finale
 * archive, which means a played-out game. It is argued instead by the code:
 * `tapQuit` returns at `goHome()` before `quitArmed` is ever set when the
 * phase is "finale", so no tap on the finale can reach the confirm branch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import App from "../src/App.svelte";
import { loadHistory } from "../src/lib/history";

// jsdom ships neither of these, and the board's rail measures itself with one.
// Both are layout concerns, and layout is not what this file is about.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.stubGlobal("scrollTo", () => {});
// Reduced motion, so the spin banner lands its card in one step instead of
// running a decelerating flicker chain of self-scheduling timers. Those timers
// outlive the component and read a prop the quit has already nulled — a real
// (and harmless-on-screen) rough edge in SpinBanner, but here it would surface
// as an unhandled exception attributed to whichever test was running.
vi.stubGlobal("matchMedia", (q: string) => ({
  matches: q.includes("prefers-reduced-motion"),
  media: q,
  addEventListener() {},
  removeEventListener() {},
}));

/** The real data directory, lazily — the same JSON the dev server hands the
 * app, so a shape change in the pipeline surfaces here rather than in a fixture
 * that quietly drifted from it. Lazy because it covers ~1200 card files and a
 * booted game reads exactly one of them.
 *
 * Vite's glob rather than node:fs: this project's tsconfig declares only
 * `vite/client`, so `node:fs` has no types here. */
const files = import.meta.glob<unknown>("../public/data/**/*.json", {
  import: "default",
});

vi.stubGlobal("fetch", async (url: unknown) => {
  const load = files[`../public/${String(url).replace(/^\.?\//, "")}`];
  if (!load) return { ok: false, status: 404 };
  const body = await load();
  return { ok: true, json: async () => body };
});

/** A game in progress, parked before a spin: no card to fetch, nothing
 * animating, and `phase !== "finale"` — which is all the quit path reads. */
const SAVE = JSON.stringify({
  v: 6,
  config: { difficulty: "standard", bank: "classic" },
  seed: 42,
  rngState: 12345,
  spinCount: 2,
  seen: [],
  phase: "preSpin",
  cardRef: null,
  slots: [null, null, null, null, null, null, null, null, null],
  owner: null,
  stadium: null,
  manager: null,
  powerups: {
    seasonTicket: "ready",
    relocate: "ready",
    prime: "ready",
    doublePlay: "ready",
    tradeDeadline: "ready",
    hometown: "ready",
  },
  choicesLeft: 1,
  choicesUsed: 0,
  spinLog: [],
});

let cleanup: (() => void) | null = null;

/** Boot the app into the restored game and hand back its header ✕. */
async function inGame() {
  localStorage.setItem("hotstove.current", SAVE);
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(App, { target });
  const quit = await vi.waitFor(() => {
    flushSync();
    const b = target.querySelector("header .quit") as HTMLButtonElement | null;
    expect(b).not.toBeNull();
    return b!;
  });
  cleanup = () => {
    unmount(app);
    target.remove();
  };
  // The stove never idles: a restored preSpin rolls a card straight away. Let
  // it land before quitting, so the quit is taken from a settled board rather
  // than from the middle of a fetch.
  await vi.waitFor(() => {
    flushSync();
    expect(
      JSON.parse(localStorage.getItem("hotstove.current") ?? "{}").phase,
    ).toBe("landed");
  });
  return {
    quit,
    tap: () => {
      quit.click();
      flushSync();
    },
    home: () => target.querySelector(".under") !== null,
    saved: () => localStorage.getItem("hotstove.current") !== null,
  };
}

const quitBadges = () =>
  loadHistory().filter((e) => (e.badges ?? []).includes("packedin"));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup?.();
  cleanup = null;
  document.body.replaceChildren();
});

describe("the ✕ in a live game", () => {
  it("earns nothing on the arming tap", async () => {
    const ui = await inGame();
    ui.tap();
    // Armed, still in the game, still saved, nothing logged.
    expect(ui.quit.textContent!.trim()).toBe("QUIT?");
    expect(ui.home()).toBe(false);
    expect(ui.saved()).toBe(true);
    expect(quitBadges()).toHaveLength(0);
  });

  // Real time, not fake: the board's spin reel schedules timers of its own,
  // and jumping the whole clock forward fires those too.
  it("earns nothing when the confirm is left to lapse", { timeout: 15000 }, async () => {
    const ui = await inGame();
    ui.tap();
    // The 2.5s confirm window closes on its own. A player who thought better
    // of it has not quit, and must not be filed as having quit.
    await new Promise((r) => setTimeout(r, 2700));
    flushSync();
    expect(ui.quit.textContent!.trim()).toBe("✕");
    expect(ui.saved()).toBe(true);
    expect(quitBadges()).toHaveLength(0);

    // …and the next tap arms again rather than quitting.
    ui.tap();
    expect(ui.quit.textContent!.trim()).toBe("QUIT?");
    expect(quitBadges()).toHaveLength(0);
  });

  it("earns it on the confirming tap, once, and drops the save", async () => {
    const ui = await inGame();
    ui.tap();
    ui.tap();

    expect(quitBadges()).toHaveLength(1);
    // The badge is written BEFORE the save goes, and the save does go.
    expect(ui.saved()).toBe(false);
    expect(ui.home()).toBe(true);
    // And the row it wrote is the unscored one, so the record book is unmoved.
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].total).toBeUndefined();
  });

  it("earns one per quit, not one per tap", async () => {
    const first = await inGame();
    first.tap();
    first.tap();
    cleanup?.();
    cleanup = null;

    const second = await inGame();
    second.tap();
    second.tap();
    expect(quitBadges()).toHaveLength(2);
  });
});

/** The Konami listener, which only a mounted App can show.
 *
 * `markKonami` and its save/restore round trip are pinned in engine.test.ts.
 * What lives here is the half that is App's: the sequence matcher, the text-
 * field exemption, and the fact that the keystroke reaches a live game's save
 * rather than a variable that a reload throws away.
 *
 * The game is reached by RESTORING a save for the same reason the quit tests
 * are — boot lands straight in a live game with nothing animating. */
const CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

function press(keys: string[], target?: EventTarget) {
  for (const key of keys) {
    const e = new window.KeyboardEvent("keydown", { key, bubbles: true });
    (target ?? window).dispatchEvent(e);
  }
  flushSync();
}

const savedKonami = () =>
  JSON.parse(localStorage.getItem("hotstove.current") ?? "{}").konami === true;

describe("the Konami code in a live game", () => {
  it("earns 🎮 and writes it into the save", async () => {
    await inGame();
    expect(savedKonami()).toBe(false);
    press(CODE);
    expect(savedKonami()).toBe(true);
  });

  it("takes the sequence in the right order only", async () => {
    await inGame();
    press(["ArrowUp", "ArrowDown", "ArrowUp", "ArrowUp", "b", "a"]);
    expect(savedKonami()).toBe(false);
  });

  it("survives a false start on the repeated opening key", async () => {
    // The sequence opens ↑↑, so a miss must reset to "one ↑ seen" rather than
    // to zero — otherwise a third ↑ eats the real first key and the rest fails.
    await inGame();
    press(["ArrowUp", ...CODE]);
    expect(savedKonami()).toBe(true);
  });

  it("recovers after a wrong key mid-sequence", async () => {
    await inGame();
    press(["ArrowUp", "ArrowUp", "ArrowDown", "x"]);
    expect(savedKonami()).toBe(false);
    press(CODE);
    expect(savedKonami()).toBe(true);
  });

  it("takes the letters in either case", async () => {
    await inGame();
    press([...CODE.slice(0, 8), "B", "A"]);
    expect(savedKonami()).toBe(true);
  });

  it("ignores keys typed into a text field", async () => {
    // The home screen's PLAY A SEED input is a real text field on this app,
    // and a code typed into one is somebody entering a seed.
    await inGame();
    const input = document.createElement("input");
    document.body.appendChild(input);
    press(CODE, input);
    expect(savedKonami()).toBe(false);
    input.remove();
    // …and the ignored keys did not advance the matcher either, so the same
    // sequence on the window still has to be entered whole.
    press(CODE);
    expect(savedKonami()).toBe(true);
  });

  it("leaves the run exactly where it was", async () => {
    // 🎮 grants nothing: same phase, same spin count, same powerups.
    const ui = await inGame();
    const before = localStorage.getItem("hotstove.current")!;
    press(CODE);
    const after = JSON.parse(localStorage.getItem("hotstove.current")!);
    const wasSaved = JSON.parse(before);
    delete after.konami;
    delete wasSaved.konami;
    expect(after).toEqual(wasSaved);
    expect(ui.saved()).toBe(true);
  });
});

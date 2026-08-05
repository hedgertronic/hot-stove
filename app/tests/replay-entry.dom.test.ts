// @vitest-environment jsdom
/** The two ways into a shared season: the home screen's SEED field, which now
 * takes a full game code as well as a seed, and the finale's two code chips.
 *
 * THE DISCRIMINATION RULE IS SHAPE, and nothing else. A bare or #-prefixed
 * base36 token of 7 characters or fewer is a SEED — a new game on those cards,
 * counting toward the record book exactly as it always did. Anything longer is
 * a GAME CODE, replayed read-only. The two cannot overlap: a shortcode's header
 * alone is 12 characters.
 *
 * A mistyped seed keeps the shake it always had. The one failure that gets
 * words is a game code this build cannot replay — nothing about a 60-character
 * string says why it was refused.
 *
 * On the finale: the seed chip says SEED, not GAME, because the code beside it
 * is the game. The game code is never PRINTED — only copied — so the assertions
 * here check that the button exists, is labelled, and hands the clipboard the
 * string `Game#debugLog()` produces.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Finale from "../src/components/Finale.svelte";
import Home from "../src/components/Home.svelte";
import { Game, SLOT_TYPES, type Signed } from "../src/lib/engine.svelte";
import type { Card, GameIndex, Meta, Owners } from "../src/lib/types";

// ---------- home: seed vs shortcode ----------

function openHome(onreplay?: (code: string) => Promise<boolean>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onplay = vi.fn();
  const app = mount(Home, {
    target,
    props: { config: { difficulty: "standard", bank: "classic" }, onplay, onopen: vi.fn(), onreplay },
  });
  const calls = () => (onreplay as unknown as { mock?: { calls: unknown[] } })?.mock?.calls.length ?? 0;
  flushSync();
  const seedBtn = target.querySelector(".ubtn") as HTMLButtonElement;
  seedBtn.click();
  flushSync();
  const input = target.querySelector(".seedin") as HTMLInputElement;
  /** Something answered the GO: a game started, the replay host was called,
   * the field said why not, or the pill shook. */
  const handled = () =>
    onplay.mock.calls.length > 0 ||
    calls() > 0 ||
    target.querySelector(".seederr") !== null ||
    target.querySelector(".seedzone.bad") !== null;
  return {
    target,
    onplay,
    input,
    err: () => target.querySelector(".seederr") as HTMLElement | null,
    /** Type a code and press GO, then let the (async) handler settle. */
    go: async (code: string) => {
      input.value = code;
      input.dispatchEvent(new Event("input"));
      flushSync();
      (target.querySelector(".seedgo") as HTMLButtonElement).click();
      // The handler is async (the replay host is), so the render that answers
      // it lands a microtask or two later than the click.
      await vi.waitFor(() => {
        flushSync();
        expect(handled()).toBe(true);
      });
    },
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

/** A syntactically valid v2 shortcode: 12-char header, one signing token. */
const CODE = "2000000Xsc6-S00";

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());

describe("the SEED field takes both kinds of code", () => {
  it("plays a 7-char seed as a new game, never as a replay", async () => {
    const onreplay = vi.fn(async () => true);
    const ui = openHome(onreplay);
    await ui.go("#0KF12OY");
    expect(ui.onplay).toHaveBeenCalledTimes(1);
    // The parsed seed, not the string — the same call PLAY A SEED always made.
    expect(ui.onplay.mock.calls[0][1]).toBe(parseInt("0KF12OY", 36));
    expect(onreplay).not.toHaveBeenCalled();
    ui.close();
  });

  it("takes the bare form too, and folds case like it always has", async () => {
    const onreplay = vi.fn(async () => true);
    const ui = openHome(onreplay);
    await ui.go("0kf12oy");
    expect(ui.onplay.mock.calls[0][1]).toBe(parseInt("0KF12OY", 36));
    expect(onreplay).not.toHaveBeenCalled();
    ui.close();
  });

  it("routes a full shortcode to the replay, and starts no game", async () => {
    const onreplay = vi.fn(async () => true);
    const ui = openHome(onreplay);
    await ui.go(CODE);
    expect(onreplay).toHaveBeenCalledWith(CODE);
    expect(ui.onplay).not.toHaveBeenCalled();
    expect(ui.err()).toBeNull();
    ui.close();
  });

  it("hands the code over unfolded — a shortcode's case is its parameters", async () => {
    const onreplay = vi.fn(async () => true);
    const ui = openHome(onreplay);
    await ui.go("2000000Xsc6-P0a12");
    expect(onreplay).toHaveBeenCalledWith("2000000Xsc6-P0a12");
    ui.close();
  });

  it("names the failure when a game code cannot be replayed here", async () => {
    const ui = openHome(async () => false);
    await ui.go(CODE);
    expect(ui.err()?.textContent).toContain("can't be replayed on this version");
    expect(ui.onplay).not.toHaveBeenCalled();
    ui.close();
  });

  it("answers a mistyped seed with the shake and no sentence", async () => {
    const ui = openHome(async () => false);
    await ui.go("!!!!");
    expect(ui.onplay).not.toHaveBeenCalled();
    expect(ui.err()).toBeNull();
    expect(ui.target.querySelector(".seedzone.bad")).not.toBeNull();
    ui.close();
  });

  it("holds a whole shortcode — the field's maxlength fits one", () => {
    const ui = openHome();
    expect(Number(ui.input.getAttribute("maxlength"))).toBeGreaterThanOrEqual(120);
    // The placeholder still advertises the common case.
    expect(ui.input.getAttribute("placeholder")).toBe("#0KF12OY");
    ui.close();
  });
});

// ---------- finale: the two code chips ----------

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
  cards: [{ team: "CHC", year: 2016, franchise: "CHC", name: "Chicago Cubs", lg: "NL", div: "C" }],
};
const owners: Owners = {
  franchises: { CHC: { name: "Chicago Cubs", owners: [{ name: "Ricketts family", from: 2009, to: null }] } },
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
  ws: true,
  pen: false,
  attendance: 3_232_420,
  attendancePct: 0.86,
  stadiumMult: 1.11,
  budget: 136.3,
  prorated: 1,
  players: [],
};

function filler(i: number): Signed {
  return {
    id: `f${i}`,
    name: "Filler",
    pos: "1B",
    war: 3,
    awards: [],
    ws: false,
    pen: false,
    year: 2016,
    team: "CHC",
    teamName: "Chicago Cubs",
    franchise: "CHC",
    costPaid: 10,
    hero: false,
    prorated: 1,
    age: 28,
  };
}

/** A finished game, built by hand — the finale screen only reads state. */
async function finishedGame(): Promise<Game> {
  const g = new Game(meta, index, owners, 42, { difficulty: "standard", bank: "moneyball" });
  g.card = theCard;
  g.phase = "landed";
  g.choicesLeft = 1;
  g.seen = [{ team: "CHC", year: 2016 }];
  for (let i = 0; i < SLOT_TYPES.length; i++) g.slots[i] = filler(i);
  g.powerups.tradeDeadline = "spent";
  g.hireManager();
  await vi.waitFor(() => expect(g.phase).toBe("finale"));
  return g;
}

function openFinale(game: Game, replay = false) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const onmodes = vi.fn();
  const app = mount(Finale, {
    target,
    props: { game, resolved: true, replay, onreplay: vi.fn(), onmodes },
  });
  flushSync();
  const chips = () => [...target.querySelectorAll(".seedchip")] as HTMLButtonElement[];
  return {
    target,
    onmodes,
    chips,
    buttons: () => [...target.querySelectorAll(".fin-actions .btn")] as HTMLButtonElement[],
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

describe("the finale's code chips", () => {
  it("labels the seed chip SEED, and copies just the seed", async () => {
    const g = await finishedGame();
    const written: string[] = [];
    vi.stubGlobal("navigator", { clipboard: { writeText: async (s: string) => void written.push(s) } });
    const ui = openFinale(g);
    const [seed, code] = ui.chips();
    expect(seed.textContent).toContain("SEED #");
    expect(seed.textContent).not.toContain("GAME #");
    expect(seed.getAttribute("aria-label")).toBeTruthy();
    seed.click();
    await vi.waitFor(() => {
      flushSync();
      expect(seed.textContent).toContain("COPIED");
    });
    expect(written).toEqual([expect.stringMatching(/^#[0-9A-Z]{7}$/)]);
    expect(code).toBeDefined();
    ui.close();
  });

  it("copies the whole game code without ever printing it", async () => {
    const g = await finishedGame();
    const written: string[] = [];
    vi.stubGlobal("navigator", { clipboard: { writeText: async (s: string) => void written.push(s) } });
    const ui = openFinale(g);
    const code = ui.chips()[1];
    expect(code.textContent).toContain("COPY GAME");
    expect(code.getAttribute("aria-label")).toBeTruthy();
    // The string itself is nowhere on the screen — it is 50–70 characters.
    expect(ui.target.textContent).not.toContain(g.debugLog());
    code.click();
    await vi.waitFor(() => {
      flushSync();
      expect(code.textContent).toContain("COPIED");
    });
    expect(written).toEqual([g.debugLog()]);
    ui.close();
  });

  it("both chips are real buttons", async () => {
    const g = await finishedGame();
    const ui = openFinale(g);
    for (const chip of ui.chips()) expect(chip.tagName).toBe("BUTTON");
    expect(ui.chips()).toHaveLength(2);
    ui.close();
  });
});

describe("a replayed finale's button row", () => {
  it("offers one way back instead of RUN IT BACK and MODES", async () => {
    const g = await finishedGame();
    const ui = openFinale(g, true);
    const labels = ui.buttons().map((b) => b.textContent?.trim() ?? "");
    expect(labels.some((l) => l.startsWith("BACK"))).toBe(true);
    expect(labels.some((l) => l.includes("RUN IT BACK"))).toBe(false);
    expect(labels.some((l) => l.includes("MODES"))).toBe(false);
    // Sharing someone else's season is the entire point of it being on screen.
    expect(labels.some((l) => l.includes("SHARE"))).toBe(true);
    ui.close();
  });

  it("keeps both code chips on a replay", async () => {
    const g = await finishedGame();
    const ui = openFinale(g, true);
    expect(ui.chips()).toHaveLength(2);
    ui.close();
  });

  it("still shows RUN IT BACK and MODES on your own finale", async () => {
    const g = await finishedGame();
    const ui = openFinale(g, false);
    const labels = ui.buttons().map((b) => b.textContent?.trim() ?? "");
    expect(labels.some((l) => l.includes("RUN IT BACK"))).toBe(true);
    expect(labels.some((l) => l.includes("MODES"))).toBe(true);
    ui.close();
  });
});

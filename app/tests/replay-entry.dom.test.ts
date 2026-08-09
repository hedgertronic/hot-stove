// @vitest-environment jsdom
/** The two ways into a shared season: the home screen's SEED field and the
 * finale's two code chips.
 *
 * TWO SIGILS, one field. `@`-prefixed input is an explicit game code — the
 * sigil is stripped and the remainder handed to the replay host. `#`-prefixed
 * or bare ≤7-char base36 is a SEED — a new game on those cards, counting
 * toward the record book. Bare strings ≥12 chars fall through to replay by
 * shape (backward compat for codes copied before the @ sigil existed).
 *
 * A mistyped seed keeps the shake it always had. The one failure that gets
 * words is a game code this build cannot replay.
 *
 * On the finale: two chips share the 7-char seed id, told apart by sigil.
 * SEED # copies the bare #seed (a fresh counting game on these cards); GAME @
 * copies the FULL game code with a leading @ so a paste routes straight to
 * replay. The full code is never printed on screen.
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

  it("answers a mistyped seed with the shake AND a sentence", async () => {
    // Words as well as motion: reduced-motion users get no shake at all
    // (app.css kills every animation), and only the sentence reaches a
    // screen reader.
    const ui = openHome(async () => false);
    await ui.go("!!!!");
    expect(ui.onplay).not.toHaveBeenCalled();
    expect(ui.err()?.textContent).toContain("Not a valid seed");
    expect(ui.target.querySelector(".seedzone.bad")).not.toBeNull();
    ui.close();
  });

  it("holds a whole shortcode — the field's maxlength fits one", () => {
    const ui = openHome();
    expect(Number(ui.input.getAttribute("maxlength"))).toBeGreaterThanOrEqual(120);
    // The placeholder keeps the seed-format example (#0KF12OY).
    expect(ui.input.getAttribute("placeholder")).toBe("#0KF12OY");
    ui.close();
  });

  it("routes an @-prefixed paste straight to replay, stripping the sigil", async () => {
    const onreplay = vi.fn(async () => true);
    const ui = openHome(onreplay);
    await ui.go(`@${CODE}`);
    // The @ is stripped before the code reaches the replay host.
    expect(onreplay).toHaveBeenCalledWith(CODE);
    expect(ui.onplay).not.toHaveBeenCalled();
    expect(ui.err()).toBeNull();
    ui.close();
  });

  it("shows the error when an @-prefixed code cannot be replayed", async () => {
    const ui = openHome(async () => false);
    await ui.go(`@${CODE}`);
    expect(ui.err()?.textContent).toContain("can't be replayed on this version");
    ui.close();
  });

  it("#-prefixed seed still plays a new game after the @ branch was added", async () => {
    const onreplay = vi.fn(async () => true);
    const ui = openHome(onreplay);
    await ui.go("#0KF12OY");
    expect(ui.onplay).toHaveBeenCalledTimes(1);
    expect(onreplay).not.toHaveBeenCalled();
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
  it("SEED # copies the bare seed; GAME @ copies the @-prefixed full code", async () => {
    const g = await finishedGame();
    const written: string[] = [];
    vi.stubGlobal("navigator", { clipboard: { writeText: async (s: string) => void written.push(s) } });
    const ui = openFinale(g);
    const chips = ui.chips();
    expect(chips).toHaveLength(2);
    const [seedChip, gameChip] = chips;
    // Both labels show the short id, told apart by sigil; the full code is
    // never printed anywhere on screen.
    expect(seedChip.textContent).toContain("SEED #");
    expect(gameChip.textContent).toContain("GAME @");
    expect(ui.target.textContent).not.toContain(g.debugLog());
    seedChip.click();
    await vi.waitFor(() => {
      flushSync();
      expect(seedChip.textContent).toContain("COPIED");
    });
    gameChip.click();
    await vi.waitFor(() => {
      flushSync();
      expect(gameChip.textContent).toContain("COPIED");
    });
    // The seed pastes as a #seed (fresh counting game); the game code pastes
    // as an @code the home entry routes straight to replay. The two agree by
    // construction: the code's header carries the same 7 base36 chars.
    expect(written).toEqual([`#${g.debugLog().slice(1, 8)}`, `@${g.debugLog()}`]);
    ui.close();
  });

  it("both chips are real buttons", async () => {
    const g = await finishedGame();
    const ui = openFinale(g);
    expect(ui.chips()).toHaveLength(2);
    for (const c of ui.chips()) expect(c.tagName).toBe("BUTTON");
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
    expect(ui.chips()[0].textContent).toContain("SEED #");
    expect(ui.chips()[1].textContent).toContain("GAME @");
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

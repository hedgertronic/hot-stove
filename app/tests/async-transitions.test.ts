import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCard, loadSpecials } from "../src/lib/data";
import { Game } from "../src/lib/engine.svelte";
import { forgeGame, mkCard, mkPlayer, stubMeta, stubOwners } from "../src/lab/fixtures";
import type { Card, SpecialsIndex } from "../src/lib/types";

vi.mock("../src/lib/data", async (original) => ({
  ...await original<typeof import("../src/lib/data")>(),
  loadCard: vi.fn(),
  loadSpecials: vi.fn(),
  loadPlayers: vi.fn(async () => ({})),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const player = mkPlayer({ id: "career", name: "Career Player", pos: "C" });
const card = mkCard({ players: [player] });
const season = mkCard({ year: 2002, players: [player] });
const specials: SpecialsIndex = { SEA: [{
  team: "SEA", year: 2002, name: season.name, park: season.park,
  mgr: card.manager, w: 93, l: 69, att: 1, mult: 1, budget: 90,
}] };
const index = { yearMin: 2001, yearMax: 2002, cards: [card, season] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadCard).mockResolvedValue(card);
  vi.mocked(loadSpecials).mockResolvedValue(specials);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() });
});

describe("a landing belongs to one pending fetch", () => {
  it("records a landing once when two callers await the same card", async () => {
    const pending = deferred<Card>();
    vi.mocked(loadCard).mockReturnValue(pending.promise);
    const game = new Game(stubMeta, index, stubOwners, 42);
    game.spin();
    const first = game.land();
    const second = game.land();
    pending.resolve(card);
    await Promise.all([first, second]);
    expect(game.phase).toBe("landed");
    expect(game.seen).toHaveLength(1);
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it("cannot land or save after the run is abandoned", async () => {
    const pending = deferred<Card>();
    vi.mocked(loadCard).mockReturnValue(pending.promise);
    const game = new Game(stubMeta, index, stubOwners, 42);
    game.spin();
    const landing = game.land();
    game.abandon();
    pending.resolve(card);
    await landing;
    expect(game.seen).toEqual([]);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});

describe.each(["player", "manager"] as const)("Prime %s commits", (target) => {
  function setup() {
    const pending = deferred<Card>();
    const timeline = deferred<SpecialsIndex>();
    vi.mocked(loadCard).mockReturnValue(pending.promise);
    vi.mocked(loadSpecials).mockReturnValue(timeline.promise);
    const game = forgeGame({ difficulty: "standard", bank: "classic" }, (g) => {
      g.index = index;
      g.card = card;
      g.powerups.prime = "armed";
      g.powerups.doublePlay = "armed";
      g.choicesLeft = 2;
    });
    const select = () => target === "player"
      ? game.primeTapPlayer(player)
      : game.primeTapSpecial("manager");
    select();
    const apply = () => target === "player"
      ? game.applyPrime("SEA", 2002)
      : game.applyPrimeSpecial("SEA", 2002);
    const resolve = () => { pending.resolve(season); timeline.resolve(specials); };
    return { game, select, apply, resolve };
  }

  it.each(["close", "reopen", "abandon", "toggle"])("rejects a late result after %s", async (action) => {
    const { game, select, apply, resolve } = setup();
    const commit = apply();
    if (action === "abandon") game.abandon();
    else if (action === "toggle") game.toggleHometown();
    else {
      game.closePrimeSheet();
      if (action === "reopen") select();
    }
    const before = JSON.stringify({
      slots: game.slots, manager: game.manager, powerups: game.powerups,
      choicesLeft: game.choicesLeft, log: game.decisionLog,
    });
    resolve();
    expect(await commit).toBe(false);
    expect(JSON.stringify({
      slots: game.slots, manager: game.manager, powerups: game.powerups,
      choicesLeft: game.choicesLeft, log: game.decisionLog,
    })).toBe(before);
  });

  it("spends one choice when concurrent confirmations resolve", async () => {
    const { game, apply, resolve } = setup();
    const first = apply();
    const second = apply();
    resolve();
    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(game.choicesUsed).toBe(1);
    expect(game.choicesLeft).toBe(1);
    expect(game.powerups.prime).toBe("spent");
    expect(game.decisionLog).toHaveLength(1);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import PrimePicker from "../src/components/PrimePicker.svelte";
import SpecialPrimePicker from "../src/components/SpecialPrimePicker.svelte";
import { loadCard, loadPlayers, loadSpecials } from "../src/lib/data";
import { forgeGame, mkCard, mkPlayer } from "../src/lab/fixtures";
import type { PlayerSeasons, SpecialsIndex } from "../src/lib/types";

vi.mock("../src/lib/data", async (original) => ({
  ...await original<typeof import("../src/lib/data")>(),
  loadCard: vi.fn(),
  loadPlayers: vi.fn(),
  loadSpecials: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const player = mkPlayer({ id: "first", name: "First Player", pos: "C" });
const other = mkPlayer({ id: "second", name: "Second Player", pos: "C" });
const card = mkCard({ players: [player, other] });
const season = mkCard({ year: 2002, players: [player, other] });
const players: PlayerSeasons = { first: [["SEA", 2002]], second: [["SEA", 2002]] };
const specials: SpecialsIndex = { SEA: [{
  team: "SEA", year: 2002, name: season.name, park: season.park,
  mgr: card.manager, w: 93, l: 69, att: 1, mult: 1, budget: 90,
}, {
  team: "SEA", year: 2003, name: season.name, park: season.park,
  mgr: "Second Manager", w: 90, l: 72, att: 1, mult: 1, budget: 90,
}] };

const cleanups: (() => Promise<void>)[] = [];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadPlayers).mockResolvedValue(players);
  vi.mocked(loadSpecials).mockResolvedValue(specials);
  vi.mocked(loadCard).mockResolvedValue(season);
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  document.body.replaceChildren();
});

describe.each(["player", "manager"] as const)("%s career lifecycle", (kind) => {
  function open() {
    const game = forgeGame({ difficulty: "standard", bank: "classic" }, (g) => {
      g.card = card;
      g.powerups.prime = "armed";
      if (kind === "player") g.primePick = player.id;
      else g.primeSpecial = "manager";
    });
    const target = document.createElement("div");
    document.body.appendChild(target);
    const onclose = vi.fn();
    const component = kind === "player" ? PrimePicker : SpecialPrimePicker;
    const ui = mount(component, { target, props: { game, onclose } });
    flushSync();
    cleanups.push(async () => { await unmount(ui); });
    return { game, target, onclose };
  }

  async function ready(target: HTMLElement, label = "2002 SEA") {
    await vi.waitFor(() => {
      flushSync();
      expect(target.querySelector(".picker-list")?.textContent).toContain(label);
    });
  }

  it("offers a working retry after a failed career load", async () => {
    if (kind === "player") vi.mocked(loadPlayers).mockRejectedValueOnce(new Error("offline"));
    else vi.mocked(loadSpecials).mockRejectedValueOnce(new Error("offline"));
    const { target, onclose } = open();
    await vi.waitFor(() => {
      flushSync();
      expect(target.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load");
    });
    target.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    flushSync();
    expect(target.querySelector('[role="status"]')).not.toBeNull();
    await ready(target);
    expect(target.querySelector('[role="alert"]')).toBeNull();
    expect(onclose).not.toHaveBeenCalled();
    expect(kind === "player" ? loadPlayers : loadSpecials).toHaveBeenCalledTimes(2);
  });

  it.each(["success", "failure"])("ignores a previous career's late %s", async (outcome) => {
    const oldPlayers = deferred<PlayerSeasons>();
    const oldSpecials = deferred<SpecialsIndex>();
    if (kind === "player") vi.mocked(loadPlayers).mockReturnValueOnce(oldPlayers.promise);
    else vi.mocked(loadSpecials).mockReturnValueOnce(oldSpecials.promise);
    const { game, target } = open();
    if (kind === "player") game.primePick = other.id;
    else game.card = mkCard({ manager: "Second Manager" });
    flushSync();
    await ready(target, kind === "player" ? "2002 SEA" : "2003 SEA");
    if (outcome === "success") {
      oldPlayers.resolve({});
      oldSpecials.resolve({});
    } else {
      oldPlayers.reject(new Error("old load failed"));
      oldSpecials.reject(new Error("old load failed"));
    }
    // Only one deferred loader was consumed; observe the unused promise too.
    await Promise.allSettled([oldPlayers.promise, oldSpecials.promise]);
    flushSync();
    expect(target.querySelector('[role="alert"]')).toBeNull();
    expect(target.querySelector(".picker-list")?.textContent)
      .toContain(kind === "player" ? "2002 SEA" : "2003 SEA");
  });

  it.each([false, true])("closes only for a committed choice (result %s)", async (committed) => {
    const { game, target, onclose } = open();
    const apply = kind === "player"
      ? vi.spyOn(game, "applyPrime").mockResolvedValue(committed)
      : vi.spyOn(game, "applyPrimeSpecial").mockResolvedValue(committed);
    await ready(target);
    target.querySelector<HTMLButtonElement>(".srow-btn")!.click();
    flushSync();
    target.querySelector<HTMLButtonElement>("button.confirm")!.click();
    await vi.waitFor(() => {
      flushSync();
      expect(apply).toHaveBeenCalledTimes(1);
      expect(target.querySelector<HTMLButtonElement>("button.confirm")?.disabled).toBe(false);
    });
    expect(onclose).toHaveBeenCalledTimes(committed ? 1 : 0);
  });
});

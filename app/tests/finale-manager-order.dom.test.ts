/** Manager-first ordering and badge/stamp gap parity in the finale.
 *
 * Two contracts:
 *
 * 1. The manager row renders at the top of both team lists — above the player
 *    rows in YOUR SQUAD and above the pick rows in THE DREAM TEAM — matching
 *    the squad rail's own display during gameplay.
 *
 * 2. The horizontal gap between badge pills (.brags) equals the gap between
 *    passport stamps (.stamps), so the two kinds of items space identically
 *    when they share the .badge-strip flex row. Pinned against the component
 *    source because jsdom does not parse color-mix() and does not inject
 *    scoped component <style> blocks.
 */
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flushSync, mount, unmount } from "svelte";
import Finale from "../src/components/Finale.svelte";
import { finaleCeilingAbove } from "../src/lab/fixtures";
import type { Game } from "../src/lib/engine.svelte";

const FINALE_SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components/Finale.svelte"),
  "utf-8",
);

const PASSPORT_SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components/Passport.svelte"),
  "utf-8",
);

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

let host: HTMLElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any = null;
afterEach(() => {
  if (app) unmount(app);
  host?.remove();
  app = null;
  host = null;
});

function render(game: Game = finaleCeilingAbove()): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = mount(Finale, {
    target: host,
    props: { game, onreplay: () => {}, onmodes: () => {}, resolved: true },
  });
  flushSync();
  return host;
}

/** First .qpos text inside a squad container. */
function firstPos(squad: Element): string {
  return squad.querySelector(".qrow .qpos")?.textContent?.trim() ?? "";
}

describe("manager-first ordering", () => {
  it("YOUR SQUAD: manager row is the first .qrow", () => {
    // finaleCeilingAbove uses the forgeFinale default (Lou Piniella as manager),
    // so a manager row is always present.
    const el = render();
    const squad = el.querySelector(".squad:not(.dream)");
    expect(squad).not.toBeNull();
    expect(firstPos(squad!)).toBe("MGR");
  });

  it("YOUR SQUAD: player rows follow the manager row, not precede it", () => {
    const el = render();
    const squad = el.querySelector(".squad:not(.dream)")!;
    const rows = [...squad.querySelectorAll(".qrow")];
    // There must be more than one row (manager + at least one player).
    expect(rows.length).toBeGreaterThan(1);
    // The first row is MGR; every other row is a player position (not MGR).
    expect(rows[0].querySelector(".qpos")?.textContent?.trim()).toBe("MGR");
    const playerRows = rows.slice(1);
    for (const r of playerRows) {
      expect(r.querySelector(".qpos")?.textContent?.trim()).not.toBe("MGR");
    }
  });

  it("YOUR SQUAD: player rows carry the paid salary beside the WAR chip", () => {
    // The rail seats' salary read at finale scale — .qsal wears a costTier
    // class (cheap/mid/spendy) and sits before the row's warchip. The manager
    // row carries none (a skipper's cost is not a Signed.costPaid).
    const el = render();
    const squad = el.querySelector(".squad:not(.dream)")!;
    const rows = [...squad.querySelectorAll(".qrow")];
    expect(rows[0].querySelector(".qsal")).toBeNull();
    for (const r of rows.slice(1)) {
      const sal = r.querySelector(".qsal");
      expect(sal).not.toBeNull();
      expect(sal!.textContent).toMatch(/^\$/);
      expect(sal!.className).toMatch(/\b(cheap|mid|spendy)\b/);
    }
  });

  it("THE DREAM TEAM: manager row is the first .qrow", () => {
    // finaleCeilingAbove has a bestManager in its FinaleResult.
    const el = render();
    const dream = el.querySelector(".squad.dream");
    expect(dream).not.toBeNull();
    expect(firstPos(dream!)).toBe("MGR");
  });

  it("THE DREAM TEAM: player pick rows follow the manager row", () => {
    const el = render();
    const dream = el.querySelector(".squad.dream")!;
    const rows = [...dream.querySelectorAll(".qrow")];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0].querySelector(".qpos")?.textContent?.trim()).toBe("MGR");
    const pickRows = rows.slice(1);
    for (const r of pickRows) {
      expect(r.querySelector(".qpos")?.textContent?.trim()).not.toBe("MGR");
    }
  });
});

describe("badge/stamp gap parity", () => {
  it("one flex row spaces both kinds: contents groups, strip owns the gap", () => {
    // Badges (.brags, Finale.svelte) and stamps (.stamps, Passport.svelte)
    // are display:contents, so every pill and stamp is a direct flex item of
    // .badge-strip and one uniform 6px gap spaces all of them — stamps flow
    // on the same visual line as badges and either kind wraps mid-group.
    for (const [src, sel] of [
      [FINALE_SRC, ".brags"],
      [PASSPORT_SRC, ".stamps"],
    ] as const) {
      const block = src.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`, "s"))![1];
      expect(block).toMatch(/display:\s*contents/);
      expect(block).not.toMatch(/gap:/);
    }

    const strip = FINALE_SRC.match(/\.badge-strip\s*\{([^}]*)\}/s)![1];
    // The one gap, uniform, and the positioned fence for opened panels.
    expect(strip).toMatch(/gap:\s*6px\s*;/);
    expect(strip).not.toMatch(/gap:\s*6px\s+\d/);
    expect(strip).toMatch(/position:\s*relative/);
  });
});

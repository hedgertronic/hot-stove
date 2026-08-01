// @vitest-environment jsdom
/** Box Score ↔ Eye Test parity for the two Prime Time sheets, whose rows load
 * inside a client $effect (players.json / specials.json / card fetches) — so
 * they mount for real in jsdom rather than SSR-render. Contract under test:
 * PrimePicker career rows carry a WAR chip in Box Score only; the
 * SpecialPrimePicker (manager-only — owner and stadium tiles are never Prime
 * targets) withholds the W–L record, win value, and MOY pill in Eye Test. */
import { describe, expect, it } from "vitest";
import { mount, unmount } from "svelte";
import PrimePicker from "../src/components/PrimePicker.svelte";
import SpecialPrimePicker from "../src/components/SpecialPrimePicker.svelte";
import { forgeGame, mkCard, mkPlayer } from "../src/lab/fixtures";
import { type Game, type GameConfig } from "../src/lib/engine.svelte";
import type { Card, SpecialsIndex } from "../src/lib/types";

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const SCOUT: GameConfig = { difficulty: "scout", bank: "classic" };

// The pickers fetch the career/timeline data lazily; serve fixed fixtures.
// (data.ts memoizes per module — every test in this file shares these.)
const seaPlayer = (war: number, cost: number) =>
  mkPlayer({ id: "star1", name: "Ichiro Suzuki", pos: "RF", war, cost });

const cards: Record<string, Card> = {
  SEA_2001: mkCard({ players: [seaPlayer(7.7, 14)] }),
  SEA_2004: mkCard({ year: 2004, players: [seaPlayer(9.2, 21)] }),
};
const playersIndex = { star1: [["SEA", 2001], ["SEA", 2004]] };
const specials: SpecialsIndex = {
  SEA: [
    { team: "SEA", year: 2001, name: "Seattle Mariners", park: "Safeco Field", mgr: "Lou Piniella", w: 116, l: 46, att: 1, mult: 1.05, budget: 92.1 },
    { team: "SEA", year: 2002, name: "Seattle Mariners", park: "Safeco Field", mgr: "Lou Piniella", w: 93, l: 69, att: 0.9, mult: 1.08, budget: 88.4, moty: true },
  ],
};

globalThis.fetch = (async (url: unknown) => {
  const s = String(url);
  if (s.endsWith("data/players.json")) return { ok: true, json: async () => playersIndex };
  if (s.endsWith("data/specials.json")) return { ok: true, json: async () => specials };
  const m = s.match(/cards\/([A-Z0-9]+)_(\d{4})\.json$/);
  const c = m ? cards[`${m[1]}_${m[2]}`] : undefined;
  return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
}) as unknown as typeof fetch;

/** Mount a sheet over a forged game, let its $effect fetch settle, and hand
 * back the rendered markup. */
async function mounted(
  component: typeof PrimePicker | typeof SpecialPrimePicker,
  game: Game,
): Promise<string> {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const comp = mount(component, { target, props: { game, onclose: () => {} } });
  await new Promise((r) => setTimeout(r, 20));
  const html = target.innerHTML;
  await unmount(comp);
  target.remove();
  return html;
}

function primeGame(config: GameConfig): Game {
  return forgeGame(config, (g) => {
    g.card = cards.SEA_2001;
    g.powerups.prime = "armed";
    g.primePick = "star1";
  });
}

function specialGame(config: GameConfig): Game {
  return forgeGame(config, (g) => {
    g.card = cards.SEA_2001;
    g.powerups.prime = "armed";
    g.primeSpecial = "manager";
  });
}

describe("PrimePicker career rows", () => {
  it("Box Score rows read pos · year TEAM · WAR chip · tinted price", async () => {
    const html = await mounted(PrimePicker, primeGame(CLASSIC));
    expect(html).toContain("2004 SEA");
    expect(html).toContain("warchip");
    expect(html).toContain("9.2");
    expect(html).toContain("$21M");
  });

  it("Eye Test rows carry no WAR chip — the price stays", async () => {
    const html = await mounted(PrimePicker, primeGame(SCOUT));
    expect(html).toContain("2004 SEA");
    expect(html).not.toContain("warchip");
    expect(html).not.toContain("9.2");
    expect(html).toContain("$21M");
  });
});

describe("SpecialPrimePicker manager career rows", () => {
  it("Box Score rows read 🧢 tag · year TEAM · MOY pill · record · win value", async () => {
    const html = await mounted(SpecialPrimePicker, specialGame(CLASSIC));
    expect(html).toContain("2002 SEA");
    expect(html).toContain("93–69");
    expect(html).toContain("+4.8 W");
    expect(html).toContain("MOY"); // 2002 fixture season's pill
  });

  it("Eye Test rows withhold the record, win value, and MOY pill entirely", async () => {
    const html = await mounted(SpecialPrimePicker, specialGame(SCOUT));
    expect(html).toContain("2002 SEA");
    expect(html).not.toContain("93–69");
    expect(html).not.toContain("+4.8");
    expect(html).not.toContain("MOY");
  });
});

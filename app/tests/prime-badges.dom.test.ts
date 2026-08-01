// @vitest-environment jsdom
/** Hardware and layout in the two Prime Time career sheets.
 *
 * The load-bearing contract is the information gate: award pills are Box
 * Score knowledge (`game.showAwards`, true only in `standard`), and the
 * career sheet is the one screen where leaking them would hand over the
 * whole hidden edge at once — "which season was the MVP year" IS the game in
 * Eye Test. Both sheets are asserted in both difficulties, and the pill's own
 * class (`qb`) is the probe rather than the award text, since the class is
 * what proves a pill actually rendered.
 *
 * The player sheet also pins canonical hardware order (`sortAwards`), and the
 * manager sheet pins the record sitting beside the season label — the FRONT
 * OFFICE manager row's information order, one field swapped.
 */
import { describe, expect, it } from "vitest";
import { mount, unmount } from "svelte";
import PrimePicker from "../src/components/PrimePicker.svelte";
import SpecialPrimePicker from "../src/components/SpecialPrimePicker.svelte";
import { forgeGame, mkCard, mkPlayer } from "../src/lab/fixtures";
import { type Game, type GameConfig } from "../src/lib/engine.svelte";
import type { Card, SpecialsIndex } from "../src/lib/types";

const BOX: GameConfig = { difficulty: "standard", bank: "classic" };
const EYE: GameConfig = { difficulty: "scout", bank: "classic" };

// Awards are deliberately out of canonical order in the fixture, so the
// rendered order also proves sortAwards() runs (MVP → CY → ROY → GG → SS → AS).
const AWARDS = ["AS", "SS", "GG", "MVP"];

const cards: Record<string, Card> = {
  CHN_2015: mkCard({
    team: "CHN",
    year: 2015,
    manager: "Joe Maddon",
    players: [mkPlayer({ id: "bryakr01", name: "Kris Bryant", pos: "3B", war: 6.1, cost: 0.7 })],
  }),
  CHN_2016: mkCard({
    team: "CHN",
    year: 2016,
    manager: "Joe Maddon",
    players: [
      mkPlayer({
        id: "bryakr01",
        name: "Kris Bryant",
        pos: "3B",
        war: 7.7,
        cost: 1.1,
        awards: AWARDS,
      }),
    ],
  }),
};
const playersIndex = {
  bryakr01: [
    ["CHN", 2015],
    ["CHN", 2016],
  ],
};
const specials: SpecialsIndex = {
  CHN: [
    { team: "CHN", year: 2015, name: "Chicago Cubs", park: "Wrigley Field", mgr: "Joe Maddon", w: 97, l: 65, att: 1, mult: 1.05, budget: 90, moty: true },
    { team: "CHN", year: 2016, name: "Chicago Cubs", park: "Wrigley Field", mgr: "Joe Maddon", w: 103, l: 58, att: 1, mult: 1.05, budget: 95 },
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
 * back the live root element. */
async function mounted(
  component: typeof PrimePicker | typeof SpecialPrimePicker,
  game: Game,
): Promise<{ el: HTMLElement; done: () => Promise<void> }> {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const comp = mount(component, { target, props: { game, onclose: () => {} } });
  await new Promise((r) => setTimeout(r, 20));
  return {
    el: target,
    done: async () => {
      await unmount(comp);
      target.remove();
    },
  };
}

/** Every award pill's text, in DOM order. */
function pills(el: HTMLElement): string[] {
  return [...el.querySelectorAll(".qb")].map((n) => n.textContent?.trim() ?? "");
}

function playerGame(config: GameConfig): Game {
  return forgeGame(config, (g) => {
    g.card = cards.CHN_2015;
    g.powerups.prime = "armed";
    g.primePick = "bryakr01";
  });
}

function managerGame(config: GameConfig): Game {
  return forgeGame(config, (g) => {
    g.card = cards.CHN_2016;
    g.powerups.prime = "armed";
    g.primeSpecial = "manager";
  });
}

describe("PrimePicker award pills", () => {
  it("Box Score renders the season's hardware in canonical order", async () => {
    const { el, done } = await mounted(PrimePicker, playerGame(BOX));
    expect(el.innerHTML).toContain("2016 CHN");
    expect(pills(el)).toEqual(["🥇MVP", "GG", "SS", "AS"]);
    // Salary is the one number both difficulties show — pinned on this side
    // too, so the Eye Test assertion below reads as "awards and WAR only".
    expect(el.innerHTML).toContain("$1.1M");
    await done();
  });

  it("Eye Test renders no award pill at all — the MVP year stays hidden", async () => {
    const { el, done } = await mounted(PrimePicker, playerGame(EYE));
    // The rows are there; only the hardware is withheld.
    expect(el.innerHTML).toContain("2016 CHN");
    expect(pills(el)).toEqual([]);
    expect(el.innerHTML).not.toContain("MVP");
    await done();
  });

  it("Eye Test withholds WAR too — the sheet leaks no talent signal", async () => {
    const { el, done } = await mounted(PrimePicker, playerGame(EYE));
    expect(el.querySelector(".warchip")).toBeNull();
    expect(el.innerHTML).not.toContain("7.7");
    // Salary is the one signal Eye Test shows, here and in the market.
    expect(el.innerHTML).toContain("$1.1M");
    await done();
  });

  it("a season with no awards renders no pills in Box Score either", async () => {
    const { el, done } = await mounted(PrimePicker, playerGame(BOX));
    // 2015 is the landed card's own season (grayed) and carries no hardware;
    // exactly the four pills of 2016 exist in the whole sheet.
    expect(pills(el)).toHaveLength(AWARDS.length);
    await done();
  });
});

describe("SpecialPrimePicker manager rows", () => {
  it("Box Score renders the MOY pill on the season that won it", async () => {
    const { el, done } = await mounted(SpecialPrimePicker, managerGame(BOX));
    expect(pills(el)).toEqual(["MOY"]); // 2015 only; 2016 has no moty flag
    await done();
  });

  it("Eye Test renders no MOY pill", async () => {
    const { el, done } = await mounted(SpecialPrimePicker, managerGame(EYE));
    expect(el.innerHTML).toContain("2015 CHN");
    expect(pills(el)).toEqual([]);
    expect(el.innerHTML).not.toContain("MOY");
    // The reworked row drops the record and win value entirely rather than
    // rendering empty boxes — a placeholder would advertise the hole.
    expect(el.querySelector(".meta")).toBeNull();
    expect(el.querySelector(".val")).toBeNull();
    await done();
  });

  it("the record sits beside the season label, not out at the right edge", async () => {
    const { el, done } = await mounted(SpecialPrimePicker, managerGame(BOX));
    const row = el.querySelector(".srow:not(:disabled)");
    expect(row).not.toBeNull();
    // Same information order as the FRONT OFFICE manager row: label · record ·
    // pill in one group, the win value alone at the right edge.
    const mid = row!.querySelector(".mid")!;
    expect(mid.textContent).toContain("2015 CHN");
    expect(mid.textContent).toContain("97–65");
    expect(row!.querySelector(".val")!.textContent).toBe("+6.4 W");
    expect(row!.querySelector(".val")!.textContent).not.toContain("97–65");
    await done();
  });

  it("the whole card carries the manager tint, not just the tag", async () => {
    const { el, done } = await mounted(SpecialPrimePicker, managerGame(BOX));
    const row = el.querySelector(".srow:not(:disabled)") as HTMLElement;
    // The tint moved onto the row itself, so the standalone tinted tag is
    // gone: the leading 🧢 is now a bare emoji in the fixed-width type
    // column, exactly like SpecialRows' skipper row. (The pink is a CSS rule
    // on .srow, which jsdom doesn't resolve — the markup shape is the part a
    // test can genuinely fail on.)
    expect(row.querySelector(".ic")!.textContent).toBe("🧢");
    expect(row.querySelector(".tag")).toBeNull();
    await done();
  });
});

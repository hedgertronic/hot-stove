// @vitest-environment jsdom
/** Box Score ↔ Eye Test parity for the two Prime Time sheets, whose rows load
 * inside a client $effect (players.json / specials.json / card fetches) — so
 * they mount for real in jsdom rather than SSR-render. Contract under test:
 * PrimePicker career rows carry a WAR chip in Box Score only; the
 * SpecialPrimePicker (manager-only — owner and stadium tiles are never Prime
 * targets) withholds the W–L record, win value, and MOY pill in Eye Test.
 *
 * The file also pins the DISMISSAL CHROME every sheet inherits from
 * `Sheet.svelte` — a ✕ in the top-right corner and a full-width button along
 * the bottom, both drawn by the shell rather than by each caller. That belongs
 * here because it is the same class of claim: a contract several sheets have
 * to satisfy identically, which is exactly what a per-component copy quietly
 * stops doing. Both exits are asserted to call `onclose`, since a dismissal
 * affordance that renders but does nothing is the failure worth catching. */
import { describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import HelpModal from "../src/components/HelpModal.svelte";
import PrimePicker from "../src/components/PrimePicker.svelte";
import SpecialPrimePicker from "../src/components/SpecialPrimePicker.svelte";
import TeamPicker from "../src/components/TeamPicker.svelte";
import YearPicker from "../src/components/YearPicker.svelte";
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
    // The chip reads "4.8 WINS" — the value bare (a positive drops its plus;
    // the unit says the scale), the unit in the same small register the player
    // chips give WAR. Not "+4.8 W", the spelling this replaced.
    expect(html).toContain("4.8");
    expect(html).toContain("WINS");
    expect(html).not.toContain("+4.8");
    expect(html).not.toContain("4.8 W<");
    expect(html).toContain("MOY"); // 2002 fixture season's pill
  });

  it("Eye Test rows withhold the record, win value, and MOY pill entirely", async () => {
    const html = await mounted(SpecialPrimePicker, specialGame(SCOUT));
    expect(html).toContain("2002 SEA");
    expect(html).not.toContain("93–69");
    expect(html).not.toContain("4.8");
    expect(html).not.toContain("WINS");
    expect(html).not.toContain("MOY");
  });
});

/** Mount any sheet with an onclose spy and hand back the live root. */
function open(component: unknown, props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  let closed = 0;
  const comp = mount(component as typeof HelpModal, {
    target,
    props: { ...props, onclose: () => (closed += 1) } as never,
  });
  // Settle the mount effects — the dialog's focus claim is one of them.
  flushSync();
  return {
    target,
    closes: () => closed,
    x: () => target.querySelector<HTMLButtonElement>('button[aria-label="Close"]'),
    footer: () => target.querySelector<HTMLButtonElement>("button.cancel"),
    done: async () => {
      await unmount(comp);
      target.remove();
    },
  };
}

const colors = { franchises: { SEA: "#005c5c" } };
const carded = (config: GameConfig): Game =>
  forgeGame(config, (g) => {
    g.card = cards.SEA_2001;
  });

describe("every sheet's two exits", () => {
  /** Sheet · caller · the word its bottom button carries. A picker the player
   * can back out of says CANCEL; a sheet that only tells them things says GOT
   * IT. (TrophyModal and SpecialPrimePicker still draw their own chrome and
   * are not on this list yet.) */
  const SHEETS: [string, unknown, Record<string, unknown>, string][] = [
    ["PrimePicker", PrimePicker, { game: primeGame(CLASSIC) }, "CANCEL"],
    ["YearPicker", YearPicker, { game: carded(CLASSIC) }, "CANCEL"],
    ["TeamPicker", TeamPicker, { game: carded(CLASSIC), colors }, "CANCEL"],
    ["HelpModal", HelpModal, {}, "GOT IT"],
  ];

  for (const [name, component, props, word] of SHEETS) {
    it(`${name} carries a corner ✕ and a ${word} button, and both close it`, async () => {
      const ui = open(component, props);
      expect(ui.x()).not.toBeNull();
      expect(ui.footer()?.textContent?.trim()).toBe(word);

      ui.x()!.click();
      expect(ui.closes()).toBe(1);
      ui.footer()!.click();
      expect(ui.closes()).toBe(2);
      await ui.done();
    });

    it(`${name} draws exactly one of each — no caller-local duplicate`, async () => {
      const ui = open(component, props);
      expect(ui.target.querySelectorAll('button[aria-label="Close"]')).toHaveLength(1);
      expect(ui.target.querySelectorAll("button.cancel")).toHaveLength(1);
      await ui.done();
    });

    /** Escape is the third exit, and the one that can render correctly and
     * still do nothing: the handler sits on the dialog, so it only ever sees a
     * key press when focus is inside it. Opening a sheet leaves focus on
     * `<body>` behind the backdrop unless the dialog claims it, and this
     * asserts the claim by pressing Escape at the DOCUMENT — the position a
     * player who has tapped nothing is actually in. */
    it(`${name} takes focus on open, so Escape closes it untouched`, async () => {
      const ui = open(component, props);
      expect(document.activeElement).toBe(ui.target.querySelector(".sheet"));
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      expect(ui.closes()).toBe(1);
      await ui.done();
    });
  }
});

describe("the help sheet teaches with the real parts", () => {
  it("renders a market row, rail seats, both payroll faces, pills, and badges", async () => {
    const ui = open(HelpModal, {});
    const h = ui.target.innerHTML;
    // The market row's own anatomy, WAR ladder included (the app.css chip,
    // not a copy): 9.7 is the elite rung.
    expect(ui.target.querySelector(".prow .warchip.elite")).not.toBeNull();
    expect(h).toContain("Pedro Martínez");
    // A dead row beside the live one — the market's gray, shown not described.
    expect(ui.target.querySelector(".prow.dead")).not.toBeNull();
    // Rail seats: filled ones carry their WAR tier on the seat's chip, empty
    // ones are the dashed invitation.
    expect(ui.target.querySelector(".cell.filled")).not.toBeNull();
    expect(ui.target.querySelector(".cell.empty")).not.toBeNull();
    // All three payroll faces, through the real PayrollBox: no owner yet, under,
    // then over. The probe is the meter's own alarm class and the overrun
    // figure's element, not their wording — the copy belongs to that component.
    // The ownerless box is the one a player meets FIRST and the only one whose
    // payroll is $0, so it reads $0 LEFT and lifts the `.left` count with it.
    expect(ui.target.querySelectorAll(".pay")).toHaveLength(3);
    expect(ui.target.querySelectorAll(".paylbl .left")).toHaveLength(2);
    expect(ui.target.querySelectorAll(".pay .pmeter.pnocap")).toHaveLength(1);
    expect(ui.target.querySelectorAll(".pay .pmeter.pover")).toHaveLength(1);
    // And the payroll BONUS, taught under SCORING as four fills of the same
    // component's `mini` bar: low (39%, gold), mid (75%), high (95%), and one
    // past the cap (109%, orange — the luxury-tax face). Scoped away from the
    // three full-size boxes above, since both surfaces draw a `pover` meter
    // and an unscoped count could not say which one it had found.
    const minis = ui.target.querySelectorAll(".meters .pmeter.mini");
    expect(minis).toHaveLength(4);
    expect(ui.target.querySelectorAll(".meters .pmeter.mini.pover")).toHaveLength(1);
    expect(ui.target.querySelectorAll(".meters .pmeter.mini.plow")).toHaveLength(1);
    // $111M spent against the ATL 1995 payroll the FRONT OFFICE specimen
    // sets ($93.2M × 1.09): the overrun the alarm face quotes.
    expect(ui.target.querySelector(".paylbl .warn")?.textContent).toContain("$9.4M");
    // A powerup pill ready and spent. The armed samples are gone from the
    // sheet — arming is taught by playing, not by a mock — so their absence
    // is asserted rather than their presence.
    for (const cls of [".pp", ".pp.spent"]) expect(ui.target.querySelector(cls)).not.toBeNull();
    expect(ui.target.querySelector(".pp.armed")).toBeNull();
    // A badge, earned and locked, through the real BadgePill.
    expect(ui.target.querySelector(".brag:not(.locked)")).not.toBeNull();
    expect(ui.target.querySelector(".brag.locked")).not.toBeNull();
    await ui.done();
  });

  it("says PRIMETIME, one word, exactly as the pill does", async () => {
    const ui = open(HelpModal, {});
    expect(ui.target.innerHTML).toContain("PRIMETIME");
    expect(ui.target.innerHTML).not.toContain("PRIME TIME");
    await ui.done();
  });
});

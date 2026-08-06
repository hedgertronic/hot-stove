// @vitest-environment jsdom
/** Two-way seasons choose their seat.
 *
 * A season listed "SP/DH" is eligible for the pitcher seats AND for UTIL
 * (eligibility.ts: `pos.startsWith("SP")` earns SP, `isTwoWay` earns FLEX).
 * Seating him is a real decision — UTIL plays his bat, SP plays his arm — so
 * with both open the market row arms the existing pick-a-slot flow and the
 * rail asks, instead of resolving specialist-first the way an ordinary
 * hitter's FLEX fallback does.
 *
 * The auto-seat cases stay auto-seat: one open type is not a question, and
 * that includes two open SP seats, which are the same answer twice.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import PlayerList from "../src/components/PlayerList.svelte";
import { forgeGame, mkCard, mkPlayer, mkSigned } from "../src/lab/fixtures";
import { SLOT_TYPES, type Game, type GameConfig } from "../src/lib/engine.svelte";

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };

// stubMeta slots = ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"].
const FLEX = SLOT_TYPES.indexOf("FLEX"); // 4
const SP1 = SLOT_TYPES.indexOf("SP"); // 5
const SP2 = SP1 + 1; // 6

const ohtani = mkPlayer({ id: "ohtani", name: "Shohei Ohtani", pos: "SP/DH", war: 9.0, cost: 9.1 });

/** A landed game holding the two-way season, with the named seats filled. */
function landedGame(...filled: number[]): Game {
  return forgeGame(CLASSIC, (g) => {
    g.card = mkCard({ players: [ohtani] });
    for (const i of filled)
      g.slots[i] = mkSigned({ name: `Seat ${i}`, pos: SLOT_TYPES[i] });
  });
}

let target: HTMLElement;
beforeEach(() => {
  target = document.createElement("div");
  document.body.appendChild(target);
});
afterEach(() => {
  target.remove();
});

function mountList(game: Game) {
  const comp = mount(PlayerList, {
    target,
    props: { game, confirmKey: null, setConfirm: () => {} },
  });
  flushSync();
  return comp;
}

describe("two-way seat choice", () => {
  it("SP and UTIL both open: the signing arms the picker instead of seating", () => {
    const g = landedGame();
    expect(g.pickableSlotCells(ohtani)).toEqual([FLEX, SP1, SP2]);
    g.signPlayer(ohtani);
    expect(g.slotPick).toBe(ohtani.id);
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.choicesLeft).toBe(1); // opening the picker commits nothing
  });

  it("the pending row shows the WHAT SLOT? hint", () => {
    const g = landedGame();
    g.signPlayer(ohtani);
    const comp = mountList(g);
    expect(target.textContent).toContain("WHAT SLOT?");
    unmount(comp);
  });

  it("a rail tap on UTIL seats the bat; a rail tap on SP seats the arm", () => {
    const util = landedGame();
    util.signPlayer(ohtani);
    util.signPlayer(ohtani, FLEX);
    expect(util.slots[FLEX]?.id).toBe(ohtani.id);

    const arm = landedGame();
    arm.signPlayer(ohtani);
    arm.signPlayer(ohtani, SP1);
    expect(arm.slots[SP1]?.id).toBe(ohtani.id);
  });

  it("only SP open: auto-seats at SP", () => {
    const g = landedGame(FLEX);
    g.signPlayer(ohtani);
    expect(g.slotPick).toBeNull();
    expect(g.slots[SP1]?.id).toBe(ohtani.id);
  });

  it("only UTIL open: auto-seats at UTIL", () => {
    const g = landedGame(SP1, SP2);
    g.signPlayer(ohtani);
    expect(g.slotPick).toBeNull();
    expect(g.slots[FLEX]?.id).toBe(ohtani.id);
  });

  it("two open SP seats and no hitter seat: one type, no prompt", () => {
    const g = landedGame(FLEX);
    expect(g.pickableSlotCells(ohtani)).toEqual([SP1, SP2]);
    g.signPlayer(ohtani);
    expect(g.slotPick).toBeNull();
    expect(g.slots[SP1]?.id).toBe(ohtani.id);
  });

  it("an ordinary hitter still takes his specialist seat with FLEX open", () => {
    const bat = mkPlayer({ id: "bat", name: "Bret Boone", pos: "2B", war: 5.2, cost: 9 });
    const g = forgeGame(CLASSIC, (gg) => {
      gg.card = mkCard({ players: [bat] });
    });
    g.signPlayer(bat);
    expect(g.slotPick).toBeNull();
    expect(g.slots[1]?.id).toBe(bat.id); // first IF seat, not FLEX
  });
});

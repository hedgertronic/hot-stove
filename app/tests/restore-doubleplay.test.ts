/** Reloading the page between a Double Play's two picks.
 *
 * ✌️ Double Play grants a second choice on the landed card, and the powerup is
 * only spent when that second pick commits. A reload in the gap has to forfeit
 * the pick that never happened — and forfeiting the spin's LAST choice ends the
 * spin, which is the half `restore` used to leave out.
 *
 * The failure it caused was total: every action on a landed card is gated on
 * `choicesLeft > 0`, and the only ways off a landed card are committing a
 * choice or disarming the pill. A restore that produced "landed, no choices
 * left, pill no longer armed" satisfied neither gate, so the game accepted no
 * input at all — a save that could be loaded but never played.
 *
 * Fixtures are hand-built to the pattern in engine.test.ts rather than read off
 * disk: the bug is entirely in the save/restore round trip, and a real card
 * would only add ways for the test to fail for reasons that are not the bug.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const SAVE_KEY = "hotstove.current";

// The engine guards every storage access; node needs a stub to guard against.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// Restoring a landed save re-fetches its card by reference; serve the one card
// this suite uses and 404 everything else.
vi.stubGlobal("fetch", async (url: unknown) => {
  const m = String(url).match(/cards\/CHC_2016\.json$/);
  return m ? { ok: true, json: async () => theCard } : { ok: false, status: 404 };
});

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
  yearMin: 1985,
  yearMax: 2024,
  cards: [{ team: "CHC", year: 2016, franchise: "CHC", name: "Chicago Cubs" }],
};

const owners: Owners = {
  franchises: {
    CHC: {
      name: "Chicago Cubs",
      owners: [{ name: "Ricketts family", from: 2009, to: null }] } } };

let pid = 0;
function player(over: Partial<CardPlayer> = {}): CardPlayer {
  return {
    id: `p${pid++}`,
    name: "Test Player",
    pos: "1B",
    war: 3,
    cost: 5,
    awards: [],
    ws: false,
    pen: false,
    posG: { c: 0, if: 100, of: 0},
    debut: "SEA",
    ...over,
  };
}

/** Two infielders, so a Double Play has a legal second pick to make and the
 * first signing cannot complete the club. */
const theCard: Card = {
  year: 2016,
  team: "CHC",
  franchise: "CHC",
  name: "Chicago Cubs",
  park: "Wrigley Field",
  wins: 103,
  losses: 58,
  manager: "Joe Maddon",
  ws: false,
  pen: false,
  attendance: 3_232_420,
  attendancePct: 0.86,
  stadiumMult: 1.11,
  budget: 136.3,
  prorated: 1,
  players: [player({ name: "Rizzo" }), player({ name: "Baez" })],
};

function landed(): Game {
  const g = new Game(meta, index, owners, 42);
  g.card = theCard;
  g.phase = "landed";
  g.choicesLeft = 1;
  g.choicesUsed = 0;
  return g;
}

const restore = () => Game.restore(meta, index, owners);

describe("reloading mid-Double-Play", () => {
  beforeEach(() => store.clear());

  it("leaves the game able to act after one of the two picks", async () => {
    const game = landed();
    game.toggleDoublePlay();
    expect(game.powerups.doublePlay).toBe("armed");
    expect(game.choicesLeft).toBe(2);

    // The first of the two picks. The spin deliberately stays open.
    game.signPlayer(theCard.players[0]);
    expect(game.choicesUsed).toBe(1);
    expect(game.choicesLeft).toBe(1);
    expect(game.phase).toBe("landed");
    expect(store.has(SAVE_KEY)).toBe(true);

    const back = await restore();
    expect(back).not.toBeNull();

    // The forfeited second pick ends the spin: ready to spin again, rather
    // than stranded on a card with nothing it can do.
    expect(back!.phase).toBe("preSpin");
    // Refunded — the powerup is only spent when a second pick commits.
    expect(back!.powerups.doublePlay).toBe("ready");
    // And the pick that DID commit survived the reload.
    expect(back!.slots.filter(Boolean)).toHaveLength(1);
  });

  it("refunds the second choice when the reload beats the first pick", async () => {
    const game = landed();
    game.toggleDoublePlay();
    game.save();
    expect(game.choicesUsed).toBe(0);

    const back = await restore();
    expect(back).not.toBeNull();
    // Nothing was committed, so the card is still live with its one choice.
    expect(back!.phase).toBe("landed");
    expect(back!.powerups.doublePlay).toBe("ready");
    expect(back!.choicesLeft).toBe(1);
  });

  it("never restores a landed card that cannot be acted on", async () => {
    // The invariant behind both cases above, stated once: a restored landed
    // card always has a choice left to spend. Anything else is a game that has
    // stopped accepting input.
    for (const takeAPick of [false, true]) {
      store.clear();
      const game = landed();
      game.toggleDoublePlay();
      if (takeAPick) game.signPlayer(theCard.players[0]);
      else game.save();

      const back = await restore();
      expect(back).not.toBeNull();
      if (back!.phase === "landed") expect(back!.choicesLeft).toBeGreaterThan(0);
    }
  });
});

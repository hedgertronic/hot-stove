/** Resuming onto a half-used Double Play must not roll off the card silently.
 *
 * `restore` deliberately forfeits the pick that never happened and ends the
 * spin (see restore-doubleplay.test.ts — that rule is the one thing keeping a
 * restored club off a card it can never leave). The cost of it is that the
 * spin ends without anybody tapping anything, and the reel now departs on the
 * next turn of the event loop: the card the player was working disappears on
 * the first frame after the reload, taking the ✌️ pill's armed state with it.
 * That is indistinguishable, from the couch, from Double Play not working.
 *
 * `resumedForfeit` is the flag that tells the two ends apart. A committed pick
 * never sets it and still rolls with no pause; only the resumed forfeit does,
 * and the banner spends it holding the card and naming the refund.
 *
 * Fixtures follow restore-doubleplay.test.ts: hand-built card, stubbed
 * localStorage and fetch, because the round trip is the whole subject.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Game, SLOT_TYPES } from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const SAVE_KEY = "hotstove.current";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

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
      owners: [{ name: "Ricketts family", from: 2009, to: null }],
    },
  },
};

let pid = 0;
function player(over: Partial<CardPlayer> = {}): CardPlayer {
  return {
    id: `p${pid++}`,
    name: "Test Player",
    pos: "1B",
    war: 3,
    warRaw: 3,
    cost: 5,
    contract: 5,
    salary: 5_000_000,
    est: false,
    awards: [],
    ws: false,
    pen: false,
    pa: 500,
    gs: 0,
    relIP: 0,
    posG: { c: 0, if: 100, of: 0, dh: 0 },
    debut: "SEA",
    teams: ["CHC"],
    ...over,
  };
}

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
  budgetRaw: 74_555_288,
  contracts: [],
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

describe("resuming onto a half-used Double Play", () => {
  beforeEach(() => store.clear());

  it("flags the spin end nobody asked for", async () => {
    const game = landed();
    game.toggleDoublePlay();
    game.signPlayer(theCard.players[0]);
    expect(game.phase).toBe("landed"); // the second pick is still live

    const back = await restore();
    expect(back).not.toBeNull();
    // The forfeit itself is unchanged — that contract belongs to
    // restore-doubleplay.test.ts and is restated here only as the precondition.
    expect(back!.phase).toBe("preSpin");
    expect(back!.powerups.doublePlay).toBe("ready");
    // …and the resumed end is now distinguishable from a committed one.
    expect(back!.resumedForfeit).toBe(true);
    // The card the pick was spent on is still there to be held on screen.
    expect(back!.card?.team).toBe("CHC");
  });

  it("does not flag a spin the player ended by committing a choice", async () => {
    const game = landed();
    // No Double Play: one choice, spent, spin over. The everyday path.
    game.signPlayer(theCard.players[0]);
    expect(game.phase).toBe("preSpin");
    expect(game.resumedForfeit).toBe(false);

    const back = await restore();
    expect(back!.phase).toBe("preSpin");
    expect(back!.resumedForfeit).toBe(false);
  });

  it("does not flag a reload that beat the first pick", async () => {
    const game = landed();
    game.toggleDoublePlay();
    game.save();

    const back = await restore();
    // Nothing was committed, so the card stays live — no forfeit, no notice.
    expect(back!.phase).toBe("landed");
    expect(back!.resumedForfeit).toBe(false);
  });

  it("clears the flag once the reel leaves", async () => {
    const game = landed();
    game.toggleDoublePlay();
    game.signPlayer(theCard.players[0]);
    const back = await restore();
    expect(back!.resumedForfeit).toBe(true);

    back!.spin();
    expect(back!.phase).toBe("spinning");
    expect(back!.resumedForfeit).toBe(false);
  });

  it("keeps the flag out of the save record", async () => {
    const game = landed();
    game.toggleDoublePlay();
    game.signPlayer(theCard.players[0]);
    const back = await restore();
    expect(back!.resumedForfeit).toBe(true);
    back!.save();

    // A second reload is a fresh boot onto a spin that is simply over: the
    // notice belongs to the reload that took the pick, not to every one after.
    const again = await restore();
    expect(again!.phase).toBe("preSpin");
    expect(again!.resumedForfeit).toBe(false);
  });
});

/** ↩️ Undo — one move back, and the seed it is not allowed to break.
 *
 * The feature is a single held snapshot of the save's own shape, restored
 * through the same `hydrate` a reload goes through. Almost everything worth
 * asserting about it is an identity: the position after `undo()` is the
 * position before the move, field for field.
 *
 * The load-bearing test in this file is `deals the identical card`. This game
 * is seeded and seeds are shareable, so `Rng.state` is a cursor two players
 * must be able to walk down in step. A rewind that restored the club but not
 * the cursor would leave undo-then-spin dealing a card the seed never dealt —
 * an unlimited reroll, and silent: the club would look right, the cards would
 * be plausible, and only two people comparing the same code would ever find
 * out. Every other test here can fail loudly; that one is the one that cannot
 * fail any other way.
 *
 * Fixtures are hand-built to engine.test.ts's pattern rather than read off
 * disk, for restore-doubleplay.test.ts's reason: the behavior under test lives
 * entirely in the serialize/restore round trip, and a real card would only add
 * ways to fail for reasons that are not the feature.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { earnedBadges, BADGE_BY_KEY, type BadgeFacts } from "../src/lib/badges";
import { Game, SLOT_TYPES, type Signed } from "../src/lib/engine.svelte";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const SAVE_KEY = "hotstove.current";

// The engine guards every storage access; node needs a stub to guard against.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
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
    teams: ["UND"],
    ...over,
  };
}

function card(team: string, year: number): Card {
  return {
    year,
    team,
    franchise: team,
    name: `${team} ${year}`,
    park: `${team} Park`,
    wins: 90,
    losses: 72,
    manager: `${team} Skipper`,
    ws: false,
    pen: false,
    attendance: 2_000_000,
    attendancePct: 0.7,
    stadiumMult: 1.1,
    budget: 130,
    budgetRaw: 70_000_000,
    contracts: [],
    prorated: 1,
    players: [player({ name: `${team} Rizzo` }), player({ name: `${team} Baez` })],
  };
}

/** Five distinct cards, so a spin genuinely CHOOSES one — a one-card index
 * would deal the same team whatever the cursor did, and the seed-integrity
 * test would pass with the rewind ripped out. AAA holds two seasons, which is
 * what gives 🎟️ Season Ticket somewhere to go. */
const CARDS: Card[] = [
  card("AAA", 2001),
  card("AAA", 2002),
  card("BBB", 2002),
  card("CCC", 2003),
  card("DDD", 2004),
];
const byKey = new Map(CARDS.map((c) => [`${c.team}_${c.year}`, c]));

vi.stubGlobal("fetch", async (url: unknown) => {
  const m = String(url).match(/cards\/([A-Z0-9]+)_(\d{4})\.json$/);
  const c = m ? byKey.get(`${m[1]}_${m[2]}`) : undefined;
  return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
});

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: SLOT_TYPES,
  minBudget: 18.2,
  avgSlot8: { "2001": 87497175 },
  salaryFloor: { "2001": 508500 },
  proration: {},
};

const index: GameIndex = {
  yearMin: 2001,
  yearMax: 2004,
  cards: CARDS.map((c) => ({
    team: c.team,
    year: c.year,
    franchise: c.franchise,
    name: c.name,
  })),
};

const owners: Owners = {
  franchises: Object.fromEntries(
    CARDS.map((c) => [
      c.franchise,
      { name: c.name, owners: [{ name: "The Group", from: 1900, to: null }] },
    ]),
  ),
};

/** A fresh game spun once and landed — the ordinary in-play position, reached
 * the way a player reaches it rather than by assigning fields. */
async function spun(seed = 42): Promise<Game> {
  const g = new Game(meta, index, owners, seed);
  g.spin();
  await g.land();
  return g;
}

function filler(i: number): Signed {
  return {
    id: `f${i}`,
    name: `Filler ${i}`,
    pos: SLOT_TYPES[i],
    war: 3,
    awards: [],
    ws: false,
    pen: false,
    year: 2001,
    team: "AAA",
    teamName: "AAA 2001",
    franchise: "AAA",
    costPaid: 10,
    hero: false,
    prorated: 1,
  };
}

beforeEach(() => store.clear());

describe("what a rewind puts back", () => {
  it("restores the exact slots and the exact rng cursor a signing stood on", async () => {
    const g = await spun();
    const cursor = g.rng.state;
    const slots = JSON.stringify(g.slots);
    // The opening deal is not a move — no tap made it — so the pill is dark
    // until the player commits something. Undoing here would re-deal the
    // identical card (the cursor rewinds with everything else) and burn the
    // game's one rewind on nothing.
    expect(g.canUndo).toBe(false);

    g.signPlayer(g.card!.players[0]);
    expect(g.canUndo).toBe(true);
    expect(g.slots.filter(Boolean)).toHaveLength(1);
    expect(JSON.stringify(g.slots)).not.toBe(slots);

    g.undo();
    expect(JSON.stringify(g.slots)).toBe(slots);
    expect(g.slots.every((s) => s === null)).toBe(true);
    // A signing draws nothing, so the cursor's job here is to hold still —
    // a rewind that reset it to the seed would be just as wrong as one that
    // advanced it.
    expect(g.rng.state).toBe(cursor);
    // Back on the card, with the choice it arrived with.
    expect(g.phase).toBe("landed");
    expect(g.card!.team).toBe(CARDS.find((c) => c.team === g.card!.team)!.team);
    expect(g.choicesLeft).toBe(1);
    expect(g.choicesUsed).toBe(0);
    expect(g.spinLog).toEqual([]);
  });

  it("hands a spent powerup back ARMED, exactly as the swap found it", async () => {
    // Arming is not a move and takes no point, so the position the swap stood
    // on is "🔁 lit, nothing committed" — and that is what comes back. Handing
    // it back `ready` would be a second undo the player did not ask for.
    const g = await spun();
    g.toggleTradeDeadline();
    // Slot 1 is the first IF chair, which is the only kind the card's players
    // are eligible for — the swap needs an OCCUPIED eligible seat to claim.
    g.slots[1] = filler(1);
    const before = JSON.stringify(g.slots);

    // A 🔁 swap spends the powerup and takes the seat.
    g.tdTapPlayer(g.card!.players[0]);
    expect(g.powerups.tradeDeadline).toBe("spent");
    expect(JSON.stringify(g.slots)).not.toBe(before);

    g.undo();
    expect(g.powerups.tradeDeadline).toBe("armed");
    expect(g.phase).toBe("landed");
    expect(JSON.stringify(g.slots)).toBe(before);
  });

  it("puts the reel back on the card a 🎟️ Season Ticket moved it off", async () => {
    // The only moves that swap the card under the player without a fresh draw
    // are 🎟️ and 🚚, and both reach the reel through `beginSpin` from the same
    // snapshot placement. This is the case `undo` would get wrong by holding a
    // card REFERENCE and re-fetching it, or by leaving `this.card` alone: the
    // position it restores is on a different card than the one on screen.
    let g: Game | null = null;
    for (let seed = 1; seed < 200 && g === null; seed++) {
      const candidate = new Game(meta, index, owners, seed);
      candidate.spin();
      await candidate.land();
      if (candidate.card!.franchise === "AAA") g = candidate;
    }
    // Searched rather than hardcoded so a fixture edit cannot quietly turn this
    // into a test of some other card.
    expect(g, "no seed in 1..200 opens on AAA").not.toBeNull();

    const from = g!.card!;
    const other = g!.yearsForFranchise("AAA").find((y) => y !== from.year)!;
    g!.seasonTicket(other);
    await g!.land();
    expect(g!.card!.year).toBe(other);
    expect(g!.powerups.seasonTicket).toBe("spent");
    expect(g!.seen).toHaveLength(2);

    g!.undo();
    expect(g!.card).toBe(from);
    expect(g!.card!.year).toBe(from.year);
    expect(g!.powerups.seasonTicket).toBe("ready");
    expect(g!.seen).toEqual([{ team: from.team, year: from.year }]);
    expect(g!.phase).toBe("landed");
    expect(g!.choicesLeft).toBe(1);
  });

  it("writes the rewound position to storage, so a reload cannot resurrect the move", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);
    g.undo();

    const back = await Game.restore(meta, index, owners);
    expect(back).not.toBeNull();
    expect(back!.slots.every((s) => s === null)).toBe(true);
    expect(back!.rng.state).toBe(g.rng.state);
  });
});

describe("the seed", () => {
  it("deals the identical card when the spin a rewind took back is made again", async () => {
    // Sign on card one, let the stove roll card two, rewind the signing, sign
    // again, spin again. The re-spin must re-deal card two exactly. This is
    // the assertion the whole feature turns on: without it the re-spin draws a
    // different index and the seed stops meaning anything.
    const g = await spun();
    const cursorBeforeSign = g.rng.state;
    g.signPlayer(g.card!.players[0]);
    g.spin();
    await g.land();
    const second = { team: g.card!.team, year: g.card!.year };
    const spunCursor = g.rng.state;
    const spins = g.spinCount;

    g.undo();
    // The cursor is back where the signing found it — the spin's draw is
    // un-drawn along with the pick it followed.
    expect(g.rng.state).toBe(cursorBeforeSign);
    expect(g.phase).toBe("landed");
    expect(g.spinCount).toBe(spins - 1);

    g.signPlayer(g.card!.players[0]);
    g.spin();
    await g.land();
    expect({ team: g.card!.team, year: g.card!.year }).toEqual(second);
    expect(g.rng.state).toBe(spunCursor);
    expect(g.spinCount).toBe(spins);
    // And `seen` is not double-counted by the round trip.
    expect(g.seen.filter((s) => s.team === second.team && s.year === second.year)).toHaveLength(1);
  });

  it("keeps a rewound game walking the same deal as an untouched one on the same seed", async () => {
    // The property stated end to end: an undo is invisible from outside the
    // run. Two games on one seed, one of which takes a move back and redoes
    // it, must be dealt the same cards in the same order.
    const straight = await spun(7);
    const wobbly = await spun(7);
    wobbly.undo();
    wobbly.spin();
    await wobbly.land();

    for (let i = 0; i < 3; i++) {
      straight.spin();
      await straight.land();
      wobbly.spin();
      await wobbly.land();
      expect(wobbly.card!.team).toBe(straight.card!.team);
    }
    expect(wobbly.rng.state).toBe(straight.rng.state);
  });
});

describe("one level, repeatable", () => {
  it("refuses a second rewind in a row, and offers one again after the next move", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);
    expect(g.canUndo).toBe(true);

    g.undo();
    // Consumed. The point is gone, not merely unreachable.
    expect(g.canUndo).toBe(false);
    const held = JSON.stringify(g.slots);
    g.undo();
    expect(JSON.stringify(g.slots)).toBe(held);

    // A fresh move takes a fresh point.
    g.signPlayer(g.card!.players[0]);
    expect(g.canUndo).toBe(true);
    g.undo();
    expect(g.slots.every((s) => s === null)).toBe(true);
  });

  it("takes back the pick, not the spin the stove rolled straight after it", async () => {
    // The case every other test in this file walks around, because they all
    // call spin() by hand. In the app nobody does: committing a pick drops
    // `choicesLeft` to zero, and SpinBanner's effect spins on the next turn of
    // the event loop with no tap in between. So the real sequence around a
    // signing is sign → spin → land, and if that spin took a point of its own
    // it would replace the signing with the roll that followed it — leaving
    // undo able to rewind only to just after the pick, having spent the one
    // point that could have taken the pick back. No choice in the game would
    // ever be undoable.
    const g = await spun();
    const cursor = g.rng.state;
    const before = JSON.stringify(g.slots);

    g.signPlayer(g.card!.players[0]);
    expect(g.slots.filter(Boolean)).toHaveLength(1);
    // What the banner does on its own, unprompted, the instant the pick lands.
    expect(g.choicesLeft).toBe(0);
    g.spin();
    await g.land();

    expect(g.canUndo).toBe(true);
    g.undo();
    // The signing is gone — the thing the player actually meant to take back.
    expect(JSON.stringify(g.slots)).toBe(before);
    expect(g.slots.every((s) => s === null)).toBe(true);
    // And the reel is back on the card he was standing on when he signed,
    // with the cursor that dealt it, so re-signing deals the same game on.
    expect(g.rng.state).toBe(cursor);
    expect(g.phase).toBe("landed");
    expect(g.choicesLeft).toBe(1);
  });

  it("is offered mid-reel, and the spin it abandons cannot land on top of it", async () => {
    // The window the feature is actually used in. Committing a pick drops
    // `choicesLeft` to zero and SpinBanner spins on the next turn of the event
    // loop, so by the time a player's thumb reaches the corner the game is
    // already "spinning" — a rewind refused there is a rewind refused always,
    // which is what made the pill light up only once the NEXT card had landed
    // on top of the pick being regretted.
    //
    // What it costs is a race, and this test is the race: the fetch for the
    // abandoned card is IN FLIGHT and its `land()` is parked on the await when
    // the rewind runs. Nothing is awaited between the two lines below,
    // deliberately — call `land()` after the undo instead and the engine's
    // "no pending card" guard catches it, and the test passes with the epoch
    // check ripped out.
    const g = await spun();
    const cursor = g.rng.state;
    const before = JSON.stringify(g.slots);
    const seenBefore = JSON.stringify(g.seen);
    const spins = g.spinCount;

    g.signPlayer(g.card!.players[0]);
    const signedCard = g.card;
    expect(g.choicesLeft).toBe(0);
    // What the banner does on its own, unprompted, the instant the pick lands —
    // and the player has not waited for it.
    g.spin();
    expect(g.phase).toBe("spinning");
    expect(g.canUndo).toBe(true);

    const landing = g.land();
    g.undo();
    // The rewind is complete and synchronous: the reel is back on the card the
    // signing was made on, with the cursor that dealt it.
    expect(JSON.stringify(g.slots)).toBe(before);
    expect(g.card).toBe(signedCard);
    expect(g.phase).toBe("landed");
    expect(g.choicesLeft).toBe(1);
    expect(g.rng.state).toBe(cursor);

    // And it stays complete. The abandoned spin resolves here, into a game that
    // has moved on without it: `seen` is the sharpest witness, because a land
    // that got through appends the card it fetched whatever else looks right.
    await landing;
    expect(JSON.stringify(g.slots)).toBe(before);
    expect(g.card).toBe(signedCard);
    expect(g.phase).toBe("landed");
    expect(g.choicesLeft).toBe(1);
    expect(g.rng.state).toBe(cursor);
    expect(JSON.stringify(g.seen)).toBe(seenBefore);
    expect(g.spinCount).toBe(spins);
    expect(g.loadFailed).toBe(false);
    // One rewind per move, mid-reel like anywhere else — the point was consumed.
    expect(g.canUndo).toBe(false);
  });

  it("refuses mid-reel the automatic roll no player asked for", async () => {
    // The stove spins itself out of "preSpin", so the only point that can be
    // standing during a reel with no move behind it is that roll's own. Taking
    // it back would rewind the cursor and re-deal the identical card, spending
    // the one rewind a game gets on nothing — so mid-reel reaches a MOVE only.
    const g = new Game(meta, index, owners, 42);
    g.spin();
    expect(g.phase).toBe("spinning");
    expect(g.canUndo).toBe(false);
    await g.land();
  });

  it("takes no point for arming a powerup, which the player reverses himself", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);
    g.undo();
    expect(g.canUndo).toBe(false);

    g.toggleTradeDeadline();
    g.toggleDoublePlay();
    // Arming is browsing, not a move: spending an undo on it would cost the
    // player the move behind it.
    expect(g.canUndo).toBe(false);
  });
});

describe("the finale boundary", () => {
  it("is unavailable from the moment the club completes", async () => {
    const g = await spun();
    for (let i = 0; i < SLOT_TYPES.length; i++) g.slots[i] ??= filler(i);
    g.owner = {
      name: "x",
      budget: 100,
      franchise: g.card!.franchise,
      year: g.card!.year,
      teamName: g.card!.name,
    };
    g.stadium = {
      park: "y",
      mult: 1,
      franchise: g.card!.franchise,
      year: g.card!.year,
    };
    // Dark here too: the only point held is the opening deal's, and the pill
    // never lights for a point with no move behind it.
    expect(g.canUndo).toBe(false);

    // The hire that completes the club. It takes a point of its own — a real
    // "landed" move point that would light the pill — microseconds before
    // `finishGame` drops it. `finishGame` is async and leaves the phase on
    // "landed" until its dream solve resolves, so the window this asserts is
    // the one where the HUD is still up and the game is already over — a
    // rewind taken here would have finishGame land on a club that no longer
    // exists. A dark pill in this window proves the synchronous drop, not the
    // opening-deal gate.
    g.hireManager();
    expect(g.canUndo).toBe(false);

    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    expect(g.canUndo).toBe(false);
    g.undo();
    expect(g.phase).toBe("finale");
  });
});

describe("↩️ SECOND THOUGHTS", () => {
  it("is set by the rewind that earns it, and not cleared by it", async () => {
    const g = await spun();
    expect(g.undoUsed).toBe(false);

    g.signPlayer(g.card!.players[0]);
    g.undo();
    // The trap: every snapshot is taken BEFORE the undo that restores it, so a
    // restore that carried this field would clear the flag on the one call
    // that sets it.
    expect(g.undoUsed).toBe(true);

    g.signPlayer(g.card!.players[0]);
    g.undo();
    expect(g.undoUsed).toBe(true);
  });

  it("survives the save/restore round trip", async () => {
    const g = await spun();
    g.signPlayer(g.card!.players[0]);
    g.undo();
    expect(store.has(SAVE_KEY)).toBe(true);

    const back = await Game.restore(meta, index, owners);
    expect(back!.undoUsed).toBe(true);
    // And a run that never rewound restores as one that never rewound — the
    // flag is read `=== true`, so an older save with no such field is a game
    // with no rewind rather than a free badge.
    store.set(
      SAVE_KEY,
      JSON.stringify({
        ...JSON.parse(store.get(SAVE_KEY)!),
        undoUsed: undefined,
      }),
    );
    expect((await Game.restore(meta, index, owners))!.undoUsed).toBe(false);
  });

  it("resolves from the fact the engine hands the badge table", () => {
    const facts = (over: Partial<BadgeFacts>): BadgeFacts => ({
      baselineWins: 81,
      baselineLosses: 81,
      total: 81,
      spendM: 50,
      budgetM: 100,
      budgetBonus: 0,
      scoutHits: 0,
      roster: [],
      managerTeam: null,
      managerYear: null,
      managerName: null,
      rings: 0,
      awardPoints: 0,
      managerMoty: false,
      owner: null,
      stadium: null,
      divisions: [],
      powerups: { spent: 1, total: 6 },
      ...over,
    });
    expect(earnedBadges(facts({ undone: true }))).toContain("secondthoughts");
    expect(earnedBadges(facts({ undone: false }))).not.toContain("secondthoughts");
    // Absent reads as no rewind, never as an unknown that pays out.
    expect(earnedBadges(facts({}))).not.toContain("secondthoughts");
  });

  it("is an anti-trophy with no measurable population", () => {
    const def = BADGE_BY_KEY.secondthoughts;
    expect(def.label).toBe("SECOND THOUGHTS");
    expect(def.axis).toBe("meta");
    // No bot arm presses a button, so there is nothing to measure this against
    // — `null`, like every other meta badge, and never a fabricated rate.
    expect(def.freq).toBeNull();
    expect(def.ironic).toBe(true);
  });
});

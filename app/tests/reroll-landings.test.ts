/** A LANDING, not a card, is what buys one thing.
 *
 * 🎟️ Season Ticket, 🚚 Relocate and the cold-stove respin all re-deal the card
 * the reel is standing on, and every one of them runs while `phase` is
 * "landed" — which is AFTER `land()` has already pushed that card into `seen`.
 * So the abandoned card and its replacement both sit in the pool the finale
 * solves, and until the pool said which cards shared a landing the solver read
 * them as two landings and drafted a man off each. One landing, two picks: a
 * ceiling nobody could reach, and a 🦉 OUTSCOUTED withheld for a solver bug.
 *
 * `Game#seen` carries the landing id (`spinCount`, which all three mechanisms
 * decrement before they re-deal), `finishGame` hands it to the solver as
 * `opts.landings`, and bestroster's wrapper enumerates one retained card per
 * landing. These tests drive each mechanism through the real engine and then
 * ask the real solver what the resulting pool is worth. The solver's own half
 * of the rule — the ✌️ Double Play, the abandoned card as a counterfactual,
 * old saves — is in bestroster.test.ts. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bestRoster } from "../src/lib/bestroster";
import { Game, SLOT_TYPES, type Bank, type Signed } from "../src/lib/engine.svelte";
import type {
  Card,
  CardPlayer,
  GameIndex,
  Meta,
  Owners,
} from "../src/lib/types";

// Engine save()/restore() guard storage access; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const fetchCards: Record<string, Card> = {};
vi.stubGlobal("fetch", async (url: unknown) => {
  if (String(url).endsWith("data/specials.json"))
    return { ok: true, json: async () => ({}) };
  const m = String(url).match(/cards\/([A-Z0-9]+)_(\d{4})\.json$/);
  const c = m ? fetchCards[`${m[1]}_${m[2]}`] : undefined;
  return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
});

const meta: Meta = {
  displayAvgM: 160,
  replacementWins: 50,
  slots: SLOT_TYPES,
  minBudget: 18.2,
  avgSlot8: { "2001": 87497175, "2002": 87497175 },
  salaryFloor: { "2001": 508500, "2002": 508500 },
  proration: {},
};

/** Three cards, arranged so every mechanism has a target: ALP 2002 is the same
 * FRANCHISE as ALP 2001 (🎟️ Season Ticket) and BET 2001 is the same YEAR
 * (🚚 Relocate). */
const index: GameIndex = {
  yearMin: 2001,
  yearMax: 2002,
  cards: [
    { team: "ALP", year: 2001, franchise: "ALP", name: "Alpha 2001" },
    { team: "ALP", year: 2002, franchise: "ALP", name: "Alpha 2002" },
    { team: "BET", year: 2001, franchise: "BET", name: "Beta 2001" },
  ],
};

const owners: Owners = {
  franchises: {
    ALP: { name: "Alpha", owners: [{ name: "A. Owner", from: 1990, to: null }] },
    BET: { name: "Beta", owners: [{ name: "B. Owner", from: 1990, to: null }] },
  },
};

let pid = 0;
const player = (over: Partial<CardPlayer>): CardPlayer => ({
  id: `p${pid++}`,
  name: "Test Player",
  pos: "1B",
  war: 5,
  cost: 5,
  awards: [],
  ws: false,
  pen: false,
  posG: { c: 0, if: 100, of: 0 },
  debut: "ALP",
  ...over,
});

const card = (over: Partial<Card>): Card => ({
  year: 2001,
  team: "ALP",
  franchise: "ALP",
  name: "Alpha 2001",
  park: "Alpha Park",
  wins: 103,
  losses: 58,
  manager: null,
  ws: false,
  pen: false,
  attendance: 3_232_420,
  attendancePct: 0.86,
  stadiumMult: 1.11,
  budget: 136.3,
  prorated: 1,
  players: [],
  ...over,
});

beforeEach(() => {
  store.clear();
  pid = 0;
  for (const e of index.cards)
    fetchCards[`${e.team}_${e.year}`] = card({
      team: e.team,
      year: e.year,
      franchise: e.franchise,
      name: e.name,
      players: [
        player({ pos: "SS", posG: { c: 0, if: 100, of: 0 }, war: 9 }),
        player({ pos: "CF", posG: { c: 0, if: 0, of: 100 }, war: 8 }),
      ],
    });
});

const filler = (i: number): Signed => ({
  id: `f${i}`,
  name: "Filler",
  pos: "1B",
  war: 3,
  awards: [],
  ws: false,
  pen: false,
  year: 2001,
  team: "BET",
  teamName: "Beta 2001",
  franchise: "BET",
  costPaid: 10,
  hero: false,
  prorated: 1,
});

/** The first seed in 1..500 whose opening spin lands on this card. Searched
 * rather than hardcoded so a fixture edit cannot quietly turn these into tests
 * of some other landing. */
async function openingOn(team: string, year: number, bank: Bank = "classic"): Promise<Game> {
  for (let seed = 1; seed < 500; seed++) {
    const g = new Game(meta, index, owners, seed, { difficulty: "standard", bank });
    g.spin();
    await g.land();
    if (g.card!.team === team && g.card!.year === year) return g;
  }
  throw new Error(`no seed in 1..500 opens on ${team}_${year}`);
}

/** Distinct cards the dream club draws on: roster seats, the skipper, the owner
 * and the ballpark. The front office costs cards too (bestroster rule 4), and
 * counting only `picks` would pass a club whose ballpark came off the card the
 * reroll abandoned — the fixed bank here buys neither, so the classic-bank case
 * is asserted in bestroster.test.ts instead. */
function clubCards(cards: Card[], landings: (number | undefined)[]): Set<string> {
  const best = bestRoster(cards, { fixedBudgetM: 500, landings });
  const keys = best.picks.filter((p) => p !== null).map((p) => `${p!.team}_${p!.year}`);
  if (best.manager) keys.push(`${best.manager.team}_${best.manager.year}`);
  if (best.owner) keys.push(`${best.owner.team}_${best.owner.year}`);
  if (best.park) keys.push(`${best.park.team}_${best.park.year}`);
  return new Set(keys);
}

/** The pool the finale would solve, straight off `seen` — the same two arrays
 * `finishGame` builds, in the same order. */
const pool = (g: Game): Card[] => g.seen.map((s) => fetchCards[`${s.team}_${s.year}`]);
const landingsOf = (g: Game): (number | undefined)[] => g.seen.map((s) => s.spin);

/** How many DIFFERENT cards `seen` holds. The seed searches below screen on this
 * rather than on `seen.length`, because a landing that deals a card the reel has
 * already shown is a repeat, and a pool whose two entries are the same card can
 * neither pass nor fail a test about drawing off one card of two. */
const distinctCards = (g: Game): number =>
  new Set(g.seen.map((s) => `${s.team}_${s.year}`)).size;

describe("a rerolled landing keeps both cards behind one id", () => {
  it("🎟️ Season Ticket: the season it left and the season it took", async () => {
    const g = await openingOn("ALP", 2001);
    expect(g.seen).toEqual([{ team: "ALP", year: 2001, spin: 1 }]);

    g.seasonTicket(2002);
    await g.land();
    expect(g.card!.year).toBe(2002);
    expect(g.seen).toEqual([
      { team: "ALP", year: 2001, spin: 1 },
      { team: "ALP", year: 2002, spin: 1 },
    ]);

    // One landing, so one card between the two of them however good the other
    // one was. Unsaid, the same pool pays the season for two landings.
    expect(clubCards(pool(g), landingsOf(g)).size).toBe(1);
    expect(clubCards(pool(g), [undefined, undefined]).size).toBe(2);
  });

  it("🚚 Relocate: the club it left and the club it took", async () => {
    const g = await openingOn("ALP", 2001);
    g.relocate("BET");
    await g.land();
    expect(g.card!.team).toBe("BET");
    expect(g.seen).toEqual([
      { team: "ALP", year: 2001, spin: 1 },
      { team: "BET", year: 2001, spin: 1 },
    ]);
    expect(clubCards(pool(g), landingsOf(g)).size).toBe(1);
    expect(clubCards(pool(g), [undefined, undefined]).size).toBe(2);
  });

  it("the cold stove: the dead card and the card it respun into", async () => {
    // A dead card is one with nothing left to commit, and the cheapest way
    // there is a board already closed: the rail full, the front office bought,
    // the skipper hired and 🔁 Trade Deadline spent. Which card the reel opened
    // on does not matter to the rule — the landing id does.
    let g: Game | null = null;
    for (let seed = 1; seed < 500 && g === null; seed++) {
      const candidate = new Game(meta, index, owners, seed);
      candidate.spin();
      await candidate.land();
      for (let i = 0; i < SLOT_TYPES.length; i++) candidate.slots[i] = filler(i);
      candidate.owner = {
        name: "A. Owner",
        budget: 136.3,
        franchise: "ALP",
        year: 2001,
        teamName: "Alpha 2001",
      };
      candidate.stadium = { park: "Alpha Park", mult: 1.11, franchise: "ALP", year: 2001 };
      candidate.manager = {
        name: "Skip",
        wins: 103,
        losses: 58,
        year: 2001,
        team: "ALP",
        teamName: "Alpha 2001",
        ws: false,
        pen: false,
      };
      candidate.powerups.tradeDeadline = "spent";
      if (!candidate.coldStove) continue;
      candidate.coldRespin();
      candidate.spin();
      await candidate.land();
      // A respin that deals the same card back is a landing whose two cards are
      // one card, and it has nothing to say about grouping either way.
      if (distinctCards(candidate) === 2) g = candidate;
    }
    expect(g, "no seed in 1..500 respins a dead card into another card").not.toBeNull();

    expect(g!.seen.map((s) => s.spin)).toEqual([1, 1]);
    expect(clubCards(pool(g!), landingsOf(g!)).size).toBe(1);
    expect(clubCards(pool(g!), [undefined, undefined]).size).toBe(2);
  });

  it("the finale's own dream club buys one card off the landing it rerolled", async () => {
    // Every other test here reads `seen` and calls the solver itself, so none of
    // them can see whether `finishGame` passes the landing ids ALONG. This one
    // finishes a real season and reads the club off `finale.best`: delete the
    // `landings:` argument in finishGame and the two cards of this landing seat
    // two men, which is the bug.
    //
    // Moneyball, because a fixed bank hands out the cap — no owner and no
    // ballpark competing for a two-card pool.
    const g = await openingOn("ALP", 2001, "moneyball");
    g.relocate("BET");
    await g.land();
    expect(g.seen.map((s) => s.spin)).toEqual([1, 1]);

    // Everything except the one OF seat, so the signing below is the move that
    // completes the club and ends the season.
    for (let i = 0; i < SLOT_TYPES.length; i++) if (i !== 3) g.slots[i] = filler(i);
    g.manager = {
      name: "Skip",
      wins: 103,
      losses: 58,
      year: 2001,
      team: "ALP",
      teamName: "Alpha 2001",
      ws: false,
      pen: false,
    };
    const cf = g.card!.players.find((p) => p.pos === "CF")!;
    g.signPlayer(cf, 3);
    // finishGame awaits the pool's card reloads before it writes the finale.
    await vi.waitFor(() => expect(g.phase).toBe("finale"));

    const best = g.finale!.best!;
    const drawn = new Set(
      best.picks.filter((p) => p !== null).map((p) => `${p!.team}_${p!.year}`),
    );
    if (best.manager) drawn.add(`${best.manager.team}_${best.manager.year}`);
    // Two seats — the retained card's two men, one of them the ✌️ Double Play —
    // off ONE card, because one landing is all the reel gave this season.
    expect(best.dreamSeats).toBe(2);
    expect(drawn.size).toBe(1);
  });

  it("a full spin after a reroll opens a landing of its own", async () => {
    // The id is the reel's position, not a per-game constant: the reroll shares
    // landing 1, and the spin the player earns by committing a pick is landing
    // 2 and buys its own man.
    let g: Game | null = null;
    for (let seed = 1; seed < 500 && g === null; seed++) {
      const candidate = new Game(meta, index, owners, seed);
      candidate.spin();
      await candidate.land();
      if (candidate.card!.team !== "ALP" || candidate.card!.year !== 2001) continue;
      candidate.relocate("BET");
      await candidate.land();
      candidate.signPlayer(candidate.card!.players[0], 1);
      candidate.spin();
      await candidate.land();
      // Three landings on three different cards: a third spin that repeats one
      // of the first two would make the pool's card count say nothing.
      if (candidate.seen.length === 3 && distinctCards(candidate) === 3) g = candidate;
    }
    expect(g, "no seed in 1..500 spins a third distinct card after a 🚚").not.toBeNull();

    expect(g!.seen.map((s) => s.spin)).toEqual([1, 1, 2]);
    expect(clubCards(pool(g!), landingsOf(g!)).size).toBe(2);
  });
});

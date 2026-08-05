/** The finale survives a reload.
 *
 * A finished game is not a resumable one — `save()` refuses to write a finale
 * into `hotstove.current` and `finishGame` deletes that key — so the finale
 * screen needs persistence of its own. It gets two keys:
 *
 *   `hotstove.finale`      the ARCHIVE: everything the screen renders.
 *   `hotstove.finale.open` the BOOT CLAIM: the screen is where the player is.
 *
 * The split is what makes both halves of the request possible at once. "Stay
 * on the finale until ✕ / Replay / Modes" is the CLAIM's lifetime; "a way back
 * from home" is the ARCHIVE's. The claim's VALUE says which finale is on screen
 * — "1" for the live one in `hotstove.finale`, "a:<id>" for a season reopened
 * out of `hotstove.archive` — so a reload puts back the club the player was
 * looking at rather than the last one they played. One flag inside one record
 * cannot do both: an
 * exit that deleted the record would delete it before the home screen could
 * ever offer the way back, since ✕ and Modes are the only routes from the
 * finale to the home screen in the first place.
 *
 * Fixtures follow engine.test.ts — hand-built cards, a stubbed localStorage,
 * a fetch that serves the one card this suite plays.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Game,
  SLOT_TYPES,
  claimFinale,
  claimedArchiveId,
  clearStoredFinale,
  finaleClaimed,
  loadStoredFinale,
  releaseFinale,
  type Signed,
} from "../src/lib/engine.svelte";
import { loadArchive, loadHistory } from "../src/lib/history";
import type { Card, CardPlayer, GameIndex, Meta, Owners } from "../src/lib/types";

const FINALE_KEY = "hotstove.finale";
const FINALE_OPEN_KEY = "hotstove.finale.open";
const SAVE_KEY = "hotstove.current";
const HISTORY_KEY = "hotstove.history";

// Every storage access in the engine is guarded; node needs a stub to guard.
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
  cards: [
    { team: "CHC", year: 2016, franchise: "CHC", name: "Chicago Cubs", lg: "NL", div: "C" },
  ],
};

const owners: Owners = {
  franchises: {
    CHC: {
      name: "Chicago Cubs",
      owners: [{ name: "Ricketts family", from: 2009, to: null }] } } };

function player(over: Partial<CardPlayer> = {}): CardPlayer {
  return {
    id: "rizzo",
    name: "Anthony Rizzo",
    pos: "1B",
    war: 5,
    cost: 12,
    awards: ["MVP"],
    ws: true,
    pen: false,
    posG: { c: 0, if: 141, of: 0},
    debut: "CHC",
    age: 26,
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
  managerMoty: true,
  ws: true,
  pen: false,
  attendance: 3_232_420,
  attendancePct: 0.86,
  stadiumMult: 1.11,
  budget: 136.3,
  prorated: 1,
  players: [player()],
};

function filler(i: number, over: Partial<Signed> = {}): Signed {
  return {
    id: `f${i}`,
    name: "Filler",
    pos: "1B",
    war: 3,
    awards: [],
    ws: false,
    pen: false,
    year: 2016,
    team: "CHC",
    teamName: "Chicago Cubs",
    franchise: "CHC",
    costPaid: 10,
    hero: false,
    prorated: 1,
    age: 28,
    ...over,
  };
}

/** The fastest finished game: a fixed-cap bank (no owner, no ballpark to buy),
 * eight filled seats, and the card's manager hired as the last choice — which
 * completes the club and runs `finishGame`. */
async function playToFinale(seed = 42): Promise<Game> {
  const g = new Game(meta, index, owners, seed, {
    difficulty: "standard",
    bank: "moneyball",
  });
  g.card = theCard;
  g.phase = "landed";
  g.choicesLeft = 1;
  g.seen = [{ team: "CHC", year: 2016 }];
  for (let i = 0; i < SLOT_TYPES.length; i++) g.slots[i] = filler(i);
  g.slots[0] = filler(0, { ...player(), year: 2016, teamName: "Chicago Cubs" });
  g.powerups.tradeDeadline = "spent";
  g.hireManager();
  await vi.waitFor(() => expect(g.phase).toBe("finale"));
  return g;
}

const resume = () => Game.resumeFinale(meta, index, owners);

beforeEach(() => store.clear());

describe("archiving the finale", () => {
  it("writes the archive and claims the screen when the game ends", async () => {
    const g = await playToFinale();
    expect(store.has(FINALE_KEY)).toBe(true);
    expect(finaleClaimed()).toBe(true);
    // A finished game is still not a resumable one.
    expect(store.has(SAVE_KEY)).toBe(false);

    const rec = loadStoredFinale()!;
    expect(rec).not.toBeNull();
    expect(rec.v).toBe(1);
    expect(rec.seed).toBe(42);
    expect(rec.config).toEqual({ difficulty: "standard", bank: "moneyball" });
    expect(rec.finale).toEqual(g.finale);
  });

  it("round-trips through JSON without losing anything the screen reads", async () => {
    const g = await playToFinale();
    // The whole point of the shape check: FinaleResult bottoms out in plain
    // JSON. A Map, a Set, or a class instance anywhere inside it would come
    // back as `{}` and the ledger would render blank.
    expect(loadStoredFinale()!.finale).toEqual(JSON.parse(JSON.stringify(g.finale)));
  });
});

describe("restoring on boot", () => {
  it("renders the same finale it stored", async () => {
    const g = await playToFinale();
    const back = resume()!;
    expect(back).not.toBeNull();

    // Everything Finale.svelte reads off the Game: game.finale, game.seed,
    // game.config, game.slots, game.manager, game.pedigree.
    expect(back.phase).toBe("finale");
    expect(back.finale).toEqual(g.finale);
    expect(back.seed).toBe(g.seed);
    expect(back.config).toEqual(g.config);
    expect(back.slots).toEqual(g.slots);
    expect(back.manager).toEqual(g.manager);
    expect(back.pedigree).toEqual(g.pedigree);
    // The ledger's own numbers, spelled out — the stamp, the badge row and the
    // scouting line are what a silent shape change would break first.
    expect(back.finale!.parts.total).toBe(g.finale!.parts.total);
    expect(back.finale!.badges).toEqual(g.finale!.badges);
    expect(back.finale!.newBadges).toEqual(g.finale!.newBadges);
    expect(back.finale!.best).toEqual(g.finale!.best);
    // THE CEILING, named field by field rather than left to the deep compare:
    // it is the newest part of FinaleResult, and a record that quietly dropped
    // it would restore a finale whose "you could have gone X–Y" line is simply
    // gone, with nothing on screen to say why.
    expect(back.finale!.bestPossibleTotal).toBe(g.finale!.bestPossibleTotal);
    expect(back.finale!.bestPossibleRecord).toEqual(g.finale!.bestPossibleRecord);
    expect(back.finale!.playedTheCeiling).toBe(g.finale!.playedTheCeiling);
    expect(back.finale!.bestManager).toEqual(g.finale!.bestManager);
    expect(back.finale!.scoutHits).toBe(g.finale!.scoutHits);
  });

  it("never logs the game a second time", async () => {
    // The highest-value assertion in the file: `recordHistory` runs inside
    // `finishGame`, and a restore that re-ran it would inflate the record
    // book's game count and every trophy-case tile by one per reload. The
    // restore is field assignment only, which is what makes that impossible.
    await playToFinale();
    const after = loadHistory();
    expect(after).toHaveLength(1);
    for (let i = 0; i < 3; i++) expect(resume()).not.toBeNull();
    expect(loadHistory()).toEqual(after);
  });

  it("writes nothing back into the in-progress save", async () => {
    await playToFinale();
    const back = resume()!;
    back.save();
    expect(store.has(SAVE_KEY)).toBe(false);
  });

  it("stays home when the screen was never claimed", async () => {
    await playToFinale();
    releaseFinale();
    expect(resume()).toBeNull();
    // …but the archive is still there for the home screen's way back.
    expect(loadStoredFinale()).not.toBeNull();
  });
});

describe("leaving the finale", () => {
  /** ✕ and Modes both land in App.goHome, which releases the claim. */
  it("✕ / Modes drop the boot claim and keep the archive", async () => {
    const g = await playToFinale();
    releaseFinale(); // goHome()

    expect(finaleClaimed()).toBe(false);
    expect(resume()).toBeNull();
    // The way back from home still works, and still shows the same game.
    const back = Game.fromStoredFinale(meta, index, owners)!;
    expect(back.finale).toEqual(g.finale);

    // Walking back in re-claims the screen, so a reload from there stays put.
    claimFinale();
    expect(resume()).not.toBeNull();
  });

  it("Replay / a new game retires the stored finale outright", async () => {
    await playToFinale();
    clearStoredFinale(); // startGame(), whether from Replay, PLAY, or a seed

    expect(loadStoredFinale()).toBeNull();
    expect(finaleClaimed()).toBe(false);
    expect(resume()).toBeNull();
    expect(store.has(FINALE_KEY)).toBe(false);
    // Which is what keeps "a game in progress AND a stored finale" out of
    // reach: every route into a game clears the archive first, so boot never
    // has to pick a winner.
    expect(store.has(SAVE_KEY)).toBe(false);
  });

  it("a second finished game replaces the first", async () => {
    const first = await playToFinale(7);
    clearStoredFinale();
    const second = await playToFinale(99);
    expect(loadStoredFinale()!.seed).toBe(99);
    expect(resume()!.finale).toEqual(second.finale);
    expect(first.seed).not.toBe(second.seed);
  });
});

/** A season reopened from the seasons list survives a reload too, and survives
 * it as ITSELF.
 *
 * `hotstove.finale` holds exactly one game — the last one finished — so a claim
 * that could only mean that key would answer a reload with the wrong club the
 * moment an older season was on screen. The id in the claim is what makes the
 * answer specific, and the two games these tests play are what make a fallback
 * to `hotstove.finale` visible: with one game the two records are the same
 * record and every assertion would pass on the bug. */
describe("reopening an archived season", () => {
  it("restores the season the claim names, not the last game played", async () => {
    const first = await playToFinale(7);
    const firstId = loadArchive()[0].id;
    clearStoredFinale(); // startGame(): the next game retires the live finale
    await playToFinale(99);
    // The live key is the SECOND game now. The claim below names the first.
    expect(loadStoredFinale()!.seed).toBe(99);

    claimFinale(firstId); // openFinale() off the seasons list
    const back = resume()!;
    expect(back).not.toBeNull();
    expect(back.seed).toBe(7);
    expect(back.finale).toEqual(first.finale);
    expect(claimedArchiveId()).toBe(firstId);
  });

  it("leaves the live claim meaning the game just finished", async () => {
    // The control: `finishGame` claims without an id, and that claim still
    // resolves through `hotstove.finale`.
    await playToFinale(7);
    clearStoredFinale();
    await playToFinale(99);
    expect(claimedArchiveId()).toBeNull();
    expect(resume()!.seed).toBe(99);
  });

  it("lands home when the claimed season has aged out of the archive", async () => {
    // The ordinary end of an old season: the archive is a bounded tail, so the
    // fifty games after this one evict it. Home is the honest answer, and the
    // claim goes with it rather than surviving to strand the next boot too.
    await playToFinale(7);
    claimFinale("a-season-no-longer-held");
    expect(resume()).toBeNull();
    expect(finaleClaimed()).toBe(false);
    // The live finale is untouched — the way back from home still works.
    expect(loadStoredFinale()).not.toBeNull();
  });

  it("✕ / Modes drop an archived claim exactly as they drop a live one", async () => {
    await playToFinale(7);
    claimFinale(loadArchive()[0].id);
    releaseFinale(); // goHome()
    expect(finaleClaimed()).toBe(false);
    expect(claimedArchiveId()).toBeNull();
    expect(resume()).toBeNull();
    // …and the season is still in the list it was opened from.
    expect(loadArchive()).toHaveLength(1);
  });

  it("a new game retires the archived claim with the live one", async () => {
    await playToFinale(7);
    claimFinale(loadArchive()[0].id);
    clearStoredFinale(); // startGame()
    expect(finaleClaimed()).toBe(false);
    expect(resume()).toBeNull();
    // The archive itself outlives the claim: the season is still reopenable.
    expect(loadArchive()).toHaveLength(1);
  });
});

/** The home screen's LAST GAME button renders disabled exactly when
 * `loadStoredFinale()` is null, so what this file already covers about the
 * archive's lifetime IS the button's enabled/disabled contract. The attribute
 * itself is asserted in home-under.dom.test.ts; these are the three situations
 * that drive it.
 *
 * The quit case is the load-bearing one. Quitting takes `hotstove.current` and
 * nothing else — but every route into a game runs `clearStoredFinale()` first
 * (App.startGame, whether from PLAY, PLAY A SEED, or the finale's Replay), and
 * `new Game(...)` is reachable from nowhere else in the app. So a game there is
 * anything to quit is a game with no archive standing behind it, and the button
 * is correctly dead afterwards. If that invariant ever breaks, quitting would
 * strand the player on a way back into some OLDER game's finale. */
describe("what LAST GAME has to go back to", () => {
  it("nothing, for a player who has never finished a game", () => {
    expect(loadStoredFinale()).toBeNull();
  });

  it("the game just finished, the moment it finishes", async () => {
    const g = await playToFinale();
    expect(loadStoredFinale()!.finale).toEqual(g.finale);
    // And still, after the player leaves the finale for the home screen.
    releaseFinale(); // goHome()
    expect(loadStoredFinale()).not.toBeNull();
  });

  it("nothing, after the last game was quit", async () => {
    // A finished game first, so the assertion cannot pass merely because the
    // store was empty all along: this proves the quit path leaves NO archive,
    // not even a stale one from before.
    await playToFinale();
    releaseFinale(); // goHome() off the finale
    expect(loadStoredFinale()).not.toBeNull();

    clearStoredFinale(); // startGame(): the new game retires the old finale
    const g = new Game(meta, index, owners, 5, {
      difficulty: "standard",
      bank: "moneyball",
    });
    g.phase = "landed";
    g.save();
    expect(store.has(SAVE_KEY)).toBe(true);

    Game.clearSave(); // tapQuit(), second tap
    releaseFinale(); // goHome()

    expect(store.has(SAVE_KEY)).toBe(false);
    expect(loadStoredFinale()).toBeNull();
    expect(store.has(FINALE_KEY)).toBe(false);
  });
});

describe("unreadable records", () => {
  it("reads corrupt JSON as no stored finale", () => {
    store.set(FINALE_KEY, "{not json at all");
    expect(loadStoredFinale()).toBeNull();
  });

  it("reads an unrecognized version as no stored finale", async () => {
    await playToFinale();
    const rec = JSON.parse(store.get(FINALE_KEY)!);
    store.set(FINALE_KEY, JSON.stringify({ ...rec, v: 99 }));
    expect(loadStoredFinale()).toBeNull();
    expect(Game.fromStoredFinale(meta, index, owners)).toBeNull();
  });

  it("reads a record missing what the screen dereferences as no stored finale", async () => {
    await playToFinale();
    const rec = JSON.parse(store.get(FINALE_KEY)!);
    for (const broken of [
      { ...rec, finale: null },
      { ...rec, finale: { ...rec.finale, parts: undefined } },
      { ...rec, slots: "not an array" },
    ]) {
      store.set(FINALE_KEY, JSON.stringify(broken));
      expect(loadStoredFinale()).toBeNull();
    }
  });

  it("drops a boot claim it cannot honour instead of throwing", async () => {
    await playToFinale();
    store.delete(FINALE_KEY); // claim survives, archive is gone
    expect(finaleClaimed()).toBe(true);
    expect(resume()).toBeNull();
    // The claim goes with it: a stale claim must never survive to strand a
    // later boot on a finale that cannot be rendered.
    expect(finaleClaimed()).toBe(false);
  });

  it("survives a history log it cannot read", async () => {
    store.set(HISTORY_KEY, "%%%");
    const g = await playToFinale();
    expect(g.finale).not.toBeNull();
    expect(loadStoredFinale()).not.toBeNull();
  });
});

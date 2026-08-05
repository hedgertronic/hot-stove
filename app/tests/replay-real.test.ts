/** The replay against the REAL card set, not a fixture.
 *
 * replay.test.ts pins the driver's rules on hand-built cards; this pins the
 * thing those rules exist for — that the CURRENT encoder and the CURRENT data
 * agree. The tokens are position indexes into `card.players` and
 * `index.cards`, so what a code means is a function of the shipped JSON: the
 * catcher additions that rebuilt the cards this session moved what `S 3 0`
 * points at. A shortcode minted before that rebuild is meant to fail the guard
 * (replay.test.ts covers that); a shortcode minted now against the same files
 * is meant to reproduce its season exactly, and only real data can say so.
 *
 * The games come off the bot harness — full seasons, real cards, every powerup
 * enabled — so the sample covers verbs a scripted fixture never reaches: ⭐
 * Prime Time career signings (P/V/Q), 🎟️ and 🚚 re-deals (T/R), cold respins
 * (C), Trade Deadline swaps (W), and the two toggles v2 added (D/H).
 */
import { describe, expect, it } from "vitest";
import { Game } from "../src/lib/engine.svelte";
import { replayShortcode } from "../src/lib/share";
import { ALL_POWERUPS, loadData, playGame, type BotConfig } from "./bots/harness";

const bot: BotConfig = {
  name: "replay-source",
  enabled: new Set(ALL_POWERUPS),
  overspend: false,
};

/** Seeds, not one seed: each plays a different shape of season, and the token
 * space is only covered in aggregate. Small enough to stay a unit test. */
const SEEDS = [1, 7, 12345, 987654];

const roster = (g: Game) =>
  g.slots.map((s) =>
    s === null ? null : { id: s.id, year: s.year, team: s.team, costPaid: s.costPaid, hero: s.hero },
  );

describe("a real season round-trips through its shortcode", () => {
  it.each(SEEDS)("seed %i replays to the same club and the same score", async (seed) => {
    const d = loadData();
    let played: Game | null = null;
    await playGame(seed, bot, d, { difficulty: "standard", bank: "classic" }, (g) => (played = g));
    const g = played as unknown as Game;
    expect(g.phase).toBe("finale");
    const code = g.debugLog();

    const back = await replayShortcode(d.meta, d.index, d.owners, code);
    expect(back).not.toBeNull();
    expect(roster(back!)).toEqual(roster(g));
    expect(back!.manager).toEqual(g.manager);
    expect(back!.owner).toEqual(g.owner);
    expect(back!.stadium).toEqual(g.stadium);
    // The two numbers the finale prints, and the payroll that produced them.
    expect(back!.finale!.parts.total).toBe(g.finale!.parts.total);
    expect(back!.finale!.wins).toBe(g.finale!.wins);
    expect(back!.finale!.spend).toBe(g.finale!.spend);
    // The reel itself: same cards, same order, same count.
    expect(back!.seen).toEqual(g.seen);
    expect(back!.spinCount).toBe(g.spinCount);
    // And the log the replay rebuilt is the log it was handed.
    expect(back!.debugLog()).toBe(code);
  }, 30_000);
});

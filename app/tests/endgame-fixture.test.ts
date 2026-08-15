/** The ?endgame review forge (src/lab/endgame.ts): a real-data club one
 * signing from complete, built for eyeballing the last-tap → landing
 * thunk → finale seam. This pins that the forge actually delivers that
 * state against the SHIPPED cards — seven seats + skipper filled through
 * the engine's own verbs, FLEX open with a signable row on the final card,
 * and the whole run inert (a dev screen must never write the player's
 * storage). */
import { describe, expect, it, vi } from "vitest";
import { landingPools } from "../src/lib/bestroster";
import { loadCard } from "../src/lib/data";
import { forgeEndgame } from "../src/lab/endgame";
import { loadData } from "./bots/harness";

describe("the ?endgame dev fixture", () => {
  it("forges a real-data club one signing from complete, and the last tap finishes it", async () => {
    const d = loadData(); // stubs fetch so loadCard serves the shipped cards
    const g = await forgeEndgame(d.meta, d.index, d.owners);

    expect(g.inert).toBe(true);
    expect(g.phase).toBe("landed");
    expect(g.choicesLeft).toBe(1);
    expect(g.slots.filter((s) => s !== null)).toHaveLength(7);
    expect(g.slots[4]).toBe(null); // FLEX is the seat left for the reviewer
    expect(g.manager).not.toBe(null);
    // Open Market: owner and ballpark are seats, and both are already bought —
    // so the solve this screen reviews is the full one, with the front office
    // in it (bestRoster's fixedBudgetM: null path).
    expect(g.owner).not.toBe(null);
    expect(g.stadium).not.toBe(null);
    expect(g.config.bank).toBe("classic");
    // The pause under review is the real one: a full season's worth of
    // landings for the dream solve to chew on.
    expect(g.seen.length).toBe(16);
    // Fewer spins than cards: two of the landings were re-dealt, which is what
    // makes this a six-pool solve — the shape nearly every real game finishes
    // in, and six times the work a plain-landing screen would show.
    expect(g.spinCount).toBe(13);
    expect(landingPools(await Promise.all(
      g.seen.map((s) => loadCard(s.team, s.year)),
    ), { landings: g.seen.map((s) => s.spin) })).toHaveLength(6);

    // The reviewer's tap: at least one open row on the final card, and
    // signing it completes the club and runs the whole finish for real.
    const p = g.card!.players.find((pl) => g.playerState(pl) === "open");
    expect(p).toBeTruthy();
    g.signPlayer(p!, 4);
    expect(g.slots[4]).not.toBe(null);
    expect(g.solving).toBe(true); // the dream solve's window is open
    await vi.waitFor(() => expect(g.phase).toBe("finale"));
    expect(g.solving).toBe(false);
    expect(g.finale?.best).not.toBe(null); // the dream solve really ran
  }, 30_000);
});

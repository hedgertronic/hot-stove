/** Dev-only (?endgame): a REAL-data Game forged to one signing from complete,
 * so the last-tap → TAKING THE FIELD → finale seam is reviewable on demand
 * without playing a full season.
 *
 * Unlike the lab's stub-data galleries this walks the live engine with the
 * shipped cards: seven seats are filled through `signPlayer` itself (so every
 * eligibility, price, and floor rule really held), the skipper through
 * `hireManager`, and `seen` carries real landings — the dream solve the
 * interstitial covers is therefore the real ~13-card solve, not a trivial
 * empty one. The FLEX seat is the one left open on purpose: every position
 * player fits it, so the final card is a free pick.
 *
 * Open Market (classic bank) on purpose, not a fixed-cap bank: the owner and
 * the ballpark are seats there, so the club carries a real cap AND the dream
 * solve runs its full form — the solver competes for owner and stadium cards
 * too (bestRoster's `fixedBudgetM: null` path). A moneyball forge would hand
 * the solver the cap and skip that whole branch, which is the expensive one
 * and the one the seam's timing has to survive.
 *
 * Inert exactly like a replay: this club must never write the player's
 * storage — no save, no history row, no archive, no finale claim. */
import { loadCard } from "../lib/data";
import { Game } from "../lib/engine.svelte";
import type { GameIndex, Meta, Owners } from "../lib/types";

/** How many landings `seen` should carry — the measured real-game solve size,
 * so the pause under review is the pause players actually get. */
const TARGET_LANDINGS = 13;

export async function forgeEndgame(
  meta: Meta,
  index: GameIndex,
  owners: Owners,
): Promise<Game> {
  const g = new Game(meta, index, owners, 424242, {
    difficulty: "standard",
    bank: "classic",
  });
  g.inert = true;

  // Walk the shipped card list in index order — deterministic, so the screen
  // forges the same club every visit and a regression is a diff, not a maybe.
  let cursor = 0;
  const land = async () => {
    const e = index.cards[cursor++];
    if (!e) throw new Error("endgame forge ran out of cards");
    return { e, card: await loadCard(e.team, e.year) };
  };
  const record = (e: { team: string; year: number }) =>
    g.seen.push({ team: e.team, year: e.year, spin: g.seen.length + 1 });

  // The owner first: on Open Market he IS the cap, so every price the seats
  // below pay is judged against a real budget rather than the league-minimum
  // floor `effectiveBudget` falls back to.
  {
    const { e, card } = await land();
    g.card = card;
    g.phase = "landed";
    g.choicesLeft = 1;
    g.hireOwner();
    record(e);
  }

  // The ballpark, the other Open Market seat: its multiplier scales the cap.
  {
    const { e, card } = await land();
    g.card = card;
    g.phase = "landed";
    g.choicesLeft = 1;
    g.buyStadium();
    record(e);
  }

  // Seven seats through the engine's own signing (FLEX, index 4, stays open).
  // Cheapest eligible player per seat, so the club walks into the final tap
  // with room under the owner's cap rather than deep in overrun tax.
  for (const slotIdx of [0, 1, 2, 3, 5, 6, 7]) {
    while (g.slots[slotIdx] === null) {
      const { e, card } = await land();
      g.card = card;
      g.phase = "landed";
      g.choicesLeft = 1;
      for (const p of [...card.players].sort((a, b) => a.cost - b.cost)) {
        g.signPlayer(p, slotIdx);
        if (g.slots[slotIdx] !== null) break;
      }
      if (g.slots[slotIdx] !== null) record(e);
    }
  }

  // The skipper, through the real hire — the last of the four seat kinds, so
  // after it only the open FLEX chair stands between this club and complete.
  while (g.manager === null) {
    const { e, card } = await land();
    if (card.manager == null) continue;
    g.card = card;
    g.phase = "landed";
    g.choicesLeft = 1;
    g.hireManager();
    if (g.manager !== null) record(e);
  }

  // Pad `seen` to a real season's landing count with passed spins (landed,
  // signed nothing) — the solve's cost scales with the cards it saw, and the
  // point of this screen is the real pause. Warm-loaded like play would have:
  // finishGame's own loads then hit the memo and cost nothing.
  while (g.seen.length < TARGET_LANDINGS - 1) {
    const { e, card } = await land();
    void card;
    record(e);
  }

  // The final landing, left for the reviewer: any open row completes the club.
  const { e, card } = await land();
  g.card = card;
  g.phase = "landed";
  g.choicesLeft = 1;
  record(e);
  g.spinCount = g.seen.length;
  return g;
}

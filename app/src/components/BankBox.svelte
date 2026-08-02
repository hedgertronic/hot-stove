<script lang="ts">
  /** The payroll box on the game board — the live club's front office.
   *
   * An ADAPTER, not an implementation: everything on screen here is drawn by
   * PayrollBox, and this file's whole job is to turn a `Game` into that
   * component's plain values. The two surfaces that show a payroll — this one
   * all game, the finale holding it still — have to be the same object, and
   * the only way two surfaces stay identical is if there is only one of them.
   *
   * The split falls where it does because PayrollBox renders clubs no `Game`
   * exists for: the solver's dream roster at the finale, and a finale restored
   * from storage. So the engine dependency lives up here, and the drawing lives
   * down there with no idea what a Game is.
   *
   * `pending` is always true on this surface. A game in progress is a club
   * being assembled, so an empty seat is a seat still to fill: it wears a ghost
   * chip and a "no owner yet" line rather than being left out. */
  import type { Game } from "../lib/engine.svelte";
  import { ownerFor } from "../lib/data";
  import PayrollBox, { FIXED_CAP_CLUB } from "./PayrollBox.svelte";

  let { game }: { game: Game } = $props();

  /** Fixed-cap modes hire nobody, so the hires line names the real owner of the
   * club whose payroll the mode borrows. PayrollBox owns WHICH club that is —
   * both surfaces have to name the same one — and only the lookup against
   * owners.json happens here, because that is the data this component holds and
   * that one deliberately does not load. */
  const fixedClub = $derived(FIXED_CAP_CLUB[game.config.bank]);
</script>

<div class="bankwrap">
  <PayrollBox
    bank={game.config.bank}
    budget={game.effectiveBudget}
    spend={game.spend}
    capKnown={game.capKnown}
    pending
    ownerName={game.owner?.name ??
      (fixedClub ? ownerFor(game.owners, fixedClub.team, fixedClub.year) : null)}
    ownerBudget={game.owner?.budget ?? null}
    parkName={game.stadium?.park ?? null}
    parkMult={game.stadium?.mult ?? null}
  />
</div>

<style>
  /* PayrollBox carries no outer margin — spacing belongs to whoever places it —
     and on the board it opens a sticky HUD column above the roster rail. */
  .bankwrap {
    margin-bottom: 12px;
  }
</style>

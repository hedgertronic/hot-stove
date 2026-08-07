<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import Sheet from "./Sheet.svelte";

  let { game, onclose }: { game: Game; onclose: () => void } = $props();

  const years = $derived(game.card ? game.yearsForFranchise(game.card.franchise) : []);
  // Box Score gets the franchise's October history on the grid; Eye Test
  // stays a bare list of years.
  const ped = $derived(
    game.card && game.showAwards
      ? game.yearPedigree(game.card.franchise)
      : ({} as Record<number, "ws" | "pen">),
  );

  function pick(y: number) {
    onclose();
    game.seasonTicket(y);
  }
</script>

<Sheet
  {onclose}
  label="Pick a season"
  title="🎟️ SEASON TICKET: {game.card?.name ?? ''}"
  confirmLabel="CANCEL"
>
  <div class="pickgrid">
    {#each years as y (y)}
      <button class="pickopt" disabled={y === game.card?.year} onclick={() => pick(y)}>
        <span class="chiplbl">{y}</span
        >{#if ped[y]}<span class="pedi">{ped[y] === "ws" ? "💍" : "🚩"}</span>{/if}
      </button>
    {/each}
  </div>
</Sheet>

<style>
  /* Header, ✕ and the CANCEL button all belong to Sheet — a picker is a thing
     you back out of, so its bottom button says CANCEL rather than CLOSE. The
     one grid carries no bottom margin either: Sheet's button supplies the gap.
     The grid itself, the tile and the pedigree glyph are app.css's `.pickgrid`
     / `.pickopt`, shared with the relocate sheet; a year needs no hue, so the
     tile keeps the neutral cardstock those already draw. */
  /* The tile IS app.css's `.pickopt` — box, height, label seat and the
     pedigree medal all live there, one rule for this sheet and the relocate
     sheet. Nothing left for this file to add. */
</style>

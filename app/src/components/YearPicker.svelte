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
  title="🎟️ SEASON TICKET — {game.card?.name ?? ''}"
  confirmLabel="CANCEL"
>
  <div class="grid">
    {#each years as y (y)}
      <button class="yearbtn" disabled={y === game.card?.year} onclick={() => pick(y)}>
        {y}{#if ped[y]}<span class="pedi">{ped[y] === "ws" ? "💍" : "🚩"}</span>{/if}
      </button>
    {/each}
  </div>
</Sheet>

<style>
  /* Header, ✕ and the CANCEL button all belong to Sheet — a picker is a thing
     you back out of, so its bottom button says CANCEL rather than CLOSE. The
     grid carries no bottom margin: Sheet's button supplies the gap. */
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 7px;
  }
  .yearbtn {
    border: 2px solid var(--ink);
    border-radius: 9px;
    background: var(--card);
    font-family: inherit;
    font-weight: 800;
    font-size: 13px;
    padding: 9px 0;
    cursor: pointer;
    transition: transform 0.08s;
  }
  /* October pedigree sits inline right after the year, small enough that
     the year stays the dominant glyph. */
  .pedi {
    margin-left: 3px;
    /* Emoji render below their nominal size — 11px sits balanced with the
       13px year. */
    font-size: 11px;
    line-height: 1;
  }
  .yearbtn:active {
    transform: translateY(1.5px);
  }
  .yearbtn:disabled {
    opacity: 0.32;
    cursor: default;
  }
</style>

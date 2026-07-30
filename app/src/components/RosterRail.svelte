<script lang="ts">
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, yy } from "../lib/format";
  import type { CardPlayer } from "../lib/types";

  let { game }: { game: Game } = $props();

  const pickPlayer = $derived.by((): CardPlayer | null => {
    const id = game.slotPick ?? game.releasePick;
    if (!id || !game.card) return null;
    return game.card.players.find((p) => p.id === id) ?? null;
  });

  const pickableCells = $derived.by((): Set<number> => {
    if (!pickPlayer) return new Set();
    return new Set(
      game.slotPick
        ? game.pickableSlotCells(pickPlayer)
        : game.occupiedSlotsFor(pickPlayer),
    );
  });

  function tapCell(i: number) {
    if (!pickPlayer || !pickableCells.has(i)) return;
    if (game.slotPick) game.signPlayer(pickPlayer, i);
    else game.tdRelease(pickPlayer, i);
  }
</script>

<div class="railwrap disp">
  <div class="rail">
    {#each game.slots as slot, i}
      {#if pickableCells.has(i)}
        <button class="cell pickable" onclick={() => tapCell(i)}>
          <b>{SLOT_TYPES[i]}</b>
          {#if slot}<span>{lastName(slot.name)}</span><i>{yy(slot.year)}</i>{:else}<span>—</span>{/if}
        </button>
      {:else if slot}
        <div class="cell filled">
          <b>{SLOT_TYPES[i]}</b><span>{lastName(slot.name)}</span><i>{yy(slot.year)}</i>
        </div>
      {:else}
        <div class="cell empty"><b>{SLOT_TYPES[i]}</b><span>—</span></div>
      {/if}
    {/each}
  </div>
  {#if pickPlayer}
    <div class="railhint">
      {#if game.slotPick}
        TAP A SLOT FOR {lastName(pickPlayer.name).toUpperCase()}
      {:else}
        🔁 TAP A PLAYER TO RELEASE FOR {lastName(pickPlayer.name).toUpperCase()}
      {/if}
    </div>
  {/if}
  {#if game.skipper}
    <div class="mgrline"><span class="mgrchip">🧢 {lastName(game.skipper.name)} {yy(game.skipper.year)}</span></div>
  {/if}
</div>

<style>
  .railwrap {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--ground);
    padding: 6px 0 4px;
    margin-bottom: 4px;
  }
  .rail {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .cell {
    border: 2px solid var(--ink);
    border-radius: 9px;
    background: var(--card);
    text-align: center;
    padding: 5px 2px 6px;
    font-size: 10px;
    line-height: 1.25;
    min-height: 52px;
    font-family: inherit;
    color: inherit;
    display: block;
    width: 100%;
  }
  .cell b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    color: var(--muted);
  }
  .cell span {
    display: block;
    font-weight: 800;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cell i {
    display: block;
    font-style: normal;
    font-size: 9px;
    color: var(--muted);
    font-weight: 700;
  }
  .cell.filled {
    background: var(--green-wash);
  }
  .cell.empty {
    border-style: dashed;
    background: transparent;
    color: var(--gray-ink);
  }
  .cell.pickable {
    background: var(--amber);
    border-style: dashed;
    cursor: pointer;
    animation: nudge 1s ease-in-out infinite;
  }
  @keyframes nudge {
    50% {
      transform: translateY(-2px);
    }
  }
  .railhint {
    text-align: center;
    font-size: 10.5px;
    font-weight: 800;
    color: var(--orange);
    margin-top: 5px;
  }
  .mgrline {
    text-align: center;
    margin-top: 6px;
  }
  .mgrchip {
    display: inline-block;
    background: var(--pink);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 2px 12px;
    font-weight: 800;
    font-size: 11.5px;
  }
</style>

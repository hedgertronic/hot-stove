<script lang="ts">
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, slotLabel } from "../lib/format";
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
      game.slotPick ? game.pickableSlotCells(pickPlayer) : game.occupiedSlotsFor(pickPlayer),
    );
  });

  function tapCell(i: number) {
    if (!pickPlayer || !pickableCells.has(i)) return;
    if (game.slotPick) game.signPlayer(pickPlayer, i);
    else game.tdRelease(pickPlayer, i);
  }

  /** Seat sub-line: season identity only ("2013 OAK") — the rail is the
   * roster's who/when, not a stat sheet; WAR lives on the list rows. */
  function seatMeta(s: { year: number; team: string }): string {
    return `${s.year} ${s.team}`;
  }
</script>

<div class="railwrap disp" class:pinned={!!pickPlayer}>
  <div class="rail">
    <!-- The manager's seat anchors the left edge, spanning both rows — one
         club, nine chairs, same visual language throughout. -->
    {#if game.manager}
      <div class="mgr filled">
        <b>MGR</b>
        <span>{lastName(game.manager.name)}</span>
        <i>{game.manager.year} {game.manager.team}</i>
      </div>
    {:else}
      <div class="mgr empty"><b>MGR</b></div>
    {/if}
    {#each game.slots as slot, i}
      {#if pickableCells.has(i)}
        <button class="cell pickable" class:vacant={!slot} onclick={() => tapCell(i)}>
          <b>{slotLabel(SLOT_TYPES[i])}</b>
          {#if slot}<span>{lastName(slot.name)}</span><i>{seatMeta(slot)}</i>{/if}
        </button>
      {:else if slot}
        <div class="cell filled">
          <b>{slotLabel(SLOT_TYPES[i])}</b><span>{lastName(slot.name)}</span><i>{seatMeta(slot)}</i>
        </div>
      {:else}
        <div class="cell empty"><b>{slotLabel(SLOT_TYPES[i])}</b></div>
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
</div>

<style>
  /* The rail doubles as the slot/release picker, so it pins to the top only
     while a pick is in flight; otherwise it scrolls away with the page. */
  .railwrap {
    background: var(--ground);
    padding: 6px 0 4px;
    margin-bottom: 4px;
  }
  .railwrap.pinned {
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .rail {
    display: grid;
    grid-template-columns: auto repeat(4, 1fr);
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
    font-size: 8.5px;
    color: var(--muted);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cell.filled {
    background: var(--green-wash);
  }
  /* An empty seat is an invitation: just the position, centered, waiting. */
  .cell.empty {
    border-style: dashed;
    background: transparent;
    color: var(--gray-ink);
    display: grid;
    place-content: center;
  }
  .cell.empty b {
    font-size: 11px;
    color: var(--gray-ink);
  }
  .cell.pickable {
    background: var(--amber);
    border-style: dashed;
    cursor: pointer;
    animation: nudge 1s ease-in-out infinite;
  }
  .cell.pickable.vacant {
    display: grid;
    place-content: center;
  }
  @keyframes nudge {
    50% {
      transform: translateY(-2px);
    }
  }
  /* The manager reads bottom-to-top up the left rail (y-axis-label style,
     glyphs facing the grid) — three parallel lines, label outermost, same
     content pattern and type scale as the player seats. The width is fixed
     at the filled three-line stack (11.7 + 14.3 + 11.05 line boxes + 10px
     padding + 4px border ≈ 52px) so the grid doesn't reflow when the empty
     seat gains its name/season lines on hire. */
  .mgr {
    grid-column: 1;
    grid-row: 1 / 3;
    width: 52px;
    border: 2px solid var(--ink);
    border-radius: 9px;
    writing-mode: sideways-lr;
    text-align: center;
    padding: 4px 5px;
    line-height: 1.3;
    overflow: hidden;
  }
  .mgr b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    color: var(--muted);
  }
  .mgr span {
    display: block;
    font-weight: 800;
    font-size: 11px;
    max-height: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mgr i {
    display: block;
    font-style: normal;
    font-size: 8.5px;
    color: var(--muted);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 100%;
  }
  .mgr.filled {
    background: var(--green-wash);
  }
  .mgr.empty {
    border-style: dashed;
    background: transparent;
    color: var(--gray-ink);
    display: grid;
    place-content: center;
  }
  .mgr.empty b {
    font-size: 11px;
    color: var(--gray-ink);
  }
  .railhint {
    text-align: center;
    font-size: 10.5px;
    font-weight: 800;
    color: var(--orange);
    margin-top: 5px;
  }
</style>

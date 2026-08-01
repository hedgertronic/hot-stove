<script lang="ts">
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, signed, slotLabel, warTier } from "../lib/format";
  import { MANAGER_PER_NET_WIN } from "../lib/scoring";
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

  // Phone: while a pick is in flight the rail leaves the flow and pins to the
  // viewport (see the .pinned rule), so a spacer holds the column's height and
  // the bank box below it doesn't jump up under the player's finger mid-tap.
  // The resting height is the honest one — measured while the rail is still in
  // flow — with the live measurement as the cold-start fallback.
  let railH = $state(0);
  let restH = $state(0);
  $effect(() => {
    if (!pickPlayer) restH = railH;
  });
  const gapH = $derived(pickPlayer ? restH || railH : 0);

  /** Seat sub-line: season identity only ("2013 OAK") — the rail is the
   * roster's who/when, not a stat sheet; WAR lives on the list rows. */
  function seatMeta(s: { year: number; team: string }): string {
    return `${s.year} ${s.team}`;
  }

  /** Tier band class for a filled seat, or "" when the mode hides WAR. Gated
   * on `showWar` — the very flag that gates the numeral — because a color
   * that encodes the WAR bucket leaks the talent read just as surely as the
   * digits do, and Eye Test's whole premise is that it can't be read. */
  function tierClass(s: { war: number } | null): string {
    return s && game.showWar ? `war-${warTier(s.war)}` : "";
  }
</script>

<div class="railwrap disp" class:pinned={!!pickPlayer} bind:clientHeight={railH}>
  <div class="psep railhead">YOUR SQUAD</div>
  <div class="rail">
    <!-- The manager's seat anchors the left edge, spanning both rows — one
         club, nine chairs, same visual language throughout. -->
    {#if game.manager}
      <div class="mgr filled">
        <b>MGR</b>
        <span>{lastName(game.manager.name)}</span>
        <i>{game.manager.year} {game.manager.team}</i>
        {#if !game.scout}<em class="rwar mgw"
            >{signed((game.manager.wins - game.manager.losses) * MANAGER_PER_NET_WIN)} W</em
          >{/if}
      </div>
    {:else}
      <div class="mgr empty"><b>MGR</b></div>
    {/if}
    {#each game.slots as slot, i}
      {#if pickableCells.has(i)}
        <button
          class="cell pickable {tierClass(slot)}"
          class:vacant={!slot}
          onclick={() => tapCell(i)}
        >
          <b>{slotLabel(SLOT_TYPES[i])}</b>
          {#if slot}<span>{lastName(slot.name)}</span><i>{seatMeta(slot)}</i>
            {#if game.showWar}<em class="rwar {warTier(slot.war)}">{slot.war.toFixed(1)}</em>{/if}
          {/if}
        </button>
      {:else if slot}
        <div class="cell filled {tierClass(slot)}">
          <b>{slotLabel(SLOT_TYPES[i])}</b><span>{lastName(slot.name)}</span><i>{seatMeta(slot)}</i>
          {#if game.showWar}<em class="rwar {warTier(slot.war)}">{slot.war.toFixed(1)}</em>{/if}
        </div>
      {:else}
        <div class="cell empty"><b>{slotLabel(SLOT_TYPES[i])}</b></div>
      {/if}
    {/each}
  </div>
  <!-- No hint line during picks: the row's orange pending pill plus the lit
       nudging cells are the cues — one cue per state, no redundant copy. -->
</div>
<!-- Placeholder for the pinned rail's vacated flow height (phone only). -->
{#if gapH}<div class="railgap" style="height:{gapH}px"></div>{/if}

<style>
  /* The rail doubles as the slot/release picker, so it pins to the top only
     while a pick is in flight; otherwise it scrolls away with the page. */
  .railwrap {
    background: var(--ground);
    padding: 6px 0 4px;
    margin-bottom: 4px;
  }
  /* The section header exists only at width, where the rail reads as the
     finale-style squad card; the phone grid speaks for itself. */
  .railhead {
    display: none;
  }
  /* Phone pin: `fixed`, not `sticky`. A sticky box can only travel inside its
     parent's box, and the rail's parent is the short club column (rail + bank
     box) — sticking would end a few dozen pixels down the page, exactly where
     the player list the user is scrolling begins. Fixed answers to the
     viewport instead, so the release picker stays reachable for the whole
     scroll. Full-bleed with the shell's own 14px gutter re-applied (the
     document flow supplied it before), capped and centered to the shell width.
     z-index 10 keeps it over the list and under the sheets (z 50). */
  .railwrap.pinned {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    max-width: 480px;
    margin: 0 auto 4px;
    padding: calc(6px + env(safe-area-inset-top)) 14px 4px;
  }
  .railgap {
    margin-bottom: 4px;
  }
  /* Wide: the whole left column is persistently on screen (it sticks as a
     unit), so the phone's pick-time pin has nothing to do — the rail stays in
     flow and its spacer collapses. */
  @media (min-width: 760px) {
    .railwrap.pinned {
      position: static;
      max-width: none;
      margin: 0 0 4px;
      padding: 6px 0 4px;
    }
    .railgap {
      display: none;
    }
  }
  .rail {
    display: grid;
    grid-template-columns: auto repeat(4, 1fr);
    gap: 6px;
  }
  /* Flex centering: the type stack is shorter than the 52px seat, and a block
     container would park it at the top — the leftover space belongs half
     above, half below. */
  .cell {
    border: 2.5px solid var(--ink);
    border-radius: 9px;
    background: var(--card);
    text-align: center;
    padding: 5px 2px;
    font-size: 10px;
    line-height: 1.25;
    min-height: 52px;
    font-family: inherit;
    color: inherit;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
  }
  /* The WAR numeral lives on the finale-style wide rows only; the sideways
     phone seat has no room for it, and the phone grid reads as a who/when
     card. No hardware anywhere in the rail — the seats carry name and season,
     nothing else, and the manager's MOY pill waits for the finale. */
  .rwar {
    display: none;
  }
  /* Phone tier band: with the numeral gone, each filled seat wears its WAR
     bucket as a color band along its bottom edge. An inset band rather than a
     background wash because the release picker needs the seat to say
     "tappable" (amber) and "5.2-WAR guy" at the same time, and a wash can only
     say one; inset also means it rides inside the ink border and costs no
     layout — it's a band, not a drop shadow. Redundant by design: the numeral
     itself returns at width and the name identifies the pick, so no decision
     rests on hue alone. */
  .cell.war-neg {
    box-shadow: inset 0 -4px 0 var(--war-neg);
  }
  .cell.war-low {
    box-shadow: inset 0 -4px 0 var(--war-low);
  }
  .cell.war-mid {
    box-shadow: inset 0 -4px 0 var(--war-mid);
  }
  .cell.war-high {
    box-shadow: inset 0 -4px 0 var(--war-high);
  }
  .cell.war-star {
    box-shadow: inset 0 -4px 0 var(--war-star);
  }
  .cell.war-elite {
    box-shadow: inset 0 -4px 0 var(--war-elite);
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
  /* Filled seats stay plain card-white, like the finale's squad rows — green
     is reserved for the finale's dream-team hits. */
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
     so the grid doesn't reflow when the empty seat gains its name/season
     lines on hire; it equals the seat cells' min-height, a geometric match
     between the rotated chair and the upright ones. */
  .mgr {
    grid-column: 1;
    grid-row: 1 / 3;
    width: 52px;
    border: 2.5px solid var(--ink);
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
  /* The hired manager is pink, matching the finale's MGR row. */
  .mgr.filled {
    background: var(--pink);
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
  /* Wide: the rail owns a 350–380px column, so the club reads as the finale's
     squad card — one full-width row per seat (pos · name · season · WAR),
     manager last. Same buttons, same pick states; only the geometry changes. */
  @media (min-width: 760px) {
    .railhead {
      display: flex;
    }
    .rail {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .cell,
    .mgr {
      writing-mode: horizontal-tb;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      text-align: left;
      width: 100%;
      min-height: 36px;
      padding: 6px 10px;
      line-height: 1.25;
      overflow: hidden;
    }
    .mgr {
      order: 1;
    }
    .cell b,
    .mgr b {
      width: 34px;
      flex: none;
      font-size: 9.5px;
    }
    .cell span,
    .mgr span {
      font-size: 13px;
      flex: 0 1 auto;
      min-width: 0;
    }
    .cell i,
    .mgr i {
      font-size: 11px;
      flex: 0 1 auto;
      min-width: 0;
    }
    .cell.empty,
    .cell.pickable.vacant,
    .mgr.empty {
      display: flex;
      place-content: unset;
    }
    .cell.empty b,
    .mgr.empty b {
      font-size: 9.5px;
      color: var(--gray-ink);
      width: 34px;
    }
    /* The number itself carries the tier here, so the band stands down. The
       full class list is repeated because a media query adds no specificity —
       a bare `.cell` would lose to `.cell.war-high` at every width. */
    .cell.war-neg,
    .cell.war-low,
    .cell.war-mid,
    .cell.war-high,
    .cell.war-star,
    .cell.war-elite {
      box-shadow: none;
    }
    .rwar {
      display: block;
      margin-left: auto;
      flex: none;
      font-style: normal;
      font-weight: 800;
      font-size: 13px;
    }
    .rwar.neg {
      color: var(--war-neg);
    }
    .rwar.low {
      color: var(--gray-ink);
    }
    .rwar.mid {
      color: var(--war-mid);
    }
    .rwar.high {
      color: var(--war-high);
    }
    .rwar.star {
      color: var(--war-star);
    }
    .rwar.elite {
      color: var(--war-elite);
    }
    /* Manager net wins aren't a WAR tier — plain green, like the finale. */
    .rwar.mgw {
      color: var(--green);
    }
  }
</style>

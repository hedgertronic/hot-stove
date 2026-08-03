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

  /** Tier class for a filled seat, or "" when the mode hides WAR. Gated on
   * `showWar` — the very flag that gates the numeral — because a color that
   * encodes the WAR bucket leaks the talent read just as surely as the digits
   * do, and Eye Test's whole premise is that it can't be read. */
  function tierClass(s: { war: number } | null): string {
    return s && game.showWar ? `war-${warTier(s.war)}` : "";
  }

  /** The skipper's net-win contribution rides the SAME six-rung ladder as a
   * player's WAR, which is what the share string has always printed — the
   * manager cell is 🟥⬜🟩🟦🟪🟨, the player circles' own hues. The app used to
   * draw him in flat green regardless, so a 116-win skipper and a .500 one
   * were the same color on screen while the string called one of them elite.
   * Gated on `showWar`, not `!scout`: same value today, but one flag now
   * governs every tier signal in the rail. The `war-` prefix is deliberate —
   * tests/rail-tiers.test.ts asserts Eye Test emits no `war-` token at all,
   * and a private `mgw-*` prefix would walk out from under that. */
  const mgrWins = $derived(
    game.manager ? (game.manager.wins - game.manager.losses) * MANAGER_PER_NET_WIN : 0,
  );
  const mgrTier = $derived(game.manager && game.showWar ? `war-${warTier(mgrWins)}` : "");
</script>

<div class="railwrap disp" class:pinned={!!pickPlayer} bind:clientHeight={railH}>
  <div class="psep railhead">YOUR SQUAD</div>
  <div class="rail">
    <!-- The manager's seat anchors the left edge, spanning both rows — one
         club, nine chairs, same visual language throughout. -->
    {#if game.manager}
      <div class="mgr filled {mgrTier}">
        <b>MGR</b>
        <span>{lastName(game.manager.name)}</span>
        <i>{game.manager.year} {game.manager.team}</i>
        {#if game.showWar}<em class="rwar mgw {warTier(mgrWins)}">{signed(mgrWins)} W</em>{/if}
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
  /* Every seat wears its WAR bucket on its BORDER — the channel the tinting
     rule opens up, and the one that costs nothing here. Three things have to
     hold at once and this is the only arrangement that gets all three:

       * A PLAYER seat's FILL stays free. Those eight cells spend their fill on
         state: card-white at rest, amber when the release picker has armed
         them. A tinted fill takes that away — an armed 5.2-WAR seat could then
         say "tappable" or "5.2-WAR guy" but not both. The border says the tier,
         the fill says the state, and neither has to give anything up. (The
         manager's chair has no armed state, which is what frees ITS fill for
         the tier as well; see .mgr.filled below.)
       * The DASH survives. Dashed still means armed-or-empty at every hue,
         because the dash and the color are different properties of the same
         line: a tappable elite seat is a dashed gold rectangle, an empty seat
         is a dashed ink one.
       * ONE IDEA AT BOTH WIDTHS. The bottom band this replaces only existed on
         the phone, where the numeral doesn't fit, and stood down at ≥760px
         where the numeral takes over — so the phone said "tier" with a band
         and the desktop said it with a number. The border is present at both
         widths, and at ≥760px the numeral joins it in the same hue.

     Everything below the border is unchanged: the name identifies the pick and
     the numeral returns at width, so no decision rests on hue alone. */
  .cell.war-neg,
  .mgr.war-neg {
    border-color: var(--war-neg);
  }
  .cell.war-low,
  .mgr.war-low {
    border-color: var(--war-low);
  }
  .cell.war-mid,
  .mgr.war-mid {
    border-color: var(--war-mid);
  }
  .cell.war-high,
  .mgr.war-high {
    border-color: var(--war-high);
  }
  .cell.war-star,
  .mgr.war-star {
    border-color: var(--war-star);
  }
  .cell.war-elite,
  .mgr.war-elite {
    border-color: var(--war-elite);
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
  /* The sub-lines run one rung darker than the player seats' do. Those sit on
     card white, a single known ground; these sit on whichever of six washes the
     skipper's rung supplies, and violet-2 is the darkest of them — --muted
     measures 3.39:1 there against 4.37:1 for --muted-2, on 8.5–9px type. One
     token, chosen for the worst rung, so the label reads the same on all six. */
  .mgr b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    color: var(--muted-2);
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
    color: var(--muted-2);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 100%;
  }
  /* The hired skipper's chair is the one seat in the rail whose FILL is free,
     and it spends that freedom on the same rung its frame already draws. Fill
     and frame are then the tinting rule's own pair — the hue at rung 2 inside
     the hue at rung 8 — which is the object the game has been teaching since
     the first WAR chip. A +14.0 W skipper is a gold seat rather than a pink
     seat with a gold hairline you have to hunt for at 2.61:1.
     WHY THIS SEAT AND NOT THE EIGHT BESIDE IT. A player cell can be armed by
     the release picker and turns amber to say so, so its fill is a state
     channel and cannot also be a value channel. The manager's chair is never a
     pick target — hiring happens in the FRONT OFFICE row, not here — so it has
     no state to announce and the fill is idle. Identity does not need the fill
     either: the chair is the only sideways cell in the grid, it spans both
     rows, it holds column one, and it says MGR.
     WHAT EYE TEST SEES. The rule below is the fallback, and it is the honest
     one: with no rung to draw the seat is card-white, exactly like the eight
     filled player seats. The tier classes are gated on `showWar` upstream, so
     the wash cannot leak a read the mode hides — the same gate the border and
     the numeral answer to, now with a third thing riding on it. */
  .mgr.filled {
    background: var(--card);
  }
  /* Placed after .mgr.filled deliberately: both selectors weigh the same, so
     source order is what lets a rung paint over the card-white fallback. The
     BORDER half of each rung lives up with the player seats' — the line
     register is shared by every chair, and only the wash is the manager's. */
  .mgr.filled.war-neg {
    background: var(--war-neg-fill);
  }
  .mgr.filled.war-low {
    background: var(--war-low-fill);
  }
  .mgr.filled.war-mid {
    background: var(--war-mid-fill);
  }
  .mgr.filled.war-high {
    background: var(--war-high-fill);
  }
  .mgr.filled.war-star {
    background: var(--war-star-fill);
  }
  .mgr.filled.war-elite {
    background: var(--war-elite-fill);
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
    /* Nothing stands down here any more. The tier border is the same idea at
       both widths; the numeral joins it, in the same hue, because there is
       room for it. */
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
      color: var(--war-low);
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
    /* There is no .rwar.mgw rule, and its absence is load-bearing. The manager
       used to be pinned to flat --green here, which has the same specificity
       as .rwar.elite and sits later in the file, so it would silently win and
       the tiering above would do nothing. The `mgw` class stays on the element
       as a hook for a future manager-only rule; the rule itself is gone.
       (Note --war-mid IS --green, so a .500 skipper renders exactly as before.) */
  }
</style>

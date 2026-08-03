<script lang="ts">
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, signed, slotLabel, warTier } from "../lib/format";
  import { MANAGER_PER_NET_WIN } from "../lib/scoring";
  import type { CardPlayer } from "../lib/types";
  import RailSeat from "./RailSeat.svelte";

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

  /** A filled seat's rung as a bare word, or "" when the mode hides WAR.
   * `RailSeat` dresses both the frame and the numeral from this one value.
   * Gated on `showWar` — the very flag that gates the numeral — because a color
   * that encodes the WAR bucket leaks the talent read just as surely as the
   * digits do, and Eye Test's whole premise is that it can't be read. */
  function tierOf(s: { war: number } | null): string {
    return s && game.showWar ? warTier(s.war) : "";
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
  const mgrTier = $derived(game.manager && game.showWar ? warTier(mgrWins) : "");
</script>

<div class="railwrap disp" class:pinned={!!pickPlayer} bind:clientHeight={railH}>
  <div class="psep railhead">YOUR SQUAD</div>
  <div class="rail">
    <!-- The manager's seat anchors the left edge, spanning both rows — one
         club, nine chairs, same visual language throughout. -->
    <RailSeat
      chair="mgr"
      label="MGR"
      name={game.manager ? lastName(game.manager.name) : null}
      meta={game.manager ? `${game.manager.year} ${game.manager.team}` : null}
      tier={mgrTier}
      war={game.manager && game.showWar ? `${signed(mgrWins)} W` : null}
      mgw
    />
    {#each game.slots as slot, i}
      <RailSeat
        label={slotLabel(SLOT_TYPES[i])}
        name={slot ? lastName(slot.name) : null}
        meta={slot ? seatMeta(slot) : null}
        tier={tierOf(slot)}
        war={slot && game.showWar ? slot.war.toFixed(1) : null}
        pickable={pickableCells.has(i)}
        onclick={() => tapCell(i)}
      />
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
  /* Wide: the rail owns a 350–380px column, so the club reads as the finale's
     squad card — one full-width row per seat, manager last. Only the
     ARRANGEMENT is here; the seat's own wide geometry is RailSeat's, keyed to
     the same 760px because it is the same re-layout of the same page. */
  @media (min-width: 760px) {
    .railhead {
      display: flex;
    }
    .rail {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
  }
</style>

<script lang="ts">
  import BankBox from "./components/BankBox.svelte";
  import Finale from "./components/Finale.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import PowerupRow from "./components/PowerupRow.svelte";
  import RosterRail from "./components/RosterRail.svelte";
  import SpecialRows from "./components/SpecialRows.svelte";
  import SpinBanner from "./components/SpinBanner.svelte";
  import YearPicker from "./components/YearPicker.svelte";
  import { loadColors, loadIndex, loadMeta, loadOwners } from "./lib/data";
  import { Game } from "./lib/engine.svelte";
  import type { Colors, GameIndex, Meta, Owners } from "./lib/types";

  let game = $state<Game | null>(null);
  let colors = $state<Colors | null>(null);
  let bootError = $state("");
  let deps: { meta: Meta; index: GameIndex; owners: Owners } | null = null;

  let confirmKey = $state<string | null>(null);
  let yearPickerOpen = $state(false);

  $effect(() => {
    void (async () => {
      try {
        const [meta, index, owners, cols] = await Promise.all([
          loadMeta(),
          loadIndex(),
          loadOwners(),
          loadColors(),
        ]);
        deps = { meta, index, owners };
        colors = cols;
        game = (await Game.restore(meta, index, owners)) ?? new Game(meta, index, owners);
      } catch (e) {
        bootError = String(e);
      }
    })();
  });

  function newGame() {
    if (!deps) return;
    confirmKey = null;
    yearPickerOpen = false;
    game = new Game(deps.meta, deps.index, deps.owners);
  }

  // A committed choice, a new card, or leaving the landed phase clears any
  // half-open confirm button.
  $effect(() => {
    void game?.card;
    void game?.choicesUsed;
    void game?.phase;
    confirmKey = null;
  });

  // Each new card (and the finale) presents from the top — after a deep scroll
  // through a player list, the next spin must not start mid-page.
  $effect(() => {
    const phase = game?.phase;
    if (phase === "spinning" || phase === "finale") window.scrollTo({ top: 0 });
  });
</script>

<svelte:window onclick={() => (confirmKey = null)} />

{#if bootError}
  <div class="boot disp">Couldn't load the league. {bootError}</div>
{:else if !game || !colors}
  <div class="boot disp">Warming up the stove…</div>
{:else}
  <header class="hud disp"><span class="logo">HOT<em>STOVE</em></span></header>

  {#if game.phase === "finale" && game.finale}
    <Finale {game} onreplay={newGame} />
  {:else}
    <RosterRail {game} />
    <BankBox {game} />
    <SpinBanner {game} {colors} />

    {#if game.phase === "landed" && game.card && !game.coldStove}
      <PowerupRow {game} onSeasonTicket={() => (yearPickerOpen = true)} />
      {#key game.card}
        <div class="after">
          <div class="psep">FRONT OFFICE</div>
          <SpecialRows {game} {confirmKey} setConfirm={(k) => (confirmKey = k)} />
          <div class="psep">PLAYERS</div>
          <PlayerList {game} {confirmKey} setConfirm={(k) => (confirmKey = k)} />
        </div>
      {/key}
    {/if}
  {/if}

  {#if yearPickerOpen}
    <YearPicker {game} onclose={() => (yearPickerOpen = false)} />
  {/if}
{/if}

<style>
  .boot {
    text-align: center;
    color: var(--muted);
    padding: 40vh 0;
    font-weight: 700;
  }
  .hud {
    display: flex;
    justify-content: center;
    margin-bottom: 10px;
  }
  .logo {
    font-weight: 800;
    font-size: 15px;
  }
  .logo em {
    font-style: normal;
    color: var(--orange);
  }
  .after > :global(*) {
    animation: fadeup 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  .after > :global(:nth-child(2)) {
    animation-delay: 0.08s;
  }
  .after > :global(:nth-child(3)) {
    animation-delay: 0.16s;
  }
  .after > :global(:nth-child(4)) {
    animation-delay: 0.24s;
  }
  @keyframes fadeup {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
</style>

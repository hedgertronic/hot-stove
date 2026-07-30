<script lang="ts">
  import BankBox from "./components/BankBox.svelte";
  import Finale from "./components/Finale.svelte";
  import Home from "./components/Home.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import PowerupRow from "./components/PowerupRow.svelte";
  import PrimePicker from "./components/PrimePicker.svelte";
  import RosterRail from "./components/RosterRail.svelte";
  import SpecialRows from "./components/SpecialRows.svelte";
  import SpinBanner from "./components/SpinBanner.svelte";
  import TeamPicker from "./components/TeamPicker.svelte";
  import YearPicker from "./components/YearPicker.svelte";
  import { loadColors, loadIndex, loadMeta, loadOwners } from "./lib/data";
  import { Game, type GameConfig } from "./lib/engine.svelte";
  import { loadSettings, saveSettings } from "./lib/settings";
  import type { Colors, GameIndex, Meta, Owners } from "./lib/types";

  let screen = $state<"home" | "game">("home");
  let game = $state<Game | null>(null);
  let colors = $state<Colors | null>(null);
  let booted = $state(false);
  let bootError = $state("");
  let deps: { meta: Meta; index: GameIndex; owners: Owners } | null = null;
  let settings = $state(loadSettings());

  let confirmKey = $state<string | null>(null);
  let yearPickerOpen = $state(false);
  let teamPickerOpen = $state(false);
  let quitArmed = $state(false);
  let quitTimer: ReturnType<typeof setTimeout> | undefined;

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
        // A mid-game save resumes straight into the game (iOS tab eviction);
        // otherwise land on the mode-select home screen.
        const saved = await Game.restore(meta, index, owners);
        if (saved) {
          game = saved;
          screen = "game";
        }
        booted = true;
      } catch (e) {
        bootError = String(e);
      }
    })();
  });

  function startGame(config: GameConfig) {
    if (!deps) return;
    settings = config;
    saveSettings(config);
    confirmKey = null;
    yearPickerOpen = false;
    teamPickerOpen = false;
    game = new Game(deps.meta, deps.index, deps.owners, undefined, config);
    screen = "game";
  }

  /** Replay from the finale keeps the same mode. */
  function newGame() {
    if (!deps || !game) return;
    startGame(game.config);
  }

  function goHome() {
    confirmKey = null;
    yearPickerOpen = false;
    teamPickerOpen = false;
    quitArmed = false;
    game = null;
    screen = "home";
  }

  /** Two-tap quit: abandons the run AND its save, back to the mode screen. */
  function tapQuit(e: MouseEvent) {
    e.stopPropagation();
    clearTimeout(quitTimer);
    if (quitArmed) {
      Game.clearSave();
      goHome();
      return;
    }
    quitArmed = true;
    quitTimer = setTimeout(() => (quitArmed = false), 2500);
  }

  const MODE_CHIP: Record<string, string> = {
    scout: "🔭 SCOUT",
  };
  const BANK_CHIP: Record<string, string> = {
    moneyball: "⚾ MONEYBALL",
    blankcheck: "💸 BLANK CHECK",
  };

  const modeChip = $derived.by(() => {
    if (!game) return "";
    return [BANK_CHIP[game.config.bank] ?? "", MODE_CHIP[game.config.difficulty] ?? ""]
      .filter(Boolean)
      .join(" · ");
  });

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
{:else if !booted || !colors}
  <div class="boot disp">Warming up the stove…</div>
{:else if screen === "home" || !game}
  <Home config={settings} onplay={startGame} />
{:else}
  <header class="hud disp">
    <span class="logo">HOT<em>STOVE</em></span>
    {#if modeChip}<span class="modechip">{modeChip}</span>{/if}
    {#if game.phase !== "finale"}
      <button class="quit" class:armed={quitArmed} onclick={tapQuit}>
        {quitArmed ? "QUIT?" : "✕"}
      </button>
    {/if}
  </header>

  {#if game.phase === "finale" && game.finale}
    <Finale {game} onreplay={newGame} onmodes={goHome} />
  {:else}
    <RosterRail {game} />
    <BankBox {game} />
    <SpinBanner {game} {colors} />

    {#if game.phase === "landed" && game.card && !game.coldStove}
      <PowerupRow
        {game}
        onSeasonTicket={() => (yearPickerOpen = true)}
        onRelocate={() => (teamPickerOpen = true)}
      />
      {#key game.card}
        <div class="after">
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
  {#if teamPickerOpen}
    <TeamPicker {game} {colors} onclose={() => (teamPickerOpen = false)} />
  {/if}
  {#if game.primePick !== null}
    <PrimePicker {game} onclose={() => game?.togglePrime()} />
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
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    position: relative;
  }
  .quit {
    position: absolute;
    right: 0;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    color: var(--muted);
    font-family: inherit;
    font-weight: 800;
    font-size: 10px;
    line-height: 1;
    padding: 4px 8px;
    cursor: pointer;
  }
  .quit.armed {
    background: var(--orange);
    color: var(--card);
    border-color: var(--ink);
  }
  .modechip {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--amber);
    padding: 0 9px;
    font-weight: 800;
    font-size: 9.5px;
    letter-spacing: 0.06em;
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

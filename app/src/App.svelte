<script lang="ts">
  import BankBox from "./components/BankBox.svelte";
  import Finale from "./components/Finale.svelte";
  import HelpModal from "./components/HelpModal.svelte";
  import TrophyModal from "./components/TrophyModal.svelte";
  import Home from "./components/Home.svelte";
  import Logo from "./components/Logo.svelte";
  import PlayerList from "./components/PlayerList.svelte";
  import PowerupRow from "./components/PowerupRow.svelte";
  import PrimePicker from "./components/PrimePicker.svelte";
  import RosterRail from "./components/RosterRail.svelte";
  import SpecialPrimePicker from "./components/SpecialPrimePicker.svelte";
  import SpecialRows from "./components/SpecialRows.svelte";
  import SpinBanner from "./components/SpinBanner.svelte";
  import TeamPicker from "./components/TeamPicker.svelte";
  import YearPicker from "./components/YearPicker.svelte";
  import { loadColors, loadIndex, loadMeta, loadOwners } from "./lib/data";
  import { Game, type GameConfig } from "./lib/engine.svelte";
  import { BANKS, DIFFICULTIES } from "./lib/modes";
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
  let helpOpen = $state(false);
  let trophyOpen = $state(false);

  // Dev-only UI lab (localhost:5173/?lab): hardcoded edge-case galleries for
  // every component, so extreme states are reviewable without replaying games.
  // Dynamic import + DEV guard keep it out of the production bundle.
  let LabComp = $state<typeof import("./lab/Lab.svelte").default | null>(null);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("lab")) {
    import("./lab/Lab.svelte").then((m) => (LabComp = m.default));
  }

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

  /** An explicit seed (from the home screen's PLAY A SEED input) replays that
   * exact card sequence; omitted, each game rolls a fresh random seed. */
  function startGame(config: GameConfig, seed?: number) {
    if (!deps) return;
    settings = config;
    saveSettings(config);
    confirmKey = null;
    yearPickerOpen = false;
    teamPickerOpen = false;
    game = new Game(deps.meta, deps.index, deps.owners, seed, config);
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
    // On the finale there's nothing to abandon (the engine already cleared the
    // save), so ✕ goes straight home — no QUIT? confirm.
    if (game?.phase === "finale") {
      goHome();
      return;
    }
    clearTimeout(quitTimer);
    if (quitArmed) {
      Game.clearSave();
      goHome();
      return;
    }
    quitArmed = true;
    quitTimer = setTimeout(() => (quitArmed = false), 2500);
  }

  // The header chip is emoji-only; full mode names live in the title/aria-label.
  // Default modes (classic / standard) show no chip at all.
  const optIn = $derived.by(() => {
    if (!game) return [];
    const out = [];
    if (game.config.bank !== "classic") out.push(BANKS[game.config.bank]);
    if (game.config.difficulty !== "standard") out.push(DIFFICULTIES[game.config.difficulty]);
    return out;
  });
  const modeChip = $derived(optIn.map((m) => m.emoji).join(" "));
  const modeTitle = $derived(optIn.map((m) => m.name).join(" · "));

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

{#if LabComp}
  <LabComp />
{:else if bootError}
  <div class="boot disp">Couldn't load the league. {bootError}</div>
{:else if !booted || !colors}
  <div class="boot disp">Warming up the stove…</div>
{:else if screen === "home" || !game}
  <Home config={settings} onplay={startGame} />
{:else}
  <header class="hud disp">
    <button class="help" onclick={(e) => { e.stopPropagation(); helpOpen = true; }} aria-label="How to play">?</button>
    <button class="help trophy" onclick={(e) => { e.stopPropagation(); trophyOpen = true; }} aria-label="Trophy case"><svg class="tico" viewBox="0 0 14 14" aria-hidden="true"><path d="M4 2h6v3.2a3 3 0 0 1-6 0V2Z M4 2.8H2.3v1.1a2 2 0 0 0 1.9 2 M10 2.8h1.7v1.1a2 2 0 0 1-1.9 2 M7 8.4v2.2 M4.6 11.9h4.8"/></svg></button>
    <Logo />
    {#if modeChip}<span class="modechip" title={modeTitle} aria-label={modeTitle}>{modeChip}</span>{/if}
    <button class="quit" class:armed={quitArmed} onclick={tapQuit}>
      {quitArmed ? "QUIT?" : "✕"}
    </button>
  </header>

  {#if game.phase === "finale" && game.finale}
    <Finale {game} onreplay={newGame} onmodes={goHome} />
  {:else}
    <!-- Phone: the three wrappers are plain stacked divs, same order as ever.
         Wide (≥760px): the club (rail + bank) holds a sticky left column while
         the spin banner + powerups sit atop the market (specials + players)
         on the right — the reel introduces the card the market sells. -->
    <div class="game">
      <div class="gleft">
        <RosterRail {game} />
        <BankBox {game} />
      </div>
      <div class="gmid">
        <SpinBanner {game} {colors} />
        {#if game.phase === "landed" && game.card && !game.coldStove}
          <PowerupRow
            {game}
            onSeasonTicket={() => (yearPickerOpen = true)}
            onRelocate={() => (teamPickerOpen = true)}
          />
        {/if}
      </div>
      <div class="gright">
        {#if game.phase === "landed" && game.card && !game.coldStove}
          {#key game.card}
            <div class="after">
              <SpecialRows {game} {confirmKey} setConfirm={(k) => (confirmKey = k)} />
              <div class="psep">PLAYERS</div>
              <PlayerList {game} {confirmKey} setConfirm={(k) => (confirmKey = k)} />
            </div>
          {/key}
        {/if}
      </div>
    </div>
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
  {#if game.primeSpecial !== null}
    <SpecialPrimePicker {game} onclose={() => game?.togglePrime()} />
  {/if}
  {#if helpOpen}
    <HelpModal onclose={() => (helpOpen = false)} />
  {/if}

  {#if trophyOpen}
    <TrophyModal onclose={() => (trophyOpen = false)} />
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
  /* The ? and ✕ pills are twins: a fixed width (no horizontal padding, text
     centered) guarantees the same footprint regardless of glyph width. */
  .help,
  .quit {
    position: absolute;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    color: var(--muted);
    font-family: inherit;
    font-weight: 800;
    /* 12px, not 10: the trophy is a 13px drawing, and a 10px ? beside it read
       as the smaller sibling rather than its twin. */
    font-size: 12px;
    line-height: 1;
    padding: 0;
    width: 28px;
    text-align: center;
    cursor: pointer;
    /* Fixed height and centring so all three corner pills share one box: the
       ? and ✕ are 10px text glyphs and the trophy is a 13px drawing, and
       letting content set the height made the trophy the odd one out. */
    height: 22px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .help {
    left: 0;
  }
  /* The case sits inboard of the ?, sharing its geometry — one control group
     in the corner rather than two unrelated glyphs. stopPropagation matters
     here for the same reason it does on the ?: the HUD sits above click
     handling tied to the landed card, and a bare button would commit a pick
     on the way to opening a sheet. */
  .trophy {
    left: 32px;
  }
  /* Line art rather than an emoji: the ?/✕ pills are 10px text glyphs, and a
     colour emoji dropped into that geometry sits low and reads as a sticker on
     a control. Stroked ink matches the punch mark the home rows already use. */
  .tico {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .quit {
    right: 0;
  }
  /* Armed, the pill carries a word ("QUIT?") — it may outgrow the twin width. */
  .quit.armed {
    background: var(--orange);
    color: var(--card);
    border-color: var(--ink);
    width: auto;
    padding: 0 8px;
  }
  /* Emoji-only chip, scaled to sit beside the ?/✕ pills. */
  .modechip {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--amber);
    padding: 2px 8px;
    font-size: 11px;
    line-height: 1.4;
  }
  /* Wide: two-column game board. The left column is the persistent club
     (roster + bank) and sticks while the right column — spin banner over the
     market — scrolls; the club is well under a viewport tall, so it always
     fits. */
  @media (min-width: 760px) {
    .game {
      display: grid;
      grid-template-columns: minmax(300px, 350px) minmax(0, 1fr);
      grid-template-areas:
        "left mid"
        "left right";
      grid-template-rows: auto 1fr;
      column-gap: 24px;
      align-items: start;
    }
    .gleft {
      grid-area: left;
      position: sticky;
      top: 10px;
    }
    .gmid {
      grid-area: mid;
    }
    .gright {
      grid-area: right;
    }
    /* The board and its header share one cap: player rows past ~650px read
       sparse (name → chips gulf), and the ?/✕ pills should hug the board. */
    .hud,
    .game {
      max-width: 1020px;
      margin-left: auto;
      margin-right: auto;
    }
  }
  @media (min-width: 1100px) {
    .game {
      grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
      column-gap: 30px;
    }
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

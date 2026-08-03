<script lang="ts">
  import BankBox from "./components/BankBox.svelte";
  import CornerButtons from "./components/CornerButtons.svelte";
  import Finale from "./components/Finale.svelte";
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
  import { track } from "./lib/analytics";
  import { loadColors, loadIndex, loadMeta, loadOwners } from "./lib/data";
  import {
    Game,
    claimFinale,
    clearStoredFinale,
    releaseFinale,
    type GameConfig,
  } from "./lib/engine.svelte";
  import { BANKS, DIFFICULTIES } from "./lib/modes";
  import { loadSettings, recordQuit, saveSettings } from "./lib/settings";
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
  /** This finale came out of storage rather than out of a game that just
   * ended. The trophy cue was already lit when the game finished, so a
   * re-entry must not re-light a case the player has since opened. */
  let restoredFinale = $state(false);

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
          // A live game outranks a finale, and starting one already retired the
          // stored finale — so a claim surviving alongside a save is stale by
          // construction (two tabs racing is the only way to write one). Drop
          // it rather than leave it to strand a later boot.
          releaseFinale();
        } else {
          // No game in flight: the finale is the other place a reload can be
          // standing. Starting a game retires the stored finale, so the two
          // never both exist — the save is checked first anyway, because a
          // live game is the stronger claim on the screen.
          const back = Game.resumeFinale(meta, index, owners);
          if (back) {
            game = back;
            restoredFinale = true;
            screen = "game";
          }
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
    // A new game retires the last finished one — archive and boot claim both.
    // Every route into a game comes through here (PLAY, PLAY A SEED, and the
    // finale's own Replay), which is what makes "a save AND a stored finale"
    // an unreachable state rather than a boot-time tiebreak.
    clearStoredFinale();
    restoredFinale = false;
    game = new Game(deps.meta, deps.index, deps.owners, seed, config);
    track("game_start", { difficulty: config.difficulty, bank: config.bank });
    // One event with a boolean rather than two names: `seed` is undefined off
    // the PLAY button and a parsed number off PLAY A SEED, so the flag answers
    // "typed in" and "rolled fresh" from the same row.
    track("seed_played", { typed: seed !== undefined });
    screen = "game";
  }

  /** The home screen's way back into the last finished game's finale. Re-claims
   * the screen, so a reload from there stays on the finale. */
  function openLastFinale() {
    if (!deps) return;
    const back = Game.fromStoredFinale(deps.meta, deps.index, deps.owners);
    if (!back) return;
    claimFinale();
    game = back;
    restoredFinale = true;
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
    // Leaving the finale (✕ or Modes) drops the boot claim: reloads land home
    // from now on. The archive survives so the home screen can walk back in —
    // dropping it here would delete the record before anything could read it.
    releaseFinale();
    restoredFinale = false;
    game = null;
    screen = "home";
  }

  /** Two-tap quit: abandons the run AND its save, back to the mode screen. */
  function tapQuit(e: MouseEvent) {
    e.stopPropagation();
    // On the finale there's nothing to abandon — the engine already cleared
    // the save, and the archived finale outlives this tap (the home screen
    // walks back into it) — so ✕ goes straight home, no QUIT? confirm. It is
    // also why 🧳 cannot be earned from here: the game is already over.
    if (game?.phase === "finale") {
      goHome();
      return;
    }
    clearTimeout(quitTimer);
    if (quitArmed) {
      // The second tap is the quit, so this is where 🧳 PACKED IT IN is
      // earned — before the save goes, and never on the arming tap or on a
      // confirm the player let lapse. It is the one badge no resolver pushes:
      // badges are read off a finished season and this path produces none, so
      // it is written straight into the log as an unscored row.
      recordQuit();
      // The confirmed tap only, matching recordQuit: arming the ✕ and thinking
      // better of it is not a quit and must not be counted as one.
      track("game_quit");
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
    // The engine sets `phase = "finale"` once, inside finishGame, so this is
    // the one moment a season ends. A finale reopened from storage is excluded:
    // it is the same season being looked at again, not a second result.
    if (phase === "finale" && !restoredFinale && game?.finale) {
      track("game_finish", {
        wins: game.finale.wins,
        // Rounded so the parameter is an integer in GA4's reports; the ladder
        // the finale prints is already rounded to the same place.
        total: Math.round(game.finale.parts.total),
        over_payroll: game.finale.spend > game.finale.budget,
      });
    }
  });

  /* ---- the code ----
   *
   * ↑↑↓↓←→←→BA on a physical keyboard earns 🎮 CHEAT CODES and does nothing
   * else — no spin, no powerup, no price, no number the finale prints. A code
   * that changed the game would make every score after it incomparable, and a
   * shareable result is the one social artifact this game has.
   *
   * Bound to a LIVE GAME only, and that is forced rather than stylistic: the
   * fact is stored on the `Game` so it survives the reload iOS Safari inflicts
   * on a backgrounded tab, and the home screen has no Game to store it on. A
   * keystroke there would be silently lost across the very eviction the
   * persistence exists to survive. `markKonami` refuses the finale for the
   * matching reason — that season's badges are already resolved.
   *
   * The matcher is a rolling window of the last ten keys rather than an index
   * that advances and resets, and the sequence's own shape is why. It opens
   * with two identical keys, so ↑↑↑↓↓←→←→BA is a real entry with one false
   * start in front of it — and an index that resets on a miss gets that case
   * wrong however carefully the reset is written, because the miss happens
   * three keys in and the correct fallback is a prefix of what was already
   * typed. Comparing the trailing ten keys is the whole rule and has no
   * fallback to get wrong.
   *
   * Events whose target is a text field are ignored outright, so typing a seed
   * code into the home screen's input can neither advance the window nor
   * disturb one already part-filled. */
  const KONAMI = [
    "arrowup",
    "arrowup",
    "arrowdown",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "arrowleft",
    "arrowright",
    "b",
    "a",
  ];
  let konamiKeys: string[] = [];

  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    konamiKeys = [...konamiKeys, e.key.toLowerCase()].slice(-KONAMI.length);
    if (konamiKeys.every((k, i) => k === KONAMI[i]) && konamiKeys.length === KONAMI.length) {
      konamiKeys = [];
      game?.markKonami();
    }
  }
</script>

<svelte:window onclick={() => (confirmKey = null)} onkeydown={onKey} />

{#if LabComp}
  <LabComp />
{:else if bootError}
  <div class="boot disp">Couldn't load the league. {bootError}</div>
{:else if !booted || !colors}
  <div class="boot disp">Warming up the stove…</div>
{:else if screen === "home" || !game}
  <Home config={settings} onplay={startGame} onlast={openLastFinale} />
{:else}
  <header class="hud disp">
    <!-- The finale hands over its first-time-ever badges, which is what lights
         the case; off the finale there is nothing to report. A finale reopened
         from storage reports nothing either: those badges were noted when the
         game ended, and re-noting them would re-light a case the player has
         already opened, on every reload. -->
    <CornerButtons
      newBadges={game.phase === "finale" && !restoredFinale
        ? (game.finale?.newBadges ?? [])
        : null}
    />
    <Logo />
    {#if modeChip}<span class="modechip" title={modeTitle} aria-label={modeTitle}>{modeChip}</span>{/if}
    <button class="quit" class:armed={quitArmed} onclick={tapQuit}>
      {quitArmed ? "QUIT?" : "✕"}
    </button>
  </header>

  {#if game.phase === "finale" && game.finale}
    <!-- A finale reopened from storage is already resolved: the reveal is the
         payoff for a game you just finished, not something to sit through on
         every reload. -->
    <Finale {game} resolved={restoredFinale} onreplay={newGame} onmodes={goHome} />
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
  /* The ✕ is the twin of the ?/trophy pair CornerButtons draws in the other
     corner: same box, a fixed width (no horizontal padding, text centered) so
     the footprint holds regardless of glyph width. */
  .quit {
    position: absolute;
    right: 0;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    color: var(--muted);
    font-family: inherit;
    font-weight: 800;
    /* 12px, not 10: the trophy is a 13px drawing, and a 10px glyph beside it
       read as the smaller sibling rather than its twin. */
    font-size: 12px;
    line-height: 1;
    padding: 0;
    width: 28px;
    text-align: center;
    cursor: pointer;
    /* Fixed height and centering so all three corner pills share one box: the
       ? and ✕ are text glyphs and the trophy is a 13px drawing, and letting
       content set the height made the trophy the odd one out. */
    height: 22px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  /* Armed, the pill carries a word ("QUIT?") — it may outgrow the twin width. */
  .quit.armed {
    background: var(--orange-2);
    color: var(--ink);
    border-color: var(--orange-8);
    width: auto;
    padding: 0 8px;
  }
  /* Emoji-only chip, scaled to sit beside the ?/✕ pills. */
  .modechip {
    border: 2px solid var(--line);
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

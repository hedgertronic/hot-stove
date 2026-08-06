<script lang="ts">
  import BankBox from "./components/BankBox.svelte";
  import CloseGlyph from "./components/CloseGlyph.svelte";
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
    type StoredFinale,
  } from "./lib/engine.svelte";
  import { BANKS, DIFFICULTIES } from "./lib/modes";
  import { replayShortcode } from "./lib/share";
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
  /** The undo pill's confirm is up, reported by CornerButtons. Held here only
   * so the ✕ and the wordmark can step back for it — the pill owns its own
   * two-tap state, timer and lapse, exactly as the ✕ owns those next door. */
  let undoArmed = $state(false);
  /** This finale came out of storage rather than out of a game that just
   * ended. The trophy cue was already lit when the game finished, so a
   * re-entry must not re-light a case the player has since opened. */
  let restoredFinale = $state(false);
  /** A shared game code is being looked at. The Game on screen is inert (it
   * writes nothing) and is not the viewer's — the finale collapses its button
   * row to one way back, which is what `stashed` below puts them back into. */
  let replaying = $state(false);
  /** What the viewer was looking at when the replay opened, held in memory and
   * put back on exit. Deliberately not a re-run of the boot sequence: a replay
   * must not read or write storage on the way in OR on the way out, and the
   * live game is already standing right here. */
  let stashed: { game: Game | null; screen: "home" | "game"; restoredFinale: boolean } | null = null;

  // Dev-only UI lab (localhost:5173/?lab): hardcoded edge-case galleries for
  // every component, so extreme states are reviewable without replaying games.
  // Dynamic import + DEV guard keep it out of the production bundle.
  let LabComp = $state<typeof import("./lab/Lab.svelte").default | null>(null);
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("lab")) {
    import("./lab/Lab.svelte").then((m) => (LabComp = m.default));
  }

  /** The boot meter's numerator: the five discrete steps between mount and a
   * playable screen — four data files plus the save restore. Steps rather
   * than bytes on purpose: byte progress needs streamed fetches for four
   * differently-sized files and buys a smoother lie, while a step meter is
   * honest about what boot actually is and costs one counter. On a warm
   * cache the whole bar fills in a blink, which is the right message. */
  const BOOT_STEPS = 5;
  let bootDone = $state(0);

  $effect(() => {
    const step = <T,>(p: Promise<T>): Promise<T> =>
      p.then((r) => {
        bootDone += 1;
        return r;
      });
    void (async () => {
      try {
        const [meta, index, owners, cols] = await Promise.all([
          step(loadMeta()),
          step(loadIndex()),
          step(loadOwners()),
          step(loadColors()),
        ]);
        deps = { meta, index, owners };
        colors = cols;
        // A mid-game save resumes straight into the game (iOS tab eviction);
        // otherwise land on the mode-select home screen.
        const saved = await step(Game.restore(meta, index, owners));
        if (saved) {
          game = saved;
          screen = "game";
          // A live game outranks a finale, whichever finale the claim names: a
          // season already scored can be walked back into from home at any
          // time, and a game in progress can only be stood back up here. The
          // claim goes rather than being left to strand a later boot.
          releaseFinale();
        } else {
          // No game in flight: the finale is the other place a reload can be
          // standing — the game just finished, or any older season the seasons
          // list was reopened into, whichever the claim names. Starting a game
          // retires the stored finale, so a save and a live finale never both
          // exist; the save is checked first anyway, because a game in progress
          // is the stronger claim on the screen.
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
    // A replay is never the thing that starts a game, but leaving the flag set
    // would dress the NEXT finale as somebody else's.
    replaying = false;
    stashed = null;
    // The final argument is the seed badges' provenance bit: an explicit seed
    // here can only have come off the PLAY A SEED input.
    game = new Game(deps.meta, deps.index, deps.owners, seed, config, seed !== undefined);
    track("game_start", { difficulty: config.difficulty, bank: config.bank });
    // One event with a boolean rather than two names: `seed` is undefined off
    // the PLAY button and a parsed number off PLAY A SEED, so the flag answers
    // "typed in" and "rolled fresh" from the same row.
    track("seed_played", { typed: seed !== undefined });
    screen = "game";
  }

  /** Open a shared game code — someone else's finished season, rebuilt by
   * re-running its decisions (lib/share `replayShortcode`).
   *
   * Returns false when the code cannot be replayed on this build, which is the
   * home screen's cue to say so. Nothing is written on either outcome: the
   * reconstruction is inert, and this path deliberately avoids `startGame`
   * (which saves settings and clears the stored finale), `openFinale` (which
   * claims the boot screen), and `goHome` (which releases that claim). */
  /** Single-flight: reconstruction awaits card fetches, and a second GO tap
   * during that window would stash the FIRST replay as the "original" screen
   * — exiting would then land on a replay that thinks it isn't one. The
   * second tap is refused instead (the home screen answers with its shake,
   * which is honest enough for a double-tap). */
  let replayBusy = false;

  async function openReplay(code: string): Promise<boolean> {
    if (!deps || replayBusy) return false;
    replayBusy = true;
    try {
      const back = await replayShortcode(deps.meta, deps.index, deps.owners, code);
      if (!back) return false;
      stashed = { game, screen, restoredFinale };
      game = back;
      // Resolved, like every finale that was not just earned here: no reveal
      // to sit through, no `game_finish` event, and no trophy cue for badges
      // that belong to somebody else's season.
      restoredFinale = true;
      replaying = true;
      screen = "game";
      return true;
    } finally {
      replayBusy = false;
    }
  }

  /** Leave a replay for whatever the viewer had before it — their live game,
   * their own finale, or the home screen. Storage is not touched. */
  function exitReplay() {
    const back = stashed;
    stashed = null;
    replaying = false;
    game = back?.game ?? null;
    restoredFinale = back?.restoredFinale ?? false;
    screen = back?.screen ?? "home";
  }

  /** The home screen's way back into a finished season, from the seasons list.
   *
   * It claims the screen exactly as a game that just ended does, and the claim
   * carries the archive id so the claim names THIS season rather than the last
   * one played — a reload puts back the club that was on screen. `id` is
   * undefined for the one row the seasons list opens out of `hotstove.finale`
   * instead of the archive (the newest season, on a career whose archive row
   * for it was never written), and that is the live claim, which resolves to
   * the same record.
   *
   * A season evicted from the archive between the claim and the reload lands
   * home instead — `resumeFinale` drops a claim it cannot honour. */
  function openFinale(rec: StoredFinale, id?: string) {
    if (!deps) return;
    const back = Game.fromStoredFinale(deps.meta, deps.index, deps.owners, rec);
    if (!back) return;
    claimFinale(id);
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
    undoArmed = false;
    // Leaving the finale (✕ or Modes) drops the boot claim: reloads land home
    // from now on. The archive survives so the home screen can walk back in —
    // dropping it here would delete the record before anything could read it.
    releaseFinale();
    restoredFinale = false;
    replaying = false;
    stashed = null;
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
      if (replaying) exitReplay();
      else goHome();
      return;
    }
    clearTimeout(quitTimer);
    if (quitArmed) {
      // The second tap is the quit, so this is where 🧳 PACKED IT IN is
      // earned — before the save goes, and never on the arming tap or on a
      // confirm the player let lapse. It is the one badge no resolver pushes:
      // badges are read off a finished season and this path produces none, so
      // it is written straight into the log as an unscored row.
      if (game) recordQuit(game.config.difficulty, game.config.bank);
      // The confirmed tap only, matching recordQuit: arming the ✕ and thinking
      // better of it is not a quit and must not be counted as one.
      track("game_quit");
      // A club that completed this instant may have an async finishGame in
      // flight (it awaits the dream solve's card loads). Told, it stands down
      // instead of landing after this quit and filing a finished season on
      // top of the quit row.
      game?.abandon();
      Game.clearSave();
      goHome();
      return;
    }
    quitArmed = true;
    quitTimer = setTimeout(() => (quitArmed = false), 2500);
  }

  /** A tap anywhere that is not the ✕ answers "QUIT?" with no: the confirm
   * disarms and the tap still lands on whatever it was aimed at — the same
   * outcome as letting it lapse, without the 2.5s wait. Capture phase, so a
   * tap whose click a component swallows with stopPropagation still quiets
   * the pill. Registered only while armed, and the arming tap can never trip
   * it: that tap's pointerdown fired before this effect installed the
   * listener. */
  let quitEl = $state<HTMLButtonElement | undefined>();
  $effect(() => {
    if (!quitArmed) return;
    const away = (e: Event) => {
      if (e.target instanceof Node && quitEl?.contains(e.target)) return;
      clearTimeout(quitTimer);
      quitArmed = false;
    };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  });

  // The header chip is emoji-only; full mode names live in the title/aria-label.
  // Default modes (classic / standard) show no chip at all.
  const optIn = $derived.by(() => {
    if (!game) return [];
    const out = [];
    // Difficulty leads, bank follows — the order the share title prints, so
    // the chip and the string a friend receives read the same way around.
    if (game.config.difficulty !== "standard") out.push(DIFFICULTIES[game.config.difficulty]);
    if (game.config.bank !== "classic") out.push(BANKS[game.config.bank]);
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
  <!-- The same title card index.html paints before the bundle arrives — the
       HOME masthead (the real <Logo big/> here; a hand-inlined replica of it
       in index.html #static-boot, values matched span for span) at the same
       38vh anchor, so the static→app handoff is pixel-still. The loading
       line and meter live in .bootload, which fades in on a CSS delay: a
       warm-cache boot swaps to the game before the delay expires, so a fast
       load is one steady title card with no meter flash, and only a
       genuinely slow load ever shows the bar. -->
  <div class="boot disp">
    <div class="bootmast"><Logo big /></div>
    <div class="boottag">Spin for teams. Sign players. Chase 162 wins.</div>
    <!-- `now`: the static card's warming line already served its 400ms wait —
         the bundle alone took longer than the delay — so this card's copy of
         the line shows immediately instead of blinking out for a second
         400ms. performance.now() counts from navigation start, which is the
         same clock the static line's CSS delay effectively started on. -->
    <div class="bootload" class:now={typeof performance !== "undefined" && performance.now() > 400}>
      <div class="bootline">Warming up the stove…</div>
      <div
        class="bootmeter"
        role="progressbar"
        aria-label="Loading the league"
        aria-valuemin="0"
        aria-valuemax={BOOT_STEPS}
        aria-valuenow={bootDone}
      >
        <div class="bootfill" style="width: {(bootDone / BOOT_STEPS) * 100}%"></div>
      </div>
    </div>
  </div>
{:else if screen === "home" || !game}
  <Home config={settings} onplay={startGame} onopen={openFinale} onreplay={openReplay} />
{:else}
  <header class="hud disp">
    <!-- The finale hands over its first-time-ever badges, which is what lights
         the case; off the finale there is nothing to report. A finale reopened
         from storage reports nothing either: those badges were noted when the
         game ended, and re-noting them would re-light a case the player has
         already opened, on every reload. -->
    <CornerButtons
      {game}
      newBadges={game.phase === "finale" && !restoredFinale
        ? (game.finale?.newBadges ?? [])
        : null}
      pushed={quitArmed}
      onconfirm={(armed) => (undoArmed = armed)}
    />
    <!-- The wordmark and its chip travel as one flex item so a live confirm can
         step the whole brand back with a single rule. Two items dimmed
         separately would drift apart the moment either gained a state of its
         own, and an armed pill genuinely does reach the logo: "UNDO?" grows to
         about 62px from a 32px anchor, which lands on the H of HOTSTOVE at
         320px. -->
    <span class="brand" class:pushed={quitArmed || undoArmed}>
      <Logo />
      {#if modeChip}<span class="modechip" title={modeTitle} aria-label={modeTitle}>{modeChip}</span>{/if}
    </span>
    <button
      class="quit chipbox"
      class:armed={quitArmed}
      class:instant={game.phase === "finale"}
      class:pushed={undoArmed}
      bind:this={quitEl}
      onclick={tapQuit}
      aria-label={quitArmed
        ? "Quit this game: tap again to confirm"
        : game.phase === "finale"
          ? "Back to the home screen"
          : "Quit this game"}
    >
      {#if quitArmed}<span class="chiplbl">QUIT?</span>{:else}<CloseGlyph />{/if}
    </button>
  </header>

  {#if game.phase === "finale" && game.finale}
    <!-- A finale reopened from storage is already resolved: the reveal is the
         payoff for a game you just finished, not something to sit through on
         every reload. -->
    <Finale
      {game}
      resolved={restoredFinale}
      replay={replaying}
      onreplay={newGame}
      onmodes={replaying ? exitReplay : goHome}
    />
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
    /* Static boot's exact box (index.html #static-boot): same 38vh anchor,
       same side padding, same stated line-height (the static card can't
       inherit app.css's), so the pre-mount card and this one don't jump. */
    max-width: 480px;
    margin: 0 auto;
    padding: 38vh 24px 0;
    line-height: 1;
    font-weight: 700;
  }
  /* The masthead line: <Logo big> here, its hand-inlined twin in the static
     card. The wrapper exists because Logo is inline-flex and the h1 twin
     needs a matching block seat to center in. */
  .bootmast {
    color: var(--ink);
  }
  /* Home's .pitch voice, verbatim — the boot card is the masthead, so the
     tagline wears the caption register the home screen gives it. */
  .boottag {
    margin-top: 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  /* Loading UI held back behind a pure-CSS delay: opacity only (no layout
     shift), so a boot that finishes inside the delay never flashes it. */
  .bootload {
    opacity: 0;
    animation: bootfade 0.25s ease 0.4s forwards;
  }
  /* The wait was already served by the static card's line (see the `now`
     comment in the markup): show, don't re-fade. */
  .bootload.now {
    opacity: 1;
    animation: none;
  }
  /* app.css kills every animation for reduce-motion readers, and this box
     RELIES on one to become visible — rest it visible there instead, or a
     slow load shows no sign of life at all. */
  @media (prefers-reduced-motion: reduce) {
    .bootload {
      opacity: 1;
    }
  }
  @keyframes bootfade {
    to {
      opacity: 1;
    }
  }
  .bootline {
    margin-top: 22px;
  }
  /* The meter: a small cardstock capsule under the line, filling with the
     stove's own heat orange as the five boot steps land (BOOT_STEPS above).
     The transition smooths step jumps into a pour; on a warm cache it fills
     in one hop, which reads as the fast load it is. Height and border are
     whole pixels for the chip-recipe reason. */
  .bootmeter {
    width: 180px;
    height: 12px;
    margin: 12px auto 0;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    overflow: hidden;
  }
  .bootfill {
    height: 100%;
    background: var(--orange-8);
    border-radius: 999px;
    transition: width 0.25s ease;
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
    /* Inline only: the block axis belongs to the chipbox recipe this pill now
       wears (markup class) — its fallback constant and trim branch seat the
       armed "QUIT?" caps on center in both engines. A `padding: 0` shorthand
       would kill the recipe's padding-block correction on non-trim engines. */
    padding-inline: 0;
    width: 28px;
    text-align: center;
    cursor: pointer;
    /* Fixed height and centering so all three corner pills share one box: the
       ? and ✕ are text glyphs and the trophy is a 13px drawing, and letting
       content set the height made the trophy the odd one out. */
    --chip-h: 22px;
    box-sizing: border-box;
    /* The same press dip its three corner twins carry (CornerButtons .help)
       — the ✕ was the one pill in the row that did not move under a tap.
       app.css kills the transition for reduced-motion readers. */
    transition: transform 0.08s;
  }
  /* The dip belongs to the tap that ACTS, not the tap that asks: arming
     already answers with the pill's whole costume change (✕ → QUIT? in
     confirm orange), and dipping both taps made the ask feel like the act.
     So the resting ✕ holds still, the armed confirm dips — and on the
     finale, where there is nothing to abandon and no confirm step, the one
     tap IS the act and dips (`.instant`, set off the phase). Same split as
     the undo pill's (CornerButtons). */
  .quit.armed:active,
  .quit.instant:active {
    transform: translate(-1px, -1px);
  }
  /* Armed, the pill carries a word ("QUIT?") — it may outgrow the twin width,
     and reaches across the undo pill 32px inboard. That overlap is intended:
     the neighbour steps back for it (see `.pushed`), and the anchor never
     moves, so the ✕ is in the same place on every tap. */
  .quit.armed {
    background: var(--orange-2);
    color: var(--ink);
    border-color: var(--orange-8);
    /* The armed WORD drops to the powerup pills' own 10.5px/0.04em register —
       at the glyphs' 12px it read as the largest pill text on the board. The
       resting ✕ keeps 12px: it is a glyph sized to its twins, not a label. */
    font-size: 10.5px;
    letter-spacing: 0.04em;
    /* Fixed, not auto: "QUIT?" measures under its old 35.5px at this size,
       and 56px still seats it centered with side room to spare. Pinning the number makes the confirm's footprint a CONSTANT the
       undo pill can push off from — CornerButtons slides its pill by exactly
       (56 + 4px resting gap − 32px anchor), and that arithmetic only holds if
       this width cannot drift with font rendering. Change either number with
       the other. */
    width: 56px;
    z-index: 2;
  }
  /* Beside a live confirm — the undo pill's, since this is the ✕ and the
     wordmark. The mirror of `.help.pushed` in CornerButtons, same numbers and
     same reasoning: ghosted so the header keeps its shape and nothing reflows
     under the thumb, still tappable, and the confirm sits above it. */
  .quit.pushed,
  .brand.pushed {
    opacity: 0.22;
    transform: scale(0.92);
  }
  /* Only the ✕ takes the z-index: it is the one that shares a corner with the
     confirm. The wordmark is a static flex item and is painted under the
     absolutely positioned pills already. */
  .quit.pushed {
    z-index: 0;
  }
  .quit,
  .brand {
    transition:
      opacity 0.12s ease,
      transform 0.12s ease;
  }
  /* The wordmark and its chip as one item, reproducing the two flex children
     the header laid out directly before they were wrapped — the row's own
     `gap: 8px` between them, centered on the same line. */
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  /* Emoji-only chip, scaled to sit beside the ?/✕ pills — and dressed as
     their sibling: plain cardstock in --line, the corner-pill uniform. It
     wore --amber for a while, which stopped meaning "mode" the day amber
     became the trophy register (award chips, the record-book shelf) — a
     gold-filled pill in the header read as something earned rather than
     something chosen. The emoji is the whole signal; the pill just seats
     it. */
  .modechip {
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
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

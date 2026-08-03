<script lang="ts">
  import { tick } from "svelte";
  import {
    loadStoredFinale,
    type Bank,
    type Difficulty,
    type GameConfig,
  } from "../lib/engine.svelte";
  import { parseSeedCode, recordFromTotal } from "../lib/format";
  import { BANKS, DIFFICULTIES } from "../lib/modes";
  import { bestFor } from "../lib/settings";
  import CornerButtons from "./CornerButtons.svelte";
  import Logo from "./Logo.svelte";

  let {
    config,
    onplay,
    onlast,
  }: {
    config: GameConfig;
    onplay: (c: GameConfig, seed?: number) => void;
    /** Reopen the last finished game's finale (only ever called when one is
     * stored — the control is present always, but disabled otherwise). */
    onlast: () => void;
  } = $props();

  // Seed once from the saved settings; the rows edit local state until PLAY.
  // svelte-ignore state_referenced_locally
  let difficulty = $state<Difficulty>(config.difficulty);
  // svelte-ignore state_referenced_locally
  let bank = $state<Bank>(config.bank);

  // The punch list reads straight from the shared mode table: every decision
  // is one full-width row — punch box, emoji, name (plus a team chip on the
  // fixed-cap banks), and one payroll pill on the right. Owner's Box's pill
  // is a dashed blank: payroll is unknown until you hire an owner in-game.
  const DIFFS = (Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => ({
    key,
    ...DIFFICULTIES[key],
  }));
  const BANK_CARDS = (Object.keys(BANKS) as Bank[]).map((key) => ({ key, ...BANKS[key] }));

  const best = $derived(bestFor(difficulty, bank));

  // The best season is DERIVED from the best total via the shared ladder
  // (lib/format.recordFromTotal) — the same resolution the finale stamp
  // performs. Stored record strings are ignored: they hold the old
  // expected-wins record, and the record is now a pure function of points,
  // so the highest total and the best record are the same game.
  const season = $derived(
    best.best === null ? null : { ...recordFromTotal(best.best), pts: best.best.toFixed(1) },
  );


  // The way back into the last finished game's finale. Read once: the home
  // screen is rebuilt every time it is shown, and nothing writes the archive
  // while it is on screen. A finished game unmounts this screen on the way to
  // the finale and mounts a fresh one on the way back, so the read is current
  // without any reactivity of its own.
  //
  // GLOBAL, unlike the record book below: it is the last game played, whatever
  // mode that game was played in. The button says LAST, the book says BEST.
  //
  // Null in exactly two situations, and the button is disabled in both: nobody
  // has ever finished a game here, and the last game was quit. Quitting takes
  // `hotstove.current` and nothing else, but every route into a game clears the
  // archive first — so a game there is anything to quit is a game with no
  // archive behind it.
  const lastFinale = loadStoredFinale();

  // PLAY A SEED: a shared code replays that game's exact card sequence
  // under whatever mode combo is selected above.
  let seedOpen = $state(false);
  let seedInput = $state("");
  let seedBad = $state(false);
  /** The button the field replaced, so cancelling can hand focus back to it
   * rather than dropping the keyboard user on the body. */
  let seedBtn = $state<HTMLButtonElement | null>(null);

  function playSeed() {
    const seed = parseSeedCode(seedInput);
    if (seed === null) {
      seedBad = true;
      setTimeout(() => (seedBad = false), 450);
      return;
    }
    onplay({ difficulty, bank }, seed);
  }

  /** Close the field and forget what was typed: reopening starts clean, and a
   * half-typed code never returns to shake at someone who has moved on. */
  async function cancelSeed() {
    seedOpen = false;
    seedInput = "";
    seedBad = false;
    // The button only exists again once the swap has rendered.
    await tick();
    seedBtn?.focus();
  }
</script>

{#snippet punchbox(on: boolean)}
  <!-- The punch mark is drawn, not typed: an SVG stroke cross fills the box
       geometrically, so centering never depends on a font's glyph metrics. -->
  <span class="punch" aria-hidden="true">
    {#if on}
      <svg class="pmark" viewBox="0 0 12 12">
        <path d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5" />
      </svg>
    {/if}
  </span>
{/snippet}

<div class="home disp">
  <CornerButtons home />

  <div class="mast">
    <Logo big />
  </div>

  <!-- The ladder measures how much baseball you already know, not how hard the
       game is set to: Rookie shows every number, Eye Test hands you names and
       trusts your memory. The label says so. The internal `difficulty` key,
       the Difficulty type, and the DIFFICULTIES table keep their names —
       saves and data reference them. -->
  <div class="psep">BALL KNOWLEDGE</div>
  <div class="rows">
    {#each DIFFS as d (d.key)}
      <button
        class="row"
        class:on={difficulty === d.key}
        aria-pressed={difficulty === d.key}
        onclick={() => (difficulty = d.key)}
      >
        {@render punchbox(difficulty === d.key)}
        <span class="ric">{d.emoji}</span>
        <span class="rname">{d.name}</span>
        <span class="rmeta caps">{d.desc}</span>
      </button>
    {/each}
  </div>

  <div class="psep">PAYROLL</div>
  <div class="rows">
    {#each BANK_CARDS as b (b.key)}
      <button
        class="row"
        class:on={bank === b.key}
        class:mb={b.key === "moneyball"}
        class:bc={b.key === "blankcheck"}
        aria-pressed={bank === b.key}
        onclick={() => (bank = b.key)}
      >
        {@render punchbox(bank === b.key)}
        <span class="ric">{b.emoji}</span>
        <span class="rname">{b.name}</span>
        {#if b.team}
          <!-- Identity rides with the name; the right zone stays payroll-only. -->
          <span class="chip {b.cls}">{b.team}</span>
        {/if}
        <span class="rmeta">
          {#if b.key === "classic"}
            <!-- Dashed blank: payroll is unknown until an owner is hired. -->
            <span class="pill ghost">{b.cash}</span>
          {:else}
            <span class="pill cash">{b.cash}</span>
          {/if}
        </span>
      </button>
    {/each}
  </div>

  <button class="btn hot playbtn" onclick={() => onplay({ difficulty, bank })}> PLAY 🔥 </button>

  <!-- The two secondaries, side by side under PLAY: back into the last
       finished game, and into a shared seed. Equal halves on the finale's own
       action-row proportions (48px tall, 13px display caps) — the one
       equal-width button row this codebase already has.
    -->
  <div class="under">
    <!-- Always both halves, whatever storage holds. With nothing to go back to
         the button is genuinely disabled rather than gone: a control that
         appears and disappears directly under the primary action moves PLAY A
         SEED across the screen between visits and shifts the thumb target of
         the row above, which costs more than a dimmed label does. -->
    <button class="btn ubtn" disabled={lastFinale === null} onclick={onlast}
      >LAST GAME <span class="bic">🧾</span></button
    >
    <!-- PLAY A SEED swaps ITS OWN half for the field rather than the row: the
         cell keeps its height, so the button beside it never moves under the
         thumb mid-tap. -->
    {#if seedOpen}
      <div class="seedrow" class:bad={seedBad}>
        <!-- The way back out, standing in the # slot rather than as a fourth
             child beside GO: the row's leading slot either introduces the code
             or dismisses it, which keeps the field's width within a few px of
             what it had. ✕ is the app's one dismissal glyph (the header's quit
             pill), and the swap is why the row can grow a cancel without
             growing. -->
        <button class="seedx" onclick={cancelSeed} aria-label="Cancel seed entry">✕</button>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="seedin"
          type="text"
          maxlength="8"
          placeholder="KF12OY"
          inputmode="text"
          autocapitalize="none"
          autocorrect="off"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="go"
          autofocus
          bind:value={seedInput}
          onkeydown={(e) => {
            if (e.key === "Enter") playSeed();
            // Scoped to the focused field, never to the window: the badge
            // panel catches Escape in the capture phase and Sheet closes on a
            // bubbling one, and both live inside a modal that takes focus off
            // this input the moment it opens. A handler that only fires while
            // the caret is here cannot reach either.
            else if (e.key === "Escape") cancelSeed();
          }}
        />
        <button class="seedgo" onclick={playSeed}>GO</button>
      </div>
    {:else}
      <button class="btn ubtn" bind:this={seedBtn} onclick={() => (seedOpen = true)}
        >PLAY A SEED <span class="shash">#</span></button
      >
    {/if}
  </div>

  <!-- The record book is a one-line card for the punched combo — the punched
       rows above name WHICH combo, so the card carries no label of its own.
       Two zones: G counts its games, box-score style; BEST SEASON is the
       finale's total stamp in miniature — the tier-colored record the best
       total resolves into, with the exact points quiet beneath. -->
  <div class="psep bestsep">RECORD BOOK</div>
  <div class="book">
    <div class="btable">
      <div class="bcol">
        <div class="bcap">G</div>
        <div class="bn" class:empty={best.games === 0}>{best.games}</div>
      </div>
      <div class="bcol">
        <div class="bcap">BEST SEASON</div>
        {#if season}
          <div class="brec {season.tier}">{season.wins}–{season.losses}</div>
          <div class="bpts">{season.pts} PTS</div>
        {:else}
          <div class="bn empty">—</div>
        {/if}
      </div>
    </div>
  </div>


</div>

<style>
  .home {
    position: relative;
    padding-top: 7vh;
  }
  /* Wide: the home screen is a menu, not a workspace — it stays a centered
     card-width column instead of stretching into the wide shell. */
  @media (min-width: 760px) {
    .home {
      max-width: 540px;
      margin: 0 auto;
    }
  }
  .mast {
    text-align: center;
    margin-bottom: 26px;
  }
  .rows {
    display: grid;
    gap: 7px;
    margin-bottom: 16px;
  }
  /* The roster rail's seat language, laid out as market rows: an unchosen
     mode is an empty seat (ink dashes, transparent, gray content); the
     punched one is filled cardstock. */
  .row {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 48px;
    padding: 6px 12px 6px 10px;
    border: 2.5px dashed var(--ink);
    border-radius: 11px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    text-align: left;
    transition: transform 0.08s;
    font-family: inherit;
  }
  .row:active {
    transform: translateY(2px);
  }
  .row:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .row.on {
    border-style: solid;
    background: var(--card);
    color: var(--ink);
  }
  .row.on.mb {
    background: var(--green-wash);
    border-color: var(--green-8);
  }
  .row.on.bc {
    background: var(--yellow);
    border-color: var(--gold-8);
  }
  /* The scorecard punch box: blank on unpunched rows, a stroked cross on the
     choice. The mark is SVG, sized and centered by the grid — no font metrics. */
  .punch {
    width: 19px;
    height: 19px;
    flex: none;
    border: 2px solid var(--ink);
    border-radius: 5px;
    display: grid;
    place-content: center;
    color: var(--ink);
    background: var(--card);
  }
  .pmark {
    display: block;
    width: 11px;
    height: 11px;
  }
  .pmark path {
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    fill: none;
  }
  .row:not(.on) .punch {
    border-color: var(--gray-ink);
    background: transparent;
  }
  .ric {
    font-size: 19px;
    line-height: 1;
    flex: none;
  }
  /* Unpunched rows mute their emoji along with their type. */
  .row:not(.on) .ric {
    filter: grayscale(0.35);
    opacity: 0.7;
  }
  .rname {
    font-weight: 800;
    font-size: 13.5px;
    white-space: nowrap;
  }
  /* Team-identity chip riding the name zone (fixed-cap banks only). It hugs
     the name tighter than the row's flex gap so the pair reads as one label. */
  .chip {
    flex: none;
    margin-left: -2px;
    border-radius: 999px;
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 2px 7px;
    white-space: nowrap;
  }
  /* These two keep their saturated club fills and their clubs' own type, which
     is the rule stopping at an edge case rather than an oversight: OAK green on
     OAK gold and NYY navy on white ARE the identity, and thinning either to a
     rung-2 wash with ink type would leave two 8.5px chips that no longer look
     like the A's or the Yankees. The ink line stays for the same reason it
     stays on the SIGN pill — a saturated fill this dark has no rung 2 to drop
     to, so there is no pair to make. */
  .chip.oak {
    border: 2px solid var(--ink);
    background: #003831;
    color: #efb21e;
  }
  .chip.nyy {
    border: 2px solid var(--ink);
    background: #0c2340;
    color: #fffdf6;
  }
  /* An unpunched row's chip goes ghost too: color belongs to the choice. */
  .row:not(.on) .chip {
    border: 2px dashed var(--gray-ink);
    background: transparent;
    color: var(--muted);
  }
  .rmeta {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
    text-align: right;
  }
  .rmeta.caps {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gray-ink);
  }
  .row.on .rmeta.caps {
    color: var(--muted);
  }
  .pill {
    display: inline-block;
    border-radius: 999px;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 2.5px 9px;
    white-space: nowrap;
  }
  /* Owner's Box payroll stays dashed even when punched — it isn't known yet. */
  .pill.ghost {
    border: 2px dashed var(--gray-ink);
    color: var(--muted);
    background: transparent;
  }
  .pill.cash {
    border: 2px solid var(--ink);
    background: var(--card);
    color: var(--ink);
  }
  /* An unpunched row's pills go ghost too: color belongs to the choice. */
  .row:not(.on) .pill {
    border: 2px dashed var(--gray-ink);
    background: transparent;
    color: var(--muted);
  }
  /* Narrowest phones: tighter gaps and meta so every row stays one line. */
  @media (max-width: 359px) {
    .row {
      gap: 7px;
      padding: 6px 8px;
    }
    .rmeta {
      gap: 4px;
    }
    .rname {
      font-size: 12.5px;
    }
    .rmeta.caps {
      font-size: 8px;
      letter-spacing: 0.05em;
    }
    .pill {
      font-size: 8.5px;
      padding: 2px 6px;
    }
    .chip {
      font-size: 7.5px;
      padding: 1.5px 5px;
    }
    /* Two labels across ~150px halves: the pair stays on one line. */
    .ubtn {
      font-size: 12px;
      gap: 4px;
      padding: 7px 4px;
    }
    .bic {
      font-size: 15px;
    }
  }
  .playbtn {
    width: 100%;
    min-height: 52px;
    margin-top: 6px;
    font-size: 17px;
    letter-spacing: 0.02em;
  }
  /* The two secondaries under PLAY, on the finale action row's proportions.
     Both halves are the same fixed height, the seed field included, so opening
     the field cannot move the button beside it. */
  .under {
    display: grid;
    /* minmax(0,·), not 1fr: an auto floor lets the seed field's content widen
       its own track and steal width from the button beside it, which is the
       same jump under the thumb, sideways. */
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 9px;
    margin-top: 9px;
  }
  .under > * {
    min-height: 48px;
  }
  .ubtn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 7px 8px;
    font-size: 13px;
    white-space: nowrap;
  }
  /* Nothing finished yet, or the last game was quit: the button stays in the
     row and goes flat. Same language as an unavailable powerup pill on the
     board — one opacity on the whole control, no dashes and no hue change
     (dashed means unearned, which is a badge's word, not a dead control's).
     0.65 rather than the pill's 0.55: ink over the page ground fades to
     3.76:1 at 0.55, and a 13px bold cap is below the large-text threshold,
     so it needs 4.5:1. 0.65 lands at 5.11:1. */
  .ubtn:disabled {
    opacity: 0.65;
    cursor: default;
  }
  .ubtn:disabled:active {
    transform: none;
  }
  .bic {
    font-size: 17px;
    line-height: 1;
  }
  /* The seed button's # carries the same quiet mono voice as the finale's
     GAME #XXXX chip, which is where a code is copied from. */
  .shash {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    color: var(--muted);
  }
  .seedrow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .seedrow.bad {
    animation: seedshake 0.45s;
  }
  .seedrow.bad .seedin {
    border-color: var(--orange);
    color: var(--orange);
  }
  @keyframes seedshake {
    20%,
    60% {
      transform: translateX(-4px);
    }
    40%,
    80% {
      transform: translateX(4px);
    }
  }
  /* A bare glyph, not a bordered pill like GO: it stands where the 9px # stood
     and a boxed button would cost the field ~28px of the ~150px half at 320px,
     which is width the placeholder cannot spare. The tap target is grown by an
     invisible extension instead — PowerupRow's trick, so the box stays small
     while the thumb target does not. */
  .seedx {
    position: relative;
    flex: none;
    border: none;
    background: none;
    padding: 0 2px;
    font-family: inherit;
    font-weight: 800;
    font-size: 13px;
    line-height: 1;
    color: var(--muted);
    cursor: pointer;
  }
  .seedx::after {
    content: "";
    position: absolute;
    inset: -13px -6px;
  }
  .seedx:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
    border-radius: 6px;
  }
  /* Fluid inside its half-cell: at 320px the pair is ~150px wide each, and a
     fixed field width would push GO out of the row.
     font-size is 16px — the floor below which Mobile Safari auto-zooms a
     focused input. A visual size below 16px is achieved by reducing padding
     rather than the type size. DO NOT drop font-size below 16px here and do
     NOT add maximum-scale to the viewport meta: that would break pinch-zoom
     for every user, not just the ones entering a seed. `autocapitalize="none"`
     keeps the keyboard from switching to uppercase mode; CSS `text-transform`
     handles the uppercase display, so the two do not conflict, and parseSeedCode
     already calls `.toUpperCase()` on the input value. */
  .seedin {
    flex: 1;
    min-width: 0;
    border: 2px dashed var(--gray-ink);
    border-radius: 9px;
    background: var(--card);
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    padding: 2px 8px;
    outline: none;
  }
  .seedin:focus {
    border-style: solid;
    border-color: var(--ink);
  }
  .seedgo {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-family: inherit;
    font-weight: 800;
    font-size: 11px;
    padding: 5px 12px;
    cursor: pointer;
  }
  /* Narrowest phones: the field's half is ~141px. At 16px with base 0.08em
     tracking, a full seven-character seed code still fits, but horizontal
     padding eats into the available glyph width. Drop tracking toward zero
     and tighten horizontal padding so the full code is visible without
     scrolling. (After the base rules, not inside the earlier narrow block:
     equal specificity, source order decides.) */
  @media (max-width: 359px) {
    .seedin {
      letter-spacing: 0.03em;
      padding: 2px 4px;
    }
    .seedgo {
      padding: 5px 9px;
    }
  }
  /* The separator carries the section's 8px bottom padding, like the others. */
  .bestsep {
    margin-top: 20px;
  }
  .book {
    border: 2.5px solid var(--ink);
    border-radius: 12px;
    background: var(--card);
    padding: 10px 12px 11px;
    text-align: center;
  }
  .btable {
    display: grid;
    grid-template-columns: minmax(44px, 1fr) 3fr;
  }
  /* Each zone stacks cap-over-numeral and centers the numeral in the leftover
     height, so G's number sits level with the record even though the season
     zone carries an extra points line. */
  .bcol {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .bcol + .bcol {
    border-left: 2px dashed var(--dash);
  }
  /* Eyebrow over numeral — the finale total stamp's shape in miniature. */
  .bcap {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin-bottom: 1px;
  }
  .bn {
    font-size: 26px;
    font-weight: 800;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
    margin: auto 0;
  }
  .bn.empty {
    color: var(--gray-ink);
  }
  /* The best season the points resolve into — the finale's total stamp shrunk
     to record-book scale, record big and tier-colored, exact points beneath. */
  .brec {
    font-size: 30px;
    font-weight: 900;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  /* The record wears the game's WAR-ladder palette, keyed to its win count —
     the same tier→color mapping as the finale stamp. */
  .brec.neg {
    color: var(--war-neg);
  }
  .brec.low {
    color: var(--war-low);
  }
  .brec.mid {
    color: var(--war-mid);
  }
  .brec.high {
    color: var(--war-high);
  }
  .brec.star {
    color: var(--war-star);
  }
  .brec.elite {
    /* Brighter than --war-elite, matching the finale stamp: at heavy stamp
       weight the token's #c98a08 reads brown; true gold needs the chroma. */
    color: #e0a010;
  }
  /* The exact points, quiet and tabular under the record — the finale's
     .tpts voice sized down to the miniature. */
  .bpts {
    margin-top: 1px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>

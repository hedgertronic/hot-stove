<script lang="ts">
  import { tick } from "svelte";
  import type { Bank, Difficulty, GameConfig, StoredFinale } from "../lib/engine.svelte";
  import { parseSeedCode, recordFromTotal } from "../lib/format";
  import { loadHistory } from "../lib/history";
  import { BANKS, DIFFICULTIES } from "../lib/modes";
  import { bestFor } from "../lib/settings";
  import CornerButtons from "./CornerButtons.svelte";
  import Logo from "./Logo.svelte";
  import SeasonsModal from "./SeasonsModal.svelte";

  let {
    config,
    onplay,
    onopen,
  }: {
    config: GameConfig;
    onplay: (c: GameConfig, seed?: number) => void;
    /** Reopen a finished game's finale, from the seasons list. Only ever called
     * with a record storage still holds. */
    onopen: (rec: StoredFinale) => void;
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


  // The way back into any finished game. Read once: the home screen is rebuilt
  // every time it is shown, and nothing appends to the log while it is on
  // screen. A finished game unmounts this screen on the way to the finale and
  // mounts a fresh one on the way back, so the read is current without any
  // reactivity of its own.
  //
  // GLOBAL, unlike the `best` card above it: every season ever played, whatever
  // mode it was played in. It is both the record book card's footer count and
  // the thing that decides whether that card is a door — a career with seasons
  // only in another combo still has a book to open.
  //
  // Only the count is needed here — whether the list would have anything in it.
  // Which of those seasons can still be reopened is the modal's question, and
  // it reads the archive itself when it mounts rather than making the home
  // screen parse a few hundred kilobytes it has no other use for. Quits are
  // excluded on the log's own marker, the same guard `bestFor` counts games
  // with: a row with no total resolved no season.
  const seasons = loadHistory().filter((e) => typeof e.total === "number").length;

  let seasonsOpen = $state(false);

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

  <!-- The two ways into a game, side by side: a fresh card sequence and a
       shared one. PLAY A SEED sits IN LINE with PLAY rather than a row below
       it, because it is the same decision at a different starting point, and
       because the screen has one fewer row for it — SEASONS is gone from here,
       consolidated into the record book card below.

       The flame is a `.bic` like every other button glyph rather than loose
       text: inline it inherited the button's 17px and rendered visibly smaller
       than the 19px joystick and receipt on the rows around it, which is the
       one place in the game an icon changed size according to its label. -->
  <div class="btnrow under">
    <button class="btn hot playbtn" onclick={() => onplay({ difficulty, bank })}
      >PLAY <span class="bic">🔥</span></button
    >
    <!-- PLAY A SEED swaps ITS OWN cell for the field rather than the row: the
         cell keeps its height and its track width, so PLAY never moves under
         the thumb mid-tap. -->
    {#if seedOpen}
      <div class="seedrow" class:bad={seedBad}>
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
        <!-- GO and its way back out, as a pair on the right of the field: two
             pills of the same shape, the filled one committing the code and the
             outlined one dismissing it. ✕ is the app's one dismissal glyph (the
             header's quit pill, every Sheet's corner). It stands beside GO
             rather than in the field's leading slot so that the row's actions
             are in one place instead of on either side of the thing they act
             on. -->
        <button class="seedgo" onclick={playSeed}>GO</button>
        <button class="seedgo seedx" onclick={cancelSeed} aria-label="Cancel seed entry">✕</button>
      </div>
    {:else}
      <button class="btn ubtn" bind:this={seedBtn} onclick={() => (seedOpen = true)}
        >PLAY A SEED <span class="shash">#</span></button
      >
    {/if}
  </div>

  <!-- The record book, and the door into every season ever played: one surface,
       because they are one question asked twice. The card itself is the punched
       combo's line — the punched rows above name WHICH combo, so it carries no
       label of its own — and tapping it opens the full book, where the best
       season in every mode played sits above the whole list.
       Two zones: G counts this combo's games, box-score style; BEST SEASON is
       the finale's total stamp in miniature — the tier-colored record the best
       total resolves into, with the exact points quiet beneath.

       Disabled on the LOG's count and never on `best.games`: a career whose
       only seasons were played in another combo still has a book to open, and
       a card that went dead every time the punch moved would be a door that
       flickers. -->
  <div class="psep bestsep">RECORD BOOK</div>
  <button
    class="book"
    disabled={seasons === 0}
    aria-label={seasons === 0
      ? "Record book. No seasons yet"
      : "Open the record book and every season played"}
    onclick={() => (seasonsOpen = true)}
  >
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
    <!-- The one thing the card gains by becoming a control: a footer that says
         what is behind it, and counts what is there. -->
    <div class="bmore">
      {seasons === 0 ? "NO SEASONS YET" : seasons === 1 ? "1 SEASON · ALL MODES" : `${seasons} SEASONS · ALL MODES`}
      <!-- Not a `.bic`: that class is the 19px glyph a button LABEL carries,
           and this rides a 9px eyebrow. -->
      <span class="bmic">🧾</span>
    </div>
  </button>

  {#if seasonsOpen}
    <!-- Created fresh on every open, which is what makes its read of the log
         and the archive current. -->
    <SeasonsModal onclose={() => (seasonsOpen = false)} {onopen} />
  {/if}
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
  /* Punched: the dash closes and the tile becomes plain filled cardstock, so
     the line becomes the structural one. The UNpunched border stays ink — it is
     dashed, which is the armed/choosable channel, and that is the one place ink
     still belongs. */
  .row.on {
    border-style: solid;
    border-color: var(--line);
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
    border: 2px solid var(--line);
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
    border: 2px solid var(--line);
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
    /* Two labels across ~150px halves: the pair stays on one line. The glyph
       narrows with them, in app.css beside the glyph's own rule. */
    .ubtn {
      font-size: 12px;
      gap: 4px;
      padding: 7px 4px;
    }
  }
  /* The primary. All-caps at 17px, so app.css's optical correction is
     0.047 × 17 = 0.80px more padding above than below — paid on top of .btn's
     9px rather than out of it, because nothing depends on this button's exact
     height. */
  .playbtn {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9.4px 12px 8.6px;
    font-size: 17px;
    letter-spacing: 0.04em;
  }
  /* PLAY and PLAY A SEED, equal halves. Both cells are the same fixed height,
     the seed field included, so opening the field cannot move PLAY. */
  .under {
    /* minmax(0,·), not 1fr: an auto floor lets the seed field's content widen
       its own track and steal width from the button beside it, which is the
       same jump under the thumb, sideways. */
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    margin-top: 14px;
  }
  .under > * {
    min-height: 52px;
  }
  /* Cell shape, glyph gap and the all-caps optical correction come from
     `.btnrow .btn` in app.css — the same row the finale's three actions are.
     Only the one thing that is this row's own stays here. */
  .ubtn {
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
  /* GO, and the ✕ beside it in the same shape: one filled pill for the commit
     and one outlined pill for the dismissal, which is the app's primary /
     secondary pair at pill scale. */
  .seedgo {
    flex: none;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-family: inherit;
    font-weight: 800;
    font-size: 11px;
    line-height: 1;
    padding: 5px 10px;
    cursor: pointer;
  }
  .seedgo:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* The secondary of the pair: same box, hollow, quiet type. It gives back
     three of the pixels it costs the field by dropping to the glyph's own
     width — a ✕ needs no side bearing the way two letters do. */
  .seedgo.seedx {
    background: transparent;
    border-color: var(--gray-ink);
    color: var(--muted);
    padding: 5px 7px;
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
      padding: 5px 7px;
    }
    .seedgo.seedx {
      padding: 5px 5px;
    }
  }
  /* The separator carries the section's 8px bottom padding, like the others. */
  .bestsep {
    margin-top: 20px;
  }
  /* The card is a control now, so it says so the way every other card-shaped
     control in the app does: cardstock on the structural line, pressed by the
     same 2px nudge, faded whole rather than dashed when there is nothing
     behind it. */
  .book {
    display: block;
    width: 100%;
    border: 2.5px solid var(--line);
    border-radius: 12px;
    background: var(--card);
    padding: 10px 12px 9px;
    text-align: center;
    color: var(--ink);
    font-family: inherit;
    cursor: pointer;
    transition: transform 0.08s;
  }
  .book:active {
    transform: translateY(2px);
  }
  .book:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .book:disabled {
    opacity: 0.65;
    cursor: default;
  }
  .book:disabled:active {
    transform: none;
  }
  /* What is behind the card, and how much of it. Sits on the dashed line the
     book's two columns already share, so the footer reads as part of the same
     ruled sheet rather than as a label stuck underneath one. */
  .bmore {
    margin-top: 9px;
    padding-top: 7px;
    border-top: 2px dashed var(--dash);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .bmic {
    font-size: 12px;
    line-height: 1;
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
    color: var(--record-elite);
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

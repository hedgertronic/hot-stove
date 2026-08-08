<script lang="ts">
  import { tick } from "svelte";
  import type { Bank, Difficulty, GameConfig, StoredFinale } from "../lib/engine.svelte";
  import { parseSeedCode, recordFromTotal } from "../lib/format";
  import { loadArchive, loadHistory } from "../lib/history";
  import { BANKS, DIFFICULTIES } from "../lib/modes";
  import { bestFor } from "../lib/settings";
  import CornerButtons from "./CornerButtons.svelte";
  import Logo from "./Logo.svelte";
  import MakerLink from "./MakerLink.svelte";
  import SeasonsModal from "./SeasonsModal.svelte";

  let {
    config,
    onplay,
    onopen,
    onreplay,
  }: {
    config: GameConfig;
    onplay: (c: GameConfig, seed?: number) => void;
    /** Reopen a finished game's finale, from the seasons list. Only ever called
     * with a record storage still holds; the id names that season's archive row
     * when the archive is where the record came from. */
    onopen: (rec: StoredFinale, id?: string) => void;
    /** Replay a full game code — someone else's finished season, rebuilt from
     * its decision log. Resolves false when the code cannot be replayed on this
     * build, which is the one thing this screen has to say out loud. Optional
     * so the component mounts without a replay host (tests, the lab). */
    onreplay?: (code: string) => Promise<boolean>;
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
  /** The one failure that needs words rather than a shake: a game code that
   * parsed as a game code and still cannot be replayed here (a format this
   * build does not drive, or a decision that no longer applies to rebuilt
   * cards). A mistyped seed is answered by the shake, as it always was —
   * there is nothing to explain about seven characters. */
  let seedErr = $state("");
  /** The button the field replaced, so cancelling can hand focus back to it
   * rather than dropping the keyboard user on the body. */
  let seedBtn = $state<HTMLButtonElement | null>(null);
  /** The pill container — present in both open and closed states, so the
   * click-outside handler can check containment without reading the DOM. */
  let seedZoneEl = $state<HTMLDivElement | null>(null);

  /** The field takes two kinds of code, told apart by SIGIL or SHAPE — no
   * second input, no mode toggle.
   *
   * `@`-prefixed: explicit game code. The sigil is stripped and the remainder
   * is handed to the replay host. If replay fails, the error is shown — the
   * @ makes intent unambiguous, so no fallback to seed-parse.
   *
   * `#`-prefixed or bare ≤7-char base36: a SEED. New game, these cards, your
   * own decisions, counting toward the record book exactly as it always has.
   *
   * Anything else that is ≥12 chars is treated as a bare game code (backward
   * compat for codes copied before the @ sigil was added).
   *
   * The game code is NOT uppercased on the way through. `parseSeedCode` folds
   * case because a seed is base36 either way; a shortcode's verbs are uppercase
   * and its params lowercase, and folding it would destroy every parameter. */
  async function playSeed() {
    seedErr = "";
    const typed = seedInput.trim();
    // Explicit game-code sigil: strip @ and route straight to replay.
    if (typed.startsWith("@")) {
      const code = typed.slice(1);
      if (onreplay && (await onreplay(code))) return;
      badSeed();
      seedErr = "This game code can't be replayed on this version";
      return;
    }
    const bare = typed.replace(/^#/, "");
    if (/^[0-9A-Za-z]{1,7}$/.test(bare)) {
      const seed = parseSeedCode(typed);
      if (seed === null) {
        badSeed();
        return;
      }
      onplay({ difficulty, bank }, seed);
      return;
    }
    if (onreplay && (await onreplay(typed))) return;
    badSeed();
    // A long string that failed is a game code that failed, and that is the
    // case worth naming: nothing about the input says why it was refused.
    if (bare.length >= 12) seedErr = "This game code can't be replayed on this version";
  }

  function badSeed() {
    seedBad = true;
    setTimeout(() => (seedBad = false), 450);
  }

  /** Resets seed entry state without moving focus — used by the click-outside
   * handler, which must not steal focus from whatever the user just tapped. */
  function closeSeed() {
    seedOpen = false;
    seedInput = "";
    seedBad = false;
    seedErr = "";
  }

  // Click-outside: a pointerdown anywhere beyond the pill collapses the field
  // without consuming the tap, so the element the user aimed at still receives
  // its click. Gated on seedOpen so the listener only lives while the field
  // is open — no idle overhead. Capture phase matches CornerButtons' UNDO?
  // handler: it hears taps whose click a component swallows with
  // stopPropagation.
  $effect(() => {
    if (!seedOpen) return;
    const away = (e: Event) => {
      if (e.target instanceof Node && seedZoneEl?.contains(e.target)) return;
      closeSeed();
    };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  });

  /** Open the best season for this mode directly via the archive, or fall back
   * to the seasons sheet when that record has aged out of the bounded tail.
   * The archive is read on tap rather than at render time — the home screen
   * has no other use for it. SeasonsModal's third route (loadStoredFinale for
   * the newest row) is not replicated here: the BEST card is a shortcut into
   * an already-identified season, not a general "open the last finale" path. */
  function openBest() {
    if (!best.bestId) {
      seasonsOpen = true;
      return;
    }
    const archiveMap = new Map(loadArchive().map((r) => [r.id, r]));
    const rec = archiveMap.get(best.bestId);
    if (rec) {
      onopen(rec, best.bestId);
    } else {
      seasonsOpen = true;
    }
  }

  /** Closes the field, clears the input, and hands focus back to the SEED
   * button — the keyboard path that opened the field, reversed. */
  async function cancelSeed() {
    closeSeed();
    // The button re-enters the DOM on the next tick once the {#if} swap renders.
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
  <MakerLink />

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

  <!-- PLAY is the primary path. SEED is the rare path — most sessions start
       fresh — so it sits below PLAY as a compact secondary. The seed zone
       swaps the button for the field in place, so PLAY above it never moves
       under the thumb mid-tap.

       The flame is a `.bic` like every other button glyph rather than loose
       text: inline it inherited the button's 17px and rendered visibly smaller
       than the 19px joystick and receipt on the rows around it. -->
  <div class="under">
    <button class="btn hot playbtn" onclick={() => onplay({ difficulty, bank })}
      ><span class="chiplbl">PLAY</span> <span class="bic">🔥</span></button
    >
    <!-- The seed pill sits below PLAY. The compact button swaps for the field
         in place: the pill grows in width but holds its height, so PLAY above
         it and the record book below it never move under the thumb. -->
    <div class="seedzone" class:open={seedOpen} class:bad={seedBad} bind:this={seedZoneEl}>
      {#if seedOpen}
        <div class="seedrow" class:bad={seedBad}>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="seedin"
            type="text"
            maxlength="140"
            placeholder="#0KF12OY"
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
          <!-- GO alone on the right of the field. The dismissal has two paths
               already — Escape and a tap anywhere outside the pill — and a ✕
               crowded a capsule whose whole redesign was removing boxes from
               inside it. -->
          <button class="seedgo" onclick={playSeed}>GO</button>
        </div>
      {:else}
        <button class="ubtn" bind:this={seedBtn} onclick={() => (seedOpen = true)}
          >SEED <span class="bic">🌱</span></button
        >
      {/if}
    </div>
    <!-- Under the pill, not inside it: the capsule holds a fixed height so the
         PLAY button above never moves, and this line is a sentence. `polite`
         so a screen reader hears it after the field it belongs to. -->
    {#if seedErr}
      <p class="seederr" role="status" aria-live="polite">{seedErr}</p>
    {/if}
  </div>

  <!-- The record book: two cards side by side, each a door into the past.
       GAMES holds the global count and opens the full seasons sheet. BEST holds
       this mode's highest total and opens that season's finale directly via the
       archive; if the record has aged out, it falls back to the seasons sheet.

       GAMES is disabled on the LOG's count — a career played entirely in
       another combo still has a book to open. BEST is disabled when `season`
       is null: there is no best for this combo yet, so there is nowhere for
       the card to go. Both cards always render the same element structure so
       switching modes does not change the area's height. -->
  <div class="psep bestsep">RECORD BOOK</div>
  <div class="books">
    <button
      class="book book-g"
      disabled={seasons === 0}
      aria-label={seasons === 0
        ? "Record book. No seasons yet"
        : "Open the record book and every season played"}
      onclick={() => (seasonsOpen = true)}
    >
      <!-- Two rows: mode-scoped count big, global total small beneath.
           `.btotal` is always rendered — `invis` reserves the space without
           the text so the card height holds steady when no seasons exist. -->
      <div class="bcol">
        <div class="bcap">GAMES</div>
        <div class="bn" class:empty={best.games === 0}>{best.games}</div>
        <div class="btotal" class:invis={seasons === 0}>{seasons} TOTAL</div>
      </div>
    </button>
    <button
      class="book book-b"
      disabled={season === null}
      aria-label={season === null
        ? "Best season for this mode. No games played yet"
        : `Open best season: ${season.wins}–${season.losses}, ${season.pts} points`}
      onclick={openBest}
    >
      <div class="bcol">
        <div class="bcap">BEST SEASON</div>
        <!-- `.brec` and `.bpts` always render — one at full opacity, one
             hidden — so the card height is the same whether or not a best
             season exists for the punched combo. The hidden line holds a
             no-break space, not "": an empty div has no line box, so the
             column ran one line short and the button's default vertical
             centering floated the caption and the dash to the middle of the
             grid-stretched card — the layout only holds if the reserve has
             actual height. -->
        <div class="brec {season ? season.tier : 'empty'}">{season ? `${season.wins}–${season.losses}` : "—"}</div>
        <div class="bpts" class:invis={!season}>{season ? `${season.pts} PTS` : "\u00a0"}</div>
      </div>
    </button>
  </div>

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
  /* Each fixed-cap bank's punched row wears its club: Moneyball is Oakland's
     own green (which happens to double as the thrift read), Blank Check is
     Yankee pinstripe navy. The bright --yellow it used to wear is the same
     shouting gold the owner tile gave up for teal — at row scale it drowned
     the punch mark, and gold now belongs to the WAR ladder's elite chips.
     PayrollBox tints its fixed-cap payroll pill with these same pairs, so
     the color chosen here is the color the whole game wears. */
  .row.on.mb {
    background: var(--green-wash);
    border-color: var(--green-8);
  }
  .row.on.bc {
    background: var(--blue-2);
    border-color: var(--blue-8);
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
  /* The chipbox trade, restated for this one flex button: PLAY rides in a
     .chiplbl, so where the engine can trim, the label measures its own cap
     band and flex centering seats it — the hand skew above must stand down or
     it would push the trimmed band off center. The flame is a bare flex item
     with no cap band, centered by the box alone, like every chip emoji. */
  @supports (text-box: trim-both cap alphabetic) {
    .playbtn {
      padding-block: 9px;
    }
  }
  /* PLAY on top, SEED zone below: flex column so opening the seed field
     cannot move PLAY regardless of the zone's height. */
  .under {
    display: flex;
    flex-direction: column;
    gap: 13px;
    margin-top: 14px;
  }
  /* The seed pill sits below PLAY, centered. Width transitions between the
     compact closed state (110px, "SEED 🌱") and the open state (180px, input
     row); both are pixel values so the Safari transition engine can interpolate
     without measuring — animating to/from `auto` or `fit-content` is not
     Safari-safe. `overflow:hidden` clips growing content during the transition.
     height:34px pins the pill to the natural height of the SEED button
     (2.5px border + 5px padding + 18.6px line-height + 5px padding + 2.5px),
     giving both states an identical box — the root cause of the prior
     "shorter" reading was that UA stylesheets reset `line-height` to `normal`
     on <input> elements (~19px at 16px font), leaving the input row ~7px
     shorter than the pill. Moving the border here removes that disparity.
     The focus ring lives on the pill element itself — `outline` is painted
     outside the element's border-box and is NOT clipped by the element's own
     `overflow:hidden`. app.css's prefers-reduced-motion rule disables the
     fade-in animation via `animation: none !important`. */
  .seedzone {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    width: 110px;
    max-width: 100%;
    margin: 0 auto;
    border: 2.5px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    overflow: hidden;
    transition: width 0.18s ease, transform 0.08s;
  }
  .seedzone.open {
    width: 180px;
  }
  /* Open, the capsule IS the field: the input inside draws no box of its own
     (see .seedin), so the pill's border does the field's work. Focus and the
     bad-code shake both report at this border — the one stroke on screen —
     instead of on a second box nested inside it. */
  .seedzone.open:focus-within {
    border-color: var(--ink);
  }
  .seedzone.bad {
    border-color: var(--orange);
  }
  /* Press dip on the closed pill only — clicking GO or the input should not
     dip the pill while entry is in progress. */
  .seedzone:not(.open):active {
    transform: translateY(2px);
  }
  /* Focus ring: inset outlines on the individual interactive children so the
     ring appears only for keyboard navigation, not for touch/mouse. An inset
     outline (outline-offset: -3px) is painted inside the border box and is
     therefore not clipped by overflow: hidden on the pill container. */
  /* The one spoken failure — a game code this build cannot replay. Quiet
     rather than alarming: it is a stale code, not a mistake the player made. */
  .seederr {
    margin: 6px auto 0;
    max-width: 260px;
    text-align: center;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
    color: var(--muted);
  }
  /* Fade-in on mount. The shake animation on .seedrow.bad overrides this
     for the error state (higher specificity, source order). */
  @keyframes seedfade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .seedzone .seedrow,
  .seedzone .ubtn {
    animation: seedfade 0.15s ease-out;
  }
  /* The SEED label inside the pill — no border or background of its own;
     the pill provides the card shape and the press dip. Full width and height
     fill the tap target to the pill's edges. */
  .ubtn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 12px;
    font-size: 12px;
    font-family: inherit;
    font-weight: 800;
    letter-spacing: 0.04em;
    white-space: nowrap;
    border: none;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
    width: 100%;
    height: 100%;
  }
  /* Inset ring follows the pill's rounded shape; border-radius matches the
     pill's full-round value so the ring hugs the curve rather than cutting
     a rectangle inside it. */
  .ubtn:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: -3px;
    border-radius: 999px;
  }
  @media (max-width: 359px) {
    .ubtn {
      padding: 0 8px;
      font-size: 11px;
    }
  }
  /* Asymmetric on purpose: GO is a pill inside a pill, and concentric shapes
     want equal margins — the capsule leaves it ~2px above and below, so the
     right inset matches at 3px instead of the text side's 12px. The input's
     side keeps real inset because bare type against a curved stroke needs
     it; a drawn box doesn't. */
  .seedrow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 0 3px 0 12px;
  }
  .seedrow.bad {
    animation: seedshake 0.45s;
  }
  .seedrow.bad .seedin {
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
  /* No box of its own — a bordered rectangle inside a capsule left wedge gaps
     at the rounded ends and read as two nested controls. The capsule is the
     field now: the input is bare text, the caret and the placeholder say
     "type here", and focus reports at the pill's own border (.seedzone.open
     :focus-within above). */
  .seedin {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    padding: 0;
    outline: none;
  }
  /* GO, the field's one action: the filled ink pill that commits the code.
     Dismissal has no button — Escape and a tap outside the capsule both
     close it, and a ✕ crowded the capsule this used to be two boxes inside. */
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
  /* Inset ring — same pattern as .ubtn. border-radius on .seedgo is already
     set above (11px). */
  .seedgo:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: -3px;
  }
  /* Narrowest phones: the field's half is ~141px. At 16px with base 0.08em
     tracking, a hash-prefixed eight-character code (#0KF12OY) still fits,
     but horizontal padding eats into the available glyph width. Drop tracking
     toward zero and tighten horizontal padding so the full code is visible
     without scrolling. (After the base rules, not inside the earlier narrow
     block: equal specificity, source order decides.) */
  @media (max-width: 359px) {
    .seedin {
      letter-spacing: 0.03em;
    }
    .seedgo {
      padding: 5px 7px;
    }
  }
  /* The separator carries the section's 8px bottom padding, like the others. */
  .bestsep {
    margin-top: 20px;
  }
  /* Two cards side by side: GAMES narrower (global log count), BEST wider
     (punched-combo best season). The grid mirrors the old btable proportions
     so the visual weight of the two zones stays the same. */
  .books {
    display: grid;
    grid-template-columns: minmax(44px, 1fr) 3fr;
    gap: 9px;
  }
  /* Each card is a control: cardstock on the structural line, pressed by the
     same 2px nudge, faded whole rather than dashed when nothing is behind it. */
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
  /* Each card stacks cap-over-numeral. `height: 100%` is the alignment
     contract: the grid stretches both buttons to one height, and a button
     vertically CENTERS its content — so if either column ran shorter than
     its card (different font metrics on .bn vs .brec, a collapsed reserve
     line), its caption floated below the other's. Filling the button pins
     both caps to the top edge and both footers to the bottom, whatever the
     lines in between measure. */
  .bcol {
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }
  /* The hidden halves of each card's height reserve: both `.bpts` and
     `.btotal` are always in the DOM so card heights do not change between
     modes. `visibility: hidden` reserves the space without showing the value. */
  .bpts.invis,
  .btotal.invis {
    visibility: hidden;
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
    /* Centers in the grid-stretched cell the same way .bn does on the GAMES
       card, so the two record-book columns hold one baseline rhythm. */
    margin: auto 0;
  }
  /* The record wears the game's WAR-ladder palette, keyed to its win count.
     The color is app.css's record ladder — `.brec.elite` and its five
     siblings, the same six rules the finale stamp and the seasons list read.
     Only the size and the weight are this surface's own. */
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
  /* Global total under the mode-scoped count on the GAMES card. Same quiet
     voice as .bpts so the two cards read in the same register. */
  .btotal {
    margin-top: 2px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>

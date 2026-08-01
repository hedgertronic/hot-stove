<script lang="ts">
  import { type Bank, type Difficulty, type GameConfig } from "../lib/engine.svelte";
  import { parseSeedCode, recordFromTotal } from "../lib/format";
  import { BANKS, DIFFICULTIES } from "../lib/modes";
  import { BADGES, type BadgeDef, type Rarity } from "../lib/badges";
  import { badgeCase, bestFor } from "../lib/settings";
  import BadgePill from "./BadgePill.svelte";
  import HelpModal from "./HelpModal.svelte";
  import Logo from "./Logo.svelte";

  let {
    config,
    onplay,
  }: { config: GameConfig; onplay: (c: GameConfig, seed?: number) => void } = $props();

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

  // The trophy case is lifetime and global — it does not move when the punched
  // rows above change, so it is read once at mount rather than derived.
  const trophies = badgeCase();
  const earnedCount = new Map(trophies.tiles.map((t) => [t.key, t.count]));

  /** The collection ladder as sections, rarest first. Rarity is a heading over
   * a band of pills rather than a word on each pill: every pill under a heading
   * shares its tier, so the word still carries rarity on a channel that is not
   * color — it is just printed once instead of N times. */
  const CHASED: Rarity[] = ["legend", "ultra", "rare", "uncommon", "common"];

  interface CaseSlot {
    def: BadgeDef;
    count: number;
    locked: boolean;
  }

  function slots(rarity: Rarity): CaseSlot[] {
    const band = BADGES.filter((b) => b.rarity === rarity);
    // Earned first, then the silhouettes still out there. Anti-trophies never
    // get a locked slot: an empty slot is an invitation, and inviting someone
    // to lose 100 games inverts the incentive.
    return [
      ...band
        .filter((b) => earnedCount.has(b.key))
        .map((b) => ({ def: b, count: earnedCount.get(b.key)!, locked: false })),
      ...band
        .filter((b) => !b.ironic && !earnedCount.has(b.key))
        .map((b) => ({ def: b, count: 1, locked: true })),
    ];
  }

  const sections = [...CHASED, "ironic" as Rarity]
    .map((rarity) => ({ rarity, items: slots(rarity) }))
    .filter((s) => s.items.length > 0);

  let helpOpen = $state(false);

  // PLAY A SEED: a shared code replays that game's exact card sequence
  // under whatever mode combo is selected above.
  let seedOpen = $state(false);
  let seedInput = $state("");
  let seedBad = $state(false);

  function playSeed() {
    const seed = parseSeedCode(seedInput);
    if (seed === null) {
      seedBad = true;
      setTimeout(() => (seedBad = false), 450);
      return;
    }
    onplay({ difficulty, bank }, seed);
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
  <button class="help" onclick={() => (helpOpen = true)} aria-label="How to play">?</button>

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

  {#if seedOpen}
    <div class="seedrow" class:bad={seedBad}>
      <span class="seedhash">#</span>
      <input
        class="seedin"
        type="text"
        maxlength="8"
        placeholder="KF12OY"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        bind:value={seedInput}
        onkeydown={(e) => e.key === "Enter" && playSeed()}
      />
      <button class="seedgo" onclick={playSeed}>GO</button>
    </div>
  {:else}
    <button class="seedlink" onclick={() => (seedOpen = true)}>PLAY A SEED #</button>
  {/if}

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

  <!-- The trophy case: a lifetime collection, closed by default so the home
       screen stays a menu. The board is the whole set — earned badges wear the
       finale's own pill, unearned ones a silhouette, so the case answers "what
       is left" as well as "what I have". Anti-trophies appear only once earned
       and sit outside the fraction: they are neither chased nor countable, but
       they do get a pill. -->
  <details class="case">
    <summary class="psep casesum">
      <span class="casetitle">
        TROPHY CASE · {trophies.earned} OF {trophies.total}
        <span class="caret" aria-hidden="true">▸</span>
      </span>
    </summary>
    {#if trophies.tiles.length === 0}
      <p class="caseempty">No badges yet — play a season.</p>
    {/if}
    {#each sections as s (s.rarity)}
      <div class="band">
        <div class="bcap bandcap">{s.rarity}</div>
        <!-- Focusable so the band is reachable by keyboard: it is a scroll
             container, and its offscreen pills are unreachable without arrow
             keys. Deliberately a noninteractive element with tabindex — that
             is the scrollable-region pattern WCAG 2.1.1 asks for, and it is
             the exception the lint rule cannot see. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div class="bandrow" role="group" aria-label="{s.rarity} badges" tabindex="0">
          {#each s.items as slot (slot.def.key)}
            <BadgePill badge={slot.def} count={slot.count} locked={slot.locked} />
          {/each}
        </div>
      </div>
    {/each}
  </details>
</div>

{#if helpOpen}
  <HelpModal onclose={() => (helpOpen = false)} />
{/if}

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
  /* Same twin pill as the in-game HUD's ?, hugging the column's top-left. */
  .help {
    position: absolute;
    top: 0;
    left: 0;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    color: var(--muted);
    font-family: inherit;
    font-weight: 800;
    font-size: 10px;
    line-height: 1;
    padding: 4px 0;
    width: 28px;
    text-align: center;
    cursor: pointer;
  }
  .help:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
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
  }
  .row.on.bc {
    background: var(--yellow);
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
  }
  .playbtn {
    width: 100%;
    min-height: 52px;
    margin-top: 6px;
    font-size: 17px;
    letter-spacing: 0.02em;
  }
  /* Same quiet mono voice as the finale's GAME #XXXX chip it pairs with. */
  .seedlink {
    display: block;
    margin: 12px auto 0;
    background: none;
    border: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--muted);
    cursor: pointer;
    padding: 4px 8px;
  }
  .seedrow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 10px;
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
  .seedhash {
    font-weight: 800;
    font-size: 13px;
    color: var(--muted);
  }
  .seedin {
    width: 110px;
    border: 2px dashed var(--gray-ink);
    border-radius: 9px;
    background: var(--card);
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
    padding: 5px 8px;
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
  /* The case reuses .psep whole, so it adds no header style — only the bits a
     <summary> needs that a <div> does not. The native marker is suppressed and
     replaced by a caret inside the label, because a flex summary drops the
     disclosure triangle in WebKit and a collapsed section with no affordance
     is a hidden feature. */
  .case {
    margin-top: 20px;
  }
  .casesum {
    cursor: pointer;
    list-style: none;
  }
  .casesum::-webkit-details-marker {
    display: none;
  }
  .casesum:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .casetitle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .caret {
    font-size: 8px;
    transition: transform 0.12s;
  }
  .case[open] .caret {
    transform: rotate(90deg);
  }
  .caseempty {
    margin: 0;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--gray-ink);
    padding: 6px 0 2px;
  }
  /* One rarity band: the tier word as an eyebrow over a single row of pills.
     It borrows .bcap's voice — the record book's caption — rather than adding a
     third header style to a screen that already has .psep and .bcap. */
  .band + .band {
    margin-top: 9px;
  }
  .bandcap {
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  /* The band scrolls in x by itself; the page never does. Grid rather than
     flex so the pills keep their content width — a flex child shrinks below it
     and the row would compress instead of overflowing — and because the pills
     come from BadgePill, whose class Home's scoped CSS cannot reach.

     overflow-x: auto, never hidden: `hidden` on one axis computes the other to
     auto, which makes a scroll container out of anything above the pinned
     roster rail. The padding-bottom leaves room for a scrollbar so the x bar
     cannot induce a y bar of its own. */
  .bandrow {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: max-content;
    justify-content: start;
    gap: 6px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: thin;
    padding-bottom: 4px;
  }
  .bandrow > :global(.brag) {
    scroll-snap-align: start;
  }
  .bandrow:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
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

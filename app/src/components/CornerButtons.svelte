<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import {
    clearBadgeCue,
    firstEverPlay,
    loadCues,
    markHelpSeen,
    noteNewBadges,
  } from "../lib/settings";
  import { track } from "../lib/analytics";
  import { showingTheme, toggleTheme } from "../lib/theme";
  import CornerPillArt from "./CornerPillArt.svelte";
  import HelpModal from "./HelpModal.svelte";
  import TrophyModal from "./TrophyModal.svelte";

  /** The corner control pair — ? and trophy case — plus the two sheets they
   * open and the persisted cues that light them.
   *
   * One component rather than a copy per screen because the home screen and
   * the in-game HUD show the SAME pair and must clear the SAME flag: a player
   * who opens the case from the finale has to find the home screen's trophy
   * already dark. Duplicated markup can be kept in sync by hand; duplicated
   * writes to one storage key cannot.
   *
   * Rendered as a bare pair with no wrapper, so each host keeps the
   * positioning context it already had — the HUD is a centered flex row where
   * the pills take their vertical position from `align-items`, the home screen
   * is a block that pins them to its top edge (`home`).
   *
   * `newBadges` is the finale's first-time-ever badge list, or null anywhere
   * that is not a finale. The home screen never passes it.
   *
   * `game` is the live run, and it is what the undo pill needs. The pill is
   * drawn only where there is a game to rewind, so the home screen keeps its
   * pair in the left corner and the in-game HUD gains a third beside the ✕.
   *
   * `pushed` and `onconfirm` are the two halves of one arrangement: the undo
   * pill and the ✕ are neighbours drawn by different components, and each one's
   * confirm state has to reach the other. The host says "my ✕ is armed, step
   * back" with `pushed`; this component says "mine is armed" with `onconfirm`,
   * and the host steps the ✕ and the wordmark back the same way. Neither pill
   * owns the pair, so neither can be moved without the other hearing about it. */
  let {
    home = false,
    newBadges = null,
    game = null,
    pushed = false,
    onconfirm,
    oninstructs = null,
    onfinaleinstructs = null,
  }: {
    home?: boolean;
    newBadges?: string[] | null;
    game?: Game | null;
    pushed?: boolean;
    onconfirm?: (armed: boolean) => void;
    /** Restarts the INSTRUCTS tour (App owns the flag). Passed through to the
     * help sheet only while a landed card gives the tour a board to point at
     * — the same gate App's own render puts on the tour. */
    oninstructs?: (() => void) | null;
    /** Restarts the FINALE's tour. Same button, same label — the help sheet
     * routes to whichever tour the current screen can actually replay, and
     * during the finale that is this one. */
    onfinaleinstructs?: (() => void) | null;
  } = $props();

  let cues = $state(loadCues());
  let unplayed = $state(firstEverPlay());

  let helpOpen = $state(false);
  let trophyOpen = $state(false);

  // A finale is the one event that can light the trophy, and also the moment
  // the player stops being a first-timer. Noting the same list twice is a
  // no-op, so a re-run costs nothing.
  $effect(() => {
    if (!newBadges) return;
    unplayed = false;
    if (newBadges.length > 0) cues = noteNewBadges(newBadges);
  });

  const badgeCue = $derived(cues.pendingBadges.length > 0);
  const badgeCount = $derived(cues.pendingBadges.length);
  // Dark once the sheet has been opened, and dark once a game has been
  // finished — a player who worked it out unaided has stopped needing the
  // nudge just as surely as one who read the rules.
  const helpCue = $derived(!cues.helpSeen && unplayed);

  // stopPropagation on both: the HUD sits above click handling tied to the
  // landed card, and a bare button would commit a pick on the way to opening a
  // sheet. Harmless on the home screen, which listens for nothing.
  function openHelp(e: MouseEvent) {
    e.stopPropagation();
    if (!cues.helpSeen) cues = markHelpSeen();
    helpOpen = true;
  }

  function openTrophy(e: MouseEvent) {
    e.stopPropagation();
    if (badgeCue) cues = clearBadgeCue();
    trophyOpen = true;
  }

  /** Two-tap undo, the ✕'s rule and the ✕'s 2500ms — one destructive control in
   * the corner cannot ask for a confirm while its neighbour takes a thumb tap
   * and spends the only rewind the game gives.
   *
   * Lapsing rather than dismissing, exactly as quit does: the confirm expires
   * on its own and nothing else takes it down. A player who meant something
   * else taps that something else and the pill goes quiet behind him. */
  const CONFIRM_MS = 2500;
  let undoArmed = $state(false);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;

  // stopPropagation for the pair's reason above: the pill sits over click
  // handling tied to the landed card, and the tap that rewinds a move must not
  // also reach the market it rewound.
  function tapUndo(e: MouseEvent) {
    e.stopPropagation();
    clearTimeout(undoTimer);
    if (undoArmed) {
      undoArmed = false;
      game?.undo();
      return;
    }
    undoArmed = true;
    undoTimer = setTimeout(() => (undoArmed = false), CONFIRM_MS);
  }

  /** A tap anywhere that is not this pill answers "UNDO?" with no — the same
   * outcome as letting it lapse, without the 2.5s wait, and the tap still
   * lands on whatever it was aimed at. Capture phase for the quit pill's
   * reason (App.svelte): components swallow clicks with stopPropagation, but
   * nothing swallows a capture-phase pointerdown. The arming tap can never
   * trip it: that tap's pointerdown fired before this effect installed the
   * listener. */
  let undoEl = $state<HTMLButtonElement | undefined>();
  $effect(() => {
    if (!undoArmed) return;
    const away = (e: Event) => {
      if (e.target instanceof Node && undoEl?.contains(e.target)) return;
      clearTimeout(undoTimer);
      undoArmed = false;
    };
    window.addEventListener("pointerdown", away, true);
    return () => window.removeEventListener("pointerdown", away, true);
  });

  // The rewind can go away underneath an armed pill — the reel lands, the club
  // completes, the run is quit — and a "UNDO?" left sitting on a dead control
  // is asking for a second tap that would do nothing at all.
  $effect(() => {
    if (game?.canUndo) return;
    clearTimeout(undoTimer);
    undoArmed = false;
  });

  // QUIT? arming answers UNDO? with no — the mirror of App's onconfirm
  // handler, and the half the pointerdown away-listeners can't cover: a
  // keyboard activation fires no pointerdown, so without this two armed
  // confirms could sit side by side. `pushed` IS "the ✕ is armed".
  $effect(() => {
    if (!pushed) return;
    clearTimeout(undoTimer);
    undoArmed = false;
  });

  // The host dims the ✕ and the wordmark while this confirm is up, so it has to
  // hear every change including the one the timeout makes with no tap behind it.
  // Braces, not a bare arrow: an expression body hands the callback's return
  // value to svelte as this effect's teardown.
  $effect(() => {
    onconfirm?.(undoArmed);
  });

  /** The day/night pill. Local state mirrors the document attribute (both
   * are written by toggleTheme) so the face and the aria-label follow the
   * tap without a re-render of anything else. Seeded from showingTheme so a
   * remount — home↔game, or a second CornerButtons pair — always shows the
   * face the page is actually wearing. */
  let theme = $state(showingTheme());

  /** The attribute has a writer this component can't hear: watchSystemTheme
   * restamps it when the OS flips at sunset and no choice is stored. A pill
   * still holding its mount-time snapshot would then advertise the wrong
   * destination — and the next tap would do the opposite of its label. The
   * observer makes the ATTRIBUTE the single source of truth: every writer
   * (toggle, OS watcher, boot script) lands here and the face follows. */
  $effect(() => {
    const sync = () => (theme = showingTheme());
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    sync();
    return () => mo.disconnect();
  });

  // stopPropagation for the pair's reason above.
  function tapTheme(e: MouseEvent) {
    e.stopPropagation();
    theme = toggleTheme();
    track("theme_toggle", { theme });
  }

  // The confirm outlives this component otherwise: quitting mid-confirm unmounts
  // the HUD with the timer still booked, and it fires into a component that is
  // gone. Teardown reads nothing, so it runs once and its teardown is the
  // unmount (SpinBanner's cancelReel is here for the same reason).
  $effect(() => () => clearTimeout(undoTimer));
</script>

<!-- NO gridsnap on the corner pills, by measurement rather than oversight:
     the owner's own screenshots showed these rings painting symmetric
     (12/12) at their natural offsets — the split-pixel problem is the award
     chips' (stacked half-pixel remainders in market rows), not this row's —
     while snapping here caused visible late micro-jumps and absorbed the
     armed/pushed transforms into a persistent wrong offset. What made these
     glyphs read low was the OPTICAL seat, fixed in the svgs' own viewBoxes. -->
<button
  class="help chipbox"
  class:home
  class:cue={helpCue}
  onclick={openHelp}
  aria-label={helpCue ? "How to play: start here" : "How to play"}
  ><CornerPillArt glyph="help" /></button
>
<button
  class="help trophy chipbox"
  class:home
  class:cue={badgeCue}
  onclick={openTrophy}
  aria-label={badgeCue
    ? `Collectibles: ${badgeCount} new badge${badgeCount === 1 ? "" : "s"}`
    : "Collectibles"}><CornerPillArt glyph="trophy" /></button
>

<!-- The day/night pill, third in the left group. The face shows where the
     tap GOES (moon by day, sun by night) — the destination convention, so
     the pill reads as an offer rather than a status lamp. No armed state,
     no cue, no confirm: a theme flip is instantly reversible, so one tap is
     the act, like the ? beside it. -->
<button
  class="help theme chipbox"
  class:home
  onclick={tapTheme}
  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
  ><CornerPillArt glyph={theme === "dark" ? "sun" : "moon"} /></button
>

<!-- The third pill, drawn only where there is a run to rewind — the home
     screen passes no game and keeps its pair.
     Line art rather than ↩️ for the trophy's reason: a color emoji dropped into
     a 10px text-glyph pill sits low and reads as a sticker on a control. -->
{#if game}
  <button
    class="help undo chipbox"
    class:armed={undoArmed}
    class:pushed={pushed && !undoArmed}
    disabled={!game.canUndo}
    bind:this={undoEl}
    onclick={tapUndo}
    aria-label={undoArmed ? "Undo last move: tap again to confirm" : "Undo last move"}
    >{#if undoArmed}<span class="chiplbl">UNDO?</span>{:else}<CornerPillArt
        glyph="undo"
      />{/if}</button
  >
{/if}

{#if helpOpen}
  <HelpModal
    onclose={() => (helpOpen = false)}
    gameLog={game?.debugLog() ?? null}
    oninstructs={oninstructs != null &&
    game != null &&
    game.phase === "landed" &&
    game.card != null &&
    !game.coldStove
      ? () => {
          helpOpen = false;
          oninstructs?.();
        }
      : onfinaleinstructs != null && game != null && game.phase === "finale"
        ? () => {
            helpOpen = false;
            onfinaleinstructs?.();
          }
        : null}
  />
{/if}

{#if trophyOpen}
  <TrophyModal onclose={() => (trophyOpen = false)} />
{/if}

<style>
  /* The ? and the case are twins of the HUD's ✕: a fixed width (no horizontal
     padding, text centered) guarantees the same footprint regardless of glyph
     width. */
  .help {
    position: absolute;
    left: 0;
    /* Transparent, not none: resting, the capsule is DRAWN by CornerPillArt
       (one svg for ring and glyph, so no engine can seat them apart), and
       the button's own border/background return only for the armed text
       state. The 2px WIDTH stays so the box metrics, the cue ::after
       geometry, and the armed capsule are byte-identical to the old CSS
       ring. */
    border: 2px solid transparent;
    border-radius: 999px;
    background: transparent;
    /* Ink mark on the gray ring (owner call, 2026-08-10): the mark is the
       pill's content and the ring its furniture, so the mark carries the
       darkest ink — muted left the glyph LIGHTER than its own --line ring.
       The tour's nav arrows always sat ink-on-gray; this joins the family
       to them. The cue/lens states' own `color: ink` lines are now
       restatements; their emphasis rides the fill and ring channels. */
    color: var(--ink);
    font-family: inherit;
    font-weight: 800;
    /* 12px, not 10: the trophy is a 13px drawing, and a 10px ? beside it read
       as the smaller sibling rather than its twin. */
    font-size: 12px;
    /* Inline only — the block axis belongs to the chipbox recipe these pills
       wear (markup class), which seats the caps on center in both engines; a
       `padding: 0` shorthand would kill its non-trim fallback correction. */
    padding-inline: 0;
    width: 28px;
    text-align: center;
    cursor: pointer;
    /* One pinned box for all three corner pills (text glyphs + 13px trophy). */
    --chip-h: 22px;
    box-sizing: border-box;
    /* Press feedback. app.css kills every transition for reduced-motion readers
       with `* { transition: none !important }`, so no component-level guard
       is needed here. */
    transition: transform 0.08s;
  }
  /* The same tactile dip the market rows use (PlayerList .prow:active). */
  .help:active {
    transform: translateY(1.5px);
  }
  /* The undo pill dips like everything else (owner call, 2026-08-12,
     superseding the round-34 hold-still): every pressable thing presses,
     one dip vocabulary. The round-34 glitch — press + width animation +
     glyph swap compositing into a hop (owner report, 2026-08-09) — was the
     UP-LEFT lift's; the house translateY sinks with the finger and returns
     on the same axis the width change never touches. */
  .undo:active {
    transform: translateY(1.5px);
  }
  /* A dead control refuses the dip (the house dead-state pin — Home .book,
     SeasonsModal .row): a spent rewind that still pressed would promise a
     tap it can't honor. */
  .undo:disabled:active {
    transform: none;
  }
  /* The HUD is a centered flex row and hands the pills their vertical position;
     the home screen is a plain block, so there they pin near its top edge —
     at the HUD's OWN seat, not the block's. The pair is constant chrome that
     survives the home↔game swap in place, and the two screens' containers
     start 3.5px apart; measured against the HUD row, -3.5px is what keeps
     the pills from hopping when the screen changes under them. */
  .help.home {
    top: -3.5px;
  }
  /* The case sits inboard of the ?, sharing its geometry — one control group
     in the corner rather than two unrelated glyphs. `right: auto` matters on
     the home screen: a rule setting only `right` would leave both pills
     anchored to the same corner. */
  .trophy {
    left: 32px;
    right: auto;
  }
  /* Third in the group, sharing the pair's geometry. left: 64px is the seat
     the undo pill's comment below weighs and declines FOR A CONFIRM control
     (an armed word growing leftward from here would exit the corner); this
     pill never arms and never grows, so the seat is safe — the left group
     runs 92px into a corner the HUD's centered lockup clears at every
     supported width (verified at 360px). `right: auto` for the trophy's
     reason above. */
  .theme {
    left: 64px;
    right: auto;
  }
  /* Inboard of the ✕, which App.svelte pins at `right: 0` — the mirror of the
     trophy sitting inboard of the ?. `left: auto` matters for the reason the
     trophy needs `right: auto`: `.help` anchors to the left corner by default,
     and a rule setting only `right` would leave this pill in both.

     A third pill at `left: 64px`, beside the ? and the case, is the placement
     this corner was chosen OVER, and the wordmark is why. The HUD centers the
     lockup in a flex row while these pills sit absolute above it, so the two
     sides are not interchangeable: the left group would need 92px of corner
     and the right pair needs 60px. The compact HUD lockup and optional mode
     chip remain clear of `right: 32px` at common phone widths.

     What this corner costs is a confirm's armed state. Either pill armed grows
     its word leftward — "QUIT?" to about 56px (pinned in App.svelte), "UNDO?"
     to about 62px (pinned below) — which is wider than the 32px gap between
     the two anchors. So an armed pill WILL reach across its neighbour, and the
     answer is that the neighbour gets out of the way (see `.pushed`) rather
     than that the pill is stopped from growing.
     Neither anchor moves: a confirm that slid this pill into the ✕'s corner
     would put a rewind under the thumb aimed at a quit, and walk the quit
     target 32px sideways when the confirm lapsed — the same hazard
     `.undo:disabled` refuses below, arriving from the other direction. */
  .undo {
    left: auto;
    right: 32px;
    /* NO resting z-index, deliberately: a positioned element with a z-index
       is a stacking context, and at rest this pill must not be one. Safari's
       compositor hoists such an element onto its own layer while neighbours
       animate — and the reel landing animates plenty (the banner thunk, the
       market's entrance) — then drops it when they finish; each hop
       re-rasterizes the svg face at fresh device-pixel rounding on the HUD's
       half-pixel seat, and the owner watched the pill rise and settle at
       every landing while the ✕ beside it held still (this pill was the
       row's ONE resting stacking context). Stack order needs no help here
       anyway: the confirm states carry their own z-index (`.undo.armed` and
       `.quit.armed` are 2; the pushed states carry none), and the resting pills never
       overlap — an armed word grows across the BRAND, which is in-flow and
       paints under any positioned pill by default. */
    /* Width transitions alongside the pushed slide's margin so arming and
       lapsing read as one motion rather than a snap. QUIT? in App.svelte
       does NOT transition width, so UNDO? animates slightly more — that is
       the right tradeoff: the pill grows leftward into the wordmark, and an
       animated expand reads gentler than a snap. color at the same 0.12s so
       the pushed ghost FADES through the channels (a paint-only fade — the
       capsule's fill/stroke carry the matching transition in
       CornerPillArt); transform at the house 0.08s so the press dip eases
       like every other pill's.

       Opacity is NOT in this list — and `.undo:disabled` below never touches
       the property at all: the disabled dim rides the svg's color channels,
       so the pill's element opacity is a CONSTANT 1 through every sign,
       rewind and land, exactly like its twins'. The full reasoning sits on
       the disabled rule. app.css kills every transition for reduced-motion
       readers, who get the same end states instantly. */
    transition:
      width 0.12s ease,
      margin-right 0.12s ease,
      color 0.12s ease,
      transform 0.08s;
  }
  /* Armed, the pill carries a word ("UNDO?") in the ✕'s confirm colors — one
     confirm language for the pair, so the second tap means the same thing
     wherever it is asked for.
     Width is pinned to a number (not `auto`) so the transition can interpolate
     it. "UNDO?" measures about 38px in bundled Nunito at 800/12px; 62px seats
     it centered with the same side room QUIT?'s 56px provides. The .help.pushed
     arithmetic uses QUIT?'s 56px ((56 + 4px gap − 32px anchor) = 27px push)
     and is unaffected by this pill's own armed width. */
  .undo.armed {
    background: var(--orange-2);
    color: var(--ink);
    border-color: var(--orange-8);
    /* The armed word matches QUIT?'s 10.5px/0.04em — the powerup pills' own
       register (see App.svelte .quit.armed). */
    font-size: 10.5px;
    letter-spacing: 0.04em;
    width: 62px;
    /* Inline only — a `padding: 0 8px` shorthand would zero the chipbox
       recipe's padding-block correction on non-trim engines. */
    padding-inline: 8px;
    z-index: 2;
  }
  /* The tracking, given back — one 0.04em step rides after the final ?,
     seating the centered word a half-step left (app.css's .warchip .unit
     documents the leak). */
  .undo.armed .chiplbl {
    margin-inline-end: -0.04em;
  }
  /* The neighbour of a live confirm, and the whole of request #3: while one
     pill is asking for its second tap, everything beside it steps back — this
     rule for this pill, the near-identical one in App.svelte for the ✕ and the
     wordmark. Ghosted AND slid aside rather than hidden: "QUIT?" grows across
     this pill's anchor, and a dimmed control underneath a live confirm read as
     clipped by a bug, so the pill steps left of the word instead. Left
     tappable, so the pair still behaves as two controls and a player who armed
     the wrong one can simply tap the right one.
     0.22 is deep enough that the covered pill reads as backdrop rather than as
     a control clipped by a bug; it is a transient state on a control that has
     been declared inactive for the duration, so the 3:1 a live graphical object
     owes does not apply.
     Written after `.undo:disabled` on purpose: the two carry the same property
     at the same specificity, and the common case is a dead pill beside an armed
     ✕. Stepping back is the state the player is being told about, so it is the
     one that has to win. */
  /* Nothing to take back: the pill stays in the corner and goes flat, rather
     than disappearing. It sits directly inboard of ✕, and a control that comes
     and goes there walks the quit target 32px sideways between taps — the same
     trade Home.svelte's LAST GAME button makes.

     The dim is the family's 65% flat fade, but it is MIXED, not composited:
     each channel is pre-blended 65% over the --ground the pill sits on,
     which renders the same pixels as `opacity: 0.65` — alpha compositing is
     linear, so the identity holds through every anti-aliased edge — while
     the element's own opacity stays a constant 1.

     Why that constant is the entire point: element opacity below 1 makes
     WebKit paint the pill through an offscreen group buffer, and Safari
     rounds an svg buffer's bounds to device pixels per paint pass (the
     flat-chord bug in CornerPillArt's viewBox comment is this same
     rounding). At the HUD's half-pixel seat, flipping `opacity` in and out
     of that path re-seated the drawn ink by a fraction of a pixel — the
     owner watched this pill jitter at reel landings on an iPhone while the
     ?/✕ held still, across five reports and three layout fixes that
     measured NOTHING moving: the on-device probe (?jitter) logged zero
     rect/scroll/visualViewport events through a visible jitter, Chrome
     never showed it, and it began the day the pill faces became svgs. This
     pill is the only one whose paint state changes mid-game (the disabled
     flip), so it was the only one Safari ever re-rasterized. Dimming
     through the svg's color channels repaints in place with no buffer to
     re-round — element opacity is banned on this pill's resting states.

     The rendered values are unchanged, so the contrast arithmetic the old
     rule carried still holds: against --card the ring sits at 3.21:1 and
     the stroked arrow at 2.70:1. The ring clears the 3:1 a graphical object
     owes and the arrow does not, which is what makes the pill legible as a
     control before its glyph is legible as an arrow — and the arrow's
     shortfall is covered rather than argued away, since WCAG 1.4.11 exempts
     components that are inactive. Dimming further would trade the ring's
     margin for nothing. */
  .undo:disabled {
    --pill-fill: color-mix(in srgb, var(--card) 65%, var(--ground));
    --pill-ring: color-mix(in srgb, var(--line) 65%, var(--ground));
    color: color-mix(in srgb, var(--muted) 65%, var(--ground));
    cursor: default;
  }
  .help.pushed {
    /* The ghost rides the svg's COLOR channels at 22% over --ground — the
       `.undo:disabled` doctrine above, at the pushed depth. opacity, an
       animated transform, and the old z-index are all banned here for the
       disabled rule's reason: each one hoists the svg face onto its own
       compositor layer for the push and drops it at the lapse, and the drop
       re-rasterizes the face at fresh device-pixel rounding on its
       half-pixel seat — the owner watched this pill hop exactly once per
       QUIT? lapse (and the ✕ hop per UNDO? lapse, fixed the same way in
       App.svelte). Stack order survives without the z-index: the armed
       confirms carry z-index 2 and this pill carries none. */
    --pill-fill: color-mix(in srgb, var(--card) 22%, var(--ground));
    --pill-ring: color-mix(in srgb, var(--line) 22%, var(--ground));
    color: color-mix(in srgb, var(--ink) 22%, var(--ground));
    /* The armed "QUIT?" is pinned at 56px in App.svelte precisely so this
       number can be exact: 56 armed + 4px resting gap − 32px anchor = 28px
       of push. The word grows and "pushes" the pill; the lapse pulls it
       home — the resting gap between the two pills is the same in both
       states. Only THIS pill slides — the ✕ it mirrors never moves, because
       a quit target that walks sideways under the thumb is the hazard the
       anchors comment above refuses. Sliding AWAY from an armed confirm has
       no such victim: the pill is stepped-back and inactive for the
       duration.
       The slide is MARGIN, not translateX: margin animates through layout
       and repaints in place every frame, so the pill never takes a
       compositor layer it would have to drop at the lapse. The old
       scale(0.92) went with the transform (its ~1px near-edge give-back is
       folded into the 28px); a shrink on a 22% ghost read as part of the
       fade. */
    margin-right: 28px;
  }
  .help:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* The cue. There are no drop shadows in this app, so the "glow" is drawn
     rather than blurred, in two layers that carry the same message:

     1. The pill fills with attention gold and its type goes to ink — the same
        flat state change the ✕ makes when armed, and the only color in the
        corner zone. Gold is the app's award color (badge pills, the WAR
        ladder's top rung) and is otherwise unused up here; green, pink and
        brick are all spoken for elsewhere, and blue is the focus ring.
     2. A solid gold ring sits just off the pill's edge — a stroked line, the
        same vocabulary as every other border on screen.

     Both sit outside the layout: `.cue` changes no box, and the ring is an
     absolutely positioned ::after inset past the border, so a lit pill has
     exactly the geometry of a dark one and the header never reflows. */
  .help.cue {
    /* The fill and ring live in CornerPillArt's svg now, so the cue's
       costume change rides the custom-property channel instead of the
       button's own background/border; the glyph goes to ink through
       currentColor as ever — --gold-ink IS --ink on the day theme. */
    --pill-fill: var(--yellow);
    --pill-ring: var(--gold-8);
    color: var(--gold-ink);
  }
  /* Night is the MVP chip's re-cut (AwardPill's .qb.mvp note): a full
     --yellow capsule on the dark board shouted over everything on screen.
     Deep gold wash for the fill, the bright yellow promoted to the rings,
     cream type — still the loudest gold in the corner zone, without the
     lamp. */
  :global([data-theme="dark"]) .help.cue {
    --pill-fill: #63490d;
    --pill-ring: var(--yellow);
    color: var(--ink);
  }
  :global([data-theme="dark"]) .help.cue::after {
    border-color: var(--yellow);
  }
  .help.cue::after {
    content: "";
    position: absolute;
    inset: -4px;
    border: 2px solid var(--gold-8);
    border-radius: 999px;
    pointer-events: none;
    animation: cuering 1.1s ease-in-out infinite alternate;
  }
  /* The ring breathes; it never fades out. An earlier version pulsed a ring
     outward to nothing, and for most of the cycle there was no ring at all —
     the one frame where it read was a pale halo, which is a blurred glow by
     another name, and this app draws with ink.
     The keyframe START is the resting state, so reduced-motion readers (app.css
     kills every animation with !important) keep the solid ring at full
     strength rather than losing the cue's second channel entirely. */
  @keyframes cuering {
    from {
      transform: scale(1);
      opacity: 1;
    }
    to {
      transform: scale(1.12);
      opacity: 0.45;
    }
  }
</style>

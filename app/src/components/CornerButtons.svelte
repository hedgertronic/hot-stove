<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import {
    clearBadgeCue,
    firstEverPlay,
    loadCues,
    markHelpSeen,
    noteNewBadges,
  } from "../lib/settings";
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
  }: {
    home?: boolean;
    newBadges?: string[] | null;
    game?: Game | null;
    pushed?: boolean;
    onconfirm?: (armed: boolean) => void;
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

  // The host dims the ✕ and the wordmark while this confirm is up, so it has to
  // hear every change including the one the timeout makes with no tap behind it.
  // Braces, not a bare arrow: an expression body hands the callback's return
  // value to svelte as this effect's teardown.
  $effect(() => {
    onconfirm?.(undoArmed);
  });

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
  <HelpModal onclose={() => (helpOpen = false)} gameLog={game?.debugLog() ?? null} />
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
    color: var(--muted);
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
    transform: translate(-1px, -1px);
  }
  /* The undo pill dips on the tap that ACTS, not the tap that asks — arming
     already answers with the costume change (arrow → UNDO? in confirm
     orange), so the resting pill holds still and only the armed confirm
     dips. The quit ✕ splits its taps the same way (App.svelte .quit). The ?
     and the trophy have no confirm step: their one tap is the act and keeps
     the dip above. */
  .undo:not(.armed):active {
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
    /* Only the pill being confirmed is above its neighbour, whichever of the
       two it is. Without this the ✕ decides it by document order — App.svelte
       renders it after this component — and a ghosted ✕ would sit on top of the
       "UNDO?" it is stepping back from. */
    z-index: 1;
    /* Width transitions alongside opacity and transform so arming and lapsing
       read as one motion rather than a snap. QUIT? in App.svelte does NOT
       transition width (only opacity/transform), so UNDO? animates slightly
       more — that is the right tradeoff: the pill grows leftward into the
       wordmark, and an animated expand reads gentler than a snap. app.css kills
       every transition for reduced-motion readers, who get the same end states
       instantly. */
    transition:
      width 0.12s ease,
      opacity 0.12s ease,
      transform 0.12s ease;
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
     trade Home.svelte's LAST GAME button makes,
     and the same flat language (one opacity on the whole control, no hue
     change) at the same 0.65 — a second dimming number for the same idea would
     read as two different states.
     What 0.65 buys here, measured against --card: the border goes to 3.21:1
     and the stroked arrow to 2.70:1. The border clears the 3:1 a graphical
     object owes and the arrow does not, which is what makes the pill legible
     as a control before its glyph is legible as an arrow — and the arrow's
     shortfall is covered rather than argued away, since WCAG 1.4.11 exempts
     components that are inactive. Dimming further would trade the border's
     margin for nothing. */
  .undo:disabled {
    opacity: 0.65;
    cursor: default;
  }
  .help.pushed {
    opacity: 0.22;
    /* The armed "QUIT?" is pinned at 56px in App.svelte precisely so this
       number can be exact: 56 armed + 4px resting gap − 32px anchor = 28px of
       push, minus the ~1px the 0.92 scale hands back at the near edge. The
       word grows and "pushes" the pill; the lapse pulls it home — the resting
       gap between the two pills is the same in both states. Only THIS pill
       slides — the ✕ it mirrors never moves, because a quit target that walks
       sideways under the thumb is the hazard the anchors comment above
       refuses. Sliding AWAY from an armed confirm has no such victim: the
       pill is stepped-back and inactive for the duration. */
    transform: translateX(-27px) scale(0.92);
    z-index: 0;
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
       currentColor as ever. */
    --pill-fill: var(--yellow);
    --pill-ring: var(--gold-8);
    color: var(--ink);
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

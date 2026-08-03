<script lang="ts">
  import {
    clearBadgeCue,
    firstEverPlay,
    loadCues,
    markHelpSeen,
    noteNewBadges,
  } from "../lib/settings";
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
   * that is not a finale. The home screen never passes it. */
  let {
    home = false,
    newBadges = null,
  }: { home?: boolean; newBadges?: string[] | null } = $props();

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
</script>

<button
  class="help"
  class:home
  class:cue={helpCue}
  onclick={openHelp}
  aria-label={helpCue ? "How to play — start here" : "How to play"}>?</button
>
<button
  class="help trophy"
  class:home
  class:cue={badgeCue}
  onclick={openTrophy}
  aria-label={badgeCue
    ? `Trophy case — ${badgeCount} new badge${badgeCount === 1 ? "" : "s"}`
    : "Trophy case"}
  ><svg class="tico" viewBox="0 0 14 14" aria-hidden="true"
    ><path
      d="M4 2h6v3.2a3 3 0 0 1-6 0V2Z M4 2.8H2.3v1.1a2 2 0 0 0 1.9 2 M10 2.8h1.7v1.1a2 2 0 0 1-1.9 2 M7 8.4v2.2 M4.6 11.9h4.8"
    /></svg
  ></button
>

{#if helpOpen}
  <HelpModal onclose={() => (helpOpen = false)} />
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
    border: 2px solid var(--line);
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
    /* Fixed height and centering so all three corner pills share one box: the
       ? and ✕ are 10px text glyphs and the trophy is a 13px drawing, and
       letting content set the height made the trophy the odd one out. */
    height: 22px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  /* The HUD is a centered flex row and hands the pills their vertical position;
     the home screen is a plain block, so there they pin to its top edge. */
  .help.home {
    top: 0;
  }
  /* The case sits inboard of the ?, sharing its geometry — one control group
     in the corner rather than two unrelated glyphs. `right: auto` matters on
     the home screen: a rule setting only `right` would leave both pills
     anchored to the same corner. */
  .trophy {
    left: 32px;
    right: auto;
  }
  /* Line art rather than an emoji: the ?/✕ pills are 10px text glyphs, and a
     color emoji dropped into that geometry sits low and reads as a sticker on
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
    background: var(--yellow);
    border-color: var(--gold-8);
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

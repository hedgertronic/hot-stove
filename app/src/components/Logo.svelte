<script lang="ts">
  /** The HOT STOVE wordmark plus the BETA tag — one source for the home
   * masthead (big) and the in-game HUD (small), so the tag can't drift. */
  let { big = false }: { big?: boolean } = $props();
</script>

<span class="logo" class:big>
  <span>HOT<em>STOVE</em></span>
  <span class="beta">BETA</span>
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-weight: 800;
    font-size: 15px;
  }
  em {
    font-style: normal;
    color: var(--orange);
  }
  .beta {
    border: 1.5px solid var(--gold-8);
    border-radius: 999px;
    background: var(--yellow);
    font-size: 7.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    line-height: 1;
    padding: 2.5px 6px;
  }

  /* ── MARQUEE variant (big home masthead only) ──────────────────────────────
     Faithful recreation of concept 06 ("MARQUEE") from the wordmark-concepts
     artifact, adapted from two stacked rows to one centered line.
     Technique: dot-grid background clipped to glyph shapes via
     `background-clip: text`. "HOT" gets amber dots (#ffb648), "STOVE" gets
     orange dots (#ff7a18) — the exact colors from the artifact's .row and
     .row.b rules. Artifact's background-image:
       radial-gradient(circle at center, #ffb648 0 1.05px, transparent 1.15px)
       background-size: 4px 4px
     No border bulbs; the dots live inside the glyphs, not the frame.
     Panel: blended from the prior design at user direction — warm dark-brown
     (#1c1408) instead of near-black, softens the contrast while keeping the
     "night game" character that makes the dots readable on any page theme.
     Fully contained behind .big so the small HUD variant is untouched. */
  .logo.big {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    /* The artifact set its rows at 46px; the dot grid needs glyphs near that
       size or the strokes go sparse and "HOT" reads faint. 42px is the largest
       one-line fit inside the phone masthead. */
    font-size: 42px;
    letter-spacing: 0.01em;
    background: #1c1408;
    border: 2.5px solid #b04a00;
    border-radius: 12px;
    padding: 14px 24px;
  }
  /* HOT: amber dot grid clipped to glyph shapes. `color: transparent` is
     required — the background-image provides the visible color via clip. */
  .logo.big > span:first-child {
    /* Dots run 1.3px against the artifact's 1.05px: at 42px (vs its 46px)
       the extra fill keeps stroke coverage equivalent. */
    background-image: radial-gradient(circle at center, #ffb648 0 1.3px, transparent 1.4px);
    background-size: 4px 4px;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  /* STOVE: orange dot grid (artifact's .row.b shade), renders on top of the
     parent's amber so the em's text area reads orange. Inherits transparent
     color from parent but this rule makes the intent explicit. */
  .logo.big em {
    background-image: radial-gradient(circle at center, #ff7a18 0 1.3px, transparent 1.4px);
    background-size: 4px 4px;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  /* BETA pill text: force a dark value so the pill reads on its yellow
     background inside the dark panel regardless of page theme. */
  .logo.big .beta {
    border-width: 2px;
    font-size: 9.5px;
    padding: 3.5px 8px;
    color: #1a0e00;
  }
</style>

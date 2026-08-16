<script lang="ts">
  // The camera ships inside the JS bundle as a data URI (?inline) — a plain
  // <img src> refetches on every Home remount and can paint a frame late
  // (the "logo missing then flashes back" report; same doctrine as the
  // brand.css O-boiler). src/assets/hedgertronic.png is the site's own
  // favicon, copied verbatim.
  import camUri from "../assets/hedgertronic.png?inline";
</script>

<!-- The maker's mark, worn as a corner chip: the hedgertronic camera beside
     the name, in the corner-button register so it reads as chrome rather than
     content. Upper RIGHT because the home screen's upper left belongs to the
     ? / trophy pair and the right is free there — this component is
     home-only; in-game that corner holds the quit ✕. -->
<!-- A new tab, because the mark leads OFF the game. This chip is a curiosity
     tap — "who made this" — not a way out, and answering it in the same tab
     spends the whole app to do it: the saved game, the mode rows just
     punched, and a seed half-typed all leave the screen, and the way back is
     the browser's back button rather than anything this app draws.
     `noopener` is the security half (a linked page must not reach
     `window.opener`); `noreferrer` is deliberately NOT set — the maker's own
     site is the one destination that should see where the traffic came
     from. -->
<a
  class="maker chipbox"
  href="https://hedgertronic.com/"
  target="_blank"
  rel="noopener"
  aria-label="Visit hedgertronic.com (opens in a new tab)"
>
  <img class="cam" src={camUri} alt="" aria-hidden="true" />
  <span class="chiplbl">HEDGERTRONIC</span>
</a>

<style>
  /* CornerButtons' .help pill, restated: same 22px height, same 2px line,
     same card fill and muted voice, so the three corner controls read as one
     family. The chip joins the chipbox recipe (markup class) with the name in
     a .chiplbl, so the cap band seats on the pill's optical center the way
     the ? and trophy labels do — the camera is its own flex item, centered by
     the box alone, the AwardPill emoji split. Not in-flow like the old bottom
     line — the .home container is the positioning context (position:
     relative), the same anchor the left pair hangs from. */
  .maker {
    position: absolute;
    /* The corner pair's own home-screen seat (CornerButtons .help.home):
       the chip shares their line, so it shares their number. */
    top: -3.5px;
    right: 0;
    --chip-h: 22px;
    gap: 5px;
    padding-inline: 7px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    /* Ink label, gray ring — CornerButtons' resting pill documents the call. */
    color: var(--ink);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-decoration: none;
    transition: transform 0.08s;
  }
  /* The tracking, given back — the label is the chip's LAST flex item, so
     its trailing step padded the right inset 0.72px past the left's
     (app.css's .warchip .unit documents the leak). */
  .maker .chiplbl {
    margin-inline-end: -0.08em;
  }
  .cam {
    width: 13px;
    height: 13px;
    display: block;
  }
  .maker:active {
    transform: translateY(1.5px);
  }
  .maker:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
</style>

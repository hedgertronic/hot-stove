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
<a class="maker chipbox" href="https://hedgertronic.com/" aria-label="Visit hedgertronic.com">
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
    color: var(--muted);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-decoration: none;
    transition: transform 0.08s;
  }
  .cam {
    width: 13px;
    height: 13px;
    display: block;
  }
  .maker:active {
    transform: translate(-1px, -1px);
  }
  .maker:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
</style>

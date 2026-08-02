<script lang="ts">
  /** One award pill — the single source for award → color/medal-text mapping,
   * shared by the market rows, the finale squads, and the finale ledger.
   * `small` is the market-row size; `n` renders a ×N multiplier (ledger). */
  let { code, n = 1, small = false }: { code: string; n?: number; small?: boolean } = $props();

  const AWARD_CLS: Record<string, string> = {
    MVP: "mvp",
    CY: "cy",
    MVP2: "mvp",
    CY2: "cy",
    MVP3: "mvp",
    CY3: "cy",
    GG: "gg",
    SS: "ss",
    ROY: "roy",
    AS: "as",
    MOY: "moy",
  };
  const PILL_TEXT: Record<string, string> = {
    MVP: "🥇MVP",
    CY: "🥇CY",
    MVP2: "🥈MVP",
    CY2: "🥈CY",
    MVP3: "🥉MVP",
    CY3: "🥉CY",
  };
</script>

<span class="qb {AWARD_CLS[code] ?? ''}" class:small
  >{PILL_TEXT[code] ?? code}{#if n > 1}<span class="mult">×{n}</span>{/if}</span
>

<style>
  /* Centred by the box, not by the line box. Left to inline layout the text
     sits wherever two fonts' metrics put the baseline — and PILL_TEXT mixes
     them, since 🥇🥈🥉 come from the emoji face and MVP/CY from the display
     one. That made a medal pill and a plain one different heights and their
     caps land at different depths. A pinned height with the content centred in
     it takes both off the font's hands.
     The heights are the ones these pills already occupy (15.5px / 14.75px as
     measured), because the surfaces around them are built against exactly
     that: PlayerList reserves the WAR chip's row height so a SIGN confirm
     cannot make a row twitch, and the finale's squad rows wrap award pills
     under long names. Changing the centring must not move either. */
  .qb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 15.5px;
    font-size: 9px;
    font-weight: 800;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    /* The top-only nudge is the descender: the label is all caps, so the box a
       line centres is taller than the ink it holds and the letters ride high by
       the space kept for the tails they don't have. Measured, not guessed —
       1.5px here and 0.5px at the small size put the cap band's centre on the
       pill's centre to within a tenth of a pixel. */
    padding: 1.5px 6px 0;
    line-height: 1;
    white-space: nowrap;
  }
  .qb.small {
    height: 14.75px;
    font-size: 8.5px;
    padding: 0.5px 5px 0;
  }
  .qb.mvp {
    background: var(--yellow);
  }
  .qb.cy {
    background: var(--sky);
  }
  .qb.gg {
    background: var(--green-wash);
  }
  .qb.ss {
    background: var(--lilac);
  }
  .qb.roy {
    background: var(--pink);
  }
  .qb.as {
    background: var(--amber);
  }
  /* Manager of the Year wears the skipper's pink — manager surfaces (the
     Skipper row, the MGR seat) are pink throughout; the text tells it apart
     from ROY, which only ever sits on player rows. */
  .qb.moy {
    background: var(--pink);
  }
  /* A flex item of its own, so the multiplier is centred on the pill's axis
     rather than hung off the label's baseline — at 8px inside a 9px pill the
     baseline drop is most of what made the ×N look like it was falling out. */
  .mult {
    font-size: 8px;
    margin-left: 2px;
  }
</style>

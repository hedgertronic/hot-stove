<script lang="ts">
  import { accentFor } from "../lib/data";
  import { divisionsForYear, pickerCols, splitDivision } from "../lib/divisions";
  import type { Game } from "../lib/engine.svelte";
  import type { Colors } from "../lib/types";
  import Sheet from "./Sheet.svelte";

  let { game, colors, onclose }: { game: Game; colors: Colors; onclose: () => void } = $props();

  // Grouped by the spun season's actual league + division (index rows carry
  // lg/div) — pre-1994 years show four groups, Houston sits in the NL until
  // 2013, etc. tests/divisions.test.ts pins the discriminating cases.
  const divisions = $derived.by(() =>
    game.card ? divisionsForYear(game.teamsForYear(game.card.year)) : [],
  );

  function pick(team: string) {
    onclose();
    game.relocate(team);
  }
</script>

<Sheet
  {onclose}
  label="Pick a team"
  title="🚚 RELOCATE: ANY {game.card?.year ?? ''} CLUB"
  confirmLabel="CANCEL"
>
  {@const cols = pickerCols(divisions.map((d) => d.teams.length))}
  {#each divisions as d (d.label)}
    {@const rows = splitDivision(d.teams, cols)}
    <div class="div-h">{d.label}</div>
    {#each rows as row}
      <div class="pickgrid" style="--div-cols: {cols}">
        {#each row as t (t.team)}
          <button
            class="pickopt teambtn"
            disabled={t.team === game.card?.team}
            style:--accent={accentFor(colors, t.franchise)}
            title={t.name}
            onclick={() => pick(t.team)}
          >
            <!-- Box Score gets the season's October history on the grid
                 (💍 champ, 🚩 pennant winner); Eye Test stays bare codes. -->
            {t.team}{#if game.showAwards}{#if t.ws}<span class="pedi">💍</span
              >{:else if t.pen}<span class="pedi">🚩</span>{/if}{/if}
          </button>
        {/each}
      </div>
    {/each}
  {/each}
</Sheet>

<style>
  /* Header, ✕ and the CANCEL button all belong to Sheet — a picker is a thing
     you back out of, so its bottom button says CANCEL rather than CLOSE. */
  .div-h {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin: 8px 2px 5px;
  }
  /* The first heading takes its air from the sheet's own header gap; its own
     margin would stack on top and push six divisions toward a scroll. */
  .div-h:first-child {
    margin-top: 0;
  }
  /* Division rows stacked (pre-1994 seasons use four groups; 1994+ use six).
     Large divisions (n ≥ 6) emit two grids — ⌈n/2⌉ teams then ⌊n/2⌋ — both
     sharing the same --div-cols so tile widths stay aligned within the group.
     Small divisions emit one grid. Column count is per-row via --div-cols
     (rows[0].length), not a global max, so an AL 7-team split (4 cols) and an
     NL 6-team split (3 cols) are independent. The scoped rule wins over
     app.css's unscoped `.pickgrid` due to Svelte's specificity bump. */
  .pickgrid {
    margin-bottom: 4px;
    grid-template-columns: repeat(var(--div-cols, 5), 1fr);
  }
  /* Each tile is a club color, so it wears the pair — the accent thinned into
     the cardstock for the fill, the accent itself for the line. Same derivation
     as the spun year pill in SpinBanner, for the same reason: the hue arrives
     at runtime from colors.json, so the rungs are computed rather than looked
     up. It is handed over as `.pickopt`'s pair rather than painted on top of
     it, so the tile's own declaration does the painting and this rule never
     has to out-specify the shared one. The codes stay the base tile's ink; a
     rung-2 fill never carries white type.
     Only the hue and the type's own metrics are here — a three-letter
     code takes more air above and below than a four-digit year, and it is
     tracked out, so the padding and the leading are this picker's to set. */
  .teambtn {
    --accent: var(--ink);
    --pick-line: var(--accent);
    --pick-fill: color-mix(in srgb, var(--accent) 18%, var(--card));
    letter-spacing: 0.04em;
    line-height: 1.2;
    padding: 11px 0;
    /* Code and medal are ONE line, always. The tiles carry no horizontal
       padding, so on a phone "TOR💍" misses a 7-column tile's content box by
       under a pixel — and the wrap that bought was a taller tile mid-row,
       which read as the whole grid buckling. Nowrap holds the line; a
       fractional overflow center-bleeds invisibly instead. */
    white-space: nowrap;
  }
  /* Down from the shared 11px: seven columns leave this picker the narrowest
     tiles in the game, and the medal is a footnote on a club code, not a
     second glyph of type. 9px beside 13px caps is what lets ring clubs fit
     the same one-line tile as everyone else on a 360pt phone. */
  .pickopt .pedi {
    margin-left: 1px;
    font-size: 9px;
  }
</style>

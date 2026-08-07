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
    <!-- The game's standard section rule — dashed line, centered caps — the
         same .psep device every other surface headers with, instead of a
         private left-aligned caption only this sheet spoke. -->
    <div class="psep">{d.label}</div>
    <div class="divrows">
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
            <span class="chiplbl">{t.team}</span
            >{#if game.showAwards}{#if t.ws}<span class="pedi">💍</span
              >{:else if t.pen}<span class="pedi">🚩</span>{/if}{/if}
          </button>
        {/each}
      </div>
    {/each}
    </div>
  {/each}
</Sheet>

<style>
  /* Header, ✕ and the CANCEL button all belong to Sheet — a picker is a thing
     you back out of, so its bottom button says CANCEL rather than CLOSE. */
  /* The division header is app.css's .psep; only the air between sections is
     this sheet's to set. Its bottom padding (8px) is the rule's own; the top
     margin separates a section from the grids above it, and the first takes
     its air from the sheet's header gap instead of stacking on it. */
  .psep {
    margin-top: 10px;
  }
  .psep:first-child {
    margin-top: 0;
  }
  /* Division rows stacked (pre-1994 seasons use four groups; 1994+ use six).
     Large divisions (n ≥ 6) emit two grids — ⌈n/2⌉ teams then ⌊n/2⌋ — both
     sharing the same --div-cols so tile widths stay aligned within the group.
     Small divisions emit one grid. The wrapper's gap is .pickgrid's own 7px —
     the SEASON TICKET sheet's line spacing — so a split division's two lines
     sit exactly as far apart as any two lines of the year grid, instead of
     the tighter margin they used to keep. Column count is per-row via
     --div-cols (rows[0].length), not a global max, so an AL 7-team split
     (4 cols) and an NL 6-team split (3 cols) are independent. The scoped rule
     wins over app.css's unscoped `.pickgrid` due to Svelte's specificity
     bump. */
  .divrows {
    display: grid;
    gap: 7px;
  }
  .pickgrid {
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
  /* Box, height and label seat are app.css's `.pickopt` (the chipbox
     recipe, which also states the nowrap that holds code and medal to one
     line). Only the hue pair and the code's tracking are this sheet's. */
  .teambtn {
    --accent: var(--ink);
    --pick-line: var(--accent);
    --pick-fill: color-mix(in srgb, var(--accent) 18%, var(--card));
    letter-spacing: 0.04em;
  }
  /* The medal is app.css's shared `.pickopt .pedi` — the same 11px and
     margin the SEASON TICKET sheet reads, centered by the tile's chipbox
     (no raise of its own). The private 9px copy this picker once ran
     existed for 7-column divisional grids, which splitDivision has since
     retired (max 4 columns), so the two sheets share one rule. */
</style>

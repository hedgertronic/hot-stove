<script lang="ts">
  import { accentFor } from "../lib/data";
  import { divisionsForYear } from "../lib/divisions";
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
  title="🚚 RELOCATE — ANY {game.card?.year ?? ''} CLUB"
  confirmLabel="CANCEL"
>
  {#each divisions as d (d.label)}
    <div class="div-h">{d.label}</div>
    <div class="grid">
      {#each d.teams as t (t.team)}
        <button
          class="teambtn"
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
  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 7px;
    margin-bottom: 4px;
  }
  /* Each tile is a club color, so it wears the pair — the accent thinned into
     the cardstock for the fill, the accent itself for the line. Same derivation
     as the spun year pill in SpinBanner, for the same reason: the hue arrives
     at runtime from colors.json, so the rungs are computed rather than looked
     up. The codes go ink; a rung-2 fill never carries white type. */
  .teambtn {
    --accent: var(--ink);
    border: 2px solid var(--accent);
    border-radius: 9px;
    background: color-mix(in srgb, var(--accent) 18%, var(--card));
    color: var(--ink);
    font-family: inherit;
    font-weight: 800;
    font-size: 13px;
    letter-spacing: 0.04em;
    line-height: 1.2;
    padding: 11px 0;
    cursor: pointer;
    transition: transform 0.08s;
  }
  .teambtn:active {
    transform: translateY(1.5px);
  }
  .pedi {
    margin-left: 2px;
    /* Emoji render below their nominal size — 11px sits balanced with the
       13px codes. */
    font-size: 11px;
    line-height: 1;
  }
  .teambtn:disabled {
    opacity: 0.32;
    cursor: default;
  }
</style>

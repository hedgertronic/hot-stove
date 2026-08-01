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
  .qb {
    font-size: 9px;
    font-weight: 800;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    padding: 0 6px;
    line-height: 1.5;
    white-space: nowrap;
  }
  .qb.small {
    font-size: 8.5px;
    padding: 0 5px;
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
  .mult {
    font-size: 8px;
    margin-left: 2px;
  }
</style>

<script lang="ts">
  import { loadSpecials } from "../lib/data";
  import type { Game, SpecialKey } from "../lib/engine.svelte";
  import { money, signed } from "../lib/format";
  import { MANAGER_PER_NET_WIN } from "../lib/scoring";
  import type { SpecialSeason } from "../lib/types";
  import Sheet from "./Sheet.svelte";

  let { game, onclose }: { game: Game; onclose: () => void } = $props();

  const which = $derived(game.primeSpecial);

  /** Sheet header: what's being browsed, in the tile's own vocabulary. */
  const head = $derived.by(() => {
    const c = game.card;
    if (!c || !which) return { ic: "", who: "", sub: "" };
    if (which === "manager")
      return {
        ic: "🧢",
        who: c.manager ?? "",
        sub: "Hire any season of the career, at that season's record",
      };
    if (which === "stadium")
      return {
        ic: "🏟️",
        who: c.park,
        sub: "Buy any year of the park, at that year's attendance",
      };
    return {
      ic: "💰",
      who: game.ownerName,
      sub: "Hire any year of the tenure, at that year's payroll",
    };
  });

  interface Row {
    team: string;
    year: number;
    /** Main line: "1996 New York Yankees". */
    label: string;
    /** Muted second line (record; empty in Eye Test or when redundant). */
    sub: string;
    /** Right-edge value (net wins / ×mult / payroll). */
    val: string;
    /** The landed card's own season — take it the normal way. */
    here: boolean;
  }
  let rows = $state<Row[] | null>(null);
  let failed = $state(false);
  let busy = $state(false);

  $effect(() => {
    const kind = which;
    const c = game.card;
    rows = null;
    failed = false;
    if (!kind || !c) return;
    void (async () => {
      try {
        const specials = await loadSpecials();
        let picks: (SpecialSeason & { franchise: string })[] = [];
        if (kind === "manager") {
          // A manager's career crosses franchises; scan the whole index.
          for (const [franchise, list] of Object.entries(specials))
            for (const s of list) if (s.mgr === c.manager) picks.push({ ...s, franchise });
        } else if (kind === "stadium") {
          picks = (specials[c.franchise] ?? [])
            .filter((s) => s.park === c.park)
            .map((s) => ({ ...s, franchise: c.franchise }));
        } else {
          const tenure = game.owners.franchises[c.franchise]?.owners.find(
            (o) => o.from <= c.year && (o.to === null || c.year < o.to),
          );
          picks = (specials[c.franchise] ?? [])
            .filter(
              (s) =>
                tenure !== undefined &&
                tenure.from <= s.year &&
                (tenure.to === null || s.year < tenure.to),
            )
            .map((s) => ({ ...s, franchise: c.franchise }));
        }
        rows = picks
          .sort((a, b) => a.year - b.year || a.team.localeCompare(b.team))
          .map((s) => ({
            team: s.team,
            year: s.year,
            label: `${s.year} ${s.name}`,
            sub:
              kind === "manager" && !game.scout
                ? `${s.w}–${s.l}`
                : kind === "stadium"
                  ? `${Math.round(s.att * 100)}th pct attendance`
                  : "",
            val:
              kind === "manager"
                ? game.scout
                  ? ""
                  : `${signed((s.w - s.l) * MANAGER_PER_NET_WIN)} W`
                : kind === "stadium"
                  ? `×${s.mult.toFixed(2)}`
                  : money(s.budget),
            here: s.team === c.team && s.year === c.year,
          }));
      } catch {
        failed = true;
      }
    })();
  });

  async function pick(row: Row) {
    if (busy || row.here) return;
    busy = true;
    await game.applyPrimeSpecial(row.team, row.year);
    busy = false;
    onclose();
  }
</script>

<Sheet {onclose} label="Pick a year of this front-office hire">
  <div class="sheet-h">⭐ PRIME TIME — {head.ic} {head.who}</div>
  <div class="sheet-sub">{head.sub}</div>
  {#if failed}
    <div class="note">Couldn't load the timeline. Try again.</div>
  {:else if rows === null}
    <div class="note">Pulling the file…</div>
  {:else if rows.length <= 1}
    <div class="note">One-year wonder — no other seasons to visit.</div>
  {:else}
    <div class="list">
      {#each rows as row ((row.team + row.year))}
        <button class="srow" disabled={row.here} onclick={() => pick(row)}>
          <span class="mid">
            <span class="yr">{row.label}</span>
            {#if row.sub}<span class="sub">{row.sub}</span>{/if}
          </span>
          <span class="val">{row.val}</span>
        </button>
      {/each}
    </div>
  {/if}
  <button class="btn cancel" onclick={onclose}>Cancel</button>
</Sheet>

<style>
  .sheet-h {
    text-align: center;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .sheet-sub {
    text-align: center;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    margin: 2px 0 10px;
  }
  .note {
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    padding: 18px 0;
  }
  .list {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }
  .srow {
    display: flex;
    align-items: center;
    gap: 9px;
    background: var(--card);
    border: 2.5px solid var(--ink);
    border-radius: 11px;
    padding: 6px 10px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
    min-height: 48px;
  }
  .srow:active {
    transform: translate(-1px, -1px);
  }
  /* The landed card's own year grays out like any other unclickable row. */
  .srow:disabled {
    opacity: 0.45;
    filter: grayscale(1);
    cursor: default;
  }
  .srow:disabled:active {
    transform: none;
  }
  .mid {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .yr {
    font-weight: 800;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    font-size: 10px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .val {
    margin-left: auto;
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
  }
</style>

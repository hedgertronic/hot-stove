<script lang="ts">
  import { accentFor } from "../lib/data";
  import type { Game } from "../lib/engine.svelte";
  import { Rng } from "../lib/rng";
  import type { Colors } from "../lib/types";

  let { game, colors }: { game: Game; colors: Colors } = $props();

  let yrEl: HTMLElement | undefined = $state();
  let tmEl: HTMLElement | undefined = $state();
  let display = $state<{ yr: string; tm: string; color: string } | null>(null);
  let landedAnim = $state(false);
  let running = false;

  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cardView = $derived.by(() => {
    if (game.phase === "spinning") return display;
    const c = game.card;
    if (!c) return null;
    return { yr: String(c.year), tm: c.name, color: accentFor(colors, c.franchise) };
  });

  function pulse(ms: number, kind: "full" | "year" | "team") {
    const els = kind === "year" ? [yrEl] : kind === "team" ? [tmEl] : [yrEl, tmEl];
    for (const el of els) {
      el?.animate(
        [{ transform: "translateY(-30%)", opacity: 0.35 }, { transform: "none", opacity: 1 }],
        { duration: Math.min(ms * 0.9, 240), easing: "ease-out" },
      );
    }
  }

  // The stove never idles: a fresh game spins immediately, and every completed
  // pick rolls the next card after a beat (long enough to feel the landing).
  $effect(() => {
    if (game.phase !== "preSpin") return;
    const delay = game.spinCount === 0 ? 0 : 500;
    const t = setTimeout(() => game.spin(), delay);
    return () => clearTimeout(t);
  });

  // The banner itself is the reel: cosmetic flicker from a throwaway RNG so the
  // game stream stays untouched, decelerating ticks, overshoot thunk on landing.
  // Season Ticket and Relocate skip the reel entirely — the chosen card lands
  // instantly with one pulse on the half that changed.
  $effect(() => {
    if (game.phase !== "spinning" || running) return;
    running = true;
    landedAnim = false;
    const kind = game.spinKind;
    const land = async () => {
      await game.land();
      landedAnim = true;
      running = false;
      if (kind !== "full" && !reduced) pulse(260, kind);
    };
    if (reduced || kind !== "full") {
      void land();
      return;
    }
    const cosmetic = new Rng(Date.now() >>> 0);
    const pool = game.index.cards;
    // One authoritative timer lands the card; the decelerating flicker chain is
    // pure cosmetics and simply stops early if the browser throttles timers
    // (a throttled chain once stretched a 2s spin to 14s).
    let delay = 50;
    let total = 320;
    for (let d = delay; d < 320; d *= 1.16) total += d;
    setTimeout(() => void land(), total);
    const step = () => {
      if (game.phase !== "spinning") return;
      const e = cosmetic.pick(pool);
      display = { yr: String(e.year), tm: e.name, color: accentFor(colors, e.franchise) };
      pulse(delay, "full");
      delay *= 1.16;
      if (delay < 320) setTimeout(step, delay);
    };
    step();
  });

  /** Seats still open once the roster is full — the hunt line. */
  const stillHiring = $derived.by(() => {
    if (!game.rosterFull || game.complete) return [];
    const out: string[] = [];
    if (!game.manager) out.push("MANAGER");
    if (!game.fixedCap) {
      if (!game.owner) out.push("OWNER");
      if (!game.stadium) out.push("STADIUM");
    }
    return out;
  });

  const showPass = $derived(
    game.phase === "landed" && game.choicesUsed === 0 && game.rosterFull && !game.coldStove,
  );
</script>

<div class="banner disp" class:landed={landedAnim} class:stale={game.phase === "preSpin" && !!game.card}>
  {#if cardView}
    <div class="bline">
      <span class="yr" bind:this={yrEl} style:background={cardView.color}>{cardView.yr}</span>
    </div>
    <div class="bline team">
      <div class="tname" bind:this={tmEl} style:color={cardView.color}>{cardView.tm}</div>
    </div>
    {#if game.phase === "landed" && game.card}
      <div class="tmeta">
        {game.card.wins}–{game.card.losses}{#if game.showAwards && game.card.ws}
          <span class="pedigree" title="Won the World Series">💍</span>{:else if game.showAwards && game.card.pen}
          <span class="pedigree" title="Won the pennant">🚩</span>{/if}
      </div>
    {/if}
  {:else}
    <div class="bline"><span class="yr idle">····</span></div>
    <div class="bline team"><div class="tname idle">HOT STOVE</div></div>
  {/if}

  {#if game.inTdBonus}
    <div class="hunt bonus">🔁 BONUS SPIN — TRADE DEADLINE IS STILL LOADED</div>
  {:else if stillHiring.length > 0}
    <div class="hunt">STILL HIRING: {stillHiring.join(" · ")}</div>
  {/if}
</div>

{#if game.coldStove}
  <div class="cold disp">
    <div class="coldmsg">🥶 COLD STOVE — nothing left to take here</div>
    <button class="btn spinbtn disp" onclick={() => game.coldRespin()}>SPIN AGAIN — FREE</button>
  </div>
{:else if game.phase === "landed" && game.choicesUsed > 0 && game.choicesLeft > 0}
  <button class="btn donebtn disp" onclick={() => game.finishSpin()}>DONE — KEEP ✌️ ▸</button>
{:else if showPass}
  <button class="btn passbtn disp" onclick={() => game.passSpin()}>
    {game.willFinishOnPass ? "FINISH ▸" : "PASS ▸"}
  </button>
{/if}

<style>
  .banner {
    text-align: center;
    margin-bottom: 12px;
  }
  .banner.landed {
    animation: thunk 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .banner.stale {
    opacity: 0.45;
    filter: grayscale(0.6);
  }
  @keyframes thunk {
    0% {
      transform: scale(1.08) rotate(-1deg);
    }
    100% {
      transform: none;
    }
  }
  .bline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }
  .bline.team {
    margin-top: 5px;
  }
  .yr {
    display: inline-block;
    background: var(--blue);
    color: var(--card);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 2px 14px;
    font-weight: 800;
    font-size: 13px;
    line-height: 1.35;
  }
  .yr.idle {
    background: var(--gray-bg);
    color: var(--gray-ink);
  }
  .tname {
    font-size: 24px;
    font-weight: 800;
    line-height: 1.15;
  }
  .tname.idle {
    color: var(--gray-ink);
  }
  .tmeta {
    font-size: 11.5px;
    color: var(--muted);
    margin-top: 3px;
  }
  .pedigree {
    font-size: 12px;
  }
  .hunt {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--orange);
    margin-top: 6px;
  }
  .hunt.bonus {
    color: var(--green-deep);
  }
  .spinbtn {
    width: 100%;
    margin: 4px 0 12px;
    min-height: 48px;
  }
  .donebtn,
  .passbtn {
    width: 100%;
    margin: 4px 0 10px;
    font-size: 13px;
    padding: 7px 12px;
  }
  .passbtn {
    background: transparent;
    border-style: dashed;
    color: var(--muted);
  }
  .cold {
    text-align: center;
    margin: 4px 0 12px;
  }
  .coldmsg {
    font-size: 12px;
    font-weight: 800;
    color: var(--muted);
    margin-bottom: 6px;
  }
</style>

<script lang="ts">
  /* THE FINALE'S INSTRUCTS — the first-finale spotlight tour, a sibling of
   * Instructs.svelte with the same machinery COPIED, not shared: the two
   * tours read different screens, and a helper generic enough for both would
   * carry more surface than the ~200 lines it saves. Every mechanism note —
   * the box-shadow wash, the gliding window, the single-axis card seat, the
   * settle/lock discipline, the drawn arrows, trapTab — lives on the board
   * tour; this file documents only what differs.
   *
   * What differs: the stops (the finale's four teachable sections), the cue
   * (settings.finaleTourSeen, marked by the mounter's onclose), and the
   * mount beat — the finale's reveal is a staged ceremony, so Finale.svelte
   * holds this tour back until the last beat (passShown) has landed rather
   * than dimming a ledger that is still dealing. */
  import { onMount } from "svelte";
  import { lockScroll } from "../lib/scrolllock";
  import CornerPillArt from "./CornerPillArt.svelte";

  interface Stop {
    /** Resolved against the live finale; a stop whose selector finds nothing
     * is dropped rather than spotlighting an empty rect. The dream team is
     * absent on an offline finale, the codes on none, but the gate is the
     * same either way. */
    selector: string;
    /** A second element whose rect UNIONS with the first: the share button
     * and the two code chips are adjacent siblings with no shared wrapper,
     * and they are one lesson. Optional element, optional gate: the stop
     * runs without it. */
    extend?: string;
    title: string;
    copy: string;
  }

  let { onclose }: { onclose: () => void } = $props();

  /* Copy in the board tour's voice: short sentences, plain words, no em
   * dashes, one idea per line. What each stop teaches: 1 how the scorecard
   * lines become points, 2 the squad and the scout star, 3 the dream team
   * yardstick, 4 the collectibles (badges and the passport), 5 sharing and
   * the two codes. Bank-neutral on purpose, so no fixedCap variant is
   * needed. */
  const STOPS: Stop[] = [
    {
      selector: ".ledger",
      title: "THE SCORECARD",
      copy: "Player WAR and manager wins combine to give your baseline wins. Awards, rings, and having players on the dream team add extra points. Spending close to your payroll earns a bonus, but going over enters the luxury tax and loses points.",
    },
    {
      /* :not(.dream), because the dream club wears .squad too and
       * querySelector order is not a contract worth leaning on. */
      selector: ".squad:not(.dream)",
      title: "YOUR SQUAD",
      copy: "The team you built. A \u2b50 means the player also made the dream team.",
    },
    {
      selector: ".squad.dream",
      title: "THE DREAM TEAM",
      copy: "The best team your cards could've made. Faded players are the ones you passed on. Players in green made your squad.",
    },
    {
      selector: ".badge-strip",
      title: "COLLECTIBLES",
      copy: "Earn badges for achievements and passport stamps for signing players from different countries. Tap a badge to see how you earned it.",
    },
    {
      selector: ".fin-actions",
      extend: ".codes",
      title: "SHARING",
      copy: "Share your season with friends. The seed code deals them the same cards while the game code shows them the team you built.",
    },
  ];

  let stops = $state<Stop[]>([]);
  let i = $state(0);
  let box = $state<{ top: number; left: number; width: number; height: number } | null>(null);
  let below = $state(true);
  /** The card's one positioning axis — the board tour documents why both
   * sides resolve to a `top` value (the old top/bottom pair cut across side
   * flips) and why a ResizeObserver re-seats it when the body swaps. */
  let ctop = $state(0);
  let calloutEl = $state<HTMLElement | undefined>();
  let nextBtn = $state<HTMLButtonElement | undefined>();

  const ro =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure(false)) : null;
  $effect(() => {
    if (!calloutEl || !ro) return;
    ro.observe(calloutEl);
    return () => ro.disconnect();
  });

  /* Immediate dialog focus, per the board tour's note: trapTab is inert
   * until focus is inside the callout. */
  $effect(() => {
    nextBtn?.focus({ preventScroll: true });
  });

  let release: (() => void) | null = null;

  function target(): Element | null {
    return stops[i] ? document.querySelector(stops[i].selector) : null;
  }

  /* Content box, not border box — the board tour documents why (a target's
   * padding is spacing, and a border-box ring wears it as lopsided air).
   * The finale's targets are padding-free today; the trim keeps the twins
   * identical so a padded section added later starts out correct. */
  function contentRect(el: Element): DOMRect {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;
    return new DOMRect(r.left + pl, r.top + pt, r.width - pl - pr, r.height - pt - pb);
  }

  /* placement=false: en-route remeasures move the window and the card's
   * seat but never re-decide `below` — the board tour documents the
   * mid-glide flip this prevents. go() decides the side once per hop from
   * the settled position; the settle's full measure confirms it. */
  function measure(placement = true) {
    const el = target();
    if (!el) return;
    let r = contentRect(el);
    const ext = stops[i].extend ? document.querySelector(stops[i].extend!) : null;
    if (ext) {
      const e = contentRect(ext);
      const top = Math.min(r.top, e.top);
      const left = Math.min(r.left, e.left);
      r = new DOMRect(
        left,
        top,
        Math.max(r.right, e.right) - left,
        Math.max(r.bottom, e.bottom) - top,
      );
    }
    box = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
    /* Placement by ROOM. The card's own height is measured when it exists
     * and floored at 150 for the first pass. */
    const h = Math.max(calloutEl?.offsetHeight ?? 0, 150);
    if (placement) below = window.innerHeight - (r.bottom + 6) >= h + 24;
    /* The seat, clamped 8px inside the viewport: the finale's sections run
     * taller than the board's (a full squad list can outgrow the screen),
     * and the raw seat would ride the section's edge right off the top or
     * bottom. The WINDOW keeps hugging the real section even when the card
     * cannot. */
    /* Ceiling first, floor last — min-last inverts the interval on a
     * viewport shorter than the card and shoves the header's ✕ off the top
     * (the board tour documents the full call). */
    const want = below ? box.top + box.height + 12 : box.top - h - 12;
    ctop = Math.max(Math.min(want, window.innerHeight - h - 8), 8);
  }

  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let dead = false;

  function onScrollEnd() {
    clearTimeout(settleTimer);
    window.removeEventListener("scrollend", onScrollEnd);
    if (dead) return;
    measure();
    release = lockScroll();
    nextBtn?.focus({ preventScroll: true });
  }

  function go(n: number) {
    i = n;
    const el = target();
    if (!el) return;
    release?.();
    release = null;
    const glide =
      typeof matchMedia === "function" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ block: "center", behavior: glide ? "smooth" : "auto" });
    /* The side, from the landed rect (block "center" seats the section's
     * middle on the viewport's). The extend union isn't in this prediction —
     * scrollIntoView centers only `el` — so the SHARING stop predicts from
     * .fin-actions alone and the settle's full measure corrects if the
     * union changes the answer. */
    const rb = el.getBoundingClientRect();
    /* Content-box bottom at the landed position — the board tour documents
       why the border box alone mispredicts by the target's bottom padding
       (a no-op today on the finale's padding-free targets; twins stay
       twins). */
    const landedBottom =
      (window.innerHeight + rb.height) / 2 - (rb.bottom - contentRect(el).bottom);
    const h = Math.max(calloutEl?.offsetHeight ?? 0, 150);
    below = window.innerHeight - (landedBottom + 6) >= h + 24;
    measure(false);
    nextBtn?.focus({ preventScroll: true });
    clearTimeout(settleTimer);
    window.removeEventListener("scrollend", onScrollEnd);
    window.addEventListener("scrollend", onScrollEnd, { once: true });
    settleTimer = setTimeout(onScrollEnd, glide ? 600 : 60);
  }

  function finish() {
    onclose();
  }

  function trapTab(e: KeyboardEvent) {
    if (e.key !== "Tab" || !calloutEl) return;
    const focusables = calloutEl.querySelectorAll<HTMLElement>("button");
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    stops = STOPS.filter((s) => document.querySelector(s.selector));
    if (stops.length === 0) {
      onclose();
      return;
    }
    go(0);
    const onResize = () => measure();
    const onScroll = () => measure(false);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      dead = true;
      clearTimeout(settleTimer);
      window.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      release?.();
      release = null;
    };
  });
</script>

<svelte:window onkeydown={(e) => (e.key === "Escape" ? finish() : trapTab(e))} />

{#if box && stops[i]}
  <div class="shade" role="presentation">
    <div
      class="window"
      style:top="{box.top}px"
      style:left="{box.left}px"
      style:width="{box.width}px"
      style:height="{box.height}px"
    ></div>
  </div>

  <div
    class="callout disp"
    style:top="{ctop}px"
    role="dialog"
    aria-modal="true"
    aria-label="Instructs: reading your finale"
    bind:this={calloutEl}
  >
    <div class="callhead">
      <span class="eyebrow">INSTRUCTS</span>
      <button class="x" onclick={finish} aria-label="Close the tour"
        ><CornerPillArt glyph="close" /></button
      >
    </div>
    {#key i}
      <div class="callbody">
        <div class="calltitle">{stops[i].title}</div>
        <p class="cap">{stops[i].copy}</p>
      </div>
    {/key}
    <div class="callfoot">
      <div class="dots">
        {#each stops as _, j}
          <button
            class="dot"
            class:done={j < i}
            class:cur={j === i}
            aria-label="Stop {j + 1} of {stops.length}"
            aria-current={j === i ? "step" : undefined}
            onclick={() => go(j)}
          ></button>
        {/each}
      </div>
      <!-- The board tour's exact footer grammar: drawn-arrow pager pills,
           and the closing verb in the armed orange. TAKE A BOW, because the
           finale is the ceremony — PLAY BALL already means "start". -->
      <div class="navs">
        <button class="confirm nav" aria-label="Back" disabled={i === 0} onclick={() => go(i - 1)}
          ><svg class="aro" viewBox="0 0 14 14" aria-hidden="true"
            ><path d="M12 7H2.6M6.2 3.4 2.6 7l3.6 3.6" /></svg
          ></button
        >
        {#if i < stops.length - 1}
          <button
            class="confirm nav"
            aria-label="Next"
            bind:this={nextBtn}
            onclick={() => go(i + 1)}
            ><svg class="aro" viewBox="0 0 14 14" aria-hidden="true"
              ><path d="M2 7h9.4M7.8 3.4 11.4 7l-3.6 3.6" /></svg
            ></button
          >
        {:else}
          <button class="confirm bow" bind:this={nextBtn} onclick={finish}
            ><span class="chiplbl">TAKE A BOW</span></button
          >
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .shade {
    position: fixed;
    inset: 0;
    z-index: 60;
    overflow: hidden;
  }
  .window {
    position: fixed;
    border-radius: 12px;
    box-shadow: 0 0 0 200vmax rgba(36, 34, 28, 0.45);
    transition:
      top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .callout {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    width: min(360px, calc(100vw - 24px));
    z-index: 61;
    background: var(--ground);
    border: 3px solid var(--line);
    border-radius: 14px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .callhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .eyebrow {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: var(--gold-8);
  }
  @supports (text-box: trim-both cap alphabetic) {
    .eyebrow,
    .calltitle {
      text-box: trim-both cap alphabetic;
    }
  }
  .x {
    flex: none;
    border: 2px solid transparent;
    border-radius: 999px;
    background: transparent;
    /* Ink mark, gray ring — CornerButtons' resting pill documents the call. */
    color: var(--ink);
    padding: 0;
    width: 28px;
    height: 22px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
  }
  .x::after {
    content: "";
    position: absolute;
    inset: -11px -8px;
  }
  .x:active {
    transform: translateY(1.5px);
  }
  .navs {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .nav {
    flex: none;
    background: var(--card);
    border-color: var(--line);
    color: var(--ink);
    padding-block: 0;
    padding-inline: 8px;
    transition: transform 0.08s;
  }
  .nav::after {
    content: "";
    position: absolute;
    inset: -10px -3px;
  }
  .nav:active:not(:disabled) {
    transform: translateY(1.5px);
  }
  .nav:disabled {
    border-color: var(--gray-ink);
    color: var(--gray-ink);
    cursor: default;
    opacity: 0.55;
  }
  .aro {
    display: block;
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .bow {
    flex: none;
    background: var(--orange-2);
    border-color: var(--orange-8);
    color: var(--ink);
    letter-spacing: 0.08em;
    transition: transform 0.08s;
  }
  .bow:active {
    transform: translateY(1.5px);
  }
  /* The tracking, given back — one step of the 0.08em rides after the final
     W, seating the centered label left of the pill's middle (the board
     tour's PLAY BALL and app.css's .warchip .unit document the leak). */
  .bow .chiplbl {
    margin-inline-end: -0.08em;
  }
  .callbody {
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: bodyup 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes bodyup {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .calltitle {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.12em;
  }
  .cap {
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted-2);
    margin: 0;
  }
  .callfoot {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dots {
    display: flex;
    gap: 7px;
    flex: 1;
  }
  .dot {
    width: 11px;
    height: 11px;
    border-radius: 999px;
    border: 2px solid var(--gray-ink);
    background: transparent;
    padding: 0;
    cursor: pointer;
    position: relative;
  }
  .dot::after {
    content: "";
    position: absolute;
    inset: -14px -3px;
  }
  .dot.done {
    border: 2px solid var(--ink);
    background: var(--ink);
  }
  .dot.cur {
    border: 2px solid var(--orange-8);
    background: var(--orange-2);
  }
  .x:focus-visible,
  .nav:focus-visible,
  .dot:focus-visible,
  .bow:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
</style>

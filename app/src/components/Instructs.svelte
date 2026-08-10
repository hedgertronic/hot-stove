<script lang="ts">
  /* INSTRUCTS — the first-run spotlight tour, named for the instructional
   * league: four stops, each one dims the whole board except the piece being
   * explained and seats a small cardstock callout beside it.
   *
   * No modal and no screenshots: the spotlight is a fixed "window" div moved
   * over the LIVE section (a giant box-shadow paints the wash around it), so
   * the player is looking at the real board the whole time. The window sits
   * above everything and swallows every pointer, which is also what keeps the
   * board inert while the tour holds it.
   *
   * No highlight ring (owner call, 2026-08-10 — an earlier draft wore the
   * blue focus ring): the wash contrast IS the highlight, the window GLIDES
   * between stops (top/left/size transition below), and the revealed section
   * announces itself with one small pop (.spotlit) instead of an outline.
   * Orange stays out of it either way: orange dash means "tap me now", and a
   * tour stop means "look here". */
  import { onMount } from "svelte";
  import { lockScroll } from "../lib/scrolllock";

  interface Stop {
    /** Resolved against the live board; a stop whose selector finds nothing
     * is dropped rather than spotlighting an empty rect. */
    selector: string;
    title: string;
    copy: string;
    /** Stop 1's seats, drawn as a row of dashed mini-chips — the rail's own
     * "open seat" vocabulary carries the list a sentence slogged through. */
    seats?: string[];
    /** Stop 4's roster of power-ups: one glyph-led line each, rendered as a
     * tight list under the copy rather than crammed into a paragraph. */
    list?: { glyph: string; name: string; text: string }[];
  }

  /* Copy rules: short sentences, plain words, no clauses that make the
   * player hold state. What each stop teaches (owner spec, 2026-08-10):
   * 1 the seats to fill, 2 owner + stadium + the price-is-right budget rule,
   * 3 what a signing scores and costs, 4 one line per power-up. */
  const STOPS: Stop[] = [
    {
      selector: ".railwrap",
      title: "YOUR SQUAD",
      copy: "Fill every seat. Dashed seats are still open.",
      seats: ["MGR", "C", "IF", "IF", "OF", "UTIL", "SP", "SP", "RP"],
    },
    {
      selector: ".bankwrap",
      title: "YOUR PAYROLL",
      copy: "Sign an owner and a stadium too. Together they set your budget. Spend as close to it as you can without going over.",
    },
    {
      selector: ".plist",
      title: "SIGNING A PLAYER",
      copy: "Tap a player, then tap SIGN. A signing adds his WAR plus points for awards and rings. His salary counts against your payroll.",
    },
    {
      selector: ".pprow",
      title: "POWER-UPS",
      copy: "Each one works once per game.",
      list: [
        { glyph: "🎟️", name: "SEASON TICKET", text: "same club, any year." },
        { glyph: "🚚", name: "RELOCATE", text: "same year, any club." },
        { glyph: "✌️", name: "DOUBLE PLAY", text: "two signings on one spin." },
        { glyph: "🔁", name: "TRADE DEADLINE", text: "swap a signing for this card's." },
        { glyph: "⭐", name: "PRIME TIME", text: "take any season of a player's career." },
        { glyph: "🏠", name: "HOMEGROWN", text: "sign a hometown player for $1M." },
      ],
    },
  ];

  let { onclose }: { onclose: () => void } = $props();

  let stops = $state<Stop[]>([]);
  let i = $state(0);
  let box = $state<{ top: number; left: number; width: number; height: number } | null>(null);
  let below = $state(true);
  let calloutEl = $state<HTMLElement | undefined>();
  let nextBtn = $state<HTMLButtonElement | undefined>();

  let release: (() => void) | null = null;

  function target(): Element | null {
    return stops[i] ? document.querySelector(stops[i].selector) : null;
  }

  function measure() {
    const el = target();
    if (!el) return;
    const r = el.getBoundingClientRect();
    /* 6px of air so the ring never sits on the section's own border. */
    box = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
    /* The callout goes under the window when there is room for it, else over. */
    below = window.innerHeight - (r.bottom + 6) >= 150;
  }

  /* The pending settle, cancellable: `settleTimer` + the scrollend listener
   * are the outstanding work and `dead` marks the component gone. Without
   * both, two real leaks (Sol review, 2026-08-10): a hop while a prior
   * hop's settle was still pending took a SECOND lock and kept only the
   * newer release, and an Escape before the first settle let the stale
   * callback lock a page whose releasing component had already unmounted.
   * lockScroll is reference-counted, so either way the page stayed locked
   * for good. */
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let dead = false;
  /** The section currently wearing the .spotlit pop — held so the next hop
   * can take it off before the class lands somewhere else. */
  let spotEl: Element | null = null;

  function onScrollEnd() {
    clearTimeout(settleTimer);
    window.removeEventListener("scrollend", onScrollEnd);
    if (dead) return;
    measure();
    /* The pop rides the SETTLED position: re-adding the class restarts the
     * animation on the stop's own section. Paint-only (scale), removed on
     * the next hop. */
    spotEl?.classList.remove("spotlit");
    spotEl = target();
    spotEl?.classList.add("spotlit");
    release = lockScroll();
    nextBtn?.focus();
  }

  function go(n: number) {
    i = n;
    const el = target();
    if (!el) return;
    /* The body lock (overflow: hidden) also blocks programmatic scrolling,
     * so each hop releases it for the glide and takes it back once the
     * scroll settles — scrollend where the engine has it, a timer where it
     * does not (Safari) or where no scroll was needed at all. Optional
     * call: jsdom mounts this component in the App suites and implements no
     * scrolling. measure() runs immediately as well, so the window starts
     * gliding toward the new stop while the page is still traveling (the
     * capture-phase scroll listener keeps it honest en route). */
    release?.();
    release = null;
    spotEl?.classList.remove("spotlit");
    const glide =
      typeof matchMedia === "function" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ block: "center", behavior: glide ? "smooth" : "auto" });
    measure();
    clearTimeout(settleTimer);
    window.removeEventListener("scrollend", onScrollEnd);
    window.addEventListener("scrollend", onScrollEnd, { once: true });
    settleTimer = setTimeout(onScrollEnd, glide ? 600 : 60);
  }

  function finish() {
    onclose();
  }

  /* Tab cycles the callout's own controls; the board below is inert but its
   * tab order is not, and a tour that tabs into a dimmed button has lost the
   * player. Same shape as Sheet's trapTab. */
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

  /* onMount, not $effect: the setup writes the same state the tour then
   * reads (stops, i, box), and inside a tracked effect that is a read-write
   * cycle — Svelte kills it with effect_update_depth_exceeded. Mount runs
   * untracked, once, which is also the only cadence setup wants. */
  onMount(() => {
    stops = STOPS.filter((s) => document.querySelector(s.selector));
    if (stops.length === 0) {
      onclose();
      return;
    }
    go(0);
    const remeasure = () => measure();
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      dead = true;
      clearTimeout(settleTimer);
      window.removeEventListener("scrollend", onScrollEnd);
      spotEl?.classList.remove("spotlit");
      spotEl = null;
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
      release?.();
      release = null;
    };
  });
</script>

<svelte:window onkeydown={(e) => (e.key === "Escape" ? finish() : trapTab(e))} />

{#if box && stops[i]}
  <div class="shade" role="presentation">
    <!-- The window: transparent over the live section, wash everywhere else.
         200vmax of box-shadow reaches every corner at any aspect ratio. -->
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
    class:below
    style:--anchor-top="{box.top}px"
    style:--anchor-bottom="{box.top + box.height}px"
    role="dialog"
    aria-modal="true"
    aria-label="Instructs: how to play"
    bind:this={calloutEl}
  >
    <div class="callhead">
      <span class="eyebrow">INSTRUCTS</span>
      <button class="skip" onclick={finish}>SKIP</button>
    </div>
    <!-- Keyed on the stop, so each hop swaps the body with one small rise —
         the same fadeup grammar App's .after sections enter with. The head
         and footer stay put: chrome does not re-enter. -->
    {#key i}
      <div class="callbody">
        <div class="calltitle">{stops[i].title}</div>
        <p class="cap">{stops[i].copy}</p>
        {#if stops[i].seats}
          <div class="seatrow" aria-hidden="true">
            {#each stops[i].seats as s, k (k)}
              <span class="seat">{s}</span>
            {/each}
          </div>
        {/if}
        {#if stops[i].list}
          <ul class="pplist">
            {#each stops[i].list as pp (pp.name)}
              <li><span class="ppg">{pp.glyph}</span><b>{pp.name}</b> {pp.text}</li>
            {/each}
          </ul>
        {/if}
      </div>
    {/key}
    <div class="callfoot">
      <!-- Punch dots, the home screen's own vocabulary: a done stop is
           punched, the current one is lit, the rest are open. -->
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
      <button
        class="next"
        class:final={i === stops.length - 1}
        bind:this={nextBtn}
        onclick={() => (i < stops.length - 1 ? go(i + 1) : finish())}
        >{i === stops.length - 1 ? "PLAY BALL" : "NEXT"}</button
      >
    </div>
  </div>
{/if}

<style>
  /* Above the Sheet backdrop's 50: the tour holds the whole screen and no
     modal opens during it, but the number states the intent. */
  .shade {
    position: fixed;
    inset: 0;
    z-index: 60;
    overflow: hidden;
  }
  .window {
    position: fixed;
    border-radius: 12px;
    /* The Sheet backdrop's exact wash, painted around the window instead of
       over it. No drop shadows in this app; a shadow with zero blur is a
       painted region, not a glow. No outline either — the wash boundary is
       the highlight, and the GLIDE below is what says "now look here": the
       hole travels to the next stop instead of teleporting. app.css kills
       every transition for reduced-motion readers. */
    box-shadow: 0 0 0 200vmax rgba(36, 34, 28, 0.45);
    transition:
      top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  /* The revealed section's one pop — App's .after entrance spring, spent on
     scale instead of travel so the board underneath never reflows. Global:
     the class lands on board sections this component does not own. */
  :global(.spotlit) {
    animation: spotpop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes spotpop {
    from {
      transform: scale(0.985);
    }
    50% {
      transform: scale(1.008);
    }
    to {
      transform: scale(1);
    }
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
    top: calc(var(--anchor-bottom) + 12px);
    /* Rides the window's glide: the anchor vars move and the card follows on
       the same curve. A hop that flips the card between below and above the
       window swaps top for bottom, which cannot interpolate — that hop cuts,
       and the keyed body's rise covers it. */
    transition:
      top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .callout:not(.below) {
    top: auto;
    bottom: calc(100vh - var(--anchor-top) + 12px);
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
  .skip {
    border: 0;
    background: none;
    font-family: inherit;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--gray-ink);
    cursor: pointer;
    /* The 44px tap floor, grown outward so the resting label stays quiet. */
    padding: 8px;
    margin: -8px;
  }
  /* The keyed body: each hop's content rises in on App's own .after spring.
     Chrome (head, dots, NEXT) sits outside and never re-enters. */
  .callbody {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
  /* Stop 1's seats, in the rail's own open-seat costume: dashed gray
     mini-chips, one per seat, duplicates and all — the row IS the count. */
  .seatrow {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .seat {
    border: 1.5px dashed var(--gray-ink);
    border-radius: 6px;
    color: var(--gray-ink);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 3px 6px;
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
  /* SOLID rings, not dashed: a 2px dash on an 11px circle rasterizes as
     three broken arcs (owner screenshot, 2026-08-10) — the dash grammar
     needs a run of edge to live on, and a dot this small has none. So the
     stepper speaks in fill instead: open is a hollow gray ring, done is
     punched ink, current is the armed pair. */
  .dot {
    width: 11px;
    height: 11px;
    border-radius: 999px;
    border: 2px solid var(--gray-ink);
    background: transparent;
    padding: 0;
    cursor: pointer;
  }
  .dot.done {
    border: 2px solid var(--ink);
    background: var(--ink);
  }
  .dot.cur {
    border: 2px solid var(--orange-8);
    background: var(--orange-2);
  }
  /* Stop 4's power-up roster: one line each, the glyph in a fixed gutter so
     the six names rag on a common left edge. */
  .pplist {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    line-height: 1.4;
    color: var(--muted-2);
  }
  .pplist b {
    font-weight: 800;
    color: var(--ink);
    letter-spacing: 0.04em;
    font-size: 10px;
    margin-inline-end: 4px;
  }
  .ppg {
    display: inline-block;
    width: 20px;
  }
  .next {
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    color: var(--ink);
    font-family: inherit;
    font-size: 10.5px;
    font-weight: 900;
    letter-spacing: 0.08em;
    padding: 8px 16px;
    cursor: pointer;
    transition: transform 0.08s;
  }
  .next:active {
    transform: translateY(1.5px);
  }
  /* The last stop commits, so it wears the confirm's ink. */
  .next.final {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--card);
  }
  .skip:focus-visible,
  .dot:focus-visible,
  .next:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .next.final:focus-visible {
    outline-offset: 3px;
  }
</style>

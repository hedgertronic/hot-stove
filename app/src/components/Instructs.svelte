<script lang="ts">
  /* INSTRUCTS — the first-run spotlight tour, named for the instructional
   * league: five stops, each one dims the whole board except the piece being
   * explained and seats a small cardstock callout beside it.
   *
   * No modal and no screenshots: the spotlight is a fixed "window" div moved
   * over the LIVE section (a giant box-shadow paints the wash around it), so
   * the player is looking at the real board the whole time. The window sits
   * above everything and swallows every pointer, which is also what keeps the
   * board inert while the tour holds it.
   *
   * No highlight ring and no arrival pop (owner calls, 2026-08-10 — earlier
   * drafts wore the blue focus ring, then a .spotlit scale pulse): the wash
   * contrast IS the highlight and the window GLIDING between stops
   * (top/left/size transition below) is what says "now look here" — the
   * revealed section itself holds perfectly still.
   * Orange stays off the SPOTLIGHT: orange means "tap me now" and a tour
   * stop means "look here" — so the wash and window are ink-neutral, and the
   * only orange in the tour is the PLAY BALL pill, which is exactly the tap
   * being asked for. */
  import { onMount } from "svelte";
  import { lockScroll } from "../lib/scrolllock";
  import CornerPillArt from "./CornerPillArt.svelte";

  interface Stop {
    /** Resolved against the live board; a stop whose selector finds nothing
     * is dropped rather than spotlighting an empty rect. */
    selector: string;
    /** Extra existence gate: the stop is also dropped when THIS selector
     * finds nothing. For sections whose wrapper always renders but can be
     * empty — the front office div exists tile-less in the fixed-cap banks
     * when the card has no skipper, and spotlighting a zero-height wrapper
     * teaches nothing. An element check, not a rect check, so jsdom (all
     * rects zero) keeps mounting the tour in the App suites. */
    requires?: string;
    title: string;
    copy: string;
    /** The last stop's roster of power-ups: one glyph-led line each, rendered as a
     * tight list under the copy rather than crammed into a paragraph. */
    list?: { glyph: string; name: string; text: string }[];
  }

  let { onclose, fixedCap = false }: { onclose: () => void; fixedCap?: boolean } = $props();

  /* Copy is the owner's verbatim (2026-08-10). What each stop teaches:
   * 1 the seats to fill, 2 the price-is-right payroll rule + the tax,
   * 3 the front office's hires, 4 what a signing scores and costs,
   * 5 one line per power-up. Stops 2 and 3 speak per bank: Moneyball and
   * Blank Check hand the payroll out (no owner, no stadium), so telling
   * their first-time player to hire either would be teaching UI that does
   * not exist — there the front-office stop teaches the manager alone
   * (owner call, 2026-08-11; it used to drop wholesale, and a fixed-cap
   * first-timer finished the tour never hearing the manager existed).
   * Built as a call at mount (not a module const): two stops' copy reads
   * the prop, and the tour mounts once per game, after the bank is known. */
  const stopsFor = (fixed: boolean): Stop[] => [
    {
      selector: ".railwrap",
      title: "YOUR SQUAD",
      copy: "Build a team of 8 players and a manager. Dashed seats are still open.",
    },
    {
      selector: ".bankwrap",
      title: "YOUR PAYROLL",
      copy: fixed
        ? "This bank fixes your payroll. Spend as close to it as you can without going over. Every million over costs you a point."
        : "Your owner and stadium set your payroll. Spend as close to it as you can without going over. Every million over costs you a point.",
    },
    {
      selector: ".special",
      /* The gate matches the copy: on the classic bank the stop needs an
       * owner or stadium tile (`:not(.skip)`) because its copy sells all
       * three hires; on a fixed-cap bank the front office is the manager
       * tile alone (SpecialRows gates the owner and stadium off), so the
       * copy shrinks to the manager and the gate to the skipper row —
       * dropped only when the landed card carries no skipper at all. */
      requires: fixed ? ".special .srow.skip" : ".special .srow:not(.skip)",
      title: "THE FRONT OFFICE",
      copy: fixed
        ? "Hire a manager. Managers with better records add more wins."
        : "Hire an owner, buy a stadium, and hire a manager. Stadiums with more fans stretch your payroll, and managers with better records add more wins.",
    },
    {
      selector: ".plist",
      title: "SIGNING A PLAYER",
      copy: "Sign players at the value of their contract. Higher WAR players contribute more points, as do awards and rings.",
    },
    {
      selector: ".pprow",
      title: "POWER-UPS",
      copy: "Get creative with your power-ups, which you can use once each per game.",
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

  let stops = $state<Stop[]>([]);
  let i = $state(0);
  let box = $state<{ top: number; left: number; width: number; height: number } | null>(null);
  let below = $state(true);
  /** The card's one positioning axis, in pixels. Both sides of the window
   * resolve to a `top` value (above = window top minus the card's own
   * height), so a hop that flips sides interpolates like any other — the
   * old top/bottom anchor pair could only CUT across the flip, which is
   * exactly the stop 3 → 4 jump (short front office, tall market list). */
  let ctop = $state(0);
  let calloutEl = $state<HTMLElement | undefined>();
  let nextBtn = $state<HTMLButtonElement | undefined>();

  /* The card's height changes when the keyed body swaps (stop 5's power-up
   * roster is twice the others) and when its copy rewraps; the above-side
   * seat depends on that height, so the observer re-seats it through the
   * same top transition. Guarded: jsdom has no ResizeObserver. */
  const ro =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure(false)) : null;
  $effect(() => {
    if (!calloutEl || !ro) return;
    ro.observe(calloutEl);
    return () => ro.disconnect();
  });

  /* Focus enters the dialog the moment its forward button exists (and
   * follows it when the last stop swaps the arrow for the verb pill):
   * trapTab only cycles buttons INSIDE the callout, so until focus is in
   * here, Tab still walked the dimmed board and Enter could press a control
   * behind the modal (Sol review, 2026-08-10 — the settle's focus arrived
   * up to 600ms late). preventScroll everywhere: a focus-induced scroll
   * would fight the glide. */
  $effect(() => {
    nextBtn?.focus({ preventScroll: true });
  });

  let release: (() => void) | null = null;

  function target(): Element | null {
    return stops[i] ? document.querySelector(stops[i].selector) : null;
  }

  /* The spotlight hugs the target's CONTENT box, not its border box. The
   * stops' sections carry padding as inter-section spacing, never as card
   * interior (.railwrap pads 6px over / 4px under its rows, .plist pads 10px
   * under its last row), and a border-box ring wears that spacing as extra
   * air on one axis — stop 1 read visibly taller-than-wide against the
   * uniform 6px ring every other stop got. Computed here rather than
   * constants in the stop table, so a component's spacing change can't
   * strand a stale correction. */
  function contentRect(el: Element): DOMRect {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;
    return new DOMRect(r.left + pl, r.top + pt, r.width - pl - pr, r.height - pt - pb);
  }

  /* placement=false moves only the window and its anchors: the en-route
   * remeasures (the capture-phase scroll listener, firing every frame of the
   * glide) must keep the box tracking the traveling section WITHOUT
   * re-deciding which side the card sits on. `below` flips between `top: Xpx`
   * and `top: auto`, which cannot interpolate — a hop that re-decided it
   * per-frame cut the card across the window mid-glide (once, sometimes
   * twice) and read as a stutter. go() decides placement once per hop from
   * the section's SETTLED position, and the settle's full measure confirms
   * it from the real rect. */
  function measure(placement = true) {
    const el = target();
    if (!el) return;
    const r = contentRect(el);
    /* 6px of air so the ring never sits on the section's own border. */
    box = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
    const h = Math.max(calloutEl?.offsetHeight ?? 0, 150);
    /* The callout goes under the window when the MEASURED card fits there
     * with air, else over. Measured, not a constant: a fixed 150 called
     * "below" for the tall POWER-UPS card with room it didn't have, and the
     * clamp then dragged it up over the spotlight — permanently, since every
     * settled remeasure re-made the same call (Sol review, 2026-08-10). */
    if (placement) below = window.innerHeight - (r.bottom + 6) >= h + 24;
    /* The seat, recomputed on EVERY measure so the glide, the side flip, and
     * the card's own height changes all travel the one top transition.
     * Clamped 8px inside the viewport: a section taller than the screen
     * (stop 4's market list, centered) would otherwise push the above seat
     * off the top edge. The ceiling applies FIRST and the 8px floor wins:
     * min-last inverts the interval on a viewport shorter than the card and
     * shoves the header — and its only ✕ — off the top; pinning the top
     * keeps the card closable and lets the footer overflow instead. */
    const want = below ? box.top + box.height + 12 : box.top - h - 12;
    ctop = Math.max(Math.min(want, window.innerHeight - h - 8), 8);
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
    const glide =
      typeof matchMedia === "function" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView?.({ block: "center", behavior: glide ? "smooth" : "auto" });
    /* Placement, decided ONCE per hop from where the section will END UP:
     * block "center" seats its middle on the viewport's, so the landed
     * bottom is (viewport + height) / 2 regardless of where the rect sits
     * right now. Deciding from the current rect put the card on the wrong
     * side for most of the glide and flipped it mid-travel. A clamped
     * scroll (section pinned at a document edge) lands elsewhere; the
     * settle's full measure corrects that case, once, after the glide. */
    const rb = el.getBoundingClientRect();
    /* block "center" seats the BORDER box's middle on the viewport's, but
       the box the card seats against is the CONTENT box, whose bottom lands
       short of the border's by the target's bottom padding — predicting
       from the border box alone called "above" for rooms the settled
       content-box measure then called "below" (.plist pads 10px), which is
       the delayed side flip this prediction exists to prevent. */
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
    stops = stopsFor(fixedCap).filter(
      (s) => document.querySelector(s.selector) && (!s.requires || document.querySelector(s.requires)),
    );
    if (stops.length === 0) {
      onclose();
      return;
    }
    go(0);
    /* Resize re-decides placement (the room genuinely changed); scroll only
     * tracks — the page is scroll-locked between hops, so scroll events are
     * the glide itself, and the glide must not flip the card. */
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
    style:top="{ctop}px"
    role="dialog"
    aria-modal="true"
    aria-label="Instructs: how to play"
    bind:this={calloutEl}
  >
    <div class="callhead">
      <span class="eyebrow">INSTRUCTS</span>
      <!-- The HUD's own ✕ pill (owner call, 2026-08-10 — earlier drafts wore
           a SKIP word here, then a » arrow below): leaving the tour is the
           same verb as leaving any sheet, so it wears the same capsule. -->
      <button class="x" onclick={finish} aria-label="Close the tour"
        ><CornerPillArt glyph="close" /></button
      >
    </div>
    <!-- Keyed on the stop, so each hop swaps the body with one small rise —
         the same fadeup grammar App's .after sections enter with. The head
         and footer stay put: chrome does not re-enter. -->
    {#key i}
      <div class="callbody">
        <div class="calltitle">{stops[i].title}</div>
        <p class="cap">{stops[i].copy}</p>
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
      <!-- Prev/next as a tight pair (owner calls, 2026-08-10): the shared
           confirm pill's 24px capsule (the `confirm` markup class joins
           app.css's recipe) carrying the pick-a-slot hint's arrow glyph
           family, pointed left and right, with the same per-engine em seat
           MarketRow documents. QUIET cardstock, not the hint's orange, and
           not the confirm's ink: orange is the pending-question voice and
           ink is the commit voice (SIGN, HIRE), and a page-turn is neither.
           The last stop commits, so its forward is the PLAY BALL pill — an
           arrow can advance, only a verb should finish — in the confirm
           recipe's own ink. -->
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
          <button class="confirm playball" bind:this={nextBtn} onclick={finish}
            ><span class="chiplbl">PLAY BALL</span></button
          >
        {/if}
      </div>
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
    box-shadow: 0 0 0 200vmax var(--scrim);
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
    /* top is COMPUTED (measure's ctop): one axis for both sides of the
       window, so every hop rides this one transition on the window's own
       curve — including the side flip the old top/bottom anchor pair could
       only cut across. */
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
  /* Sheet's .title doctrine, owed to both runs of caps on this card: the
   * eyebrow shares its row with the ✕ pill and the title sits over the copy,
   * and line-box-centered caps ride ~0.3–0.9px high (highest on WebKit)
   * beside anything the box actually centers. Trimmed, the caps seat on
   * their cap band; engines without the trim keep the line box, as all bare
   * caps do. */
  @supports (text-box: trim-both cap alphabetic) {
    .eyebrow,
    .calltitle {
      text-box: trim-both cap alphabetic;
    }
  }
  /* The header's ✕: Sheet's exact host — transparent 2px border (the
   * capsule is DRAWN by CornerPillArt, ring and mark in one svg), 28×22 box,
   * and the invisible tap extension that lands both axes on 44. */
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
  /* The pair rides tighter than the footer's own 10px gap — two halves of
   * one pager, not two separate offers. */
  .navs {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  /* Prev/next: deltas over the shared confirm recipe (app.css sets the 24px
   * capsule, type and cursor) — quiet cardstock with an arrow instead of
   * words. padding-block zeroed: the recipe's 0.047em cap-seat correction is
   * for capital LETTERS, and an arrow glyph centered by flex + the em seat
   * below doesn't want it. Same tap-floor idea as the ✕'s extension. */
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
  /* The dead back arrow at stop 1: the market's own non-candidate gray —
   * availability is binary, and the affordance must match. */
  .nav:disabled {
    border-color: var(--gray-ink);
    color: var(--gray-ink);
    cursor: default;
    opacity: 0.55;
  }
  /* A DRAWN arrow, not a font glyph — the CornerPillArt doctrine: font
   * arrows seat differently per engine (MarketRow carries two per-engine em
   * corrections for its ↑/←), and a 14px vector centered by flex has nothing
   * for the engines to disagree about. Line-art voice matches the ✕ above:
   * currentColor stroke, 1.6 weight, round caps. */
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
  /* PLAY BALL in the armed orange (owner call, 2026-08-10): the tour's last
   * tap is the one being asked for, and orange is the "tap me now" voice. */
  .playball {
    flex: none;
    background: var(--orange-2);
    border-color: var(--orange-8);
    color: var(--ink);
    letter-spacing: 0.08em;
    transition: transform 0.08s;
  }
  .playball:active {
    transform: translateY(1.5px);
  }
  /* The tracking, given back — letter-spacing adds its 0.08em after EVERY
     glyph including the last, so the label's box ran one step past the final
     L and the centered word seated left of the pill's middle (the .warchip
     .unit recipe in app.css documents the leak with measurements). */
  .playball .chiplbl {
    margin-inline-end: -0.08em;
  }
  /* The keyed body: each hop's content rises in on App's own .after spring.
     Chrome (head, dots, NEXT) sits outside and never re-enters. */
  .callbody {
    display: flex;
    flex-direction: column;
    /* Tighter than the card's 8px chrome gap: the title binds to its copy,
       so each stop reads as one unit under the kicker rather than three
       evenly spaced lines. */
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
  /* Default greedy wrap, deliberately: `text-wrap: pretty` was tried here
     (2026-08-10) and Chrome's whole-paragraph optimizer traded line length
     for rag — words moved down and the card read as wasting its right
     third. On a 330px measure, full lines beat a tidy rag. */
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
    position: relative;
  }
  /* The footer's other controls all buy the 44px tap floor with an invisible
     extension; an 11px dot owes one too. Full height vertically, but only
     3px sideways — half the 7px gap — so neighboring dots' targets never
     overlap and a thumb between two dots hits neither. */
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
  /* The last stop's power-up roster: one line each, the glyph in a fixed gutter so
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
  .x:focus-visible,
  .nav:focus-visible,
  .dot:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .playball:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
</style>

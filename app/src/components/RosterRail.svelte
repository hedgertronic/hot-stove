<script lang="ts">
  import { untrack } from "svelte";
  import { quintOut } from "svelte/easing";
  import { SLOT_TYPES, type Game, type Signed } from "../lib/engine.svelte";
  import { costTier, lastName, money, slotLabel, sortAwards, statValue, warTier } from "../lib/format";
  import { MANAGER_PER_NET_WIN, WBC_CHAMPION_ID, WBC_RUNNERUP_ID } from "../lib/scoring";
  import type { CardPlayer } from "../lib/types";
  import { wrapnudge } from "../lib/wrapnudge";
  import AwardPill from "./AwardPill.svelte";
  import RailSeat from "./RailSeat.svelte";

  let { game }: { game: Game } = $props();

  const pickPlayer = $derived.by((): CardPlayer | null => {
    const id = game.slotPick ?? game.releasePick;
    if (!id || !game.card) return null;
    return game.card.players.find((p) => p.id === id) ?? null;
  });

  const pickableCells = $derived.by((): Set<number> => {
    if (!pickPlayer) return new Set();
    return new Set(
      game.slotPick ? game.pickableSlotCells(pickPlayer) : game.occupiedSlotsFor(pickPlayer),
    );
  });

  function tapCell(i: number) {
    if (!pickPlayer || !pickableCells.has(i)) return;
    if (game.slotPick) game.signPlayer(pickPlayer, i);
    else game.tdRelease(pickPlayer, i);
  }

  // Phone: while a pick is in flight the rail leaves the flow and pins to the
  // viewport (see the .pinned rule), so a spacer holds the column's height and
  // the bank box below it doesn't jump up under the player's finger mid-tap.
  // The resting height is the honest one — measured while the rail is still in
  // flow — with the live measurement as the cold-start fallback.
  let railH = $state(0);
  let restH = $state(0);
  $effect(() => {
    if (!pickPlayer) restH = railH;
  });

  /** Whether the pick-time pin is actually NEEDED: only when the rail's flow
   * position is not fully on screen. A player already parked at the top of
   * the page can see every seat — overlaying a copy of what they are looking
   * at just eats a rail's height of the list. Checked when the pick starts
   * and on every scroll/resize while it is in flight, so scrolling down
   * mid-pick still pins the picker before it leaves the viewport.
   *
   * The measured element switches with the state: in flow the rail itself is
   * the honest rect; pinned, the rail is fixed at the top and the SPACER is
   * what holds its flow slot, so the spacer answers for it — which is also
   * what lets a scroll back to the top unpin cleanly. The listener reads
   * state but runs outside the effect's tracking, so only `pickPlayer`
   * re-runs the effect.
   *
   * THE THRESHOLD IS THE SEATS' TOP, NOT THE WRAP'S, and the header is the
   * whole reason. The pin drops the header (`.railwrap.pinned .railhead`), so
   * the two layouts do not put the seats in the same place for the same
   * scroll position: in flow the seats sit at `wrap.top + padding + header`,
   * pinned they sit at `padding` alone. Triggering on the wrap's own top —
   * "YOUR SQUAD has reached the ceiling" — therefore swapped one layout for
   * the other while the seats still had a header's height to travel, and the
   * grid visibly jumped as it took over the top of the screen.
   *
   * Solving `wrap.top + pad + header = pad′` for the wrap's top is what the
   * comparison below is: the two paddings cancel except for the safe-area
   * inset the pinned one adds, so the pin fires exactly when the SEATS reach
   * the line they are about to be pinned at, and the swap is invisible. */
  let wrapEl = $state<HTMLDivElement | null>(null);
  let gapEl = $state<HTMLDivElement | null>(null);
  let headEl = $state<HTMLDivElement | null>(null);
  let pinNeeded = $state(false);
  $effect(() => {
    if (!pickPlayer) {
      pinNeeded = false;
      return;
    }
    // `env(safe-area-inset-top)`: 0 in a browser tab, the notch inset in a
    // home-screen app. It is the one part of the pinned wrap's top padding
    // that the in-flow wrap does not also carry, so it is the one part that
    // survives the cancellation above. Probed rather than assumed — read off
    // a throwaway box, once per pick, because a hand-written 0 would put the
    // jump straight back for anyone who installed the game to their
    // homescreen, which is the device the pin exists for in the first place.
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const safe = probe.offsetHeight;
    probe.remove();
    // The header's IN-FLOW height, cached rather than read live: the pin is
    // what hides the header, so a read taken during a pinned check measures
    // the 0 of a `display: none` box and would hand the unpin a different
    // threshold than the pin used. Refreshed on every unpinned check, so a
    // font swap or a rotation that reflows the separator is picked up before
    // it can matter.
    let headH = headEl?.offsetHeight ?? 0;
    const check = () => {
      const el = pinNeeded ? gapEl : wrapEl;
      if (!el) return;
      if (!pinNeeded && headEl) headH = headEl.offsetHeight;
      const r = el.getBoundingClientRect();
      // The spacer holds the wrap's whole flow slot, header included, so the
      // same offset answers for both directions and the pin and the unpin
      // fire at one line rather than two.
      // `<=`, not `<`: equality IS the crossing — the seats are exactly on
      // the line they are about to be pinned at — and a strict test defers
      // the swap to the next scroll step, which is a pixel of jump paid for
      // nothing (measured: 1.5px with `<`, 0 with `<=`). Pinning at equality
      // also cannot oscillate against the unpin, which needs the seats
      // strictly back below the line.
      pinNeeded = r.top + headH <= safe || r.bottom > window.innerHeight;
    };
    untrack(check);
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  });
  const gapH = $derived(pickPlayer && pinNeeded ? restH || railH : 0);

  /** Seat sub-line: season identity only ("2013 OAK") — the value rides the
   * seat's own WAR chip, not this line. */
  function seatMeta(s: { year: number; team: string }): string {
    return `${s.year} ${s.team}`;
  }

  /** A filled seat's rung as a bare word, or "" when the mode hides WAR.
   * `RailSeat` dresses the seat's WAR chip from this one value.
   * Gated on `showWar` — the very flag that gates the numeral — because a color
   * that encodes the WAR bucket leaks the talent read just as surely as the
   * digits do, and Eye Test's whole premise is that it can't be read. */
  function tierOf(s: { war: number } | null): string {
    return s && game.showWar ? warTier(s.war) : "";
  }

  /** The skipper's net-win contribution rides the SAME six-rung ladder as a
   * player's WAR, which is what the share string has always printed — the
   * manager cell is 🟥⬜🟩🟦🟪🟨, the player circles' own hues. The app used to
   * draw him in flat green regardless, so a 116-win skipper and a .500 one
   * were the same color on screen while the string called one of them elite.
   * Gated on `showWar`, not `!scout`: same value today, but one flag now
   * governs every tier signal in the rail. The `war-` prefix is deliberate —
   * tests/rail-tiers.test.ts asserts Eye Test emits no `war-` token at all,
   * and a private `mgw-*` prefix would walk out from under that. */
  const mgrWins = $derived(game.managerNetWins * MANAGER_PER_NET_WIN);
  const mgrTier = $derived(game.manager && game.showWar ? warTier(mgrWins) : "");

  /** The landing thunk: a seat that goes empty→filled plays the house
   * thunk-in once — with same-type seats auto-resolving, this is the only
   * signal saying WHERE the man went. Occupancy is DIFFED against a
   * snapshot seeded at mount, deliberately not keyed markup: a {#key} would
   * replay every thunk on restore/reload (the iOS tab-eviction toll the
   * finale's resolved branch exists to avoid), while a diff seeded from the
   * live state thunks only what changes while the player watches. A swap
   * that never passes through empty (undo straight into a different man) is
   * a rewind, and rewinds say nothing on purpose. The mark clears after the
   * animation so a later remount of the same seat stays still; the timer
   * deliberately outlives effect re-runs (clearing it there would strand
   * the mark whenever an unrelated slot changed mid-flight). */
  let landedSeats = $state<(number | "mgr")[]>([]);
  /* svelte-ignore state_referenced_locally -- the mount-time capture IS the
     design: the snapshot seeds from whatever the rail mounts over, which is
     exactly what keeps a restored roster silent. */
  let prevOcc: (string | null)[] = game.slots.map((s) => s?.id ?? null);
  /* svelte-ignore state_referenced_locally */
  let prevMgr: string | null = game.manager ? `${game.manager.name}:${game.manager.year}` : null;
  let landTimer = 0;
  $effect(() => {
    const occ = game.slots.map((s) => s?.id ?? null);
    const mgr = game.manager ? `${game.manager.name}:${game.manager.year}` : null;
    untrack(() => {
      const landed: (number | "mgr")[] = [];
      occ.forEach((id, i) => {
        if (id && prevOcc[i] === null) landed.push(i);
      });
      if (mgr && prevMgr === null) landed.push("mgr");
      prevOcc = occ;
      prevMgr = mgr;
      if (landed.length) {
        landedSeats = landed;
        clearTimeout(landTimer);
        landTimer = window.setTimeout(() => (landedSeats = []), 500);
      }
    });
  });

  /** Phone or not, as the CSS breakpoint sees it — the seat tap is a PHONE
   * gesture only. At width every fact is already on the row, so a click has
   * nothing to answer with, and a button that does nothing is worse than a
   * div. Mirrors the 760px media query exactly rather than inventing a
   * second breakpoint; false during SSR (no window), which renders the
   * desktop resting markup. */
  let phone = $state(false);
  $effect(() => {
    // Guarded the way gridsnap guards ResizeObserver: a DOM without
    // matchMedia (bare jsdom) keeps the desktop resting markup.
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 760px)");
    const update = () => (phone = !mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  });

  /** Which seat's peek overlay is open, or null. One at a time — the rail's
   * own "one question" rule. Folded away the moment the rail's seats belong
   * to a picker, and on a resize out of phone width — the desktop row
   * already says everything. */
  let expandedSeat = $state<number | "mgr" | null>(null);
  $effect(() => {
    if (expandedSeat !== null && (pickPlayer || !phone)) fold();
  });

  /** WHO the open panel is about, stamped at tap time. The peek can outlive
   * its subject — an undo empties the seat, a Trade Deadline swap re-fills
   * it — and a panel that silently changes occupants (or lies open-but-
   * invisible, eating the next tap as a dismissal) is worse than one that
   * folds. So: occupant changes, panel folds. */
  const occupantKey = (i: number | "mgr"): string | null => {
    if (i === "mgr") {
      const m = game.manager;
      return m ? `mgr:${m.name}:${m.year}:${m.team}` : null;
    }
    return game.slots[i]?.id ?? null;
  };
  let peekAbout: string | null = null;
  $effect(() => {
    if (expandedSeat !== null && occupantKey(expandedSeat) !== peekAbout) fold();
  });

  /** The skipper's marks, the finale MGR row's read: MOY (his one pill),
   * then October — same order, same gating as the players' at the call
   * sites. */
  function mgrMarks(m: { moty?: boolean; ws: boolean; pen: boolean }): string[] {
    const marks = m.moty ? ["MOY"] : [];
    if (m.ws) marks.push("💍");
    else if (m.pen) marks.push("🚩");
    return marks;
  }

  /** Everything the open peek says, as plain display values — one shape for
   * both chairs, so the panel markup carries no "is this the manager"
   * branches. Null when nothing is open (or the seat emptied under the
   * panel — a Trade Deadline release mid-peek). */
  const peekView = $derived.by(() => {
    if (expandedSeat === null) return null;
    if (expandedSeat === "mgr") {
      const m = game.manager;
      if (!m) return null;
      return {
        pos: "MGR",
        name: m.name,
        meta: `${m.year} ${m.team}`,
        badges: game.showAwards ? mgrMarks(m) : null,
        sal: null,
        salTier: "",
        war: game.showWar ? statValue(mgrWins) : null,
        tier: mgrTier,
        low: false,
      };
    }
    const s = game.slots[expandedSeat];
    if (!s) return null;
    return {
      pos: slotLabel(SLOT_TYPES[expandedSeat]),
      name: s.name,
      meta: `${s.year} ${s.team}`,
      badges: game.showAwards ? seatBadges(s) : null,
      sal: money(s.costPaid),
      salTier: costTier(s.costPaid),
      war: game.showWar ? s.war.toFixed(1) : null,
      tier: game.showWar ? warTier(s.war) : "",
      low: expandedSeat >= 4,
    };
  });

  /** The peek folds itself away: after a beat (the quit pill's own
   * auto-disarm move, App.svelte's quitTimer — longer here because a badge
   * row takes longer to read than one word), or on a tap anywhere outside
   * the panel. Capture-phase pointerdown, PillSlot's dismissal grammar.
   * Every tap while the panel is up is a dismissal and nothing more (owner
   * call): a tap on another chair folds this peek and does NOT open that
   * seat's own — switching costs two taps. Presses that land on a rail
   * chair are left for tapInfo (the click still sees the open state and
   * folds); everything else closes here. Deliberately NOT on scroll (owner
   * call): the rail scrolls with the page, and a reader nudging the list
   * mid-read would lose the panel under their thumb. */
  const PEEK_MS = 4000;
  let peekEl = $state<HTMLElement | null>(null);
  /** Every close funnels through here so the focus hand-back happens BEFORE
   * the state flips — after it, Svelte has already unmounted the panel and
   * document.activeElement has fallen to <body>, too late to know the
   * keyboard was inside. If the panel (one big button) holds focus, it goes
   * back to the chair that opened it; a tap that moved focus elsewhere is
   * left alone. */
  function fold() {
    if (
      peekEl?.contains(document.activeElement) &&
      peekSeatEl instanceof HTMLElement &&
      peekSeatEl.isConnected
    )
      peekSeatEl.focus();
    expandedSeat = null;
  }
  $effect(() => {
    if (expandedSeat === null) return;
    const timer = setTimeout(fold, PEEK_MS);
    const away = (e: PointerEvent) => {
      if (!peekEl || !(e.target instanceof Node) || peekEl.contains(e.target)) return;
      // A press on one of the rail's own chairs is that seat's affair: its
      // click lands in tapInfo, which folds the peek and opens nothing.
      // Closing it here too would blank the state before the click arrives,
      // and tapInfo would then read the tap as a fresh open — a switch.
      if (
        railEl?.contains(e.target) &&
        e.target instanceof Element &&
        e.target.closest("button.cell.filled, button.mgr.filled")
      )
        return;
      fold();
    };
    // Escape folds too — the panel briefly holds focus (it's a button), and
    // a keyboard that can open a disclosure must be able to shut it.
    const onkey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fold();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", onkey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", onkey, true);
    };
  });

  /** The open/close beat is a MORPH, not a fade: the tapped seat's own
   * rectangle stretches its edges out into the panel's, and shrinks back
   * into the chair on close — the container-transform move, done as FLIP.
   * The tapped seat's ELEMENT is cached at tap time and both rects are
   * measured together inside grow(): the peek outlives page scroll (the
   * no-scroll-dismiss call above), so a rect frozen at tap time would send
   * the close flying to where the chair USED to be. Measured in the same
   * frame, the pair moves together and the delta stays true. A Svelte
   * bidirectional transition rather than a keyframe so the close plays the
   * same film backwards (easing applies to elapsed time both ways — the
   * close also decelerates into the chair), and the transform resolves to
   * none at rest (the finale's rule). Reduced motion, and any DOM that
   * can't measure (jsdom's zero-rects), run it at zero — SpinBanner's own
   * courtesy. */
  const peekStill =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let railEl = $state<HTMLDivElement | null>(null);
  let peekSeatEl: Element | null = null;
  function tapInfo(i: number | "mgr") {
    // Any tap while a peek is up is a dismissal — the same chair or a
    // different one, the panel folds and nothing opens in its place.
    if (expandedSeat !== null) {
      fold();
      return;
    }
    // :scope > .cell walks the eight player seats in slot order — the
    // manager's chair is .mgr and the panel itself is .peek, so neither
    // miscounts the lookup.
    peekSeatEl =
      (i === "mgr"
        ? railEl?.querySelector(":scope > .mgr")
        : railEl?.querySelectorAll(":scope > .cell")[i]) ?? null;
    peekAbout = occupantKey(i);
    expandedSeat = i;
  }
  function grow(node: HTMLElement) {
    const from = peekSeatEl?.getBoundingClientRect();
    const to = node.getBoundingClientRect();
    if (peekStill || !from || !from.width || !to.width) return { duration: 0 };
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    return {
      // 240ms at quintOut — steep launch, long settle — long enough for the
      // stretch to read as a stretch; cubicOut at 200 spent the whole move
      // in its first frames and read as a pop.
      duration: 240,
      easing: quintOut,
      // t runs 0→1 opening, 1→0 closing; u is its complement. Scale lands
      // on 1 as u hits 0. TRANSFORM ONLY — no opacity term, the round-37
      // channel doctrine: an animated opacity crossing 1.0 churns
      // compositing layers, and the drop at landing re-rasterized the
      // panel's award pills at fresh device-pixel rounding (the owner's
      // "pills jitter at land", the undo pill's exact mechanism). The box
      // needs no fade anyway: it is opaque cardstock and at t=0 it IS the
      // seat's rectangle, so the handoff under it is covered by geometry.
      css: (t: number, u: number) =>
        `transform-origin: 0 0; transform: translate(${u * dx}px, ${u * dy}px) scale(${t + sx * u}, ${t + sy * u});`,
    };
  }

  /** A signed seat's hardware as RailSeat's ordered mark list — award codes
   * for pills, bare glyphs for everything else. This is the Finale squad
   * row's read (Finale.svelte's .qbadges), restated as data:
   *   1. 🏠 leads when the player was signed at the Homegrown flat price.
   *   2. The season's awards, through sortAwards() so MVP outranks a GG here
   *      exactly as it does on every other surface.
   *   3. October: 💍 for a ring, else 🚩 for a pennant — never both; the
   *      ring outranks and absorbs the flag.
   *   4. March, INDEPENDENT of October (2017 Bregman wore both): 🥇 for a
   *      WBC title (WBC_CHAMPION_ID), 🥈 for a finalist (WBC_RUNNERUP_ID).
   * Mode gating stays at the call site — this function answers for a slot's
   * facts, the caller answers for what the difficulty lets the screen say. */
  function seatBadges(s: Signed): string[] {
    const marks = s.hero ? ["🏠"] : [];
    marks.push(...sortAwards(s.awards));
    if (s.ws) marks.push("💍");
    else if (s.pen) marks.push("🚩");
    if (s.wbc === WBC_CHAMPION_ID) marks.push("🥇");
    else if (s.wbc === WBC_RUNNERUP_ID) marks.push("🥈");
    return marks;
  }
</script>

<div class="railwrap disp" class:pinned={!!pickPlayer && pinNeeded} bind:this={wrapEl} bind:clientHeight={railH}>
  <div class="psep railhead" bind:this={headEl}>YOUR SQUAD</div>
  <div
    class="rail"
    class:peeking={peekView !== null}
    class:mgrpeek={expandedSeat === "mgr"}
    bind:this={railEl}
  >
    <!-- The manager's seat leads the card at both widths — on the phone it
         anchors the left edge spanning both rows, at width it is the first row.
         One club, nine chairs, same visual language throughout. MGR labels it
         in the same tracked caps the players' position codes use; the sideways
         geometry already marks the chair as a different kind of thing. The
         chip's value is bare — "14.0", no W/WINS unit, no plus — because these
         rows have no room for a unit and the seat's own MGR label already says
         whose number this is. It reads exactly like the WAR on the eight seats
         below it, which is the point: one chip, one ladder, one way to read a
         number. A negative keeps its minus. -->
    <RailSeat
      chair="mgr"
      label="MGR"
      name={game.manager ? lastName(game.manager.name) : null}
      full={game.manager ? game.manager.name : null}
      meta={game.manager ? `${game.manager.year} ${game.manager.team}` : null}
      tier={mgrTier}
      war={game.manager && game.showWar ? statValue(mgrWins) : null}
      badges={game.manager && game.showAwards ? mgrMarks(game.manager) : null}
      expanded={expandedSeat === "mgr"}
      controls="railpeek"
      arrived={landedSeats.includes("mgr")}
      oninfo={game.manager && phone && !pickPlayer ? () => tapInfo("mgr") : undefined}
    />
    {#each game.slots as slot, i}
      <RailSeat
        label={slotLabel(SLOT_TYPES[i])}
        name={slot ? lastName(slot.name) : null}
        full={slot ? slot.name : null}
        meta={slot ? seatMeta(slot) : null}
        tier={tierOf(slot)}
        war={slot && game.showWar ? slot.war.toFixed(1) : null}
        salary={slot ? money(slot.costPaid) : null}
        salaryTier={slot ? costTier(slot.costPaid) : ""}
        badges={slot && game.showAwards ? seatBadges(slot) : null}
        pickable={pickableCells.has(i)}
        expanded={expandedSeat === i}
        controls="railpeek"
        arrived={landedSeats.includes(i)}
        onclick={() => tapCell(i)}
        oninfo={slot && phone && !pickPlayer ? () => tapInfo(i) : undefined}
      />
    {/each}
    <!-- THE PEEK — the phone's full read, OVER the grid instead of inside
         it. PillSlot's doctrine, at seat scale: the reveal overlays the row
         and nothing moves — an earlier cut re-flowed the tapped seat to a
         full-width grid row of its own, and every chair after it walked a
         cell over, which read as the rail rearranging itself under the
         finger. The overlay is anchored to whichever of the two grid rows
         the seat sits in (seats 0–3 weave the top row, 4–7 the bottom — a
         fact of the 5-track grid, so no measurement needed), laid out like
         the finale's squad row, and the whole panel is the close button.
         The seats beneath wash out (.peeking below) so the panel reads as
         the one live thing; opacity rides the CHILDREN rule the finale's
         missed rows use. -->
    <!-- Keyed by seat: a fresh panel per chair, so a tap-fold-tap on two
         different seats within the outro's 240ms measures a fresh FLIP
         origin instead of reversing the OLD panel's flight (a bidirectional
         transition reuses its config mid-reversal — keying is what forces a
         new one). Same-seat re-taps keep the key, and there the reversal's
         cached origin is the right chair anyway. No aria-label: the panel
         is one big button, and its content IS its accessible name — the
         full read is the point. Activating it folds it; the chair carries
         aria-expanded/aria-controls. -->
    {#if peekView}
      {#key expandedSeat}
        <button
          class="peek disp"
          class:low={peekView.low}
          id="railpeek"
          bind:this={peekEl}
          transition:grow
          onclick={fold}
        >
          <b class="ppos">{peekView.pos}</b>
          <!-- wrapnudge: the wrapped-lane optical rebalance the rail's .lane
               and the finale's .qmid carry — same 13px/1.25 line one, same
               1.6px half-overhead. -->
          <span class="pmid" use:wrapnudge={1.6}>
            <span class="pname">{peekView.name} <i>{peekView.meta}</i></span>
            {#if peekView.badges?.length}
              <span class="pbadges"
                >{#each peekView.badges as mark}{#if /^[A-Z]/.test(mark)}<AwardPill
                      code={mark}
                    />{:else}<span class="pemo">{mark}</span>{/if}{/each}</span
              >
            {/if}
          </span>
          {#if peekView.sal}<span class="psal {peekView.salTier}">{peekView.sal}</span>{/if}
          {#if peekView.war}<span class="warchip sm {peekView.tier}">{peekView.war}</span>{/if}
        </button>
      {/key}
    {/if}
  </div>
  <!-- No hint line during picks: the row's orange pending pill plus the lit
       nudging cells are the cues — one cue per state, no redundant copy. -->
</div>
<!-- Placeholder for the pinned rail's vacated flow height (phone only). -->
{#if gapH}<div class="railgap" bind:this={gapEl} style="height:{gapH}px"></div>{/if}

<style>
  /* The rail doubles as the slot/release picker, so it pins to the top only
     while a pick is in flight; otherwise it scrolls away with the page. */
  .railwrap {
    background: var(--ground);
    padding: 6px 0 4px;
    margin-bottom: 4px;
  }
  /* The section header runs at BOTH widths (owner call): the phone's PLAYERS
     separator already names the market below, and an unlabelled grid of eight
     boxes above a labelled list read as chrome rather than as the club — the
     finale calls the same eight seats YOUR SQUAD, and the two surfaces should
     name the object the same way.
     It is dropped while the rail is PINNED, and that carve-out is the whole
     cost of having it. During a slot or release pick the wrap leaves the flow
     and fixes to the top of the viewport (see `.railwrap.pinned`) so the
     picker stays reachable while the market scrolls underneath — every pixel
     the overlay takes is a pixel of that market it covers, and a separator
     naming a card the player is actively tapping is the first thing that can
     go. The flow SPACER still reserves the header's height (`restH` is
     measured in flow, header included), so the page below does not jump when
     the pin engages. */
  @media (max-width: 759px) {
    .railwrap.pinned .railhead {
      display: none;
    }
  }
  /* Phone pin: `fixed`, not `sticky`. A sticky box can only travel inside its
     parent's box, and the rail's parent is the short club column (rail + bank
     box) — sticking would end a few dozen pixels down the page, exactly where
     the player list the user is scrolling begins. Fixed answers to the
     viewport instead, so the release picker stays reachable for the whole
     scroll. Full-bleed with the shell's own 14px gutter re-applied (the
     document flow supplied it before), capped and centered to the shell width.
     z-index 10 keeps it over the list and under the sheets (z 50). */
  .railwrap.pinned {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 10;
    max-width: 480px;
    margin: 0 auto 4px;
    padding: calc(6px + env(safe-area-inset-top)) 14px 4px;
  }
  .railgap {
    margin-bottom: 4px;
  }
  /* Wide: the whole left column is persistently on screen (it sticks as a
     unit), so the phone's pick-time pin has nothing to do — the rail stays in
     flow and its spacer collapses. */
  @media (min-width: 760px) {
    .railwrap.pinned {
      position: static;
      max-width: none;
      margin: 0 0 4px;
      padding: 6px 0 4px;
    }
    .railgap {
      display: none;
    }
  }
  .rail {
    /* The peek's containing block — the overlay is anchored to the rail's
       own box, not the page. */
    position: relative;
    display: grid;
    /* Five EQUAL columns. The first used to be `auto`, which sized the
       manager's column to its content — measured ~5px wider than the four
       player columns on a 390px phone, so the grid read as four matched
       seats plus one odd one. minmax(0, 1fr) rather than bare 1fr so a long
       name truncates inside its seat instead of forcing its column wide. */
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 6px;
  }
  /* While a peek is open the grid beneath washes out — the finale's missed
     rows' move (opacity on the CHILDREN of the state-carrier, never on the
     carrier itself). The panel above is the one thing at full ink, so it
     reads as the answer and everything else as the question set aside. The
     seats' own markup is RailSeat's, hence :global. */
  .peeking > :global(.cell),
  .peeking > :global(.mgr) {
    opacity: 0.35;
  }
  /* The manager's own peek empties the manager's chair — outline and all.
     Every player seat is fully covered by its panel, but the MGR chair
     spans both grid rows (RailSeat's grid-row: 1 / 3) while the panel is
     one row band — at 0.35 the chair's lower half, WAR chip included, read
     as a second "1.2" hanging under the panel's. The morph's story is a
     box leaving its chair, so the chair it left goes dark; the 0.24s wash
     transition above carries it out and back in step with the panel.
     (Contents-only fade with the frame kept was tried — owner picked the
     full fade.) */
  .mgrpeek > :global(.mgr) {
    opacity: 0;
  }
  /* The wash eases in step with the panel's 240ms morph — a snap-dim beside
     an animated box read as two different films. Opacity only ever changes
     with .peeking, so this transitions exactly one state change; the
     channel doctrine's ban is on RESTING interactive pills that churn, not
     on a backdrop finding its level once. Reduced motion stands it down
     with the morph. */
  .rail > :global(.cell),
  .rail > :global(.mgr) {
    transition: opacity 0.24s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .rail > :global(.cell),
    .rail > :global(.mgr) {
      transition: none;
    }
  }
  .peek {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    z-index: 5;
    min-height: 64px;
    display: flex;
    align-items: center;
    /* 9px — the finale row's one-number rule: salary-to-chip air equals
       chip-to-edge air, and the row pads 9. */
    gap: 9px;
    text-align: left;
    background: var(--card);
    border: 2.5px solid var(--line);
    border-radius: 9px;
    padding: 8px 9px;
    font-family: inherit;
    font-size: 10px;
    line-height: 1.25;
    color: inherit;
    cursor: pointer;
    /* Own the compositor layer for the panel's whole (four-second) life
       rather than letting the morph promote one and drop it at landing —
       the drop is a re-raster at fresh device-pixel rounding, which is the
       round-37 undo-pill artifact wearing a new hat (and .pmeter's own
       will-change precedent). The panel is transient and singular, so the
       held layer is noise-priced. */
    will-change: transform;
  }
  /* Anchored to the seat's own half of the weave: seats 0–3 live in the top
     grid row, 4–7 in the bottom. Bottom-anchored, a tall panel grows UP over
     the first row instead of past the rail's edge. */
  .peek.low {
    top: auto;
    bottom: 0;
  }
  /* The landing beat: the CONTENT fades in with the morph from its first
     frame — no delay. Every held cut of this beat (3px rise; 90ms then
     50ms holds) read to the owner as jitter or lag: the ink must simply be
     arriving the whole time the box is. The 120ms ramp still leaves the
     stretch's earliest, most-distorted frames at low opacity, which is all
     the masking the squeeze ever needed. Opacity only, in place.
     Keyframes, not a transition: this plays only on the panel's mount, so
     the close simply rides the box out — a fold should be plainer than an
     unfold. */
  .peek > * {
    animation: peek-ink 120ms ease-out;
    /* Same channel rule as the panel: the ink fade is an animated opacity
       crossing 1.0, so each lane would get a transient layer and drop it
       at fade-end — seven re-rasters landing mid-morph. Holding the layers
       for the panel's life makes the fade's end a no-op for the
       rasterizer. */
    will-change: opacity;
  }
  @keyframes peek-ink {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .peek > * {
      animation: none;
    }
  }
  /* The label lane, name line and season read exactly as the finale's squad
     rows say them — same fields, same registers, one surface language. */
  .ppos {
    /* 31px — the Finale .qpos cut exactly (UTIL plus a hair), NOT the rail
       seat's 30px lane: the panel is a finale row served on demand, so the
       name column starts where the finale's does. */
    width: 31px;
    flex: none;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--muted-2);
    text-align: left;
  }
  .pmid {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    /* The finale .qmid's own gap column-wise; the ROW gap runs 4px where
       the finale's is 2px because the finale's 1.603 line box carries its
       own air — matching the VISUAL name-to-pills distance (~5.5px of ink
       air), not the declared number (owner call: the finale's two-line row
       uses its vertical space better, and the peek is that row served on
       demand). */
    gap: 4px 4px;
  }
  /* The desktop row's own registers (13/11) — the peek IS that row served
     on demand, so the type must not read as a smaller cousin of it. */
  .pname {
    font-weight: 800;
    font-size: 13px;
    flex: none;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pname i {
    font-style: normal;
    color: var(--muted-2);
    font-size: 11px;
    font-weight: 700;
  }
  .pbadges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    flex: none;
    max-width: 100%;
  }
  .pemo {
    font-size: 12px;
    line-height: 1;
  }
  /* No auto margin: .pmid's flex-grow is what carries the price and chip to
     the right edge, so the pair sits flush whether or not a salary renders
     (the manager's row has none). */
  .psal {
    flex: none;
    font-weight: 800;
    font-size: 11px;
    white-space: nowrap;
  }
  .psal.cheap {
    color: var(--green);
  }
  .psal.spendy {
    color: var(--orange);
  }
  .peek .warchip {
    flex: none;
  }
  /* Wide: the rail owns a 350–380px column, so the club reads as the finale's
     squad card — one full-width row per seat, manager first, which is the order
     the markup is already in. Only the ARRANGEMENT is here; the seat's own wide
     geometry is RailSeat's, keyed to the same 760px because it is the same
     re-layout of the same page. */
  @media (min-width: 760px) {
    /* No `.railhead` rule here any more: the header is on at every width, so
       it simply takes `.psep`'s own flex display, and the wide column has no
       pin for the phone's carve-out to fire on. */
    .rail {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
  }
</style>

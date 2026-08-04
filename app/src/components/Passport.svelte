<script lang="ts">
  import type { PassportItem } from "../lib/settings";

  /** A row of country stamps, rendered the same in the trophy case and at the
   * finale — the stamp a player sees the moment a country lands is the stamp
   * that shows up in their passport, so the two surfaces cannot drift apart.
   * Exactly the reason BadgePill is one component rather than two.
   *
   * It draws stamps and nothing else. Which countries, in what order, with what
   * numbers on them and which are new are all decided by the caller and arrive
   * as `PassportItem`s — `settings.ts` builds both lists, and neither shape is
   * this component's business.
   *
   * ---- Tap a stamp, read the country ----
   *
   * The flag IS the stamp: no country's name is printed, because thirty-nine
   * spelled-out names is a list where a field of flags is a collection. That
   * leaves the detail — which country, first fielded when, how many men — with
   * nowhere to go on a touch screen, where there is no hover and a `title` is
   * unreachable. So every stamp is a button and the detail is a panel it opens,
   * the same gesture BadgeSlot gives a badge pill two inches up the same sheet.
   *
   * The panel is BadgeSlot's, re-implemented rather than imported. BadgeSlot is
   * BadgePill-shaped — it takes a `BadgeDef` and prints `badge.how` — so
   * sharing it would mean generalizing a component that exists to make one
   * badge behave one way, to serve two callers. The measurements below are
   * BadgeSlot's own and the derivations for the numbers live there; this file
   * keeps the values and the reasons, not a second copy of the arithmetic.
   *
   * The open stamp is state HERE rather than a prop, which is the one place
   * this deliberately parts company with BadgeSlot. BadgeSlot renders ONE pill,
   * so only its caller can know that a second pill is open and close the first;
   * this component renders the whole row, so one `string | null` is the entire
   * "only one panel at a time" rule. A badge panel and a stamp panel still
   * cannot both be open: each closes on a `pointerdown` outside itself, and a
   * tap on the other one is outside. */
  let { stamps, label }: { stamps: PassportItem[]; label: string } = $props();

  /** The one open stamp, by country. */
  let open = $state<string | null>(null);
  /** The button that was tapped, taken off the click rather than bound: only
   * one panel exists at a time, so a row of refs would be thirty-nine slots
   * kept up to date to read one of them. */
  let btnEl = $state<HTMLButtonElement | null>(null);
  let panelEl = $state<HTMLElement>();

  /** Per-instance, so a trophy case opened over a finale cannot point two
   * `aria-controls` at one id. */
  const detailId = $props.id();

  /** Stamp edge to panel edge; the arrow eats 7 of it. See BadgeSlot for the
   * measurement. */
  const GAP = 14;
  /** How close the arrow may get to a corner before the radius eats it. */
  const NOTCH_INSET = 14;
  /** Breathing room kept between the panel and the edge it could fall past. */
  const EDGE = 6;

  interface Placement {
    /** Row-local coordinates, in px. */
    left: number;
    top: number;
    /** Arrow position along the panel's own top (or bottom) edge. */
    notch: number;
    /** Flipped to sit above the stamp because there was no room below. */
    above: boolean;
  }
  let place = $state<Placement | null>(null);

  /** The nearest ancestor that scrolls, so the flip decision is made against
   * the box the player can actually see. In the trophy case that is the sheet;
   * on the finale there is none and the window is the viewport. */
  function scrollBox(el: HTMLElement): HTMLElement | null {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === "auto" || o === "scroll") return p;
    }
    return null;
  }

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  /** Measured, not guessed. The panel is sized by its own text and the row is
   * whatever width the layout gave it, so the only way to point an arrow at a
   * stamp is to read both back after they exist. */
  function measure(): void {
    if (!open || !btnEl || !panelEl) return;
    const row = btnEl.parentElement;
    if (!row) return;
    const rowR = row.getBoundingClientRect();
    const btnR = btnEl.getBoundingClientRect();
    const pw = panelEl.offsetWidth;
    const ph = panelEl.offsetHeight;

    // The stamp's center in the row's own coordinates — the point the arrow has
    // to land on.
    const center = btnR.left + btnR.width / 2 - rowR.left;
    // Center the panel under it, then shove it back inside the row. A stamp
    // hard against either margin gets a panel flush with that margin and an
    // arrow that slides along the panel's edge to keep pointing at the stamp.
    const left = clamp(center - pw / 2, 0, Math.max(0, rowR.width - pw));

    const boxR = scrollBox(btnEl)?.getBoundingClientRect();
    const viewTop = Math.max(0, boxR?.top ?? 0);
    const viewBottom = Math.min(window.innerHeight, boxR?.bottom ?? window.innerHeight);
    // Below by default; above only when below would run past the visible box
    // AND above actually fits. Decided once, at open — re-deciding on scroll
    // would make the panel hop while the player is reading it.
    const above =
      btnR.bottom + GAP + ph + EDGE > viewBottom && btnR.top - GAP - ph - EDGE > viewTop;

    place = {
      left,
      top: above ? btnR.top - rowR.top - ph - GAP : btnR.bottom - rowR.top + GAP,
      notch: clamp(center - left, NOTCH_INSET, Math.max(NOTCH_INSET, pw - NOTCH_INSET)),
      above,
    };
  }

  /* Placement, and the two ways out. Every listener is added only while a panel
   * is open and removed the moment it shuts.
   *
   * Dismissal is `pointerdown` rather than `click`, for two reasons. It cannot
   * swallow the tap: the handler only observes — never preventDefault, never
   * stopPropagation — so whatever sits underneath still receives its own click.
   * And it cannot self-close: the tap that opened the panel spent its
   * pointerdown before this listener existed, so there is no race to guard
   * against. It is also what makes stamps and badge pills mutually exclusive —
   * a tap on a pill is outside this panel, and a tap on a stamp is outside its.
   *
   * Escape is caught in the CAPTURE phase and stopped there. Sheet closes the
   * whole modal on a bubbling Escape, and one key should not dismiss two
   * things — the panel is the innermost thing open, so it goes first and
   * alone. */
  $effect(() => {
    if (!open) {
      place = null;
      return;
    }
    measure();
    const onResize = () => measure();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (btnEl?.contains(t) || panelEl?.contains(t))) return;
      open = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      open = null;
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  });
</script>

<!-- The row wraps and centers like a badge band, so the passport shares the
     rhythm of whatever sheet or column it sits in rather than reading as a
     different screen bolted on.
     A group rather than a list: a stamp is a button now, and `role="listitem"`
     on a button REPLACES the button — assistive tech would announce a list of
     items that cannot be pressed. Wrapping each button in a listitem is worse
     still; it puts a box between the button and this row, which is the box the
     panel is measured against. `.bandrow` in the trophy case is a group of
     badge buttons for the same reason, and this now reads the same way. -->
<div class="stamps" role="group" aria-label={label}>
  {#each stamps as s (s.country)}
    <!-- No markup whitespace anywhere inside the stamp: in a flex container a
         run of text and a run of whitespace collapse into one anonymous item,
         so a newline between two tags renders as a real space that `gap`
         cannot see. Every visible part is its own element and every gap
         between them is the flex `gap` below — BadgePill's rule, for
         BadgePill's reason.
         The accessible name carries the NEW chip, the country and the count,
         because `aria-label` replaces everything inside the element it sits on
         and every one of those three is drawn rather than written. It stops
         there: the detail is the panel's, announced when the panel is opened,
         the same division BadgeSlot draws between a pill and its trigger.
         The country's NAME is the detail's first job and on the finale it is
         the whole of it — a stamp there carries no sentence, because a career's
         "first fielded, N players across M seasons" beside a count of tonight's
         men would be two subjects on one stamp. Which leaves the question the
         flag cannot answer on a touch screen, and it is the one worth a tap:
         which country is this? Every stamp opens, and the shortest panel says a
         country's name. -->
    {@const detail = s.title ? `${s.country} — ${s.title}` : s.country}
    <button
      class="stamp {s.rarity ?? ''}"
      aria-label="{s.fresh ? 'New. ' : ''}{s.country}{s.count !== null
        ? `, ${s.count}`
        : ''}"
      aria-expanded={open === s.country}
      aria-controls={open === s.country ? detailId : undefined}
      title={detail}
      onclick={(e) => {
        btnEl = e.currentTarget;
        open = open === s.country ? null : s.country;
      }}
    >{#if s.fresh}<span class="newchip">NEW</span>{/if}{#if s.flag}<span
          class="flag">{s.flag}</span
        >{:else}<span class="name">{s.country}</span>{/if}{#if s.count !== null}<span
          class="count">×{s.count}</span
        >{/if}</button
    >{#if open === s.country}
      <!-- A sibling of the button, not a child of it: the panel's containing
           block has to be the ROW, so that clamping it inside the row is the
           same thing as keeping it inside the sheet. Rendered hidden and
           revealed once measured, so it is never seen at an unplaced
           position. -->
      <p
        class="detail"
        class:above={place?.above}
        class:placed={place !== null}
        id={detailId}
        bind:this={panelEl}
        style:left="{place?.left ?? 0}px"
        style:top="{place?.top ?? 0}px"
        style:--notch="{place?.notch ?? 0}px"
      >
        <span class="notch" aria-hidden="true"></span>{detail}
      </p>
    {/if}
  {/each}
</div>

<style>
  .stamps {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    /* The containing block for an open stamp's panel, which is what fences the
       panel inside the sheet. The trophy case scrolls in y, so a panel that
       reached past this box would earn the sheet a horizontal scrollbar as
       well. Both the coordinate origin and the horizontal fence: the panel is
       capped at 100% of this box and clamped inside it. */
    position: relative;
  }
  /* A stamp, not a pill. The badge pills are 999px capsules; a country wears a
     small radius, because a country is not a badge and the two are read inches
     apart. The SHAPE is what carries that distinction, which is what frees the
     fill to carry something else.
     THE FLAG IS THE STAMP. The country's name is not printed — a passport is
     read by its marks, and thirty-nine spelled-out names is a list where a
     field of flags is a collection. The name is not lost: it is the stamp's
     accessible name, its tooltip and the first thing in the panel it opens.
     The one case that still prints text is a country the flag table does not
     know, where `flag` is empty and the name is the only mark there is.
     `font: inherit` first, then the type this actually wants. A button takes
     the platform's own font rather than the page's, so without it a stamp
     dropped out of Nunito into system sans the moment it became one. */
  .stamp {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    /* The rarity ladder's pair plus its ink, spent on the stamp's own shape.
       Untiered falls back to plain paper on a gray hairline in the quiet
       --muted-2: a country the flag table does not know is the one state with
       no tier to wear, and it is deliberately quieter than `common` rather
       than louder — an unmeasured country must not look like a measured one. */
    border: 2px solid var(--rarity-line, var(--gray-ink));
    border-radius: 4px;
    background: var(--rarity-fill, var(--card));
    color: var(--rarity-ink, var(--muted-2));
    font: inherit;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 7px;
    white-space: nowrap;
    cursor: pointer;
  }
  .stamp:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* The tier fills are app.css's rarity ladder, the one BadgePill's pills read
     — the game runs one rarity register, and a second ramp would mean a rare
     stamp and a rare pill were different kinds of rare. Only the four middle
     rungs are shared: `legendary` is the top of a badge axis and a country is
     not an axis, and `ironic` is an anti-trophy, which no birthplace is, so
     neither names a stamp in that ladder.
     The flag runs a little larger than the name it sits beside: an emoji set at
     the type size of small caps reads as a smudge, and the flag is the only
     part of a stamp that has to be identifiable at a glance. Its own
     line-height, so a taller glyph cannot grow the stamp. */
  .flag {
    font-size: 13px;
    line-height: 1;
  }
  .count {
    opacity: 0.7;
  }
  /* First time ever fielded is app.css's `.newchip`, literally the chip the
     finale's badge pills spend — the fill and the border are both on rarity
     here exactly as they are on a pill, so a chip is the one channel left that
     borrows nothing, and there is nothing left for this file to add to it.
     It is announced from the stamp's `aria-label` rather than read off that
     text: an aria-label REPLACES everything inside the element it sits on, so
     once the country's name moved there — which it had to, the stamp being a
     bare flag — the chip stopped reaching a screen reader on its own. The
     label leads with it, the way the eye does. */
  /* The reveal, and it OVERLAYS the row. Nothing moves when a stamp opens: not
     the stamp that was tapped, not its row-mates, not the buttons below. That
     is the whole reason it is absolutely positioned rather than a block in the
     flow — an in-flow reveal has to take a row's worth of space from somewhere,
     and every way of taking it rearranges stamps the player is still looking
     at.
     `max-width: 100%` is measured against the row, which is the fence that
     keeps a floating panel from widening a scrolling sheet: a box with
     `overflow-y: auto` computes the other axis to `auto` as well, so anything
     reaching past the sheet's padding box earns a horizontal scrollbar.
     Sentence case and its own type, because it is a sentence — the stamp's
     small caps are a mark, and a mark's rules do not survive being read as
     prose. */
  .detail {
    position: absolute;
    /* Over the stamps and the rows below, under the rail pin (10) and the
       sheets (50). It only ever has to beat its own siblings. */
    z-index: 5;
    /* Placed by measurement; unplaced means not yet shown. */
    visibility: hidden;
    margin: 0;
    width: max-content;
    max-width: min(280px, 100%);
    border: 2px solid var(--line);
    border-radius: 10px;
    background: var(--card);
    color: var(--ink);
    font-size: 11.5px;
    font-weight: 700;
    line-height: 1.4;
    letter-spacing: normal;
    text-transform: none;
    padding: 8px 11px;
    text-align: center;
  }
  .detail.placed {
    visibility: visible;
  }
  /* The connector: an ink triangle with a card triangle sitting just inside it,
     so what shows is a 2px chevron that continues the panel's own outline and
     then a card fill that erases the panel border behind it. One unbroken ink
     line, no seam where the arrow meets the box.
     `--notch` is the measured distance from the panel's left edge to the
     stamp's center, so the arrow keeps pointing at the stamp even when the
     panel has been shoved sideways to stay inside the row.
     The inner triangle's offset is derived from the border weight and the
     arrow's proportions rather than tuned by eye — a vertical shift is not the
     outline's thickness, it projects onto the slanted edge. BadgeSlot carries
     the trigonometry; these are the same 14×9 arrow and the same 2px border, so
     they are the same numbers. */
  .notch,
  .notch::after {
    position: absolute;
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
  }
  .notch {
    left: var(--notch);
    margin-left: -7px;
    bottom: 100%;
    border-bottom: 9px solid var(--line);
  }
  .notch::after {
    content: "";
    left: -7px;
    bottom: -12.26px;
    border-bottom: 9px solid var(--card);
  }
  /* Flipped above the stamp: the same pair, mirrored onto the underside. */
  .detail.above .notch {
    bottom: auto;
    top: 100%;
    border-bottom: 0;
    border-top: 9px solid var(--line);
  }
  .detail.above .notch::after {
    bottom: auto;
    top: -12.26px;
    border-bottom: 0;
    border-top: 9px solid var(--card);
  }
</style>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { lockScroll } from "../lib/scrolllock";
  import CloseGlyph from "./CloseGlyph.svelte";

  /** The modal shell every sheet shares: dimmed backdrop (tap to close),
   * bottom sheet on phones, centered cardstock modal at wide.
   *
   * ---- Dismissal belongs to the shell ----
   *
   * Every sheet offers the same two exits — a ✕ pill in the top-right corner
   * and a full-width button across the bottom — so both are drawn HERE, once,
   * from `title` and `confirmLabel`. Five callers each growing a private
   * corner button is the shape that produced two payroll boxes: markup that
   * agrees only by hand drifts the moment one copy is touched. The corner
   * pill is the same 28×22 box the HUD's ✕ and the ?/trophy pair use, so the
   * app has one dismissal glyph at one size everywhere it appears.
   *
   * Both props are opt-in and default to nothing rendered, because a caller
   * that still draws its own header and its own cancel button would otherwise
   * render two of each. The moment every caller has handed its header over,
   * the defaults can flip and the `{#if}` guards go away.
   *
   * ---- Why the header moved in with the ✕ ----
   *
   * The corner pill needs a 44px tap target it grows INTO empty space, and
   * whether that space exists depends on how far the caller's first content
   * row sits below the title. Owning the title is what makes that distance a
   * fact rather than a hope. The caller keeps everything below it.
   *
   * ---- The scroll region ----
   *
   * With a confirm button the sheet becomes a flex column: header and button
   * hold still, only `.body` scrolls. The button is the sheet's floor and is
   * always on screen; the title stays legible against whatever the body has
   * scrolled to. Sheets that have not opted in keep the old whole-sheet
   * scroll, unchanged.
   *
   * ---- Height ----
   *
   * `dvh` with an `svh` fallback and never `vh`: iOS Safari resolves `vh`
   * against a viewport that includes browser chrome that is not there, so a
   * `vh`-sized sheet runs its floor under the toolbar. The safe-area inset is
   * subtracted off the top because the sheet grows upward from the bottom
   * edge, which is where a notch or a status bar would meet it. The ceilings
   * are generous on purpose — a picker of 40 seasons or 30 clubs fits without
   * an inner scroll on a normal phone, and the body scrolls only for the
   * genuinely long ones. `tall` adds the last few points plus wider gutters
   * for the two prose sheets. */
  let {
    onclose,
    label,
    tall = false,
    title = null,
    subtitle = null,
    confirmLabel = null,
    children,
  }: {
    onclose: () => void;
    /** Accessible name for the dialog. */
    label: string;
    /** Prose variant: the last few points of height, and wider gutters. */
    tall?: boolean;
    /** Centered header line. Rendering it here is what brings the ✕ with it. */
    title?: string | null;
    /** Optional muted line under the title. */
    subtitle?: string | null;
    /** Word on the full-width bottom button. A picker the player can back out
     * of says CANCEL, a sheet that only tells them things says GOT IT, and
     * CLOSE is the neutral fallback. Null draws no button and leaves the
     * sheet scrolling as one piece. */
    confirmLabel?: string | null;
    children: Snippet;
  } = $props();

  const framed = $derived(confirmLabel !== null);

  /** The dialog takes focus when it opens, which is what makes Escape the
   * third exit rather than a decoration. The handler lives on `.sheet`, so it
   * only ever sees a key press when focus is already inside — and on open,
   * focus is still on `<body>` behind the backdrop. Escape therefore did
   * nothing until the player happened to tap something in the sheet first.
   *
   * Taking focus is also what stops Tab from walking the market rows and the
   * powerup pills underneath an open modal — for the first press. Once focus
   * has moved onto the ✕ or the bottom button, a further Tab would walk out
   * of the dialog into the board underneath, so `trapTab` below cycles it.
   *
   * The element that had focus when the sheet opened gets it back on close —
   * the same hand-back Home's seed capsule does — so a keyboard user lands on
   * the control they came from rather than on `<body>`. Captured before the
   * sheet takes focus, restored in the effect's teardown (the unmount). */
  let sheetEl = $state<HTMLElement | null>(null);
  $effect(() => {
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    sheetEl?.focus();
    return () => opener?.focus();
  });

  /** Cycle Tab and Shift-Tab inside the sheet. A dialog that lets Tab reach
   * the live game under its own backdrop is only pretending to be modal —
   * `aria-modal` promises assistive tech a boundary, and this is the half of
   * the promise the keyboard has to keep. */
  function trapTab(e: KeyboardEvent) {
    if (e.key !== "Tab" || !sheetEl) return;
    const focusables = Array.from(
      sheetEl.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
      // offsetParent is null for display:none subtrees — a hidden control is
      // not a Tab stop.
    ).filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    // The sheet element itself holds focus right after open; Shift-Tab from
    // there wraps to the end exactly as it would from the first control.
    if (e.shiftKey && (active === first || active === sheetEl)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /** Lock page scroll while this sheet is mounted; unlock on teardown.
   * The lock is reference-counted so stacked modals don't unlock each other
   * early — the last one closed is the one that restores scroll. */
  $effect(() => lockScroll());
</script>

<div class="backdrop" onclick={onclose} role="presentation">
  <div
    class="sheet disp"
    class:tall
    class:framed
    bind:this={sheetEl}
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => (e.key === "Escape" ? onclose() : trapTab(e))}
    role="dialog"
    aria-modal="true"
    aria-label={label}
    tabindex="-1"
  >
    {#if title !== null}
      <div class="head">
        <span class="title">{title}</span>
        <button class="x" onclick={onclose} aria-label="Close"><CloseGlyph /></button>
      </div>
      {#if subtitle !== null}<div class="sub">{subtitle}</div>{/if}
    {/if}
    {#if framed}
      <div class="body">{@render children()}</div>
      <button class="btn cancel" onclick={onclose}>{confirmLabel}</button>
    {:else}
      {@render children()}
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(36, 34, 28, 0.45);
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .sheet {
    background: var(--ground);
    border: 3px solid var(--line);
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
    padding: 14px 14px calc(14px + env(safe-area-inset-bottom));
    width: 100%;
    max-width: 480px;
    max-height: calc(88svh - env(safe-area-inset-top));
    max-height: calc(88dvh - env(safe-area-inset-top));
    overflow-y: auto;
    /* Contain rubber-band scroll within the sheet on iOS Safari 16+, so touch
       momentum does not propagate to the page behind the backdrop. On iOS
       Safari ≤15 the body `overflow: hidden` lock is still imperfect; a
       `position: fixed` body lock with scroll-position restoration would fix
       it but is fragile and not implemented here. */
    overscroll-behavior: contain;
  }
  .sheet.tall {
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
    max-height: calc(92svh - env(safe-area-inset-top));
    max-height: calc(92dvh - env(safe-area-inset-top));
  }
  /* A framed sheet holds its header and its button still and scrolls only the
     middle. `overflow: visible` here is deliberate: `.body` does the clipping,
     which leaves the ✕'s invisible tap extension free to reach into the
     sheet's own padding. */
  .sheet.framed {
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  .body {
    flex: 1 1 auto;
    /* Without this a flex item refuses to shrink below its content height, so
       the sheet would grow past its ceiling instead of scrolling. */
    min-height: 0;
    overflow-y: auto;
    margin-top: 12px;
  }
  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    /* Tall enough that the ✕'s 44px tap target clears the first content row
       below it: the pill centers in this box, its extension reaches 11px past
       each edge, and `.body`'s own top margin covers the rest. Without the
       floor, a grid picker's top-right tile sits under the corner's target. */
    min-height: 26px;
  }
  /* Optically centered against the ✕ rather than against the row: the pill and
     its gap take 34px off the right, so the same 34px comes off the left. */
  .title {
    flex: 1;
    padding-left: 34px;
    text-align: center;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  .sub {
    flex: none;
    text-align: center;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    margin-top: 2px;
  }
  /* The corner pill, at the app's one dismissal geometry: fixed 28×22 with no
     horizontal padding, so the footprint holds whatever glyph sits in it. */
  .x {
    flex: none;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    color: var(--muted);
    font-family: inherit;
    font-weight: 800;
    font-size: 12px;
    line-height: 1;
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
  /* The tap target, grown without growing the pill — the same invisible
     extension the powerup pills use. 28+8+8 and 22+11+11 both land on 44. */
  .x::after {
    content: "";
    position: absolute;
    inset: -11px -8px;
  }
  .x:active {
    transform: translateY(1.5px);
  }
  .x:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .cancel {
    flex: none;
    width: 100%;
    font-size: 13px;
    padding: 8px;
    margin-top: 12px;
  }
  /* Wide: a bottom sheet reads phone-y — center it as a cardstock modal. */
  @media (min-width: 760px) {
    .backdrop {
      align-items: center;
      padding: 24px;
    }
    .sheet {
      border-bottom: 3px solid var(--line);
      border-radius: 18px;
      padding-bottom: 14px;
    }
    /* Centered rather than anchored to an edge, so the ceiling is the backdrop's
       own padded box — a viewport-relative one would let a full sheet hang past
       the 24px gutter and get cut equally at both ends. Both selectors, because
       `.sheet.tall` outranks a bare `.sheet` at any source order. */
    .sheet,
    .sheet.tall {
      max-height: 100%;
    }
  }
</style>

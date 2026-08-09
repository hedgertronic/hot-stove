/** Emoji glyph seating, measured ON the device instead of tuned by eye.
 *
 * THE PROBLEM. A chip centers its glyph span by flex, but where the ink sits
 * inside that span depends on the engine twice over: where the engine puts
 * Nunito's baseline inside a line-height:1 box (Blink and WebKit trust
 * different font metric tables), and where the emoji ink hangs from that
 * baseline (Apple Color Emoji vs the bundled Twemoji flags, and again per
 * platform). Pill.svelte's original translateY(0.09em) was one constant
 * tuned in desktop Chrome; the lab's seat probe then measured the same
 * chips at +5.6 device px (low) on iPhone Safari, −2 to −3 (high) on Mac
 * Safari, and ~0 on Chromium — three engines, three different corrections,
 * no constant can serve them all. So the seat is measured, per glyph and
 * size, on whatever device is rendering.
 *
 * HOW, without screenshots (a page can't raster its own DOM):
 *  1. BASELINE — an empty inline-block's bottom margin edge sits exactly on
 *     its line box's baseline; one is slipped in beside the glyph, read, and
 *     removed.
 *  2. INK — the same glyph is drawn on a device-pixel-scaled canvas in the
 *     same computed font with textBaseline: alphabetic and its ink rows are
 *     scanned from the alpha channel. Canvas and DOM share the document's
 *     font stack and the engine's rasterizer, so ink-relative-to-baseline
 *     transfers between the two.
 *  3. SEAT — the offset that puts the ink's center on the box's center.
 *
 * Results are memoized per glyph+size: a passport of forty stamps costs one
 * small canvas raster per DISTINCT flag, once per session. Anywhere the
 * measurement cannot run (vitest's DOM has no canvas rasterizer) every
 * function returns null and the stylesheet's 0.09em fallback stands — the
 * pre-measurement rendering, not an error. */

const ALPHA = 16; // ink threshold; emoji AA fringes sit well above this

/** Ink extents of `glyph` relative to the alphabetic baseline, in CSS px,
 * drawn in exactly the given font shorthand components. Null when the glyph
 * is blank or the canvas cannot rasterize. */
function inkRange(
  glyph: string,
  font: string,
  fontPx: number,
): { top: number; bottom: number } | null {
  const dpr = window.devicePixelRatio || 1;
  // 3em square leaves headroom for flags and full-bleed emoji; the pen sits
  // at 1.8em so ascenders and descenders both land inside the raster.
  const side = Math.ceil(fontPx * 3);
  const pen = fontPx * 1.8;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(side * dpr);
  canvas.height = Math.ceil(side * dpr);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(glyph, fontPx * 0.5, pen);
  let img: Uint8ClampedArray;
  try {
    img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return null;
  }
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (img[(y * canvas.width + x) * 4 + 3] > ALPHA) {
        if (top < 0) top = y;
        bottom = y;
        break;
      }
    }
  }
  if (top < 0) return null;
  return { top: top / dpr - pen, bottom: (bottom + 1) / dpr - pen };
}

/** Where the line's baseline falls, in viewport coordinates — measured live
 * so the engine's own metric-table choice is what gets measured. The strut
 * shares the line (and any transform) with the text beside it. */
function baselineIn(el: HTMLElement): number {
  const strut = document.createElement("span");
  strut.style.cssText = "display:inline-block;width:0;padding:0;border:0;margin:0";
  el.appendChild(strut);
  const b = strut.getBoundingClientRect().bottom;
  strut.remove();
  return b;
}

export interface SeatReading {
  /** Device px of air between the chip's inner top edge and the ink. */
  above: number;
  /** Device px of air between the ink and the chip's inner bottom edge. */
  below: number;
  /** above − below. 0 is centered; POSITIVE means the glyph SITS LOW (more
   * air above the ink than below it), negative means it rides high. */
  skew: number;
}

/** The lab probe's in-situ reading: how the glyph actually sits inside the
 * REAL chip, applied transforms and all. */
export function measureGlyphSeat(chip: HTMLElement, ico: HTMLElement): SeatReading | null {
  const dpr = window.devicePixelRatio || 1;
  const glyph = ico.textContent ?? "";
  if (!glyph) return null;
  const cs = getComputedStyle(ico);
  const fontPx = parseFloat(cs.fontSize);
  const ink = inkRange(glyph, `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, fontPx);
  if (!ink) return null;
  const baseline = baselineIn(ico);
  const r = chip.getBoundingClientRect();
  const ccs = getComputedStyle(chip);
  const innerTop = r.top + parseFloat(ccs.borderTopWidth);
  const innerBottom = r.bottom - parseFloat(ccs.borderBottomWidth);
  const above = (baseline + ink.top - innerTop) * dpr;
  const below = (innerBottom - (baseline + ink.bottom)) * dpr;
  return { above, below, skew: above - below };
}

/** Memo: one measurement per glyph+size for the life of the page. */
const seats = new Map<string, number | null>();

/** The translateY, in CSS px, that centers `glyph`'s ink inside its own
 * line-height:1 span box — the seat Pill's .ico needs, measured offscreen so
 * entrance animations and mid-layout chips can't skew it. Null when the
 * device can't be measured (no canvas raster): caller keeps the stylesheet
 * fallback. */
export function seatPx(glyph: string, fontPx: number, fontFamily: string): number | null {
  const key = `${glyph}|${fontPx}`;
  const hit = seats.get(key);
  if (hit !== undefined) return hit;
  let v: number | null = null;
  try {
    const box = document.createElement("div");
    // The stand-in for the flex-item glyph span: a block whose height is its
    // one line at line-height 1, in the same face stack and weight the chip
    // renders. Hidden but laid out, parked offscreen.
    box.style.cssText =
      "position:absolute;left:-9999px;top:0;visibility:hidden;" +
      `font:${fontPx}px ${fontFamily};line-height:1;white-space:nowrap`;
    box.textContent = glyph;
    document.body.appendChild(box);
    const r = box.getBoundingClientRect();
    const baseline = baselineIn(box);
    document.body.removeChild(box);
    const ink = inkRange(glyph, `${fontPx}px ${fontFamily}`, fontPx);
    if (ink && r.height > 0) {
      const boxCenter = (r.top + r.bottom) / 2;
      const inkCenter = baseline + (ink.top + ink.bottom) / 2;
      v = boxCenter - inkCenter;
    }
  } catch {
    v = null;
  }
  seats.set(key, v);
  return v;
}

/** Svelte action for the chip's glyph span: measure once fonts are ready and
 * seat the ink on the box's center. On failure the stylesheet's constant
 * fallback seat stays — same rendering the chips always had. */
export function glyphseat(node: HTMLElement) {
  if (typeof window === "undefined" || typeof document.fonts === "undefined") return;
  let live = true;
  document.fonts.ready.then(() => {
    if (!live || !node.isConnected) return;
    const glyph = node.textContent ?? "";
    if (!glyph) return;
    const cs = getComputedStyle(node);
    const v = seatPx(glyph, parseFloat(cs.fontSize), cs.fontFamily);
    if (v !== null) node.style.transform = `translateY(${v.toFixed(2)}px)`;
  });
  return {
    destroy() {
      live = false;
    },
  };
}

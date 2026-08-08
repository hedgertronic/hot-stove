/** The ink probe: is every chip and button label SEATED where the recipe
 * promises? The trim doctrine (app.css) centers cap bands by construction,
 * but nothing else watches it — a padding added inside a `.chiplbl`, a
 * broken `@supports` block, or a recipe fork would mis-seat type silently.
 * This probe renders the real surfaces in Chromium at 3x, row-scans each
 * label's ink, and fails the build when air-above and air-below disagree by
 * more than the rasterizer's own noise.
 *
 * Skew is measured in DEVICE pixels (air above minus air below the ink band
 * inside the container's border box); the bounds live at the LIMIT
 * constants below, above the rasterizer's ±3 wobble and below the 6+ the
 * real bug classes measured.
 *
 * Runs standalone (`npm run test:ink`) — it boots its own Vite dev server on
 * a fixed side port because the probed routes (?og-preview, ?lab) are
 * DEV-gated out of production bundles. Not part of `npm test`: it needs the
 * Playwright Chromium download, which unit runs shouldn't wait on.
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { createServer } from "vite";

const SCALE = 3;
// |skew| bounds, device px. Chromium quantizes text origins to CSS pixels,
// so a correctly seated label can read up to ~3 (1 css px of phase + the
// row-scan's own ±1). The real bug classes measured 6+ (a 2px padding slip,
// the 1x OG year pill's 5/7 split). Labels measured through their own
// .chiplbl box get the tight bound; bare inline labels (label: null) are
// scanned through the container's middle strip, which adds threshold noise.
const LIMIT = 4;
// The first Linux CI run read a lab sheet button at exactly 5 (its ink is
// scanned through the container strip, and FreeType biases the caps' AA a
// row differently than CoreText) — 6 keeps one raster wobble of headroom
// between a healthy build and a red one.
const LIMIT_LOOSE = 6;
const PORT = 5199; // NOT 5173 — a dev server may already own that locally

/** Each probe names a container recipe and the label element whose ink the
 * recipe seats. `label: null` means the container's own inline text is the
 * label (plain block .btn) and the center strip stands in for it. */
const SITES = [
  {
    path: "/?og-preview",
    ready: ".og .frame",
    viewport: { width: 1200, height: 630 },
    probes: [
      { sel: ".qb", label: ".chiplbl", name: "award pill" },
      { sel: ".confirm", label: ".chiplbl", name: "confirm chip" },
      { sel: ".yr", label: ".chiplbl", name: "year pill" },
    ],
  },
  {
    path: "/?lab",
    ready: ".fin-actions .btn",
    viewport: { width: 1280, height: 900 },
    probes: [
      { sel: ".fin-actions .btn", label: ".chiplbl", name: "finale action" },
      { sel: ".sheetbtn", label: null, loose: true, name: "lab sheet button" },
    ],
  },
  {
    path: "/",
    ready: ".playbtn",
    viewport: { width: 390, height: 844 },
    probes: [{ sel: ".playbtn", label: ".chiplbl", name: "PLAY" }],
  },
];

/** Cap how many instances of one selector get measured — the lab repeats the
 * finale many times and each repeat is the same recipe. */
const PER_SELECTOR = 4;

const lum = (png, x, y) => {
  const i = (y * png.width + x) * 4;
  return 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
};

/** Ink rows in a strip: the strip is background-dominated, so the median
 * luminance IS the background and ink is whatever sits far from it. Works
 * for dark-on-light chips and the confirm chip's light-on-ink alike. */
function inkBand(png, x0, x1, y0, y1) {
  const lums = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) lums.push(lum(png, x, y));
  const bg = lums.slice().sort((a, b) => a - b)[Math.floor(lums.length / 2)];
  const rows = [];
  for (let y = y0; y < y1; y++) {
    let dark = 0;
    for (let x = x0; x < x1; x++) if (Math.abs(lum(png, x, y) - bg) > 60) dark++;
    if (dark >= 2) rows.push(y);
  }
  return rows.length ? [rows[0], rows[rows.length - 1]] : null;
}

const server = await createServer({
  root: new URL("../..", import.meta.url).pathname,
  server: { port: PORT, strictPort: true },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch();
const failures = [];
const report = [];

for (const site of SITES) {
  const page = await browser.newPage({ viewport: site.viewport, deviceScaleFactor: SCALE });
  await page.goto(`http://localhost:${PORT}${site.path}`);
  await page.waitForSelector(site.ready, { timeout: 15000 });
  await page.waitForTimeout(400); // fonts + first layout settle
  const targets = await page.evaluate(
    ([probes, cap]) =>
      probes.flatMap((p) =>
        [...document.querySelectorAll(p.sel)].slice(0, cap).map((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const lbl = p.label ? el.querySelector(p.label) : null;
          const lr = lbl ? lbl.getBoundingClientRect() : null;
          return {
            name: p.name,
            loose: p.loose === true,
            text: (lbl ?? el).textContent.trim().slice(0, 14),
            y0: r.y,
            y1: r.y + r.height,
            bt: parseFloat(cs.borderTopWidth),
            bb: parseFloat(cs.borderBottomWidth),
            // Strip: the label's own width, or the container's middle 40% —
            // either way clear of rounded side borders and emoji glyphs.
            x0: lr ? lr.x : r.x + r.width * 0.3,
            x1: lr ? lr.x + lr.width : r.x + r.width * 0.7,
          };
        }),
      ),
    [site.probes, PER_SELECTOR],
  );
  for (const t of targets) {
    // One clipped screenshot per target — clip takes DOCUMENT coordinates,
    // so labels below the fold (the lab's galleries) capture without
    // scrolling games.
    const png = PNG.sync.read(
      await page.screenshot({
        fullPage: true, // clip coordinates are document coordinates
        clip: { x: t.x0, y: t.y0, width: t.x1 - t.x0, height: t.y1 - t.y0 },
      }),
    );
    const sx0 = 0;
    const sx1 = png.width;
    // Inset past the border stroke plus one AA pixel so the ring never
    // reads as ink.
    const sy0 = Math.ceil(t.bt * SCALE) + 1;
    const sy1 = png.height - Math.ceil(t.bb * SCALE) - 1;
    const band = inkBand(png, sx0, sx1, sy0, sy1);
    if (!band) {
      failures.push(`${site.path} ${t.name} "${t.text}": no ink found in strip`);
      continue;
    }
    const above = band[0];
    const below = png.height - band[1] - 1;
    const skew = above - below;
    report.push(
      `${site.path.padEnd(14)} ${t.name.padEnd(16)} "${t.text.padEnd(14)}" ` +
        `air ${above.toFixed(1)}/${below.toFixed(1)}  skew ${skew.toFixed(1)}`,
    );
    const limit = t.loose ? LIMIT_LOOSE : LIMIT;
    if (Math.abs(skew) > limit)
      failures.push(
        `${site.path} ${t.name} "${t.text}": skew ${skew.toFixed(1)} device px exceeds ±${limit}`,
      );
  }
  await page.close();
}

await browser.close();
await server.close();

console.log(report.join("\n"));
if (failures.length) {
  console.error(`\nINK PROBE FAILED (${failures.length}):\n` + failures.join("\n"));
  process.exit(1);
}
console.log(`\nink probe: ${report.length} labels seated within bounds`);

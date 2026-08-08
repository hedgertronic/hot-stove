"""Render the 1200x630 OG candidate for review or promotion.

The gameplay variant (the approved card) screenshots the live component route
``http://localhost:5173/?og-preview``, so the card is the game's real
components under the game's real tokens — start ``npm run dev`` first. The
retired market variant screenshots ``tools/og-template.html``. The PNG is
committed — it is static branding, not a build product — so this runs
manually, only when the card's design changes:

    uv run --with playwright python tools/generate_og_image.py

The safe default writes ``app/public/og-preview-gameplay.png`` for local
review. Only the explicit ``--final`` flag promotes the candidate to
``app/public/og-image.png``.

Requires the Chromium browser Playwright manages (`playwright install
chromium` once per machine).
"""

import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PREVIEW = ROOT / "app" / "public" / "og-preview.png"
GAMEPLAY_PREVIEW = ROOT / "app" / "public" / "og-preview-gameplay.png"
FINAL = ROOT / "app" / "public" / "og-image.png"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--final",
        action="store_true",
        help="promote the approved candidate to app/public/og-image.png",
    )
    parser.add_argument(
        "--variant",
        choices=("market", "gameplay"),
        default="gameplay",
        help="render the approved component-driven gameplay card or the retired market-only template",
    )
    args = parser.parse_args()
    if args.final and args.variant != "gameplay":
        parser.error("only the approved gameplay candidate can be promoted with --final")
    template = ROOT / "tools" / "og-template.html"
    output = FINAL if args.final else GAMEPLAY_PREVIEW if args.variant == "gameplay" else PREVIEW
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # 3x, because low-density rasterization is where sub-pixel chip
        # geometry goes to die. At 1x the year pill's digits landed a whole
        # pixel high inside their box (5px of air above the ink, 7px below,
        # in the shipped artifact), and at any density each row's fractional
        # page position quantizes small type by up to half a device pixel —
        # the probe tool's ±0.4px band. Resolution is the only lever that
        # shrinks that band (±0.50 at 1x, ±0.25 at 2x, ±0.17 here); scrapers
        # consume the card at 1200x630 logical regardless.
        page = browser.new_page(
            viewport={"width": 1200, "height": 630}, device_scale_factor=3
        )
        if args.variant == "gameplay":
            page.goto("http://localhost:5173/?og-preview")
            page.wait_for_selector(".og .frame")
            # Snap every chip to the device-pixel grid before capture. Layout
            # positions chips at arbitrary fractions — x from name-text widths,
            # y from Chromium's 1/64px LayoutUnit — so each pill's border ring
            # and cap edges anti-alias in a different phase and rows read
            # subtly different depths. Relative-position nudges, NOT transform:
            # a transform rasterizes the element first and composites it at
            # the fractional offset, which blurs; relative offsets move the
            # element before the paint pass, so type rasterizes at the snapped
            # position. Chips are measured all-before-moved-after because a
            # moved chip must not shift a sibling's measurement. A live page
            # re-rasterizes every frame so this only makes sense for a frozen
            # screenshot, which is why it lives here and not in the app's CSS.
            page.evaluate(
                """() => {
                  // Chromium quantizes text origins at CSS-pixel granularity
                  // during layout, so what makes a chip's type land centered
                  // is the chip's CSS-pixel PHASE: a 15px chip whose top sits
                  // on the half-pixel grid puts its 6px cap-trimmed label at
                  // an exact integer (y+4.5), where the text snap is a no-op
                  // and the caps rasterize dead-centered. Chips laid out at
                  // any other fraction get their type snapped up to 0.5px off
                  // center, differently per chip. Move every chip onto that
                  // winning phase (y -> nearest half, x -> nearest integer so
                  // border rings and glyphs share one AA phase), then squash
                  // the 1/64px layout noise on the labels themselves.
                  const snap = (sel, gx, gy) => {
                    const moves = [...document.querySelectorAll(sel)].map((el) => {
                      const r = el.getBoundingClientRect();
                      return [el, Math.round(r.x - gx) + gx - r.x,
                                  Math.round(r.y - gy) + gy - r.y];
                    });
                    for (const [el, dx, dy] of moves) {
                      el.style.position = 'relative';
                      el.style.left = `${dx}px`;
                      el.style.top = `${dy}px`;
                    }
                  };
                  snap('.chipbox, .confirm', 0, 0.5);
                  snap('.chiplbl', 0, 0);
                }""",
            )
        else:
            page.goto(template.resolve().as_uri())
        page.wait_for_timeout(500)  # let the woff2 land
        page.screenshot(path=str(output))
        browser.close()
    print(f"wrote {output.relative_to(ROOT)} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

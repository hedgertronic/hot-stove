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
        page = browser.new_page(viewport={"width": 1200, "height": 630})
        if args.variant == "gameplay":
            page.goto("http://localhost:5173/?og-preview")
            page.wait_for_selector(".og .frame")
        else:
            page.goto(template.resolve().as_uri())
        page.wait_for_timeout(500)  # let the woff2 land
        page.screenshot(path=str(output))
        browser.close()
    print(f"wrote {output.relative_to(ROOT)} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

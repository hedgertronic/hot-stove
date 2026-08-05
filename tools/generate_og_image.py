"""Render tools/og-template.html to app/public/og-image.png (1200x630).

Same approach as hedgertronic.github.io: Playwright screenshots an HTML
template, so the card is styled with the game's real font and tokens instead
of being drawn by hand. The PNG is committed — it is static branding, not a
build product — so this runs manually, only when the card's design changes:

    uv run --with playwright python tools/generate_og_image.py

Requires the Chromium browser Playwright manages (`playwright install
chromium` once per machine).
"""

from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "tools" / "og-template.html"
OUTPUT = ROOT / "app" / "public" / "og-image.png"


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1200, "height": 630})
        page.goto(TEMPLATE.resolve().as_uri())
        page.wait_for_timeout(500)  # let the woff2 land
        page.screenshot(path=str(OUTPUT))
        browser.close()
    print(f"wrote {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

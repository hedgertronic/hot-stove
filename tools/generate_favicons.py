"""Render the approved flame favicons and boiler Apple touch icon.

    uv run --with playwright python tools/generate_favicons.py

The browser favicons use the bare flame on transparency. The Apple touch icon
uses the full boiler on opaque ivory; iOS may composite transparent icons onto
black, so its tile must be opaque. All exports render at 8x and ask Chromium to
emit CSS-sized pixels for clean small cuts.

favicon.ico wraps the two PNGs this script just wrote, unmodified. Safari asks
for /favicon.ico by path whatever the markup declares, and a 404 there is a
result it will cache; the SVG alone is not enough even though Safari 15.4+ can
render one.
"""

import struct
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FLAME = (ROOT / "design" / "logo" / "flame-cut-a.svg").read_text()
BOILER = (ROOT / "design" / "logo" / "boiler-b6-flared.svg").read_text()
OUT = ROOT / "app" / "public"

# Flame viewBox is 61 wide × 81 tall. Center its measured visual centroid,
# not its bounds; the thin tip carries almost no visual mass.
FLAME_CX = (50.31 - 19.5) / 61
FLAME_CY = (44.93 + 0.5) / 81

PAGE = """<!doctype html><meta charset="utf-8">
<style>
  html, body {{ margin: 0; }}
  body {{ width: {tile}px; height: {tile}px; background: {bg}; position: relative; }}
  svg {{ position: absolute; height: {h}px; width: auto; left: {left}px; top: {top}px; }}
</style>
{svg}"""


def set_art(page, *, tile: int, svg: str, h: float, left: float, top: float, bg: str) -> None:
    page.set_viewport_size({"width": tile, "height": tile})
    page.set_content(PAGE.format(tile=tile, bg=bg, h=h, left=left, top=top, svg=svg))


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(device_scale_factor=8, screen={"width": 200, "height": 200})

    for tile, name in [(16, "favicon-16.png"), (32, "favicon-32.png")]:
        h = tile * 0.88
        w = h * 61 / 81
        set_art(
            page,
            tile=tile,
            svg=FLAME,
            h=h,
            left=tile / 2 - FLAME_CX * w,
            top=tile / 2 - FLAME_CY * h,
            bg="transparent",
        )
        page.screenshot(path=str(OUT / name), omit_background=True, scale="css")
        print(f"{name}: {tile}x{tile} flame (rendered at 8x)")

    # Boiler viewBox is 74 × 95. Its bottom-heavy silhouette gets a modest
    # optical lift, proportional to the 2px lift used by the 28×37 masthead
    # lockup, while its geometric center remains horizontally exact.
    tile = 180
    h = 126
    w = h * 74 / 95
    set_art(
        page,
        tile=tile,
        svg=BOILER,
        h=h,
        left=(tile - w) / 2,
        top=(tile - h) / 2 - 6,
        bg="#f6f1e3",
    )
    page.screenshot(path=str(OUT / "apple-touch-icon.png"), scale="css")
    print("apple-touch-icon.png: 180x180 boiler on ivory (rendered at 8x)")
    browser.close()

# An .ico is a directory of images; since Vista each entry may hold a whole PNG
# rather than a BMP, so the two cuts above go in verbatim — no resample, no
# second encoder, nothing that could drift from what the PNG links serve.
sizes = [(16, "favicon-16.png"), (32, "favicon-32.png")]
images = [(tile, (OUT / name).read_bytes()) for tile, name in sizes]
offset = 6 + 16 * len(images)
directory, payload = b"", b""
for tile, blob in images:
    directory += struct.pack("<BBBBHHII", tile, tile, 0, 0, 1, 32, len(blob), offset)
    payload += blob
    offset += len(blob)
(OUT / "favicon.ico").write_bytes(
    struct.pack("<HHH", 0, 1, len(images)) + directory + payload
)
print(f"favicon.ico: {', '.join(f'{t}x{t}' for t, _ in images)} (PNG-in-ICO, byte-identical)")

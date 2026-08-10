"""Regenerate the flame's orange band from its master curve.

The flame ships as two FILLED paths, not a stroked one: CoreGraphics-family
rasterizers (Preview, Quick Look, anything drawing the SVG off WebKit) drop
hairline slivers where a thick stroke's offset curves self-intersect at the
inner tongue. The band here is the old 7.5-unit stroke's outline as explicit
geometry, with its inner edge pulled 0.25 units INTO the yellow fill so the
two regions overlap and no renderer can find a seam between them.

Run it after any redraw of the master curve, then paste the printed band
path into every carrier of the flame:

    design/logo/flame-cut-a.svg      design/logo/boiler-o.svg
    design/logo/boiler-b6-flared.svg design/logo/favicon.svg
    app/src/components/Logo.svelte   (inline HUD flame)

and re-run `npm run brand:sync` plus the o-boiler URI step in
app/public/brand.css (tests/brand-assets.test.ts pins the transform).

Deps: uv pip install svgpathtools shapely
"""

from shapely import simplify
from shapely.geometry import Polygon
from svgpathtools import parse_path

MASTER = (
    "M50 6c7 15 24 21 24 44a24 24 0 0 1-48 0c0-9.4 4.2-16 "
    "8.6-21.4-.4 8.8 2.6 13.6 7.6 14.7C38.6 30 43.3 14.8 50 6Z"
)
STROKE_HALF = 3.75  # the retired stroke-width 7.5, centered on the curve
OVERLAP = 0.25  # how far the band bites into the fill
SAMPLES = 6000
TOLERANCE = 0.02  # simplification; ~1/12 of a device pixel at HUD 3x


def fmt(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


def ring_to_d(coords) -> str:
    return "M" + "L".join(f"{fmt(x)} {fmt(y)}" for x, y in coords[:-1]) + "Z"


def band_path() -> str:
    path = parse_path(MASTER)
    pts = [path.point(i / SAMPLES) for i in range(SAMPLES)]
    region = Polygon([(p.real, p.imag) for p in pts])
    outer = region.buffer(STROKE_HALF, quad_segs=64)
    inner = region.buffer(-(STROKE_HALF + OVERLAP), quad_segs=64)
    band = simplify(outer.difference(inner), TOLERANCE)
    return ring_to_d(list(band.exterior.coords)) + "".join(
        ring_to_d(list(i.coords)) for i in band.interiors
    )


if __name__ == "__main__":
    d = band_path()
    print(f'<path d="{MASTER}" fill="#fcc419"/>')
    print(f'<path d="{d}" fill="#e8590c" fill-rule="evenodd"/>')

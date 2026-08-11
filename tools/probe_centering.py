"""Render-probe for chip vertical centering — measures where the INK actually
lands, per browser engine, instead of trusting font-metric arithmetic.

WHY. The app centers all-caps type and digits on chip boxes via a measured
font-metric system (app.css "THE OPTICAL CENTERING RULE"), with a text-box
trim branch where engines support it and a hand constant where they don't.
Both halves encode assumptions about where an engine seats a baseline, and
those assumptions have now been wrong twice on engines nobody's Mac runs
(Windows Blink most recently). This probe replaces the argument with a
number: it renders specimen chips against the BUILT stylesheet, takes one
viewport screenshot per engine at 3x device scale, crops each specimen by
its DOM rect, finds the ink's bounding rows AND columns, and reports the
offset between the ink's center and the box's on both axes — in CSS pixels,
positive meaning the ink sits LOW (v) or RIGHT (h). The horizontal ruler is
the tracking-leak instrument: an un-given-back centered label reads h at
about −track/2 (see tests/centering-doctrine.test.ts for the enforced
manifest of every tracked label's repair).

WHAT IT RENDERS. Specimens using the app's global recipes (warchip, chipbox,
confirm) verbatim, plus inline replicas of the few component-scoped chips
whose hashed class names a static page can't speak (the market's position
tag, PayrollBox's math chips). A replica is a drift risk accepted knowingly:
this is an instrument, not a test of the component — its job is to measure
the RECIPE on an engine, and the recipe is four declarations.

HOW TO RUN.
    cd <repo root>
    (cd app && npm run build)
    uv run --with playwright,pillow python tools/probe_centering.py
    uv run --with playwright,pillow python tools/probe_centering.py --browsers chromium
Browsers must be installed once via `python -m playwright install chromium webkit`.

READING THE REPORT. |offset| <= ~0.15px is centered (below one device pixel
at 3x). Type specimens should sit near 0 on every engine that supports
text-box; emoji specimens have no cap band and report where the PLATFORM's
emoji font puts them — expect those numbers to differ per OS, which is the
point of running this on more than one (see .github/workflows/render-probe.yml).

ONE READING IS NOT A VERDICT ON BLINK. Chromium quantizes a text baseline
against the page's pixel grid, so the same recipe measures anywhere in a
±0.4px band depending on the fractional page position the specimen happened
to land at — measured here: sixteen copies of one chip, offset by sixteenth-
pixel steps, spread [-0.5, +0.3] with a mean of -0.03. SVG specimens are
NOT exempt: the 13px glyph sits 2.5px into a 22px pill's content box, on a
half-pixel seam, and its raster phase-wanders ±0.5px on chromium and
±0.15px on webkit (measured: sixteen x-pills, chromium mean -0.008, webkit
mean -0.018, layout dead-center in every phase). Before declaring ANY chip
broken, re-run or phase-sweep and judge the MEAN; only a WebKit TEXT
reading is trustworthy on its own.

The paired ghost/filled PayrollBox specimens also report HEIGHT, answering
"is the hired chip shorter than the dashed one" with a ruler.
"""

from __future__ import annotations

import argparse
import http.server
import io
import socketserver
import threading
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "app" / "dist"
# Device pixels per CSS px. The bbox ruler resolves offsets in steps of
# 1/(2·scale) CSS px — 0.167px at the default 3, the same size as the
# ~0.21px ride a 9px cap band takes under line-box centering. --scale 6
# halves the step to 0.083px for adjudicating specimens near the tolerance;
# 3 stays the default because the shipping tolerance (0.15px ≈ one device
# pixel at 3x) is defined against it.
SCALE = 3

# Specimen HTML, injected into a `.disp`-classed container on the built page so
# the bundled Nunito and every global recipe apply. `border` is the CSS border
# width the ink hunt stays inside of (the ring is ink too, and it is centered
# by construction); `shoulder` is the effective corner radius, which the hunt
# also stays clear of — see ink_offset for why both are load-bearing.
# Card-paper background comes from the container.
SPECIMENS: list[dict] = [
    {"id": "warchip", "border": 2, "shoulder": 8,
     "html": '<span class="warchip mid">4.5<span class="unit">WAR</span></span>'},
    {"id": "warchip-neg", "border": 2, "shoulder": 8,
     "html": '<span class="warchip neg">-3.6<span class="unit">WAR</span></span>'},
    {"id": "warchip-sm", "border": 2, "shoulder": 8,
     "html": '<span class="warchip sm mid">2.1<span class="unit">WAR</span></span>'},
    {"id": "confirm-pill", "border": 2, "shoulder": 12,
     "html": '<button class="confirm"><span class="chiplbl">SIGN FOR $23.5M</span></button>'},
    # The action row's label+glyph pair (finale exits, Home's PLAY shape):
    # real .btnrow/.btn/.chiplbl/.bic from the built CSS — the horizontal
    # reading rules the give-back pair (label margin + .bic's zeroed track).
    {"id": "btnrow-btn", "border": 2, "shoulder": 12,
     "html": ('<div class="btnrow" style="width:130px">'
              '<button class="btn"><span class="chiplbl">BACK</span> '
              '<span class="bic">↩️</span></button></div>')},
    # The NEW chip, verbatim recipe — ink fill, card-colored caps, 0.1em
    # track with its give-back. Both axes matter: the founding horizontal
    # asymmetry class, in its smallest, boldest instance.
    {"id": "newchip", "border": 0, "shoulder": 5,
     "html": '<span class="chipbox newchip"><span class="chiplbl">NEW</span></span>'},
    # The picker tiles (SEASON TICKET years, relocate club codes) — real
    # .pickopt class from the built CSS: 42px chipbox, chiplbl label, and on
    # the team tile the pedigree medal as a bare flex item.
    {"id": "pickopt-year", "border": 2, "shoulder": 12,
     "html": ('<button class="pickopt" style="width:72px">'
              '<span class="chiplbl">2001</span></button>')},
    {"id": "pickopt-team", "border": 2, "shoulder": 12,
     "html": ('<button class="pickopt" style="width:72px;letter-spacing:0.04em">'
              '<span class="chiplbl">TOR</span>'
              '<span class="pedi">\U0001f48d</span></button>')},
    # The same tile without its medal: the medal's emoji ink skews the union
    # bbox, so this is the reading that answers for the CODE's seat.
    {"id": "pickopt-team-bare", "border": 2, "shoulder": 12,
     "html": ('<button class="pickopt" style="width:72px;letter-spacing:0.04em">'
              '<span class="chiplbl">TOR</span></button>')},
    # The market's position tag, replicated inline (PlayerList/PrimePicker .pos).
    {"id": "pos-tag", "border": 2, "shoulder": 7,
     "html": ('<span class="chipbox" style="width:38px;--chip-h:22px;'
              'border:2px solid #5d5847;border-radius:7px;font-weight:800;'
              'font-size:9.5px;letter-spacing:0.03em;background:#fffdf6">'
              '<span class="chiplbl">OF</span></span>')},
    # The finale ledger's pedigree chip (Finale .pedchip + its .erun emoji-run
    # wrapper, which carries the measured WebKit nudge). No cap band — this
    # measures the platform emoji font plus the correction.
    {"id": "pedchip-rings", "border": 0,
     "html": ('<span class="chipbox" style="--chip-h:18px;font-size:12px;'
              'font-weight:800;letter-spacing:0.1em">'
              '<span class="probe-erun">\U0001f48d\U0001f48d\U0001f6a9</span></span>')},
    {"id": "pedchip-stars", "border": 0,
     "html": ('<span class="chipbox" style="--chip-h:18px;font-size:12px;'
              'font-weight:800;letter-spacing:0.1em">'
              '<span class="probe-erun">⭐⭐⭐⭐⭐</span></span>')},
    # PayrollBox math chips (replica of .paymath > .chip): chipbox recipe,
    # 26px pinned, emoji split out as a bare item (AwardPill's split) and the
    # digits in a chiplbl the trim reaches. The digits-only specimen answers
    # for the text seat; the ghost for the bare emoji's ride — but note the
    # ghost's bbox reading is a KNOWN eye-vs-ruler split: 💰/🏟️ carry their
    # visual mass low, and bbox-centering them read sunk on the board, so
    # the component deliberately carries no vertical correction and a
    # nonzero reading here is expected, not a regression. Both report
    # height — the "is the hired chip smaller than the dashed outline"
    # question, answered with a ruler.
    {"id": "paychip-text", "border": 2, "shoulder": 13, "height_check": "paychip",
     "html": ('<span class="chipbox" style="--chip-h:26px;'
              'border:2px solid #5d5847;'
              'border-radius:999px;padding-inline:8px;background:#fffdf6;'
              'font-size:12px;font-weight:700">'
              '<span class="chiplbl">$203.2M</span></span>')},
    {"id": "paychip-ghost", "border": 2, "shoulder": 13, "height_check": "paychip",
     "html": ('<span class="chipbox" style="--chip-h:26px;'
              'border:2px dashed #8a8471;'
              'border-radius:999px;padding-inline:8px;'
              'font-size:12px;font-weight:700">'
              '<span>\U0001f4b0</span></span>')},
    # A squad row's honour glyph beside its name (Finale .emo): the emoji is a
    # bare flex item next to 14px type; offset here is the emoji's ride.
    {"id": "emo-ring", "border": 0,
     "html": '<span style="font-size:12px;line-height:1">\U0001f48d</span>'},
    # The corner dismissal pill (Sheet .x, and TrophyModal .fbtn its deliberate
    # copy): fixed 28×22, no padding, one line-art glyph as the lone flex item.
    # CloseGlyph's strokes span y=3.4..10.6 in the 14-unit viewBox — ink center
    # 7.0, the viewBox's own middle — so any measured ride is the BOX's doing
    # (baseline seating, strut), not the drawing's.
    {"id": "x-pill", "border": 2, "shoulder": 11,
     "html": ('<button style="border:2px solid var(--line);border-radius:999px;'
              'background:var(--card);color:var(--muted);font-family:inherit;'
              'font-weight:800;font-size:12px;line-height:1;padding:0;'
              'width:28px;height:22px;box-sizing:border-box;display:inline-flex;'
              'align-items:center;justify-content:center">'
              '<svg viewBox="0 0 14 14" aria-hidden="true" style="width:13px;'
              'height:13px;fill:none;stroke:currentColor;stroke-width:1.6;'
              'stroke-linecap:round">'
              '<path d="M3.4 3.4l7.2 7.2M10.6 3.4l-7.2 7.2"/></svg></button>')},
    # The same pill holding FilterGlyph's funnel (bars at y 3.8 / 7 / 10.2 —
    # ink center 7.0 again). Two glyphs, one box: if both read the same offset
    # the pill is the suspect; if they differ, the drawings are.
    {"id": "funnel-pill", "border": 2, "shoulder": 11,
     "html": ('<button style="border:2px solid var(--line);border-radius:999px;'
              'background:var(--card);color:var(--muted);font-family:inherit;'
              'font-weight:800;font-size:12px;line-height:1;padding:0;'
              'width:28px;height:22px;box-sizing:border-box;display:inline-flex;'
              'align-items:center;justify-content:center">'
              '<svg viewBox="0 0 14 14" aria-hidden="true" style="width:13px;'
              'height:13px;fill:none;stroke:currentColor;stroke-width:1.6;'
              'stroke-linecap:round">'
              '<path d="M2.8 3.8h8.4M4.9 7h4.2M6.3 10.2h1.4"/></svg></button>')},
    # The trophy case's lens chip (TrophyModal .fchip, ON state): 9px/800 caps
    # drawn through the chipbox recipe — pinned 22px, label in .chiplbl. As a
    # bare padding-driven button (its pre-recipe form) the caps measured
    # 0.75px high in Chrome and 0.25px in Safari.
    {"id": "fchip", "border": 1.5, "shoulder": 11,
     "html": ('<button class="chipbox" style="--chip-h:22px;'
              'border:1.5px solid var(--ink);border-radius:999px;'
              'background:var(--card);color:var(--ink);padding-inline:8px;'
              'font-size:9px;font-weight:800;letter-spacing:0.03em">'
              '<span class="chiplbl">EXHIBITION</span></button>')},
    # Control: the fchip's exact box with MIXED-CASE ink (cap ascender down to
    # the g's descender). Against the caps-only chip above it answers whether
    # caps and mixed case need different centering rules, with a ruler. NOTE
    # the bbox ruler reads a descender as low ink: under the trim the box is
    # cap..baseline, so a correct mixed-case seat reports POSITIVE here by
    # about half the descender's depth — that is the type hanging its tails
    # below the band, not a miscentered chip.
    {"id": "fchip-mixed", "border": 1.5, "shoulder": 11,
     "html": ('<button class="chipbox" style="--chip-h:22px;'
              'border:1.5px solid var(--ink);border-radius:999px;'
              'background:var(--card);color:var(--ink);padding-inline:8px;'
              'font-size:9px;font-weight:800;letter-spacing:0.03em">'
              '<span class="chiplbl">Bug Case</span></button>')},
    # A powerup pill at base tier (PowerupPill .pp / .lb): chipbox at 30px
    # with the label's ellipsis clamp and the trim-branch clip guard
    # (padding-block/margin-block pair) copied from the component. Caps-only
    # label so the cap band is what gets measured; the -emoji twin reports
    # where the platform emoji face sits in the same box, and whether the
    # guard is keeping the clamp off the emoji's ink.
    {"id": "powerup-pill", "border": 2, "shoulder": 16,
     "html": ('<span class="chipbox" style="--chip-h:30px;'
              'border:2px solid var(--line);border-radius:999px;'
              'background:var(--card);padding-inline:11px;font-size:10.5px;'
              'font-weight:800;letter-spacing:0.04em">'
              '<span class="chiplbl probe-pplb">RELOCATE</span></span>')},
    {"id": "powerup-pill-emoji", "border": 2, "shoulder": 16,
     "html": ('<span class="chipbox" style="--chip-h:30px;'
              'border:2px solid var(--line);border-radius:999px;'
              'background:var(--card);padding-inline:11px;font-size:10.5px;'
              'font-weight:800;letter-spacing:0.04em">'
              '<span class="chiplbl probe-pplb">⭐ TAP A PLAYER…</span></span>')},
    # The SHOW N MORE capsule's ↓ arrow (PlayerList .more .ph): a bare flex
    # item in the pill's chipbox, centered by the box alone — the arrow is a
    # TEXT glyph with no cap band, so this measures where Nunito's arrow ink
    # sits in the em square, which no trim corrects.
    {"id": "more-arrow", "border": 2, "shoulder": 11,
     "html": ('<span class="chipbox" style="--chip-h:30px;'
              'border:2px solid var(--line);border-radius:999px;'
              'background:var(--card);padding-inline:11px;font-size:10.5px;'
              'font-weight:800;letter-spacing:0.04em">'
              '<span class="probe-marrow">↓</span></span>')},
]


def ink_offset(img: Image.Image, rect: dict, border_css: float,
               shoulder_css: float = 0) -> tuple[float, float, float]:
    """(vertical offset, horizontal offset, box height) — ink center vs box
    center on BOTH axes, in CSS px.

    The horizontal reading is the tracking-leak ruler (app.css `.warchip
    .unit`; tests/centering-doctrine.test.ts): letter-spacing appends a step
    after the last glyph, so an un-given-back centered label reads here as a
    NEGATIVE horizontal offset of half a step (ink left of center). The
    hunt mirrors the vertical one with the axes swapped: columns are scanned
    inside the border, rows confined past the corner shoulders — the arcs
    would otherwise pin the bounding columns symmetrically and blind the
    ruler, exactly as they would the rows. Emoji specimens report the
    platform face's own side bearings here (Apple's medals carry ~0.17em per
    side, measured 2026-08-10) — a per-OS fact to read, not a regression.

    `img` is ONE viewport screenshot and `rect` the specimen's
    getBoundingClientRect — the bitmap is never clipped per element, because
    an element shot cannot be trusted as a ruler: Playwright's clip lands up
    to a few device pixels off the element at high scale factors (measured
    here: a 28px pill captured with its right ring cut mid-arc), and any
    misalignment reads directly as a phantom offset. A viewport shot's origin
    IS the page's (0,0), so rect × SCALE addresses the element's device
    pixels exactly, and the box center is arithmetic on the rect rather than
    an inference from edge detection.

    The ink hunt is confined to the glyph band: inside the border (+3 device
    px of antialiasing skirt), and horizontally past `shoulder_css` — the
    effective corner radius, which every rounded specimen must state. The
    ring's corner ARCS climb the full radius at the outer columns, and
    because they are symmetric on the box by construction they would pin
    both bounding rows to themselves — a hard 0.00 no matter where the glyph
    sits, a blind ruler rather than a centered chip. Past the arcs the ring
    is only the straight edges the vertical inset removes, so the scan sees
    the glyph alone; every specimen's run is centered and wider than its
    corners, so trimming the shoulders never trims the run away.

    The band's background is its OWN most common color — the chip's fill,
    whatever hue the tinting rule gave it — never the page's paper, which an
    ink-filled or tinted chip does not share.
    """
    px = img.load()
    edge = max(border_css, shoulder_css)
    x0 = round((rect["x"] + edge) * SCALE) + 1
    x1 = round((rect["x"] + rect["width"] - edge) * SCALE) - 1
    y0 = round((rect["y"] + border_css) * SCALE) + 3
    y1 = round((rect["y"] + rect["height"] - border_css) * SCALE) - 3

    counts: dict[tuple[int, int, int], int] = {}
    for y in range(y0, y1, 2):
        for x in range(x0, x1, 2):
            counts[px[x, y]] = counts.get(px[x, y], 0) + 1
    bgc = max(counts, key=counts.get)  # type: ignore[arg-type]

    def is_ink(x: int, y: int) -> bool:
        r, g, b = px[x, y]
        return abs(r - bgc[0]) + abs(g - bgc[1]) + abs(b - bgc[2]) > 90

    rows = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if is_ink(x, y):
                rows.append(y)
                break
    # The horizontal hunt cannot reuse the row hunt's rectangular insets: on
    # a capsule (shoulder = height/2) the arcs span the full height and a
    # shoulder-inset row band is EMPTY. Instead the ring is masked
    # geometrically — a pixel is scannable iff it sits inside the rounded
    # rect shrunk by the border plus the antialiasing skirt, which is the
    # exact region the ring's ink cannot reach at any corner radius. Full
    # glyph coverage (no narrow-band approximation to under-read a T's
    # extremes), ring excluded by construction.
    r_dev = shoulder_css * SCALE
    bins = border_css * SCALE + 3
    xL, xR = rect["x"] * SCALE, (rect["x"] + rect["width"]) * SCALE
    yT, yB = rect["y"] * SCALE, (rect["y"] + rect["height"]) * SCALE
    lim2 = max(r_dev - bins, 0) ** 2

    def interior(x: int, y: int) -> bool:
        dx = min(x - xL, xR - x)
        dy = min(y - yT, yB - y)
        if dx < bins or dy < bins:
            return False
        if dx < r_dev and dy < r_dev:
            return (r_dev - dx) ** 2 + (r_dev - dy) ** 2 <= lim2
        return True

    cols = []
    for x in range(round(xL + bins), round(xR - bins)):
        for y in range(round(yT + bins), round(yB - bins)):
            if interior(x, y) and is_ink(x, y):
                cols.append(x)
                break
    if not rows or not cols:
        return float("nan"), float("nan"), rect["height"]
    ink_center = (rows[0] + rows[-1] + 1) / 2
    box_center = (rect["y"] + rect["height"] / 2) * SCALE
    ink_center_x = (cols[0] + cols[-1] + 1) / 2
    box_center_x = (rect["x"] + rect["width"] / 2) * SCALE
    return (
        (ink_center - box_center) / SCALE,
        (ink_center_x - box_center_x) / SCALE,
        rect["height"],
    )


def serve(directory: Path) -> tuple[socketserver.TCPServer, int]:
    handler = lambda *a, **kw: http.server.SimpleHTTPRequestHandler(  # noqa: E731
        *a, directory=str(directory), **kw
    )
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def main() -> None:
    global SCALE
    ap = argparse.ArgumentParser()
    ap.add_argument("--browsers", default="chromium,webkit",
                    help="comma list: chromium, webkit, firefox")
    ap.add_argument("--scale", type=int, default=SCALE,
                    help="device pixels per CSS px (ruler step = 1/(2*scale))")
    args = ap.parse_args()
    SCALE = args.scale
    if not (DIST / "index.html").exists():
        raise SystemExit("app/dist missing — run `npm run build` in app/ first")

    srv, port = serve(DIST)
    inject = (
        "(specs) => {"
        "  document.getElementById('app')?.remove();"
        # Mirror of Finale's .erun rule and of PowerupPill's .lb (the ellipsis
        # clamp plus its trim-branch clip guard), for the replica specimens.
        "  const st = document.createElement('style');"
        "  st.textContent = '.probe-erun{display:block}"
        "@supports (font: -apple-system-body){.probe-erun{transform:translateY(0.5px)}}"
        ".probe-pplb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
        "@supports (text-box: trim-both cap alphabetic)"
        "{.probe-pplb{padding-block:0.35em;margin-block:-0.35em}}"
        # Mirror of PlayerList's .more .ph nudge (0.02em WebKit base, 0.177em
        # Blink). (PayrollBox's chips are plain chipbox recipe — no component
        # nudge to mirror.)
        ".probe-marrow{display:block;transform:translateY(0.02em)}"
        "@supports not (font: -apple-system-body)"
        "{.probe-marrow{transform:translateY(0.177em)}}';"
        "  document.head.appendChild(st);"
        "  const box = document.createElement('div');"
        "  box.className = 'disp';"
        "  box.style.cssText = 'padding:40px;background:#fffdf6;display:flex;"
        "flex-direction:column;align-items:flex-start;gap:20px';"
        "  for (const s of specs) {"
        "    const holder = document.createElement('div');"
        "    holder.innerHTML = s.html;"
        "    holder.firstElementChild.id = 'probe-' + s.id;"
        "    box.appendChild(holder.firstElementChild);"
        "  }"
        "  document.body.appendChild(box);"
        "  return document.fonts.ready.then(() => undefined);"
        "}"
    )
    results: dict[str, dict[str, tuple[float, float, float]]] = {}
    with sync_playwright() as pw:
        for name in args.browsers.split(","):
            browser = getattr(pw, name.strip()).launch()
            page = browser.new_page(device_scale_factor=SCALE,
                                    viewport={"width": 800, "height": 1500})
            page.goto(f"http://127.0.0.1:{port}/", wait_until="networkidle")
            page.evaluate(inject, SPECIMENS)
            page.wait_for_timeout(250)  # emoji faces settle after fonts.ready
            # One viewport shot, cropped by DOM rects — never per-element
            # screenshots, whose clip lands off the element at high scale
            # factors (see ink_offset).
            rects = page.evaluate(
                "(ids) => Object.fromEntries(ids.map(id => {"
                "  const r = document.getElementById('probe-' + id)"
                "    .getBoundingClientRect();"
                "  return [id, {x: r.x, y: r.y, width: r.width,"
                "               height: r.height}];"
                "}))",
                [s["id"] for s in SPECIMENS],
            )
            img = Image.open(io.BytesIO(page.screenshot())).convert("RGB")
            for s in SPECIMENS:
                voff, hoff, height = ink_offset(img, rects[s["id"]], s["border"],
                                                s.get("shoulder", 0))
                results.setdefault(s["id"], {})[name.strip()] = (voff, hoff, height)
            browser.close()
    srv.shutdown()

    engines = sorted({e for v in results.values() for e in v})
    print("\nink center vs box center, CSS px "
          "(v: + = ink LOW · h: + = ink RIGHT) · box height")
    print(f"{'specimen':<19}" + "".join(f"{e:>34}" for e in engines))
    for sid, per in results.items():
        row = f"{sid:<19}"
        for e in engines:
            voff, hoff, height = per.get(e, (float('nan'),) * 3)
            row += f"  v{voff:>+6.2f} h{hoff:>+6.2f}px  ht={height:<7.1f}"
        print(row)
    print("\n|offset| <= 0.15px reads as centered (sub-device-pixel at 3x).")
    print("h on EMOJI specimens reads the platform face's side bearings — "
          "per-OS fact, not a regression. h on an un-given-back tracked label "
          "reads about −track/2 (the leak the doctrine test enforces against).")


if __name__ == "__main__":
    main()

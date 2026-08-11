# Hot Stove logo assets

- `boiler-b6-flared.svg` — the primary logo: B6 full potbelly (pipe, arched door, hinge, flared legs), anchor flame in the door.
- `flame-cut-a.svg` — anchor flame, ink `#24221c` outline. The published flame mark and PNG favicon master.
- `flame-cut-b.svg` — anchor flame, cardstock-white `#fffdf6` outline. Unused: kept as a master for any future dark-context surface.
- `favicon.svg` — the browser favicon, static on purpose: the yellow-5 body carries dark tab bars and the orange-8 edge carries light ones, so no `prefers-color-scheme` adaptation is needed.

These files are the raw masters. `npm run brand:sync` in `app/` publishes the
approved boiler and flame to `app/public/brand/`, and refreshes the adaptive
favicon. The app, static 404, and OG renderer all use those published marks plus
`app/public/brand.css`, so their proportions and optical offsets stay in sync.

The flame path is asymmetric: its visual centroid is (50.31, 44.93) in path coordinates, ~5 units below the
bounding-box center (49.94, 39.94) — center it by centroid, never by bbox, or it sits high (the boiler file
already bakes this into the flame transform).

Colorway: orange-5 `#ff922b` body, ink or white outline, no inner ember; boiler body `#57534a`, window ivory
`#f6f1e3`. The wordmark's STOVE stays `--orange` (orange-8 `#e8590c`) by design — the mark and the type
deliberately wear different oranges.

The anchor flame uses a 7.5-unit outline: about 1.35px in the 11×15 HUD mark. The prior 9-unit outline
closed up the orange interior and carried more visual weight than the wordmark. In a lockup, optically align
the artwork rather than its bounds: lift the HUD flame 1.25px and the 28×37 boiler 2px. The boiler lift
belongs to the lockup composition, not this standalone asset.

Approved export split: the adaptive SVG plus 16×16 and 32×32 PNG browser favicons use the bare flame;
the 180×180 Apple touch icon uses the boiler on opaque ivory. Regenerate them with
`uv run --with playwright python tools/generate_favicons.py`.

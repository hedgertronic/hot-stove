# Brand flight + screen transitions — parked 2026-08-08

The animation round removed from the working tree pending review. Contents:

- `brand-flight.patch` — unified diff that re-applies the whole feature onto
  the current (reverted) tree: `git apply design/motion/brand-flight-2026-08-08/brand-flight.patch`
  from the repo root (or `patch -p1 <` the same file).
- `brandfly.ts` — the FLIP helper on its own, for reading.

What the feature did:
1. **Brand flight** (`lib/brandfly.ts` + anchors in Home/App): the lockup
   flies from the home masthead into the game header on PLAY, and back on
   quit — a hand-rolled FLIP (stash the outgoing rect, one WAAPI flight on
   the incoming element, `composite: "add"` so the header's optical seat
   survives). Reduced-motion gated by hand (WAAPI is not covered by
   app.css's animation kill).
2. **Boot glide**: the boot title card holds until 1s from navigation start
   (skipped under reduced motion), then the masthead glides from the card's
   38vh anchor to its home seat (600ms).
3. **Screen entrances**: home body and header brand/✕ fade in over 0.3s
   (opacity only — they contain flight targets); the game board fades+rises
   8px with a 0.05s stagger. The ?/trophy corner pair is excluded — constant
   chrome (its Home markup was wrapped in a `.homebody` fade wrapper for
   this; the wrapper is part of the patch).

Kept in the tree (not animations): the corner pair's −3.5px home seat that
stops the 3.5px hop between screens, and the brand/flame SVG preloads in
index.html.

# hotstove.io migration plan

Status: phase 1 built on branch `io-domain`. Phases 2 and 3 unbuilt.

The game moves its canonical home from `hedgertronic.com/games/hot-stove/` to
`hotstove.io`, registered 2026-08-13 at Cloudflare Registrar (zone
`e3b2173f5f0cdad35773453370349cc6`, expiry 2027-08-13).

Revision note: an earlier draft of this plan was reviewed by Codex Sol and three
of its claims were falsified. Each is recorded at the point it was wrong, under
**Corrected**, because the wrong version is the intuitive one and will be
proposed again by the next person who reads only the storage layout.

## Why a handoff is needed at all

The game has no backend; all state is localStorage. localStorage is scoped to
the **origin**, and `hedgertronic.com` and `hotstove.io` are different origins.
Eight keys hold everything a player owns:

| Key | Shape | Holds |
|---|---|---|
| `hotstove.history` | oldest-first array | finished-game log; scored seasons AND repeatable no-id quit rows |
| `hotstove.archive` | oldest-first array of `{id, ...StoredFinale}`, no date field | replayable finales, `ARCHIVE_CAP = 50` |
| `hotstove.current` | JSON save, accepted versions 4–6 | in-progress save, written after every mutation |
| `hotstove.finale` | one `StoredFinale` object | stored finale |
| `hotstove.finale.open` | raw `"1"` or `"a:<archive-id>"` — a POINTER, not a boolean | which finale is open |
| `hotstove.settings` | `{v:2,difficulty,bank}` | mode selection |
| `hotstove.cues` | `{v:1,pendingBadges,helpSeen,tourSeen,finaleTourSeen}` | pending badge notifications AND seen flags |
| `hotstove.theme` | raw `"light"`/`"dark"`, not JSON | day/night choice |

A bare 301 from the old path therefore presents every returning player with an
empty record book, an empty trophy case, and no in-progress season. Nothing
recovers it server-side because there is no server side.

## Phase 1 — hotstove.io serves the game (BUILT)

`wrangler.jsonc` adds `hotstove.io/*` and `www.hotstove.io/*` routes.
`worker.js` branches on hostname:

- `www.hotstove.io` → 301 to apex. One hostname holds the canonical URL, and a
  game played at www then reopened at the apex would find nothing. Permanent:
  www will never be the game.
- any hostname that is not `hedgertronic.com` → serve assets at root. Matched by
  exclusion so `hotstove.io` and the workers.dev preview share one arm. This
  fails OPEN: a custom domain added to the route list later becomes a root game
  host with no code change, which is the intent for another vanity domain and
  wrong for anything else.
- `hedgertronic.com` → prefix-strip behavior, otherwise unchanged.

### Misses redirect home; subresource misses stay misses

The game is one document with no routes. State lives in localStorage and the only
URL vocabulary is query strings — `?instructs` and `?n` (`App.svelte:77`), plus
the dev-only `?lab` and `?og-preview`. Query strings ride on the `/` path, so the
worker never sees them as subpaths and they need no handling.

So a **navigation** to any other path is a stale link or a typo, and the game
itself is the only useful destination: 302 to the game's document path on that
hostname, preserving the query string. 302 rather than 301 because nothing about
"this path is not the game" is a permanent fact about the URL, and a permanent
cache entry would outlive the day a real path exists.

A **subresource** miss returns a plain 404. Redirecting one would hand an HTML
document to a `fetch()` that asked for JSON, so a bad card load would fail on a
parse error pointing at the wrong thing instead of on the 404 that is true.
Navigation is detected by `Sec-Fetch-Mode: navigate`, with an `Accept: text/html`
sniff for clients that omit it; `fetch()` sends a wildcard Accept and so reads as
a subresource.

This replaces serving `dist/404.html` on a miss, which was an infinite loop on
any root host: that page does `location.replace("/games/hot-stove/")`
(`404.html:26`), which on the apex is itself a missing root asset, so the worker
served the same page again. Its stylesheet (`:35`) and its visible link (`:100`)
are hardcoded to the old mount as well.

`dist/404.html` is now unreferenced by the worker and reachable only by typing
its path, where it still renders unstyled and links nowhere on the apex. Deleting
it, or rewriting its three hardcoded paths, is an open cleanup — it is a designed
brand asset, so the call belongs to the owner.

### Metadata

`index.html` repoints `rel=canonical`, `og:url`, `og:image`, `twitter:image` and
the JSON-LD `url`/`image` at `https://hotstove.io/`. The `?v=3` image param is
NOT bumped: a host change re-keys the scraper cache on its own, and the file's
own rule reserves `?v=` for art that changes underneath a stable URL.

The old path keeps SERVING (not redirecting) through phase 1, so shipping this
cannot lose player data. `base: "./"` in vite.config means the same bundle serves
at a domain root and at a two-segment path with no rebuild.

DNS: proxied `AAAA` placeholders on `100::` for apex and www. Origin is never
contacted; the records exist so the Workers routes have a hostname to bind.

Edge caching is not a cross-host hazard. The asset subrequest keeps the request
hostname, so the two hostnames get separate cache keys, and static index assets
default to `max-age=0, must-revalidate`. Phase 2's hostname branch is
client-side, so a cached document cannot select the wrong branch — that stops
being true if the worker ever generates host-specific HTML.

## Phase 2 — the save handoff (UNBUILT)

### Mechanism, and the one that was rejected

REJECTED: hidden `hotstove.io` iframe on the old page + `postMessage`. Chrome
partitions iframe localStorage by embedded origin plus top-level site, and WebKit
partitions third-party localStorage and makes it ephemeral. Data written into
that iframe is keyed to the origin PAIR and is invisible when the player later
visits `hotstove.io` first-party. The eTLD+1 shared-parent escape hatch does not
apply — these are different registrable domains. This would pass a manual test
and silently fail for real players.

CHOSEN: **first-party fragment handoff.** The old page does a top-level
navigation to `https://hotstove.io/#adopt=<payload>&t=<theme>`. `hotstove.io` is
then the top-level document, so its localStorage is real and permanent. The
fragment is never sent to any server.

### Where the code lives

Inside `index.html`, not a separate bridge page. The boot card markup, the
pre-paint theme script and the ground hexes already live there; a standalone page
would duplicate them, and this codebase has an explicit scar about duplicated
logic drifting (`logcodec.ts` exists because two copies of an encoder diverged).
One document, two behaviors, branched on `location.hostname`.

### Merge policy

**Corrected.** The earlier draft said "union history, dedupe on
`id ?? JSON.stringify(row)`" and claimed every reader is an order-independent
aggregate. Both are false:

- The trophy case **tallies counts** (`settings.ts:383` builds a
  `Map<string, number>`) and the code is explicit that repeats are counted, not
  deduped: *"the case shows 🧳 ×4 after four quits"* (`settings.ts:221`). Quit
  rows carry no `id` and only a day-level date, so four quits in one mode on one
  day are byte-identical. A JSON-equality fallback destroys them.
- Order matters. `bestFor` resolves tied bests to the NEWER row via `>=` and that
  decides `bestId` (`settings.ts:251`). `SeasonsModal` assumes storage order is
  oldest-first and reverses it (`SeasonsModal.svelte:76`). Passport ordering is
  map insertion order (`settings.ts:669`). `prevTotal` for career badges reads
  the last scored row (`engine.svelte.ts:2470`).

So: no dedupe, and no re-sort. Everything in the source log happened BEFORE the
move and everything in the target log after it, so **concatenate source ahead of
target**. Chronology is preserved exactly, day-precision dates are never
compared, and multiplicity survives.

| Key | Policy |
|---|---|
| `history` | concatenate source rows ahead of target rows. No dedupe, no sort. |
| `archive` | concatenate source ahead of target, dedupe by `id` only, keep the `ARCHIVE_CAP` NEWEST (the tail). |
| `current` | keep target's if present, else adopt source's. |
| `finale` + `finale.open` | move as a PAIR, only when the target has neither. |
| `settings` | keep target's if present, else adopt source's. |
| `cues` | merge: `pendingBadges` unions, the seen flags OR together. |
| `theme` | keep target's if present, else adopt source's. |

`finale`, `finale.open` and `archive` are ONE consistent state group, not three
independent keys: `finale.open` may hold `a:<archive-id>`, so a marker adopted
without its archive row points at nothing. If the referenced row did not survive
the cap or the budget, drop the marker.

`cues` is not preferences. `pendingBadges` is an accumulating notification set,
so keeping the target's wholesale silently discards pending source
notifications.

The singular keys cannot be merged — there is one in-progress game per origin and
the two are mutually exclusive states. Keeping the target's means a player
mid-season on `hotstove.io` does not get the game yanked out from under them.

### Idempotency without dedupe

A high-water marker on the TARGET: `hotstove.adopted`, mapping a source origin to
the number of source `history` and `archive` rows already merged. A later handoff
merges only rows past that mark.

This gives exact multiplicity, since nothing is ever compared for equality, and
still catches late additions — a player who keeps an old tab open and finishes
more games there gets them merged on the next handoff. Both logs are append-only
in practice, which is what makes a count a valid mark.

### The adopt hop

**Corrected.** The earlier draft ended the hop with
`location.replace("https://hotstove.io/")` and claimed a "second load … boots
normally". From `https://hotstove.io/#adopt=…` that target differs only in the
fragment, which is a SAME-DOCUMENT navigation: no new document, no module
re-execution. Boot stays suppressed and the player sees a dead page.

The hop is therefore: suppress boot, merge, verify, `history.replaceState` to
clean the URL, then a real `location.reload()`.

Boot suppression must be SYNCHRONOUS. The module tag at `index.html:223` is
static, so an async inline routine yields and the module runs while decompression
is still in flight. A synchronous inline script in `<head>` stashes the raw
payload and sets a sentinel; `main.ts` checks that sentinel at the top of its
body and returns before `applyTheme` and `mount`.

The storage reads that must not happen first are `main.ts:13`'s `resolveTheme()`,
component initialization during `mount()` (settings, cues, history at
`App.svelte:46`/`:76`), and save restoration at `App.svelte:163`. No imported
module reads storage merely on import, so gating `main.ts` is sufficient.

`&t=<theme>` rides OUTSIDE the compressed blob so the pre-paint script can stamp
`data-theme` synchronously before first paint. Without it a dark-mode player on a
light-mode machine flashes light ground during the hop, because `hotstove.io`'s
pre-paint script reads its own still-empty storage and falls through to
`matchMedia`.

Both hops use `replace`, so Back does not land on the bridge and repeat.

### Payload budget and failure semantics

Budget: 48 KB of base64, well under Chromium's 2 MB navigation limit. There is no
normative cross-browser fragment limit, so this needs real-device testing on
Safari, iOS WebViews and in-app browsers before it ships.

Tiers: history and the small keys first, then archive rows newest-first until the
budget is hit. Dropping archive rows degrades the way the model already expects —
a history row whose archive record is gone is *"still counted, still stamped, no
longer openable"* — so the season keeps contributing to the record book and to
badge tallies.

**Corrected.** History is uncapped (`history.ts:159`), so "tier 1 always carried
whole" was not a guarantee. At ~420 B/row and roughly 8× compression, 48 KB of
base64 holds on the order of 685 rows; a player past that carries the newest rows
that fit and the marker records the merge as partial. That ceiling is an estimate
and worth measuring rather than trusting.

`localStorage` has no multi-key transaction, so adoption can partially succeed.
Order is: write → re-read and verify each key → record the high-water mark for
what verified → clean the URL → reload. A quota failure leaves the mark short, so
the next handoff retries the remainder instead of assuming completion.

`CompressionStream` is Safari 16.4+, and this codebase supports iOS Safari 16.0+
(`scrolllock.ts:19`). Where it is missing, send uncompressed base64 if it fits
the budget; if it does not, skip the automatic handoff and leave the player the
explicit affordance below.

### Untrusted input

`#adopt=` is attacker-supplied: any link can carry a crafted payload, and this
channel PERSISTS what it carries.

**Corrected.** The earlier draft leaned on the existing readers for validation
and cited replay shortcodes as precedent. Neither holds. Save restore validates a
structural floor and then assigns many values verbatim
(`engine.svelte.ts:3165`). `renderableFinale` checks some numeric fields and that
`slots` is an array, not each slot's contents (`history.ts:221`). Replay
shortcodes are not comparable because a replayed game is explicitly inert and
writes nothing (`engine.svelte.ts:589`).

Validate before persisting, not on read:

- Bound decompressed output incrementally and abort past a hard cap. The
  legitimate ceiling is ~300 KB, so a 1 MB cap is generous; without one a small
  fragment is a decompression bomb.
- Cap incoming row counts on both logs before any write.
- Run `renderableFinale` on archive rows BEFORE they consume cap slots, so
  invalid rows cannot displace valid target rows that readers would have kept.
- Adopt only the eight known keys.

Residual risk, accepted: a crafted link can stuff a fake record or badge into a
player's own trophy case. Single-player, no server, no leaderboard, so the impact
is confined to that player's own display.

The fragment is not sent in HTTP requests but is readable by every script in the
document, by extensions, and potentially by history-sync and crash-recovery. The
page loads a third-party Google tag and ships no CSP by design
(`index.html:151`, `_headers:4`). GA's default `page_location` omits fragments,
so the current configuration should not transmit the payload, but GA should be
suppressed on the adopt document regardless — both to avoid leaking the fragment
and to avoid a duplicate pageview on the hop.

### Visual

Silent. The bridge wears the existing boot card, so the hop reads as one slightly
long load. The address bar changing to `hotstove.io` is the only cue. No new
player-facing copy, which also keeps out the change-state language a migration
notice would require.

### The explicit affordance

A "played before on hedgertronic.com?" link on the new site, routing through the
bridge and back. It covers the player who arrives directly at `hotstove.io` and
never passes through the old URL, and the high-water marker makes clicking it
repeatedly harmless.

## Phase 3 — retire the old path (UNBUILT)

Replace the bridge with a 301 from `hedgertronic.com/games/hot-stove*` to
`hotstove.io`, as a Cloudflare redirect rule — the mechanism the earlier
`/hot-stove/` → `/games/hot-stove/` migration used. Keep it permanently: it is
also the `.io` hedge, since a retirement of the `.io` ccTLD (Chagos sovereignty
transfer; no change expected inside five years) is handled by flipping the
redirect back.

Not before the bridge has been live long enough for returning-player traffic on
the old path to decay. Six months is the floor, and the bridge costs nothing to
keep.

## Known limits, accepted

1. The handoff fires only for players who arrive via the OLD url. Anyone who
   types `hotstove.io` or clicks a fresh share link sees an empty store until
   they use an old link or the explicit affordance. Inherent to origin-scoped
   storage: nothing can read `hedgertronic.com` storage without the browser
   visiting `hedgertronic.com`.
2. An unfinished season on the old origin is lost when a season is already in
   progress on the new one. Finished games are never lost this way — they are in
   the log, which merges.
3. Very old archive rows may not survive a heavy player's budget. The record book
   and badge tallies do.

## Tests phase 2 must carry

- Worker host/path matrix: apex root, apex assets, apex navigation miss, apex
  subresource miss, www redirect preserving path/query, old bare prefix, old
  prefix miss, workers.dev. Plus an executable test that a root-host miss does
  not loop.
- Merge: same-day duplicate quit rows preserved as a multiset (🧳 ×4 stays ×4),
  identical legacy rows preserved, chronology such that `bestId`, the seasons
  shelf, passport order and `prevTotal` all match a single-origin control.
- High-water marker: repeat handoff is a no-op; a handoff after late source play
  merges only the new rows.
- State group: `finale.open` holding `a:<id>` whose archive row was dropped
  resolves to no marker rather than a dangling pointer.
- Failure paths: missing `CompressionStream`, malformed gzip, oversized
  expansion, malformed JSON, truncated fragment, and each `setItem` failing in
  turn leaving a short mark rather than a false completion.
- Boot gating: the module never initializes against partial storage.
- Cross-browser E2E on two real origins (Chromium, Firefox, WebKit): adoption,
  clean reload, Back behavior.

## Follow-ups outside the app

- Zone hardening on `hotstove.io` to match the other five zones: HSTS
  `max-age=604800`, Bot Fight Mode. DNSSEC is one-click here with no registrar
  transfer to wait on.
- `X-Robots-Tag: noindex` for the workers.dev hostname in `_headers`; it is
  currently indexable and now serves a full root-mounted copy of the game.
- GA4: measurement ID `G-35RY8Y6Q5V` is hardcoded (`index.html:149`), so creating
  a data stream changes nothing by itself. Keeping the existing ID keeps the data
  series continuous; `hotstove.io` needs adding to that stream's configuration,
  and `hedgertronic.com` to unwanted referrals, or the redirect makes the old
  site look like a top referrer. `analytics.ts:8`'s comment describing path-based
  separation is already stale for root-host traffic.
- `.github/workflows/deploy.yml` — confirm no smoke test pins the old URL.

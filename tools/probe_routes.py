"""Probe the live route matrix across the game's three origins.

    uv run --with requests python tools/probe_routes.py

The unit tests in ``app/tests/worker-routes.test.ts`` prove what ``worker.js``
decides. They cannot prove which routes Cloudflare actually attached, because
routes are zone configuration rather than part of the uploaded bundle — nothing
in the repo, and nothing in CI, sees them. Run this after any ``wrangler
deploy`` that changes ``routes`` in ``app/wrangler.jsonc``.

Two checks carry more weight than the rest:

``hedgertronic.com/`` must keep serving the main site. The worker claims that
zone only under ``/games/hot-stove*``; if that pattern is ever widened, the
worker answers for the whole zone and the main site is down. No test in the app
can see this. It is the rollback trigger.

``hedgertronic.com/games/hot-stove/`` must keep returning 200. The two origins
hold separate ``localStorage``, so until the save handoff ships (phase 2 of
``docs/IO-MIGRATION.md``) redirecting that path strands every returning
player's record book.

A freshly attached route propagates per colo, and a request that reaches an
edge without it falls through to the zone's origin — a black-hole ``AAAA`` on
``100::`` — which answers 522. So 522 is retried rather than failed; any other
wrong answer fails on the first try.
"""

import sys
import time

import requests

NAV = {"Sec-Fetch-Mode": "navigate", "Accept": "text/html", "User-Agent": "hot-stove-route-probe"}
SUB = {"Sec-Fetch-Mode": "no-cors", "Accept": "*/*", "User-Agent": "hot-stove-route-probe"}

APEX = "https://hotstove.io"
OLD = "https://hedgertronic.com/games/hot-stove"

# (label, url, headers, want_status, want_location or None)
CHECKS = [
    ("apex serves the game", f"{APEX}/", NAV, 200, None),
    ("apex serves an asset", f"{APEX}/data/index.json", SUB, 200, None),
    ("apex nav miss goes home", f"{APEX}/nope", NAV, 302, f"{APEX}/"),
    ("apex nav miss keeps the query", f"{APEX}/nope?instructs", NAV, 302, f"{APEX}/?instructs"),
    ("apex subresource miss stays a miss", f"{APEX}/data/gone.json", SUB, 404, None),
    ("www is permanent to the apex", "https://www.hotstove.io/", NAV, 301, f"{APEX}/"),
    # Cloudflare static assets drop the .html extension before serving, and the
    # worker passes that redirect through because it is not a 404.
    ("brand page drops .html", f"{APEX}/404.html?review", NAV, 307, "/404?review"),
    ("brand page serves on the apex", f"{APEX}/404?review", NAV, 200, None),
    ("brand page serves on the old mount", f"{OLD}/404?review", NAV, 200, None),
    ("OLD MOUNT still serves — saves live here", f"{OLD}/", NAV, 200, None),
    ("old mount bare prefix takes the slash", OLD, NAV, 301, f"{OLD}/"),
    ("old mount serves an asset", f"{OLD}/data/index.json", SUB, 200, None),
]

RETRIES = 6
DELAY_SECONDS = 10


def check(label, url, headers, want_status, want_location):
    """Request `url` until it stops answering 522, then report the match."""
    for attempt in range(RETRIES):
        response = requests.get(url, headers=headers, allow_redirects=False, timeout=20)
        if response.status_code != 522:
            break
        if attempt < RETRIES - 1:
            print(f"       522 (route not on this colo yet) — retry in {DELAY_SECONDS}s")
            time.sleep(DELAY_SECONDS)

    location = response.headers.get("location")
    ok = response.status_code == want_status and (
        want_location is None or location == want_location
    )
    want = f"{want_status}{f' -> {want_location}' if want_location else ''}"
    got = f"{response.status_code}{f' -> {location}' if location else ''}"
    print(f"[{'PASS' if ok else 'FAIL'}] {label}: {got} (want {want})")
    return ok


def main():
    failures = sum(not check(*row) for row in CHECKS)

    # The main site is not ours to assert a status on — only that the worker is
    # not the thing answering for it.
    response = requests.get("https://hedgertronic.com/", headers=NAV, timeout=20)
    hijacked = response.text.strip() == "Not found"
    failures += hijacked
    print()
    print(
        f"[{'FAIL' if hijacked else 'PASS'}] main site is not the worker: "
        f"{response.status_code}, {len(response.text)} bytes"
    )
    if hijacked:
        print("       ROLLBACK: the worker is answering for the whole hedgertronic.com zone.")

    # Both mounts must name the apex canonical, so shares fold into one URL.
    print()
    for url in (f"{APEX}/", f"{OLD}/"):
        response = requests.get(url, headers=NAV, timeout=20)
        named = 'rel="canonical" href="https://hotstove.io/"' in response.text
        failures += not named
        print(f"[{'PASS' if named else 'FAIL'}] canonical names the apex from {url}")

    print()
    print(f"{failures} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

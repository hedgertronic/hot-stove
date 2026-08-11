# Hot Stove launch checklist

**Historical.** This was the launch-era release checklist, completed for the 2026-08 launch and archived; the deploy gate today is CI (`npm run test:full` + the ink probe) on every push to main. Migration details live in `MIGRATION.md` beside this file.

## Brand and share assets

- [x] Choose the home mark: full potbelly boiler with the flame in its door.
- [x] Choose the in-game mark: bare flame beside the wordmark.
- [x] Align both lockups optically with their neighboring text and controls.
- [x] Retire the visible tagline from the home screen, 404, and share artwork.
- [x] Approve the 1200×630 OG preview: Hot Stove lockup over live gameplay — the 1995 Seattle Mariners market beside a four-man elite squad — on the card-white ground, with no subtitle or maker line.
- [x] Promote the approved preview to `app/public/og-image.png`.
- [x] Generate the adaptive flame SVG favicon and 16×16 / 32×32 PNG fallbacks.
- [x] Generate the 180×180 boiler Apple touch icon on an opaque ivory tile.
- [x] Verify the favicon in light and dark browser chrome and the Apple icon at device size.
- [x] Route the app, static 404, OG renderer, favicon tools, and Apple icon through the raw masters and shared lockup recipe.

## Launch connections and support

- [x] Add the hedgertronic maker chip — camera mark + name — to the home screen’s upper-right corner, in the corner-button register; keep it off the finale.
- [x] Add Hot Stove to a dedicated Games subsection on hedgertronic.com.
- [x] Use the canonical Hot Stove OG image on its hedgertronic.com game card, with the unapproved candidate substituted only on localhost.
- [x] Review both reciprocal links on local servers before deployment.
- [x] Add a line-art bug-report action to the Help sheet that matches the existing corner controls.
- [x] Prefill the GitHub report with useful environment and game-debug context without exposing unrelated local data.
- [x] Verify the report action with and without an active game.

## Product and content cleanup

- [x] Update `README.md` to use the canonical `/games/hot-stove/` URL and current gameplay/branding copy.
- [x] Bring the static `404.html` shell into visual parity with the live home screen.
- [x] Reconcile completed migration items in `MIGRATION.md` and point future release work here.
- [x] Confirm the home, game, Help, finale, and restored-finale screens at phone and desktop widths.
- [x] Confirm keyboard focus, reduced motion, and screen-reader labels for the new links and report action.

## Release verification

- [x] Run the full Hot Stove test suite, including the focused bot simulation.
- [x] Run `svelte-check` with zero errors and warnings.
- [x] Run the production build and inspect its asset paths under `/games/hot-stove/`.
- [x] Run the hedgertronic.com unit tests and production build.
- [x] Review the scoped diffs in both repositories; preserve unrelated work.
- [x] Commit and push the Hot Stove release intentionally.
- [x] Commit and push the hedgertronic.com Games link intentionally.
- [x] Deploy Hot Stove, then the website link.
- [x] Smoke-test the production home, one complete game, Help/report, finale, and both reciprocal links.
- [ ] Refresh the X and Facebook card validators after the final OG image is live.
      (Nothing cached yet — the URL has never been shared on either platform, so the
      first real share scrapes the current card. Optional: preview it in the Facebook
      Sharing Debugger before the first post.)
- [x] Request re-indexing in Google Search Console and verify the canonical URL and sitemap entry.
      (2026-08-08: domain property verified, sitemap.xml Success with all 4 pages
      discovered, /games/hot-stove/ already indexed; re-crawl requested after the
      OG metadata change — "added to a priority crawl queue".)
- [x] Verify the legacy `/hot-stove/` redirect still resolves to `/games/hot-stove/`.

## Post-launch, not blocking

- [ ] Monitor bug reports and analytics for the first launch sessions.
- [ ] Revisit a dedicated Games page when there is more than one game.
- [ ] Keep larger roadmap ideas in the project backlog rather than expanding this checklist.

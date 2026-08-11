# Domain migration record — hedgertronic.com/hot-stove → /games/hot-stove (Cloudflare)

The migration is live at `https://hedgertronic.com/games/hot-stove/` behind
Cloudflare Workers. This file records the completed flip and the two external
follow-ups still outstanding. Historical, like everything in this folder;
release work today is CI on push to main (see the repo README).

## In the hedgertronic.github.io repo, NOW (no migration needed)

- [x] Add `robots.txt` at the repo root (drafted below). GitHub Pages serves it
      at `https://hedgertronic.com/robots.txt` — the root domain owns it; the
      hot-stove repo cannot ship one.
- [x] Add `sitemap.xml` at the root and list
      `https://hedgertronic.com/games/hot-stove/`; keep the Sitemap line in
      robots.txt pointing at it.

### robots.txt draft

```
# hedgertronic.com
User-agent: *
Allow: /

Sitemap: https://hedgertronic.com/sitemap.xml
```

(If no sitemap ships, drop the Sitemap line rather than pointing at a 404.)

## Cloudflare flip

- [x] `app/index.html`: flip `rel=canonical`, `og:url`, `og:image`,
      `twitter:image`, and the JSON-LD `url`/`image` from
      `…/hot-stove/` to `…/games/hot-stove/`.
- [x] `app/wrangler.jsonc`: uncomment the `routes` block so the Worker serves
      `hedgertronic.com/games/hot-stove*`, then `wrangler deploy` (the block's
      own comment has the full instructions).
- [x] `app/public/404.html`: its meta-refresh and link target are the absolute
      path `/hot-stove/` — flip both to `/games/hot-stove/`.
- [x] Create the 301: `hedgertronic.com/hot-stove/*` →
      `hedgertronic.com/games/hot-stove/*` (Cloudflare redirect rule). Every
      shared link, QR code, and scraped og:url from the launch keeps resolving
      through it — the redirect is permanent infrastructure, not a transition
      aid.
- [x] Update `sitemap.xml` to the `/games/hot-stove/` URL.
- [ ] Re-verify the social card in the X/Twitter card validator and Facebook
      sharing debugger after the flip — both cache the old og:url scrape.
- [ ] Google Search Console: request re-indexing of the new URL; the 301 plus
      the flipped canonical carries the ranking over.

## Already done (recorded so the flip doesn't redo it)

- `twitter:site` is `@hedgertronic` in index.html.
- `app/public/_headers` is Cloudflare-Pages-format cache headers; GitHub Pages
  ignores the file today, the Worker honors it after the flip.

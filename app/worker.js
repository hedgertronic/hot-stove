/** Serves the game at hotstove.io, and under hedgertronic.com/games/hot-stove.
 *
 * Assets are stored rooted at "/" (dist/index.html is asset "/index.html"), so
 * on hotstove.io — and on the workers.dev preview origin — a request path is
 * already an asset path and needs no rewriting. On the hedgertronic.com route
 * every path carries the /games/hot-stove prefix, misses the asset manifest,
 * and is stripped back to the asset path here. The same bundle serves at a
 * domain root and at a two-segment path with no rebuild because vite builds
 * with `base: "./"`: everything the page loads resolves against wherever the
 * page came from.
 *
 * hotstove.io is the canonical home — index.html's rel=canonical, og:url and
 * JSON-LD all name it. The hedgertronic.com route still serves the game rather
 * than redirecting because the two origins hold SEPARATE localStorage: every
 * save, the record book, the trophy case and the passport live on whichever
 * origin wrote them, so a redirect today would strand a returning player in
 * front of an empty record book. The old path keeps serving until the save
 * handoff ships, and becomes a redirect after it.
 *
 * run_worker_first (wrangler.jsonc) puts EVERY request through here, including
 * ones that would have matched an asset on their own — so each arm has to hand
 * the request to env.ASSETS itself rather than falling through to it.
 */
const PREFIX = "/games/hot-stove";

/** A navigation is a person arriving at a URL: the browser is asking for a
 * document. Everything else is the page fetching its own parts. Sec-Fetch-Mode
 * is the reliable signal; the Accept sniff covers clients that omit it. A
 * fetch() sends a wildcard Accept, which names no document type and so reads as
 * a subresource — exactly what the card and data loads need. */
function isNavigation(request) {
  if (request.headers.get("Sec-Fetch-Mode") === "navigate") return true;
  return (request.headers.get("Accept") ?? "").includes("text/html");
}

/** Assets at `url`, with a miss resolved against `home` — the game's document
 * path on this hostname.
 *
 * The game is one document with no routes: state lives in localStorage and the
 * only URL vocabulary is query strings (?instructs, ?n, ?lab). So a NAVIGATION
 * to any other path is a stale link or a typo, and the game itself is the only
 * useful destination. Redirecting there rather than serving a 404 page is also
 * what keeps dist/404.html out of the loop it used to cause: that page sends
 * browsers to /games/hot-stove/, which on this apex is itself a missing root
 * asset, so serving it here bounced forever.
 *
 * 302 rather than 301: a permanent entry in every browser's cache would outlive
 * the day a real path exists, and nothing about "this path is not the game" is
 * a permanent fact about the URL.
 *
 * A SUBRESOURCE miss stays a miss. Redirecting one would hand an HTML document
 * to a fetch() that asked for JSON — a card load would fail on a parse error
 * pointing at the wrong thing, instead of on the 404 that is true. */
async function serveAssets(env, url, request, home) {
  const response = await env.ASSETS.fetch(new Request(url, request));
  if (response.status !== 404) return response;
  if (!isNavigation(request)) return new Response("Not found", { status: 404 });
  const target = new URL(home, url.origin);
  target.search = url.search;
  return Response.redirect(target, 302);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // One hostname holds the canonical URL, so www carries no content of its
    // own. Redirecting rather than serving keeps a single address in the bar,
    // in share text, and in the origin that localStorage is keyed to — a game
    // played at www and then reopened at the apex would find nothing. This 301
    // IS permanent: www will never be the game.
    if (url.hostname === "www.hotstove.io") {
      url.hostname = "hotstove.io";
      return Response.redirect(url, 301);
    }

    // hedgertronic.com is the only mount point that carries a path prefix.
    // Every other routed hostname — hotstove.io and the workers.dev preview —
    // serves the bundle at its root, so they are matched by exclusion rather
    // than by name. Exclusion fails OPEN: a custom domain added to the route
    // list later becomes a root game host with no change here, which is the
    // intent for another vanity domain and wrong for anything else.
    if (url.hostname !== "hedgertronic.com") {
      return serveAssets(env, url, request, "/");
    }

    // The bare prefix must redirect to the slash form, not rewrite: the app's
    // asset URLs are all relative (vite base "./"), so a document served at
    // /games/hot-stove resolves them against /games/ and every icon/preload
    // 404s (Safari then shows the domain's cached favicon).
    if (url.pathname === PREFIX) {
      url.pathname = `${PREFIX}/`;
      return Response.redirect(url, 301);
    }
    if (url.pathname.startsWith(`${PREFIX}/`)) {
      url.pathname = url.pathname.slice(PREFIX.length) || "/";
      return serveAssets(env, url, request, `${PREFIX}/`);
    }
    return new Response("Not found", { status: 404 });
  },
};

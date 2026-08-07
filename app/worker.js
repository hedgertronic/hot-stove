/** Serves the game under hedgertronic.com/games/hot-stove.
 *
 * Assets are stored rooted at "/" (dist/index.html is asset "/index.html"),
 * so on the workers.dev origin they serve directly and this worker never
 * runs. On the zone route every path carries the /games/hot-stove prefix,
 * misses the asset manifest, and lands here — the prefix is stripped and the
 * request re-enters asset serving. The app's own asset URLs survive the move
 * because vite builds with `base: "./"`: everything the page loads is
 * relative to wherever the page came from.
 */
const PREFIX = "/games/hot-stove";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === PREFIX || url.pathname.startsWith(`${PREFIX}/`)) {
      url.pathname = url.pathname.slice(PREFIX.length) || "/";
      const response = await env.ASSETS.fetch(new Request(url, request));
      if (response.status !== 404) return response;
      // The bounce page (GitHub Pages served it implicitly for the old
      // deployment; assets not_found_handling can't — see wrangler.jsonc).
      const page = await env.ASSETS.fetch(new URL("/404.html", url.origin));
      return new Response(page.body, { status: 404, headers: page.headers });
    }
    return new Response("Not found", { status: 404 });
  },
};

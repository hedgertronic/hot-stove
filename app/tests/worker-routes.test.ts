/** The Worker's host/path matrix, pinned as a contract.
 *
 * worker.js cannot be exercised through `wrangler dev`: in local mode the URL
 * the Worker sees is the dev server's own (127.0.0.1), not the Host header, and
 * the dev proxy rewrites the outgoing Location host to match Host — which makes
 * a probe LOOK like host branching works while every request is really taking
 * one arm. So the module's default export is called directly here with a stub
 * assets binding, which is the only way the three hostnames get distinguished.
 *
 * The regression this file exists for: serving dist/404.html on a miss looped
 * forever at a domain root, because that page redirects to /games/hot-stove/,
 * which at a root host is itself a missing asset that served the same page
 * again. Misses now resolve by request type instead — see `never serves the
 * bounce page` at the bottom. */
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain JS Worker module, no declaration file
import worker from "../worker.js";

/** Paths the real asset manifest holds, rooted at "/" the way dist/ stores
 * them. Everything else is a miss. */
const ASSETS = new Set([
  "/",
  "/index.html",
  "/404.html",
  "/og-image.png",
  "/assets/index-Cbk16ULm.css",
  "/data/index.json",
]);

const env = {
  ASSETS: {
    async fetch(request: Request) {
      const { pathname } = new URL(request.url);
      if (!ASSETS.has(pathname)) return new Response("miss", { status: 404 });
      // The bounce page carries its old-mount redirect; if any arm ever serves
      // it again, the assertion at the bottom of this file sees this body.
      const body =
        pathname === "/404.html" ? '<script>location.replace("/games/hot-stove/")</script>' : "ok";
      return new Response(body, { status: 200 });
    },
  },
};

/** A navigation — a person arriving at a URL. */
function nav(url: string) {
  return new Request(url, { headers: { "Sec-Fetch-Mode": "navigate", Accept: "text/html" } });
}

/** A subresource — the page fetching its own parts. Wildcard Accept, the way
 * fetch() sends it. */
function sub(url: string) {
  return new Request(url, { headers: { "Sec-Fetch-Mode": "no-cors", Accept: "*/*" } });
}

const hit = (request: Request) => worker.fetch(request, env) as Promise<Response>;

describe("hotstove.io (apex)", () => {
  it("serves the game at the root", async () => {
    const r = await hit(nav("https://hotstove.io/"));
    expect(r.status).toBe(200);
  });

  it("serves assets at their own paths, unprefixed", async () => {
    const r = await hit(sub("https://hotstove.io/data/index.json"));
    expect(r.status).toBe(200);
  });

  it("sends a navigation miss home rather than to a 404 page", async () => {
    const r = await hit(nav("https://hotstove.io/nope"));
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://hotstove.io/");
  });

  it("carries the query string through a navigation miss", async () => {
    // ?instructs and ?n are the game's whole URL vocabulary; a stale link that
    // carries one must not lose it on the way home.
    const r = await hit(nav("https://hotstove.io/nope?instructs"));
    expect(r.headers.get("location")).toBe("https://hotstove.io/?instructs");
  });

  it("leaves a subresource miss as a miss", async () => {
    // Redirecting would hand HTML to a fetch() that asked for JSON, so a bad
    // card load would fail on a parse error instead of on the true 404.
    const r = await hit(sub("https://hotstove.io/data/missing.json"));
    expect(r.status).toBe(404);
    expect(r.headers.get("location")).toBeNull();
  });
});

describe("www.hotstove.io", () => {
  it("redirects to the apex permanently, keeping path and query", async () => {
    const r = await hit(nav("https://www.hotstove.io/foo?n"));
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("https://hotstove.io/foo?n");
  });

  it("redirects the bare root too", async () => {
    const r = await hit(nav("https://www.hotstove.io/"));
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("https://hotstove.io/");
  });
});

describe("hedgertronic.com/games/hot-stove (the old mount)", () => {
  it("still serves the game — a redirect here would strand the save", async () => {
    // The two origins hold separate localStorage. Until the handoff ships, this
    // path serving is what keeps a returning player's record book reachable.
    const r = await hit(nav("https://hedgertronic.com/games/hot-stove/"));
    expect(r.status).toBe(200);
  });

  it("redirects the bare prefix to the slash form", async () => {
    // vite base "./" means a document at /games/hot-stove resolves its assets
    // against /games/, so every icon and preload would 404.
    const r = await hit(nav("https://hedgertronic.com/games/hot-stove"));
    expect(r.status).toBe(301);
    expect(r.headers.get("location")).toBe("https://hedgertronic.com/games/hot-stove/");
  });

  it("strips the prefix before reaching for an asset", async () => {
    const r = await hit(sub("https://hedgertronic.com/games/hot-stove/data/index.json"));
    expect(r.status).toBe(200);
  });

  it("sends a navigation miss to the game on THIS mount, not the apex", async () => {
    const r = await hit(nav("https://hedgertronic.com/games/hot-stove/nope"));
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://hedgertronic.com/games/hot-stove/");
  });

  it("leaves a prefixed subresource miss as a miss", async () => {
    const r = await hit(sub("https://hedgertronic.com/games/hot-stove/data/missing.json"));
    expect(r.status).toBe(404);
  });

  it("refuses anything outside the prefix — the route is not the whole zone", async () => {
    const r = await hit(nav("https://hedgertronic.com/somewhere-else"));
    expect(r.status).toBe(404);
    expect(r.headers.get("location")).toBeNull();
  });
});

describe("the workers.dev preview origin", () => {
  it("serves at the root, matched by exclusion", async () => {
    // Exclusion rather than an allowlist: any hostname that is not
    // hedgertronic.com is a root mount, so a new preview or vanity host needs
    // no code change. It fails OPEN, which is the tradeoff worker.js documents.
    const r = await hit(nav("https://hot-stove.josh-6d6.workers.dev/"));
    expect(r.status).toBe(200);
  });
});

describe("the 404 loop cannot come back", () => {
  it("never serves the bounce page, on any host", async () => {
    const misses = [
      nav("https://hotstove.io/nope"),
      nav("https://hotstove.io/games/hot-stove/"),
      sub("https://hotstove.io/assets/gone.js"),
      nav("https://hot-stove.josh-6d6.workers.dev/nope"),
      nav("https://hedgertronic.com/games/hot-stove/nope"),
    ];
    for (const request of misses) {
      const r = await hit(request);
      expect(await r.text()).not.toContain("games/hot-stove");
    }
  });

  it("does not bounce an apex miss onto the old mount's path", async () => {
    // The exact loop: /games/hot-stove/ is a missing ROOT asset on the apex, so
    // a miss handler that redirected there would be served by this same arm and
    // redirect again forever.
    const r = await hit(nav("https://hotstove.io/games/hot-stove/"));
    expect(r.headers.get("location")).toBe("https://hotstove.io/");
  });
});

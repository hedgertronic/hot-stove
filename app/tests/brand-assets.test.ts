import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const read = (relative: string) => fs.readFileSync(path.resolve(ROOT, relative), "utf8");

describe("shared brand assets", () => {
  it("publishes byte-identical copies of the approved raw marks", () => {
    expect(read("app/public/brand/boiler.svg")).toBe(read("design/logo/boiler-b6-flared.svg"));
    expect(read("app/public/brand/o-boiler.svg")).toBe(read("design/logo/boiler-o.svg"));
    expect(read("app/public/brand/flame.svg")).toBe(read("design/logo/flame-cut-a.svg"));
    expect(read("app/public/favicon.svg")).toBe(read("design/logo/favicon.svg"));
  });

  it("carries the O-boiler in brand.css as a data URI matching the master", () => {
    // The O paints from a data-URI background inside the render-blocking
    // stylesheet (no <img> fetch to race first paint on a hard refresh), so
    // the master and the inlined copy must be pinned together or a redraw of
    // o-boiler.svg would silently leave every lockup painting the old art.
    // Compared comment-stripped and whitespace-normalized with single quotes:
    // exactly the transform that produced the URI.
    const css = read("app/public/brand.css");
    const uri = css.match(/url\("(data:image\/svg\+xml,[^"]+)"\)/)?.[1];
    expect(uri).toBeDefined();
    const inlined = decodeURIComponent(uri!.replace("data:image/svg+xml,", ""));
    const master = read("app/public/brand/o-boiler.svg")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/>\s+</g, "><")
      .replace(/\s{2,}/g, " ")
      .replace(/"/g, "'")
      .trim();
    expect(inlined).toBe(master);
  });

  it("carries the NIGHT O-boiler as the day URI with ink fills at cream", () => {
    // The dark lockup's O is the same art with the five #24221c fills swapped
    // to the night ink #ede8da — one substitution, no geometry of its own to
    // drift. Pinned as exactly that derivation so a boiler redraw that updates
    // the day URI but forgets the night one fails here instead of shipping a
    // stale dark mark.
    const css = read("app/public/brand.css");
    const uris = [...css.matchAll(/url\("(data:image\/svg\+xml,[^"]+)"\)/g)].map((m) => m[1]);
    expect(uris).toHaveLength(2);
    expect(uris[1]).toBe(uris[0].replaceAll("%2324221c", "%23ede8da"));
  });

  it("routes the app, static 404, and OG template through the shared recipe", () => {
    expect(read("app/index.html")).toContain('href="./brand.css"');
    expect(read("app/public/404.html")).toContain("hs-logo hs-logo--home");
    expect(read("tools/og-template.html")).toContain("hs-logo hs-logo--og");
  });

  it("keeps retired launch copy off the static 404", () => {
    const page = read("app/public/404.html");
    expect(page).not.toContain("BETA");
    expect(page).not.toContain("Spin for teams");
    expect(page).toContain("FOUL BALL · BACK TO THE GAME");
  });
});

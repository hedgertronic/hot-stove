import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const read = (relative: string) => fs.readFileSync(path.resolve(ROOT, relative), "utf8");

describe("shared brand assets", () => {
  it("publishes byte-identical copies of the approved raw marks", () => {
    expect(read("app/public/brand/boiler.svg")).toBe(read("design/logo/boiler-b6-flared.svg"));
    expect(read("app/public/brand/flame.svg")).toBe(read("design/logo/flame-cut-a.svg"));
    expect(read("app/public/favicon.svg")).toBe(read("design/logo/favicon.svg"));
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

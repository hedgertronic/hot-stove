/** INSTRUCTS tour — the per-bank stop contract, pinned on the shipped source.
 *
 * The tour mounts once per first game and reads the live DOM, so its stop
 * table can't be exercised by SSR-string renders (nothing paints until
 * onMount measures the board). What CAN regress silently is the per-bank
 * branching: stop 2's payroll copy and stop 3's front-office copy + gate
 * both read the `fixedCap` prop, and a refactor that flattens either branch
 * re-teaches UI the fixed-cap banks don't render (owner/stadium tiles) or
 * silences the one it does (the manager). Same anchored-substring idiom as
 * the css-pins files: the pin states the decision, not a rendered pixel. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components/Instructs.svelte"),
  "utf8",
);

describe("the tour speaks per bank", () => {
  it("stop 2's payroll copy branches on the fixed-cap prop", () => {
    expect(src).toContain("This bank fixes your payroll.");
    expect(src).toContain("Your owner and stadium set your payroll.");
  });

  it("stop 3 teaches the manager alone on fixed-cap banks, all three hires on classic", () => {
    expect(src).toContain('"Hire a manager. Managers with better records add more wins."');
    expect(src).toContain("Hire an owner, buy a stadium, and hire a manager.");
  });

  it("stop 3's existence gate matches its copy: skipper row when fixed, owner/stadium row when classic", () => {
    expect(src).toContain('fixed ? ".special .srow.skip" : ".special .srow:not(.skip)"');
  });

  it("a stop whose selector or gate finds nothing is dropped, and an empty tour closes itself", () => {
    expect(src).toMatch(/document\.querySelector\(s\.selector\) && \(!s\.requires \|\| document\.querySelector\(s\.requires\)\)/);
    expect(src).toContain("if (stops.length === 0) {");
  });
});

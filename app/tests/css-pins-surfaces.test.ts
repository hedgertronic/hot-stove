import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* Surface-dress contracts — which token pair each surface wears (front
 * office hues, manager gray, help-sheet chips, seed capsule, powerup
 * lattice tiers, relocate grid) — pinned at the source. jsdom computes no
 * layout and resolves no cascade, so each pin states the invariant the CSS
 * carries — which token pair, which order, which tier — rather than a
 * rendered pixel. */

const read = (f: string) =>
  fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../src/${f}`),
    "utf8",
  );

describe("the front office wears teal / orange, on both of its surfaces", () => {
  // The FRONT OFFICE tile and the payroll formula's chip are the same object
  // at two sizes, and they have drifted apart twice (green vs blue, then
  // orange vs blue). One test holds each pair on both surfaces.
  const rows = read("components/SpecialRows.svelte");
  const box = read("components/PayrollBox.svelte");

  it("owner: --teal-2 fill and --teal-8 ring on tile and chip alike", () => {
    expect(rows).toContain("background: var(--teal-2)");
    expect(rows).toContain("border-color: var(--teal-8)");
    const own = box.match(/\.chip\.own \{[^}]*\}/)?.[0] ?? "";
    expect(own).toContain("var(--teal-2)");
    expect(own).toContain("var(--teal-8)");
  });

  it("stadium: --pink-2 fill and --pink-8 ring on tile and chip alike", () => {
    // Pink, round 31: the tile's one-round orange turned out to be the armed
    // voice (armed pills, hints, browsable targets), and a resting category
    // row in the action color read as something asking to be tapped.
    const stad = rows.match(/\.srow\.stad \{[^}]*\}/)?.[0] ?? "";
    expect(stad).toContain("var(--pink-2)");
    expect(stad).toContain("var(--pink-8)");
    const chip = box.match(/\.chip\.stad \{[^}]*\}/)?.[0] ?? "";
    expect(chip).toContain("var(--pink-2)");
    expect(chip).toContain("var(--pink-8)");
  });

  it("the owner's bright gold is gone from the tile", () => {
    // --yellow may live on elsewhere (badge rarity); what it may
    // not do is fill the owner row again.
    const srow = rows.match(/\.srow \{[^}]*\}/)?.[0] ?? "";
    expect(srow).not.toContain("--yellow");
    expect(srow).not.toContain("--gold-8");
  });

  it("the help sheet's bullets name the hues the tiles actually wear", () => {
    const help = read("components/HelpModal.svelte");
    expect(help).toContain("<b>💰 Owner</b> (teal)");
    expect(help).toContain("<b>🏟️ Ballpark</b> (pink)");
    expect(help).toContain("<b>🧢 Skipper</b> (white)");
  });
});

describe("the taken manager grays like a dead player row", () => {
  const rows = read("components/SpecialRows.svelte");

  it("identity bits go monochrome; the row never grayscales whole", () => {
    const taken = rows.match(/\.srow\.taken \{[^}]*\}/)?.[0] ?? "";
    // The market's dead-row recipe, part for part.
    expect(taken).toContain("background: var(--gray-bg)");
    expect(taken).toContain("opacity: 0.55");
    // A row-level grayscale(1) is exactly the bug: it takes the chip with it.
    expect(taken).not.toContain("grayscale");
    expect(rows).toContain(".srow.taken .ic,\n  .srow.taken .mid {\n    filter: grayscale(1);\n  }");
  });

  it("the wins chip keeps its rung at the dead players' own saturation", () => {
    expect(rows).toContain(".srow.taken .val.warchip {\n    filter: saturate(0.7);\n  }");
  });
});

describe("the help sheet's MGR chip and skipper specimen", () => {
  const help = read("components/HelpModal.svelte");

  it("MGR steps off the batter/pitcher split into warm gray", () => {
    expect(help).toContain('<span class="pos mgr">MGR</span>');
    const mgr = help.match(/\.pos\.mgr \{[^}]*\}/)?.[0] ?? "";
    expect(mgr).toContain("var(--gray-bg)");
    expect(mgr).toContain("var(--gray-ink)");
  });

  it("the front-office specimen's skipper wears a rung chip, not plain type", () => {
    // Without the tier the specimen drew "7.2WINS" as bare text while the
    // caption promised a chip. One mapping: the engine's own warTier.
    expect(help).toContain("tier: warTier(MGR_WINS)");
  });
});

describe("the seed capsule is the field", () => {
  const home = read("components/Home.svelte");

  it("the input draws no box of its own inside the pill", () => {
    // Anchored at the line start: `.seedrow.bad .seedin {` matches a bare
    // `.seedin {` substring search and sits earlier in the file.
    const seedin = home.match(/\n  \.seedin \{[^}]*\}/)?.[0] ?? "";
    expect(seedin).toContain("border: none");
    expect(seedin).toContain("background: transparent");
  });

  it("focus and the bad-code state report at the capsule's own border", () => {
    expect(home).toContain(".seedzone.open:focus-within {\n    border-color: var(--ink);");
    expect(home).toContain(".seedzone.bad {\n    border-color: var(--orange);");
  });
});

describe("the powerup lattice's phone tiers", () => {
  const pill = read("components/PowerupPill.svelte");
  const row = read("components/PowerupRow.svelte");

  it("carries the 390px tier that keeps 3+3 on real phones (iOS metric drift)", () => {
    expect(pill).toContain("@container (max-width: 390px)");
    expect(row).toContain("@container (max-width: 390px)");
    // Descending order: the narrower tier must be declared after the wider
    // one — equal specificity, source order decides which wins below 390.
    expect(pill.indexOf("@container (max-width: 390px)")).toBeGreaterThan(
      pill.indexOf("@container (max-width: 410px)"),
    );
  });
});

describe("the relocate grid holds ring clubs to one line", () => {
  const picker = read("components/TeamPicker.svelte");

  // The tiles joined the chipbox recipe (round 13): .pickopt sits in app.css's
  // shared selector group, which states the nowrap that holds code and medal
  // to one line, so neither picker declares a box model of its own.
  it("code and medal never wrap inside a tile (chipbox recipe's nowrap)", () => {
    const css = read("app.css");
    expect(css).toMatch(/\.chipbox,\n\.confirm,\n\.pickopt \{/);
    const recipe = css.match(/\.chipbox,\n\.confirm,\n\.pickopt \{[^}]*\}/s)?.[0] ?? "";
    expect(recipe).toContain("white-space: nowrap");
  });

  // The private 9px medal this suite once pinned existed for 7-column
  // divisional grids; splitDivision retired those (max 4 columns), so the
  // relocate sheet reads app.css's shared `.pickopt .pedi` — the SEASON
  // TICKET sheet's exact size and margin (owner call, round 13). No raise:
  // the medal is a bare flex item the tile's chipbox centers.
  it("the medal is the shared rule — no private size in either picker", () => {
    expect(picker).not.toMatch(/\.pickopt \.pedi \{/);
    expect(read("components/YearPicker.svelte")).not.toMatch(/\.pickopt \.pedi \{/);
    const shared = read("app.css").match(/\.pickopt \.pedi \{[^}]*\}/)?.[0] ?? "";
    expect(shared).toContain("font-size: 11px");
    expect(shared).toContain("margin-left: 3px");
    expect(shared).not.toContain("vertical-align");
  });
});

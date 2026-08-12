/** The tracking-leak manifest — coverage enforcement for one bug class.
 *
 * THE CLASS. `letter-spacing` adds its step after EVERY glyph including the
 * last, so a tracked run's box extends one step past its final ink. Centered
 * or right-aligned, that phantom step seats the ink a half-step off; beside
 * a flex gap it inflates the designed gap. The app's repairs, by geometry
 * (app.css's `.warchip .unit` carries the founding measurements):
 *   - giveback-margin   `margin-inline-end: -<track>` on the label/self
 *   - giveback-padding  start padding of one step on a centered container
 *   - zeroed            `letter-spacing: 0` at an emoji glyph (one grapheme
 *                       cluster — tracking spaces nothing inside it)
 *   - immune-left       left-aligned: the step trails into open space
 *   - accepted          sub-visible or structurally unreachable, with the
 *                       reason stated
 *
 * THE ENFORCEMENT. Every `letter-spacing` declaration in the app must appear
 * in the manifest below with a classification. Add a tracked label without
 * classifying it and this test fails — the failure message is the doctrine
 * pointer. Remove or move one and the stale manifest row fails the other
 * direction. The manifest key is `file :: value`, counted: a file may state
 * one track value in several rules (media re-statements), so each row pins
 * how many declarations of that value the file may hold.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

/** Every letter-spacing declaration in the app's styles, as `file :: value`
 * with a count. Svelte components contribute their <style> blocks; app.css
 * contributes whole. */
function scan(): Map<string, number> {
  const found = new Map<string, number>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".svelte") || e.name.endsWith(".css")) {
        const text = fs.readFileSync(p, "utf8");
        const rel = path.relative(SRC, p);
        for (const m of text.matchAll(/letter-spacing:\s*([^;]+);/g)) {
          const key = `${rel} :: ${m[1].trim()}`;
          found.set(key, (found.get(key) ?? 0) + 1);
        }
      }
    }
  };
  walk(SRC);
  return found;
}

/** file :: value  →  [declaration count, classification — the reason a
 * reader needs, not just the label]. */
const MANIFEST: Record<string, [number, string]> = {
  // ---- app.css ----
  "app.css :: 0.04em": [2,
    "btnrow .btn (giveback-margin on its .chiplbl; .bic zeroed) and .confirm — giveback where centered"],
  "app.css :: 0.05em": [1, "warchip .unit — giveback-margin, the founding rule"],
  "app.css :: 0.1em": [1, ".newchip — giveback-margin on its .chiplbl"],
  "app.css :: 0.14em": [1, ".psep — immune-left (label leads, rule line trails)"],
  "app.css :: 0": [1, ".bic — zeroed at the glyph"],
  // ---- components ----
  "components/Home.svelte :: 0.04em": [4,
    ".chip/.pill (giveback-margin on .chiplbl), .playbtn (giveback + .bic zeroed), .ubtn (accepted: bare text node, step pads gap invisibly; .bic zeroed covers centering)"],
  "components/Home.svelte :: 0.05em": [1, ".rmeta.caps narrow — giveback-margin (right-aligned)"],
  "components/Home.svelte :: 0.08em": [2, ".rmeta.caps (giveback-margin, right-aligned), .seedin (giveback-padding, centered input)"],
  "components/Home.svelte :: 0.03em": [1, ".seedin narrow — giveback-padding"],
  "components/Home.svelte :: 0.12em": [1, ".bcap — giveback-padding (centered card)"],
  "components/Home.svelte :: 0.1em": [2, ".bpts/.btotal — giveback-padding (centered card)"],
  "components/Finale.svelte :: 0.1em": [3,
    ".pedchip (accepted: borderless — no visible edge to center against), .tpts/.cpts (giveback-margin, flex-centered)"],
  "components/Finale.svelte :: 0.14em": [1, ".seedchip — giveback-padding (centered, mono)"],
  "components/Finale.svelte :: 0.05em": [1, ".qpos — immune-left (fixed type column)"],
  "components/Instructs.svelte :: 0.14em": [1, ".eyebrow — immune-left (callhead row)"],
  "components/Instructs.svelte :: 0.12em": [1, ".calltitle — immune-left"],
  "components/Instructs.svelte :: 0.08em": [1, ".playball — giveback-margin on its .chiplbl"],
  "components/Instructs.svelte :: 0.04em": [1, ".pplist names — immune-left (glyph gutter rag)"],
  "components/FinaleInstructs.svelte :: 0.14em": [1, ".eyebrow — immune-left"],
  "components/FinaleInstructs.svelte :: 0.12em": [1, ".calltitle — immune-left"],
  "components/FinaleInstructs.svelte :: 0.08em": [1, ".bow — giveback-margin on its .chiplbl"],
  "components/CornerButtons.svelte :: 0.04em": [1, ".undo.armed — giveback-margin on its .chiplbl"],
  "App.svelte :: 0.04em": [1, ".quit.armed — giveback-margin on its .chiplbl"],
  "components/MakerLink.svelte :: 0.08em": [1, ".maker — giveback-margin on its .chiplbl (last flex item)"],
  "components/Pill.svelte :: 0.06em": [1, ".pill — giveback-margin on direct .chiplbl children"],
  "components/Pill.svelte :: 0": [1, ".pill .ico — zeroed at the glyph"],
  "components/HelpModal.svelte :: 0.03em": [2,
    ".tourbtn and legend grid — accepted: ≤0.15px off-center at their sizes"],
  "components/HelpModal.svelte :: 0.04em": [2,
    ".lgnd .lt and .klbl — accepted: 8.5px caps, 0.17px off-center"],
  "components/PlayerList.svelte :: 0.04em": [1, ".more — giveback-padding (centered chip)"],
  "components/PowerupPill.svelte :: 0.04em": [1,
    "accepted: the track participates in the pill's width-fit measurement (see the scrollWidth note there); a give-back would skew the fit"],
  "components/PowerupPill.svelte :: 0.02em": [1, "shrink stage — accepted with the base rule"],
  "components/PowerupPill.svelte :: 0.01em": [1, "shrink stage — accepted with the base rule"],
  "components/PrimePicker.svelte :: 0.03em": [1, ".pos — accepted: ≤0.15px at 9.5px"],
  "components/PrimePicker.svelte :: 0.01em": [1, ".pos.long — accepted with .pos"],
  "components/RailSeat.svelte :: 0.07em": [2, ".cell b / .mgr b — giveback-padding (centered labels)"],
  "components/RailSeat.svelte :: 0.05em": [1, "wide .cell b / .mgr b — immune-left (the finale .qpos register, fixed type column)"],
  "components/SeasonsModal.svelte :: 0.02em": [1, ".mode — accepted: sub-pixel"],
  "components/Sheet.svelte :: 0.08em": [1, ".title — giveback-padding (every sheet's centered header)"],
  "components/RosterRail.svelte :: 0.05em": [1,
    ".ppos — immune-left (the peek's fixed label lane, Finale's .qpos re-cut)"],
  "components/SpinBanner.svelte :: 0.04em": [1, ".retry — giveback-padding (centered bare text)"],
  "components/TeamPicker.svelte :: 0.04em": [1,
    ".teambtn — accepted: 0.2px at 9.5px, and the tile sometimes ends in a medal whose own side air dominates"],
  "components/PillSlot.svelte :: normal": [1, "reset to the page's default — no track, no leak"],
  "components/MarketRow.svelte :: 0.03em": [1, "row caps — immune-left"],
  "components/MarketRow.svelte :: 0.01em": [1, "row meta — immune-left"],
  "components/TrophyModal.svelte :: 0.03em": [2,
    "case captions — accepted: 0.27em-box excess is 0.14px off-center at 9px, below one device pixel at 3x"],
};

describe("the tracking-leak manifest", () => {
  const found = scan();
  const expected = new Map(
    Object.entries(MANIFEST)
      .filter(([, [n]]) => n > 0)
      .map(([k, [n]]) => [k, n]),
  );

  it("every letter-spacing declaration in src is classified here", () => {
    const unclassified = [...found].filter(([k]) => !expected.has(k));
    expect(
      unclassified,
      `New tracked label(s) without a leak classification. letter-spacing adds ` +
        `a step after the LAST glyph too — centered/right-aligned ink seats a ` +
        `half-step off. Fix per app.css's .warchip .unit doctrine (giveback ` +
        `margin/padding, or zero at an emoji glyph), then add the row here.`,
    ).toEqual([]);
  });

  it("no manifest row has gone stale", () => {
    const stale = [...expected].filter(([k, n]) => found.get(k) !== n);
    expect(
      stale.map(([k, n]) => `${k} (manifest ${n}, found ${found.get(k) ?? 0})`),
      "Tracked labels moved or changed count — update the manifest with the new truth.",
    ).toEqual([]);
  });
});

describe("the give-backs the manifest promises still exist", () => {
  const read = (f: string) => fs.readFileSync(path.join(SRC, f), "utf8");

  it(".bic and .pill .ico zero tracking at the glyph", () => {
    expect(read("app.css")).toMatch(/\.bic\s*\{[^}]*letter-spacing:\s*0;/s);
    const pill = read("components/Pill.svelte");
    expect(pill).toContain("letter-spacing: 0;");
    expect(pill).toContain("margin-inline-end: -0.06em;");
  });

  it("the founding rule and the chip give-backs stand", () => {
    const css = read("app.css");
    expect(css).toContain("margin-inline: 2.5px -0.05em;");
    expect(css).toMatch(/\.newchip \.chiplbl\s*\{[^}]*margin-inline-end:\s*-0\.1em/s);
    expect(css).toMatch(/\.btnrow \.btn \.chiplbl\s*\{[^}]*margin-inline-end:\s*-0\.04em/s);
  });

  it("the armed confirm words are given back", () => {
    expect(read("App.svelte")).toMatch(/\.quit\.armed \.chiplbl\s*\{[^}]*-0\.04em/s);
    expect(read("components/CornerButtons.svelte")).toMatch(
      /\.undo\.armed \.chiplbl\s*\{[^}]*-0\.04em/s,
    );
  });
});

describe("the compositor doctrine on svg-faced pills", () => {
  const read = (f: string) => fs.readFileSync(path.join(SRC, f), "utf8");

  /** The pushed/disabled dims ride color channels; element opacity, animated
   * transforms and resting z-index are the three layer-churn triggers that
   * made these pills hop (rounds 37–38). The rules may not regain them. */
  const block = (src: string, sel: string) => {
    const i = src.indexOf(sel);
    expect(i, `${sel} must exist`).toBeGreaterThan(-1);
    // Comments stripped: the doctrine comments NAME the banned properties.
    return src.slice(i, src.indexOf("}", i)).replace(/\/\*[\s\S]*?\*\//g, "");
  };

  it(".help.pushed dims through channels and slides through margin", () => {
    const b = block(read("components/CornerButtons.svelte"), ".help.pushed {");
    expect(b).toContain("--pill-fill: color-mix");
    expect(b).toContain("margin-right: 28px");
    expect(b).not.toMatch(/\bopacity:/);
    expect(b).not.toMatch(/\btransform:/);
    expect(b).not.toMatch(/\bz-index:/);
  });

  it(".quit.pushed dims through channels and nothing else", () => {
    const b = block(read("App.svelte"), ".quit.pushed {");
    expect(b).toContain("--pill-fill: color-mix");
    expect(b).not.toMatch(/\bopacity:/);
    expect(b).not.toMatch(/\btransform:/);
    expect(b).not.toMatch(/\bz-index:/);
  });

  it(".undo:disabled still pre-mixes over --ground", () => {
    const b = block(read("components/CornerButtons.svelte"), ".undo:disabled {");
    expect(b).toContain("color-mix(in srgb, var(--card) 65%");
    expect(b).not.toMatch(/\bopacity:/);
  });
});

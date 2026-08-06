/** THE CHIP BOX — source-text pins for how a small pill centers its type.
 *
 * Same idiom as rounds 30/31/32: anchored substring/regex pins on the shipped
 * source, so a refactor that silently drops a decision fails loud and cheap.
 *
 * What is being held here is a MECHANISM, not a measurement. Chip text used to
 * be placed by font arithmetic — a documented 0.047 × font-size of extra
 * padding above the caps — and that number lands at full measure in a
 * padding-driven box, at half measure in a box that pins a height and centers
 * inside it, and at nothing in a box a flex parent stretches. Six surfaces drew
 * the same chip through three of those box models, so every fix to one was a
 * regression somewhere else. These pins say the arithmetic is gone and the
 * geometry is what is left.
 *
 * The constant that remains is a FALLBACK, and it is only ever right on one
 * engine: WebKit and Blink place a baseline inside a flex item's strut
 * differently, so a number tuned in Chrome renders half a pixel high in
 * Safari. Where `text-box: trim-both cap alphabetic` exists the engine
 * measures the cap band instead — but only on a BLOCK CONTAINER, so each
 * chip's text run is wrapped in a `.chiplbl` element and the trim goes there.
 * The two halves of that trade are pinned by ONE regex on purpose: zeroing the
 * padding without applying the trim is the exact failure this saga started as.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (f: string) =>
  fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../src/${f}`),
    "utf8",
  );

const css = read("app.css");

/** The bodies of every rule whose selector list names `sel`, in source order.
 * Anchored to the start of a line so `.warchip` never matches `.warchip.sm`. */
function blocks(source: string, sel: string): string[] {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\n[ ]*${esc}[ ,][^{}]*\\{([^}]*)\\}`, "g");
  const found = [...source.matchAll(re)].map((m) => m[1]);
  if (found.length === 0) throw new Error(`no rule for ${sel}`);
  return found;
}
const block = (source: string, sel: string) => blocks(source, sel)[0];

describe("app.css holds one chip recipe", () => {
  const base = block(css, ".chipbox");

  it("centers geometrically: inline-flex, both axes, its own leading", () => {
    expect(base).toContain("display: inline-flex;");
    expect(base).toContain("align-items: center;");
    expect(base).toContain("justify-content: center;");
    expect(base).toContain("line-height: 1;");
  });

  it("states its own typeface, so a surface cannot lend it one", () => {
    // `.disp` is applied per surface, never at the root. A chip that inherited
    // its family rendered in Nunito inside a sheet and in the body's
    // -apple-system on the finale — two sets of metrics under one set of
    // hand-tuned paddings, which is what put the finale's NEW chip off center
    // while the identical chip in the trophy case sat right.
    expect(base).toContain("font-family: var(--disp);");
  });

  it("takes its height from the chip, not from the contents or the parent", () => {
    expect(base).toContain("height: var(--chip-h);");
    // Box-sizing is border-box globally, so a stated height includes the ring.
    expect(css).toContain("box-sizing: border-box;");
  });

  it("spends the optical correction once, in em, at the half gain", () => {
    // Nunito's cap band rides 0.0235em above a line box's middle. In the one
    // box model the recipe enforces — pinned height, flex-centered — top
    // padding moves content by HALF its measure, so the recipe's single
    // 0.047em pair seats the caps exactly on center. Em, not px: it scales
    // with each chip's own type. No consumer may spend a second one.
    expect(base).toContain("padding-block: 0.047em 0;");
  });

  it("reaches .confirm by selector, whose markup this file cannot edit", () => {
    expect(css).toMatch(/\.chipbox,\n\.confirm \{/);
  });

  it("gives a chip's text run a block box the engine's trim can reach", () => {
    // text-box trims the first and last line boxes of a BLOCK CONTAINER. Bare
    // text in a chip is an ANONYMOUS flex item — no selector reaches it — so
    // the trim set on the chip itself is a silent no-op. `.chiplbl` is the
    // element the runs live in.
    expect(block(css, ".chiplbl")).toContain("display: block;");
  });

  it("trades the constant for the engine's measurement atomically", () => {
    // ONE regex, deliberately. The half-ship — padding retired, trim applied
    // to a box that cannot take it — is what shipped the miscentering this
    // whole saga started with, and two separate assertions would let it back.
    expect(css).toMatch(
      /@supports \(text-box: trim-both cap alphabetic\) \{\s*\.chipbox,\s*\.confirm \{\s*padding-block: 0;\s*\}\s*\.chiplbl \{\s*text-box: trim-both cap alphabetic;\s*\}\s*\}/,
    );
  });
});

describe("no chip is centered by hand-tuned padding", () => {
  /* The tell is a vertical padding pair written to a hundredth of a pixel:
     `padding: 4.28px 12px 3.72px`. It means someone measured a baseline offset
     and paid it out of the box — the mechanism whose gain depends on which
     container the chip landed in. */
  const handTuned = /padding(?:-block)?:\s*\d+\.\d+px[^;]*;/g;

  const recipes: [string, string][] = [
    ["app.css .newchip", block(css, ".newchip")],
    ["app.css .confirm", blocks(css, ".confirm").at(-1)!],
    ["app.css .btnrow .btn", block(css, ".btnrow .btn")],
    ["Pill.svelte", read("components/Pill.svelte")],
    ["AwardPill.svelte", read("components/AwardPill.svelte")],
  ];

  for (const [name, source] of recipes) {
    it(`${name} carries none`, () => {
      expect(source.match(handTuned) ?? []).toEqual([]);
    });
  }

  it("the market/help hint pill carries none either", () => {
    // The specimen's hint is MarketRow's `.confirm.hint` now (the help sheet
    // draws no confirm of its own). It rides the shared .confirm chip box
    // from app.css — colors only, no box properties — so no measured
    // vertical pair survives anywhere.
    const row = read("components/MarketRow.svelte");
    expect(row.match(handTuned) ?? []).toEqual([]);
    const at = row.indexOf(".confirm.hint {");
    expect(at).toBeGreaterThan(-1);
    const hintBlock = row.slice(at, row.indexOf("}", at));
    expect(hintBlock).not.toContain("padding");
    expect(hintBlock).not.toContain("border-radius");
  });

  it("the WAR chip is the one recipe still allowed one, and says why", () => {
    // Its 26.275px is reserved by rows this recipe cannot reach, and it is
    // padding-driven and auto-height — the one box model the arithmetic is
    // true for. The rule block at the top of app.css names it as the exception,
    // so the exception cannot quietly become the pattern again.
    expect(block(css, ".warchip")).toContain("padding-block: 0.635px 0;");
    expect(css).toContain("`.warchip` is the one recipe that still spends the correction");
  });
});

describe("every chip states a whole number of pixels for its height", () => {
  /* A 15.5px border box ends on half of a device pixel at 2× and 3×, and a
     border painted across half a pixel fades rather than draws — which is what
     "the award pill's outline is cut off top and bottom" was. */
  const stated = [
    ...css.matchAll(/--chip-h:\s*([^;]+);/g),
    ...read("components/Pill.svelte").matchAll(/--chip-h:\s*([^;]+);/g),
    ...read("components/AwardPill.svelte").matchAll(/--chip-h:\s*([^;]+);/g),
    ...read("components/Finale.svelte").matchAll(/--chip-h:\s*([^;]+);/g),
  ].map((m) => m[1].trim());

  it("finds them", () => {
    expect(stated.length).toBeGreaterThanOrEqual(6);
  });

  for (const h of new Set(stated)) {
    it(`${h} is whole`, () => {
      expect(h).toMatch(/^\d+px$/);
    });
  }
});

describe("the surfaces the symptoms were reported on draw through the recipe", () => {
  it("the NEW chip is a chip, on the finale and in the trophy case alike", () => {
    // One component, two surfaces: the same markup renders in the finale's
    // badge strip and on the collectibles sheet, so the chip cannot be right in
    // one place and wrong in the other unless something is inherited.
    expect(read("components/Pill.svelte")).toContain(
      '<span class="chipbox newchip"><span class="chiplbl">NEW</span></span',
    );
    expect(read("components/Pill.svelte")).toContain('class="chipbox pill {hook}');
    expect(block(css, ".newchip")).toContain("--chip-h: 12px;");
  });

  it("the ledger's pedigree chips are chips, so their ×N is centered on the glyph", () => {
    const fin = read("components/Finale.svelte");
    expect(fin).toContain('<span class="chipbox pedchip"');
    expect(block(fin, ".pedchip")).toContain("--chip-h: 18px;");
    // No leading of its own to give the small multiplier a taller line box
    // than the ring beside it.
    expect(block(fin, ".pedchip")).not.toContain("line-height");
  });
});

describe("every run of type inside a chip is wrapped in .chiplbl", () => {
  /* The trim is only as complete as the wrapping: the @supports branch zeroes
     the padding for EVERY chip at once, so a text run left bare loses the
     correction on exactly the engines the branch was written for. Unwrapped
     runs raise no build warning — `.chiplbl` lives in app.css, which no
     component's scoped CSS audits — so the coverage is pinned here instead. */

  it("Pill wraps its NEW word, its label, its count and its placeholder", () => {
    const pill = read("components/Pill.svelte");
    expect(pill).toContain('<span class="chiplbl">NEW</span>');
    expect(pill).toContain('class="name chiplbl"');
    expect(pill).toContain('class="count chiplbl"');
    expect(pill).toContain('<span class="chiplbl" aria-hidden="true">? ? ?</span>');
    // The flag is not type. It carries no cap band, and under the trim branch
    // the chip's padding is zero, so the box alone centers it.
    expect(pill).toContain('class="ico">{emoji}</span');
  });

  it("AwardPill splits its medal off the word, and wraps both the word and ×N", () => {
    // "🥇MVP" is one string in the registry: an emoji glyph and a cap-band
    // word. Trimmed together the glyph would be measured as part of the band.
    const award = read("components/AwardPill.svelte");
    expect(award).toContain("{#if medal}<span>{medal}</span>{/if}");
    expect(award).toContain('<span class="chiplbl">{word}</span>');
    expect(award).toContain('class="mult chiplbl"');
  });

  it("the ledger's pedigree chip wraps its ×N and leaves the emoji bare", () => {
    expect(read("components/Finale.svelte")).toContain('class="mult chiplbl"');
  });

  it("every .confirm pill in the game wraps its label", () => {
    // Per-pill adjacency: each confirm's own markup must carry a .chiplbl
    // within the next few hundred characters, so a new confirm added without
    // a label wrapper fails here rather than shipping a run the trim cannot
    // reach. Adjacency rather than count-equality because .chiplbl is not
    // confirm-exclusive — the market's position chips wrap their labels too,
    // and a file-wide tally would let one naked confirm hide behind one of
    // those. `class="confirm` only ever matches markup: the styles reference
    // the class as a selector, never as an attribute.
    for (const f of [
      "components/PlayerList.svelte",
      "components/SpecialRows.svelte",
      "components/PrimePicker.svelte",
      "components/SpecialPrimePicker.svelte",
      // The market/help hint pill lives in MarketRow now; HelpModal draws no
      // confirm of its own any more.
      "components/MarketRow.svelte",
    ]) {
      const src = read(f);
      const pills = src.split('class="confirm').slice(1);
      expect(pills.length, `${f} draws confirm pills`).toBeGreaterThan(0);
      for (const seg of pills)
        expect(
          seg.slice(0, 400).includes('class="chiplbl"'),
          `${f}: a confirm pill without a .chiplbl label`,
        ).toBe(true);
    }
  });
});

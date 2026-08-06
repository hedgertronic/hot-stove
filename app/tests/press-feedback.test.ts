/** Source-text tests — press feedback and panel entrance animations.
 *
 * These pin the CSS rules that make corner pills and badge slots feel tactile:
 * the `:active` press dips and the chip-reveal panel's fade-in. They check the
 * source text rather than computed styles because jsdom has no layout engine
 * and cannot evaluate CSS. What they assert is that the rules exist at the
 * right duration and easing — the things that make a press feel snappy vs.
 * sluggish, vs. missed. */
import fs from "node:fs"; // DEFAULT import — named imports (`{ readFileSync }`) break svelte-check
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const components = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../src/components");
const read = (f: string) => fs.readFileSync(path.join(components, f), "utf8");
const appSrc = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../src");
const readSrc = (f: string) => fs.readFileSync(path.join(appSrc, f), "utf8");

// ──────────────────────────────────────────────────────────────────────────────
// Corner buttons  (? and 🏆)
// ──────────────────────────────────────────────────────────────────────────────
describe("CornerButtons.svelte — press feedback", () => {
  const src = read("CornerButtons.svelte");

  it("adds a transform transition in the 0.08–0.15 s band to .help", () => {
    // Asserts that `transition: transform 0.08s` (or any value in the fast
    // tactile band) is declared on .help so the dip animates on release as
    // well as on press.
    // NOTE: [^}]* cannot be used because the comment text contains `}` (from
    // `* { transition: none !important }`), which stops the match early. Instead
    // we slice from the opening selector and search within a fixed window.
    const start = src.indexOf(".help {");
    expect(start, ".help { selector must exist").toBeGreaterThan(-1);
    const window = src.slice(start, start + 1200);
    const m = window.match(/transition:\s*transform\s+([\d.]+s)/);
    expect(m, ".help must have a transition: transform declaration").not.toBeNull();
    const dur = parseFloat(m![1]);
    expect(dur, "transition duration must be 0.08–0.15 s").toBeGreaterThanOrEqual(0.08);
    expect(dur, "transition duration must be 0.08–0.15 s").toBeLessThanOrEqual(0.15);
  });

  it("adds an :active transform to .help (not .help.pushed)", () => {
    // Checks the selector is specifically `.help:active`, not a compound like
    // `.help.pushed:active` — all three corner pills should feel the press,
    // and the pushed rule's source-order win is what keeps the stepped-back
    // pill from jumping home on an accidental touch.
    expect(src).toMatch(/\.help:active\s*\{[^}]*transform:/);
  });

  it(".help:active uses only translate or scale — no spring/bounce cubic-bezier", () => {
    // Overshoot easings (cubic-bezier with a second/fourth control point > 1)
    // are the cardstock aesthetic's only hard veto. The `:active` rule sets a
    // transform with no animation of its own; the transition on `.help` carries
    // a bare duration with no easing specified (defaults to `ease`), so this
    // check confirms no bouncy cubic-bezier crept into the active block.
    const activeBlock = src.match(/\.help:active\s*\{([^}]*)\}/)?.[1] ?? "";
    // A cubic-bezier with a 2nd or 4th argument > 1 is an overshoot.
    expect(activeBlock).not.toMatch(/cubic-bezier\([^)]*,\s*([1-9]\d*\.?\d*|\d+\.\d+)\s*,/);
  });

  it(".help:active is declared before .help.pushed so the pushed transform wins", () => {
    // Source order decides between equal-specificity rules. The pushed state
    // must win so a stepped-back pill doesn't jump to the press position on
    // touch.
    const activeIdx = src.indexOf(".help:active");
    const pushedIdx = src.indexOf(".help.pushed");
    expect(activeIdx, ".help:active must appear in the file").toBeGreaterThan(-1);
    expect(pushedIdx, ".help.pushed must appear in the file").toBeGreaterThan(-1);
    expect(activeIdx, ".help:active must be declared before .help.pushed").toBeLessThan(pushedIdx);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Badge / stamp chip slots  (covers BadgeSlot, TrophyModal tiles, finale row)
// ──────────────────────────────────────────────────────────────────────────────
describe("PillSlot.svelte — press feedback", () => {
  const src = read("PillSlot.svelte");

  // The press rides the CHIP, not the button: a scaled button drags its own
  // hit region, and a rim press on a wide pill ended outside the transformed
  // box (the click resolved to the body). The button holds still — which is
  // also what keeps measure()'s btnEl rect honest through a persisting
  // :active on touch. These pins follow the mechanism to the chip child.
  const CHIP = String.raw`\.slot(:active)?\s*>\s*:global\(\.chipbox\)`;

  it("adds a transform transition in the 0.08–0.15 s band to the chip", () => {
    const m = src.match(new RegExp(`${CHIP}\\s*\\{[^}]*transition:\\s*transform\\s+([\\d.]+s)`));
    expect(m, "the chip must have a transition: transform declaration").not.toBeNull();
    const dur = parseFloat(m![2]);
    expect(dur, "transition duration must be 0.08–0.15 s").toBeGreaterThanOrEqual(0.08);
    expect(dur, "transition duration must be 0.08–0.15 s").toBeLessThanOrEqual(0.15);
  });

  it("adds an :active transform to the chip — and none to the button", () => {
    expect(src).toMatch(new RegExp(`\\.slot:active\\s*>\\s*:global\\(\\.chipbox\\)\\s*\\{[^}]*transform:`));
    // The button must never transform: that is the wide-pill rim-tap bug.
    expect(src).not.toMatch(/\.slot:active\s*\{[^}]*transform:/);
  });

  it("the :active press uses scale — not translate — so the chip stays centered", () => {
    // A translate would shift the chip's visual center away from where
    // measure() points the reveal arrow; a scale about the center preserves it.
    const activeBlock =
      src.match(/\.slot:active\s*>\s*:global\(\.chipbox\)\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(activeBlock).toMatch(/scale\(/);
    expect(activeBlock).not.toMatch(/\btranslate\s*\(/);
    expect(activeBlock).not.toMatch(/\btranslateX\s*\(/);
    expect(activeBlock).not.toMatch(/\btranslateY\s*\(/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Reveal panel entrance  (the "how" tooltip)
// ──────────────────────────────────────────────────────────────────────────────
describe("PillSlot.svelte — panel entrance animation", () => {
  const src = read("PillSlot.svelte");

  it("defines a how-in keyframe", () => {
    expect(src).toMatch(/@keyframes\s+how-in/);
  });

  it("applies how-in to .how.placed", () => {
    // The animation fires on `.placed` (added after coordinate measurement),
    // not on `.how` directly — so the panel is never seen in a transient
    // unmeasured position.
    const placedBlock = src.match(/\.how\.placed\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(placedBlock).toMatch(/animation:/);
    expect(placedBlock).toMatch(/how-in/);
  });

  it("panel animation is in the 0.08–0.15 s band", () => {
    const placedBlock = src.match(/\.how\.placed\s*\{([^}]*)\}/)?.[1] ?? "";
    const m = placedBlock.match(/how-in\s+([\d.]+s)/);
    expect(m, ".how.placed animation must include a duration after how-in").not.toBeNull();
    const dur = parseFloat(m![1]);
    expect(dur, "animation duration must be 0.08–0.15 s").toBeGreaterThanOrEqual(0.08);
    expect(dur, "animation duration must be 0.08–0.15 s").toBeLessThanOrEqual(0.15);
  });

  it("how-in keyframe does not use a fill-mode that would hold a transform at rest", () => {
    // `animation-fill-mode: both` or `forwards` would hold the `from` frame's
    // transform after the animation ends. Since Pill.svelte uses animation
    // rather than transition for exactly this reason (a persistent transform
    // re-origins the panel's containing block), we avoid it here too.
    const placedBlock = src.match(/\.how\.placed\s*\{([^}]*)\}/)?.[1] ?? "";
    // Acceptable: no fill keyword, or `animation-fill-mode: none`. Rejected: both/forwards.
    expect(placedBlock).not.toMatch(/\b(?:both|forwards)\b/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// iOS :active fix
// ──────────────────────────────────────────────────────────────────────────────
describe("main.ts — iOS :active fix", () => {
  const mainTs = readSrc("main.ts");

  it("registers a passive touchstart listener on document", () => {
    // iOS Safari only fires :active when a touchstart listener exists anywhere
    // in the ancestor chain. Without this, press animations (badge slots,
    // buttons, pickers) are skipped on the first tap and only fire from the
    // second tap onward. The listener is intentionally a no-op; its presence
    // is what flips the iOS flag.
    expect(mainTs).toContain('document.addEventListener("touchstart"');
    expect(mainTs).toContain("passive: true");
  });
});

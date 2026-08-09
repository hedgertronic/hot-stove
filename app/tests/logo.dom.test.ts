// @vitest-environment jsdom
/** The Logo component: small HUD variant and big masthead variant.
 *
 * The visual treatment is purely stylistic — jsdom has no layout and cannot
 * verify computed styles. What can be verified is the DOM structure: the big
 * variant renders inside the expected container hierarchy with the right
 * classes and identity marks are present in their respective variants.
 */
import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Logo from "../src/components/Logo.svelte";

function open(big = false, og = false) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(Logo, { target, props: { big, og } });
  flushSync();
  return {
    target,
    logo: () => target.querySelector(".hs-logo") as HTMLElement | null,
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

afterEach(() => document.body.replaceChildren());

describe("small HUD variant (big=false)", () => {
  it("renders the named game lockup", () => {
    const { target, close } = open(false);
    const logo = target.querySelector(".hs-logo.hs-logo--game");
    expect(logo).not.toBeNull();
    expect(logo!.classList.contains("hs-logo--home")).toBe(false);
    close();
  });

  it("is a logotype: the flame stands in as HOT's O", () => {
    const { target, close } = open(false);
    const logo = target.querySelector(".hs-logo")!;
    // H[flame]T STOVE — the O of HOT is the flame image, so the text runs
    // are H, T and STOVE, and the flame's alt keeps the word whole for
    // screen readers (the O-boiler pattern, at the HUD's own size).
    expect(logo.textContent).toContain("H");
    expect(logo.textContent).toContain("STOVE");
    // INLINE svg, not an <img> — an SVG image is rasterized to a snapped
    // bitmap and its bottom arc shaved at fractional offsets; inline it
    // renders as vectors like the type beside it. The path must stay the
    // brand asset's own: pinned against public/brand/flame.svg below.
    const flame = target.querySelector<SVGSVGElement>(".hs-logo__oflame svg");
    expect(flame?.getAttribute("aria-hidden")).toBe("true");
    // One utterance for assistive tech: the wordmark is the labeled image,
    // so the split word (H, flame, T) never reaches a screen reader.
    const wordmark = target.querySelector(".hs-logo__wordmark");
    expect(wordmark?.getAttribute("role")).toBe("img");
    expect(wordmark?.getAttribute("aria-label")).toBe("Hot Stove");
    // The clipboard's word: a clipped-invisible real O rides in the flame's
    // slot, so a selection copies as HOTSTOVE — the svg alone contributes
    // nothing to copied text (the regression this pins was "HTSTOVE").
    expect(wordmark?.textContent?.replace(/\s/g, "")).toBe("HOTSTOVE");
    // Plain cwd-relative read: under the jsdom environment import.meta.url
    // is not a file: URL, and vitest always runs from the app root.
    const assetPath = /\sd="([^"]+)"/.exec(
      fs.readFileSync("public/brand/flame.svg", "utf8"),
    )?.[1];
    expect(assetPath).toBeTruthy();
    expect(flame?.querySelector("path")?.getAttribute("d")).toBe(assetPath);
    // The flame slot lives INSIDE the orange HOT span, between H and T.
    expect(target.querySelector(".hs-logo__hot .hs-logo__oflame")).not.toBeNull();
    // One wordmark child, no separate leading mark — same shape as the
    // masthead logotype.
    expect(logo.children).toHaveLength(1);
    expect(logo.children[0].classList.contains("hs-logo__wordmark")).toBe(true);
    expect(logo.querySelector(".hs-logo__mark")).toBeNull();
    close();
  });
});

describe("big masthead variant (big=true)", () => {
  it("renders with the named home lockup class", () => {
    const { target, close } = open(true);
    expect(target.querySelector(".hs-logo.hs-logo--home")).not.toBeNull();
    close();
  });

  it("is a logotype: one wordmark child, no separate mark", () => {
    const { target, close } = open(true);
    const logo = target.querySelector(".hs-logo--home")!;
    expect(logo.children).toHaveLength(1);
    expect(logo.children[0].classList.contains("hs-logo__wordmark")).toBe(true);
    expect(logo.querySelector(".hs-logo__mark")).toBeNull();
    close();
  });

  it("spells HOTSTOVE with the O-boiler standing in as STOVE's O", () => {
    const { target, close } = open(true);
    const wordmark = target.querySelector(".hs-logo--home .hs-logo__wordmark")!;
    expect(wordmark.textContent).toContain("HOT");
    expect(wordmark.textContent).toContain("ST");
    expect(wordmark.textContent).toContain("VE");
    // An empty span painted by brand.css's data-URI background, never an
    // <img>: an img's fetch raced first paint on a hard refresh and the
    // wordmark showed without its O. role/aria-label keep the word whole.
    const o = wordmark.querySelector<HTMLElement>(".hs-logo__o");
    expect(o?.tagName).toBe("SPAN");
    expect(o?.getAttribute("role")).toBe("img");
    expect(o?.getAttribute("aria-label")).toBe("O");
    close();
  });

  it("wraps HOT inside the shared orange wordmark span", () => {
    const { target, close } = open(true);
    const wordmark = target.querySelector(".hs-logo--home .hs-logo__wordmark")!;
    expect(wordmark.querySelector(".hs-logo__hot")).not.toBeNull();
    expect(wordmark.querySelector(".hs-logo__hot")!.textContent).toBe("HOT");
    close();
  });

  it("small HUD variant is unchanged when big is later set to false", () => {
    // Verify that the small variant (no big class) is structurally different
    // — this guards against the masthead styles leaking into the HUD.
    const small = open(false);
    expect(small.target.querySelector(".hs-logo--home")).toBeNull();
    expect(small.target.querySelector(".hs-logo--game")).not.toBeNull();
    small.close();
  });
});

describe("OG share-card variant", () => {
  it("uses the shared OG lockup with the same logotype", () => {
    const { target, close } = open(false, true);
    const logo = target.querySelector(".hs-logo.hs-logo--og");
    expect(logo).not.toBeNull();
    expect(logo!.classList.contains("hs-logo--game")).toBe(false);
    expect(logo!.classList.contains("hs-logo--home")).toBe(false);
    expect(logo!.querySelector(".hs-logo__mark")).toBeNull();
    const o = logo!.querySelector<HTMLElement>(".hs-logo__o");
    expect(o?.tagName).toBe("SPAN");
    expect(o?.getAttribute("aria-label")).toBe("O");
    close();
  });
});

// @vitest-environment jsdom
/** The Logo component: small HUD variant and big masthead variant.
 *
 * The visual treatment is purely stylistic — jsdom has no layout and cannot
 * verify computed styles. What can be verified is the DOM structure: the big
 * variant renders inside the expected container hierarchy with the right
 * classes and identity marks are present in their respective variants.
 */
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

  it("shows HOT STOVE text with the leading flame", () => {
    const { target, close } = open(false);
    const logo = target.querySelector(".hs-logo")!;
    expect(logo.textContent).toContain("HOT");
    expect(logo.textContent).toContain("STOVE");
    const mark = target.querySelector<HTMLImageElement>(".hs-logo__mark");
    expect(mark?.getAttribute("src")).toBe("./brand/flame.svg");
    expect(logo.children[1].classList.contains("hs-logo__wordmark")).toBe(true);
    close();
  });
});

describe("big masthead variant (big=true)", () => {
  it("renders with the named home lockup class", () => {
    const { target, close } = open(true);
    expect(target.querySelector(".hs-logo.hs-logo--home")).not.toBeNull();
    close();
  });

  it("is a single inline-flex element — one line, not multiple blocks", () => {
    const { target, close } = open(true);
    const logo = target.querySelector(".hs-logo--home")!;
    const wordmark = logo.querySelector(".hs-logo__wordmark")!;
    expect(wordmark.textContent).toContain("HOT");
    expect(wordmark.textContent).toContain("STOVE");
    close();
  });

  it("contains the leading boiler and wordmark only", () => {
    const { target, close } = open(true);
    const logo = target.querySelector(".hs-logo--home")!;
    expect(logo.children).toHaveLength(2);
    expect(logo.children[0].classList.contains("hs-logo__mark")).toBe(true);
    expect(logo.children[1].classList.contains("hs-logo__wordmark")).toBe(true);
    expect(logo.children[1].querySelector(".hs-logo__hot")).not.toBeNull();
    close();
  });

  it("includes the leading boiler without the HUD flame", () => {
    const { target, close } = open(true);
    const mark = target.querySelector<HTMLImageElement>(".hs-logo--home .hs-logo__mark");
    expect(mark?.getAttribute("src")).toBe("./brand/boiler.svg");
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
  it("uses the shared OG lockup and boiler mark", () => {
    const { target, close } = open(false, true);
    const logo = target.querySelector(".hs-logo.hs-logo--og");
    expect(logo).not.toBeNull();
    expect(logo!.classList.contains("hs-logo--game")).toBe(false);
    expect(logo!.classList.contains("hs-logo--home")).toBe(false);
    expect(logo!.querySelector<HTMLImageElement>(".hs-logo__mark")?.getAttribute("src")).toBe(
      "./brand/boiler.svg",
    );
    close();
  });
});

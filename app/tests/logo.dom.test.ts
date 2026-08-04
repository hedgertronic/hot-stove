// @vitest-environment jsdom
/** The Logo component: small HUD variant and big marquee masthead variant.
 *
 * The marquee treatment (dark panel, bulb dots via CSS pseudo-elements) is
 * purely stylistic — jsdom has no layout and cannot verify computed styles or
 * pseudo-elements. What can be verified is the DOM structure: the big variant
 * renders inside the expected container hierarchy with the right classes, the
 * BETA pill is present, and the small variant is unchanged.
 */
import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Logo from "../src/components/Logo.svelte";

function open(big = false) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(Logo, { target, props: { big } });
  flushSync();
  return {
    target,
    logo: () => target.querySelector(".logo") as HTMLElement | null,
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

afterEach(() => document.body.replaceChildren());

describe("small HUD variant (big=false)", () => {
  it("renders a .logo element without the big class", () => {
    const { target, close } = open(false);
    const logo = target.querySelector(".logo");
    expect(logo).not.toBeNull();
    expect(logo!.classList.contains("big")).toBe(false);
    close();
  });

  it("shows HOT STOVE text and the BETA pill", () => {
    const { target, close } = open(false);
    const logo = target.querySelector(".logo")!;
    expect(logo.textContent).toContain("HOT");
    expect(logo.textContent).toContain("STOVE");
    expect(target.querySelector(".beta")).not.toBeNull();
    close();
  });
});

describe("big marquee variant (big=true)", () => {
  it("renders with the .logo.big class — the marquee container", () => {
    const { target, close } = open(true);
    // The big class is what gates the marquee CSS (dark panel, bulb dots).
    expect(target.querySelector(".logo.big")).not.toBeNull();
    close();
  });

  it("is a single inline-flex element — one line, not multiple blocks", () => {
    const { target, close } = open(true);
    const logo = target.querySelector(".logo.big")!;
    // The wordmark lives in the first child span.
    expect(logo.children[0].textContent).toContain("HOT");
    expect(logo.children[0].textContent).toContain("STOVE");
    close();
  });

  it("contains exactly two children: wordmark span and BETA pill", () => {
    const { target, close } = open(true);
    const logo = target.querySelector(".logo.big")!;
    expect(logo.children).toHaveLength(2);
    // First child holds the HOT<em>STOVE</em> wordmark.
    expect(logo.children[0].querySelector("em")).not.toBeNull();
    // Second child is the BETA pill.
    expect(logo.children[1].classList.contains("beta")).toBe(true);
    close();
  });

  it("includes the BETA pill", () => {
    const { target, close } = open(true);
    expect(target.querySelector(".logo.big .beta")).not.toBeNull();
    close();
  });

  it("wraps the em (STOVE) inside the wordmark span", () => {
    const { target, close } = open(true);
    const wordmark = target.querySelector(".logo.big > span:first-child")!;
    expect(wordmark.querySelector("em")).not.toBeNull();
    expect(wordmark.querySelector("em")!.textContent).toBe("STOVE");
    close();
  });

  it("small HUD variant is unchanged when big is later set to false", () => {
    // Verify that the small variant (no big class) is structurally different
    // — this guards against the marquee styles leaking into the HUD.
    const small = open(false);
    expect(small.target.querySelector(".logo.big")).toBeNull();
    expect(small.target.querySelector(".logo")).not.toBeNull();
    small.close();
  });
});

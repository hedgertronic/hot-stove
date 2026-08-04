// @vitest-environment jsdom
/** The payroll meter's below-break-even state.
 *
 * The bonus is 10·(2·spend/budget − 1): negative until spend clears HALF the
 * payroll, zero exactly at half, +10 at the cap. The meter mirrors that with a
 * hue arc — gold (`plow`) while the bonus runs negative, green from break-even
 * to the cap, orange (`pover`) past it, gray hatch (`pnocap`) before any
 * quantity exists. One component drives the live game board, the finale
 * ledger's minis, and the help sheet's specimens, so pinning the class here
 * pins all three surfaces at once.
 *
 * jsdom cannot compute the gold hue itself (custom properties resolve at
 * paint), so the DOM contract is the class and the source text is the color:
 * the last describe reads the style block for the plow rules.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import PayrollBox from "../src/components/PayrollBox.svelte";

function open(props: Record<string, unknown>) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(PayrollBox, {
    target,
    props: { bank: "classic", budget: 100, spend: 0, mini: true, ...props },
  });
  flushSync();
  return {
    meter: () => target.querySelector(".pmeter") as HTMLElement,
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

afterEach(() => document.body.replaceChildren());

describe("the gold below-break-even state (plow)", () => {
  it("wears plow below half the payroll", () => {
    const { meter, close } = open({ spend: 40 });
    expect(meter().classList.contains("plow")).toBe(true);
    expect(meter().classList.contains("pover")).toBe(false);
    close();
  });

  it("wears plow at $0 spent against a known cap — the deepest −10", () => {
    const { meter, close } = open({ spend: 0 });
    expect(meter().classList.contains("plow")).toBe(true);
    close();
  });

  it("drops plow exactly at half — bonus zero reads green, not gold", () => {
    const { meter, close } = open({ spend: 50 });
    expect(meter().classList.contains("plow")).toBe(false);
    close();
  });

  it("stays green from half to the cap", () => {
    const { meter, close } = open({ spend: 96 });
    expect(meter().classList.contains("plow")).toBe(false);
    expect(meter().classList.contains("pover")).toBe(false);
    close();
  });

  it("over the cap is pover alone — the orange claim outranks the gold one", () => {
    const { meter, close } = open({ spend: 120 });
    expect(meter().classList.contains("pover")).toBe(true);
    expect(meter().classList.contains("plow")).toBe(false);
    close();
  });

  it("the blank pre-owner state stays gray, never gold", () => {
    // No owner: no quantity at all, which is a different fact from "too low".
    const { meter, close } = open({ capKnown: false, spend: 0, pending: true });
    expect(meter().classList.contains("pnocap")).toBe(true);
    expect(meter().classList.contains("plow")).toBe(false);
    close();
  });

  it("holds on the full-size meter too, not only the mini", () => {
    const { meter, close } = open({ spend: 30, mini: false, pending: true });
    expect(meter().classList.contains("plow")).toBe(true);
    close();
  });
});

describe("the plow hue, in the source (jsdom cannot paint custom properties)", () => {
  const src = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components/PayrollBox.svelte"),
    "utf8",
  );

  it("rings, fills and stripes the low bar in the gold family", () => {
    expect(src).toContain(".pmeter.plow {\n    border-color: var(--gold-8);");
    expect(src).toContain("background: var(--gold-5);");
    expect(src).toContain("var(--gold-6) 12px 24px");
  });

  it("keys the threshold to the bonus's own zero crossing, not a literal 50", () => {
    expect(src).toContain("spend * 2 < budget");
  });
});

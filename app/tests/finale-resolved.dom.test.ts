/** A restored finale opens already-resolved.
 *
 * The three-beat reveal — rows dealing out, the drumroll, the stamp popping
 * with its count-up and confetti — is the payoff for the game that produced it.
 * A reload is not that game. Re-watching it on every refresh turns the payoff
 * into a toll, so a finale restored from storage renders the settled state
 * directly, down the same branch `prefers-reduced-motion` already takes.
 *
 * Mounted, not SSR: the reveal lives in a client `$effect`, which svelte/server
 * never runs — an SSR string is the unrevealed state for every finale and could
 * not tell the two paths apart.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Finale from "../src/components/Finale.svelte";
import { finaleCeilingAbove } from "../src/lab/fixtures";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
// jsdom has no matchMedia; the component treats its absence as "motion is
// fine", which is what makes `resolved` the thing under test rather than the
// reduced-motion path standing in for it.
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
  setTimeout(() => cb(performance.now()), 0),
);

let host: HTMLElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any = null;
afterEach(() => {
  if (app) unmount(app);
  host?.remove();
  app = null;
  host = null;
});

function render(resolved: boolean): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = mount(Finale, {
    target: host,
    props: { game: finaleCeilingAbove(), onreplay: () => {}, onmodes: () => {}, resolved },
  });
  flushSync();
  return host;
}

describe("a restored finale", () => {
  it("renders settled on the first frame: every row, the stamp, the real numbers", () => {
    const el = render(true);
    const rows = el.querySelectorAll(".lrow");
    expect(rows.length).toBeGreaterThan(0);
    // Every ledger row is dealt, not none of them.
    expect([...rows].every((r) => r.classList.contains("show"))).toBe(true);
    const stamp = el.querySelector(".total-stamp");
    expect(stamp?.classList.contains("show")).toBe(true);
    // The counters are at their final values, not counting up from zero.
    expect(el.querySelector(".tamt")?.textContent).not.toBe("0–0");
    expect(el.querySelector(".tpts")?.textContent).not.toBe("0 PTS");
    expect(el.querySelector(".tpts")?.textContent).toContain(".");
  });

  it("leaves the brag pills visible rather than waiting on a beat that never comes", () => {
    const el = render(true);
    // This fixture earns at least one badge; the row exists and is populated.
    expect(el.querySelectorAll(".brags").length).toBe(1);
    expect(el.querySelectorAll(".brags button").length).toBeGreaterThan(0);
  });

  it("fires no confetti — the celebration already happened once", async () => {
    // canvas-confetti is imported dynamically inside the stamp beat, so the
    // beat not running is the whole assertion: jsdom has no canvas, and a real
    // call would surface here.
    const el = render(true);
    await Promise.resolve();
    expect(el.querySelector("canvas")).toBeNull();
  });

  it("a finale just earned still plays the reveal", () => {
    // The control: without the flag, nothing is shown on the first frame. If
    // this ever passes for the wrong reason — reduced motion, a changed
    // default — the assertions above stop meaning anything.
    const el = render(false);
    expect([...el.querySelectorAll(".lrow")].some((r) => r.classList.contains("show"))).toBe(false);
    expect(el.querySelector(".total-stamp")?.classList.contains("show")).toBe(false);
    expect(el.querySelector(".brags")).toBeNull();
  });
});

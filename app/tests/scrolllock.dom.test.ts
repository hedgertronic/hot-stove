// @vitest-environment jsdom
/** Scroll lock wiring: body must not scroll while any Sheet is mounted.
 *
 * The task specified `scrolllock.test.ts` but this repo routes DOM tests (those
 * that `mount` real Svelte components) to the jsdom vitest project via the
 * `*.dom.test.ts` naming convention. The dom project also sets
 * `resolve: { conditions: ["browser"] }` which routes `mount` to the client
 * build — without it the $effect in Sheet.svelte would not run and the lock
 * would never fire. The name change is the only way to run a component-mount
 * test in jsdom in this repo.
 *
 * We mount Sheet directly (via createRawSnippet) rather than a higher-level
 * modal (TrophyModal, HelpModal, etc.) so that the test proves Sheet's own
 * $effect wiring and not the specific modal's render logic. */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRawSnippet, flushSync, mount, unmount } from "svelte";
import Sheet from "../src/components/Sheet.svelte";

/** A minimal no-content snippet that satisfies Sheet's `children` prop. */
const emptyChildren = createRawSnippet(() => ({
  render: () => `<span></span>` }));

/** Tracked instances cleaned up in afterEach if a test fails mid-way. */
const openInstances: Array<ReturnType<typeof mount>> = [];
const openTargets: HTMLElement[] = [];

function openSheet(): { inst: ReturnType<typeof mount>; target: HTMLElement } {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const inst = mount(Sheet, {
    target,
    props: {
      onclose: () => {},
      label: "test sheet",
      children: emptyChildren } });
  flushSync();
  openInstances.push(inst);
  openTargets.push(target);
  return { inst, target };
}

function closeSheet(inst: ReturnType<typeof mount>, target: HTMLElement): void {
  const i = openInstances.indexOf(inst);
  if (i !== -1) {
    openInstances.splice(i, 1);
    openTargets.splice(i, 1);
  }
  unmount(inst);
  target.remove();
  flushSync();
}

beforeEach(() => {
  // Start each test from a clean slate: no sheets mounted, body unmodified.
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

afterEach(() => {
  // Clean up any sheets a failing test left open, so the count cannot leak
  // into the next test.
  while (openInstances.length > 0) {
    const inst = openInstances.pop()!;
    const target = openTargets.pop()!;
    unmount(inst);
    target.remove();
    flushSync();
  }
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

describe("scroll lock through Sheet", () => {
  it("open modal → body is locked", () => {
    const { inst, target } = openSheet();
    expect(document.body.style.overflow).toBe("hidden");
    closeSheet(inst, target);
  });

  it("open second modal → still locked", () => {
    const first = openSheet();
    const second = openSheet();
    expect(document.body.style.overflow).toBe("hidden");
    closeSheet(second.inst, second.target);
    closeSheet(first.inst, first.target);
  });

  it("close one of two → still locked", () => {
    const first = openSheet();
    const second = openSheet();
    expect(document.body.style.overflow).toBe("hidden");
    closeSheet(first.inst, first.target);
    // One still open — must stay locked.
    expect(document.body.style.overflow).toBe("hidden");
    closeSheet(second.inst, second.target);
  });

  it("close both → body scroll restored", () => {
    const first = openSheet();
    const second = openSheet();
    closeSheet(first.inst, first.target);
    closeSheet(second.inst, second.target);
    expect(document.body.style.overflow).toBe("");
  });

  it("clears a leaked inline overflow instead of preserving it", () => {
    // The dev-HMR leak: a stale lock left `overflow: hidden` inline when this
    // lock was taken. Snapshot-restore semantics would put the leak back on
    // release; the lock is the only writer of this inline style, so the right
    // end state after the last release is always "no inline style at all".
    document.body.style.overflow = "hidden";
    const { inst, target } = openSheet();
    expect(document.body.style.overflow).toBe("hidden");
    closeSheet(inst, target);
    expect(document.body.style.overflow).toBe("");
  });
});

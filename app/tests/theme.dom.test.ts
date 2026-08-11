// @vitest-environment jsdom
/** The theme module's contract, at the seams the visual pass can't hold:
 *
 * - PRECEDENCE: a stored choice beats the OS; garbage in storage reads as no
 *   choice. jsdom ships no matchMedia, which is itself a documented branch —
 *   absent an OS opinion the game defaults to day.
 * - THE TOGGLE FLIPS WHAT IS SHOWING, which is the attribute, not a
 *   recompute. The two diverge exactly when storage is denied (nothing
 *   persisted the last flip) — a toggle that re-derived from storage/OS
 *   would re-apply the same theme on every tap, a one-way switch.
 * - applyTheme stamps BOTH the attribute and the theme-color meta; the two
 *   hexes are app.css's two --ground values.
 *
 * State hygiene: the module reads real jsdom localStorage and the real
 * document; each test starts from a clean slate and the suite restores any
 * spied setItem. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  resolveTheme,
  showingTheme,
  toggleTheme,
  watchSystemTheme,
} from "../src/lib/theme";

const KEY = "hotstove.theme";

function meta(): HTMLMetaElement {
  let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    document.head.appendChild(m);
  }
  return m;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  meta().setAttribute("content", "#f6f1e3");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveTheme precedence", () => {
  it("returns the stored explicit choice", () => {
    localStorage.setItem(KEY, "dark");
    expect(resolveTheme()).toBe("dark");
  });

  it("treats garbage in storage as no choice (day, absent matchMedia)", () => {
    localStorage.setItem(KEY, "sepia");
    expect(resolveTheme()).toBe("light");
  });

  it("defaults to day with nothing stored and no matchMedia", () => {
    expect(resolveTheme()).toBe("light");
  });
});

describe("applyTheme", () => {
  it("stamps the attribute and the theme-color meta together, both ways", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(meta().getAttribute("content")).toBe("#171410");
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(meta().getAttribute("content")).toBe("#f6f1e3");
  });
});

describe("toggleTheme flips what is showing", () => {
  it("flips the applied attribute and persists the destination", () => {
    applyTheme("dark");
    expect(toggleTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(KEY)).toBe("light");
  });

  it("reads the ATTRIBUTE, not storage: an OS-stamped dark page with empty storage toggles to light", () => {
    // watchSystemTheme's exact write: attribute stamped, nothing stored.
    document.documentElement.dataset.theme = "dark";
    expect(toggleTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("keeps alternating when storage writes throw", () => {
    applyTheme("light");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(toggleTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(toggleTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("showingTheme", () => {
  it("reads the attribute when present, resolveTheme when not", () => {
    document.documentElement.dataset.theme = "dark";
    expect(showingTheme()).toBe("dark");
    delete document.documentElement.dataset.theme;
    localStorage.setItem(KEY, "dark");
    expect(showingTheme()).toBe("dark");
  });
});

describe("watchSystemTheme", () => {
  it("is a guarded no-op without matchMedia and returns a teardown", () => {
    expect(typeof matchMedia).toBe("undefined");
    const teardown = watchSystemTheme();
    expect(() => teardown()).not.toThrow();
  });
});

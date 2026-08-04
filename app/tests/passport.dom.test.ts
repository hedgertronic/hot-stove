// @vitest-environment jsdom
/** Tapping a stamp: what only a MOUNTED passport can show.
 *
 * passport.test.ts renders both surfaces to a string and asserts the control —
 * every stamp is a button, it announces the country and the count, it carries
 * the detail. None of that can show the panel, because the panel is placed from
 * measurements and svelte/server never runs the effect that takes them.
 *
 * What is pinned here is the wiring, which is the part that fails silently: one
 * panel at a time, a tap outside that closes it WITHOUT swallowing the tap, and
 * an Escape that closes the panel and stops there rather than also closing the
 * sheet the passport is sitting in. These are BadgeSlot's behaviours and they
 * are not incidental — a badge panel and a stamp panel are two inches apart on
 * the trophy sheet, and a player learns one gesture.
 *
 * jsdom has no layout: every `getBoundingClientRect` is zeros, so the numbers
 * `measure()` produces here are all zero and nothing about WHERE the panel
 * lands is testable. That geometry is BadgeSlot's, line for line and constant
 * for constant, and it is checked by eye in a browser. What this file proves is
 * that the measurement runs, produces a placement and reveals the panel —
 * `.placed` is the class the panel is invisible without, so its absence is the
 * exact shape of "measured wrong" that a string test cannot see.
 */
import { afterEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import Passport from "../src/components/Passport.svelte";
import type { PassportItem } from "../src/lib/settings";

const stamp = (country: string, over: Partial<PassportItem> = {}): PassportItem => ({
  country,
  flag: "🏳️",
  rarity: "common",
  count: 1,
  fresh: false,
  ...over,
});

let host: HTMLElement | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any = null;
afterEach(() => {
  if (app) unmount(app);
  host?.remove();
  app = null;
  host = null;
});

function board(...stamps: PassportItem[]): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = mount(Passport, { target: host, props: { stamps, label: "Countries fielded" } });
  flushSync();
  return host;
}

const buttons = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>("button")];
const panels = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>(".how")];

/** A real tap: the pointerdown the dismissal path listens for, then the click
 * the button listens for. Sending only the click would let a listener that
 * closes on its own pointerdown pass. */
function tap(el: Element): void {
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  flushSync();
}

describe("tapping a stamp", () => {
  it("opens the country's detail, measured and revealed", () => {
    const el = board(stamp("Japan"));
    expect(panels(el)).toHaveLength(0);
    tap(buttons(el)[0]);
    const [panel] = panels(el);
    expect(panel.textContent).toContain("Rostered a player from Japan.");
    // Measured: the panel is `visibility: hidden` until a placement exists, so
    // this class is the difference between a reveal and a tap that does
    // nothing visible.
    expect(panel.classList.contains("placed")).toBe(true);
    expect(buttons(el)[0].getAttribute("aria-expanded")).toBe("true");
    expect(buttons(el)[0].getAttribute("aria-controls")).toBe(panel.id);
  });

  it("closes on a second tap of the same stamp", () => {
    const el = board(stamp("Japan"));
    tap(buttons(el)[0]);
    tap(buttons(el)[0]);
    expect(panels(el)).toHaveLength(0);
    expect(buttons(el)[0].getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps exactly one panel open across a row", () => {
    // The rule the whole row exists to enforce. BadgeSlot needs its caller to
    // hold this, because it renders one pill and cannot know about the others;
    // the passport renders the row, so one `string | null` is the entire rule.
    const el = board(stamp("Japan"), stamp("Cuba"), stamp("Peru"));
    tap(buttons(el)[0]);
    tap(buttons(el)[1]);
    expect(panels(el)).toHaveLength(1);
    expect(panels(el)[0].textContent).toContain("Cuba");
    // Still MEASURED, which is the half a count cannot see. There is one
    // `panelEl` for the row and switching stamps mounts one panel while
    // destroying another in the same flush; if the destroy landed last it
    // would null the reference, `measure()` would return at its guard, and
    // the panel would render at `visibility: hidden` — open by every
    // assertion above and invisible on screen.
    expect(panels(el)[0].classList.contains("placed")).toBe(true);
    expect(buttons(el).map((b) => b.getAttribute("aria-expanded"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  it("measures the switched-to panel in both directions along the row", () => {
    // The order the mount and the unmount land in is the `{#each}`'s, so the
    // two directions are not the same test: switching to an EARLIER stamp
    // creates its panel before the open one is destroyed, which is the
    // direction that can leave the row's single `panelEl` pointing at nothing.
    const el = board(stamp("Japan"), stamp("Cuba"), stamp("Peru"));
    tap(buttons(el)[2]);
    tap(buttons(el)[0]);
    expect(panels(el)).toHaveLength(1);
    expect(panels(el)[0].textContent).toContain("Japan");
    expect(panels(el)[0].classList.contains("placed")).toBe(true);
  });

  it("dismisses on a tap outside, and lets that tap through", () => {
    // `pointerdown` rather than `click`, and the handler only OBSERVES — no
    // preventDefault, no stopPropagation — so whatever sits under the tap
    // still receives its own click. A dismissal that swallowed the first tap
    // would cost the player a press every time a panel was open.
    const el = board(stamp("Japan"));
    tap(buttons(el)[0]);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    let landed = 0;
    outside.addEventListener("click", () => (landed += 1));
    const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    outside.dispatchEvent(down);
    outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    flushSync();
    expect(panels(el)).toHaveLength(0);
    expect(down.defaultPrevented).toBe(false);
    expect(landed).toBe(1);
    outside.remove();
  });

  it("stays open for a tap on its own panel", () => {
    const el = board(stamp("Japan"));
    tap(buttons(el)[0]);
    tap(panels(el)[0]);
    expect(panels(el)).toHaveLength(1);
  });

  it("closes on Escape without letting the sheet see it", () => {
    // Sheet closes the whole modal on a bubbling Escape. One key must not
    // dismiss two things: the panel is the innermost thing open, so it goes
    // first and alone. Caught in the CAPTURE phase and stopped there, which is
    // why a listener on the document — where Sheet's lives — hears nothing.
    const el = board(stamp("Japan"));
    tap(buttons(el)[0]);
    let sheetSaw = 0;
    const sheet = () => (sheetSaw += 1);
    document.addEventListener("keydown", sheet);
    // From the stamp, which is where a real Escape starts: it is the focused
    // element after the tap that opened the panel. Capture runs window first,
    // so the panel's handler sees the key before it has bubbled anywhere.
    buttons(el)[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    flushSync();
    document.removeEventListener("keydown", sheet);
    expect(panels(el)).toHaveLength(0);
    expect(sheetSaw).toBe(0);
  });

  it("listens for nothing once the panel is shut", () => {
    // Every listener is added at open and removed at close. A stamp that left
    // a document-level pointerdown behind would take a handler per tap for the
    // life of the sheet, and the trophy case is opened and closed all game.
    const el = board(stamp("Japan"));
    tap(buttons(el)[0]);
    tap(buttons(el)[0]);
    let sheetSaw = 0;
    const sheet = () => (sheetSaw += 1);
    document.addEventListener("keydown", sheet);
    buttons(el)[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    document.removeEventListener("keydown", sheet);
    // Nothing swallowed it, because nothing is listening for it.
    expect(sheetSaw).toBe(1);
  });

  it("opens on one sentence naming the country, whatever the stamp carries", () => {
    // NO STAMP IS EVER INERT and no panel is ever empty. A stamp used to carry
    // a per-surface sentence and the finale's was null, which made "does it
    // open at all" a real question; the sentence is built from the country now,
    // so every stamp on every surface opens on the same shape. The country's
    // name is the question a bare flag cannot answer on a touch screen, and it
    // is the one worth a tap.
    for (const country of ["Japan", "Curaçao"]) {
      const el = board(stamp(country, { count: null, rarity: null, flag: "" }));
      tap(buttons(el)[0]);
      expect(panels(el)[0].textContent?.trim()).toBe(`Rostered a player from ${country}.`);
    }
  });
});

describe("dealing the row in", () => {
  // The finale's stamps are the last beat of a ceremony and land one at a time,
  // the way the badge pills above them do. The trophy case's never do: nothing
  // there was just earned, so the row is simply present.
  it("staggers each stamp by its own index when asked", () => {
    const el = board(stamp("Japan"), stamp("Cuba"), stamp("Peru"));
    // Not asked: no entrance class and no delay anywhere.
    expect(buttons(el).some((b) => b.classList.contains("animate"))).toBe(false);
    expect(buttons(el).some((b) => b.style.animationDelay !== "")).toBe(false);

    host?.remove();
    if (app) unmount(app);
    host = document.createElement("div");
    document.body.appendChild(host);
    app = mount(Passport, {
      target: host,
      props: {
        stamps: [stamp("Japan"), stamp("Cuba"), stamp("Peru")],
        label: "Countries fielded",
        animate: true,
        step: 0.12,
      },
    });
    flushSync();
    const dealt = [...host.querySelectorAll<HTMLElement>(".stamp")];
    expect(dealt.every((b) => b.classList.contains("animate"))).toBe(true);
    // The row deals left to right off the index it already has — the first
    // stamp carries no delay at all, so the beat starts the moment the row
    // is revealed rather than one step after it.
    expect(dealt.map((b) => b.style.animationDelay)).toEqual(["", "0.12s", "0.24s"]);
  });
});

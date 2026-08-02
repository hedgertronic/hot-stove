// @vitest-environment jsdom
/** The corner pair's cue wiring: what lights it, what puts it out, and what
 * a screen reader is told while it is lit.
 *
 * The storage layer is asserted separately in cues.test.ts. What only a
 * mounted component can show is the other half — that a finale's `newBadges`
 * prop reaches storage, that opening a sheet writes the flag before the sheet
 * is even closed, and that the cue is never carried by color alone.
 *
 * The lit state is probed through `aria-label` and the `.cue` class rather
 * than through computed style: jsdom does not run the animation, and the class
 * is what proves the state, not the pixels. The look itself is a screenshot
 * job.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import CornerButtons from "../src/components/CornerButtons.svelte";

function open(props: Record<string, unknown> = {}) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(CornerButtons, { target, props });
  flushSync();
  const [help, trophy] = [...target.querySelectorAll("button")];
  return {
    help: help as HTMLButtonElement,
    trophy: trophy as HTMLButtonElement,
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

function cues(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem("hotstove.cues") ?? "null");
}

/** One finished game, so the player is no longer a first-timer. */
function played(badges: string[] = []): void {
  localStorage.setItem(
    "hotstove.history",
    JSON.stringify([
      { v: 2, date: "2026-08-01", total: 120, record: "95-67", spins: 3, difficulty: "standard", bank: "classic", badges },
    ]),
  );
}

beforeEach(() => localStorage.clear());

describe("the help cue", () => {
  it("lights on a first-ever visit and says so in the label", () => {
    const ui = open();
    expect(ui.help.classList.contains("cue")).toBe(true);
    // Not color alone: the label changes with the state.
    expect(ui.help.getAttribute("aria-label")).toBe("How to play — start here");
    ui.close();
  });

  it("goes dark the moment the sheet is opened, and stays dark on remount", () => {
    const ui = open();
    ui.help.click();
    flushSync();
    expect(ui.help.classList.contains("cue")).toBe(false);
    expect(ui.help.getAttribute("aria-label")).toBe("How to play");
    ui.close();

    const again = open();
    expect(again.help.classList.contains("cue")).toBe(false);
    again.close();
  });

  it("stays dark for anyone who has finished a game", () => {
    played();
    const ui = open();
    expect(ui.help.classList.contains("cue")).toBe(false);
    ui.close();
  });
});

describe("the trophy cue", () => {
  it("stays dark for an existing player whose badges predate the cue", () => {
    // The migration case, at the component level: a full history, no cue
    // record, and nothing lights up.
    played(["crown", "mariners"]);
    const ui = open();
    expect(ui.trophy.classList.contains("cue")).toBe(false);
    expect(ui.trophy.getAttribute("aria-label")).toBe("Trophy case");
    ui.close();
  });

  it("lights when the finale hands over a first-time-ever badge", () => {
    played(["crown"]);
    const ui = open({ newBadges: ["crown"] });
    flushSync();
    expect(ui.trophy.classList.contains("cue")).toBe(true);
    expect(ui.trophy.getAttribute("aria-label")).toBe("Trophy case — 1 new badge");
    expect(cues().pendingBadges).toEqual(["crown"]);
    ui.close();
  });

  it("counts plurals in the label", () => {
    const ui = open({ newBadges: ["crown", "mariners"] });
    flushSync();
    expect(ui.trophy.getAttribute("aria-label")).toBe("Trophy case — 2 new badges");
    ui.close();
  });

  it("stays dark on a finale that earned nothing new", () => {
    played(["crown"]);
    const ui = open({ newBadges: [] });
    flushSync();
    expect(ui.trophy.classList.contains("cue")).toBe(false);
    ui.close();
  });

  it("puts the help cue out too — a finale means a game was finished", () => {
    // History is written by the engine before the finale renders, but the
    // component read its own copy at mount; the prop is what corrects it.
    const ui = open();
    expect(ui.help.classList.contains("cue")).toBe(true);
    const mid = open({ newBadges: [] });
    flushSync();
    expect(mid.help.classList.contains("cue")).toBe(false);
    mid.close();
    ui.close();
  });

  it("goes dark on opening the case, and stays dark across a remount", () => {
    const ui = open({ newBadges: ["crown"] });
    flushSync();
    ui.trophy.click();
    flushSync();
    expect(ui.trophy.classList.contains("cue")).toBe(false);
    expect(ui.trophy.getAttribute("aria-label")).toBe("Trophy case");
    expect(cues().pendingBadges).toEqual([]);
    ui.close();

    // The other screen's copy of the pair reads the same key — a case opened
    // from the HUD must be dark on the home screen.
    const home = open({ home: true });
    expect(home.trophy.classList.contains("cue")).toBe(false);
    home.close();
  });
});

describe("both copies", () => {
  it("stop the click from reaching the surface underneath", () => {
    // The HUD sits above click handling tied to the landed card, so a bare
    // button would commit a pick on the way to opening a sheet.
    let leaked = 0;
    const onDoc = () => (leaked += 1);
    document.addEventListener("click", onDoc);
    const ui = open();
    ui.help.click();
    ui.trophy.click();
    document.removeEventListener("click", onDoc);
    expect(leaked).toBe(0);
    ui.close();
  });

  it("takes the home screen's top pin only when asked", () => {
    const hud = open();
    expect(hud.help.classList.contains("home")).toBe(false);
    hud.close();
    const home = open({ home: true });
    expect(home.help.classList.contains("home")).toBe(true);
    expect(home.trophy.classList.contains("home")).toBe(true);
    home.close();
  });
});

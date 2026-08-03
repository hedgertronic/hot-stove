// @vitest-environment jsdom
/** The seasons list: which rows appear, which of them are doors, and what a row
 * that is no longer a door looks like.
 *
 * The storage rules underneath it — the cap, the eviction, the log staying
 * whole — are asserted in archive.test.ts. What only a mounted component can
 * show is that a season the archive no longer holds reaches the DOM as a real
 * `disabled` attribute rather than a button that quietly does nothing, and that
 * the cap gets explained on screen the moment it costs the player something.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushSync, mount, unmount } from "svelte";
import SeasonsModal from "../src/components/SeasonsModal.svelte";
import { appendHistory, archiveGame, type ArchivedFinale } from "../src/lib/history";

function rec(id: string): ArchivedFinale {
  return {
    id,
    v: 1,
    seed: 42,
    config: { difficulty: "standard", bank: "classic" },
    spinCount: 8,
    seen: [],
    slots: [],
    owner: null,
    stadium: null,
    manager: null,
    finale: { parts: { total: 100 } },
  } as unknown as ArchivedFinale;
}

/** One finished season in the log. `archived` is what makes it reopenable. */
function season(
  id: string,
  over: Record<string, unknown> = {},
  archived = true,
): void {
  appendHistory({
    v: 2,
    id,
    date: "2026-08-02",
    seed: 42,
    total: 120,
    difficulty: "standard",
    bank: "classic",
    ...over,
  });
  if (archived) archiveGame(rec(id));
}

function open(onopen = vi.fn()) {
  const target = document.createElement("div");
  document.body.appendChild(target);
  const app = mount(SeasonsModal, { target, props: { onclose: vi.fn(), onopen } });
  flushSync();
  return {
    target,
    onopen,
    rows: () => [...target.querySelectorAll(".row")] as HTMLButtonElement[],
    note: () => target.querySelector(".note"),
    subtitle: () => target.querySelector(".sub")?.textContent ?? "",
    close: () => {
      unmount(app);
      target.remove();
    },
  };
}

beforeEach(() => localStorage.clear());
afterEach(() => document.body.replaceChildren());

describe("which rows appear", () => {
  it("lists finished seasons newest first", () => {
    season("g0", { total: 90 });
    season("g1", { total: 160 });
    const ui = open();
    const rows = ui.rows();
    expect(rows).toHaveLength(2);
    // 160 points resolves to a 160–2 season; 90 to 90–72.
    expect(rows[0].querySelector(".rec")!.textContent).toBe("160–2");
    expect(rows[1].querySelector(".rec")!.textContent).toBe("90–72");
    ui.close();
  });

  it("colors the record on the WAR ladder the whole game speaks", () => {
    season("g0", { total: 90 }); // under the century mark
    season("g1", { total: 120 }); // past the Mariners line
    season("g2", { total: 160 }); // gold
    const ui = open();
    // The tier class only — svelte's scoping hash rides along on every one.
    const tiers = ui.rows().map((r) =>
      [...r.querySelector(".rec")!.classList].find((c) => c !== "rec" && !c.startsWith("svelte-")),
    );
    expect(tiers).toEqual(["elite", "high", "low"]);
    ui.close();
  });

  it("leaves quits out — they resolved no season", () => {
    appendHistory({ date: "2026-08-02", badges: ["packedin"] });
    season("g1");
    appendHistory({ date: "2026-08-03", badges: ["packedin"] });
    const ui = open();
    expect(ui.rows()).toHaveLength(1);
    // And the subtitle counts what is listed, not what is logged.
    expect(ui.subtitle()).toBe("1 PLAYED");
    ui.close();
  });

  it("prints the seed as the code PLAY A SEED takes back", () => {
    season("g0", { seed: 42 });
    const ui = open();
    expect(ui.rows()[0].querySelector(".seed")!.textContent).toBe("#16");
    ui.close();
  });

  it("prints the date the log wrote, not a timezone's opinion of it", () => {
    // `new Date("2026-08-02")` is midnight UTC, which is August 1st for anyone
    // west of Greenwich. The row reads the digits.
    season("g0", { date: "2026-08-02" });
    const ui = open();
    expect(ui.rows()[0].querySelector(".date")!.textContent).toBe("AUG 2 '26");
    ui.close();
  });

  it("names the bank on every row, and marks Eye Test", () => {
    season("g0", { bank: "moneyball", difficulty: "scout" });
    season("g1", { bank: "classic", difficulty: "standard" });
    const ui = open();
    // Clean House shows its emoji too: a blank in a comparison list would have
    // to be read as "the default" by someone who knows what the default is.
    expect(ui.rows()[0].querySelector(".mode")!.textContent).toBe("💼");
    expect(ui.rows()[1].querySelector(".mode")!.textContent).toBe("⚾ 🔭");
    ui.close();
  });

  it("reads a pre-bank row's moneyball boolean the way the record book does", () => {
    season("g0", { bank: undefined, moneyball: true, v: undefined, difficulty: "eyetest" });
    const ui = open();
    expect(ui.rows()[0].querySelector(".mode")!.textContent).toBe("⚾ 🔭");
    ui.close();
  });
});

describe("which rows are doors", () => {
  it("opens the season it was tapped on", () => {
    season("g0");
    season("g1");
    const ui = open();
    ui.rows()[0].click();
    expect(ui.onopen).toHaveBeenCalledOnce();
    // Newest first, so the top row is the second game — and the record handed
    // over is that game's, not the last one archived by accident.
    expect(ui.onopen.mock.calls[0][0].id).toBe("g1");
    ui.close();
  });

  it("draws a season the archive no longer holds as a control it cannot press", () => {
    season("g0", {}, false); // logged, never archived (or long since evicted)
    season("g1");
    const ui = open();
    const [fresh, aged] = ui.rows();

    expect(fresh.disabled).toBe(false);
    expect(aged.disabled).toBe(true);
    // Different to look at, not merely unresponsive: the door mark is the one
    // thing the aged row does not have.
    expect(fresh.querySelector(".go")!.textContent).toBe("›");
    expect(aged.querySelector(".go")!.textContent).toBe("");
    // Its record is still on screen, still tier-colored — the season counts.
    expect(aged.querySelector(".rec")!.textContent).toBe("120–42");

    aged.click();
    expect(ui.onopen).not.toHaveBeenCalled();
    ui.close();
  });

  it("says the cap out loud once, and only once it has cost something", () => {
    season("g0");
    const inside = open();
    expect(inside.note()).toBeNull();
    inside.close();

    season("g1", {}, false);
    const outside = open();
    expect(outside.note()!.textContent).toContain("50");
    outside.close();
  });

  it("treats an older row whose archive record went missing as aged out", () => {
    // Not a hypothetical: a quota failure archives nothing while the log row is
    // already written, and the id then names a record that never landed.
    season("g0");
    season("g1");
    localStorage.setItem("hotstove.archive", "[]");
    const ui = open();
    expect(ui.rows()[1].disabled).toBe(true);
    ui.close();
  });

  it("opens the newest row off hotstove.finale when the archive has no record", () => {
    // The two ways a season can have a finale but no archive record: a build
    // that predates ids, and a quota failure that lost the archive write while
    // `hotstove.finale` — written first, on its own budget — still landed.
    appendHistory({ v: 2, date: "2026-08-02", seed: 42, total: 120 });
    localStorage.setItem("hotstove.finale", JSON.stringify({ ...rec("x"), v: 1 }));
    const ui = open();
    expect(ui.rows()).toHaveLength(1);
    expect(ui.rows()[0].disabled).toBe(false);
    ui.rows()[0].click();
    expect(ui.onopen).toHaveBeenCalledOnce();
    ui.close();
  });

  it("holds that fallback to the NEWEST row — the key stores exactly one game", () => {
    appendHistory({ v: 2, date: "2026-08-01", seed: 1, total: 120 });
    appendHistory({ v: 2, date: "2026-08-02", seed: 2, total: 130 });
    localStorage.setItem("hotstove.finale", JSON.stringify({ ...rec("x"), v: 1 }));
    const ui = open();
    // Newest first: the top row is the last game, the one below it is not.
    expect(ui.rows()[0].disabled).toBe(false);
    expect(ui.rows()[1].disabled).toBe(true);
    ui.close();
  });

  it("goes dead once a new game retires the stored finale", () => {
    appendHistory({ v: 2, date: "2026-08-02", seed: 42, total: 120 });
    localStorage.removeItem("hotstove.finale"); // startGame()
    const ui = open();
    expect(ui.rows()[0].disabled).toBe(true);
    ui.close();
  });
});

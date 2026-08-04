// @vitest-environment jsdom
/** The seasons list: which rows appear, in what order their zones are drawn,
 * which of them are doors, and which of them the record-book shelf pins.
 *
 * The storage rules underneath it — the cap, the eviction, the log staying
 * whole — are asserted in archive.test.ts. What only a mounted component can
 * show is that a season the archive no longer holds reaches the DOM as a real
 * `disabled` attribute rather than a button that quietly does nothing, and that
 * the shelf holds one row per mode combo played and none for a combo that
 * was not.
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
    // Whole enough to clear loadStoredFinale's structural floor — the reader
    // refuses a record missing anything the finale screen dereferences.
    finale: {
      parts: { total: 100 },
      wins: 100,
      losses: 62,
      badges: [],
      spend: 90,
      budget: 100,
      spinCount: 8,
      totalWar: 40,
    },
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
    // Scoped to the list container: the shelf above it draws the same `.row`
    // markup, and an unscoped query would count the best seasons twice.
    rows: () => [...target.querySelectorAll(".rows .row")] as HTMLButtonElement[],
    shelf: () => [...target.querySelectorAll(".shelf .row")] as HTMLButtonElement[],
    // Section labels now use the app's global .psep device (dashed rule).
    caps: () => [...target.querySelectorAll(".psep")].map((c) => c.textContent?.trim()),
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
    // Only the one finished season appears — quits are excluded.
    expect(ui.rows()).toHaveLength(1);
    // No "N PLAYED" subtitle is shown.
    expect(ui.subtitle()).toBe("");
    ui.close();
  });

  it("prints the seed as the code PLAY A SEED takes back", () => {
    season("g0", { seed: 42 });
    const ui = open();
    expect(ui.rows()[0].querySelector(".seed")!.textContent).toBe("#0000016");
    ui.close();
  });

  it("keeps the date in the aria-label (screen readers) but not as a visible span", () => {
    // The date is intentionally absent from the visual row but still present
    // in aria-label so the reading order works for screen readers.
    season("g0", { date: "2026-08-02" });
    const ui = open();
    const row = ui.rows()[0];
    expect(row.querySelector(".date")).toBeNull();
    expect(row.getAttribute("aria-label")).toContain("AUG 2 '26");
    ui.close();
  });

  it("names the bank on every row, and marks Eye Test", () => {
    season("g0", { bank: "moneyball", difficulty: "scout" });
    season("g1", { bank: "classic", difficulty: "standard" });
    const ui = open();
    // From the Ground Up shows its emoji too: a blank in a comparison list would have
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
    // And it names the season out loud: the archive id travels beside the
    // record so the finale can claim the boot screen under its own name. Drop
    // it and a reload off that screen restores the LAST game played instead —
    // a bug that typechecks, because the argument is optional.
    expect(ui.onopen.mock.calls[0][1]).toBe("g1");
    ui.close();
  });

  it("draws a season the archive no longer holds as a control it cannot press", () => {
    season("g0", {}, false); // logged, never archived (or long since evicted)
    season("g1");
    const ui = open();
    const [fresh, aged] = ui.rows();

    expect(fresh.disabled).toBe(false);
    expect(aged.disabled).toBe(true);
    // NO ARROW ON EITHER. Playability is carried by the fade alone now — an
    // arrow on a row that is already un-grayed said the same thing twice. The
    // fade is `opacity` on `.row:disabled`, which jsdom has no layout to
    // compute, so `disabled` above is the assertion that can actually fail;
    // the visual half is a screenshot job.
    expect(fresh.querySelector(".go")).toBeNull();
    expect(aged.querySelector(".go")).toBeNull();
    // Its record is still on screen, still tier-colored — the season counts.
    expect(aged.querySelector(".rec")!.textContent).toBe("120–42");

    aged.click();
    expect(ui.onopen).not.toHaveBeenCalled();
    ui.close();
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
    // NO id on this route, and that is the right answer rather than a gap: the
    // record came out of `hotstove.finale`, which holds exactly one game, and
    // the live boot claim already means that key.
    expect(ui.onopen.mock.calls[0][1]).toBeUndefined();
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

describe("how a row is laid out", () => {
  /** The zone each child carries, in DOM order — which is reading order, and
   * the only part of the layout jsdom can actually see. Order ONLY: the tier
   * class riding along on `.rec` is the subject of its own test above, and a
   * layout assertion that also checked the color would pass or fail for two
   * unrelated reasons.
   *
   * Row order after redesign: seed far left, then mode emojis, then record far
   * right. No date span (date lives only in aria-label). */
  const ZONES = ["seed", "mode", "rec"];
  function zones(row: HTMLButtonElement): (string | undefined)[] {
    return [...row.children].map((c) => ZONES.find((z) => c.classList.contains(z)));
  }

  it("runs seed, then modes, then the record — no date element", () => {
    season("g0", { seed: 42, bank: "moneyball", difficulty: "scout" });
    const ui = open();
    expect(zones(ui.rows()[0])).toEqual(ZONES);
    expect(ui.rows()[0].querySelector(".date")).toBeNull();
    ui.close();
  });

  it("keeps the record last even when the season carries no seed", () => {
    // A pre-seed row still has the zone, empty, so the record lands on the same
    // vertical line in every row of the column.
    season("g0", { seed: undefined });
    const ui = open();
    const row = ui.rows()[0];
    expect(zones(row)).toEqual(ZONES);
    expect(row.querySelector(".seed")!.textContent).toBe("");
    expect(row.lastElementChild!.textContent).toBe("120–42");
    ui.close();
  });

  it("names the row in reading order for a screen reader", () => {
    season("g0", { seed: 42, bank: "moneyball", difficulty: "scout" });
    const ui = open();
    expect(ui.rows()[0].getAttribute("aria-label")).toBe(
      "AUG 2 '26, Moneyball · Eye Test, seed 0000016, 120–42",
    );
    ui.close();
  });

  it("says so when a row is not a door, since the fade cannot be heard", () => {
    season("g0", {}, false);
    const ui = open();
    expect(ui.rows()[0].getAttribute("aria-label")).toContain(
      "no longer available to reopen",
    );
    ui.close();
  });
});

describe("the record book shelf", () => {
  it("pins the best season in each mode combo played, best first", () => {
    season("g0", { total: 90, bank: "classic", difficulty: "standard" });
    season("g1", { total: 160, bank: "classic", difficulty: "standard" });
    season("g2", { total: 120, bank: "moneyball", difficulty: "standard" });
    const ui = open();
    const shelf = ui.shelf();
    // Two combos played, so two shelf rows — the 90 loses its combo to the 160.
    expect(shelf).toHaveLength(2);
    expect(shelf.map((r) => r.querySelector(".rec")!.textContent)).toEqual([
      "160–2",
      "120–42",
    ]);
    // Every season is still in the list beneath it: the shelf is a pin, not a
    // filter.
    expect(ui.rows()).toHaveLength(3);
    ui.close();
  });

  it("counts the ladder as part of the combo, the way the record book does", () => {
    // Same bank, different ball knowledge — two record books, two shelf rows.
    season("g0", { total: 120, bank: "moneyball", difficulty: "standard" });
    season("g1", { total: 90, bank: "moneyball", difficulty: "scout" });
    const ui = open();
    expect(ui.shelf()).toHaveLength(2);
    ui.close();
  });

  it("skips a mode never played rather than shelving a blank", () => {
    season("g0", { bank: "classic", difficulty: "standard" });
    const ui = open();
    expect(ui.shelf()).toHaveLength(1);
    expect(ui.shelf()[0].querySelector(".mode")!.textContent).toBe("💼");
    ui.close();
  });

  it("draws nothing at all — shelf or captions — with no seasons logged", () => {
    const ui = open();
    expect(ui.shelf()).toHaveLength(0);
    expect(ui.caps()).toEqual([]);
    ui.close();
  });

  it("labels the two sections using the .psep device so the surface reads as one book", () => {
    season("g0");
    const ui = open();
    // .psep is the app's global dashed-separator component (app.css).
    expect(ui.caps()).toEqual(["RECORD BOOK", "ALL SEASONS"]);
    ui.close();
  });

  it("shows no N PLAYED subtitle on the sheet header", () => {
    season("g0");
    season("g1");
    const ui = open();
    // Subtitle prop is omitted — .sub element is absent from the DOM.
    expect(ui.subtitle()).toBe("");
    ui.close();
  });

  it("marks its rows as the shelf's, and still opens them", () => {
    season("g0", { total: 160 });
    const ui = open();
    const best = ui.shelf()[0];
    expect(best.classList.contains("best")).toBe(true);
    expect(best.getAttribute("aria-label")).toMatch(/^Best From the Ground Up season\./);
    best.click();
    expect(ui.onopen).toHaveBeenCalledOnce();
    expect(ui.onopen.mock.calls[0][0].id).toBe("g0");
    ui.close();
  });

  it("shelves a best season the archive can no longer open, dead like any row", () => {
    // The record still stands; the door is what aged out.
    season("g0", { total: 160 }, false);
    const ui = open();
    expect(ui.shelf()).toHaveLength(1);
    expect(ui.shelf()[0].disabled).toBe(true);
    ui.close();
  });

  it("gives a tie to the newer season, which is likelier to still be a door", () => {
    season("g0", { total: 120 }, false);
    season("g1", { total: 120 });
    const ui = open();
    expect(ui.shelf()).toHaveLength(1);
    expect(ui.shelf()[0].disabled).toBe(false);
    ui.close();
  });
});

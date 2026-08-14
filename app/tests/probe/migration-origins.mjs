/** Cross-origin Phase 2 probe. Requests keep the real production origins while
 * Playwright fulfills them from the local dist directory, so each engine uses
 * genuinely separate localStorage without touching the live deployment. */
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, firefox, webkit } from "playwright";

const DIST = new URL("../../dist/", import.meta.url).pathname;
const OLD = "https://hedgertronic.com/games/hot-stove/";
const TARGET = "https://hotstove.io/";
const PRIOR = "https://example.test/before-hot-stove";
const engines = { chromium, firefox, webkit };
const types = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function assetPath(url) {
  let path = new URL(url).pathname;
  if (path.startsWith("/games/hot-stove/")) path = path.slice("/games/hot-stove".length);
  if (path === "/" || path === "") path = "/index.html";
  const safe = normalize(path).replace(/^[/\\]+/, "");
  return join(DIST, safe);
}

async function serve(route) {
  const url = route.request().url();
  if (url === PRIOR) {
    await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Before Hot Stove</title>before" });
    return;
  }
  if (!url.startsWith("https://hotstove.io/") && !url.startsWith("https://hedgertronic.com/")) {
    await route.abort();
    return;
  }
  try {
    const path = assetPath(url);
    const body = await readFile(path);
    await route.fulfill({ status: 200, contentType: types[extname(path)] ?? "application/octet-stream", body });
  } catch {
    await route.fulfill({ status: 404, contentType: "text/plain", body: "Not found" });
  }
}

const sourceRows = [
  { date: "2026-08-11", record: "88–74", total: 88, badges: ["source"] },
  { date: "2026-08-12", badges: ["packedin"] },
  { date: "2026-08-12", badges: ["packedin"] },
];
const targetRows = [{ date: "2026-08-13", record: "90–72", total: 90, badges: ["target"] }];

for (const [name, engine] of Object.entries(engines)) {
  const browser = await engine.launch();
  const context = await browser.newContext();
  await context.route("**/*", serve);
  const page = await context.newPage();

  // Seed the two first-party stores independently. #stay is an explicit local
  // test/recovery bypass on the old origin; it never appears in normal links.
  await page.goto(`${TARGET}#seed`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".playbtn", { timeout: 20_000 });
  const freshCopy = await page.textContent("body");
  if (freshCopy?.includes("Played before") || freshCopy?.includes("migration"))
    throw new Error(`${name}: a direct .io visit exposed migration UI`);
  await page.evaluate((rows) => localStorage.setItem("hotstove.history", JSON.stringify(rows)), targetRows);
  await page.goto(`${OLD}#stay`, { waitUntil: "domcontentloaded" });
  await page.evaluate((rows) => {
    localStorage.setItem("hotstove.history", JSON.stringify(rows));
    localStorage.setItem(
      "hotstove.cues",
      JSON.stringify({
        v: 1,
        pendingBadges: ["source"],
        helpSeen: true,
        tourSeen: false,
        finaleTourSeen: false,
      }),
    );
    localStorage.setItem("hotstove.theme", "dark");
  }, sourceRows);

  await page.goto(PRIOR, { waitUntil: "domcontentloaded" });
  await page.goto(OLD, { waitUntil: "domcontentloaded" });
  await page.waitForURL(TARGET, { timeout: 20_000 });
  await page.waitForSelector(".playbtn", { timeout: 20_000 });
  const adopted = await page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem("hotstove.history") ?? "[]"),
    marker: JSON.parse(localStorage.getItem("hotstove.adopted") ?? "null"),
    theme: localStorage.getItem("hotstove.theme"),
    migrationText: document.body.textContent?.includes("migration") ?? false,
  }));
  if (JSON.stringify(adopted.history) !== JSON.stringify([...sourceRows, ...targetRows]))
    throw new Error(`${name}: history merge did not preserve order or multiplicity`);
  if (adopted.marker?.historyCount !== sourceRows.length || adopted.marker?.initialComplete !== true)
    throw new Error(`${name}: target marker did not commit`);
  if (adopted.theme !== "dark") throw new Error(`${name}: source theme was not adopted`);
  if (adopted.migrationText) throw new Error(`${name}: migration copy leaked into the normal UI`);

  await page.goBack({ waitUntil: "domcontentloaded" });
  if (page.url() !== PRIOR) throw new Error(`${name}: Back returned to a migration hop`);
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });

  // The source acknowledges only after the target commit. A later ordinary
  // visit therefore forwards straight to the clean target root.
  await page.goto(`${OLD}#stay`, { waitUntil: "domcontentloaded" });
  const sourceMark = await page.evaluate(() => JSON.parse(localStorage.getItem("hotstove.migrated") ?? "null"));
  if (sourceMark?.target !== TARGET.slice(0, -1) || typeof sourceMark?.signature !== "string")
    throw new Error(`${name}: source completion was not acknowledged`);
  await page.goto(OLD, { waitUntil: "domcontentloaded" });
  await page.waitForURL(TARGET, { timeout: 20_000 });

  // If a pre-migration tab changed the source store after acknowledgment, the
  // signature makes the next old visit re-run the invisible handoff. Only the
  // new suffix crosses, and then direct forwarding resumes.
  await page.goto(`${OLD}#stay`, { waitUntil: "domcontentloaded" });
  const late = { date: "2026-08-14", record: "91–71", total: 91 };
  await page.evaluate((row) => {
    const history = JSON.parse(localStorage.getItem("hotstove.history") ?? "[]");
    history.push(row);
    localStorage.setItem("hotstove.history", JSON.stringify(history));
  }, late);
  await page.goto(OLD, { waitUntil: "domcontentloaded" });
  await page.waitForURL(TARGET, { timeout: 20_000 });
  // target-done reloads itself; wait for the app so the next goto cannot race
  // that reload (WebKit surfaces the race as an interrupted navigation).
  await page.waitForSelector(".playbtn", { timeout: 20_000 });
  const lateHistory = await page.evaluate(() => JSON.parse(localStorage.getItem("hotstove.history") ?? "[]"));
  if (JSON.stringify(lateHistory) !== JSON.stringify([...sourceRows, ...targetRows, late]))
    throw new Error(`${name}: late source play was lost or duplicated`);

  // ---- the completion sweep (#remigrate) ----
  // Simulate the two phase-2 defects at once: a source row the first pass
  // never landed (injected mid-list, where a positional cursor cannot reach
  // it) and archive doors that never crossed. The sweep must recover both,
  // keep every row played since, and land in date order.
  const recovered = { date: "2026-08-11", record: "87–75", total: 87 };
  const door = (id) => ({
    id,
    v: 1,
    seed: 7,
    config: { difficulty: "standard", bank: "classic" },
    spinCount: 9,
    seen: [],
    slots: [],
    owner: null,
    stadium: null,
    manager: null,
    finale: {
      wins: 90, losses: 72, spend: 100, budget: 120, totalWar: 40, spinCount: 9, badges: [],
      parts: { expectedWins: 90, managerWins: 0, budgetBonus: 1, awardPoints: 0, ringPoints: 0, scoutBonus: 0, luxuryTax: 0, total: 91 },
    },
  });
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.evaluate((row) => localStorage.setItem("hotstove.archive", JSON.stringify([row])), door("io-a"));
  await page.goto(`${OLD}#stay`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ row, doors }) => {
      const history = JSON.parse(localStorage.getItem("hotstove.history") ?? "[]");
      history.splice(1, 0, row);
      localStorage.setItem("hotstove.history", JSON.stringify(history));
      localStorage.setItem("hotstove.archive", JSON.stringify(doors));
    },
    { row: recovered, doors: [door("src-a"), door("src-b")] },
  );
  await page.goto(`${OLD}#remigrate`, { waitUntil: "domcontentloaded" });
  // A hash-only goto is a same-document navigation and the boot script
  // never re-runs; real players LOAD this URL. Reload to match.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForURL(TARGET, { timeout: 20_000 });
  await page.waitForSelector(".playbtn", { timeout: 20_000 });
  const swept = await page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem("hotstove.history") ?? "[]"),
    archive: JSON.parse(localStorage.getItem("hotstove.archive") ?? "[]").map((r) => r.id),
    marker: JSON.parse(localStorage.getItem("hotstove.adopted") ?? "null"),
    staging: localStorage.getItem("hotstove.migration.sweep"),
  }));
  // Date merge: recovered (08-11) slots in before the 08-12 quits; the .io
  // game (08-13) and the late source game (08-14) keep their seats.
  const expected = [sourceRows[0], recovered, sourceRows[1], sourceRows[2], ...targetRows, late];
  if (JSON.stringify(swept.history) !== JSON.stringify(expected))
    throw new Error(`${name}: the sweep did not recover and re-order the history`);
  if (swept.marker?.historyCount !== 5)
    throw new Error(`${name}: the sweep marker did not adopt the fresh count`);
  if (JSON.stringify([...swept.archive].sort()) !== JSON.stringify(["io-a", "src-a", "src-b"]))
    throw new Error(`${name}: the sweep did not union the archive doors`);
  if (swept.staging !== null) throw new Error(`${name}: sweep staging survived completion`);

  await browser.close();
  console.log(`${name}: migration, acknowledgment, forwarding, late-source retry, and completion sweep passed`);
}

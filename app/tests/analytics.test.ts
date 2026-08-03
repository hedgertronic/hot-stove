import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../src/lib/analytics";

/** In the vitest node environment `window` and `location` do not exist as
 * globals. Tests that need to exercise the forwarding path install stubs on
 * `globalThis` — the same object the module reads when it evaluates
 * `typeof window` and `location.hostname` — and remove them in `afterEach`
 * to prevent state from leaking between cases.
 *
 * The three suppression guards are tested independently:
 *   (1) gtag absent → no throw, no call
 *   (2) localhost / 127.0.0.1 hostname → no call even when gtag is present
 *   (3) ?lab query param → no call even when gtag is present
 * And the forwarding path is tested when all three guards pass. */

const g = globalThis as Record<string, unknown>;

/** Install a minimal window + location stub on globalThis. Every field the
 * module touches is present; callers override only what their case cares about.
 * `gtag` is typed as `unknown` so callers can pass a `vi.fn()` mock directly
 * without a cast — the globalThis assignment below is already untyped. */
function stubEnv(opts: {
  gtag?: unknown;
  hostname: string;
  search: string;
}) {
  g.window = { gtag: opts.gtag };
  g.location = { hostname: opts.hostname, search: opts.search };
}

function clearEnv() {
  delete g.window;
  delete g.location;
}

// ---------- guard (1): window / gtag absent ----------

describe("track() — gtag not present", () => {
  it("does not throw when window is not defined at all", () => {
    // The default node environment has no window global.
    expect(typeof window).toBe("undefined");
    expect(() => track("test_event")).not.toThrow();
  });

  it("does not throw and does not call when window exists but gtag is absent", () => {
    g.window = {}; // window defined but no gtag property
    g.location = { hostname: "hedgertronic.com", search: "" };
    try {
      expect(() => track("test_event")).not.toThrow();
    } finally {
      clearEnv();
    }
  });
});

// ---------- guard (2): localhost suppression ----------

describe("track() — localhost guard", () => {
  let gtag: ReturnType<typeof vi.fn>;
  beforeEach(() => { gtag = vi.fn(); });
  afterEach(clearEnv);

  it("suppresses on localhost", () => {
    stubEnv({ gtag, hostname: "localhost", search: "" });
    track("game_start", { difficulty: "standard", bank: "classic" });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("suppresses on 127.0.0.1", () => {
    stubEnv({ gtag, hostname: "127.0.0.1", search: "" });
    track("game_start", { difficulty: "standard", bank: "classic" });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("suppresses on empty hostname (file:// context)", () => {
    stubEnv({ gtag, hostname: "", search: "" });
    track("game_start");
    expect(gtag).not.toHaveBeenCalled();
  });
});

// ---------- guard (3): ?lab suppression ----------

describe("track() — ?lab guard", () => {
  let gtag: ReturnType<typeof vi.fn>;
  beforeEach(() => { gtag = vi.fn(); });
  afterEach(clearEnv);

  it("suppresses when the URL carries ?lab", () => {
    stubEnv({ gtag, hostname: "hedgertronic.com", search: "?lab" });
    track("game_start");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("does not suppress when a different param is present", () => {
    stubEnv({ gtag, hostname: "hedgertronic.com", search: "?debug=true" });
    track("game_start");
    expect(gtag).toHaveBeenCalledOnce();
  });
});

// ---------- forwarding path ----------

describe("track() — forwards to gtag when all guards pass", () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtag = vi.fn();
    stubEnv({ gtag, hostname: "hedgertronic.com", search: "" });
  });
  afterEach(clearEnv);

  it("calls gtag with 'event' and the event name", () => {
    track("game_start");
    expect(gtag).toHaveBeenCalledWith("event", "game_start", undefined);
  });

  it("forwards params as the third argument", () => {
    track("game_start", { difficulty: "standard", bank: "classic" });
    expect(gtag).toHaveBeenCalledWith("event", "game_start", {
      difficulty: "standard",
      bank: "classic",
    });
  });

  it("forwards mixed-type params (string, number, boolean)", () => {
    track("game_finish", { wins: 104, total: 131, over_payroll: false });
    expect(gtag).toHaveBeenCalledWith("event", "game_finish", {
      wins: 104,
      total: 131,
      over_payroll: false,
    });
  });

  it("calls exactly once per track() invocation", () => {
    track("share");
    track("share");
    expect(gtag).toHaveBeenCalledTimes(2);
  });
});

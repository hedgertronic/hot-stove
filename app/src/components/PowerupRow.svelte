<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import PowerupPill from "./PowerupPill.svelte";

  /** A powerup's four-state word, from the two facts about the spin plus the
   * powerup's own state. `pre` is true for the three that can only be armed
   * before a choice is committed; the other three answer to `canAct`.
   *
   * One function for all six, so no pill can grow a condition the others do
   * not have — which is exactly how exclusivity would come back. */

  let {
    game,
    onSeasonTicket,
    onRelocate,
  }: { game: Game; onSeasonTicket: () => void; onRelocate: () => void } = $props();

  const preChoice = $derived(game.phase === "landed" && game.choicesUsed === 0);
  const p = $derived(game.powerups);

  /** Powerups combine. Each pill reads only its OWN state plus the two facts
   * about the spin below — whether a choice has been committed yet
   * (`preChoice`) and whether one is still available (`canAct`) — so nothing
   * here can make one armed powerup dim, disable, or disarm another. ⭐ + 🏠,
   * or 🔁 + 🏠 + ⭐, arm together and stay armed together.
   *
   * That is a rule, not an accident: a cross-powerup condition added to any
   * `class:off` or click guard below would quietly reintroduce exclusivity,
   * and the pill row is where it would be least visible. Restrictions on what
   * an armed combination can DO belong to the engine and the market rows,
   * where they can be stated once for every surface. */

  // Armed labels all speak in one voice: instruct the next tap, trailing "…".
  // No meta-UI words (UNDO, DONE) — tapping an armed pill again disarms it,
  // unlabeled, the same toggle gesture that armed it.
  //
  // They are also on a WIDTH BUDGET, because any combination of them can be on
  // screen at once (nothing here or in the engine stops three powerups being
  // armed together) and the 3+3 lattice below only holds while each row fits
  // its container. The widest resting row is DOUBLE PLAY · TRADE DEADLINE ·
  // HOMEGROWN at 34 label characters, and that row is the one the container
  // query was tuned against — so no row is allowed to exceed 34 characters in
  // ANY armed combination:
  //
  //   row 1 armed  SEASON TICKET(13) RELOCATE(8) TAP A PLAYER…(13)  = 34
  //   row 2 armed  ONE MORE…(9) TAP A TRADE…(12) SIGN AT $1M…(12)   = 33
  //
  // That is what keeps ✌️'s second state at "ONE MORE…": with Double Play
  // carrying a spin past its first pick, the other two pills stay armed
  // alongside it, and the verb the first state established ("PICK TWO…") is
  // the cheapest word in the row to drop.
  const tdLabel = $derived(
    p.tradeDeadline !== "armed"
      ? "🔁 TRADE DEADLINE"
      : game.releasePick
        ? "🔁 WHO GOES?"
        : "🔁 TAP A TRADE…",
  );

  const canAct = $derived(game.phase === "landed" && game.choicesLeft > 0);
  // One word, as the powerup is spoken. The internal key stays `prime`.
  const primeLabel = $derived(p.prime === "armed" ? "⭐ TAP A PLAYER…" : "⭐ PRIMETIME");
  const hdLabel = $derived(p.hometown === "armed" ? "🏠 SIGN AT $1M…" : "🏠 HOMEGROWN");
  function pillState(
    own: "ready" | "armed" | "spent",
    pre: boolean,
  ): "ready" | "armed" | "off" | "spent" {
    if (own !== "ready") return own;
    return (pre ? preChoice : canAct) ? "ready" : "off";
  }

  const dpLabel = $derived(
    p.doublePlay !== "armed"
      ? "✌️ DOUBLE PLAY"
      : game.choicesUsed > 0
        ? "✌️ ONE MORE…"
        : "✌️ PICK TWO…",
  );
</script>

<div class="pprow disp">
  <div class="row">
    <PowerupPill
      label="🎟️ SEASON TICKET"
      state={pillState(p.seasonTicket, true)}
      onclick={(e) => {
        e.stopPropagation();
        if (p.seasonTicket === "ready" && preChoice) onSeasonTicket();
      }}
    />
    <PowerupPill
      label="🚚 RELOCATE"
      state={pillState(p.relocate, true)}
      onclick={(e) => {
        e.stopPropagation();
        if (p.relocate === "ready" && preChoice) onRelocate();
      }}
    />
    <PowerupPill
      label={primeLabel}
      state={pillState(p.prime, false)}
      onclick={(e) => {
        e.stopPropagation();
        if (p.prime !== "ready" || canAct) game.togglePrime();
      }}
    />
  </div>
  <div class="row">
    <PowerupPill
      label={dpLabel}
      state={pillState(p.doublePlay, true)}
      onclick={(e) => {
        e.stopPropagation();
        game.toggleDoublePlay();
      }}
    />
    <PowerupPill
      label={tdLabel}
      state={pillState(p.tradeDeadline, false)}
      onclick={(e) => {
        e.stopPropagation();
        game.toggleTradeDeadline();
      }}
    />
    <PowerupPill
      label={hdLabel}
      state={pillState(p.hometown, false)}
      onclick={(e) => {
        e.stopPropagation();
        game.toggleHometown();
      }}
    />
  </div>
</div>

<style>
  /* Two explicit pill rows (ST/RELO/PT and DP/TD/HD) stacked in a column.
     The column gap and each row's own wrap gap are the same 8px, so the
     vertical rhythm is uniform at EVERY wrap count — forced 3+3, or a
     natural three-line wrap at narrow widths. (This replaces a zero-height
     flex-break element whose doubled row-gap needed magic-number halving.)
     `container-type` is PowerupPill's contract: its type tier is keyed to this
     row's actual width, and without a container here the pills would stay at
     base size and overflow a 390px phone. */
  .pprow {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 6px 0 10px;
    container-type: inline-size;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 7px;
  }
  /* The narrow lattice tier's other pixel source: PowerupPill shrinks its own
     type and padding at this same 390px boundary (390 covers the iOS font
     drift that wrapped a 393pt iPhone — the reasoning lives at the tier in
     PowerupPill), and the two column gaps give back 4px more — together they
     put the widest row (~327px) inside a 360pt phone's 332px box. Row gap
     stays 8px; the ::after tap extensions are capped at half of it and must
     keep meeting exactly. */
  @container (max-width: 390px) {
    .row {
      gap: 8px 5px;
    }
  }
</style>

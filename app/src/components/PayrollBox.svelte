<script lang="ts" module>
  import type { Bank } from "../lib/engine.svelte";

  /** Whose payroll a fixed-cap mode borrows. Moneyball plays under the 2002
   * A's, Blank Check under the 2005 Yankees — the two clubs those modes are
   * named after — and the hires line names that owner so the box keeps ONE
   * height across every mode. It lives here rather than in either caller
   * because both surfaces have to name the same club or they are not the same
   * box; the caller resolves the name against owners.json, which this
   * component deliberately does not load. */
  export const FIXED_CAP_CLUB: Partial<Record<Bank, { team: string; year: number }>> = {
    moneyball: { team: "OAK", year: 2002 },
    blankcheck: { team: "NYY", year: 2005 },
  };
</script>

<script lang="ts">
  /** The payroll a club plays under: owner × ballpark = payroll, over a meter
   * of what has been spent against it.
   *
   * ONE implementation, two surfaces. The in-game bank box and each club's
   * front office at the finale are the same object at two moments — a player
   * reads this box all game, and the finale is it holding still — so a second
   * copy would drift the moment either was touched. That is why every input
   * here is a plain value rather than a `Game`: the finale renders a SECOND
   * club (the solver's dream roster) that no Game exists for, and a restored
   * finale renders from a stored record rather than live engine state.
   *
   * Every state the in-game box needs is expressible here, because it has to
   * be for that box to move onto this component:
   *  · classic, nothing hired yet — ghost chips and TBD names (`pending`)
   *  · classic, owner hired but no ballpark yet — one ghost, one real
   *  · classic, both hired — the full × = math
   *  · classic, no front office on record — a finale older than these fields:
   *    the payroll alone, and no TBD names, because nothing is still coming
   *  · Moneyball / Blank Check — payroll set outright, no seats to fill
   *  · no denominator yet (`capKnown` false) — a drifting hatch and $??? LEFT
   *  · over payroll — the alarm on the bar, the line, and the figure
   *
   * One size at every width and in both surfaces. There is no wide tier: the
   * box that grew at 760px is what made a desktop finale disagree with the
   * gameplay it was summarizing. */
  import { money } from "../lib/format";

  let {
    bank,
    budget,
    spend,
    ownerName = null,
    ownerBudget = null,
    parkName = null,
    parkMult = null,
    capKnown = true,
    pending = false,
  }: {
    /** Which bank the club plays under. Classic solves an owner and a
     * ballpark; the two fixed caps set payroll outright and have no seats. */
    bank: Bank;
    /** The payroll in force, $M — owner budget × ballpark multiplier under a
     * classic bank, the mode's constant under a fixed one. */
    budget: number;
    /** Committed salary, $M. */
    spend: number;
    /** The owner in the chair. Under a fixed cap this is the real owner of the
     * club whose payroll the mode borrows — the caller resolves the name
     * (owners.json is data this component deliberately does not load). */
    ownerName?: string | null;
    /** That owner's own budget, $M — the left-hand chip of the math. */
    ownerBudget?: number | null;
    parkName?: string | null;
    /** The ballpark's payroll multiplier — the right-hand chip. */
    parkMult?: number | null;
    /** False before an owner is hired: the engine's budget is only the
     * minBudget floor then, a data artifact rather than a real cap, and a bar
     * cannot show a share of a denominator nobody knows yet. */
    capKnown?: boolean;
    /** The club is still being assembled, so an empty seat is a seat still to
     * fill: it wears a ghost chip and a "no owner yet" line. A finished club
     * with no front office on record shows neither — nothing is still coming.
     */
    pending?: boolean;
  } = $props();

  const over = $derived(capKnown && spend > budget);
  const pct = $derived(!capKnown ? 0 : budget > 0 ? Math.min((spend / budget) * 100, 100) : 100);
  /** The full × = line needs both halves; one alone is not a multiplication. */
  const math = $derived(ownerBudget != null && parkMult != null);
</script>

<div class="pay disp">
  <div class="paymath">
    {#if bank === "moneyball"}
      <span class="chip eff">⚾ {money(budget)} PAYROLL</span>
    {:else if bank === "blankcheck"}
      <span class="chip eff">💸 {money(budget)} BLANK CHECK</span>
    {:else if math || pending}
      {#if ownerBudget != null}
        <span class="chip">💰 {money(ownerBudget)}</span>
      {:else}
        <span class="chip ghost">💰</span>
      {/if}
      <span class="op">×</span>
      {#if parkMult != null}
        <span class="chip stad">🏟️ {parkMult.toFixed(2)}</span>
      {:else}
        <span class="chip ghost">🏟️</span>
      {/if}
      <span class="op">=</span>
      {#if capKnown}
        <span class="chip eff">{money(budget)}</span>
      {:else}
        <span class="chip ghost">$???</span>
      {/if}
    {:else}
      <!-- A finished classic club with no front office on record. The payroll
           is still a fact; neither fixed-cap glyph would be true of it, and a
           TBD name would promise something that is not coming. -->
      <span class="chip eff">{money(budget)} PAYROLL</span>
    {/if}
  </div>
  {#if bank === "classic" && (math || pending)}
    <div class="hires">
      <span class="hire" class:tbd={!ownerName}>💰 {ownerName ?? "no owner yet"}</span>
      <span class="hsep">·</span>
      <span class="hire" class:tbd={!parkName}>🏟️ {parkName ?? "no stadium yet"}</span>
    </div>
  {:else if ownerName}
    <!-- Fixed-cap modes hire nobody; the same line carries the real owner whose
         club sets the cap, so the box keeps one height across every mode. -->
    <div class="hires"><span class="hire solo">💰 {ownerName}</span></div>
  {/if}
  <div class="pmeter" class:pover={over} class:pnocap={!capKnown}>
    {#if !capKnown}
      <!-- No denominator: a drifting hatch reads as pure uncertainty rather
           than as a share of something. -->
      <span class="pfill unknown"></span>
    {:else}
      <span class="pfill" class:pzero={spend <= 0} style:width="{over ? 100 : pct}%"></span>
    {/if}
  </div>
  <div class="paylbl">
    <span class="spent">SPENT <span class="pamt">{money(spend)}</span></span>
    {#if !capKnown}
      <span class="nocap">$??? LEFT</span>
    {:else if over}
      <span class="warn"><span class="pamt">{money(spend - budget)}</span> OVER PAYROLL</span>
    {:else}
      <span class="left"><span class="pamt">{money(budget - spend)}</span> LEFT</span>
    {/if}
  </div>
</div>

<style>
  /* No outer margin: the box sits in a sticky HUD column in one surface and
     closes a roster list in the other, and those want different air. Spacing
     is the caller's. */
  .pay {
    border: 2.5px solid var(--ink);
    border-radius: 12px;
    background: var(--card);
    padding: 8px 10px 10px;
  }
  .paymath {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
  }
  .chip {
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 1px 8px;
    background: var(--card);
  }
  .chip.stad {
    background: var(--green-wash);
    border-color: var(--green-8);
    color: var(--green-deep);
  }
  .chip.eff {
    background: var(--yellow);
    border-color: var(--gold-8);
  }
  .chip.ghost {
    border-style: dashed;
    color: var(--gray-ink);
    background: transparent;
  }
  .op {
    color: var(--muted);
  }
  .hires {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 5px;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
  }
  .hire {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 46%;
  }
  /* A lone owner line (fixed-cap modes) owns the whole row. */
  .hire.solo {
    max-width: 100%;
  }
  .hire.tbd {
    color: var(--gray-ink);
    font-style: italic;
    font-weight: 600;
  }
  .hsep {
    color: var(--gray-ink);
  }
  /* Pale interior, darker edge — the rung-2 fill inside a rung-8 line every
     other chip in this game wears.
     The objection to a pale fill is real and answered rather than dodged: the
     fill encodes a QUANTITY, and green-2 against the card measures 1.26:1, far
     too little for the filled AREA to be the signal. So the area is not the
     signal. The fill's CUT EDGE is: a 2.5px green-deep line at 5.18:1 against
     the track, well past the 3:1 a non-text mark needs, and the thing whose
     POSITION says 40% or 96%. Read that way the wash is free to be a wash, and
     it stands 4.10:1 clear of its own edge.
     Measured against the #fffdf6 track: fill 1.26:1, outline 3.39:1, cut edge
     5.18:1. Fill against outline is 2.68:1 with the fill on the light side.
     The over and unknown states keep the relationship: the hatch's light
     stripe is orange-2, and averaged across the pair its interior still sits
     lighter than the orange-8 line around it. */
  .pmeter {
    margin-top: 8px;
    border: 2.5px solid var(--green-8);
    border-radius: 999px;
    height: 17px;
    overflow: hidden;
    background: var(--card);
  }
  .pmeter.pover {
    border-color: var(--orange-8);
  }
  /* No quantity yet to be under or over, so neither hue is honest. */
  .pmeter.pnocap {
    border-color: var(--gray-ink);
  }
  .pfill {
    display: block;
    height: 100%;
    /* Green-5, matching the game board's live meter exactly. The fill has to
       be lighter than the ring around it AND still read as a quantity from
       across the box; green-2 satisfies the first and measures 1.26:1 against
       the track, at which point 40% spent and 96% spent stop looking
       different. Green-5 is 1.97:1 on the track and still sits 1.72:1 lighter
       than its own outline, so it holds both. */
    background: var(--green-5);
    border-right: 2.5px solid var(--green-deep);
    /* The board's meter moves as a signing lands; the finale's paints once at
       its final width, where a transition has no previous value to run from and
       so never fires. One rule covers both. */
    transition: width 0.3s;
  }
  /* At $0 the bar's own right border would still paint a sliver — hide it all. */
  .pfill.pzero {
    border-right: 0;
    background: transparent;
  }
  /* Over payroll there is no edge left to read — the bar is full and then some
     — so the hatch is what says "past the end", and the line goes orange with
     it, so the alarm is one object rather than an orange fill inside a calm
     green ring. */
  .pmeter.pover .pfill {
    border-right: 0;
    background: repeating-linear-gradient(
      -45deg,
      var(--orange-5) 0 8px,
      var(--orange-6) 8px 16px
    );
  }
  /* Unknown payroll: a soft drifting hatch — a loading bar that admits it
     doesn't know where it ends.
     NO `background-size` here, deliberately. Sizing a repeating gradient down
     to one period makes the browser rasterize a single 28.3px tile and repeat
     the bitmap, and the seams between those tiles cut the diagonal into
     squares — the stripes stop being stripes. Left unsized, the gradient is
     painted once across the whole bar and stays continuous.
     The animation is what needs the period instead: at -45° a horizontal shift
     of d moves the pattern d·cos45° along the gradient axis, so one 20px period
     costs 20/cos45° = 28.284px of travel. Sliding by exactly that maps the
     pattern onto itself, which is what makes the loop seamless. */
  .pfill.unknown {
    width: 100%;
    border-right: 0;
    transition: none;
    background: repeating-linear-gradient(-45deg, var(--gray-bg) 0 10px, transparent 10px 20px);
    animation: drift 2.6s linear infinite;
  }
  @keyframes drift {
    to {
      background-position: 28.284px 0;
    }
  }
  /* The two directions money travels. The FIGURE carries the color and the
     size; the words stay a small muted constant — "SPENT" and "LEFT" never
     change, and only what changes should draw the eye. Baseline alignment is
     what lets a 16px number sit in a 10.5px row without shoving it around.
     Orange on the left always means outflow and orange on the right always
     means trouble, because the two never render together: the overrun REPLACES
     the green figure, so an over-payroll box going entirely orange is the
     correct reading of an over-payroll box. */
  .paylbl {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    margin-top: 4px;
  }
  .pamt {
    font-size: 16px;
    font-weight: 800;
    white-space: nowrap;
  }
  .spent .pamt,
  .warn .pamt {
    color: var(--orange);
  }
  .left .pamt {
    color: var(--green-deep);
  }
  /* The one half of this row with no figure in it, so there is nothing for the
     color rule to land on; italic alone marks the unknown. */
  .nocap {
    font-style: italic;
  }
</style>

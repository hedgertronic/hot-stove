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
   *  · no owner yet (`capKnown` false) — the payroll IS $0: a drifting gray
   *    hatch and $0 LEFT while nothing is spent, and the over-payroll alarm
   *    from the first dollar after that (see `over`)
   *  · over payroll — the alarm on the bar, the line, and the figure
   *
   * `mini` renders the bar alone, which is how the finale's ledger carries a
   * payroll inside a single 44px row. It is the same bar under the same rules,
   * scaled down: the ledger's copy of this markup is exactly the parallel that
   * drifted before, so the ledger gets the component instead of a lookalike.
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
    mini = false,
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
    /** False before an owner is hired. The engine's budget is only the
     * minBudget floor then — a data artifact rather than a real cap — so the
     * box reads the club's payroll as $0 and shows it that way throughout. */
    capKnown?: boolean;
    /** The club is still being assembled, so an empty seat is a seat still to
     * fill: it wears a ghost chip and a "no owner yet" line. A finished club
     * with no front office on record shows neither — nothing is still coming.
     */
    pending?: boolean;
    /** Draw the bar and nothing else, at ledger-row scale — no math line, no
     * hires, no legend. The caller owns the width; everything inside the bar is
     * this component's. */
    mini?: boolean;
  } = $props();

  /** A club with no owner has a payroll of ZERO, and the box says so in every
   * one of its four registers rather than in one.
   *
   * That is the whole point of the owner seat: the chair is where a payroll
   * comes from, so an empty chair is not an unknown number, it is no number.
   * Saying "$???" made it a mystery the player was waiting on; saying "$0"
   * makes it a state they can fix, and every consequence follows from the zero
   * without needing its own rule — spend is measured against $0, so the first
   * dollar committed is a dollar over, and $0 is what is LEFT until then.
   *
   * The bar goes with it. Over $0 is over, so a pre-owner club that has signed
   * anybody wears the same orange alarm an over-payroll club wears, and the
   * gray drifting hatch is left holding exactly one state: nothing hired,
   * nothing spent. That is what it always meant.
   *
   * A DISPLAY rule, and only a display rule. The engine's cap arithmetic is
   * untouched: `effectiveBudget` still falls back to the league-minimum floor,
   * the luxury tax and the payroll bonus are still computed from it, and
   * nothing here can move a point either way. The box is telling the player
   * what hiring an owner is for; it is not scoring them on it.
   *
   * Nothing on the finale can disagree: a classic club is not complete until an
   * owner is in the chair, so the finale never renders this state at all. What
   * the player sees instead is the flip — the moment an owner is hired the same
   * spend turns from OVER into LEFT, which is exactly what hiring one did. */
  const over = $derived(spend > (capKnown ? budget : 0));
  const pct = $derived(!capKnown ? 0 : budget > 0 ? Math.min((spend / budget) * 100, 100) : 100);
  /** The one state with no quantity to be under or over: no owner, nothing
   * spent. The drifting gray hatch belongs to it alone now. */
  const blank = $derived(!capKnown && spend <= 0);
  /** How far past the payroll — and with no owner hired the payroll is $0, so
   * everything committed is the overrun. */
  const overBy = $derived(spend - (capKnown ? budget : 0));
  /** Below break-even: the payroll bonus is 10·(2·spend/budget − 1), so under
   * HALF the payroll it runs negative and the bar wears gold — the meter's
   * "not enough yet" register, distinct from the blank state's gray (no
   * quantity at all) and the over state's orange (past the end). Spending
   * NOTHING against a known cap is the deepest form of it (−10), so an empty
   * bar with an owner in the chair goes gold too; exactly half is bonus zero
   * and reads green. Display only, like `over` — the scoring never reads it. */
  const low = $derived(capKnown && !over && spend * 2 < budget);
  /** The full × = line needs both halves; one alone is not a multiplication. */
  const math = $derived(ownerBudget != null && parkMult != null);
</script>

<!-- The bar, alone, so the box and the finale's ledger row hold the SAME object
     rather than two that agree by hand. -->
{#snippet meter()}
  <div class="pmeter" class:mini class:pover={over} class:pnocap={blank} class:plow={low}>
    {#if blank}
      <!-- Nothing hired and nothing spent: no quantity in either direction, so
           a drifting hatch reads as the empty page it is. -->
      <span class="pfill unknown"></span>
    {:else}
      <span class="pfill" class:pzero={spend <= 0} style:width="{over ? 100 : pct}%"></span>
    {/if}
  </div>
{/snippet}

{#if mini}
  {@render meter()}
{:else}
  <div class="pay disp">
    <div class="paymath">
      {#if bank === "moneyball"}
        <span class="chip eff">⚾ {money(budget)} PAYROLL</span>
      {:else if bank === "blankcheck"}
        <span class="chip eff">💸 {money(budget)} BLANK CHECK</span>
      {:else if math || pending}
        {#if ownerBudget != null}
          <span class="chip own">💰 {money(ownerBudget)}</span>
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
          <!-- Dashed, because a payroll is still coming; $0, because until it
               does there genuinely isn't one. Both halves of the multiplication
               above it are still ghosts — nothing is claiming this zero is a
               product, only that it is what the club has to spend. -->
          <span class="chip ghost">{money(0)}</span>
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
    {@render meter()}
    <div class="paylbl">
      <span class="spent">SPENT <span class="pamt">{money(spend)}</span></span>
      {#if over}
        <span class="warn"><span class="pamt">{money(overBy)}</span> OVER</span>
      {:else}
        <span class="left"
          ><span class="pamt">{money((capKnown ? budget : 0) - spend)}</span> LEFT</span
        >
      {/if}
    </div>
  </div>
{/if}

<style>
  /* No outer margin: the box sits in a sticky HUD column in one surface and
     closes a roster list in the other, and those want different air. Spacing
     is the caller's. */
  .pay {
    border: 2.5px solid var(--line);
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
    border: 2px solid var(--line);
    border-radius: 999px;
    padding: 1px 8px;
    background: var(--card);
  }
  /* The ballpark's own hue, and it is the ballpark's because the FRONT OFFICE
     tile a player buys it from is this exact pair (`SpecialRows .srow.stad`).
     The chip and the tile MUST move together — the chip once read green while
     the tile read blue, which made the multiplier look like a different object
     from the thing that set it, and it went stale a second time when the tile
     moved to orange and the chip stayed blue.
     Ink type, not a tinted one: every chip in the game puts ink on a light
     fill, which is app.css's rule. */
  .chip.stad {
    background: var(--orange-2);
    border-color: var(--orange-8);
  }
  /* The owner's own hue — the same pair the FRONT OFFICE owner tile wears
     (`SpecialRows .srow` default: --teal-2 fill, --teal-8 ring). The chip and
     the tile it was born from are the same object; they must read as one. */
  .chip.own {
    background: var(--teal-2);
    border-color: var(--teal-8);
  }
  /* The total-payroll result chip. Neutral cardstock keeps it from colliding
     with either input: the owner chip is teal, the stadium chip is orange, and
     the product chip is the plain surface both inputs sit on — the math reads
     as an equation rather than as three competing categories. */
  .chip.eff {
    background: var(--card);
    border-color: var(--line);
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
  /* Pale interior, one green line — the wash-inside-a-rung-8-line every other
     chip in this game wears.
     The objection to a pale fill is real and answered rather than dodged: the
     fill encodes a QUANTITY, and green-2 against the card measures 1.26:1, far
     too little for the filled AREA to be the signal. So the area is not the
     signal. The fill's CUT EDGE is: a 2.5px green-8 line at 3.39:1 against the
     track, clear of the 3:1 a non-text mark needs, and the thing whose POSITION
     says 40% or 96%. Read that way the wash is free to be a wash.
     The outline and that cut edge are the SAME green, because they are the same
     line: the ring around the track and the mark riding inside it are one drawn
     object, and two greens a rung apart read as a mistake at 17px rather than
     as a hierarchy.
     Measured against the #fffdf6 track: fill 1.97:1, line 3.39:1, and the fill
     sits 1.72:1 lighter than the line it rides in.
     The over and unknown states keep the relationship: their hatches average
     lighter than the orange-8 / gray-ink line around them. */
  .pmeter {
    margin-top: 8px;
    border: 2.5px solid var(--green-8);
    border-radius: 999px;
    height: 17px;
    overflow: hidden;
    background: var(--card);
    /* This rounded clip is the ONLY thing keeping the fill inside the pill, and
       it has to hold across a compositing boundary. Every state's hatch
       animates `transform` on `.pfill`'s ::before, and an animated transform is
       promoted to a layer of its own — Chrome's LayerTree gives the reason as
       `ActiveTransformAnimation` for all three hatches at both sizes. A
       promoted layer is composited against its ancestors instead of painted
       inside them, so `overflow: hidden` over a 999px radius stops being paint
       this element performs and becomes a clip that must be carried to the
       child's layer; the shape is a rectangle wherever that clip is not
       carried, which is a fill painting over its own outline at the four
       corners. Declaring `will-change` gives the track a layer up front, so the
       rounded shape is the clipping layer's OWN rather than something a child's
       layer has to inherit.
       The corner-rounding is load-bearing HERE and cannot move down: the fill's
       flat right edge is the quantity — its position is what says 40% or 96% —
       so `.pfill` can never carry a radius, which leaves this track as the only
       object in the box that owns the pill shape.
       `will-change` rather than a `translateZ(0)` because the hack rasterizes
       this 2.5px line through a real transform, and a resampled hairline curve
       at 17px is the one cost the bar cannot pay. */
    will-change: transform;
  }
  /* The ledger row's miniature. The same bar under the same rules at a third
     the height — the width belongs to the row that places it, because the row
     is what has to fit. */
  .pmeter.mini {
    margin-top: 0;
    height: 8px;
    border-width: 1.5px;
  }
  .pmeter.mini .pfill {
    border-right-width: 1.5px;
  }
  .pmeter.pover {
    border-color: var(--orange-8);
  }
  /* Below break-even the whole state goes gold, the same way over goes orange:
     ring, fill and edge together, because the border is what carries state
     tinting on this meter (app.css's held-off rule). The bar still encodes its
     quantity — area, cut edge, stripes one rung apart, exactly the green
     anatomy at gold-5/6/8 — so the POSITION still reads while the hue says
     "the bonus is running negative until this bar reaches half." */
  .pmeter.plow {
    border-color: var(--gold-8);
  }
  .pmeter.plow .pfill {
    background: var(--gold-5);
    border-right-color: var(--gold-8);
  }
  .pmeter.plow .pfill::before {
    background: repeating-linear-gradient(-45deg, transparent 0 12px, var(--gold-6) 12px 24px);
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
    border-right: 2.5px solid var(--green-8);
    /* The drifting states below paint their stripes on a ::before wider than
       the bar; this is the box that clips the overhang. The track's rounded
       ends clip what reaches them. */
    position: relative;
    overflow: hidden;
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
  /* ALL THREE STATES, in one motion.
     The drift used to belong to the two unsettled states alone, on the reading
     that a moving bar says "this number is not where it lands". The trouble
     with that reading is that it made the calm state the odd one out: a green
     bar sitting perfectly still beside two that crawl looks like a different
     component, and a player reads the STILLNESS as the anomaly rather than as
     the reassurance. So every state drifts at the same 10.9px/s and the hue is
     what says which one it is — the same division of labor the rest of the box
     runs on.
     What still separates them is the EDGE, which is a stronger signal than
     motion ever was. Green has one and its position is the quantity. Over
     payroll has none: the bar is full and then some, so the hatch is what says
     "past the end" and the ring goes orange with it rather than framing an
     alarm in a calm green line. The blank state has none either, and the label
     beside it reads $0 SPENT, which no full green bar ever does.
     Green keeps its solid green-5 UNDER the hatch rather than replacing it, so
     the fill still reads as a filled area at a glance and the stripes are
     texture on top. The other two have no area to preserve and paint the
     stripes directly. */
  .pfill.unknown,
  .pmeter.pover .pfill {
    border-right: 0;
    background: none;
  }
  /* Each state's own period, in horizontal pixels, and the time to travel it.
     At -45° a horizontal shift of d moves the pattern d·cos45° along the
     gradient axis, so a 20px period costs 20/cos45° = 28.284px of travel and a
     16px period costs 22.627px. The durations are that distance at one shared
     speed, so the two hatches drift at the same rate rather than merely in the
     same direction. */
  .pfill.unknown {
    width: 100%;
    transition: none;
    --drift: 28.284px;
    --drift-time: 2.6s;
  }
  .pmeter.pover .pfill {
    --drift: 22.627px;
    --drift-time: 2.08s;
  }
  /* Green runs the widest period of the three. Its stripes are one rung apart
     rather than a hue against nothing, so they are the faintest of the set, and
     a coarser pattern is what keeps them legible at that contrast. */
  .pfill:not(.unknown) {
    --drift: 33.941px;
    --drift-time: 3.12s;
  }
  /* The stripes ride a pseudo-element ONE PERIOD wider than the bar, translated
     by exactly that period. Sliding by one period maps the pattern onto itself,
     which is what makes the loop seamless, and the extra period is runway: no
     edge of the painted image ever crosses the visible bar.
     That runway is why this animates `transform` rather than
     `background-position`. A gradient with no `background-size` is painted at
     exactly the size of its box and then TILED, so shifting it sideways slides
     a tile boundary into view — and unless the bar happens to be a whole number
     of 28.284px periods wide, that boundary is a phase jump: a seam sweeping
     the first inch of the bar, once per cycle.
     And NO `background-size` here, deliberately. Sizing a repeating gradient
     down to one period makes the browser rasterize a single 28.3px tile and
     repeat the bitmap, and the seams between those tiles cut the diagonal into
     squares — the stripes stop being stripes.
     Reduced motion needs nothing here: app.css stops animations on `*::before`
     along with everything else, which leaves both hatches standing still. */
  .pfill::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: calc(100% + var(--drift));
    animation: drift var(--drift-time) linear infinite;
    /* Green-6 over the green-5 the fill is already painted: one rung apart, the
       same step orange takes between its two stripes, and the faintest thing
       the box draws. That is right for the state which is not asking for
       anything — loud stripes on the calm bar would make being under payroll
       look like a problem. */
    background: repeating-linear-gradient(-45deg, transparent 0 12px, var(--green-6) 12px 24px);
  }
  /* The two states with no area under the stripes: nothing beneath carries the
     reading, so the pattern IS the fill and both of its bands are painted. */
  .pfill.unknown::before {
    background: repeating-linear-gradient(-45deg, var(--gray-bg) 0 10px, transparent 10px 20px);
  }
  .pmeter.pover .pfill::before {
    background: repeating-linear-gradient(-45deg, var(--orange-5) 0 8px, var(--orange-6) 8px 16px);
  }
  @keyframes drift {
    from {
      transform: translateX(calc(var(--drift) * -1));
    }
    to {
      transform: translateX(0);
    }
  }
  /* The two directions money travels. The FIGURE carries the color and the
     size; the words stay a small muted constant — "SPENT" and "LEFT" never
     change, and only what changes should draw the eye. Baseline alignment is
     what lets a 16px number sit in a 10.5px row without shoving it around.
     Orange on the left always means outflow and orange on the right always
     means trouble, because the green figure is never one of the pair: the
     overrun REPLACES it, so an over-payroll box going entirely orange is the
     correct reading of an over-payroll box.
     The pre-owner club is the one row where the two orange figures carry the
     SAME number — everything spent, and all of it over. It reads as a
     duplicate until the chip above it is read, and the chip above it says the
     payroll is $0: spent and over ARE the same figure when there is no payroll
     for any of it to be inside of. Hiring an owner is what separates them. */
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
</style>

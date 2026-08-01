<script lang="ts">
  import { BADGES, type BadgeDef, type Rarity } from "../lib/badges";
  import { badgeCase } from "../lib/settings";
  import BadgePill from "./BadgePill.svelte";
  import Sheet from "./Sheet.svelte";

  /** The lifetime trophy case, as a modal. The board is the whole set — earned
   * badges wear the finale's own pill, unearned ones a silhouette, so the case
   * answers "what is left" as well as "what I have". Anti-trophies appear only
   * once earned and sit outside the fraction: they are neither chased nor
   * countable, but they do get a pill.
   *
   * The case is lifetime and global, so it is read once when the modal opens.
   * The component is created fresh per open, which is what keeps it current. */
  let { onclose }: { onclose: () => void } = $props();

  const trophies = badgeCase();
  const earnedCount = new Map(trophies.tiles.map((t) => [t.key, t.count]));

  /** The collection ladder as sections, rarest first. Rarity is a heading over
   * a band of pills rather than a word on each pill: every pill under a heading
   * shares its tier, so the word still carries rarity on a channel that is not
   * color — it is just printed once instead of N times. */
  const CHASED: Rarity[] = ["legend", "ultra", "rare", "uncommon", "common"];

  interface CaseSlot {
    def: BadgeDef;
    count: number;
    locked: boolean;
  }

  function slots(rarity: Rarity): CaseSlot[] {
    const band = BADGES.filter((b) => b.rarity === rarity);
    // Earned, then named silhouettes, then the question marks — most legible to
    // least, so a band reads left to right as "have / could aim at / no idea".
    //
    // Anti-trophies DO get a locked slot, but a fully anonymous one: BadgePill
    // withholds their glyph as well as their name. The constraint that matters
    // was never "no slot", it was "no invitation" — a slot reading "💀 100-LOSS
    // CLUB" tells a player how to farm it, and "? ? ?" tells them nothing. They
    // still sit outside the progress fraction, which is counted from
    // COLLECTIBLE and never from what is on screen.
    const locked = band.filter((b) => !earnedCount.has(b.key));
    const anonymous = (b: BadgeDef) => b.secret === true || b.ironic === true;
    return [
      ...band
        .filter((b) => earnedCount.has(b.key))
        .map((b) => ({ def: b, count: earnedCount.get(b.key)!, locked: false })),
      ...locked.filter((b) => !anonymous(b)).map((b) => ({ def: b, count: 1, locked: true })),
      ...locked.filter(anonymous).map((b) => ({ def: b, count: 1, locked: true })),
    ];
  }

  const sections = [...CHASED, "ironic" as Rarity]
    .map((rarity) => ({ rarity, items: slots(rarity) }))
    .filter((s) => s.items.length > 0);

  /** The one opened badge, by key. Only an EARNED pill is a button, so only an
   * earned badge can ever land here — a locked slot has nothing to open, and
   * revealing its trigger would pre-spend the surprise the silhouette exists to
   * protect. One at a time: the detail is a single node under the band that
   * holds the open pill, so nothing is rendered for any badge but that one. */
  let opened = $state<string | null>(null);
  const shown = $derived(opened === null ? null : (BADGES.find((b) => b.key === opened) ?? null));

  function toggle(key: string) {
    opened = opened === key ? null : key;
  }
</script>

<Sheet {onclose} label="Trophy case" tall>
  <div class="sheet-h">
    TROPHY CASE · {trophies.earned} OF {trophies.total}
    <button class="x" onclick={onclose} aria-label="Close">✕</button>
  </div>

  {#if trophies.tiles.length === 0}
    <p class="caseempty">No badges yet — play a season.</p>
  {/if}

  {#each sections as s (s.rarity)}
    <div class="band">
      <div class="bandcap">{s.rarity}</div>
      <!-- No tabindex: the band wraps rather than scrolls, so every pill is on
           screen and reachable by tabbing the buttons themselves. The
           scrollable-region pattern WCAG 2.1.1 asks for only applies to a
           container that hides content, and this one no longer does. -->
      <div class="bandrow" role="group" aria-label="{s.rarity} badges">
        {#each s.items as slot (slot.def.key)}
          {#if slot.locked}
            <BadgePill badge={slot.def} count={slot.count} locked />
          {:else}
            <!-- The pill itself comes from BadgePill and is not interactive, so
                 the button is a bare wrapper: no box of its own, the pill's
                 geometry unchanged, and the hit target exactly the pill. -->
            <button
              class="slot"
              aria-expanded={opened === slot.def.key}
              aria-controls={opened === slot.def.key ? "badge-how" : undefined}
              onclick={() => toggle(slot.def.key)}
            >
              <BadgePill badge={slot.def} count={slot.count} />
            </button>
          {/if}
        {/each}
      </div>
      {#if shown && shown.rarity === s.rarity}
        <!-- The reveal sits under the band that holds the open pill, outside
             the scroller: it reads at the tap, wraps to the full modal width
             instead of a pill's column, and never changes the row's height. -->
        <p class="how" id="badge-how">{shown.how}</p>
      {/if}
    </div>
  {/each}

  <button class="btn cancel" onclick={onclose}>CLOSE</button>
</Sheet>

<style>
  .sheet-h {
    text-align: center;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    margin-bottom: 10px;
    position: relative;
  }
  .x {
    position: absolute;
    right: 0;
    top: -2px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    color: var(--muted);
    font-family: inherit;
    font-weight: 800;
    font-size: 10px;
    line-height: 1;
    padding: 4px 8px;
    cursor: pointer;
  }
  .caseempty {
    margin: 0;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--gray-ink);
    padding: 6px 0 2px;
  }
  .band + .band {
    margin-top: 9px;
  }
  /* One rarity band: the tier word as an eyebrow over a single row of pills.
     It borrows the record book's caption voice rather than adding a third
     header style to a surface that already has .psep and .bcap. */
  .bandcap {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--muted);
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  /* The band wraps; the sheet is the only thing that scrolls, and only in y.
     A horizontal scroller hid pills behind an edge with no affordance for them
     — on macOS the scrollbar is an invisible overlay until you already know to
     drag — so the whole case is one vertical column now. Nothing is off-screen
     that a thumb cannot reach by the gesture the sheet already uses. */
  .bandrow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  /* A bare wrapper: the pill keeps its own shape, the button contributes none. */
  .slot {
    display: block;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    border-radius: 999px;
  }
  .slot:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* The trigger, in the player's own words. Dashed cardstock so it reads as a
     note pinned under the band rather than another pill. */
  .how {
    margin: 5px 0 0;
    border: 2px dashed var(--gray-ink);
    border-radius: 9px;
    background: var(--card);
    color: var(--ink);
    font-size: 11.5px;
    font-weight: 700;
    line-height: 1.4;
    padding: 7px 10px;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
    margin-top: 14px;
  }
</style>

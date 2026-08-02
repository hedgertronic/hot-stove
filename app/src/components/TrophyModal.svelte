<script lang="ts">
  import { BADGES, RARITY_ORDER, type BadgeDef, type Rarity } from "../lib/badges";
  import { badgeCase, passport, takeOpenedBadgeCue } from "../lib/settings";
  import BadgePill from "./BadgePill.svelte";
  import BadgeSlot from "./BadgeSlot.svelte";
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

  /** The badges earned since the case was last opened — the same NEW chip the
   * finale spends, on the same pill, so the news the glowing trophy promised
   * is actually findable once the player is inside.
   *
   * Taken ONCE, here, at mount. The trophy button clears the cue on the tap
   * that opens this sheet, so reading storage now would find it already empty;
   * `takeOpenedBadgeCue` hands over what that clear removed. Taken rather than
   * read, so closing and reopening shows a clean board. */
  const freshKeys = new Set(takeOpenedBadgeCue());

  interface CaseSlot {
    def: BadgeDef;
    count: number;
    locked: boolean;
    fresh: boolean;
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
    // Within the earned run, the NEW ones lead — the same order `bragRow` puts
    // the finale's pills in, and for the same reason: a flagged badge is the
    // one the player opened the case to find, so it should not be somewhere in
    // the middle of a band of twelve.
    const earned = band
      .filter((b) => earnedCount.has(b.key))
      .map((b) => ({
        def: b,
        count: earnedCount.get(b.key)!,
        locked: false,
        fresh: freshKeys.has(b.key),
      }))
      .sort((a, b) => Number(b.fresh) - Number(a.fresh));
    return [
      ...earned,
      ...locked
        .filter((b) => !anonymous(b))
        .map((b) => ({ def: b, count: 1, locked: true, fresh: false })),
      ...locked.filter(anonymous).map((b) => ({ def: b, count: 1, locked: true, fresh: false })),
    ];
  }

  /** The collection ladder as sections, rarest first. Rarity is a heading over
   * a band of pills rather than a word on each pill: every pill under a heading
   * shares its tier, so the word still carries rarity on a channel that is not
   * color — it is just printed once instead of N times.
   *
   * The order is lib/badges' RARITY_ORDER, not a copy of it: a tier added there
   * gets a band here without this file being touched, and cannot land in a
   * different position than the case's own tile sort puts it. */
  const sections = RARITY_ORDER.map((rarity) => ({ rarity, items: slots(rarity) }))
    .filter((s) => s.items.length > 0);

  /** The passport: every birth country this player has ever fielded, newest
   * first. Read once at mount for the same reason the case is.
   *
   * It is a souvenir panel, not a band, and it is deliberately not built like
   * one. It holds no locked slots, no total and no fraction — nothing in the
   * game shows a birth country, so a grid of 39 with 27 grayed out would be
   * pointing a player at a hunt they have no way to run. What is here is what
   * they have already been to.
   *
   * Empty is not rendered at all. A "PASSPORT · 0 COUNTRIES" heading over an
   * empty box is the checklist wearing a different hat; a panel that simply
   * appears the first time a country lands is the happy accident it is
   * supposed to be.
   *
   * It sits outside the progress fraction by construction rather than by a
   * filter: that number is `trophies.earned` of `trophies.total`, both counted
   * from the badge table, and a country is not a badge. */
  const stamps = passport();

  /** The one opened badge, by key. Only an EARNED pill is a button, so only an
   * earned badge can ever land here — a locked slot has nothing to open, and
   * revealing its trigger would pre-spend the surprise the silhouette exists to
   * protect. One at a time: BadgeSlot renders the reveal only for the badge
   * whose key this holds, so nothing is rendered for any of the others. */
  let opened = $state<string | null>(null);

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
      <div class="psep">{s.rarity.toUpperCase()}</div>
      <!-- No tabindex: the band wraps rather than scrolls, so every pill is on
           screen and reachable by tabbing the buttons themselves. The
           scrollable-region pattern WCAG 2.1.1 asks for only applies to a
           container that hides content, and this one no longer does.

           BadgeSlot emits the button and, when open, the reveal — both as
           children of this row, which is how the trigger lands on its own line
           directly under the pill that was tapped. -->
      <div class="bandrow" role="group" aria-label="{s.rarity} badges">
        {#each s.items as slot (slot.def.key)}
          {#if slot.locked}
            <BadgePill badge={slot.def} locked />
          {:else}
            <BadgeSlot
              badge={slot.def}
              count={slot.count}
              fresh={slot.fresh}
              open={opened === slot.def.key}
              ontoggle={() => toggle(slot.def.key)}
            />
          {/if}
        {/each}
      </div>
    </div>
  {/each}

  {#if stamps.length > 0}
    <!-- Its own panel, below the ladder: the bands answer "what have I
         collected", this answers "where have I been". The heading counts what
         is there and stops — no "of 39", because a denominator would turn a
         souvenir into an errand. -->
    <div class="band">
      <div class="psep">
        PASSPORT · {stamps.length}
        {stamps.length === 1 ? "COUNTRY" : "COUNTRIES"}
      </div>
      <div class="stamps" role="list" aria-label="Countries visited">
        {#each stamps as s (s.country)}
          <!-- Square-ish and hairline-bordered on purpose: a 999px pill on
               this sheet means "badge", and a country is not one. -->
          <span
            class="stamp"
            role="listitem"
            title={s.first ? `First fielded ${s.first}` : undefined}
          >
            {s.country}{#if s.visits > 1}<span class="visits">×{s.visits}</span
              >{/if}
          </span>
        {/each}
      </div>
    </div>
  {/if}

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
  /* Bands are headed by the app's own dashed separator (.psep, global in
     app.css — the same rule FRONT OFFICE and BALL KNOWLEDGE use), so the case
     introduces no header style of its own. Its own padding sets the rhythm
     between bands, which is why there is no margin rule here. */
  .band + .band {
    margin-top: 6px;
  }
  /* The band wraps and centers; the sheet is the only thing that scrolls, and
     only in y. Nothing is ever off-screen, so there is no affordance to teach —
     a horizontal scroller hid pills behind an edge that, on macOS, has an
     invisible overlay scrollbar until you already know to drag. Centered because
     the bands are ragged by nature: a rarity holds anywhere from one pill to a
     dozen, and a ragged right edge reads as a list that ran out. */
  .bandrow {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    /* BadgeSlot's contract: the row is the containing block for an opened
       badge's panel, which is what fences the panel inside the sheet. The
       sheet scrolls in y, so a panel that reached past this box would earn the
       sheet a horizontal scrollbar as well. */
    position: relative;
  }
  /* The passport wraps and centers like a band, so the two panels share one
     rhythm down the sheet and the passport does not read as a different
     screen bolted on. */
  .stamps {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }
  /* A stamp, not a pill. The badge pills on this sheet are 999px capsules with
     an ink border and a rarity wash; a country wears a small radius, a gray
     hairline and paper — the same quiet register `.brag.common` uses for the
     floor of the ladder, one step below the ink every collectible gets. It is
     not a rarity, so it must not borrow a rarity's fill. */
  .stamp {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 2px solid var(--gray-ink);
    border-radius: 4px;
    background: var(--card);
    color: var(--muted-2);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px;
    white-space: nowrap;
  }
  .visits {
    opacity: 0.7;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
    margin-top: 14px;
  }
</style>

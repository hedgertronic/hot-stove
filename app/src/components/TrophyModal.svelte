<script lang="ts">
  import { BADGES, bankLocked, RARITY_ORDER, type BadgeDef, type Rarity } from "../lib/badges";
  import type { Bank, Difficulty } from "../lib/engine.svelte";
  import {
    badgeCase,
    passportBoard,
    stampLabel,
    stampReveal,
    takeOpenedBadgeCue,
    type CaseFilter,
    type PassportItem,
  } from "../lib/settings";
  import { balancewrap } from "../lib/balancewrap";
  import BadgePill from "./BadgePill.svelte";
  import FilterGlyph from "./FilterGlyph.svelte";
  import BadgeSlot from "./BadgeSlot.svelte";
  import PillSlot from "./PillSlot.svelte";
  import Sheet from "./Sheet.svelte";

  /** The lifetime trophy case, as a modal: badges, then the passport, on one
   * scrolling sheet. The board is the whole set — earned badges wear the
   * finale's own pill, unearned ones a silhouette, so the case answers "what is
   * left" as well as "what I have", by showing it rather than by counting it.
   * Anti-trophies appear only once earned: they are neither chased nor
   * countable, but they do get a pill.
   *
   * The case is lifetime and global, so it is read once when the modal opens.
   * The component is created fresh per open, which is what keeps it current. */
  let { onclose }: { onclose: () => void } = $props();

  /** The mode lens, multi-select toggles on both axes, everything on by
   * default. Picks combine by `CaseFilter`'s own contract: within an axis
   * they OR (Box Score + Eye Test = either ladder), across axes they AND
   * (Box Score + Moneyball = Box Score games on the Moneyball bank). A lens
   * exists because a badge earned against Box Score's easy ladder says
   * nothing about the Eye Test career the player is proud of. Silhouettes
   * under a lens are the point: a badge earned elsewhere shows as
   * still-to-get HERE.
   *
   * AN EMPTY AXIS IS AN UNFILTERED AXIS — `CaseFilter`'s own reading, adopted
   * here whole rather than half. Turning off both ladder chips means "any
   * ladder", not "no ladder": all-off and all-on ask the same question on
   * that axis, and the board never goes blank under a combination of
   * deselections. (The alternative — empty axis matches nothing — made four
   * chips off a filter and five chips off a void, which is a cliff, not a
   * lens.)
   *
   * THE FULL BOARD IS NO LENS AT ALL. With every chip on, `caseFilter` is
   * `undefined` rather than "both full sets", and the difference is the rows
   * too old to name a mode: a real filter excludes them (a lens can only show
   * what a row claims), the unfiltered case counts them. ALL is the reset
   * that puts every chip back on — a plain word, not a sixth chip, because it
   * is an action on the board rather than a member of it. */
  type LensKey = Difficulty | Bank;
  const DIFF_ROW: { key: LensKey; label: string }[] = [
    { key: "standard", label: "BOX SCORE" },
    { key: "scout", label: "EYE TEST" },
  ];
  const BANK_ROW: { key: LensKey; label: string }[] = [
    { key: "classic", label: "GROUND UP" },
    { key: "moneyball", label: "MONEYBALL" },
    { key: "blankcheck", label: "BLANK CHECK" },
  ];
  const ALL_KEYS: LensKey[] = [...DIFF_ROW, ...BANK_ROW].map((f) => f.key);
  let picked = $state<LensKey[]>([...ALL_KEYS]);
  /** The lens board hides behind the corner funnel until asked for — most
   * opens of the case are "what do I have", not "slice it by mode", and the
   * two chip rows charged every open for the rare one. Closing the board
   * does NOT clear the lens (a deliberate pair: the funnel pill tints ink
   * while any lens is live, so a filtered board is never silently filtered). */
  let filtersOpen = $state(false);
  const allOn = $derived(picked.length === ALL_KEYS.length);
  function toggleLens(k: LensKey) {
    picked = picked.includes(k) ? picked.filter((x) => x !== k) : [...picked, k];
  }
  const caseFilter = $derived.by((): CaseFilter | undefined => {
    if (allOn) return undefined;
    return {
      difficulties: picked.filter((k): k is Difficulty => k === "standard" || k === "scout"),
      banks: picked.filter(
        (k): k is Bank => k === "classic" || k === "moneyball" || k === "blankcheck",
      ),
    };
  });

  const trophies = $derived(badgeCase(caseFilter));
  const earnedCount = $derived(new Map(trophies.tiles.map((t) => [t.key, t.count])));

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
    // A badge no picked bank can mechanically produce (badges.ts `banks` —
    // the four front-office badges under a fixed-cap lens) gets no locked
    // slot: a silhouette says "could aim at", and under that lens it would be
    // lying. Earned tiles need no twin check — a ⛲ was necessarily earned in
    // a bank that CAN produce it, and the history lens already filters rows
    // by bank. badgeCase drops the same badges from the N OF M denominator.
    const lensBanks = caseFilter?.banks ?? [];
    const locked = band.filter((b) => !earnedCount.has(b.key) && !bankLocked(b, lensBanks));
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

  /** The countries this career has fielded, rarest first.
   *
   * `passportBoard()` draws only what has been collected; see the note on it
   * for why the unvisited half of the table is not on the sheet. A country
   * nobody has been to is not a locked slot here, unlike a badge — the two
   * absences are different, and the note on `passportBoard` is where the
   * difference is argued.
   *
   * The mode lens reaches the stamps exactly as it reaches the badges — the
   * same `rowInLens` predicate over the same history rows — so a Moneyball
   * lens shows the countries Moneyball games fielded. Rows too old to name a
   * mode stamp only under ALL, the badge board's own rule. */
  const items = $derived(passportBoard(caseFilter));

  /** The stamps that belong to one rarity, in the board's own order.
   *
   * ONE LADDER, NOT TWO. Countries carry the same measured tier badges do and
   * the pills already wear it, so a PASSPORT band of its own was filing them by
   * WHAT THEY ARE when the sheet is organized by HOW RARE THEY ARE — an ultra
   * country sat two screens below the ultra badges it is exactly as hard to
   * get. Mixed into the bands, the case answers one question per heading.
   *
   * Nothing distinguishes them but SHAPE, and nothing needs to: a stamp is a
   * 4px rectangle and a badge is a 999px capsule (Passport.svelte and
   * BadgePill.svelte respectively, both by long-standing intent), so the two
   * kinds read apart at a glance inside one band without a word of labelling.
   *
   * Only four tiers ever fill: `legendary` is the top of a badge axis and
   * `ironic` is an anti-trophy, and no birthplace is either — see the country
   * table in settings.ts. Those two bands hold badges alone, which is correct
   * rather than incidental.
   *
   * A country the table does not know has no tier to file under, and there are
   * none today — it takes a data regen adding a fortieth country to make one.
   * It lands at the foot of the LAST measured band rather than nowhere: the
   * bottom of the bottom band is where an unranked thing sorts without claiming
   * a rank, and the stamp still draws in its own plain paper, which is visibly
   * quieter than a common one. Losing it off the sheet entirely is the only
   * outcome this must not have. */
  const LAST_MEASURED = RARITY_ORDER[RARITY_ORDER.length - 2];
  function flags(rarity: Rarity): PassportItem[] {
    const tiered = items.filter((s) => s.rarity === rarity);
    if (rarity !== LAST_MEASURED) return tiered;
    return [...tiered, ...items.filter((s) => s.rarity === null)];
  }

  /** The collection ladder as sections, rarest first. Rarity is a heading over
   * a band of pills rather than a word on each pill: every pill under a heading
   * shares its tier, so the word still carries rarity on a channel that is not
   * color — it is just printed once instead of N times. The stamps under it
   * share it too, which is the whole reason they are in the band.
   *
   * The order is lib/badges' RARITY_ORDER, not a copy of it: a tier added there
   * gets a band here without this file being touched, and cannot land in a
   * different position than the case's own tile sort puts it.
   *
   * A band draws when it holds ANYTHING. Stamps count: a tier whose badges are
   * all unearned and unnamed can still be a tier this career has been to. */
  const sections = $derived(
    RARITY_ORDER.map((rarity) => ({
      rarity,
      items: slots(rarity),
      stamps: flags(rarity),
    })).filter((s) => s.items.length > 0 || s.stamps.length > 0),
  );

  /** The one opened chip on the sheet, badge or country, by a namespaced key.
   *
   * Namespaced because both kinds now sit in the same rows: a badge is its own
   * key, a country is `country:` and its name, so the two sets cannot collide
   * however they are spelled. One at a time across the whole sheet — a slot
   * renders its reveal only when this holds its key, so nothing is rendered for
   * any of the others.
   *
   * Only a COLLECTED chip is ever a button, so only a collected one can land
   * here: a locked badge has nothing to open, and revealing its trigger would
   * pre-spend the surprise the silhouette exists to protect. */
  let opened = $state<string | null>(null);

  function toggle(key: string) {
    opened = opened === key ? null : key;
  }
</script>

<!-- The header is the sheet's name and nothing else.
     It used to carry "12 OF 58". A fraction over a collection turns it into an
     errand: the number a player wants from a trophy case is which trophies they
     have, and the ladder below already shows exactly that — earned pills, then
     silhouettes, then question marks, band by band. The denominator only ever
     answered "how much is left", which is the one question a souvenir should
     not be pressing. The passport lost its count for the same reason on the
     same day. -->
{#snippet corner()}
  <!-- The funnel, in the ✕'s exact pill (28×22, grown tap target, line-art
       glyph) on the header's other shoulder. `lens` tints it ink while any
       lens is live — the one signal that survives closing the board. -->
  <button
    type="button"
    class="fbtn"
    class:lens={!allOn}
    aria-expanded={filtersOpen}
    aria-label="Filter collectibles by mode"
    onclick={() => (filtersOpen = !filtersOpen)}
  ><FilterGlyph /></button>
{/snippet}

<Sheet {onclose} label="Collectibles" tall title="COLLECTIBLES" confirmLabel="CLOSE" {corner}>
  <div>
    <!-- The lens board: one row per axis (ladder, then bank), ALL leading the
         top row as a bare word — it selects everything, so it is an action on
         the chips rather than one of them, and it dresses as a link where
         they dress as pills. Rendered only while the corner funnel holds it
         open. -->
    {#if filtersOpen}
    <div class="filters" role="group" aria-label="Filter collectibles by mode">
      <div class="frow">
        <button type="button" class="fall" onclick={() => (picked = [...ALL_KEYS])}>ALL</button>
        {#each DIFF_ROW as f (f.key)}
          <button
            type="button"
            class="fchip chipbox"
            class:on={picked.includes(f.key)}
            aria-pressed={picked.includes(f.key)}
            onclick={() => toggleLens(f.key)}
          ><span class="chiplbl">{f.label}</span></button>
        {/each}
      </div>
      <div class="frow">
        {#each BANK_ROW as f (f.key)}
          <button
            type="button"
            class="fchip chipbox"
            class:on={picked.includes(f.key)}
            aria-pressed={picked.includes(f.key)}
            onclick={() => toggleLens(f.key)}
          ><span class="chiplbl">{f.label}</span></button>
        {/each}
      </div>
    </div>
    {/if}
    {#if trophies.tiles.length === 0 && allOn}
      <p class="caseempty">No badges yet — play a season.</p>
    {/if}

    {#each sections as s (s.rarity)}
      <div class="band">
        <div class="psep">{s.rarity.toUpperCase()}</div>
        <!-- No tabindex: the band wraps rather than scrolls, so every pill is
             on screen and reachable by tabbing the buttons themselves. The
             scrollable-region pattern WCAG 2.1.1 asks for only applies to a
             container that hides content, and this one no longer does.

             BadgeSlot emits the button and, when open, the reveal — both as
             children of this row, which is how the trigger lands on its own
             line directly under the pill that was tapped. -->
        <!-- balancewrap: text-wrap:balance for a chip row — keeps greedy
             wrapping's line count but evens the lines, so a band never lands
             6/6/1 with an orphan under two full rows. The key carries every
             width-bearing fact — membership, ×counts, the NEW chip — because
             a lens switch can change a pill's width without changing a single
             key, and neither Svelte nor the parent-ResizeObserver would
             notice. Sheet resizes re-run via the observer. -->
        <div
          class="bandrow"
          role="group"
          aria-label="{s.rarity} badges"
          use:balancewrap={s.items.map((i) => `${i.def.key}:${i.count}${i.fresh ? "!" : ""}`).join() +
            "|" +
            s.stamps.map((t) => `${t.country}:${t.count}`).join()}
        >
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
          <!-- The tier's countries, INLINE in the same wrapping row as its
               badges — not on a line of their own. A flag is one more chip in
               the band's flow, wherever it happens to fall, which is the whole
               claim the band makes: these are the same rarity. A forced break
               would have re-drawn the separation the PASSPORT band used to be.
               Rendered as `PillSlot`s directly rather than through `Passport`,
               and that is what makes inline possible: `PillSlot` fences an open
               panel inside `btnEl.parentElement`, so the stamps' parent has to
               BE this row. `.bandrow` is already `position: relative`, so it
               satisfies the contract as it stands. `Passport` remains the
               finale's row, where the strip needs a box of its own.
               One open chip across both kinds: the key is namespaced, so a
               country and a badge can never collide and only one panel is ever
               open on the sheet. -->
          {#each s.stamps as stamp (stamp.country)}
            {@const key = `country:${stamp.country}`}
            <PillSlot
              reveal={stampReveal(stamp)}
              ariaLabel={stampLabel(stamp)}
              emoji={stamp.flag || undefined}
              label={stamp.flag ? undefined : stamp.country}
              count={stamp.count !== null && stamp.count > 1 ? stamp.count : null}
              rarity={stamp.rarity}
              shape="rect"
              title={stamp.country}
              open={opened === key}
              ontoggle={() => toggle(key)}
            />
          {/each}
        </div>
      </div>
    {/each}
  </div>
</Sheet>

<style>
  /* The corner funnel: the ✕'s pill recipe verbatim (Sheet.svelte .x — fixed
     28×22, no horizontal padding, invisible 44px tap extension), because the
     two are the header's matched shoulders. Scoped here rather than shared
     from the shell: the shell reserves the seat, the tenant dresses itself. */
  .fbtn {
    flex: none;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    color: var(--muted);
    font-family: inherit;
    padding: 0;
    width: 28px;
    height: 22px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
  }
  .fbtn::after {
    content: "";
    position: absolute;
    inset: -11px -8px;
  }
  .fbtn:active {
    transform: translateY(1.5px);
  }
  .fbtn:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* A live lens outlives a closed board — the pill keeps saying so. */
  .fbtn.lens {
    border-color: var(--ink);
    color: var(--ink);
  }
  /* The lens board: quieter and smaller than the powerup register — furniture
     over the case, not controls of the game. One row per axis. Contrast is
     carried on three channels at once (fill, border weight-by-color, text
     ink): ON is cardstock with an ink ring and ink caps, OFF is a ghost —
     transparent fill, faint ring, gray caps — so the split reads at a glance
     without the full ink flip that out-shouted the trophies. */
  .filters {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-bottom: 10px;
  }
  .frow {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 4px;
  }
  .fchip {
    /* A caps chip, so it draws through the chip box (the `chipbox` class in
       its markup, label wrapped in `.chiplbl`): pinned whole-pixel height,
       flex centering, and the recipe's own cap-band seating. As a bare
       padding-driven button its 9px caps rode the line box's seat — measured
       by the render probe at 0.75px high in Chrome and 0.25px in Safari,
       different numbers for one rule, which is exactly the drift the recipe
       exists to end. 22px keeps the footprint the 3px pair drew (the two
       engines' natural heights straddled it at 21.9 and 22.9). */
    --chip-h: 22px;
    border: 1.5px solid var(--line);
    border-radius: 999px;
    background: transparent;
    color: var(--gray-ink);
    padding-inline: 8px;
    font-family: inherit;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: transform 0.08s;
    opacity: 0.75;
  }
  .fchip:active {
    transform: translateY(1.5px);
  }
  .fchip.on {
    background: var(--card);
    border-color: var(--ink);
    color: var(--ink);
    opacity: 1;
  }
  .fchip:focus-visible,
  .fall:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* ALL: a word, not a pill — it acts on the chips (select everything), so it
     refuses their costume. Underlined like a link and muted; the chips it
     resets carry the state. */
  .fall {
    border: none;
    background: none;
    padding: 3px 2px;
    font-family: inherit;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.03em;
    color: var(--muted);
    text-decoration: underline;
    text-underline-offset: 2px;
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
     introduces no header style of its own. The 16px above each later band is
     the SHEET rhythm: help gives its .psep headings margin-top 16px and the
     seasons list pads 16px over ALL SEASONS, and a heading that opens a band
     needs more air above it than the 6px this once was — the board rows read
     as belonging to the heading below them. */
  .band + .band {
    margin-top: 16px;
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
</style>

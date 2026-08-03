<script lang="ts">
  import { BADGES, RARITY_ORDER, type BadgeDef, type Rarity } from "../lib/badges";
  import {
    badgeCase,
    passport,
    takeOpenedBadgeCue,
    type PassportItem,
    type PassportStamp,
  } from "../lib/settings";
  import BadgePill from "./BadgePill.svelte";
  import BadgeSlot from "./BadgeSlot.svelte";
  import Passport from "./Passport.svelte";
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
   * Empty is not rendered at all, and neither is its tab. A "PASSPORT · 0
   * COUNTRIES" heading over an empty box is the checklist wearing a different
   * hat; a panel that simply appears the first time a country lands is the
   * happy accident it is supposed to be.
   *
   * It sits outside the progress fraction by construction rather than by a
   * filter: that number is `trophies.earned` of `trophies.total`, both counted
   * from the badge table, and a country is not a badge. */
  const stamps = passport();

  /** Two panels behind two tabs, rather than a passport appended below the
   * ladder or moved to a sheet of its own.
   *
   * Appended was where it started and it buried the thing. The ladder is six
   * bands and fifty-eight pills, so a panel under it is a screen and a half of
   * scrolling away — findable only by a player who already knew to look, which
   * is the one kind of player a souvenir does not need help reaching. A second
   * modal fixes that and costs a second entry point and a second dismissal for
   * an object the trophy case already owns: both are lifetime, both are global
   * across mode, both are collections of what a career turned up.
   *
   * A tab is one tap and no new sheet. It also does not make the passport a
   * checklist — the constraint is about denominators and empty slots, not about
   * navigation, and nothing behind this tab enumerates a country the player has
   * not been to.
   *
   * The bar does not exist until the first stamp lands, so a player with no
   * countries sees exactly the case they saw before: no tabs, no hint that a
   * second panel is being withheld. */
  let tab = $state<"trophies" | "passport">("trophies");
  const tabbed = stamps.length > 0;

  /** Left/right across the bar, the one keyboard affordance a tablist owes
   * beyond its buttons. Both tabs stay in the tab order rather than taking the
   * roving-tabindex half of the pattern: roving without arrow keys strands the
   * second tab, and arrow keys plus two tabbable buttons is strictly more
   * operable than either half alone.
   *
   * The handler sits on the BUTTONS rather than on the bar. A keyboard handler
   * on the `tablist` element itself would make a div with an interactive role
   * take a tabindex, which puts a focus stop on a container that has nothing to
   * do — the two buttons inside it are the things being operated. */
  let tabsEl = $state<HTMLElement | null>(null);
  function tabKey(e: KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    tab = tab === "trophies" ? "passport" : "trophies";
    e.preventDefault();
    tabsEl?.querySelector<HTMLElement>(`#tab-${tab}`)?.focus();
  }

  /** What one stamp says on hover, and to a screen reader.
   *
   * It spells out the two numbers the stamp itself cannot: which of the games
   * behind a country actually named the people in it, and how many seasons
   * those were. A stamp with `counted === 0` says so in words rather than
   * showing a zero — a country nobody is counted for is a gap in the log, not a
   * club with nobody in it. */
  function stampTitle(s: PassportStamp): string {
    const when = s.first ? `First fielded ${s.first}. ` : "";
    const seasons = `${s.visits} ${s.visits === 1 ? "season" : "seasons"}`;
    if (s.counted === 0) return `${when}${seasons}, none carrying a roster.`;
    const players = `${s.players} ${s.players === 1 ? "player" : "players"}`;
    if (s.counted === s.visits) return `${when}${players} across ${seasons}.`;
    return `${when}${players} across ${s.counted} of ${seasons}.`;
  }

  /** The stamps as the panel draws them. The number on a stamp is unique
   * PLAYERS, so a man rostered in four seasons counts once and two different
   * Venezuelans count twice — and it is shown at one as readily as at four,
   * which breaks the badge pills' "only mark above one" convention on purpose.
   * A blank has to mean exactly one thing here, and the thing it means is "no
   * season on record named anybody". */
  const items: PassportItem[] = stamps.map((s) => ({
    country: s.country,
    flag: s.flag,
    rarity: s.rarity,
    count: s.counted > 0 ? s.players : null,
    fresh: false,
    title: stampTitle(s),
  }));

  /** The player count is not backfillable and the panel says so out loud.
   *
   * A history row records badges, countries and a record and has never recorded
   * a roster, so a season played before the roster was logged cannot be made to
   * give up its players. Those seasons keep their stamp and their date and
   * carry no number. A tooltip alone would hide that on a phone, where nothing
   * hovers, so the panel prints one muted line: the first sentence says what a
   * number means, the second admits which seasons have none. Neither appears
   * before there is a number on screen to explain. */
  const anyCounted = items.some((i) => i.count !== null);
  const anyMissing = stamps.some((s) => s.counted < s.visits);

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

<!-- The header line carries the badge fraction only while the badges are the
     thing on screen. On the passport tab it drops to the sheet's plain name:
     "12 OF 58" sitting three lines above a row of country stamps is a
     denominator the panel spent its whole design refusing, and a reader has no
     way to know it belongs to the tab they are not looking at. -->
<Sheet
  {onclose}
  label="Trophy case"
  tall
  title={tab === "trophies"
    ? `TROPHY CASE · ${trophies.earned} OF ${trophies.total}`
    : "TROPHY CASE"}
  confirmLabel="CLOSE"
>
  {#if tabbed}
    <!-- The bar scrolls with the panel rather than pinning under the header.
         Sheet owns the frame — header and CLOSE button hold still, the body
         scrolls — and holding a third thing still is a change to Sheet, which
         five other callers share. A two-tab bar at the top of a body is cheap
         to scroll back to. -->
    <div class="tabs" role="tablist" aria-label="Trophy case sections" bind:this={tabsEl}>
      <button
        id="tab-trophies"
        class="tab"
        class:on={tab === "trophies"}
        role="tab"
        aria-selected={tab === "trophies"}
        aria-controls="panel-trophies"
        onkeydown={tabKey}
        onclick={() => (tab = "trophies")}>TROPHIES</button
      >
      <button
        id="tab-passport"
        class="tab"
        class:on={tab === "passport"}
        role="tab"
        aria-selected={tab === "passport"}
        aria-controls="panel-passport"
        onkeydown={tabKey}
        onclick={() => (tab = "passport")}>PASSPORT</button
      >
    </div>
  {/if}

  <!-- Both panels stay in the DOM and the inactive one carries `hidden`, which
       is what a tabpanel is supposed to do: the roles and the labelling only
       exist while there is a bar to own them, so a case with no passport is
       plain content rather than a tablist of one. -->
  <div
    id="panel-trophies"
    role={tabbed ? "tabpanel" : undefined}
    aria-labelledby={tabbed ? "tab-trophies" : undefined}
    hidden={tabbed && tab !== "trophies"}
  >
    {#if trophies.tiles.length === 0}
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
  </div>

  {#if tabbed}
    <!-- The other panel: the bands answer "what have I collected", this answers
         "where have I been". The heading counts what is there and stops — no
         "of 39", because a denominator would turn a souvenir into an errand. -->
    <div
      id="panel-passport"
      role="tabpanel"
      aria-labelledby="tab-passport"
      hidden={tab !== "passport"}
    >
      <div class="band">
        <div class="psep">
          PASSPORT · {stamps.length}
          {stamps.length === 1 ? "COUNTRY" : "COUNTRIES"}
        </div>
        <Passport stamps={items} label="Countries visited" />
        {#if anyCounted}
          <p class="note">
            A number is how many different players you have fielded from that
            country.
            {#if anyMissing}Seasons that recorded no roster carry none.{/if}
          </p>
        {/if}
      </div>
    </div>
  {/if}
</Sheet>

<style>
  /* Two words on one line, each a plain label under a rule — the sheet already
     spends its ink on the pills, and a pair of filled segmented buttons at the
     top of it would outweigh everything they switch between. The selected tab
     takes ink type and an ink rule; the other stays muted over the dashed rule
     the whole app uses for a section edge. */
  .tabs {
    display: flex;
    gap: 18px;
    justify-content: center;
    margin-bottom: 10px;
  }
  .tab {
    background: none;
    border: 0;
    border-bottom: 2px dashed var(--dash);
    border-radius: 0;
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--muted);
    /* 44px of tap target on a 20px label, grown into the sheet's own padding
       rather than into the first band below it. */
    padding: 11px 12px 9px;
    cursor: pointer;
  }
  .tab.on {
    color: var(--ink);
    border-bottom: 2px solid var(--ink);
  }
  .tab:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
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
  /* The one line of prose on the sheet, and it is there to keep a blank stamp
     from reading as a broken one. Centered under the stamps at the size the
     rest of the sheet's small print runs. */
  .note {
    margin: 8px 0 0;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.45;
    color: var(--muted);
  }
</style>

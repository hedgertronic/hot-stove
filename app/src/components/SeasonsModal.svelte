<script lang="ts">
  import { loadStoredFinale, type Bank, type StoredFinale } from "../lib/engine.svelte";
  import { recordFromTotal, seedCode } from "../lib/format";
  import { loadArchive, loadHistory } from "../lib/history";
  import { BANKS, DIFFICULTIES } from "../lib/modes";
  import Sheet from "./Sheet.svelte";

  /** Every season a career has finished, newest first, as a modal — the way
   * back into any one of them, not just the last. It is also the record book:
   * the shelf at the top of the sheet holds the best season in every mode combo
   * a career has played, so the two things a player asks a list of seasons —
   * "what is my best" and "let me back into that one" — are one surface.
   *
   * Read once at mount, like the trophy case: the component is created fresh
   * per open, which is what keeps it current, and the ~270KB archive parse
   * stays off the home screen's own render path. Home reads the log for one
   * boolean and nothing else.
   *
   * UNSCORED ROWS DO NOT APPEAR. A quit carries a date and a badge list and
   * nothing else — no record, no seed, no mode, no finale — so it has none of
   * the three things a row here is made of, and a list of blank lines is not a
   * better acknowledgement than the trophy case already gives 🧳 PACKED IT IN.
   * The guard is `typeof total === "number"`, which is the log's own marker for
   * a season that resolved and the same one `bestFor` counts games with. */
  let {
    onclose,
    onopen,
  }: {
    onclose: () => void;
    /** Reopen this season's finale. Only ever called with a record still in
     * storage — a row without one renders as a control that cannot be
     * pressed.
     *
     * The id comes along when the record came out of the archive, so the boot
     * claim can name this season and a reload can put it back. It is undefined
     * for the one row backed by `hotstove.finale` instead, which needs no id:
     * that key holds one game and the live claim already means it. */
    onopen: (rec: StoredFinale, id?: string) => void;
  } = $props();

  const MONTHS = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];

  /** `2026-08-02` → `AUG 2 '26`. Split rather than passed to `new Date()`: an
   * ISO date string parses as UTC, so west of Greenwich the constructor renders
   * the day before the one the log wrote. A date is stored as digits and is
   * shown as those digits. Anything that is not three parts prints raw. */
  function played(iso: unknown): string {
    if (typeof iso !== "string") return "";
    const [y, m, d] = iso.split("-");
    const mon = MONTHS[Number(m) - 1];
    return mon && y?.length === 4 ? `${mon} ${Number(d)} '${y.slice(2)}` : String(iso);
  }

  const archive = new Map(loadArchive().map((r) => [r.id, r]));

  /** The last finished game, which lives in `hotstove.finale` whether or not it
   * ever reached the archive — the same record LAST GAME used to open.
   *
   * It backs the NEWEST row only, and only when that row has no archive record
   * of its own. Two cases land here and both are real: a build that shipped
   * before ids existed leaves its most recent season openable rather than
   * stranding a player's last game behind an id it was never written with, and
   * a quota failure that lost the archive write still leaves the finale the
   * player just earned reachable, because that key was written first and on its
   * own budget.
   *
   * Newest only, because that key holds exactly one game and no older row can
   * be shown to be it. `clearStoredFinale` empties it the moment a new game
   * starts, so the row simply goes dead — which is the same thing every other
   * unarchived season does. */
  const lastFinale = loadStoredFinale();

  const seasons = loadHistory().filter((e) => typeof e.total === "number");
  const newest = seasons.length - 1;

  const rows = seasons
    .map((e, i) => {
      // The record is DERIVED from the total, exactly as the record book
      // derives its best season: stored `record` strings hold the old
      // expected-wins record, and the ladder is now a pure function of points.
      // Deriving is also what supplies the tier the record is colored with.
      const r = recordFromTotal(e.total!);
      // Both mode fields are read the way settings.ts reads them for the record
      // book — a pre-bank row carries a `moneyball` boolean instead of a bank,
      // and a row without the v2 stamp spells the scout ladder "eyetest". Those
      // two normalizers are private to settings, so the rules are spelled again
      // here rather than reached for; they are two expressions and they are the
      // same two expressions the record book indexes on.
      // hasOwn, not `in`: `in` walks the prototype chain, so a corrupt row
      // whose bank reads "constructor" would pass and index BANKS at a
      // function. (settings.ts validates against a Set for the same reason.)
      const bank = (
        typeof e.bank === "string" && Object.hasOwn(BANKS, e.bank)
          ? e.bank
          : e.moneyball === true
            ? "moneyball"
            : "classic"
      ) as Bank;
      const scout =
        typeof e.v === "number" && e.v >= 2
          ? e.difficulty === "scout"
          : e.difficulty === "eyetest";
      const date = played(e.date);
      const seed = typeof e.seed === "number" ? `#${seedCode(e.seed)}` : "";
      const modes = BANKS[bank].name + (scout ? ` · ${DIFFICULTIES.scout.name}` : "");
      const arch = typeof e.id === "string" ? archive.get(e.id) : undefined;
      const rec = arch ?? (i === newest ? lastFinale : null);
      return {
        // The archive id, when the archive is what this row opens. It travels
        // with the record so the finale it opens can claim the screen under its
        // own name instead of under the last game played.
        id: arch?.id,
        // The mode combo this season was played under, and the key the shelf
        // below groups on. It is the PAIR — ladder and bank — because that is
        // what `bestFor` scopes a record book by, and a shelf that grouped on
        // the bank alone would print a different "best Moneyball season" than
        // the number the home screen shows for the same words.
        combo: `${scout ? "scout" : "standard"}|${bank}`,
        total: e.total!,
        wins: r.wins,
        losses: r.losses,
        tier: r.tier,
        modes,
        bank: BANKS[bank].emoji,
        scout,
        seed,
        date,
        rec: rec ?? null,
        // The row's four zones read as one sentence, in the order they are
        // drawn, with the modes spelled out rather than left as the emoji the
        // eye gets. A row that is not a door says so: the visual difference is
        // a fade, and a fade does not reach a screen reader.
        aria:
          `${date}, ${modes}` +
          `${seed === "" ? "" : `, seed ${seed.slice(1)}`}, ${r.wins}–${r.losses}` +
          `${rec ? "" : " — no longer available to reopen"}`,
      };
    })
    .reverse();

  /** The record book: the best season in every combo the career has played,
   * best first. Modes never played are simply absent — an empty rung is not a
   * record, and a shelf of dashes for combos someone has no interest in is
   * noise on the one surface that is supposed to be their highlight reel.
   *
   * Computed from the rows already built rather than from six `bestFor` calls:
   * that function re-parses the whole log per call, and — the reason that
   * matters more than the parse — deriving both halves of this sheet from one
   * normalization is what guarantees the shelf's row is literally a row from
   * the list beneath it, tier color, seed, date and door alike.
   *
   * Ties go to the season already held, which is the NEWER one: `rows` is
   * newest first, so the first row seen for a combo wins a tie. The newer of
   * two identical bests is the one more likely to still be a door. */
  const shelf = (() => {
    const best = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const held = best.get(r.combo);
      if (held === undefined || r.total > held.total) best.set(r.combo, r);
    }
    return [...best.values()].sort((a, b) => b.total - a.total);
  })();
</script>

<!-- One markup path for every row on this sheet, shelf and list alike, and
     `disabled` is what separates a door from a season that is only a record —
     the app's own dead-control language, the same one LAST GAME spent when
     there was nothing to go back to. A season the archive no longer holds is
     still a real season with a real record; it is just not a door.

     The zones read left to right: seed code far left in mono, then the mode
     emojis, then the tier-colored record far right where the eye scans a
     column of them. Date is omitted from the visual row but remains in the
     aria-label for screen readers. -->
{#snippet row(r: (typeof rows)[number], best: boolean)}
  <button
    class="row"
    class:best
    disabled={r.rec === null}
    aria-label={best ? `Best ${r.modes} season. ${r.aria}` : r.aria}
    onclick={() => {
      if (r.rec) onopen(r.rec, r.id);
    }}
  >
    <span class="seed">{r.seed}</span>
    <span class="mode" aria-hidden="true"
      >{r.bank}{r.scout ? ` ${DIFFICULTIES.scout.emoji}` : ""}</span
    >
    <span class="rec {r.tier}">{r.wins}–{r.losses}</span>
  </button>
{/snippet}

<Sheet
  {onclose}
  label="Past seasons"
  title="SEASONS"
  confirmLabel="CLOSE"
>
  <div>
    {#if rows.length === 0}
      <p class="empty">No seasons yet — play one.</p>
    {/if}

    {#if shelf.length > 0}
      <!-- The record book, pinned above the log it is drawn from. Keyed by the
           combo, which is unique by construction and stable across a mount.
           Section labels use the app's standard .psep device (global in
           app.css: dashed rule with centered text). -->
      <div class="psep">RECORD BOOK</div>
      <div class="shelf">
        {#each shelf as r (r.combo)}
          {@render row(r, true)}
        {/each}
      </div>
      <div class="psep">ALL SEASONS</div>
    {/if}

    <div class="rows">
      <!-- Index-keyed: the list is built once at mount and never reordered, and
           a log row is not guaranteed anything unique of its own (the id
           arrived with the archive, and older rows have none). -->
      {#each rows as r, i (i)}
        {@render row(r, false)}
      {/each}
    </div>
  </div>
</Sheet>

<style>
  .empty {
    margin: 0;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--gray-ink);
    padding: 6px 0 2px;
  }
  .rows,
  .shelf {
    display: grid;
    gap: 7px;
  }
  /* Section labels use the app's global .psep device (dashed rule with
     centered text, defined in app.css). The gap between the shelf and ALL
     SEASONS adds top padding only where there is a shelf above it. */
  .shelf + .psep {
    padding-top: 16px;
  }
  /* A market row: you are choosing among these, so it is white cardstock on the
     structural line and the value rides the record, never the row. */
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    /* Heavier on the right, where the record now lands: the value wants the
       same breathing room off the edge it had when it led the row. */
    padding: 6px 11px 6px 9px;
    border: 2.5px solid var(--line);
    border-radius: 11px;
    background: var(--card);
    color: var(--ink);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: transform 0.08s;
  }
  .row:active {
    transform: translateY(2px);
  }
  .row:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* Aged out of the archive. One opacity on the whole control — no dashes (the
     dash is the armed channel) and no hue change, which is exactly what the
     disabled LAST GAME button did and for the same reason. 0.65 keeps a 13px
     bold cap above 4.5:1 against the sheet ground. */
  .row:disabled {
    opacity: 0.65;
    cursor: default;
  }
  .row:disabled:active {
    transform: none;
  }
  /* A shelf row is the same card on warmer stock behind a gold line — the
     trophy-case register, one step up from the white cardstock of a row you
     are only browsing. No extra glyph and no extra zone: the caption above the
     shelf already says what these are, and the rows have to stay comparable
     with the ones below them to be read as the same object twice. */
  .row.best {
    background: var(--amber);
    border-color: var(--gold-8);
  }
  /* The finale's total stamp shrunk to row scale, tier-colored. The color is
     app.css's record ladder — `.rec.elite` and its five siblings, the text
     channel of the WAR ladder, and what the six rules that used to sit here
     were a hand copy of. The record's own color is the only place a value may
     show on a market row; the size is the only part of it this surface
     decides. `margin-left: auto` pushes it to the far-right edge of the row. */
  .rec {
    flex: none;
    margin-left: auto;
    font-size: 19px;
    font-weight: 900;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  /* Which modes the season was played under. The bank shows on EVERY row,
     including From the Ground Up, rather than following the HUD chip's "nothing for
     the defaults" convention: the HUD describes the one game you are in, and
     this is a comparison surface where a blank would have to be read as "the
     default" by someone who already knows what the default is. The ladder keeps
     the convention — 🔭 marks Eye Test, and Box Score is the absence of it. */
  .mode {
    flex: none;
    font-size: 13px;
    line-height: 1;
    letter-spacing: 0.02em;
  }
  /* The seed in the quiet mono voice the finale's GAME #XXXX chip uses — this
     is where a code gets copied from. Far-left anchor: `margin-left: auto` has
     moved to `.rec` so the record is what jumps to the right edge. */
  .seed {
    flex: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    white-space: nowrap;
  }
  /* Narrowest phones: the row is three zones across ~276px of sheet. */
  @media (max-width: 359px) {
    .row {
      gap: 6px;
      padding: 6px 9px 6px 7px;
    }
    .rec {
      font-size: 17px;
    }
    .mode {
      font-size: 12px;
    }
    .seed {
      font-size: 11px;
    }
  }
</style>

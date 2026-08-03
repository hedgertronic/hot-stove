<script lang="ts">
  import { loadStoredFinale, type Bank, type StoredFinale } from "../lib/engine.svelte";
  import { recordFromTotal, seedCode } from "../lib/format";
  import { ARCHIVE_CAP, loadArchive, loadHistory } from "../lib/history";
  import { BANKS, DIFFICULTIES } from "../lib/modes";
  import Sheet from "./Sheet.svelte";

  /** Every season a career has finished, newest first, as a modal — the way
   * back into any one of them, not just the last.
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
     * pressed. */
    onopen: (rec: StoredFinale) => void;
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
      const bank = (
        typeof e.bank === "string" && e.bank in BANKS
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
      const rec =
        (typeof e.id === "string" ? archive.get(e.id) : undefined) ??
        (i === newest ? lastFinale : null);
      return {
        wins: r.wins,
        losses: r.losses,
        tier: r.tier,
        bank: BANKS[bank].emoji,
        scout,
        seed,
        date,
        rec: rec ?? null,
        // The row's five zones read as one sentence, with the modes spelled out
        // rather than left as the emoji the eye gets. A row that is not a door
        // says so: the visual difference is a missing chevron and a fade, and
        // neither of those reaches a screen reader on its own.
        aria:
          `${r.wins}–${r.losses}, ${modes}` +
          `${seed === "" ? "" : `, seed ${seed.slice(1)}`}, ${date}` +
          `${rec ? "" : " — no longer available to reopen"}`,
      };
    })
    .reverse();

  /** At least one season cannot be reopened, so the sheet owes an explanation.
   * Drawn only when it is true: a player whose every season is a door never
   * needs to be told a cap exists. */
  const anyClosed = rows.some((r) => r.rec === null);
</script>

<Sheet
  {onclose}
  label="Past seasons"
  title="SEASONS"
  subtitle={rows.length === 1 ? "1 PLAYED" : `${rows.length} PLAYED`}
  confirmLabel="CLOSE"
>
  <div>
    {#if rows.length === 0}
      <p class="empty">No seasons yet — play one.</p>
    {/if}

    <div class="rows">
      <!-- Index-keyed: the list is built once at mount and never reordered, and
           a log row is not guaranteed anything unique of its own (the id
           arrived with the archive, and older rows have none). -->
      {#each rows as r, i (i)}
        <!-- One markup path for both states, and `disabled` is what separates
             them — the app's own dead-control language, the same one LAST GAME
             spent when there was nothing to go back to. A season the archive
             no longer holds is still a real season with a real record; it is
             just not a door. -->
        <button
          class="row"
          disabled={r.rec === null}
          aria-label={r.aria}
          onclick={() => {
            if (r.rec) onopen(r.rec);
          }}
        >
          <span class="rec {r.tier}">{r.wins}–{r.losses}</span>
          <span class="mode" aria-hidden="true">{r.bank}{r.scout ? ` ${DIFFICULTIES.scout.emoji}` : ""}</span>
          <span class="seed">{r.seed}</span>
          <span class="date">{r.date}</span>
          <span class="go" aria-hidden="true">{r.rec ? "›" : ""}</span>
        </button>
      {/each}
    </div>

    {#if anyClosed}
      <!-- "Up to", not "the last N": a season played before the archive existed
           has no record either, so the cap is a ceiling on what can be reopened
           rather than a promise about which rows are doors. The second sentence
           is the one that matters — it says what a dimmed row still is. -->
      <p class="note">
        Up to {ARCHIVE_CAP} seasons stay reopenable. The rest keep their badges,
        their stamps and their place in the record book.
      </p>
    {/if}
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
  .rows {
    display: grid;
    gap: 7px;
  }
  /* A market row: you are choosing among these, so it is white cardstock on the
     structural line and the value rides the record, never the row. */
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 6px 8px 6px 11px;
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
  /* The finale's total stamp shrunk to row scale, tier-colored. The six rules
     below are a hand copy of the ladder Home's record book carries, and app.css
     says plainly that copying it is the thing --rung-fill exists to stop. They
     are here anyway because that pair tints a surface and this tints TEXT: the
     record's own color is the only place a value may show on a market row, and
     no --war-* class sets a text color. A shared class would have to be added
     to app.css to fix it properly. */
  .rec {
    flex: none;
    font-size: 19px;
    font-weight: 900;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  .rec.neg {
    color: var(--war-neg);
  }
  .rec.low {
    color: var(--war-low);
  }
  .rec.mid {
    color: var(--war-mid);
  }
  .rec.high {
    color: var(--war-high);
  }
  .rec.star {
    color: var(--war-star);
  }
  .rec.elite {
    /* Brighter than --war-elite, matching the finale stamp and the record book:
       at heavy stamp weight the token's #c98a08 reads brown. */
    color: var(--record-elite);
  }
  /* Which modes the season was played under. The bank shows on EVERY row,
     including Clean House, rather than following the HUD chip's "nothing for
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
     is where a code gets copied from. */
  .seed {
    margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    white-space: nowrap;
  }
  .date {
    flex: none;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--gray-ink);
    white-space: nowrap;
  }
  /* The door. A fixed box whether or not the chevron is in it, so every row's
     content ends on the same vertical line and an unopenable one is short of a
     mark rather than shifted. */
  .go {
    flex: none;
    width: 9px;
    text-align: center;
    font-size: 15px;
    font-weight: 800;
    line-height: 1;
    color: var(--muted);
  }
  /* The cap, said out loud, in the two prose sheets' voice. */
  .note {
    margin: 12px 2px 0;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.5;
    color: var(--muted);
    text-align: center;
  }
  /* Narrowest phones: the row is five zones across ~276px of sheet. Everything
     tightens by a step and the date drops its tracking; nothing wraps. */
  @media (max-width: 359px) {
    .row {
      gap: 6px;
      padding: 6px 7px 6px 9px;
    }
    .rec {
      font-size: 17px;
    }
    .mode {
      font-size: 12px;
    }
    .seed {
      font-size: 10px;
    }
    .date {
      font-size: 8.5px;
      letter-spacing: 0.03em;
    }
  }
</style>

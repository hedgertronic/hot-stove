<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import type { Colors } from "../lib/types";
  import Logo from "../components/Logo.svelte";
  import MarketRow from "../components/MarketRow.svelte";
  import RailSeat from "../components/RailSeat.svelte";
  import SpinBanner from "../components/SpinBanner.svelte";

  /** A motionless landed card with just the fields SpinBanner reads. Keeping
   * the preview on the real component is the point; this object supplies its
   * gameplay state without constructing or persisting a Game. */
  const game = {
    phase: "landed",
    card: {
      year: 1995,
      team: "SEA",
      franchise: "SEA",
      name: "Seattle Mariners",
      ws: false,
      pen: false,
    },
    loadFailed: false,
    coldStove: false,
    resumedForfeit: false,
  } as unknown as Game;

  const colors: Colors = { franchises: { SEA: "#1f6f6b" } };
</script>

<svelte:head><title>Hot Stove OG Preview</title></svelte:head>

<main class="og" aria-label="Hot Stove social preview">
  <Logo og />

  <section class="frame" aria-label="In-progress Hot Stove gameplay preview">
    <div class="squad">
      <div class="psep">YOUR SQUAD</div>
      <div class="seats">
        <RailSeat label="C" name="Piazza" meta="1997 LAD" tier="elite" war="8.7" salary="$39.8M" salaryTier="spendy" />
        <RailSeat label="IF" name="Ripken" meta="1991 BAL" tier="elite" war="11.5" salary="$27.3M" />
        <RailSeat label="OF" name="Henderson" meta="1990 OAK" tier="elite" war="9.9" salary="$37.9M" salaryTier="spendy" />
        <RailSeat label="SP" name="Maddux" meta="1995 ATL" tier="elite" war="10.8" salary="$40.2M" salaryTier="spendy" />
        <RailSeat label="SP" />
      </div>
    </div>

    <div class="market">
      <SpinBanner {game} {colors} />
      <div class="rows">
        <div class="prow">
          <div class="prowcontent">
            <MarketRow pos="SP" pit name="Randy Johnson" awards={["CY", "AS"]} priceText="$28.9M" rightHidden />
          </div>
          <span class="confirm"><span class="chiplbl">SIGN FOR $28.9M</span></span>
        </div>
        <div class="prow">
          <div class="prowcontent">
            <MarketRow pos="DH" name="Edgar Martínez" awards={["MVP", "AS"]} priceText="$22.2M" war={7.9} />
          </div>
        </div>
        <div class="prow">
          <div class="prowcontent">
            <MarketRow pos="CF" name="Ken Griffey Jr." awards={["GG", "AS"]} priceText="$47.0M" priceTier="spendy" war={3.7} />
          </div>
        </div>
      </div>
    </div>
  </section>
</main>

<style>
  .og {
    position: fixed;
    inset: 0 auto auto 0;
    width: 1200px;
    height: 630px;
    /* Dead-centers the ink: measured margins were 116 top / 118 bottom, and
       2px of top padding moves the centered stack down exactly one pixel —
       117/117 (tools/generate_og_image.py renders what this file states, so
       the correction lives here, not in the tool). */
    padding: 2px 0 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    /* The card white, not the app's ivory ground: the frame below is painted
       in the ground ivory, and on a ground-colored page it disappeared — the
       share image read as rows floating on nothing. White behind ivory keeps
       the in-game layering (white rows on ivory board) and gives the frame a
       panel edge of its own. */
    background: var(--card);
  }
  .frame {
    width: 900px;
    margin-top: 32px;
    padding: 15px;
    display: grid;
    grid-template-columns: 310px minmax(0, 1fr);
    gap: 15px;
    background: #f6f1e3;
    border: 3px solid var(--line);
    border-radius: 20px;
  }
  .squad,
  .market {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .squad :global(.psep) {
    padding-top: 2px;
  }
  .seats,
  .rows {
    display: flex;
    flex: 1;
    flex-direction: column;
  }
  .seats { gap: 7px; }
  /* 9px, not 8: with the banner pinned to 62 the market column leaves the
     rows container exactly 174px, and (174 − 2×9) / 3 = 52 — three WHOLE-pixel
     rows. At 8 the flexed rows came out 52.797px each, so every row's award
     pills started at a different fraction of a device pixel and the
     rasterizer seated each row's type at a different depth (row 3 ran 0.8px
     low in the shipped card). Gameplay never sees this: its market rows are
     content-sized, not flex-stretched. */
  .rows { gap: 9px; }
  .market :global(.banner) {
    /* Whole-pixel pin over the natural 61.594px — the first fractional link
       in the chain that made every row below it start off-grid. */
    height: 62px;
    margin-bottom: 10px;
  }
  .prow {
    min-height: 48px;
    flex: 1;
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--card);
    border: 2.5px solid var(--line);
    border-radius: 11px;
  }
  .prowcontent {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }
  .prow > :global(.confirm) { flex: none; }
</style>

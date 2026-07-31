<script lang="ts">
  let { onclose }: { onclose: () => void } = $props();
</script>

<div class="backdrop" onclick={onclose} role="presentation">
  <div
    class="sheet disp"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onclose()}
    role="dialog"
    aria-label="How to play"
    tabindex="-1"
  >
    <div class="sheet-h">
      HOW TO PLAY
      <button class="x" onclick={onclose} aria-label="Close">✕</button>
    </div>

    <div class="hsec">THE LOOP</div>
    <ul>
      <li>The stove spins you a random team-season, 1985–2024.</li>
      <li>Take <b>one</b> thing per spin — sign a player or make a front-office hire.</li>
      <li>Fill all 8 seats: C · IF ×2 · OF · UTIL · SP ×2 · RP.</li>
      <li>
        The club is complete at 8 players + a manager
        <span class="soft">(+ an owner and stadium in Owner's Box)</span>.
      </li>
    </ul>

    <div class="hsec">YOUR BANKROLL</div>
    <ul>
      <li>
        <b>Owner's Box:</b> hire an owner to set your bankroll, then buy a stadium — its
        attendance multiplier (×0.85–1.15) scales it.
      </li>
      <li>
        <b>Hometown Hero:</b> owner + stadium from the same franchise lets you sign one
        player who debuted there at the league minimum.
      </li>
      <li>You <i>can</i> sign past your bankroll — the luxury tax just eats your score.</li>
    </ul>

    <div class="hsec">SCORING</div>
    <ul>
      <li><b>Wins:</b> 50 base + roster WAR + manager (W−L) × 0.1.</li>
      <li>
        <b>Budget:</b> up to +10 for using your whole bankroll; under half goes negative;
        −1 per $1M over it.
      </li>
      <li>
        <b>Hardware:</b> MVP +5 · Cy Young +4 · ROY +2 · ballot medals 🥈 +2 / 🥉 +1 ·
        All-Star, Gold Glove, Silver Slugger +1 each.
      </li>
      <li><b>Pedigree:</b> 💍 +2 / 🚩 +1 per player from a title or pennant season.</li>
      <li><b>Scouting:</b> +1 per signing who makes the dream team.</li>
    </ul>

    <div class="hsec">POWERUPS — ONCE PER GAME</div>
    <ul class="pups">
      <li><b>🎟️ SEASON TICKET</b> — same franchise, any year.</li>
      <li><b>🚚 RELOCATE</b> — same year, any club.</li>
      <li><b>✌️ DOUBLE PLAY</b> — two signings on one spin; refundable until the second.</li>
      <li><b>🔁 TRADE DEADLINE</b> — swap a signed player (or your owner or stadium) for this card's.</li>
      <li><b>⭐ PRIME TIME</b> — browse an unsigned player's whole career, sign any season.</li>
    </ul>

    <button class="btn cancel" onclick={onclose}>GOT IT</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(36, 34, 28, 0.45);
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .sheet {
    background: var(--ground);
    border: 3px solid var(--ink);
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
    max-height: 85dvh;
    overflow-y: auto;
  }
  /* Wide: a bottom sheet reads phone-y — center it as a cardstock modal. */
  @media (min-width: 760px) {
    .backdrop {
      align-items: center;
      padding: 24px;
    }
    .sheet {
      border-bottom: 3px solid var(--ink);
      border-radius: 18px;
      padding-bottom: 14px;
    }
  }
  .sheet-h {
    text-align: center;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
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
  .hsec {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--muted);
    border-bottom: 2px solid var(--ink);
    padding-bottom: 3px;
    margin: 12px 0 6px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 5px;
  }
  li {
    font-size: 12px;
    line-height: 1.45;
  }
  li b {
    font-weight: 800;
  }
  .soft {
    color: var(--muted);
  }
  .pups li {
    font-size: 12px;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
    margin-top: 14px;
  }
</style>

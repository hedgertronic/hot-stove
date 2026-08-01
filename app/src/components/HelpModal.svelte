<script lang="ts">
  import Sheet from "./Sheet.svelte";

  let { onclose }: { onclose: () => void } = $props();
</script>

<Sheet {onclose} label="How to play" tall>
  <div class="sheet-h">
    HOW TO PLAY
    <button class="x" onclick={onclose} aria-label="Close">✕</button>
  </div>

    <div class="hsec">THE LOOP</div>
    <ul>
      <li>The stove spins you a random team-season, 1985–2025.</li>
      <li>Take <b>one</b> thing per spin — sign a player or make a front-office hire.</li>
      <li>Fill all 8 seats: C · IF ×2 · OF · UTIL · SP ×2 · RP.</li>
      <li>
        The club is complete at 8 players + a manager
        <span class="soft">(+ an owner and stadium in Clean House)</span>.
      </li>
    </ul>

    <div class="hsec">BALL KNOWLEDGE</div>
    <ul>
      <li>
        <b>📊 Box Score</b> — every number on the card: WAR chips, salaries, and
        award pills.
      </li>
      <li>
        <b>🔭 Eye Test</b> — no WAR and no awards. You get the name, the
        position, the stat line, and the price, and you decide what a season was
        worth. <span class="soft">Salaries show either way — the cap game is
        the same.</span>
      </li>
    </ul>

    <div class="hsec">YOUR PAYROLL</div>
    <ul>
      <li>
        <b>💼 Clean House</b> — an empty front office. Hire an owner to set your
        payroll, then buy a stadium: its attendance multiplier (×0.85–1.15)
        scales it. The only mode with owner and stadium rows.
      </li>
      <li><b>⚾ Moneyball</b> — a fixed $51.5M, the 2002 A's.</li>
      <li><b>💸 Blank Check</b> — a fixed $203.2M, the 2005 Yankees.</li>
      <li>You <i>can</i> sign past your payroll — the luxury tax just eats your score.</li>
    </ul>

    <div class="hsec">SCORING</div>
    <ul>
      <li><b>Wins:</b> 50 base + roster WAR + manager (W−L) × 0.2.</li>
      <li>
        <b>Payroll:</b> up to +10 for using your whole payroll; under half goes negative;
        −1 per $1M over it.
      </li>
      <li>
        <b>Trophy case:</b> MVP +3 · Cy Young +3 · ROY +2 · ballot medals 🥈 +2 / 🥉 +1 ·
        All-Star, Gold Glove, Silver Slugger +1 each · your skipper's Manager of the Year +2.
      </li>
      <li><b>Ring chasing:</b> 💍 +3 / 🚩 +1 per player from a title or pennant season.</li>
      <li><b>Scouting:</b> +1 per signing who makes the dream team.</li>
    </ul>

    <div class="hsec">POWERUPS — ONCE PER GAME</div>
    <ul>
      <li><b>🎟️ SEASON TICKET</b> — same franchise, any year.</li>
      <li><b>🚚 RELOCATE</b> — same year, any club.</li>
      <li><b>✌️ DOUBLE PLAY</b> — two signings on one spin; refundable until the second.</li>
      <li><b>🔁 TRADE DEADLINE</b> — trade a signed player (or your owner or stadium) for this card's.</li>
      <li>
        <b>⭐ PRIME TIME</b> — browse an unsigned player's — or an unhired
        manager's — whole career and take any season of it.
      </li>
      <li>
        <b>🏠 HOMEGROWN</b> — arm it for a hometown discount: players who
        <i>debuted</i> with this spin's club sign for $1M.
      </li>
    </ul>

    <div class="hsec">THE TROPHY CASE</div>
    <ul>
      <li>
        Finishing a club earns <b>badges</b> — for the record you posted, how you
        spent, who you signed, and the odd thing you did by accident.
      </li>
      <li>
        Tap 🏆 any time, mid-game or from the home screen. Earned badges open to
        show what earned them.
      </li>
      <li>
        Locked ones name what to aim at; <b>? ? ?</b> means you have to find it
        yourself. The case is one lifetime collection across every mode.
      </li>
    </ul>

    <button class="btn cancel" onclick={onclose}>GOT IT</button>
</Sheet>

<style>
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
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
    margin-top: 14px;
  }
</style>

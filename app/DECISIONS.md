
### Deferred from this round

**17. The 2020 ballpark multiplier is the same number thirty times.** `build.py`
derives `stadiumMult` from a per-year attendance percentile via
`ranks.index(att)`. In 2020 every club drew zero, `.index()` returns 0 for all
thirty, and every 2020 card lands on the 0.85 floor — the worst park in the
game, thirty times over. 2019 and 2021 each carry thirty distinct values; 2020
carries one. It is a one-line fix and it is not made here: it moves the
economy, the user asked for the stadium question as a report rather than a
change, and bundling it into the Classic's regen would have made that
regen's playtest delta unreadable.

**18. WAR per dollar is not flat across the eras, though payroll is.** The
`avgSlot8` normalization does its job — median top-8 cost sits at $160–173M in
every decade. What it does not equalize is what a dollar BUYS: 1985–89 yields
0.201 WAR/$M against the 2010s' 0.338, a 41% deficit that survives excluding
the three prorated years. A 1987 card costs 11.7% more to fill eight seats and
returns 49% less WAR per dollar than a 2019 one.

The cause is the `MIN_PRICE_M = $1.0M` clamp meeting a moving floor. In
1985–91 the league minimum normalized ABOVE $1M — $2.51M in 1985, $1.43M in
1987 — so nothing was clamped and there were no cheap players at all. From
1992 to 2018 the floor fell below $1M and the clamp subsidized up to 35% of a
card's roster. Stars normalize cleanly in every era because they are a large
share of their own year's slot-8; the divergence lives entirely in the cheap
end. A per-year floor would fix it and would also delete a real piece of era
knowledge, which is a design question rather than a data one.

**19. The parity fixtures can no longer be regenerated.** `scoring.test.ts`'s
header points at a generator "in the repo history" and there is none in
`git log`. The Classic's fixtures were regenerated from a script that lived in
a scratch directory and is gone. The fixtures exist to prove the TypeScript
port still matches `pipeline/scoring.py`, and that guarantee is now only as
good as the last hand-run. The generator belongs in `pipeline/`.

**20. Nothing proves the engine passes the Classic's counts.** `scoring.ts`
has exact-delta tests and the four engine edits are in place, but no test
signs a medalist through a `Game` and asserts the pedigree count. Delete the
two lines in the `score()` call and every suite still passes. This is the
shape of Round 21's `stampWins` failure exactly — a correct function, tested,
with nothing proving anything calls it.

**21. Badge tiers still drift, and the ladder grew again.** Round 21's item 12
recorded study 11 disagreeing with the shipped table on 14 badges, and this
round adds six more definitions plus a seventh `meta` axis without re-running
it. The measurement is stale in both directions now.

**22. Prime claims the tap, and that is a convention rather than a law.** An
armed powerup owns a market row's tap, so SIGN and TRADE FOR do not render
beside an armed ⭐ — the reasoning at `engine.svelte.ts:884-890` is that
disarming is one tap away, and a Trade Deadline swap completes INSIDE the
career sheet anyway. So the powerups do combine; they combine one screen
later. Making the confirm pills co-available is a product decision that would
break that precedent, and it was not taken unilaterally.

**23. A low-rung skipper still frames lighter than an empty seat.** Round 21's
item 14 noted a replacement-level rail seat carrying a 2.49:1 frame against an
empty dashed seat's 14.09:1, inverting the hierarchy. The manager retint adds
a fill that differentiates the two, but gray-bg against the ground is 1.15:1,
so the inversion survives at the low rung. Fixing it means moving
`--war-low`, which is a token decision reaching every seat on every screen.

**24. `.pos`, `.cost` and `.badges` are still duplicated.** Round 21's item 16
asked for them to move into `app.css` as one set. `PrimePicker` holds
byte-identical copies of all three, so hoisting them takes the count from two
to two while Svelte's scoping makes the component copy win anyway. The same
blocker leaves `.pos`'s own 0.22px optical offset uncorrected, since fixing it
in one market and not the other would drift them apart.

Items 7–10 from round 20 and 11–16 from round 21 are untouched and still
stand, except 12, which item 21 above restates with a larger set.

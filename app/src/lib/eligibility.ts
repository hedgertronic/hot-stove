import type { CardPlayer, SlotType } from "./types";

/** Positional games threshold for C/IF/OF eligibility (BUILD.md). */
const MIN_POS_G = 10;

export function isPitcher(p: CardPlayer): boolean {
  return p.pos.startsWith("SP") || p.pos === "RP";
}

export function isTwoWay(p: CardPlayer): boolean {
  return p.pos.includes("/");
}

/** The players a card actually offers: below-replacement rows are hidden,
 * EXCEPT the best man at any position that would otherwise vanish entirely, so
 * a roster hunting a C or an RP always has at least one candidate.
 *
 * ONE COPY, deliberately, and this is the module that owns it. The market list
 * and the dream-team solver both have to answer "which players does this card
 * offer" and they have to answer it identically: the solver builds the club the
 * finale scores you against, so a filter that drifted would put a man on the
 * dream team that the market never listed — a ceiling nobody could have
 * reached, presented as one they missed. It lived twice, byte-identical, with
 * the second copy's own comment promising it "mirrors" the first.
 *
 * Career sheets (Prime Time) deliberately do NOT run through this. Browsing a
 * man's whole career is a different question from what one card is offering,
 * and a bad season is part of the answer there. */
export function visiblePlayers(ps: CardPlayer[]): CardPlayer[] {
  const rescued = new Set<string>();
  for (const pos of new Set(ps.map((p) => p.pos))) {
    const atPos = ps.filter((p) => p.pos === pos);
    if (atPos.some((p) => p.war >= 0)) continue;
    rescued.add(atPos.reduce((a, b) => (b.war > a.war ? b : a)).id);
  }
  return ps.filter((p) => p.war >= 0 || rescued.has(p.id));
}

/** Every slot type this player can legally occupy. Never empty: FLEX catches all
 * non-pitchers (and two-way players); pitchers are always SP or RP. */
export function eligibleTypes(p: CardPlayer): SlotType[] {
  const types: SlotType[] = [];
  if (p.posG.c >= MIN_POS_G) types.push("C");
  if (p.posG.if >= MIN_POS_G) types.push("IF");
  if (p.posG.of >= MIN_POS_G) types.push("OF");
  if (p.pos.startsWith("SP")) types.push("SP");
  if (p.pos === "RP") types.push("RP");
  if (!isPitcher(p) || isTwoWay(p)) types.push("FLEX");
  return types;
}

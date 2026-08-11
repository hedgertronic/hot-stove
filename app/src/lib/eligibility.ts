import type { CardPlayer, SlotType } from "./types";

/** Positional games threshold for C/IF/OF eligibility (docs/archive/BUILD.md). */
const MIN_POS_G = 10;

export function isPitcher(p: CardPlayer): boolean {
  return p.pos.startsWith("SP") || p.pos === "RP";
}

export function isTwoWay(p: CardPlayer): boolean {
  return p.pos.includes("/");
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

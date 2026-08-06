/** The decision-log codec — ONE implementation, at the bottom of the stack.
 *
 * The engine writes the log into saves and stored finales; share.ts writes it
 * into replay shortcodes. Both used to carry a private copy of these two
 * functions with a comment promising they "must stay in sync" — the exact
 * arrangement that lets a format tweak land in one copy and quietly corrupt
 * the other's output. They live here because the engine cannot import
 * share.ts (share imports the engine) and neither should own a format the
 * other reads.
 *
 * The token grammar itself is specified in share.ts's grammar comment block
 * (verbs, param widths, and why 🏠's discount rides the H toggle) — this
 * module is the mechanical half only. */

/** One committed action, compact enough to encode. Indexes (pi/si/ci) rather
 * than ids/codes keep the encoded string to ~50–70 chars for a full game. */
export type CompactAction =
  | { verb: "S"; pi: number; si: number }            // sign from reel card
  | { verb: "W"; pi: number; si: number }            // swap (trade) from reel card
  | { verb: "P"; ci: number; pi: number; si: number } // prime sign
  | { verb: "V"; ci: number; pi: number; si: number } // prime swap
  | { verb: "O" }                                      // hire owner
  | { verb: "A" }                                      // buy stadium
  | { verb: "M" }                                      // hire manager
  | { verb: "Q"; ci: number }                          // prime manager
  | { verb: "T"; ci: number }                          // season ticket
  | { verb: "R"; ci: number }                          // relocate
  | { verb: "U" }                                      // undo
  | { verb: "C" }                                      // cold respin
  | { verb: "D" }                                      // ✌️ Double Play toggle
  | { verb: "H" }                                      // 🏠 Homegrown toggle

/** Encode a compact action sequence to a body string (no header). */
export function encodeLogBody(actions: CompactAction[]): string {
  let s = "";
  for (const a of actions) {
    if (a.verb === "S" || a.verb === "W") {
      s += a.verb + a.pi.toString(36) + a.si.toString(36);
    } else if (a.verb === "P" || a.verb === "V") {
      s += a.verb + a.ci.toString(36).padStart(2, "0") + a.pi.toString(36) + a.si.toString(36);
    } else if (a.verb === "Q" || a.verb === "T" || a.verb === "R") {
      s += a.verb + a.ci.toString(36).padStart(2, "0");
    } else {
      s += a.verb; // O, A, M, U, C, D, H
    }
  }
  return s;
}

/** Decode a compact body string to CompactAction[]. Returns [] on corrupt input. */
export function decodeLogBody(body: string): CompactAction[] {
  const actions: CompactAction[] = [];
  let i = 0;
  while (i < body.length) {
    const verb = body[i++];
    if (verb === "S" || verb === "W") {
      const pi = parseInt(body[i++], 36);
      const si = parseInt(body[i++], 36);
      actions.push({ verb, pi, si });
    } else if (verb === "P" || verb === "V") {
      const ci = parseInt(body.slice(i, i + 2), 36); i += 2;
      const pi = parseInt(body[i++], 36);
      const si = parseInt(body[i++], 36);
      actions.push({ verb, ci, pi, si });
    } else if (verb === "Q" || verb === "T" || verb === "R") {
      const ci = parseInt(body.slice(i, i + 2), 36); i += 2;
      actions.push({ verb, ci });
    } else if (
      verb === "O" || verb === "A" || verb === "M" ||
      verb === "U" || verb === "C" || verb === "D" || verb === "H"
    ) {
      actions.push({ verb } as CompactAction);
    } else {
      return []; // unrecognized — corrupt
    }
  }
  return actions;
}

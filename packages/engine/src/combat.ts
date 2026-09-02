import { RANK } from "./pieces.ts";
import type { CombatResult, PieceKind } from "./types.ts";

/**
 * Combat from the attacker's perspective.
 * Bomb vs flag: attacker wins (拔旗).
 * Bomb vs anything else: draw.
 * Engineer vs mine: attacker wins.
 * Other vs mine: defender wins.
 */
export function resolveCombat(attacker: PieceKind, defender: PieceKind): CombatResult {
  if (defender === "flag") return "attacker";
  if (attacker === "flag") return "defender";

  const bombInvolved = attacker === "bomb" || defender === "bomb";
  if (bombInvolved) return "draw";

  if (defender === "mine") {
    return attacker === "engineer" ? "attacker" : "defender";
  }
  if (attacker === "mine") {
    return defender === "engineer" ? "defender" : "attacker";
  }

  const ar = RANK[attacker];
  const dr = RANK[defender];
  if (ar > dr) return "attacker";
  if (ar < dr) return "defender";
  return "draw";
}

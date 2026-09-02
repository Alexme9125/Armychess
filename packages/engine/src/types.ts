export type Side = "black" | "white";
export type Visibility = "open" | "hidden";
export type Personality = "cautious" | "balanced" | "aggressive";

export type PieceKind =
  | "commander"
  | "general"
  | "divisional"
  | "brigadier"
  | "regimental"
  | "battalion"
  | "company"
  | "platoon"
  | "engineer"
  | "bomb"
  | "mine"
  | "flag";

export type NodeKind = "station" | "camp" | "hq" | "front";
export type EdgeKind = "road" | "rail";
export type CombatResult = "attacker" | "defender" | "draw";
export type WinReason = "flag" | "no_movable" | "no_moves" | "resign" | "disconnect";

export interface BoardNode {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
  side: Side | "neutral";
}

export interface BoardEdge {
  a: string;
  b: string;
  kind: EdgeKind;
}

export interface Piece {
  id: string;
  side: Side;
  kind: PieceKind;
}

export interface Placement {
  x: number;
  y: number;
  kind: PieceKind;
}

export type Layout = Placement[];

export interface CombatEvent {
  result: CombatResult;
  attackerKind: PieceKind;
  defenderKind: PieceKind;
  attackerId: string;
  defenderId: string;
  attackerSide: Side;
  defenderSide: Side;
}

export interface LastMove {
  from: string;
  to: string;
  path: string[];
  combat: CombatEvent | null;
  commanderDown: Side | null;
}

export interface GameState {
  pieces: Record<string, Piece>;
  turn: Side;
  visibility: Visibility;
  revealedFlags: Record<Side, boolean>;
  winner: Side | null;
  winReason: WinReason | null;
  lastMove: LastMove | null;
}

export interface LegalMove {
  from: string;
  to: string;
  path: string[];
  capture: boolean;
}

export interface LayoutIssue {
  code: string;
  message: string;
}

export const OPPOSITE: Record<Side, Side> = {
  black: "white",
  white: "black",
};

export const EASTER_THUNDER = "325799";
export const EASTER_BOMBARD = "350234";
export const RESERVED_CODES = [EASTER_THUNDER, EASTER_BOMBARD] as const;

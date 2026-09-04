import { getNode, isHq, nid } from "./board.ts";
import { resolveCombat } from "./combat.ts";
import { layoutToPieceMap, resetPieceIds } from "./layout.ts";
import { findMove, generateMoves, hasMovablePiece } from "./moves.ts";
import type { GameState, LastMove, Layout, Piece, Side, Visibility } from "./types.ts";
import { OPPOSITE } from "./types.ts";

export function createGame(
  black: Layout,
  white: Layout,
  visibility: Visibility,
): GameState {
  resetPieceIds(1);
  const pieces: Record<string, Piece> = {
    ...layoutToPieceMap(black, "black"),
    ...layoutToPieceMap(white, "white"),
  };
  return {
    pieces,
    turn: "black",
    visibility,
    revealedFlags: { black: false, white: false },
    winner: null,
    winReason: null,
    lastMove: null,
  };
}

export function cloneState(state: GameState): GameState {
  const pieces: Record<string, Piece> = {};
  for (const [k, v] of Object.entries(state.pieces)) {
    pieces[k] = { ...v };
  }
  return {
    pieces,
    turn: state.turn,
    visibility: state.visibility,
    revealedFlags: { ...state.revealedFlags },
    winner: state.winner,
    winReason: state.winReason,
    lastMove: state.lastMove
      ? {
          ...state.lastMove,
          path: [...state.lastMove.path],
          combat: state.lastMove.combat ? { ...state.lastMove.combat } : null,
        }
      : null,
  };
}

function flagNode(state: GameState, side: Side): string | null {
  for (const [id, p] of Object.entries(state.pieces)) {
    if (p.side === side && p.kind === "flag") return id;
  }
  return null;
}

function finishTurn(state: GameState) {
  const opp = OPPOSITE[state.turn];
  if (!hasMovablePiece(state, opp)) {
    state.winner = state.turn;
    state.winReason = "no_movable";
    return;
  }
  state.turn = opp;
  if (generateMoves(state, state.turn).length === 0) {
    state.winner = OPPOSITE[state.turn];
    state.winReason = "no_moves";
  }
}

export function applyMove(state: GameState, from: string, to: string): GameState {
  const next = cloneState(state);
  if (next.winner) return next;
  const piece = next.pieces[from];
  if (!piece || piece.side !== next.turn) return next;
  const legal = findMove(next, from, to);
  if (!legal) return next;

  const last: LastMove = {
    from,
    to,
    path: legal.path,
    combat: null,
    commanderDown: null,
  };

  const target = next.pieces[to];
  delete next.pieces[from];

  if (!target) {
    next.pieces[to] = piece;
  } else {
    const result = resolveCombat(piece.kind, target.kind);
    last.combat = {
      result,
      attackerKind: piece.kind,
      defenderKind: target.kind,
      attackerId: piece.id,
      defenderId: target.id,
      attackerSide: piece.side,
      defenderSide: target.side,
    };
    if (target.kind === "flag") {
      next.winner = piece.side;
      next.winReason = "flag";
      next.pieces[to] = piece;
      next.lastMove = last;
      return next;
    }
    if (target.kind === "commander") {
      last.commanderDown = target.side;
      next.revealedFlags[target.side] = true;
    }
    if (piece.kind === "commander" && result !== "attacker") {
      last.commanderDown = piece.side;
      next.revealedFlags[piece.side] = true;
    }
    if (result === "attacker") {
      next.pieces[to] = piece;
    } else if (result === "defender") {
      next.pieces[to] = target;
    } else {
      delete next.pieces[to];
    }
  }

  next.lastMove = last;
  if (!next.winner) finishTurn(next);
  return next;
}

export function tryMove(state: GameState, from: string, to: string): GameState | null {
  if (state.winner) return null;
  const piece = state.pieces[from];
  if (!piece || piece.side !== state.turn) return null;
  if (!findMove(state, from, to)) return null;
  return applyMove(state, from, to);
}

export function applyResign(state: GameState, side: Side): GameState {
  const next = cloneState(state);
  next.winner = OPPOSITE[side];
  next.winReason = "resign";
  return next;
}

export function applyDisconnect(state: GameState, side: Side): GameState {
  const next = cloneState(state);
  next.winner = OPPOSITE[side];
  next.winReason = "disconnect";
  return next;
}

export type PublicKind = Piece["kind"] | "hidden";

export interface PublicPiece {
  id: string;
  side: Side;
  kind: PublicKind;
}

export interface PublicState {
  pieces: Record<string, PublicPiece>;
  turn: Side;
  visibility: Visibility;
  revealedFlags: Record<Side, boolean>;
  winner: Side | null;
  winReason: GameState["winReason"];
  lastMove: {
    from: string;
    to: string;
    path: string[];
    combat: {
      result: NonNullable<LastMove["combat"]>["result"];
      attackerKind: PublicKind;
      defenderKind: PublicKind;
      attackerSide: Side;
      defenderSide: Side;
    } | null;
    commanderDown: Side | null;
  } | null;
  flagHints: Record<Side, string | null>;
}

export function projectState(
  state: GameState,
  viewer: Side | "spectator",
): PublicState {
  const showAll = viewer === "spectator" || state.visibility === "open";
  const pieces: Record<string, PublicPiece> = {};
  for (const [id, p] of Object.entries(state.pieces)) {
    const show =
      showAll ||
      p.side === viewer ||
      (p.kind === "flag" && state.revealedFlags[p.side]);
    pieces[id] = {
      id: p.id,
      side: p.side,
      kind: show ? p.kind : "hidden",
    };
  }

  let lastMove: PublicState["lastMove"] = null;
  if (state.lastMove) {
    const c = state.lastMove.combat;
    lastMove = {
      from: state.lastMove.from,
      to: state.lastMove.to,
      path: [...state.lastMove.path],
      commanderDown: state.lastMove.commanderDown,
      combat: c
        ? {
            result: c.result,
            attackerKind:
              showAll || viewer === c.attackerSide ? c.attackerKind : "hidden",
            defenderKind:
              showAll || viewer === c.defenderSide ? c.defenderKind : "hidden",
            attackerSide: c.attackerSide,
            defenderSide: c.defenderSide,
          }
        : null,
    };
  }

  const flagHints: Record<Side, string | null> = { black: null, white: null };
  for (const side of ["black", "white"] as Side[]) {
    if (showAll || state.revealedFlags[side] || viewer === side) {
      flagHints[side] = flagNode(state, side);
    }
  }

  return {
    pieces,
    turn: state.turn,
    visibility: state.visibility,
    revealedFlags: { ...state.revealedFlags },
    winner: state.winner,
    winReason: state.winReason,
    lastMove,
    flagHints,
  };
}

export function nodeLabel(id: string): string {
  const n = getNode(id);
  if (!n) return id;
  return `${n.y},${n.x}`;
}

export function hqIds(side: Side): [string, string] {
  if (side === "black") return [nid(0, 0), nid(0, 4)];
  return [nid(12, 0), nid(12, 4)];
}

export function isImmobileNow(state: GameState, nodeId: string): boolean {
  const p = state.pieces[nodeId];
  if (!p) return false;
  return p.kind === "mine" || p.kind === "flag" || isHq(nodeId);
}

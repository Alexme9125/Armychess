import { isCamp, isHq, linesThrough, neighbors, railNeighbors } from "./board.ts";
import { IMMOBILE } from "./pieces.ts";
import type { GameState, LegalMove } from "./types.ts";

function occupiedByOwn(state: GameState, nodeId: string, side: GameState["turn"]): boolean {
  const p = state.pieces[nodeId];
  return !!p && p.side === side;
}

function occupiedByEnemy(state: GameState, nodeId: string, side: GameState["turn"]): boolean {
  const p = state.pieces[nodeId];
  return !!p && p.side !== side;
}

function canLand(state: GameState, nodeId: string, side: GameState["turn"]): boolean {
  const p = state.pieces[nodeId];
  if (!p) return true;
  if (p.side === side) return false;
  if (isCamp(nodeId)) return false;
  return true;
}

function addMove(
  map: Map<string, LegalMove>,
  from: string,
  to: string,
  path: string[],
  state: GameState,
  side: GameState["turn"],
) {
  if (from === to) return;
  if (!canLand(state, to, side)) return;
  const prev = map.get(to);
  if (prev && prev.path.length <= path.length) return;
  map.set(to, {
    from,
    to,
    path,
    capture: occupiedByEnemy(state, to, side),
  });
}

function slideRail(state: GameState, from: string, side: GameState["turn"], map: Map<string, LegalMove>) {
  for (const line of linesThrough(from)) {
    const i = line.indexOf(from);
    if (i < 0) continue;
    for (const dir of [-1, 1]) {
      const path = [from];
      for (let k = i + dir; k >= 0 && k < line.length; k += dir) {
        const id = line[k];
        const piece = state.pieces[id];
        if (!piece) {
          path.push(id);
          addMove(map, from, id, [...path], state, side);
          continue;
        }
        if (piece.side === side) break;
        if (isCamp(id)) break;
        path.push(id);
        addMove(map, from, id, [...path], state, side);
        break;
      }
    }
  }
}

function engineerRail(state: GameState, from: string, side: GameState["turn"], map: Map<string, LegalMove>) {
  const parent = new Map<string, string | null>();
  parent.set(from, null);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    for (const nxt of railNeighbors(cur)) {
      if (parent.has(nxt)) continue;
      if (occupiedByOwn(state, nxt, side)) continue;
      if (occupiedByEnemy(state, nxt, side) && isCamp(nxt)) continue;
      parent.set(nxt, cur);
      if (occupiedByEnemy(state, nxt, side)) {
        const path: string[] = [];
        let p: string | null = nxt;
        while (p) {
          path.push(p);
          p = parent.get(p) ?? null;
        }
        path.reverse();
        addMove(map, from, nxt, path, state, side);
        continue;
      }
      q.push(nxt);
      const path: string[] = [];
      let p: string | null = nxt;
      while (p) {
        path.push(p);
        p = parent.get(p) ?? null;
      }
      path.reverse();
      addMove(map, from, nxt, path, state, side);
    }
  }
}

export function movesFrom(state: GameState, from: string): LegalMove[] {
  const piece = state.pieces[from];
  if (!piece) return [];
  if (IMMOBILE.has(piece.kind)) return [];
  if (isHq(from)) return [];
  if (state.winner) return [];

  const side = piece.side;
  const map = new Map<string, LegalMove>();

  for (const n of neighbors(from)) {
    addMove(map, from, n.id, [from, n.id], state, side);
  }

  if (piece.kind === "engineer") {
    engineerRail(state, from, side, map);
  } else {
    slideRail(state, from, side, map);
  }

  return [...map.values()];
}

export function generateMoves(state: GameState, side = state.turn): LegalMove[] {
  if (state.winner) return [];
  const out: LegalMove[] = [];
  for (const [id, piece] of Object.entries(state.pieces)) {
    if (piece.side !== side) continue;
    out.push(...movesFrom(state, id));
  }
  return out;
}

export function findMove(state: GameState, from: string, to: string): LegalMove | undefined {
  return movesFrom(state, from).find((m) => m.to === to);
}

export function hasMovablePiece(state: GameState, side: GameState["turn"]): boolean {
  for (const [id, piece] of Object.entries(state.pieces)) {
    if (piece.side !== side) continue;
    if (IMMOBILE.has(piece.kind)) continue;
    if (isHq(id)) continue;
    return true;
  }
  return false;
}

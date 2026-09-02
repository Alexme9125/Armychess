import { isCamp, parseNid } from "./board.ts";
import { resolveCombat } from "./combat.ts";
import { applyMove } from "./game.ts";
import { DEFAULT_LAYOUTS } from "./layout.ts";
import { generateMoves } from "./moves.ts";
import { MATERIAL, STANDARD_KIT } from "./pieces.ts";
import type { GameState, Layout, LegalMove, Personality, PieceKind, Side } from "./types.ts";
import { OPPOSITE } from "./types.ts";

interface Weights {
  material: number;
  flagDef: number;
  attack: number;
  advance: number;
  camp: number;
  engineer: number;
  unknown: number;
}

const WEIGHTS: Record<Personality, Weights> = {
  cautious: {
    material: 1,
    flagDef: 1.65,
    attack: 0.55,
    advance: 0.45,
    camp: 1.25,
    engineer: 1.35,
    unknown: 1.85,
  },
  balanced: {
    material: 1,
    flagDef: 1,
    attack: 1,
    advance: 1,
    camp: 1,
    engineer: 1,
    unknown: 1,
  },
  aggressive: {
    material: 0.88,
    flagDef: 0.5,
    attack: 1.45,
    advance: 1.55,
    camp: 0.75,
    engineer: 0.72,
    unknown: 0.4,
  },
};

const INF = 100_000;

function flagPos(state: GameState, side: Side): { x: number; y: number } | null {
  for (const [id, p] of Object.entries(state.pieces)) {
    if (p.side === side && p.kind === "flag") return parseNid(id);
  }
  return null;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function enemyBag(state: GameState, enemy: Side): PieceKind[] {
  const bag: PieceKind[] = [];
  for (const kind of Object.keys(STANDARD_KIT) as PieceKind[]) {
    if (kind === "flag") continue;
    if (kind === "commander" && state.revealedFlags[enemy]) continue;
    for (let i = 0; i < STANDARD_KIT[kind]; i++) bag.push(kind);
  }
  return bag;
}

function expectedCombat(attacker: PieceKind, bag: PieceKind[], w: Weights): number {
  if (!bag.length) return 0;
  let sum = 0;
  for (const d of bag) {
    const r = resolveCombat(attacker, d);
    if (d === "flag") {
      sum += INF / 4;
      continue;
    }
    if (r === "attacker") sum += MATERIAL[d] * 0.85;
    else if (r === "draw") sum += (MATERIAL[d] - MATERIAL[attacker]) * 0.5;
    else sum -= MATERIAL[attacker] * w.unknown;
  }
  return (sum / bag.length) * w.attack;
}

function evaluate(state: GameState, me: Side, w: Weights, hidden: boolean): number {
  if (state.winner === me) return INF;
  if (state.winner && state.winner !== me) return -INF;

  const opp = OPPOSITE[me];
  const bag = hidden ? enemyBag(state, opp) : [];
  const avgEnemy = bag.length
    ? bag.reduce((s, k) => s + MATERIAL[k], 0) / bag.length
    : 80;

  let score = 0;
  const myFlag = flagPos(state, me);
  const oppFlag = hidden && !state.revealedFlags[opp] ? null : flagPos(state, opp);

  let minThreat = 99;
  let minAttack = 99;

  for (const [id, p] of Object.entries(state.pieces)) {
    const { x, y } = parseNid(id);
    const sign = p.side === me ? 1 : -1;
    let mat = MATERIAL[p.kind];
    if (hidden && p.side !== me && p.kind !== "flag") mat = avgEnemy;
    if (p.kind === "engineer") mat *= w.engineer;
    score += sign * mat * w.material;

    if (isCamp(id)) score += sign * 22 * w.camp;

    if (p.side === me && p.kind !== "flag" && p.kind !== "mine") {
      const progress = me === "black" ? y : 12 - y;
      score += progress * 4.2 * w.advance;
      if (oppFlag) minAttack = Math.min(minAttack, dist({ x, y }, oppFlag));
    }
    if (p.side !== me && p.kind !== "flag" && p.kind !== "mine" && myFlag) {
      minThreat = Math.min(minThreat, dist({ x, y }, myFlag));
    }
  }

  if (myFlag) {
    score += Math.min(minThreat, 12) * 9 * w.flagDef;
    for (const [id, p] of Object.entries(state.pieces)) {
      if (p.side !== me) continue;
      const pos = parseNid(id);
      if (dist(pos, myFlag) === 1) {
        if (p.kind === "mine") score += 28 * w.flagDef;
        else if (p.kind === "bomb") score += 18 * w.flagDef;
        else if (p.kind === "commander" || p.kind === "general") score += 12 * w.flagDef;
      }
    }
  }
  if (oppFlag) {
    score -= Math.min(minAttack, 12) * 7 * w.advance;
  }
  return score;
}

function orderMoves(state: GameState, moves: LegalMove[]): LegalMove[] {
  return [...moves].sort((a, b) => {
    const av = a.capture ? 1 : 0;
    const bv = b.capture ? 1 : 0;
    if (av !== bv) return bv - av;
    return b.path.length - a.path.length;
  });
}

function alphabeta(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  me: Side,
  w: Weights,
  deadline: number,
  stats: { nodes: number },
): number {
  stats.nodes++;
  if (stats.nodes > 14_000 || Date.now() > deadline) {
    return evaluate(state, me, w, false);
  }
  if (depth <= 0 || state.winner) return evaluate(state, me, w, false);

  const moves = orderMoves(state, generateMoves(state));
  if (!moves.length) return evaluate(state, me, w, false);

  const maximizing = state.turn === me;
  if (maximizing) {
    let best = -INF * 2;
    for (const m of moves) {
      const next = applyMove(state, m.from, m.to);
      const val = alphabeta(next, depth - 1, alpha, beta, me, w, deadline, stats);
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = INF * 2;
  for (const m of moves) {
    const next = applyMove(state, m.from, m.to);
    const val = alphabeta(next, depth - 1, alpha, beta, me, w, deadline, stats);
    if (val < best) best = val;
    if (best < beta) beta = best;
    if (beta <= alpha) break;
  }
  return best;
}

function pickHidden(state: GameState, me: Side, w: Weights): LegalMove | null {
  const moves = generateMoves(state);
  if (!moves.length) return null;
  const opp = OPPOSITE[me];
  const bag = enemyBag(state, opp);
  let best: LegalMove | null = null;
  let bestScore = -Infinity;

  for (const m of moves) {
    const target = state.pieces[m.to];
    let score = 0;
    if (!target) {
      const next = applyMove(state, m.from, m.to);
      score = evaluate(next, me, w, true);
    } else if (target.kind === "flag" || (state.visibility === "open" && target.side !== me)) {
      const next = applyMove(state, m.from, m.to);
      score = evaluate(next, me, w, true);
    } else {
      const attacker = state.pieces[m.from]!;
      score = evaluate(state, me, w, true);
      score += expectedCombat(attacker.kind, bag, w);
      const { y } = parseNid(m.to);
      const progress = me === "black" ? y : 12 - y;
      score += progress * 3 * w.advance;
      if (attacker.kind === "commander" || attacker.kind === "general") {
        score -= 40 * w.unknown;
      }
    }
    score += Math.random() * 3;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export function chooseMove(
  state: GameState,
  personality: Personality,
  thinkMs = 280,
): LegalMove | null {
  const me = state.turn;
  const w = WEIGHTS[personality];
  if (state.visibility === "hidden") {
    return pickHidden(state, me, w);
  }

  const moves = orderMoves(state, generateMoves(state));
  if (!moves.length) return null;

  const deadline = Date.now() + thinkMs;
  const stats = { nodes: 0 };
  let bestMove = moves[0];
  let bestVal = -Infinity;

  for (const depth of [1, 2]) {
    if (Date.now() > deadline) break;
    let localBest = bestMove;
    let localVal = -Infinity;
    for (const m of moves) {
      if (Date.now() > deadline) break;
      const next = applyMove(state, m.from, m.to);
      const val = alphabeta(next, depth - 1, -INF * 2, INF * 2, me, w, deadline, stats);
      const jitter = (Math.random() - 0.5) * 2;
      if (val + jitter > localVal) {
        localVal = val + jitter;
        localBest = m;
      }
    }
    if (localVal > -INF) {
      bestMove = localBest;
      bestVal = localVal;
    }
    if (stats.nodes > 12_000) break;
  }
  void bestVal;
  return bestMove;
}

export function aiLayout(personality: Personality): Layout {
  return DEFAULT_LAYOUTS[personality].map((p) => ({ ...p }));
}

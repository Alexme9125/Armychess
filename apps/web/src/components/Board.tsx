import {
  BOARD_EDGES,
  BOARD_NODES,
  KIND_LABEL,
  MOUNTAINS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  generateMoves,
  isCamp,
  isHq,
  mountainDisplay,
  nodeDisplay,
  parseNid,
  type GameState,
  type LegalMove,
  type PieceKind,
  type PublicKind,
  type PublicState,
  type Side,
} from "@armychess/engine";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LiquidOverlay, type FxEvent } from "./LiquidOverlay";
import { PieceFace } from "./PieceFace";

function toPct(id: string, flipY: boolean) {
  const p = nodeDisplay(id, flipY);
  return { x: (p.x / VIEW_WIDTH) * 100, y: (p.y / VIEW_HEIGHT) * 100 };
}

function sideColor(side: Side) {
  return side === "black" ? "rgba(36,40,48,0.95)" : "rgba(236,242,250,0.95)";
}

export function GameBoard({
  state,
  origin,
  interactive,
  onMove,
  thinking,
}: {
  state: PublicState;
  origin: Side | "spectator";
  interactive: boolean;
  onMove: (from: string, to: string) => void;
  thinking?: boolean;
}) {
  const flipY = origin === "black";
  const mySide: Side | null = origin === "spectator" ? null : origin;
  const [selected, setSelected] = useState<string | null>(null);
  const [fx, setFx] = useState<FxEvent | null>(null);
  const playedFx = useRef("");

  const legal: LegalMove[] = useMemo(() => {
    if (!selected || !mySide || !interactive || state.winner) return [];
    const fake: GameState = {
      pieces: Object.fromEntries(
        Object.entries(state.pieces).map(([id, p]) => [
          id,
          {
            id: p.id,
            side: p.side,
            kind: p.kind === "hidden" ? "platoon" : (p.kind as PieceKind),
          },
        ]),
      ),
      turn: state.turn,
      visibility: state.visibility,
      revealedFlags: state.revealedFlags,
      winner: state.winner,
      winReason: state.winReason,
      lastMove: null,
    };
    const own = state.pieces[selected];
    if (!own || own.side !== mySide || own.kind === "hidden") return [];
    fake.pieces[selected] = { id: own.id, side: own.side, kind: own.kind };
    return generateMoves(fake, mySide).filter((m) => m.from === selected);
  }, [selected, mySide, interactive, state]);

  const destSet = new Set(legal.map((m) => m.to));

  useEffect(() => {
    const lm = state.lastMove;
    if (!lm?.combat) return;
    const sig = `${lm.from}-${lm.to}-${lm.combat.result}-${lm.path.join(",")}`;
    if (playedFx.current === sig) return;
    playedFx.current = sig;
    const a = toPct(lm.from, flipY);
    const b = toPct(lm.to, flipY);
    if (lm.combat.result === "draw") {
      setFx({
        id: Date.now(),
        kind: "splash",
        x: b.x,
        y: b.y,
        fromX: a.x,
        fromY: a.y,
        colorA: sideColor("black"),
        colorB: sideColor("white"),
      });
    } else {
      setFx({
        id: Date.now(),
        kind: "fusion",
        x: b.x,
        y: b.y,
        fromX: a.x,
        fromY: a.y,
        colorA: sideColor("black"),
        colorB: sideColor("white"),
      });
    }
  }, [state.lastMove, flipY]);

  function clickNode(id: string) {
    if (!interactive || !mySide || state.winner || thinking) return;
    const piece = state.pieces[id];
    if (selected && destSet.has(id)) {
      onMove(selected, id);
      setSelected(null);
      return;
    }
    if (piece && piece.side === mySide && state.turn === mySide) {
      setSelected(id);
      return;
    }
    setSelected(null);
  }

  const last = state.lastMove;

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div
        className="glass-strong relative overflow-hidden rounded-[28px] p-2 sm:p-3"
        style={{ aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}` }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute -right-8 bottom-16 h-44 w-44 rounded-full bg-indigo-400/20 blur-3xl" />
        </div>
        <div className="relative h-full w-full">
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-full w-full">
            <defs>
              <linearGradient id="rail" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="rgba(186,230,253,0.9)" />
                <stop offset="1" stopColor="rgba(196,181,253,0.85)" />
              </linearGradient>
              <filter id="softglow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {BOARD_EDGES.filter((e) => e.kind === "road").map((e) => {
              const a = nodeDisplay(e.a, flipY);
              const b = nodeDisplay(e.b, flipY);
              return (
                <line
                  key={`r-${e.a}-${e.b}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              );
            })}
            {BOARD_EDGES.filter((e) => e.kind === "rail").map((e) => {
              const a = nodeDisplay(e.a, flipY);
              const b = nodeDisplay(e.b, flipY);
              return (
                <g key={`l-${e.a}-${e.b}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="7.5"
                    strokeLinecap="round"
                  />
                  <line
                    className="rail-flow"
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="url(#rail)"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    filter="url(#softglow)"
                  />
                </g>
              );
            })}
            {MOUNTAINS.map((m) => {
              const p = mountainDisplay(m.x, m.y, flipY);
              return (
                <g key={`m-${m.x}-${m.y}`}>
                  <circle cx={p.x} cy={p.y} r="16" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                  <circle cx={p.x} cy={p.y} r="8" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.28)" />
                </g>
              );
            })}
            {BOARD_NODES.map((n) => {
              const p = nodeDisplay(n.id, flipY);
              const active = selected === n.id;
              const dest = destSet.has(n.id);
              const hinted =
                (state.flagHints.black === n.id && origin !== "black") ||
                (state.flagHints.white === n.id && origin !== "white");
              const lastHere = last && (last.from === n.id || last.to === n.id);
              return (
                <g key={n.id} onClick={() => clickNode(n.id)} className="cursor-pointer">
                  {n.kind === "camp" ? (
                    <>
                      <circle cx={p.x} cy={p.y} r="22" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.42)" />
                      <circle cx={p.x} cy={p.y} r="15" fill="rgba(125,211,252,0.08)" stroke="rgba(186,230,253,0.7)" />
                    </>
                  ) : n.kind === "hq" ? (
                    <rect
                      x={p.x - 22}
                      y={p.y - 18}
                      width="44"
                      height="36"
                      rx="8"
                      fill="rgba(15,18,28,0.35)"
                      stroke="rgba(252,211,77,0.8)"
                      strokeWidth="2"
                    />
                  ) : (
                    <rect
                      x={p.x - 20}
                      y={p.y - 14}
                      width="40"
                      height="28"
                      rx="10"
                      fill="rgba(255,255,255,0.07)"
                      stroke={n.kind === "front" ? "rgba(167,243,208,0.7)" : "rgba(255,255,255,0.28)"}
                      strokeWidth="1.6"
                    />
                  )}
                  {dest ? <circle cx={p.x} cy={p.y} r="6" fill="rgba(52,211,153,0.9)" /> : null}
                  {active ? (
                    <circle cx={p.x} cy={p.y} r="26" fill="none" stroke="rgba(250,250,250,0.85)" strokeWidth="2" />
                  ) : null}
                  {hinted ? (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="28"
                      fill="none"
                      stroke="rgba(251,191,36,0.9)"
                      strokeDasharray="4 3"
                    />
                  ) : null}
                  {lastHere ? (
                    <circle cx={p.x} cy={p.y} r="24" fill="none" stroke="rgba(147,197,253,0.45)" />
                  ) : null}
                </g>
              );
            })}
          </svg>

          {Object.entries(state.pieces).map(([id, piece]) => {
            const p = toPct(id, flipY);
            return (
              <motion.button
                key={piece.id}
                type="button"
                className="absolute -translate-x-1/2 -translate-y-1/2"
                initial={false}
                animate={{ left: `${p.x}%`, top: `${p.y}%` }}
                transition={{ type: "spring", stiffness: 240, damping: 24, mass: 0.8 }}
                onClick={() => clickNode(id)}
              >
                <PieceFace kind={piece.kind as PublicKind} side={piece.side} />
              </motion.button>
            );
          })}

          <LiquidOverlay event={fx} onDone={() => setFx(null)} />
        </div>

        {thinking ? (
          <div className="absolute inset-x-0 bottom-3 text-center text-xs tracking-widest text-white/70">
            思考中…
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function localPct(x: number, y: number) {
  const gx = 70 + x * 108;
  const gy = 48 + (5 - y) * 76;
  const w = 70 * 2 + 4 * 108;
  const h = 48 * 2 + 5 * 76;
  return { left: (gx / w) * 100, top: (gy / h) * 100, w, h };
}

export function parseMaybe(id: string) {
  return parseNid(id);
}

export { KIND_LABEL, isCamp, isHq };

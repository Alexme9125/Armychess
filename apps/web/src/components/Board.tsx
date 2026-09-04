import {
  KIND_LABEL,
  LOCAL_VIEW_HEIGHT,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  generateMoves,
  isCamp,
  isHq,
  localNodePos,
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
import { BoardArt } from "./BoardArt";
import { LiquidOverlay, type FxEvent } from "./LiquidOverlay";
import { PieceFace } from "./PieceFace";

function toPct(id: string, flipY: boolean) {
  const p = nodeDisplay(id, flipY);
  return { x: (p.x / VIEW_WIDTH) * 100, y: (p.y / VIEW_HEIGHT) * 100 };
}

function sideColor(side: Side) {
  return side === "black" ? "rgba(96,118,158,0.96)" : "rgba(248,252,255,0.96)";
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
    const attackerSide = lm.combat.attackerSide;
    const defenderSide = lm.combat.defenderSide;
    if (lm.combat.result === "draw") {
      setFx({
        id: Date.now(),
        kind: "splash",
        x: b.x,
        y: b.y,
        fromX: a.x,
        fromY: a.y,
        colorA: sideColor(attackerSide),
        colorB: sideColor(defenderSide),
      });
    } else {
      setFx({
        id: Date.now(),
        kind: "fusion",
        x: b.x,
        y: b.y,
        fromX: a.x,
        fromY: a.y,
        colorA: sideColor(attackerSide),
        colorB: sideColor(defenderSide),
        incomingWins: lm.combat.result === "attacker",
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
  const hideNode = fx && last?.combat ? last.to : null;
  const hinted = new Set<string>();
  if (state.flagHints.black && origin !== "black") hinted.add(state.flagHints.black);
  if (state.flagHints.white && origin !== "white") hinted.add(state.flagHints.white);

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div
        className="glass-strong relative overflow-hidden rounded-[24px] p-2 sm:p-3"
        style={{ aspectRatio: `${VIEW_WIDTH} / ${VIEW_HEIGHT}` }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute -right-8 bottom-10 h-36 w-36 rounded-full bg-indigo-400/18 blur-3xl" />
        </div>
        <div className="relative h-full w-full">
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-full w-full">
            <BoardArt
              flipY={flipY}
              selected={selected}
              destSet={destSet}
              hinted={hinted}
              lastFrom={last?.from}
              lastTo={last?.to}
              onNodeClick={clickNode}
            />
          </svg>

          {Object.entries(state.pieces).map(([id, piece]) => {
            if (hideNode === id) return null;
            const p = toPct(id, flipY);
            return (
              <motion.button
                key={piece.id}
                type="button"
                className="absolute -translate-x-1/2 -translate-y-1/2"
                initial={false}
                animate={{ left: `${p.x}%`, top: `${p.y}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.7 }}
                onClick={() => clickNode(id)}
              >
                <PieceFace kind={piece.kind as PublicKind} side={piece.side} />
              </motion.button>
            );
          })}

          <LiquidOverlay event={fx} onDone={() => setFx(null)} />
        </div>

        {thinking ? (
          <div className="absolute inset-x-0 bottom-2 text-center text-xs tracking-widest text-white/70">
            思考中…
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function localPct(x: number, y: number) {
  const p = localNodePos(x, y);
  return { left: (p.x / VIEW_WIDTH) * 100, top: (p.y / LOCAL_VIEW_HEIGHT) * 100, w: VIEW_WIDTH, h: LOCAL_VIEW_HEIGHT };
}

export function parseMaybe(id: string) {
  return parseNid(id);
}

export { KIND_LABEL, LOCAL_VIEW_HEIGHT, VIEW_WIDTH, isCamp, isHq };

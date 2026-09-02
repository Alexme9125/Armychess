import {
  aiLayout,
  chooseMove,
  createGame,
  easterLabel,
  expandEasterCode,
  projectState,
  tryMove,
  type GameState,
  type Personality,
  type PublicState,
  type Side,
  type Visibility,
} from "@armychess/engine";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { bpKey, loadBlueprint } from "../api";
import { GameBoard } from "../components/Board";

const WIN: Record<string, string> = {
  flag: "拔旗获胜",
  no_movable: "对方无子可动",
  no_moves: "对方无棋可走",
  resign: "认输",
  disconnect: "对方离开",
};

export function PvePage() {
  const [code, setCode] = useState(() => localStorage.getItem(bpKey()) ?? "");
  const [personality, setPersonality] = useState<Personality>("balanced");
  const [side, setSide] = useState<Side>("white");
  const [visibility, setVisibility] = useState<Visibility>("open");
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [easter, setEaster] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const timer = useRef<number | null>(null);

  const publicState: PublicState | null = game ? projectState(game, side) : null;

  async function start() {
    setError(null);
    try {
      const egg = expandEasterCode(code);
      const playerLayout = egg ?? (await loadBlueprint(code));
      const ai = aiLayout(personality);
      const g =
        side === "black"
          ? createGame(playerLayout, ai, visibility)
          : createGame(ai, playerLayout, visibility);
      setEaster(easterLabel(code));
      setGame(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "无法开局");
    }
  }

  useEffect(() => {
    if (!game || game.winner) return;
    if (game.turn === side) return;
    setThinking(true);
    timer.current = window.setTimeout(() => {
      const mv = chooseMove(game, personality, 240);
      setThinking(false);
      if (mv) {
        const next = tryMove(game, mv.from, mv.to);
        if (next) setGame(next);
      }
    }, 700);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [game, side, personality]);

  function move(from: string, to: string) {
    if (!game || game.turn !== side || thinking) return;
    const next = tryMove(game, from, to);
    if (next) setGame(next);
  }

  if (!game || !publicState) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Link to="/" className="text-sm text-white/60">
          ← 返回
        </Link>
        <h1 className="serif mt-4 text-3xl">人机对弈</h1>
        <div className="glass mt-6 space-y-4 rounded-3xl p-5">
          <label className="block text-sm text-white/70">
            蓝图码
            <input
              className="mt-2 w-full rounded-2xl bg-white/10 px-4 py-3 tracking-[0.35em]"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="六位码或彩蛋码"
            />
          </label>
          <label className="block text-sm text-white/70">
            人机人格
            <select
              className="mt-2 w-full rounded-2xl bg-white/10 px-4 py-3"
              value={personality}
              onChange={(e) => setPersonality(e.target.value as Personality)}
            >
              <option value="cautious">谨慎</option>
              <option value="balanced">平衡</option>
              <option value="aggressive">激进</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-2xl py-3 ${side === "black" ? "bg-white text-slate-900" : "bg-white/10"}`}
              onClick={() => setSide("black")}
            >
              执黑先行
            </button>
            <button
              className={`flex-1 rounded-2xl py-3 ${side === "white" ? "bg-white text-slate-900" : "bg-white/10"}`}
              onClick={() => setSide("white")}
            >
              执白
            </button>
          </div>
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-2xl py-3 ${visibility === "open" ? "bg-white text-slate-900" : "bg-white/10"}`}
              onClick={() => setVisibility("open")}
            >
              明棋
            </button>
            <button
              className={`flex-1 rounded-2xl py-3 ${visibility === "hidden" ? "bg-white text-slate-900" : "bg-white/10"}`}
              onClick={() => setVisibility("hidden")}
            >
              暗棋
            </button>
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button className="w-full rounded-2xl bg-white py-3 font-semibold text-slate-900" onClick={start}>
            开始对弈
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button className="text-sm text-white/60" onClick={() => setGame(null)}>
          ← 结束
        </button>
        <div className="text-center">
          <div className="text-sm text-white/80">
            {game.winner
              ? `${game.winner === side ? "你赢了" : "你输了"} · ${WIN[game.winReason ?? ""] ?? ""}`
              : game.turn === side
                ? "轮到你"
                : "对方思考"}
          </div>
          {easter ? <div className="text-xs text-amber-300">{easter}</div> : null}
        </div>
        <div className="text-xs text-white/50">{visibility === "hidden" ? "暗棋" : "明棋"}</div>
      </div>
      <GameBoard
        state={publicState}
        origin={side}
        interactive={!game.winner && game.turn === side}
        onMove={move}
        thinking={thinking}
      />
      {game.lastMove?.commanderDown ? (
        <p className="mt-3 text-center text-sm text-amber-200">
          {game.lastMove.commanderDown === "black" ? "黑方" : "白方"}司令阵亡，军旗位置已暴露
        </p>
      ) : null}
    </div>
  );
}

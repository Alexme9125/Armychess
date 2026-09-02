import type { PublicState, Side, Visibility } from "@armychess/engine";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { bpKey, nickKey } from "../api";
import { GameBoard } from "../components/Board";
import { getSocket } from "../socket";

interface Occupant {
  id: string;
  nickname: string;
  ready: boolean;
  hasBlueprint: boolean;
  connected: boolean;
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  phase: "waiting" | "playing" | "ended";
  visibility: Visibility;
  seats: Record<Side, Occupant | null>;
  spectators: { id: string; nickname: string }[];
  you: { id: string; role: Side | "spectator"; nickname: string };
  publicState: PublicState | null;
  message: string | null;
}

const WIN: Record<string, string> = {
  flag: "拔旗获胜",
  no_movable: "对方无子可动",
  no_moves: "对方无棋可走",
  resign: "认输",
  disconnect: "对方离开",
};

export function RoomPage() {
  const { code: param } = useParams();
  const creating = param === "new";
  const [snap, setSnap] = useState<RoomSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [bp, setBp] = useState(() => localStorage.getItem(bpKey()) ?? "");
  const nickname = useMemo(() => localStorage.getItem(nickKey()) ?? "棋手", []);

  useEffect(() => {
    const s = getSocket();
    const onRoom = (room: RoomSnapshot) => setSnap(room);
    const onErr = (e: { message: string }) => setErr(e.message);
    const onSession = () => {
      if (creating) s.emit("createRoom", { visibility: "open", hostSide: "black" });
      else s.emit("joinRoom", { code: param });
    };
    s.on("room", onRoom);
    s.on("notice", onErr);
    s.on("session", onSession);
    s.connect();
    s.emit("hello", { nickname });
    return () => {
      s.emit("leave");
      s.off("room", onRoom);
      s.off("notice", onErr);
      s.off("session", onSession);
    };
  }, [creating, nickname, param]);

  const s = getSocket();
  const you = snap?.you;
  const host = snap && you && snap.hostId === you.id;
  const playing = snap?.phase === "playing";
  const origin = you?.role === "black" || you?.role === "white" ? you.role : "spectator";

  return (
    <div className="mx-auto max-w-3xl px-3 py-4">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/" className="text-sm text-white/60">
          ← 大厅
        </Link>
        <div className="text-center">
          <div className="text-xs text-white/50">房间码</div>
          <div className="serif text-2xl tracking-[0.35em]">{snap?.code ?? "……"}</div>
        </div>
        <button
          className="text-sm text-white/60"
          onClick={() => snap?.code && navigator.clipboard?.writeText(snap.code)}
        >
          复制
        </button>
      </div>

      {err ? <p className="mb-3 text-center text-sm text-rose-300">{err}</p> : null}
      {snap?.message ? <p className="mb-3 text-center text-sm text-cyan-200">{snap.message}</p> : null}

      {snap?.publicState ? (
        <>
          <div className="mb-3 text-center text-sm text-white/80">
            {snap.publicState.winner
              ? `${snap.publicState.winner === "black" ? "黑方" : "白方"}胜 · ${
                  WIN[snap.publicState.winReason ?? ""] ?? ""
                }`
              : `${snap.publicState.turn === "black" ? "黑方" : "白方"}行棋`}
            {you?.role === "spectator" ? " · 旁观" : ""}
          </div>
          <GameBoard
            state={snap.publicState}
            origin={origin}
            interactive={
              playing &&
              (you?.role === "black" || you?.role === "white") &&
              snap.publicState.turn === you.role &&
              !snap.publicState.winner
            }
            onMove={(from, to) => s.emit("move", { from, to })}
          />
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["black", "white"] as Side[]).map((side) => {
            const occ = snap?.seats[side];
            return (
              <div key={side} className="glass rounded-3xl p-5">
                <div className="text-sm text-white/50">{side === "black" ? "黑座 · 先行" : "白座"}</div>
                <div className="serif mt-2 text-2xl">{occ?.nickname ?? "空座"}</div>
                <div className="mt-1 text-xs text-white/50">
                  {occ ? `${occ.hasBlueprint ? "已带蓝图" : "未带蓝图"} · ${occ.ready ? "已准备" : "未准备"}` : "等待入座"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="glass mt-4 space-y-3 rounded-3xl p-4">
        {host && snap?.phase !== "playing" ? (
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-full px-4 py-2 text-sm ${snap?.visibility === "open" ? "bg-white text-slate-900" : "bg-white/10"}`}
              onClick={() => s.emit("setRules", { visibility: "open" })}
            >
              明棋
            </button>
            <button
              className={`rounded-full px-4 py-2 text-sm ${snap?.visibility === "hidden" ? "bg-white text-slate-900" : "bg-white/10"}`}
              onClick={() => s.emit("setRules", { visibility: "hidden" })}
            >
              暗棋
            </button>
            {snap?.phase === "ended" ? (
              <button className="rounded-full bg-white/10 px-4 py-2 text-sm" onClick={() => s.emit("rematch")}>
                再来一局
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-white/60">{snap?.visibility === "hidden" ? "本局暗棋" : "本局明棋"}</p>
        )}

        {you?.role !== "spectator" && snap?.phase !== "playing" ? (
          <>
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-2xl bg-white/10 px-4 py-3 tracking-[0.3em]"
                placeholder="输入蓝图码"
                name="roomBlueprint"
                id="roomBlueprint"
                value={bp}
                onChange={(e) => setBp(e.target.value.toUpperCase())}
              />
              <button
                className="rounded-2xl bg-white px-4 font-semibold text-slate-900"
                onClick={() => s.emit("setBlueprint", { code: bp })}
              >
                读取
              </button>
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-2xl bg-white py-3 font-semibold text-slate-900"
                onClick={() => s.emit("setReady", { ready: true })}
              >
                准备
              </button>
              <button className="rounded-2xl bg-white/10 px-4 py-3" onClick={() => s.emit("setReady", { ready: false })}>
                取消
              </button>
              <button className="rounded-2xl bg-white/10 px-4 py-3" onClick={() => s.emit("stand")}>
                站起
              </button>
            </div>
          </>
        ) : null}

        {you?.role === "spectator" && snap?.phase !== "playing" ? (
          <div className="flex gap-2">
            <button className="flex-1 rounded-2xl bg-white py-3 font-semibold text-slate-900" onClick={() => s.emit("sit", { side: "black" })}>
              坐黑
            </button>
            <button className="flex-1 rounded-2xl bg-white py-3 font-semibold text-slate-900" onClick={() => s.emit("sit", { side: "white" })}>
              坐白
            </button>
          </div>
        ) : null}

        {snap?.spectators.length ? (
          <p className="text-xs text-white/50">旁观：{snap.spectators.map((x) => x.nickname).join("、")}</p>
        ) : null}
      </div>
    </div>
  );
}

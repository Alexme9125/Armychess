import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { nickKey } from "../api";

export function HomePage() {
  const nav = useNavigate();
  const [name, setName] = useState(() => localStorage.getItem(nickKey()) ?? "棋手");
  const [room, setRoom] = useState("");

  useEffect(() => {
    localStorage.setItem(nickKey(), name);
  }, [name]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.4em] text-white/50">LUZHANQI</p>
          <h1 className="serif mt-2 text-5xl sm:text-6xl">陆军棋</h1>
        </div>
        <label className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm">
          昵称
          <input
            className="w-28 bg-transparent outline-none"
            name="nickname"
            id="nickname"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </header>

      <p className="mt-6 max-w-xl text-white/65">
        液态玻璃棋盘，云母材质棋子。先在工作室布阵生成蓝图码，再带入人机或房间对弈。
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link to="/studio" className="glass group rounded-[28px] p-6 transition hover:-translate-y-0.5">
          <div className="text-sm text-cyan-200">01</div>
          <h2 className="serif mt-3 text-2xl">布阵工作室</h2>
          <p className="mt-2 text-sm text-white/60">拖拽 25 枚棋子，保存后得到 6 位蓝图码。</p>
        </Link>
        <Link to="/pve" className="glass group rounded-[28px] p-6 transition hover:-translate-y-0.5">
          <div className="text-sm text-violet-200">02</div>
          <h2 className="serif mt-3 text-2xl">人机对弈</h2>
          <p className="mt-2 text-sm text-white/60">谨慎 / 平衡 / 激进三种人格，用于练棋。</p>
        </Link>
        <Link to="/room/new" className="glass group rounded-[28px] p-6 transition hover:-translate-y-0.5">
          <div className="text-sm text-amber-200">03</div>
          <h2 className="serif mt-3 text-2xl">创建房间</h2>
          <p className="mt-2 text-sm text-white/60">选择明棋或暗棋，邀请对手输入房间码加入。</p>
        </Link>
        <div className="glass rounded-[28px] p-6">
          <div className="text-sm text-emerald-200">04</div>
          <h2 className="serif mt-3 text-2xl">加入房间</h2>
          <p className="mt-2 text-sm text-white/60">座位满后自动旁观；对局外可站起或坐下。</p>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (room.trim()) nav(`/room/${room.trim().toUpperCase()}`);
            }}
          >
            <input
              className="glass min-w-0 flex-1 rounded-2xl px-4 py-3 tracking-[0.3em]"
              placeholder="房间码"
              name="roomCode"
              id="roomCode"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
            <button className="rounded-2xl bg-white px-5 font-semibold text-slate-900">进入</button>
          </form>
        </div>
      </div>
    </div>
  );
}

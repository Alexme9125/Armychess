import {
  DEFAULT_LAYOUTS,
  LOCAL_VIEW_HEIGHT,
  VIEW_WIDTH,
  isCampLocal,
  kitList,
  validateLayout,
  type Layout,
  type Personality,
  type PieceKind,
} from "@armychess/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { bpKey, saveBlueprint } from "../api";
import { localPct } from "../components/Board";
import { BoardArt } from "../components/BoardArt";
import { PieceFace } from "../components/PieceFace";

type Drag = { kind: PieceKind; from?: { x: number; y: number } } | null;

export function StudioPage() {
  const [layout, setLayout] = useState<Layout>([]);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState<Drag>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const remaining = useMemo(() => {
    const used = [...layout.map((p) => p.kind)];
    const all = kitList();
    const left: PieceKind[] = [];
    for (const k of all) {
      const i = used.indexOf(k);
      if (i >= 0) used.splice(i, 1);
      else left.push(k);
    }
    return left;
  }, [layout]);

  const issues = validateLayout(layout);
  const complete = issues.length === 0;

  function occupy(x: number, y: number, kind: PieceKind, from?: { x: number; y: number }) {
    if (isCampLocal(x, y)) return;
    setCode(null);
    setLayout((prev) => {
      let next = prev.filter((p) => !(p.x === x && p.y === y));
      if (from) next = next.filter((p) => !(p.x === from.x && p.y === from.y));
      const displaced = prev.find((p) => p.x === x && p.y === y);
      next = [...next, { x, y, kind }];
      if (displaced && from) next.push({ x: from.x, y: from.y, kind: displaced.kind });
      return next;
    });
  }

  function pickUp(x: number, y: number) {
    const p = layout.find((q) => q.x === x && q.y === y);
    if (!p) return;
    setDrag({ kind: p.kind, from: { x, y } });
  }

  function dropAtClient(clientX: number, clientY: number) {
    const el = boardRef.current;
    if (!el || !drag) {
      setDrag(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) {
      if (drag.from) {
        setLayout((prev) => prev.filter((p) => !(p.x === drag.from!.x && p.y === drag.from!.y)));
        setCode(null);
      }
      setDrag(null);
      return;
    }
    const lx = ((clientX - r.left) / r.width) * VIEW_WIDTH;
    const ly = ((clientY - r.top) / r.height) * LOCAL_VIEW_HEIGHT;
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = 0; y <= 5; y++) {
      for (let x = 0; x < 5; x++) {
        const p = localPct(x, y);
        const cx = (p.left / 100) * VIEW_WIDTH;
        const cy = (p.top / 100) * LOCAL_VIEW_HEIGHT;
        const d = (cx - lx) ** 2 + (cy - ly) ** 2;
        if (!best || d < best.d) best = { x, y, d };
      }
    }
    if (best && best.d < 40 * 40) occupy(best.x, best.y, drag.kind, drag.from);
    setDrag(null);
  }

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setCursor({ x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => dropAtClient(e.clientX, e.clientY);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag]);

  async function save() {
    setError(null);
    if (!complete) {
      setError(issues[0]?.message ?? "阵型不完整");
      return;
    }
    setSaving(true);
    try {
      const c = await saveBlueprint(layout);
      setCode(c);
      localStorage.setItem(bpKey(), c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function fill(p: Personality) {
    setLayout(DEFAULT_LAYOUTS[p].map((x) => ({ ...x })));
    setCode(null);
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-28 pt-6 lg:flex-row lg:pb-10">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <Link to="/" className="text-sm text-white/60 hover:text-white">
              ← 返回
            </Link>
            <h1 className="serif mt-2 text-3xl">布阵工作室</h1>
            <p className="mt-1 text-sm text-white/60">把棋子拖到棋盘。军旗入大本营，地雷仅最后两排，炸弹不能上锋线。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["cautious", "balanced", "aggressive"] as Personality[]).map((p) => (
              <button
                key={p}
                className="glass rounded-full px-3 py-1 text-xs"
                onClick={() => fill(p)}
              >
                {p === "cautious" ? "谨慎阵" : p === "balanced" ? "平衡阵" : "激进阵"}
              </button>
            ))}
            <button
              className="glass rounded-full px-3 py-1 text-xs"
              onClick={() => {
                setLayout([]);
                setCode(null);
              }}
            >
              清空
            </button>
          </div>
        </div>

        <div
          ref={boardRef}
          className="glass-strong relative mx-auto w-full max-w-[520px] overflow-hidden rounded-[28px]"
          style={{ aspectRatio: `${VIEW_WIDTH} / ${LOCAL_VIEW_HEIGHT}` }}
        >
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${LOCAL_VIEW_HEIGHT}`} className="h-full w-full">
            <BoardArt half />
          </svg>
          {layout.map((p) => {
            const pos = localPct(p.x, p.y);
            return (
              <button
                key={`${p.x}-${p.y}`}
                type="button"
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                onPointerDown={() => pickUp(p.x, p.y)}
              >
                <PieceFace kind={p.kind} side="white" />
              </button>
            );
          })}
        </div>
      </div>

      <aside className="glass fixed inset-x-0 bottom-0 z-20 rounded-t-3xl p-4 lg:static lg:w-80 lg:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm tracking-widest text-white/70">棋子列表</h2>
          <span className="text-xs text-white/50">余 {remaining.length}</span>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
          {remaining.map((kind, i) => (
            <button
              key={`${kind}-${i}`}
              type="button"
              className="shrink-0"
              onPointerDown={() => setDrag({ kind })}
            >
              <PieceFace kind={kind} side="white" compact />
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2 text-xs text-amber-200/90">
          {complete ? (
            <p className="text-emerald-300">阵型合法，可以保存。</p>
          ) : (
            issues.slice(0, 3).map((i) => <p key={i.code + i.message}>{i.message}</p>)
          )}
        </div>
        <button
          className="mt-3 w-full rounded-2xl bg-white/90 py-3 font-semibold text-slate-900 disabled:opacity-40"
          disabled={saving}
          onClick={save}
        >
          {saving ? "保存中…" : "保存并生成蓝图码"}
        </button>
        {code ? (
          <div className="mt-3 rounded-2xl bg-white/10 p-3 text-center">
            <div className="text-xs text-white/60">蓝图码</div>
            <div className="serif mt-1 text-3xl tracking-[0.35em]">{code}</div>
            <button className="mt-2 text-xs text-cyan-200" onClick={() => navigator.clipboard?.writeText(code)}>
              复制
            </button>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
      </aside>
      {drag && cursor ? (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{ left: cursor.x, top: cursor.y }}
        >
          <PieceFace kind={drag.kind} side="white" />
        </div>
      ) : null}
    </div>
  );
}

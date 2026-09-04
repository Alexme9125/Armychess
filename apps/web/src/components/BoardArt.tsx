import { useId } from "react";
import {
  BOARD_EDGES,
  BOARD_NODES,
  CENTER_RAILS,
  DISPLAY,
  MOUNTAINS,
  RAIL_CORNERS,
  RAIL_LOOP_BLACK,
  RAIL_LOOP_WHITE,
  getNode,
  localNodePos,
  mountainDisplay,
  nodeDisplay,
  type BoardNode,
} from "@armychess/engine";

function roundedLoop(
  pts: { x: number; y: number }[],
  corner: boolean[],
  radius: number,
): string {
  const n = pts.length;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    if (!corner[i]) {
      parts.push(`${i === 0 ? "M" : "L"} ${cur.x} ${cur.y}`);
      continue;
    }
    const v1x = cur.x - prev.x;
    const v1y = cur.y - prev.y;
    const v2x = next.x - cur.x;
    const v2y = next.y - cur.y;
    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;
    const rr = Math.min(radius, l1 / 2.15, l2 / 2.15);
    const p1x = cur.x - (v1x / l1) * rr;
    const p1y = cur.y - (v1y / l1) * rr;
    const p2x = cur.x + (v2x / l2) * rr;
    const p2y = cur.y + (v2y / l2) * rr;
    parts.push(`${i === 0 ? "M" : "L"} ${p1x} ${p1y}`);
    parts.push(`Q ${cur.x} ${cur.y} ${p2x} ${p2y}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

function hqPentagon(cx: number, cy: number, roof: "up" | "down"): string {
  const w = 72;
  const h = 34;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const peak = h * 0.4;
  if (roof === "up") {
    return `M ${cx} ${y} L ${x + w} ${y + peak} L ${x + w} ${y + h} L ${x} ${y + h} L ${x} ${y + peak} Z`;
  }
  return `M ${cx} ${y + h} L ${x + w} ${y + h - peak} L ${x + w} ${y} L ${x} ${y} L ${x} ${y + h - peak} Z`;
}

function stationCapsule(cx: number, cy: number) {
  return { x: cx - 24, y: cy - 9, w: 48, h: 18, rx: 9 };
}

export function BoardArt({
  flipY = false,
  selected,
  destSet,
  hinted,
  lastFrom,
  lastTo,
  onNodeClick,
  half = false,
}: {
  flipY?: boolean;
  selected?: string | null;
  destSet?: Set<string>;
  hinted?: Set<string>;
  lastFrom?: string | null;
  lastTo?: string | null;
  onNodeClick?: (id: string) => void;
  half?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const pos = (id: string) => {
    if (half) {
      const n = getNode(id)!;
      return localNodePos(n.x, 12 - n.y);
    }
    return nodeDisplay(id, flipY);
  };

  const loopPath = (ids: readonly string[]) => {
    const pts = ids.map((id) => pos(id));
    const corner = ids.map((id) => RAIL_CORNERS.has(id));
    return roundedLoop(pts, corner, Math.min(DISPLAY.gapX, DISPLAY.gapY) * 0.48);
  };

  const nodes = half ? BOARD_NODES.filter((n) => n.y >= 7) : BOARD_NODES;
  const roads = BOARD_EDGES.filter((e) => {
    if (e.kind !== "road") return false;
    if (!half) return true;
    const a = getNode(e.a);
    const b = getNode(e.b);
    return !!a && !!b && a.y >= 7 && b.y >= 7;
  });
  const mountains = half ? [] : MOUNTAINS;
  const loops = half ? [RAIL_LOOP_WHITE] : [RAIL_LOOP_BLACK, RAIL_LOOP_WHITE];
  const bridges = half ? [] : CENTER_RAILS;

  function roofFor(n: BoardNode): "up" | "down" {
    if (half) return "down";
    const gy = flipY ? 12 - n.y : n.y;
    return gy < 6 ? "up" : "down";
  }

  function nodeShape(n: BoardNode, p: { x: number; y: number }) {
    if (n.kind === "camp") {
      return (
        <>
          <circle cx={p.x} cy={p.y} r="14.5" fill="rgba(8,12,22,0.35)" stroke="rgba(186,230,253,0.85)" strokeWidth="1.7" />
          <circle cx={p.x} cy={p.y} r="9.5" fill="none" stroke="rgba(186,230,253,0.5)" strokeWidth="1.1" />
        </>
      );
    }
    if (n.kind === "hq") {
      return (
        <path
          d={hqPentagon(p.x, p.y, roofFor(n))}
          fill="rgba(28,22,12,0.72)"
          stroke="rgba(251,191,36,0.98)"
          strokeWidth="2.05"
          strokeLinejoin="round"
        />
      );
    }
    if (n.kind === "front") {
      return (
        <rect
          x={p.x - 10}
          y={p.y - 10}
          width="20"
          height="20"
          fill="rgba(16,24,22,0.45)"
          stroke="rgba(167,243,208,0.9)"
          strokeWidth="1.6"
        />
      );
    }
    const c = stationCapsule(p.x, p.y);
    return (
      <rect
        x={c.x}
        y={c.y}
        width={c.w}
        height={c.h}
        rx={c.rx}
        fill="rgba(255,255,255,0.06)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.2"
      />
    );
  }

  return (
    <>
      <defs>
        <linearGradient id={`railStroke-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(125,211,252,0.98)" />
          <stop offset="1" stopColor="rgba(196,181,253,0.95)" />
        </linearGradient>
        <filter id={`railGlow-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {roads.map((e) => {
        const a = pos(e.a);
        const b = pos(e.b);
        return (
          <line
            key={`rd-${e.a}-${e.b}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="rgba(226,232,240,0.58)"
            strokeWidth="2.15"
            strokeLinecap="round"
          />
        );
      })}

      {loops.map((ids) => {
        const d = loopPath(ids);
        return (
          <g key={ids[0]}>
            <path d={d} fill="none" stroke="rgba(6,10,22,0.72)" strokeWidth="9.5" strokeLinejoin="round" />
            <path
              d={d}
              fill="none"
              stroke={`url(#railStroke-${uid})`}
              strokeWidth="3.6"
              strokeLinejoin="round"
              strokeDasharray="8 9"
              className="rail-flow"
              filter={`url(#railGlow-${uid})`}
            />
          </g>
        );
      })}

      {bridges.map((seg) => {
        const a = pos(seg[0]);
        const b = pos(seg[2]);
        return (
          <g key={`br-${seg[1]}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(6,10,22,0.72)" strokeWidth="9.5" strokeLinecap="round" />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={`url(#railStroke-${uid})`}
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeDasharray="8 9"
              className="rail-flow"
              filter={`url(#railGlow-${uid})`}
            />
          </g>
        );
      })}

      {mountains.map((m) => {
        const p = mountainDisplay(m.x, m.y, flipY);
        return (
          <g key={`mt-${m.x}-${m.y}`}>
            <circle cx={p.x} cy={p.y} r="13" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="1.7" />
            <circle cx={p.x} cy={p.y} r="6.5" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.42)" />
          </g>
        );
      })}

      {nodes.map((n) => {
        const p = pos(n.id);
        const active = selected === n.id;
        const dest = destSet?.has(n.id);
        const hint = hinted?.has(n.id);
        const last = lastFrom === n.id || lastTo === n.id;
        return (
          <g key={n.id} onClick={() => onNodeClick?.(n.id)} className="cursor-pointer">
            {nodeShape(n, p)}
            {dest ? <rect x={p.x - 5} y={p.y - 2.5} width="10" height="5" rx="2.5" fill="rgba(52,211,153,0.95)" /> : null}
            {active ? (
              <rect
                x={p.x - 27}
                y={p.y - 12}
                width="54"
                height="24"
                rx="12"
                fill="none"
                stroke="rgba(255,255,255,0.92)"
                strokeWidth="1.7"
              />
            ) : null}
            {hint ? (
              <rect
                x={p.x - 29}
                y={p.y - 13}
                width="58"
                height="26"
                rx="13"
                fill="none"
                stroke="rgba(251,191,36,0.9)"
                strokeDasharray="4 3"
              />
            ) : null}
            {last ? (
              <rect
                x={p.x - 26}
                y={p.y - 11}
                width="52"
                height="22"
                rx="11"
                fill="none"
                stroke="rgba(147,197,253,0.45)"
              />
            ) : null}
          </g>
        );
      })}
    </>
  );
}

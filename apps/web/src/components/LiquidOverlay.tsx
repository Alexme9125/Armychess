import { useEffect, useRef, useState } from "react";

export type FxKind = "fusion" | "splash";

export interface FxEvent {
  id: number;
  kind: FxKind;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  colorA: string;
  colorB: string;
  incomingWins?: boolean;
}

type Drop = { x: number; y: number; vx: number; vy: number; rx: number; ry: number; color: string; life: number };

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function LiquidOverlay({
  event,
  onDone,
}: {
  event: FxEvent | null;
  onDone: () => void;
}) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [frame, setFrame] = useState<{
    blobs: { x: number; y: number; rx: number; ry: number; color: string; o: number }[];
    ring?: { x: number; y: number; rx: number; ry: number; o: number };
  } | null>(null);

  useEffect(() => {
    if (!event) {
      setFrame(null);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 420 : event.kind === "splash" ? 1280 : 1120;
    const drops: Drop[] = [];
    let raf = 0;
    const t0 = performance.now();
    const incomingWins = event.incomingWins !== false;
    const x0 = event.fromX;
    const y0 = event.fromY;
    const x1 = event.x;
    const y1 = event.y;

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      if (event.kind === "fusion") {
        const approach = clamp(t / 0.4, 0, 1);
        const ease = 1 - (1 - approach) ** 3;
        const ax = lerp(x0, x1, ease);
        const ay = lerp(y0, y1, ease);
        const dist = Math.hypot(ax - x1, ay - y1);
        const contact = Math.max(0, 1 - dist / 14);
        const absorb = clamp((t - 0.34) / 0.44, 0, 1);
        const settle = clamp((t - 0.78) / 0.22, 0, 1);
        const wobble = settle > 0 ? Math.sin(settle * Math.PI * 3.2) * (1 - settle) * 1.4 : 0;
        const loser = Math.max(0.12, 1 - absorb ** 1.2);
        const winRx = 7.2 + contact * 1.6 + absorb * 1.4 + wobble;
        const winRy = 2.55 + contact * 0.35 + absorb * 0.25 - wobble * 0.35;
        const loseRx = 7.0 * loser;
        const loseRy = 2.5 * loser;
        const blobs = [
          {
            x: ax,
            y: ay,
            rx: incomingWins ? winRx : loseRx,
            ry: incomingWins ? winRy : loseRy,
            color: event.colorA,
            o: incomingWins ? 1 : Math.max(0, 1 - absorb),
          },
          {
            x: x1,
            y: y1,
            rx: incomingWins ? loseRx : winRx,
            ry: incomingWins ? loseRy : winRy,
            color: event.colorB,
            o: incomingWins ? Math.max(0, 1 - absorb) : 1,
          },
        ];
        if (contact > 0.18 && absorb < 0.78) {
          blobs.push({
            x: (ax + x1) / 2,
            y: (ay + y1) / 2,
            rx: 3.2 + contact * 3.8,
            ry: 1.4 + contact * 1.2,
            color: incomingWins ? event.colorA : event.colorB,
            o: 0.85 * (1 - absorb),
          });
        }
        setFrame({ blobs });
      } else {
        const slam = clamp(t / 0.2, 0, 1);
        const se = 1 - (1 - slam) ** 4;
        const ax = lerp(x0, x1, se);
        const ay = lerp(y0, y1, se);
        if (t < 0.24) {
          const squash = 1 + slam * 0.5;
          setFrame({
            blobs: [
              { x: ax, y: ay, rx: 7.4 / squash, ry: 2.6 * squash, color: event.colorA, o: 1 },
              { x: x1, y: y1, rx: 7.4 / squash, ry: 2.6 * squash, color: event.colorB, o: 1 },
            ],
          });
        } else {
          if (drops.length === 0) {
            for (let i = 0; i < 26; i++) {
              const ang = (i / 26) * Math.PI * 2 + 0.22;
              const spd = 0.42 + (i % 5) * 0.11;
              drops.push({
                x: x1,
                y: y1,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd * 0.72 - 0.08,
                rx: 1.15 + (i % 4) * 0.35,
                ry: 0.7 + (i % 3) * 0.22,
                color: i % 2 === 0 ? event.colorA : event.colorB,
                life: 1,
              });
            }
          }
          const u = (t - 0.24) / 0.76;
          for (let i = 0; i < drops.length; i++) {
            const d = drops[i];
            d.x += d.vx;
            d.y += d.vy;
            d.vy += 0.012;
            d.vx *= 0.982;
            d.vy *= 0.982;
            d.life = Math.max(0, 1 - u);
            for (let j = i + 1; j < drops.length; j++) {
              const o = drops[j];
              const dx = o.x - d.x;
              const dy = o.y - d.y;
              const dist = Math.hypot(dx, dy) || 0.001;
              const touch = d.rx + o.rx + 0.4;
              if (dist < touch) {
                const nx = dx / dist;
                const ny = dy / dist;
                const push = (touch - dist) * 0.16;
                d.x -= nx * push;
                d.y -= ny * push;
                o.x += nx * push;
                o.y += ny * push;
              }
            }
          }
          setFrame({
            blobs: drops
              .filter((d) => d.life > 0.06)
              .map((d) => ({
                x: d.x,
                y: d.y,
                rx: d.rx * d.life,
                ry: d.ry * d.life,
                color: d.color,
                o: 0.35 + 0.65 * d.life,
              })),
            ring: { x: x1, y: y1, rx: 6 + u * 22, ry: 3 + u * 12, o: 0.4 * (1 - u) },
          });
        }
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        setFrame(null);
        onDoneRef.current();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [event]);

  if (!event || !frame) return null;
  const fid = `goo-${event.id}`;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id={fid} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.05" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 28 -12"
          />
        </filter>
      </defs>
      {frame.ring ? (
        <ellipse
          cx={frame.ring.x}
          cy={frame.ring.y}
          rx={frame.ring.rx}
          ry={frame.ring.ry}
          fill="none"
          stroke="rgba(186,230,253,0.7)"
          strokeWidth="0.35"
          opacity={frame.ring.o}
        />
      ) : null}
      <g filter={`url(#${fid})`}>
        {frame.blobs.map((b, i) => (
          <ellipse
            key={i}
            cx={b.x}
            cy={b.y}
            rx={b.rx}
            ry={b.ry}
            fill={b.color}
            stroke="rgba(186,230,253,0.55)"
            strokeWidth="0.22"
            opacity={b.o}
          />
        ))}
      </g>
    </svg>
  );
}

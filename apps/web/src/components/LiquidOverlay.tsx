import { useEffect, useRef } from "react";

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
  /** Fusion: true if the incoming blob (attacker) absorbs the target. */
  incomingWins?: boolean;
}

type Blob = { x: number; y: number; rx: number; ry: number; r: number; g: number; b: number };
type Drop = Blob & { vx: number; vy: number; life: number; mass: number };

function parseColor(c: string): [number, number, number] {
  const m = c.match(/[\d.]+/g);
  if (!m || m.length < 3) return [40, 44, 52];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function paintMetaballs(ctx: CanvasRenderingContext2D, w: number, h: number, blobs: Blob[], threshold: number) {
  if (!blobs.length) return;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (const b of blobs) {
    const reachX = b.rx * 3.4;
    const reachY = b.ry * 3.4;
    minX = Math.min(minX, b.x - reachX);
    minY = Math.min(minY, b.y - reachY);
    maxX = Math.max(maxX, b.x + reachX);
    maxY = Math.max(maxY, b.y + reachY);
  }
  minX = clamp(Math.floor(minX), 0, w);
  minY = clamp(Math.floor(minY), 0, h);
  maxX = clamp(Math.ceil(maxX), 0, w);
  maxY = clamp(Math.ceil(maxY), 0, h);
  const lw = Math.max(1, maxX - minX);
  const lh = Math.max(1, maxY - minY);
  const step = lw * lh > 90_000 ? 2 : 1;
  const img = ctx.createImageData(lw, lh);
  const data = img.data;
  const coreCut = threshold * 1.55;

  for (let y = 0; y < lh; y += step) {
    const gy = minY + y;
    for (let x = 0; x < lw; x += step) {
      const gx = minX + x;
      let field = 0;
      let wr = 0;
      let wg = 0;
      let wb = 0;
      for (const b of blobs) {
        const dx = (gx - b.x) / b.rx;
        const dy = (gy - b.y) / b.ry;
        const d2 = dx * dx + dy * dy + 0.0005;
        const f = 1 / d2;
        field += f;
        wr += b.r * f;
        wg += b.g * f;
        wb += b.b * f;
      }
      if (field <= threshold) continue;
      const inv = 1 / field;
      let r = wr * inv;
      let g = wg * inv;
      let b = wb * inv;
      const rim = clamp((field - threshold) / (threshold * 0.7), 0, 1);
      const core = field > coreCut ? clamp((field - coreCut) / (coreCut * 0.6), 0, 1) : 0;
      const sheen = 0.34 * rim + 0.4 * core;
      r = r + (230 - r) * sheen;
      g = g + (245 - g) * sheen;
      b = b + (255 - b) * sheen;
      const a = Math.min(255, 90 + rim * 165 + core * 15);
      const paint = (ix: number, iy: number) => {
        if (ix >= lw || iy >= lh) return;
        const i = (iy * lw + ix) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      };
      paint(x, y);
      if (step === 2) {
        paint(x + 1, y);
        paint(x, y + 1);
        paint(x + 1, y + 1);
      }
    }
  }
  ctx.putImageData(img, minX, minY);
}

export function LiquidOverlay({
  event,
  onDone,
}: {
  event: FxEvent | null;
  onDone: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!event) return;
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onDoneRef.current();
      return;
    }

    const parent = canvas.parentElement;
    if (!parent) return;
    const cssW = parent.clientWidth;
    const cssH = parent.clientHeight;
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(cssW * dpr));
    const h = Math.max(1, Math.floor(cssH * dpr));
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const x0 = (event.fromX / 100) * w;
    const y0 = (event.fromY / 100) * h;
    const x1 = (event.x / 100) * w;
    const y1 = (event.y / 100) * h;
    const [ar, ag, ab] = parseColor(event.colorA);
    const [br, bg, bb] = parseColor(event.colorB);
    const rx = Math.max(26 * dpr, w * 0.058);
    const ry = Math.max(12 * dpr, h * 0.02);
    const duration = event.kind === "splash" ? 1250 : 1100;
    const drops: Drop[] = [];
    let raf = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      ctx.clearRect(0, 0, w, h);

      if (event.kind === "fusion") {
        const approach = clamp(t / 0.38, 0, 1);
        const ease = 1 - (1 - approach) ** 3;
        const ax = x0 + (x1 - x0) * ease;
        const ay = y0 + (y1 - y0) * ease;
        const dist = Math.hypot(ax - x1, ay - y1);
        const contact = Math.max(0, 1 - dist / (rx * 2.8));
        const absorb = clamp((t - 0.36) / 0.42, 0, 1);
        const settle = clamp((t - 0.78) / 0.22, 0, 1);
        const incomingWins = event.incomingWins !== false;
        const loserScale = Math.max(0.08, 1 - absorb ** 1.15);
        const mix = absorb * 0.85;
        const wobble = settle > 0 ? Math.sin(settle * Math.PI * 3) * (1 - settle) * 0.12 : 0;
        const inScale = incomingWins ? 1 + contact * 0.18 + absorb * 0.2 + wobble : loserScale * (1 + contact * 0.12);
        const stScale = incomingWins ? loserScale * (1 + contact * 0.12) : 1 + contact * 0.18 + absorb * 0.12 + wobble;
        const blobs: Blob[] = [
          {
            x: ax,
            y: ay,
            rx: rx * inScale,
            ry: ry * (incomingWins ? 1 + contact * 0.1 + absorb * 0.12 - wobble * 0.6 : loserScale),
            r: incomingWins ? ar : ar + (br - ar) * mix,
            g: incomingWins ? ag : ag + (bg - ag) * mix,
            b: incomingWins ? ab : ab + (bb - ab) * mix,
          },
          {
            x: x1,
            y: y1,
            rx: rx * stScale,
            ry: ry * (incomingWins ? loserScale * (1 + contact * 0.08) : 1 + contact * 0.1 + absorb * 0.12 - wobble * 0.6),
            r: incomingWins ? br + (ar - br) * mix : br,
            g: incomingWins ? bg + (ag - bg) * mix : bg,
            b: incomingWins ? bb + (ab - bb) * mix : bb,
          },
        ];
        if (contact > 0.2 && absorb < 0.85) {
          blobs.push({
            x: (ax + x1) / 2,
            y: (ay + y1) / 2,
            rx: rx * (0.28 + contact * 0.35) * (1 - absorb * 0.4),
            ry: ry * (0.22 + contact * 0.28) * (1 - absorb * 0.4),
            r: (ar + br) / 2,
            g: (ag + bg) / 2,
            b: (ab + bb) / 2,
          });
        }
        paintMetaballs(ctx, w, h, blobs, 0.78 - contact * 0.12);
      } else {
        const slam = clamp(t / 0.2, 0, 1);
        const se = 1 - (1 - slam) ** 4;
        const ax = x0 + (x1 - x0) * se;
        const ay = y0 + (y1 - y0) * se;
        if (t < 0.26) {
          const squash = 1 + slam * 0.55;
          paintMetaballs(
            ctx,
            w,
            h,
            [
              { x: ax, y: ay, rx: rx / squash, ry: ry * squash, r: ar, g: ag, b: ab },
              { x: x1, y: y1, rx: rx / squash, ry: ry * squash, r: br, g: bg, b: bb },
            ],
            0.7,
          );
        } else {
          if (drops.length === 0) {
            for (let i = 0; i < 22; i++) {
              const ang = (i / 22) * Math.PI * 2 + 0.27;
              const spd = (0.7 + (i % 5) * 0.18) * rx * 0.19;
              const useA = i % 2 === 0;
              const mass = 0.65 + (i % 4) * 0.18;
              drops.push({
                x: x1,
                y: y1,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd * 0.72 - 0.35 * dpr,
                rx: (3.4 + (i % 4) * 1.1) * dpr * mass,
                ry: (2.1 + (i % 3) * 0.7) * dpr * mass,
                r: useA ? ar : br,
                g: useA ? ag : bg,
                b: useA ? ab : bb,
                life: 1,
                mass,
              });
            }
          }
          const u = (t - 0.26) / 0.74;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(255,255,255,${0.28 * (1 - u)})`;
          ctx.lineWidth = 1.6 * dpr;
          ctx.ellipse(x1, y1, rx * (1 + u * 2.8), ry * (1 + u * 2.8), 0, 0, Math.PI * 2);
          ctx.stroke();

          for (let i = 0; i < drops.length; i++) {
            const d = drops[i];
            d.x += d.vx;
            d.y += d.vy;
            d.vy += 0.11 * dpr;
            d.vx *= 0.978;
            d.vy *= 0.978;
            d.life = Math.max(0, 1 - u);
            for (let j = i + 1; j < drops.length; j++) {
              const o = drops[j];
              const dx = o.x - d.x;
              const dy = o.y - d.y;
              const dist = Math.hypot(dx, dy) || 0.001;
              const touch = d.rx + o.rx;
              if (dist < touch * 0.92) {
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = (touch - dist) * 0.18;
                d.x -= nx * overlap;
                d.y -= ny * overlap;
                o.x += nx * overlap;
                o.y += ny * overlap;
                const dvx = o.vx - d.vx;
                const dvy = o.vy - d.vy;
                const closing = dvx * nx + dvy * ny;
                if (closing < 0) {
                  d.vx += nx * closing * 0.35;
                  d.vy += ny * closing * 0.35;
                  o.vx -= nx * closing * 0.35;
                  o.vy -= ny * closing * 0.35;
                }
              }
            }
          }
          paintMetaballs(
            ctx,
            w,
            h,
            drops
              .filter((d) => d.life > 0.05)
              .map((d) => ({
                x: d.x,
                y: d.y,
                rx: d.rx * d.life,
                ry: d.ry * d.life,
                r: d.r,
                g: d.g,
                b: d.b,
              })),
            0.95,
          );
        }
      }

      if (t < 1) raf = requestAnimationFrame(tick);
      else onDoneRef.current();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [event]);

  if (!event) return null;
  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ filter: "saturate(1.2) brightness(1.08)" }}
    />
  );
}

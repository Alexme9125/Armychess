import { useEffect, useRef } from "react";

export type FxKind = "fusion" | "splash" | "nudge";

export interface FxEvent {
  id: number;
  kind: FxKind;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  colorA: string;
  colorB: string;
}

export function LiquidOverlay({
  event,
  onDone,
}: {
  event: FxEvent | null;
  onDone: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!event) return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onDone();
      return;
    }
    const t = window.setTimeout(onDone, event.kind === "splash" ? 720 : 620);
    return () => window.clearTimeout(t);
  }, [event, onDone]);

  if (!event) return null;

  const drops =
    event.kind === "splash"
      ? Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 + 0.2;
          return { x: event.x + Math.cos(a) * 28, y: event.y + Math.sin(a) * 22, i };
        })
      : [];

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id={`goo-${event.id}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -8"
            result="goo"
          />
        </filter>
      </defs>
      {event.kind === "fusion" ? (
        <g filter={`url(#goo-${event.id})`}>
          <circle cx={event.fromX} cy={event.fromY} r="3.2" fill={event.colorA}>
            <animate attributeName="cx" to={event.x} dur="0.42s" fill="freeze" />
            <animate attributeName="cy" to={event.y} dur="0.42s" fill="freeze" />
            <animate attributeName="r" values="3.2;4.6;3.4" dur="0.6s" fill="freeze" />
          </circle>
          <circle cx={event.x} cy={event.y} r="3.2" fill={event.colorB}>
            <animate attributeName="r" values="3.2;4.2;0.2" dur="0.6s" fill="freeze" />
            <animate attributeName="opacity" values="1;1;0" dur="0.6s" fill="freeze" />
          </circle>
        </g>
      ) : (
        <g filter={`url(#goo-${event.id})`}>
          <circle cx={event.fromX} cy={event.fromY} r="3" fill={event.colorA}>
            <animate attributeName="cx" to={event.x} dur="0.22s" fill="freeze" />
            <animate attributeName="cy" to={event.y} dur="0.22s" fill="freeze" />
            <animate attributeName="opacity" values="1;0" begin="0.2s" dur="0.35s" fill="freeze" />
          </circle>
          <circle cx={event.x} cy={event.y} r="3" fill={event.colorB}>
            <animate attributeName="opacity" values="1;0" begin="0.2s" dur="0.35s" fill="freeze" />
          </circle>
          {drops.map((d) => (
            <circle key={d.i} cx={event.x} cy={event.y} r="1.1" fill={d.i % 2 ? event.colorA : event.colorB}>
              <animate attributeName="cx" to={d.x} dur="0.55s" fill="freeze" />
              <animate attributeName="cy" to={d.y} dur="0.55s" fill="freeze" />
              <animate attributeName="r" values="1.3;0.2" dur="0.55s" fill="freeze" />
              <animate attributeName="opacity" values="0.95;0" dur="0.55s" fill="freeze" />
            </circle>
          ))}
        </g>
      )}
    </svg>
  );
}

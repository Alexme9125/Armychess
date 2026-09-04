import { KIND_LABEL, type PieceKind, type PublicKind, type Side } from "@armychess/engine";

export function PieceFace({
  kind,
  side,
  dimmed,
  compact,
}: {
  kind: PublicKind;
  side: Side;
  dimmed?: boolean;
  compact?: boolean;
}) {
  const hidden = kind === "hidden";
  return (
    <div
      className={`mica ${side} flex items-center justify-center select-none ${
        compact
          ? "h-7 w-[3.2rem] text-[11px]"
          : "h-[20px] w-[48px] sm:h-[22px] sm:w-[50px] text-[11px] sm:text-[12px]"
      } ${dimmed ? "opacity-50" : ""}`}
      style={{ borderRadius: 999 }}
    >
      <span className="serif relative z-[1] font-semibold tracking-wide leading-none">
        {hidden ? "" : KIND_LABEL[kind as PieceKind]}
      </span>
      {hidden ? (
        <span className="absolute inset-[3px] rounded-full border border-white/25 bg-white/8" />
      ) : null}
    </div>
  );
}

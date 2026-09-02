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
        compact ? "h-11 w-9 text-[11px]" : "h-[46px] w-[38px] sm:h-[50px] sm:w-[42px] text-[12px] sm:text-[13px]"
      } ${dimmed ? "opacity-50" : ""}`}
      style={{ borderRadius: 11 }}
    >
      <span className="serif relative z-[1] font-semibold tracking-wide">
        {hidden ? "" : KIND_LABEL[kind as PieceKind]}
      </span>
      {hidden ? (
        <span className="absolute inset-[7px] rounded-md border border-white/20 bg-white/5" />
      ) : null}
    </div>
  );
}

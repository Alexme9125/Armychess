import { isCampLocal, isHqLocal, layoutSquares, localToGlobal, nid } from "./board.ts";
import { countKinds, STANDARD_KIT } from "./pieces.ts";
import type { Layout, LayoutIssue, Personality, PieceKind, Placement, Side } from "./types.ts";
import { EASTER_BOMBARD, EASTER_THUNDER } from "./types.ts";

export function validateLayout(layout: Layout): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const seen = new Set<string>();
  const kinds: PieceKind[] = [];

  for (const p of layout) {
    const key = `${p.x}-${p.y}`;
    if (p.x < 0 || p.x > 4 || p.y < 0 || p.y > 5) {
      issues.push({ code: "oob", message: `位置 ${key} 超出己方阵地` });
      continue;
    }
    if (isCampLocal(p.x, p.y)) {
      issues.push({ code: "camp", message: "行营开局不能布子" });
    }
    if (seen.has(key)) {
      issues.push({ code: "dup", message: `位置 ${key} 重复` });
    }
    seen.add(key);
    kinds.push(p.kind);

    if (p.kind === "flag" && !isHqLocal(p.x, p.y)) {
      issues.push({ code: "flag", message: "军旗必须放在大本营" });
    }
    if (p.kind === "mine" && p.y > 1) {
      issues.push({ code: "mine", message: "地雷只能放在最后两排" });
    }
    if (p.kind === "bomb" && p.y === 5) {
      issues.push({ code: "bomb", message: "炸弹不能放在第一排" });
    }
  }

  const counts = countKinds(kinds);
  for (const kind of Object.keys(STANDARD_KIT) as PieceKind[]) {
    if (counts[kind] !== STANDARD_KIT[kind]) {
      issues.push({
        code: "kit",
        message: `${kind} 数量应为 ${STANDARD_KIT[kind]}，当前 ${counts[kind]}`,
      });
    }
  }

  if (layout.length !== 25 && !issues.some((i) => i.code === "kit")) {
    issues.push({ code: "count", message: `需要 25 枚棋子，当前 ${layout.length}` });
  }

  return issues;
}

export function isLayoutLegal(layout: Layout): boolean {
  return validateLayout(layout).length === 0;
}

export function emptyLayout(): Layout {
  return [];
}

function placeGrid(rows: (PieceKind | null)[][]): Layout {
  const layout: Layout = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const kind = rows[y][x];
      if (kind) layout.push({ x, y, kind });
    }
  }
  return layout;
}

/** y=0 is HQ row (bottom). rows[0] is 端线. */
export const DEFAULT_LAYOUTS: Record<Personality, Layout> = {
  cautious: placeGrid([
    ["flag", "mine", "engineer", "mine", "general"],
    ["mine", "bomb", "engineer", "bomb", "commander"],
    ["battalion", null, "company", null, "battalion"],
    ["company", "platoon", null, "platoon", "company"],
    ["engineer", null, "divisional", null, "divisional"],
    ["platoon", "regimental", "brigadier", "brigadier", "regimental"],
  ]),
  balanced: placeGrid([
    ["flag", "mine", "engineer", "mine", "general"],
    ["mine", "bomb", "engineer", "bomb", "divisional"],
    ["battalion", null, "company", null, "battalion"],
    ["company", "platoon", null, "platoon", "company"],
    ["engineer", null, "regimental", null, "divisional"],
    ["platoon", "regimental", "brigadier", "brigadier", "commander"],
  ]),
  aggressive: placeGrid([
    ["flag", "mine", "mine", "mine", "engineer"],
    ["bomb", "company", "engineer", "company", "bomb"],
    ["platoon", null, "engineer", null, "platoon"],
    ["battalion", "company", null, "battalion", "platoon"],
    ["regimental", null, "general", null, "regimental"],
    ["brigadier", "divisional", "commander", "divisional", "brigadier"],
  ]),
};

export function thunderLayout(): Layout {
  const layout: Layout = [];
  for (const sq of layoutSquares()) {
    if (sq.x === 0 && sq.y === 0) layout.push({ ...sq, kind: "flag" });
    else layout.push({ ...sq, kind: "commander" });
  }
  return layout;
}

export function bombardLayout(): Layout {
  const layout: Layout = [];
  for (const sq of layoutSquares()) {
    if (sq.y === 0) {
      if (sq.x === 0) layout.push({ ...sq, kind: "flag" });
      else if (sq.x === 4) layout.push({ ...sq, kind: "commander" });
      else layout.push({ ...sq, kind: "engineer" });
    } else {
      layout.push({ ...sq, kind: "bomb" });
    }
  }
  return layout;
}

export function expandEasterCode(code: string): Layout | null {
  const c = code.trim();
  if (c === EASTER_THUNDER) return thunderLayout();
  if (c === EASTER_BOMBARD) return bombardLayout();
  return null;
}

export function isEasterCode(code: string): boolean {
  const c = code.trim();
  return c === EASTER_THUNDER || c === EASTER_BOMBARD;
}

export function easterLabel(code: string): string | null {
  const c = code.trim();
  if (c === EASTER_THUNDER) return "雷霆模式";
  if (c === EASTER_BOMBARD) return "炸弹兵模式";
  return null;
}

let idSeq = 0;
export function resetPieceIds(seed = 0) {
  idSeq = seed;
}

export function layoutToPieceMap(layout: Layout, side: Side): Record<string, { side: Side; kind: PieceKind; id: string }> {
  const pieces: Record<string, { side: Side; kind: PieceKind; id: string }> = {};
  for (const p of layout) {
    const g = localToGlobal(p.x, p.y, side);
    const id = nid(g.y, g.x);
    pieces[id] = {
      side,
      kind: p.kind,
      id: `${side}-${p.kind}-${idSeq++}`,
    };
  }
  return pieces;
}

export function cloneLayout(layout: Layout): Layout {
  return layout.map((p) => ({ ...p }));
}

export function placementsEqual(a: Placement, b: Placement): boolean {
  return a.x === b.x && a.y === b.y && a.kind === b.kind;
}

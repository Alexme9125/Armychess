import type { BoardEdge, BoardNode, EdgeKind, Side } from "./types.ts";

export const BOARD_COLS = 5;
export const BOARD_MAX_Y = 12;

export function nid(y: number, x: number): string {
  return `${y}-${x}`;
}

export function parseNid(id: string): { y: number; x: number } {
  const [y, x] = id.split("-").map(Number);
  return { y, x };
}

export const MOUNTAINS = [
  { x: 1, y: 6 },
  { x: 3, y: 6 },
] as const;

const CAMP_BLACK: [number, number][] = [
  [2, 1],
  [2, 3],
  [3, 2],
  [4, 1],
  [4, 3],
];

const CAMP_WHITE: [number, number][] = [
  [10, 1],
  [10, 3],
  [9, 2],
  [8, 1],
  [8, 3],
];

export const CAMP_LOCAL: [number, number][] = [
  [1, 2],
  [3, 2],
  [2, 3],
  [1, 4],
  [3, 4],
];

export const HQ_LOCAL: [number, number][] = [
  [0, 0],
  [4, 0],
];

const DIRS4: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DIRS8: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function inHalf(y: number, x: number, side: Side): boolean {
  if (x < 0 || x > 4) return false;
  if (side === "black") return y >= 0 && y <= 5;
  return y >= 7 && y <= 12;
}

function nodeKind(y: number, x: number): BoardNode["kind"] {
  if ((y === 0 || y === 12) && (x === 0 || x === 4)) return "hq";
  if (CAMP_BLACK.some(([cy, cx]) => cy === y && cx === x)) return "camp";
  if (CAMP_WHITE.some(([cy, cx]) => cy === y && cx === x)) return "camp";
  if (y === 6 && (x === 0 || x === 2 || x === 4)) return "front";
  return "station";
}

function nodeSide(y: number): BoardNode["side"] {
  if (y <= 5) return "black";
  if (y >= 7) return "white";
  return "neutral";
}

function buildNodes(): Map<string, BoardNode> {
  const nodes = new Map<string, BoardNode>();
  const add = (y: number, x: number) => {
    const id = nid(y, x);
    nodes.set(id, {
      id,
      x,
      y,
      kind: nodeKind(y, x),
      side: nodeSide(y),
    });
  };
  for (let y = 0; y <= 5; y++) {
    for (let x = 0; x < 5; x++) add(y, x);
  }
  for (const x of [0, 2, 4]) add(6, x);
  for (let y = 7; y <= 12; y++) {
    for (let x = 0; x < 5; x++) add(y, x);
  }
  return nodes;
}

function line(points: [number, number][]): string[] {
  return points.map(([y, x]) => nid(y, x));
}

function buildRailLines(): string[][] {
  const blackBack: [number, number][] = [0, 1, 2, 3, 4].map((x) => [1, x]);
  const blackFront: [number, number][] = [0, 1, 2, 3, 4].map((x) => [5, x]);
  const whiteFront: [number, number][] = [0, 1, 2, 3, 4].map((x) => [7, x]);
  const whiteBack: [number, number][] = [0, 1, 2, 3, 4].map((x) => [11, x]);
  const left: [number, number][] = [];
  for (let y = 1; y <= 5; y++) left.push([y, 0]);
  left.push([6, 0]);
  for (let y = 7; y <= 11; y++) left.push([y, 0]);
  const right: [number, number][] = [];
  for (let y = 1; y <= 5; y++) right.push([y, 4]);
  right.push([6, 4]);
  for (let y = 7; y <= 11; y++) right.push([y, 4]);
  const mid: [number, number][] = [
    [5, 2],
    [6, 2],
    [7, 2],
  ];
  return [blackBack, blackFront, whiteFront, whiteBack, left, right, mid].map(line);
}

function buildGraph(nodes: Map<string, BoardNode>): {
  edges: BoardEdge[];
  adj: Map<string, { id: string; kind: EdgeKind }[]>;
} {
  const edgeMap = new Map<string, BoardEdge>();
  const keyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const add = (a: string, b: string, kind: EdgeKind) => {
    if (a === b || !nodes.has(a) || !nodes.has(b)) return;
    const k = keyOf(a, b);
    const prev = edgeMap.get(k);
    if (prev) {
      if (kind === "rail") prev.kind = "rail";
      return;
    }
    edgeMap.set(k, { a, b, kind });
  };

  const link4 = (y: number, x: number) => {
    for (const [dy, dx] of DIRS4) {
      const ny = y + dy;
      const nx = x + dx;
      if (!nodes.has(nid(ny, nx))) continue;
      if (y <= 5 && ny >= 7) continue;
      if (y >= 7 && ny <= 5) continue;
      if ((y <= 5 && ny === 6 && dx !== 0) || (y >= 7 && ny === 6 && dx !== 0)) {
        // vertical into center handled separately
      }
      add(nid(y, x), nid(ny, nx), "road");
    }
  };

  for (let y = 0; y <= 5; y++) {
    for (let x = 0; x < 5; x++) link4(y, x);
  }
  for (let y = 7; y <= 12; y++) {
    for (let x = 0; x < 5; x++) link4(y, x);
  }

  for (const [cy, cx] of [...CAMP_BLACK, ...CAMP_WHITE]) {
    for (const [dy, dx] of DIRS8) {
      add(nid(cy, cx), nid(cy + dy, cx + dx), "road");
    }
  }

  add(nid(5, 0), nid(6, 0), "rail");
  add(nid(6, 0), nid(7, 0), "rail");
  add(nid(5, 2), nid(6, 2), "rail");
  add(nid(6, 2), nid(7, 2), "rail");
  add(nid(5, 4), nid(6, 4), "rail");
  add(nid(6, 4), nid(7, 4), "rail");

  add(nid(5, 1), nid(6, 0), "road");
  add(nid(5, 1), nid(6, 2), "road");
  add(nid(5, 3), nid(6, 2), "road");
  add(nid(5, 3), nid(6, 4), "road");
  add(nid(7, 1), nid(6, 0), "road");
  add(nid(7, 1), nid(6, 2), "road");
  add(nid(7, 3), nid(6, 2), "road");
  add(nid(7, 3), nid(6, 4), "road");

  for (const rail of buildRailLines()) {
    for (let i = 0; i < rail.length - 1; i++) {
      add(rail[i], rail[i + 1], "rail");
    }
  }

  const edges = [...edgeMap.values()];
  const adj = new Map<string, { id: string; kind: EdgeKind }[]>();
  for (const n of nodes.keys()) adj.set(n, []);
  for (const e of edges) {
    adj.get(e.a)!.push({ id: e.b, kind: e.kind });
    adj.get(e.b)!.push({ id: e.a, kind: e.kind });
  }
  return { edges, adj };
}

const NODES = buildNodes();
const RAIL_LINES = buildRailLines();
const GRAPH = buildGraph(NODES);

export const BOARD_NODES: readonly BoardNode[] = [...NODES.values()];
export const BOARD_EDGES: readonly BoardEdge[] = GRAPH.edges;
export const RAIL_LINES_IDS: readonly string[][] = RAIL_LINES;

export function getNode(id: string): BoardNode | undefined {
  return NODES.get(id);
}

export function neighbors(id: string): { id: string; kind: EdgeKind }[] {
  return GRAPH.adj.get(id) ?? [];
}

export function railNeighbors(id: string): string[] {
  return (GRAPH.adj.get(id) ?? []).filter((n) => n.kind === "rail").map((n) => n.id);
}

export function isCamp(id: string): boolean {
  return NODES.get(id)?.kind === "camp";
}

export function isHq(id: string): boolean {
  return NODES.get(id)?.kind === "hq";
}

export function linesThrough(id: string): string[][] {
  return RAIL_LINES.filter((line) => line.includes(id));
}

export function localToGlobal(x: number, y: number, side: Side): { x: number; y: number } {
  if (side === "black") return { x, y };
  return { x, y: 12 - y };
}

export function globalToLocal(x: number, y: number, side: Side): { x: number; y: number } {
  if (side === "black") return { x, y };
  return { x, y: 12 - y };
}

export function isCampLocal(x: number, y: number): boolean {
  return CAMP_LOCAL.some(([cx, cy]) => cx === x && cy === y);
}

export function isHqLocal(x: number, y: number): boolean {
  return HQ_LOCAL.some(([hx, hy]) => hx === x && hy === y);
}

export function layoutSquares(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y <= 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (!isCampLocal(x, y)) out.push({ x, y });
    }
  }
  return out;
}

export function inTerritory(y: number, x: number, side: Side): boolean {
  return inHalf(y, x, side);
}

export const DISPLAY = {
  originX: 70,
  originY: 48,
  gapX: 108,
  gapY: 76,
};

export function nodeDisplay(id: string, flipY: boolean): { x: number; y: number } {
  const n = NODES.get(id);
  if (!n) return { x: 0, y: 0 };
  const y = flipY ? BOARD_MAX_Y - n.y : n.y;
  return {
    x: DISPLAY.originX + n.x * DISPLAY.gapX,
    y: DISPLAY.originY + y * DISPLAY.gapY,
  };
}

export function mountainDisplay(mx: number, my: number, flipY: boolean): { x: number; y: number } {
  const y = flipY ? BOARD_MAX_Y - my : my;
  return {
    x: DISPLAY.originX + mx * DISPLAY.gapX,
    y: DISPLAY.originY + y * DISPLAY.gapY,
  };
}

export const VIEW_WIDTH = DISPLAY.originX * 2 + 4 * DISPLAY.gapX;
export const VIEW_HEIGHT = DISPLAY.originY * 2 + BOARD_MAX_Y * DISPLAY.gapY;

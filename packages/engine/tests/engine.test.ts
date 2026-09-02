import { describe, expect, it } from "vitest";
import {
  applyMove,
  bombardLayout,
  BOARD_NODES,
  chooseMove,
  createGame,
  DEFAULT_LAYOUTS,
  generateMoves,
  isCamp,
  isLayoutLegal,
  nid,
  projectState,
  resolveCombat,
  thunderLayout,
  validateLayout,
} from "../src/index.ts";
import type { GameState, PieceKind, Side, Visibility } from "../src/types.ts";

const BAL = DEFAULT_LAYOUTS.balanced;
const CAU = DEFAULT_LAYOUTS.cautious;

function bare(
  list: { y: number; x: number; side: Side; kind: PieceKind }[],
  turn: Side = "black",
  visibility: Visibility = "open",
): GameState {
  const pieces: GameState["pieces"] = {};
  let i = 0;
  for (const p of list) {
    pieces[nid(p.y, p.x)] = { id: `p${i++}`, side: p.side, kind: p.kind };
  }
  return {
    pieces,
    turn,
    visibility,
    revealedFlags: { black: false, white: false },
    winner: null,
    winReason: null,
    lastMove: null,
  };
}

describe("board", () => {
  it("has 63 playable nodes", () => {
    expect(BOARD_NODES).toHaveLength(63);
    expect(BOARD_NODES.filter((n) => n.kind === "camp")).toHaveLength(10);
    expect(BOARD_NODES.filter((n) => n.kind === "hq")).toHaveLength(4);
    expect(BOARD_NODES.filter((n) => n.kind === "front")).toHaveLength(3);
  });
});

describe("layout", () => {
  it("accepts default kits", () => {
    expect(isLayoutLegal(BAL)).toBe(true);
    expect(isLayoutLegal(CAU)).toBe(true);
    expect(isLayoutLegal(DEFAULT_LAYOUTS.aggressive)).toBe(true);
  });

  it("rejects mine beyond last two rows", () => {
    const bad = BAL.map((p) => (p.x === 0 && p.y === 5 ? { ...p, kind: "mine" as const } : p));
    expect(validateLayout(bad).some((i) => i.code === "mine" || i.code === "kit")).toBe(true);
  });

  it("rejects bomb on front row", () => {
    const bad = BAL.map((p) => (p.x === 0 && p.y === 5 ? { ...p, kind: "bomb" as const } : p));
    expect(validateLayout(bad).some((i) => i.code === "bomb" || i.code === "kit")).toBe(true);
  });

  it("rejects flag off headquarters", () => {
    const moved = BAL.map((p) => {
      if (p.kind === "flag") return { ...p, x: 1, y: 1 };
      if (p.x === 1 && p.y === 1) return { ...p, kind: "flag" as const };
      return p;
    });
    expect(validateLayout(moved).some((i) => i.code === "flag")).toBe(true);
  });

  it("rejects camp placement", () => {
    expect(
      validateLayout([...BAL, { x: 1, y: 2, kind: "platoon" }]).some((i) => i.code === "camp"),
    ).toBe(true);
  });

  it("expands thunder and bombard easter layouts", () => {
    const t = thunderLayout();
    expect(t).toHaveLength(25);
    expect(t.filter((p) => p.kind === "flag")).toHaveLength(1);
    expect(t.filter((p) => p.kind === "commander")).toHaveLength(24);
    expect(t.find((p) => p.kind === "flag")).toEqual({ x: 0, y: 0, kind: "flag" });

    const b = bombardLayout();
    expect(b.filter((p) => p.kind === "bomb")).toHaveLength(20);
    expect(b.filter((p) => p.kind === "engineer")).toHaveLength(3);
    expect(b.filter((p) => p.kind === "flag")).toHaveLength(1);
    expect(b.filter((p) => p.kind === "commander")).toHaveLength(1);
    expect(b.filter((p) => p.y === 0 && p.kind === "engineer")).toHaveLength(3);
  });
});

describe("combat", () => {
  it("ranks and specials", () => {
    expect(resolveCombat("commander", "general")).toBe("attacker");
    expect(resolveCombat("platoon", "commander")).toBe("defender");
    expect(resolveCombat("divisional", "divisional")).toBe("draw");
    expect(resolveCombat("engineer", "mine")).toBe("attacker");
    expect(resolveCombat("general", "mine")).toBe("defender");
    expect(resolveCombat("bomb", "mine")).toBe("draw");
    expect(resolveCombat("bomb", "commander")).toBe("draw");
    expect(resolveCombat("bomb", "flag")).toBe("attacker");
    expect(resolveCombat("platoon", "flag")).toBe("attacker");
  });
});

describe("moves and play", () => {
  it("does not allow non-engineer to turn a railway corner in one move", () => {
    const state = bare([
      { y: 5, x: 1, side: "black", kind: "divisional" },
      { y: 12, x: 0, side: "white", kind: "flag" },
    ]);
    const dests = generateMoves(state, "black")
      .filter((m) => m.from === nid(5, 1))
      .map((m) => m.to);
    expect(dests).not.toContain(nid(4, 0));
    expect(dests).toContain(nid(5, 0));
    expect(dests).toContain(nid(5, 4));
  });

  it("lets an engineer turn on railway", () => {
    const state = bare([
      { y: 5, x: 0, side: "black", kind: "engineer" },
      { y: 12, x: 0, side: "white", kind: "flag" },
    ]);
    const dests = generateMoves(state, "black")
      .filter((m) => m.from === nid(5, 0))
      .map((m) => m.to);
    expect(dests).toContain(nid(1, 1));
    expect(dests).toContain(nid(7, 4));
  });

  it("protects camps", () => {
    const state = createGame(BAL, CAU, "open");
    const camp = nid(4, 1);
    const from = nid(5, 1);
    expect(isCamp(camp)).toBe(true);
    const s = applyMove(state, from, camp);
    expect(s.pieces[camp]?.side).toBe("black");
    expect(generateMoves(s, "white").filter((m) => m.to === camp)).toHaveLength(0);
  });

  it("locks pieces that sit in headquarters", () => {
    const state = bare([
      { y: 0, x: 0, side: "black", kind: "general" },
      { y: 1, x: 0, side: "black", kind: "platoon" },
      { y: 12, x: 0, side: "white", kind: "flag" },
    ]);
    expect(generateMoves(state, "black").filter((m) => m.from === nid(0, 0))).toHaveLength(0);
    expect(generateMoves(state, "black").some((m) => m.from === nid(1, 0))).toBe(true);
  });

  it("engineer removes a mine; other ranks are destroyed by a mine", () => {
    const dug = applyMove(
      bare([
        { y: 5, x: 2, side: "black", kind: "engineer" },
        { y: 6, x: 2, side: "white", kind: "mine" },
        { y: 12, x: 0, side: "white", kind: "flag" },
      ]),
      nid(5, 2),
      nid(6, 2),
    );
    expect(dug.pieces[nid(6, 2)]?.kind).toBe("engineer");
    expect(dug.pieces[nid(6, 2)]?.side).toBe("black");

    const boom = applyMove(
      bare([
        { y: 5, x: 2, side: "black", kind: "general" },
        { y: 6, x: 2, side: "white", kind: "mine" },
        { y: 12, x: 0, side: "white", kind: "flag" },
      ]),
      nid(5, 2),
      nid(6, 2),
    );
    expect(boom.pieces[nid(6, 2)]?.kind).toBe("mine");
    expect(boom.pieces[nid(5, 2)]).toBeUndefined();
  });

  it("capturing the flag wins, including with a bomb", () => {
    const s1 = applyMove(
      bare([
        { y: 11, x: 0, side: "black", kind: "platoon" },
        { y: 12, x: 0, side: "white", kind: "flag" },
      ]),
      nid(11, 0),
      nid(12, 0),
    );
    expect(s1.winner).toBe("black");
    expect(s1.winReason).toBe("flag");

    const s2 = applyMove(
      bare([
        { y: 11, x: 0, side: "black", kind: "bomb" },
        { y: 12, x: 0, side: "white", kind: "flag" },
      ]),
      nid(11, 0),
      nid(12, 0),
    );
    expect(s2.winner).toBe("black");
    expect(s2.pieces[nid(12, 0)]?.kind).toBe("bomb");
  });

  it("reveals flag after commander dies", () => {
    const next = applyMove(
      bare(
        [
          { y: 10, x: 4, side: "black", kind: "commander" },
          { y: 11, x: 4, side: "white", kind: "commander" },
          { y: 12, x: 0, side: "white", kind: "flag" },
          { y: 0, x: 0, side: "black", kind: "flag" },
        ],
        "black",
        "hidden",
      ),
      nid(10, 4),
      nid(11, 4),
    );
    expect(next.revealedFlags.white).toBe(true);
    expect(next.revealedFlags.black).toBe(true);
    const view = projectState(next, "black");
    expect(view.pieces[nid(12, 0)].kind).toBe("flag");
    expect(view.flagHints.white).toBe(nid(12, 0));
  });

  it("no movable pieces loses", () => {
    const next = applyMove(
      bare([
        { y: 5, x: 0, side: "black", kind: "platoon" },
        { y: 12, x: 0, side: "white", kind: "flag" },
        { y: 11, x: 0, side: "white", kind: "mine" },
      ]),
      nid(5, 0),
      nid(5, 1),
    );
    expect(next.winner).toBe("black");
    expect(next.winReason).toBe("no_movable");
  });
});

describe("ai", () => {
  it("returns a legal move for each personality", () => {
    const state = createGame(BAL, CAU, "open");
    for (const p of ["cautious", "balanced", "aggressive"] as const) {
      const mv = chooseMove(state, p, 80);
      expect(mv).toBeTruthy();
      expect(generateMoves(state).some((m) => m.from === mv!.from && m.to === mv!.to)).toBe(true);
    }
  });
});

export type {
  BoardEdge,
  BoardNode,
  CombatEvent,
  CombatResult,
  GameState,
  LastMove,
  Layout,
  LayoutIssue,
  LegalMove,
  Personality,
  Piece,
  PieceKind,
  Placement,
  Side,
  Visibility,
  WinReason,
} from "./types.ts";
export {
  EASTER_BOMBARD,
  EASTER_THUNDER,
  OPPOSITE,
  RESERVED_CODES,
} from "./types.ts";

export {
  BOARD_EDGES,
  BOARD_MAX_Y,
  BOARD_NODES,
  CENTER_RAILS,
  DISPLAY,
  HQ_LOCAL,
  LOCAL_VIEW_HEIGHT,
  MOUNTAINS,
  RAIL_CORNERS,
  RAIL_LINES_IDS,
  RAIL_LOOP_BLACK,
  RAIL_LOOP_WHITE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  getNode,
  globalToLocal,
  isCamp,
  isCampLocal,
  isHq,
  isHqLocal,
  layoutSquares,
  linesThrough,
  localNodePos,
  localToGlobal,
  mountainDisplay,
  neighbors,
  nid,
  nodeDisplay,
  parseNid,
  railNeighbors,
} from "./board.ts";

export {
  IMMOBILE,
  KIND_LABEL,
  MATERIAL,
  RANK,
  STANDARD_KIT,
  countKinds,
  kitList,
} from "./pieces.ts";

export { resolveCombat } from "./combat.ts";
export { findMove, generateMoves, hasMovablePiece, movesFrom } from "./moves.ts";
export {
  DEFAULT_LAYOUTS,
  bombardLayout,
  cloneLayout,
  easterLabel,
  expandEasterCode,
  isEasterCode,
  isLayoutLegal,
  layoutToPieceMap,
  thunderLayout,
  validateLayout,
} from "./layout.ts";
export type { PublicPiece, PublicState } from "./game.ts";
export {
  applyDisconnect,
  applyMove,
  applyResign,
  cloneState,
  createGame,
  hqIds,
  projectState,
  tryMove,
} from "./game.ts";
export { aiLayout, chooseMove } from "./ai.ts";

import {
  applyDisconnect,
  createGame,
  isEasterCode,
  projectState,
  tryMove,
  type GameState,
  type Layout,
  type PublicState,
  type Side,
  type Visibility,
} from "@armychess/engine";
import type { Server, Socket } from "socket.io";
import { getBlueprint } from "./blueprints.ts";
import { randomCode } from "./codes.ts";

export type Role = Side | "spectator";

export interface Occupant {
  id: string;
  nickname: string;
  ready: boolean;
  hasBlueprint: boolean;
  connected: boolean;
}

export interface RoomSnapshot {
  code: string;
  hostId: string;
  phase: "waiting" | "playing" | "ended";
  visibility: Visibility;
  seats: Record<Side, Occupant | null>;
  spectators: { id: string; nickname: string }[];
  you: { id: string; role: Role; nickname: string };
  publicState: PublicState | null;
  message: string | null;
}

interface Player {
  id: string;
  nickname: string;
  socketId: string;
  roomCode: string | null;
  seat: Side | null;
  layout: Layout | null;
  ready: boolean;
}

interface Room {
  code: string;
  hostId: string;
  visibility: Visibility;
  phase: "waiting" | "playing" | "ended";
  players: Map<string, Player>;
  game: GameState | null;
  message: string | null;
}

const rooms = new Map<string, Room>();
const sockets = new Map<string, Player>();

function roleOf(player: Player): Role {
  return player.seat ?? "spectator";
}

function seated(room: Room, side: Side): Player | null {
  for (const p of room.players.values()) {
    if (p.seat === side) return p;
  }
  return null;
}

function occupant(p: Player | null): Occupant | null {
  if (!p) return null;
  return {
    id: p.id,
    nickname: p.nickname,
    ready: p.ready,
    hasBlueprint: !!p.layout,
    connected: true,
  };
}

export function snapshotFor(room: Room, player: Player): RoomSnapshot {
  const viewer: Side | "spectator" = player.seat ?? "spectator";
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    visibility: room.visibility,
    seats: {
      black: occupant(seated(room, "black")),
      white: occupant(seated(room, "white")),
    },
    spectators: [...room.players.values()]
      .filter((p) => !p.seat)
      .map((p) => ({ id: p.id, nickname: p.nickname })),
    you: { id: player.id, role: roleOf(player), nickname: player.nickname },
    publicState: room.game ? projectState(room.game, viewer) : null,
    message: room.message,
  };
}

function emitRoom(io: Server, room: Room) {
  for (const p of room.players.values()) {
    io.to(p.socketId).emit("room", snapshotFor(room, p));
  }
}

function emitErr(socket: Socket, message: string) {
  socket.emit("error", { message });
}

function tryStart(io: Server, room: Room) {
  if (room.phase !== "waiting") return;
  const black = seated(room, "black");
  const white = seated(room, "white");
  if (!black?.ready || !white?.ready || !black.layout || !white.layout) return;
  room.game = createGame(black.layout, white.layout, room.visibility);
  room.phase = "playing";
  room.message = room.visibility === "hidden" ? "暗棋开战" : "明棋开战";
  black.ready = false;
  white.ready = false;
  emitRoom(io, room);
}

function endByDisconnect(io: Server, room: Room, leaver: Player) {
  if (room.phase === "playing" && leaver.seat && room.game && !room.game.winner) {
    room.game = applyDisconnect(room.game, leaver.seat);
    room.phase = "ended";
    room.message = `${leaver.nickname} 离开，对局结束`;
  }
}

function destroyIfEmpty(room: Room) {
  if (room.players.size === 0) rooms.delete(room.code);
}

function ensureHost(room: Room) {
  if (room.players.has(room.hostId)) return;
  const next = seated(room, "black") ?? seated(room, "white") ?? [...room.players.values()][0];
  if (next) room.hostId = next.id;
}

export function attachSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("hello", ({ nickname }: { nickname?: string }) => {
      const name = (nickname ?? "棋手").trim().slice(0, 16) || "棋手";
      const player: Player = {
        id: socket.id,
        nickname: name,
        socketId: socket.id,
        roomCode: null,
        seat: null,
        layout: null,
        ready: false,
      };
      sockets.set(socket.id, player);
      socket.emit("session", { id: player.id, nickname: player.nickname });
    });

    socket.on(
      "createRoom",
      ({ visibility, hostSide }: { visibility?: Visibility; hostSide?: Side }) => {
        const player = sockets.get(socket.id);
        if (!player) return emitErr(socket, "请先设置昵称");
        if (player.roomCode) return emitErr(socket, "已在房间中");
        const vis: Visibility = visibility === "hidden" ? "hidden" : "open";
        const side: Side = hostSide === "white" ? "white" : "black";
        const code = randomCode(4);
        const room: Room = {
          code,
          hostId: player.id,
          visibility: vis,
          phase: "waiting",
          players: new Map(),
          game: null,
          message: null,
        };
        player.roomCode = code;
        player.seat = side;
        player.ready = false;
        player.layout = null;
        room.players.set(player.id, player);
        rooms.set(code, room);
        socket.join(code);
        emitRoom(io, room);
      },
    );

    socket.on("joinRoom", ({ code }: { code?: string }) => {
      const player = sockets.get(socket.id);
      if (!player) return emitErr(socket, "请先设置昵称");
      if (player.roomCode) return emitErr(socket, "已在房间中");
      const room = rooms.get((code ?? "").trim().toUpperCase());
      if (!room) return emitErr(socket, "房间不存在");
      player.roomCode = room.code;
      player.seat = null;
      player.layout = null;
      player.ready = false;
      const blackEmpty = !seated(room, "black");
      const whiteEmpty = !seated(room, "white");
      if (room.phase !== "playing") {
        if (blackEmpty) player.seat = "black";
        else if (whiteEmpty) player.seat = "white";
      }
      room.players.set(player.id, player);
      socket.join(room.code);
      emitRoom(io, room);
    });

    socket.on("sit", ({ side }: { side?: Side }) => {
      const player = sockets.get(socket.id);
      const room = player?.roomCode ? rooms.get(player.roomCode) : undefined;
      if (!player || !room) return;
      if (room.phase === "playing") return emitErr(socket, "对弈中不能入座");
      const want: Side | undefined = side === "white" || side === "black" ? side : undefined;
      const target =
        want && !seated(room, want)
          ? want
          : !seated(room, "black")
            ? "black"
            : !seated(room, "white")
              ? "white"
              : null;
      if (!target) return emitErr(socket, "没有空座位");
      player.seat = target;
      player.ready = false;
      emitRoom(io, room);
    });

    socket.on("stand", () => {
      const player = sockets.get(socket.id);
      const room = player?.roomCode ? rooms.get(player.roomCode) : undefined;
      if (!player || !room) return;
      if (room.phase === "playing") return emitErr(socket, "对弈中不能站起");
      player.seat = null;
      player.ready = false;
      player.layout = null;
      emitRoom(io, room);
    });

    socket.on(
      "setRules",
      ({ visibility, hostSide }: { visibility?: Visibility; hostSide?: Side }) => {
        const player = sockets.get(socket.id);
        const room = player?.roomCode ? rooms.get(player.roomCode) : undefined;
        if (!player || !room) return;
        if (player.id !== room.hostId) return emitErr(socket, "只有房主可以改规则");
        if (room.phase === "playing") return emitErr(socket, "对弈中不能改规则");
        if (visibility === "open" || visibility === "hidden") room.visibility = visibility;
        if ((hostSide === "black" || hostSide === "white") && room.phase === "waiting") {
          const host = room.players.get(room.hostId);
          if (host?.seat && host.seat !== hostSide) {
            const other = seated(room, hostSide);
            if (other) other.seat = host.seat;
            host.seat = hostSide;
            host.ready = false;
            if (other) other.ready = false;
          }
        }
        for (const p of room.players.values()) p.ready = false;
        emitRoom(io, room);
      },
    );

    socket.on("setBlueprint", ({ code }: { code?: string }) => {
      const player = sockets.get(socket.id);
      const room = player?.roomCode ? rooms.get(player.roomCode) : undefined;
      if (!player || !room) return;
      if (!player.seat) return emitErr(socket, "旁观不能带入蓝图");
      if (room.phase === "playing") return emitErr(socket, "对弈中不能更换蓝图");
      const raw = (code ?? "").trim();
      if (isEasterCode(raw)) return emitErr(socket, "该码为人机特殊模式，不能用于玩家对战");
      const layout = getBlueprint(raw.toUpperCase());
      if (!layout) return emitErr(socket, "蓝图码无效");
      player.layout = layout;
      player.ready = false;
      emitRoom(io, room);
    });

    socket.on("setReady", ({ ready }: { ready?: boolean }) => {
      const player = sockets.get(socket.id);
      const room = player?.roomCode ? rooms.get(player.roomCode) : undefined;
      if (!player || !room) return;
      if (!player.seat) return emitErr(socket, "请先入座");
      if (room.phase === "playing") return;
      if (ready && !player.layout) return emitErr(socket, "请先输入蓝图码");
      player.ready = !!ready;
      emitRoom(io, room);
      tryStart(io, room);
    });

    socket.on("move", ({ from, to }: { from?: string; to?: string }) => {
      const player = sockets.get(socket.id);
      const room = player?.roomCode ? rooms.get(player.roomCode) : undefined;
      if (!player || !room || !room.game) return;
      if (room.phase !== "playing") return;
      if (!player.seat) return emitErr(socket, "旁观不能走子");
      if (room.game.turn !== player.seat) return emitErr(socket, "还没轮到你");
      if (!from || !to) return;
      const next = tryMove(room.game, from, to);
      if (!next) return emitErr(socket, "非法走子");
      room.game = next;
      if (next.winner) {
        room.phase = "ended";
        const names: Record<Side, string> = {
          black: seated(room, "black")?.nickname ?? "黑方",
          white: seated(room, "white")?.nickname ?? "白方",
        };
        room.message = `${names[next.winner]} 获胜`;
      }
      emitRoom(io, room);
    });

    socket.on("rematch", () => {
      const player = sockets.get(socket.id);
      const room = player?.roomCode ? rooms.get(player.roomCode) : undefined;
      if (!player || !room) return;
      if (player.id !== room.hostId) return emitErr(socket, "只有房主可以再来一局");
      if (room.phase === "playing") return;
      room.game = null;
      room.phase = "waiting";
      room.message = "准备再战";
      for (const p of room.players.values()) p.ready = false;
      emitRoom(io, room);
    });

    socket.on("leave", () => {
      leave(io, socket);
    });

    socket.on("disconnect", () => {
      leave(io, socket);
    });
  });
}

function leave(io: Server, socket: Socket) {
  const player = sockets.get(socket.id);
  if (!player) return;
  const room = player.roomCode ? rooms.get(player.roomCode) : undefined;
  sockets.delete(socket.id);
  if (!room) return;
  endByDisconnect(io, room, player);
  room.players.delete(player.id);
  socket.leave(room.code);
  ensureHost(room);
  if (room.players.size === 0) {
    rooms.delete(room.code);
    return;
  }
  emitRoom(io, room);
  destroyIfEmpty(room);
}

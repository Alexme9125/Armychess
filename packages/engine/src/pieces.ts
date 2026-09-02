import type { PieceKind } from "./types.ts";

export const KIND_LABEL: Record<PieceKind, string> = {
  commander: "司令",
  general: "军长",
  divisional: "师长",
  brigadier: "旅长",
  regimental: "团长",
  battalion: "营长",
  company: "连长",
  platoon: "排长",
  engineer: "工兵",
  bomb: "炸弹",
  mine: "地雷",
  flag: "军旗",
};

/** Higher number beats lower, except specials. Flag is 0. */
export const RANK: Record<PieceKind, number> = {
  commander: 9,
  general: 8,
  divisional: 7,
  brigadier: 6,
  regimental: 5,
  battalion: 4,
  company: 3,
  platoon: 2,
  engineer: 1,
  bomb: 0,
  mine: 0,
  flag: 0,
};

export const STANDARD_KIT: Record<PieceKind, number> = {
  commander: 1,
  general: 1,
  divisional: 2,
  brigadier: 2,
  regimental: 2,
  battalion: 2,
  company: 3,
  platoon: 3,
  engineer: 3,
  bomb: 2,
  mine: 3,
  flag: 1,
};

export const MATERIAL: Record<PieceKind, number> = {
  commander: 350,
  general: 280,
  divisional: 200,
  brigadier: 140,
  regimental: 100,
  battalion: 70,
  company: 50,
  platoon: 35,
  engineer: 80,
  bomb: 90,
  mine: 60,
  flag: 0,
};

export const IMMOBILE: ReadonlySet<PieceKind> = new Set(["mine", "flag"]);

export function kitList(): PieceKind[] {
  const list: PieceKind[] = [];
  for (const kind of Object.keys(STANDARD_KIT) as PieceKind[]) {
    for (let i = 0; i < STANDARD_KIT[kind]; i++) list.push(kind);
  }
  return list;
}

export function countKinds(kinds: PieceKind[]): Record<PieceKind, number> {
  const counts = { ...STANDARD_KIT };
  for (const k of Object.keys(counts) as PieceKind[]) counts[k] = 0;
  for (const k of kinds) counts[k]++;
  return counts;
}

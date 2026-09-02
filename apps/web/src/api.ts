import type { Layout } from "@armychess/engine";

export async function saveBlueprint(placements: Layout): Promise<string> {
  const res = await fetch("/api/blueprints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placements }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "保存失败");
  return data.code as string;
}

export async function loadBlueprint(code: string): Promise<Layout> {
  const res = await fetch(`/api/blueprints/${encodeURIComponent(code.trim().toUpperCase())}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "蓝图不存在");
  return data.placements as Layout;
}

export function nickKey() {
  return "armychess.nickname";
}

export function bpKey() {
  return "armychess.blueprint";
}

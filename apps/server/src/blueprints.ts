import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { isEasterCode, isLayoutLegal, RESERVED_CODES, type Layout } from "@armychess/engine";
import { randomCode } from "./codes.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(dir, "../data");
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "blueprints.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS blueprints (
    code TEXT PRIMARY KEY,
    layout TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const reserved = new Set<string>(RESERVED_CODES);

export function saveBlueprint(layout: Layout): string {
  if (!isLayoutLegal(layout)) {
    const err = new Error("阵型不合法");
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  const insert = db.prepare("INSERT INTO blueprints (code, layout, created_at) VALUES (?, ?, ?)");
  for (let i = 0; i < 24; i++) {
    const code = randomCode(6, reserved);
    try {
      insert.run(code, JSON.stringify(layout), Date.now());
      return code;
    } catch {
      // unique collision
    }
  }
  throw new Error("保存蓝图失败");
}

export function getBlueprint(code: string): Layout | null {
  if (isEasterCode(code)) return null;
  const row = db.prepare("SELECT layout FROM blueprints WHERE code = ?").get(code) as
    | { layout: string }
    | undefined;
  if (!row) return null;
  return JSON.parse(row.layout) as Layout;
}

import type { Database } from "better-sqlite3";
import type { TestRow } from "../schema";

export function getAllFromTest(db: Database): TestRow[] {
  const rows = db
    .prepare("SELECT id, name FROM test")
    .all() as Array<{ id: number; name: string | null }>;

  // 显式 map 成“普通可枚举对象”，避免 better-sqlite3 Row 在 JSON 序列化/序列化校验中丢字段。
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
  })) as TestRow[];
}

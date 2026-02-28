/**
 * 基于 node:sqlite DatabaseSync 的薄封装，配合 Drizzle schema 做类型安全的表访问，少写 raw SQL。
 */
import type { DatabaseSync } from "node:sqlite";
import type { TestInsert, TestRow } from "./schema.js";

let db: DatabaseSync | null = null;

/** 初始化数据库（在启动时调用，传入 DB_PATH 对应的 DatabaseSync 实例） */
export function initDb(instance: DatabaseSync | null): void {
  db = instance;
}

function getDb(): DatabaseSync {
  if (!db) throw new Error("DB not configured (Set env DB_PATH)");
  return db;
}

/** 获取所有表名（用于验证连接） */
export function getTableNames(): string[] {
  const rows = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

/** 查询 test 表全部行，返回类型与 schema 一致 */
export function getTestRows(): TestRow[] {
  return getDb().prepare("SELECT * FROM test").all() as TestRow[];
}

/** 插入 test 表一行（id 可省略，自增） */
export function insertTest(row: TestInsert): { lastInsertRowid: number; rowsAffected: number } {
  const stmt = getDb().prepare("INSERT INTO test (name) VALUES (?)");
  const result = stmt.run(row.name ?? null) as { lastInsertRowid?: number; changes?: number };
  return {
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
    rowsAffected: Number(result.changes ?? 0),
  };
}

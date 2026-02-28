import type Database from "@tauri-apps/plugin-sql";
import { store } from "@/store";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";

/** 从 Pinia 读取（main 启动时已通过 IPC get_config 从 resource/settings.json 注入），缺省 test.db */
function getDbPath(): string {
  const name = useTauriConfigStore(store).sqliteDbName;
  return `sqlite:${name}`;
}

const TEST_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS test (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT
)
`.trim();

let dbInstance: Database | null = null;
let tableEnsured = false;

/** 获取 Tauri 数据库实例（单例），首次调用时自动创建 test 表 */
export async function getTauriDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }
  const Database = (await import("@tauri-apps/plugin-sql")).default;
  dbInstance = await Database.load(getDbPath());
  if (!tableEnsured) {
    await dbInstance.execute(TEST_TABLE_SQL);
    tableEnsured = true;
  }
  return dbInstance;
}

/** Drizzle 使用 ? 占位符，Tauri 的 sqlite 使用 $1, $2, $3 */
function toTauriPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/**
 * 执行写操作（INSERT/UPDATE/DELETE），返回 lastInsertId 与 rowsAffected
 */
export async function run(
  sql: string,
  params: unknown[] = []
): Promise<{ lastInsertRowid: number; rowsAffected: number }> {
  const db = await getTauriDb();
  const query = toTauriPlaceholders(sql);
  const result = await db.execute(query, params);
  return {
    lastInsertRowid: result.lastInsertId ?? 0,
    rowsAffected: result.rowsAffected,
  };
}

/**
 * 执行读操作（SELECT），返回行数组。
 * 将每行转为纯对象并统一为小写列名，兼容 Tauri/sqlx 返回的 ID/NAME 等，且显式读属性值避免 getter 导致 undefined。
 */
export async function all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = await getTauriDb();
  const query = toTauriPlaceholders(sql);
  const rows = await db.select<Record<string, unknown>[]>(query, params);
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const copy: Record<string, unknown> = {};
    for (const k of Object.keys(row)) {
      copy[k.toLowerCase()] = (row as Record<string, unknown>)[k];
    }
    return copy as T;
  });
}

import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as all from "./adapter";
import { testTable } from "./schema";

/** sqlite-proxy 需要「按列顺序的值数组」，每行是 [col1, col2, ...]，不是对象 */
const TEST_TABLE_COLUMN_ORDER = ["id", "name"] as const;

function rowToValueArray(row: Record<string, unknown>): unknown[] {
  return TEST_TABLE_COLUMN_ORDER.map((col) => {
    const v = row[col] ?? row[col.toUpperCase()];
    return v !== undefined ? v : null;
  });
}

/**
 * 使用 Tauri 执行 SQL 的 Drizzle 回调（? 占位符会在 adapter 中转为 $1,$2,$3）
 */
const tauriProxy = async (
  sql: string,
  params: unknown[],
  method: "run" | "all" | "get" | "values"
) => {
  if (method === "run") {
    await all.run(sql, params);
    return { rows: [] as unknown[] };
  }
  const raw = await all.all<Record<string, unknown>>(sql, params);
  // proxy 驱动要求 rows 为「数组的数组」，按 schema 列顺序
  const rows = raw.map((row) => rowToValueArray(row));
  if (method === "get") {
    return { rows: rows.length ? [rows[0]] : [] };
  }
  return { rows };
};

export const db = drizzle(tauriProxy, {
  schema: { test: testTable },
});

export { testTable };
export type { TestRow, TestInsert } from "./schema";

import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as all from "./adapter";
import { testTable } from "./schema";

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
  const rows = await all.all(sql, params);
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

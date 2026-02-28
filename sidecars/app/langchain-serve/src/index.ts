/**
 * langchain-serve: Hono API 服务
 * 导出 run() 供 core 或独立入口调用；不自动执行，避免被 core 并入时重复启动。
 * 数据库：sql.js 只读打开（无 native 绑定，不依赖 better-sqlite3 编译）；路径通过 SQLITE_DB_PATH，未设置时开发阶段使用 macOS 应用目录下的 test.db。
 */
import { readFile } from "node:fs/promises";
import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import initSqlJs from "sql.js";

const HOST = "127.0.0.1";

/** 开发阶段默认路径（与 Tauri 前端 sqlite:test.db 一致，位于 Application Support） */
const DEV_DB_PATH =
  process.platform === "darwin"
    ? `${process.env.HOME}/Library/Application Support/com.manshawar.langchainapp/test.db`
    : "";

/** 环境变量优先，否则开发阶段用上述默认路径 */
const SQLITE_DB_PATH =
  process.env.SQLITE_DB_PATH ?? process.env.DB_PATH ?? DEV_DB_PATH;

let sqlJs: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let db: InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]> | null = null;

async function getSqlJs() {
  if (!sqlJs) sqlJs = await initSqlJs();
  return sqlJs;
}

/** 只读打开 sqlite 文件（sql.js 纯 JS，无需 native 绑定） */
async function getDb() {
  if (!SQLITE_DB_PATH) return null;
  if (db) return db;
  try {
    const SQL = await getSqlJs();
    const buf = await readFile(SQLITE_DB_PATH);
    db = new SQL.Database(buf);
    return db;
  } catch (e) {
    console.error("SQLite open failed:", e);
    return null;
  }
}

/** 将 sql.js exec 结果转为行数组 */
function execToRows(
  database: { exec(sql: string): { columns: string[]; values: unknown[][] }[] },
  sql: string
): Record<string, unknown>[] {
  const result = database.exec(sql);
  if (!result.length || !result[0]) return [];
  const { columns, values } = result[0];
  return values.map((row) =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]]))
  );
}

const app = new Hono();
app.get("/health", (c: Context) => c.json({ ok: true }));

/** 查询 test 表 */
app.get("/db-test", async (c: Context) => {
  const database = await getDb();
  if (!database) {
    return c.json(
      {
        ok: false,
        error: "DB not configured",
        hint: "Set env SQLITE_DB_PATH or DB_PATH to the sqlite file path",
      },
      503
    );
  }
  try {
    const rows = execToRows(database, "SELECT * FROM test");
    return c.json({ ok: true, rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, error: msg }, 500);
  }
});

/** 供 core 或直接运行调用；port 优先 options，否则读 env VITE_API_PORT，为 0 时由系统分配 */
export function run(options?: { port?: number }) {
  const port = options?.port ?? (Number(process.env.VITE_API_PORT) || 0);
  console.log(
    "langchain-serve run",
    port,
    HOST,
    SQLITE_DB_PATH ? `DB=${SQLITE_DB_PATH}` : "DB=(not set)"
  );
  serve({ fetch: app.fetch, port, hostname: HOST }, (info: { port: number }) => {
    const base = `http://${HOST}:${info.port}`;
    console.log(
      `API_PORT=${info.port} | 接口地址: ${base} | 健康检查: ${base}/health | 数据库测试: ${base}/db-test`
    );
  });
}

run();

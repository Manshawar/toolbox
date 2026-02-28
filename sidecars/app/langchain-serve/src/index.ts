/**
 * langchain-serve: Hono API 服务
 * 导出 run() 供 core 或独立入口调用；不自动执行，避免被 core 并入时重复启动。
 * 数据库：有 SQLITE_DB_PATH/DB_PATH 用其；否则视为非打包环境，从 path.resolve 找到的 resource/settings.json 读 sqlite_db_name 并拼路径。
 */
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import initSqlJs from "sql.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = "127.0.0.1";

const SETTINGS_RELATIVE = "resource/settings.json";

/** 非打包环境：通过 path.resolve 多级候选找到 src-tauri/resource/settings.json，读 sqlite_db_name，返回 db 文件绝对路径（与 settings 同级的上一目录下的 db 文件） */
function resolveDbPathFromSettings(): string | undefined {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "src-tauri", SETTINGS_RELATIVE),
    path.resolve(cwd, "..", "src-tauri", SETTINGS_RELATIVE),
    path.resolve(__dirname, "..", "..", "..", "..", "src-tauri", SETTINGS_RELATIVE),
  ];
  for (const settingsPath of candidates) {
    if (!existsSync(settingsPath)) continue;
    try {
      const raw = readFileSync(settingsPath, "utf-8");
      const data = JSON.parse(raw) as { sqlite_db_name?: string };
      const name = (data.sqlite_db_name ?? "test.db").trim();
      if (!name) return undefined;
      return path.join(
        "/Users/manshawar/Library/Application Support/com.manshawar.langchainapp",
        "..",
        name
      );
    } catch {
      continue;
    }
  }
  return undefined;
}

/** 有 Tauri 注入用 env；否则非打包环境从 settings.json 解析；都没有则无 DB */
function getSqliteDbPath(): string | undefined {
  const fromEnv = process.env.SQLITE_DB_PATH ?? process.env.DB_PATH;
  if (fromEnv?.trim()) return fromEnv.trim();
  return resolveDbPathFromSettings();
}

let sqlJs: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let sqlJsFailed = false;
let db: InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]> | null = null;

async function getSqlJs() {
  if (sqlJsFailed) return null;
  if (sqlJs) return sqlJs;
  try {
    sqlJs = await initSqlJs();
    return sqlJs;
  } catch (e) {
    console.error("sql.js init failed (e.g. WASM not available when packaged):", e);
    sqlJsFailed = true;
    return null;
  }
}

/** 只读打开 sqlite 文件（仅当有路径且 sql.js 可用时）。文件不存在（ENOENT）时返回 null，不报错。 */
async function getDb() {
  const dbPath = getSqliteDbPath();
  if (!dbPath) return null;
  if (db) return db;
  const SQL = await getSqlJs();
  if (!SQL) return null;
  try {
    const buf = await readFile(dbPath);
    db = new SQL.Database(buf);
    return db;
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as NodeJS.ErrnoException).code : "";
    if (code === "ENOENT") {
      console.warn("[langchain-serve] DB 文件不存在，请先在前端使用 SQL 功能创建:", dbPath);
    } else {
      console.error("SQLite open failed:", e);
    }
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
  return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
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
        hint: "Set env SQLITE_DB_PATH or DB_PATH, or ensure the DB file exists (create it from the app first)",
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

/** 供 core 或直接运行调用；port 优先 options，否则读 env API_PORT，为 0 时由系统分配 */
export function run(options?: { port?: number }) {
  const port = options?.port ?? (Number(process.env.API_PORT) || 0);
  const dbPath = getSqliteDbPath();
  console.log("langchain-serve run", port, HOST, dbPath ? `DB=${dbPath}` : "DB=(not set)");
  serve({ fetch: app.fetch, port, hostname: HOST }, (info: { port: number }) => {
    const base = `http://${HOST}:${info.port}`;
    console.log(
      `API_PORT=${info.port} | 接口地址: ${base} | 健康检查: ${base}/health | 数据库测试: ${base}/db-test`
    );
  });
}

run();

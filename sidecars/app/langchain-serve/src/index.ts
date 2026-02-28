/**
 * langchain-serve: Hono API 服务
 * 环境变量来源：Tauri 侧车启动时由 Rust 注入（pkg 打包后）；或通过 script/dev.ts 用 dotenv 加载 sidecars/.env 后启动（开发）。
 * index 内不加载 .env，避免覆盖侧车注入。
 * 数据库：node:sqlite DatabaseSync（Node 22+）+ Drizzle schema 类型，封装在 src/db.ts，少写 raw SQL。
 */
import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import { DatabaseSync } from "node:sqlite";
import { initDb, getTableNames, getTestRows } from "./db.js";

const dbPath = process.env.DB_PATH?.trim();
const db = dbPath ? new DatabaseSync(dbPath) : null;
initDb(db);
const HOST = "127.0.0.1";

if (dbPath) console.log("DB_PATH:", dbPath);

const app = new Hono();
app.get("/health", (c: Context) => c.json({ ok: true }));

/** 返回库中所有表名及数量、test 表数据，用于验证数据库（通过 db 封装，无 raw SQL） */
app.get("/db", (c: Context) => {
  try {
    const tables = getTableNames();
    const testRows = getTestRows();
    return c.json({
      ok: true,
      tableCount: tables.length,
      tables,
      testRows,
    });
  } catch (e) {
    if ((e as Error)?.message?.includes("DB not configured")) {
      return c.json({ ok: false, error: "DB not configured", hint: "Set env DB_PATH" }, 503);
    }
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ ok: false, error: msg }, 500);
  }
});

/** 供 core 或直接运行调用；port 优先 options，否则读 env API_PORT（与 sidecars/.env 或侧车注入一致），缺省 8264 */
export function run(options?: { port?: number }) {
  const port = options?.port ?? (Number(process.env.API_PORT) || 8264);
  console.log("langchain-serve run", port, HOST);
  serve({ fetch: app.fetch, port, hostname: HOST }, (info: { port: number }) => {
    const base = `http://${HOST}:${info.port}`;
    console.log(
      `API_PORT=${info.port} | 接口地址: ${base} | 健康检查: ${base}/health | DB: ${base}/db`
    );
  });
}

run();

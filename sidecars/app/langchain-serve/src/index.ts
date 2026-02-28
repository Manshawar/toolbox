/**
 * langchain-serve: Hono API 服务
 * 环境变量来源：Tauri 侧车启动时由 Rust 注入（pkg 打包后）；或通过 script/dev.ts 用 dotenv 加载 sidecars/.env 后启动（开发）。
 * 数据库：better-sqlite3 + Drizzle schema，封装在 src/db.ts；仅在 DB_PATH 存在时懒加载，避免无 DB 环境下加载原生绑定报错。
 */
import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import Database from "better-sqlite3";
const dbPath = process.env.DB_PATH?.trim();
if (dbPath) {
  const db = new Database(dbPath);
  const result = db.prepare("SELECT * FROM test").all();
  console.log("result", result);
}

const HOST = "127.0.0.1";
if (dbPath) console.log("DB_PATH:", dbPath);

const app = new Hono();
app.get("/health", (c: Context) => c.json({ ok: true }));

/** 返回库中所有表名及 test 表数据（需设置 DB_PATH） */
// app.get("/db", (c: Context) => {

// });

/** 供 core 或直接运行调用；port 优先 options，否则读 env API_PORT，缺省 8264 */
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

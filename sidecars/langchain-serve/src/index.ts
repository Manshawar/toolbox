/**
 * langchain-serve: Hono API 服务
 * 导出 run() 供 core 或独立入口调用；不自动执行，避免被 core 并入时重复启动。
 */
import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";

const HOST = "127.0.0.1";

const app = new Hono();
app.get("/health", (c: Context) => c.json({ ok: true }));

/** 供 core 或直接运行调用 */
export async function run(): Promise<void> {
  serve({ fetch: app.fetch, port: 0, hostname: HOST }, (info: { port: number }) => {
    console.log(`API_PORT=${info.port}`);
  });
}
// 单二进制时由 core 调用 run()；独立运行需: node -e "import('./dist/index.js').then(m=>m.run())"

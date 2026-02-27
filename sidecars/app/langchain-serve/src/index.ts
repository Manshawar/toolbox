/**
 * langchain-serve: Hono API 服务
 * 导出 run() 供 core 或独立入口调用；不自动执行，避免被 core 并入时重复启动。
 */
import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import { consola } from "consola";

const log = consola.withTag("langchain-serve");
const HOST = "127.0.0.1";

const app = new Hono();
app.get("/health", (c: Context) => c.json({ ok: true }));
console.log("langchain-serve start");
/** 供 core 或直接运行调用；port 优先 options，否则读 env VITE_API_PORT，为 0 时由系统分配 */
function run(options?: { port?: number }) {
  const port = options?.port ?? (Number(process.env.VITE_API_PORT) || 0);
  console.log("langchain-serve run", port, HOST);
  serve({ fetch: app.fetch, port, hostname: HOST }, (info: { port: number }) => {
    const base = `http://${HOST}:${info.port}`;
    console.log(`API_PORT=${info.port} | 接口地址: ${base} | 健康检查: ${base}/health`);
  });
}

run();

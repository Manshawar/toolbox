/**
 * langchain-serve 入口：创建 Hono、注册路由、启动服务
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { registerRoutes } from "./routes";
import { getApiPort, getHost, logConfig } from "./config/env";
import { readStore } from "./services/storeService";

const app = new Hono();
registerRoutes(app);

export async function run(options?: { port?: number }): Promise<void> {
  const port = options?.port ?? getApiPort();
  const host = getHost();
  logConfig();
  const store = await readStore();
  if (store != null) console.log("store", store);

  serve({ fetch: app.fetch, port, hostname: host }, (info: { port: number }) => {
    const base = `http://${host}:${info.port}`;
    console.log(
      `langchain-serve run | API_PORT=${info.port} | ${base} | health: ${base}/health | db: ${base}/db`
    );
  });
}

run();

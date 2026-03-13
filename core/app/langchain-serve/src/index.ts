/**
 * langchain-serve 入口：创建 Hono、注册路由、启动服务
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { registerRoutes } from "./routes";
import { getApiPort, getHost, logConfig } from "./config/env";
import { startWatchingStore } from "./services/storeService";
import { swaggerUI } from "@hono/swagger-ui";
import { logger } from "./utils/logger";

const app = new Hono();
registerRoutes(app);

export async function run(options?: { port?: number }): Promise<void> {
  const port = options?.port ?? getApiPort();
  const host = getHost();
  app.get("/ui", swaggerUI({ url: "/doc" }));

  logConfig();
  startWatchingStore();

  logger.info({ host, port }, "langchain-serve starting");

  serve({ fetch: app.fetch, port, hostname: host }, (info: { port: number }) => {
    const base = `http://${host}:${info.port}`;
    logger.info(
      { API_PORT: info.port, base, swagger: `${base}/ui` },
      "langchain-serve listening"
    );
  });
}


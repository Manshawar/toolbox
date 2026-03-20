/**
 * langchain-serve 入口：创建 Fastify 应用、注册插件和路由、启动服务
 * 日志仅使用 Fastify 内置 logger（底层为 Pino），见：https://www.fastify.cn/docs/latest/Reference/Logging/
 */
import { createApp } from "./app";
import { getApiPort, getHost, isToolboxDevMode, logConfig } from "./config/env";
import { startWatchingStore } from "./services/storeService";

/**
 * 启动服务
 */
export async function run(options?: { port?: number }): Promise<void> {
  const app = await createApp();
  const port = options?.port ?? getApiPort();
  const host = getHost();

  logConfig();
  startWatchingStore(app.log);

  try {
    await app.listen({ port, host });
    const base = `http://${host}:${port}`;
    app.log.info(
      { API_PORT: port, base, swagger: isToolboxDevMode() ? `${base}/ui` : undefined },
      "langchain-serve listening",
    );
  } catch (err) {
    app.log.error(err, "langchain-serve failed to start");
    process.exitCode = 1;
  }
}

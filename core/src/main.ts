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
  const runStartTime = Date.now();
  console.log(`[startup:main] run() 开始执行`);

  console.log(`[startup:main] 开始 createApp()...`);
  const app = await createApp();
  console.log(`[startup:main] createApp() 完成，耗时: ${Date.now() - runStartTime}ms`);

  const port = options?.port ?? getApiPort();
  const host = getHost();

  logConfig();
  startWatchingStore(app.log);
  console.log(`[startup:main] 配置完成，准备启动 HTTP 服务...`);

  try {
    console.log(`[startup:main] 调用 app.listen(${port}, ${host})...`);
    const listenStartTime = Date.now();
    await app.listen({ port, host });
    console.log(`[startup:main] HTTP 服务启动完成，耗时: ${Date.now() - listenStartTime}ms`);

    const base = `http://${host}:${port}`;
    const totalTime = Date.now() - runStartTime;
    app.log.info(
      { API_PORT: port, base, swagger: isToolboxDevMode() ? `${base}/ui` : undefined },
      "langchain-serve listening",
    );
    // 输出就绪标记，供 Rust 检测并通知前端
    console.log("###CORE_READY###", JSON.stringify({ port, base, ws: `${base}/ws`, startupMs: totalTime }));
    console.log(`[startup:main] 总启动耗时: ${totalTime}ms`);
  } catch (err) {
    app.log.error(err, "langchain-serve failed to start");
    process.exitCode = 1;
  }
}

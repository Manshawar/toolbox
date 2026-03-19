/**
 * langchain-serve 入口：创建 Fastify 应用、注册插件和路由、启动服务
 * 日志仅使用 Fastify 内置 logger（底层为 Pino），见：https://www.fastify.cn/docs/latest/Reference/Logging/
 */
import Fastify from "fastify";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
// import swagger from "@fastify/swagger";
// import swaggerUi from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { registerRoutes } from "./routes";
import { getApiPort, getHost, logConfig } from "./config/env";
import { startWatchingStore } from "./services/storeService";
// import { getLogFilePath } from "./utils/logger";

const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as string;

/**
 * 是否对控制台使用 pino-pretty（本地 tsx / 未设 NODE_ENV 时默认开启，避免只看到 JSON）
 * - 显式关闭：LOG_PRETTY=0 | false | no
 * - 显式开启：LOG_PRETTY=1 | true | yes
 * - production / test 环境默认不美化（除非 LOG_PRETTY=1）
 */
function usePinoPretty(): boolean {
  const v = process.env.LOG_PRETTY?.toLowerCase();
  if (v === "0" || v === "false" || v === "no") return false;
  if (v === "1" || v === "true" || v === "yes") return true;
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") return false;
  return true;
}

/** pino-pretty 常用选项（与 Fastify 文档示例一致） */
const prettyOptions = {
  colorize: true,
  translateTime: "HH:MM:ss Z",
  ignore: "pid,hostname",
};

/**
 * 获取日志文件路径，确保目录存在
 */
// function ensureLogFilePath(): string {
//   const filePath = getLogFilePath();
//   if (filePath) {
//     const dir = path.dirname(filePath);
//     if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
//   }
//   return filePath;
// }

/**
 * 构建 Fastify logger 配置（仅用官方支持的选项，不直接依赖 pino）
 * 支持：级别、开发环境 pino-pretty、可选写文件（LOG_PATH / LOG_DIR / APP_DATA_DIR）
 */
function buildLoggerConfig(): Record<string, unknown> {
  // const logFilePath = ensureLogFilePath();
  const level = LOG_LEVEL;

  // 有文件路径：控制台 + 文件双输出（通过 Pino transport targets，由 Fastify 传给底层 Pino）
  // if (logFilePath) {
  //   const targets: Array<{ target: string; options?: Record<string, unknown>; level: string }> = [
  //     usePinoPretty()
  //       ? { target: "pino-pretty", options: prettyOptions, level }
  //       : { target: "pino/file", options: { destination: 1 }, level }, // 1 = stdout
  //     { target: "pino/file", options: { destination: logFilePath, append: true }, level },
  //   ];
  //   return { level, transport: { targets } };
  // }

  // 无文件：仅控制台
  return {
    level,
    transport: usePinoPretty() ? { target: "pino-pretty", options: prettyOptions } : undefined,
  };
}

/**
 * 创建并配置 Fastify 应用
 */
export async function createApp() {
  const app = Fastify({ logger: buildLoggerConfig() });

  // 注册 Swagger/OpenAPI 插件（自动生成文档）
  // await app.register(swagger, {
  //   openapi: {
  //     info: {
  //       title: "langchain-serve API",
  //       description: "langchain-serve 侧车服务 API 文档",
  //       version: "1.0.0",
  //     },
  //     tags: [
  //       { name: "健康", description: "健康检查" },
  //       { name: "Test", description: "DB / Store 等测试接口" },
  //       { name: "LangChain", description: "LangChain 功能接口" },
  //     ],
  //   },
  // });

  // // 注册 Swagger UI 插件（本地资源，不依赖 CDN）
  // await app.register(swaggerUi, {
  //   routePrefix: "/ui",
  //   uiConfig: {
  //     docExpansion: "list",
  //     deepLinking: true,
  //   },
  //   staticCSP: true,
  // });

  // 注册 CORS
  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // 注册文件上传支持
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  // 注册业务路由
  await registerRoutes(app);

  return app;
}

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
    app.log.info({ API_PORT: port, base, swagger: `${base}/ui` }, "langchain-serve listening");
  } catch (err) {
    app.log.error(err, "langchain-serve failed to start");
    process.exitCode = 1;
  }
}

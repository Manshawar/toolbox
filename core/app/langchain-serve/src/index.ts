/**
 * langchain-serve 入口：创建 Fastify 应用、注册插件和路由、启动服务
 * 日志仅使用 Fastify 内置 logger（底层为 Pino），见：https://www.fastify.cn/docs/latest/Reference/Logging/
 */
import Fastify from "fastify";
import pinoPretty from "pino-pretty";
// import swagger from "@fastify/swagger";
// import swaggerUi from "@fastify/swagger-ui";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { registerRoutes } from "./routes";
import { getApiPort, getHost, isToolboxDevMode, logConfig } from "./config/env";
import { startWatchingStore } from "./services/storeService";
// import { getLogFilePath } from "./utils/logger";

const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as string;

/**
 * 控制台是否使用 pino-pretty：
 * - TOOLBOX_ENV=development：开启
 * - 其余情况（含未设置）：关闭
 */
function usePinoPretty(): boolean {
  return isToolboxDevMode();
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
 * 构建 Fastify logger 配置。
 * 使用 pino-pretty stream（非 transport），避免 thread-stream 在 bundle 后查找 lib/worker.js 失败。
 */
function buildLoggerConfig() {
  const level = LOG_LEVEL;
  if (usePinoPretty()) {
    return { level, stream: pinoPretty(prettyOptions) };
  }
  return { level };
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

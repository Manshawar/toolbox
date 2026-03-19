/**
 * langchain-serve 入口：创建 Fastify 应用、注册插件和路由、启动服务
 * 日志仅使用 Fastify 内置 logger（底层为 Pino），见：https://www.fastify.cn/docs/latest/Reference/Logging/
 */
import Fastify from "fastify";
import pinoPretty from "pino-pretty";
import pino from "pino";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { registerRoutes } from "./routes";
import { getApiPort, getHost, isToolboxDevMode, logConfig } from "./config/env";
import { startWatchingStore } from "./services/storeService";
import { inspect } from "node:util";
import { getLogFilePath } from "./utils/logger";
import path from "node:path";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";

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
function ensureLogFilePath(): string {
  const filePath = getLogFilePath();
  if (filePath) {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // 触碰一次文件，便于尽早暴露权限/路径问题。
    try {
      appendFileSync(filePath, "");
    } catch (err) {
      console.warn("[logger] touch log file failed", { filePath, err });
      return "";
    }
  }
  return filePath;
}

/**
 * 构建 Fastify logger 配置。
 * 使用 pino-pretty stream（非 transport），避免 thread-stream 在 bundle 后查找 lib/worker.js 失败。
 */
function buildLoggerConfig() {
  const level = LOG_LEVEL;

  // 开发模式：只走控制台 pretty，不写文件。
  if (usePinoPretty()) {
    return { level, stream: pinoPretty(prettyOptions) };
  }

  // 生产模式：尽量落盘到 langchain-serve.log，否则退回仅控制台输出。
  const filePath = ensureLogFilePath();
  if (filePath)
    // 用 ISO 时间字符串替代默认 epoch 时间；避免你们再做换算。
    return { level, file: filePath, timestamp: pino.stdTimeFunctions.isoTime };

  return { level };
}

/**
 * 创建并配置 Fastify 应用
 */
export async function createApp() {
  const app = Fastify({ logger: buildLoggerConfig() });

  // 统一打印接口返回值：用于定位“返回空对象但数组长度正常”等问题。
  // 仅在 development 或显式开启开关时打印，避免生产刷屏。
  const shouldLogResponse = isToolboxDevMode();
  if (shouldLogResponse) {
    app.addHook("onSend", (request, reply, payload, done) => {
      try {
        const shouldLog =
          request.url === "/health" || request.url.startsWith("/test/");

        const payloadPreview = inspect(payload, {
          depth: 6,
          maxArrayLength: 50,
          breakLength: 140,
        });
        if (shouldLog) {
          app.log.info(
            {
              method: request.method,
              url: request.url,
              statusCode: reply.statusCode,
              payload: payloadPreview,
            },
            "api response"
          );
        }
      } catch {
        // 不影响正常返回
      } finally {
        done();
      }
    });

    app.setErrorHandler((err, request, reply) => {
      const shouldLog =
        request.url === "/health" || request.url.startsWith("/test/");
      if (shouldLog) {
        app.log.error(
          {
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
            message: err instanceof Error ? err.message : String(err),
          },
          "api error"
        );
      }
      // 交由 Fastify 的默认错误响应逻辑返回 500/错误体
      reply.send(err);
    });
  }

  // 仅开发模式启用 Swagger UI，避免生产模式暴露文档页面。
  if (isToolboxDevMode()) {
    // 动态引入：生产模式下不需要 swagger 包，避免启动时加载依赖。
    const swagger = (await import("@fastify/swagger")).default;
    const swaggerUi = (await import("@fastify/swagger-ui")).default;

    await app.register(swagger, {
      openapi: {
        info: {
          title: "langchain-serve API",
          description: "langchain-serve 侧车服务 API 文档",
          version: "1.0.0",
        },
        tags: [
          { name: "健康", description: "健康检查" },
          { name: "Test", description: "DB / Store 等测试接口" },
          { name: "LangChain", description: "LangChain 功能接口" },
        ],
      },
    });

    // 使用本地静态资源（swagger-ui-dist），不依赖 CDN。
    await app.register(swaggerUi, {
      routePrefix: "/ui",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
      staticCSP: true,
    });
  }

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
    app.log.info(
      { API_PORT: port, base, swagger: isToolboxDevMode() ? `${base}/ui` : undefined },
      "langchain-serve listening",
    );
  } catch (err) {
    app.log.error(err, "langchain-serve failed to start");
    process.exitCode = 1;
  }
}

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
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { PassThrough } from "node:stream";

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

let didCleanupOldLogs = false;

function getLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(ymd: string): number | null {
  // ymd: YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [, ys, ms, ds] = m;
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const t = dt.getTime();
  return Number.isFinite(t) ? t : null;
}

function cleanupOldDailyLogs(baseLogPath: string, keepDays: number): void {
  if (didCleanupOldLogs) return;
  didCleanupOldLogs = true;

  const dir = path.dirname(baseLogPath);
  const ext = path.extname(baseLogPath); // ".log"
  const baseName = path.basename(baseLogPath, ext); // "langchain-serve"

  const threshold = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    if (!name.startsWith(`${baseName}-`) || !name.endsWith(ext)) continue;
    const ymd = name.slice(baseName.length + 1, name.length - ext.length);
    const t = parseYMD(ymd);
    if (t === null) continue;
    if (t < threshold) {
      const p = path.join(dir, name);
      try {
        rmSync(p, { force: true });
      } catch {
        // ignore
      }
    }
  }
}

function getDailyLogFilePath(keepDays = 7): string {
  const base = getLogFilePath();
  if (!base) return "";

  cleanupOldDailyLogs(base, keepDays);

  const dir = path.dirname(base);
  const ext = path.extname(base); // ".log"
  const baseName = path.basename(base, ext); // "langchain-serve"
  const ymd = getLocalYMD(new Date());

  return path.join(dir, `${baseName}-${ymd}${ext}`);
}

/**
 * 构建 Fastify logger 配置。
 * 使用 pino-pretty stream（非 transport），避免 thread-stream 在 bundle 后查找 lib/worker.js 失败。
 */
function buildLoggerConfig() {
  const level = LOG_LEVEL;

  // 开发模式：控制台 pretty + 仍然落盘（通过 tee 分流）。
  if (usePinoPretty()) {
    const dailyFilePath = getDailyLogFilePath(7);
    if (dailyFilePath) {
      const dir = path.dirname(dailyFilePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      // 触碰一次当天文件，便于尽早暴露权限/路径问题。
      try {
        appendFileSync(dailyFilePath, "");
      } catch (err) {
        console.warn("[logger] touch daily log file failed", { dailyFilePath, err });
      }

      const tee = new PassThrough();

      // 1) 控制台 pretty
      tee.pipe(pinoPretty(prettyOptions));

      // 2) 原样 JSON Lines 落盘
      const fileStream = createWriteStream(dailyFilePath, { flags: "a" });
      fileStream.on("error", (err) => {
        console.warn("[logger] log file write failed", { dailyFilePath, err });
      });
      tee.pipe(fileStream);

      return {
        level,
        stream: tee,
        timestamp: pino.stdTimeFunctions.isoTime,
      };
    }

    return { level, stream: pinoPretty(prettyOptions), timestamp: pino.stdTimeFunctions.isoTime };
  }

  // 生产模式：尽量落盘到 langchain-serve.log，否则退回仅控制台输出。
  const dailyFilePath = getDailyLogFilePath(7);
  if (dailyFilePath) {
    // 用 ISO 时间字符串替代默认 epoch 时间；避免你们再做换算。
    return { level, file: dailyFilePath, timestamp: pino.stdTimeFunctions.isoTime };
  }

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

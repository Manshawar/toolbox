import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import { registerRoutes } from "./routes";
import { isToolboxDevMode } from "./config/env";
import { inspect } from "node:util";
import { buildLoggerConfig } from "./utils/logger";

/**
 * 创建并配置 Fastify 应用
 */
export async function createApp() {
  const app = Fastify({ logger: buildLoggerConfig() });

  // 统一打印接口返回值：用于定位"返回空对象但数组长度正常"等问题。
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

  // 注册 WebSocket 支持
  await app.register(websocket);

  // 注册业务路由
  await registerRoutes(app);

  return app;
}

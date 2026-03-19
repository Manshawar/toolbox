import type { FastifyInstance } from "fastify";
import { success } from "../utils/response";

/**
 * 健康检查路由
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  // GET /health - 健康检查
  app.get("/health", {
    schema: {
      tags: ["健康"],
      summary: "健康检查",
      description: "返回服务健康状态",
      response: {
        200: {
          description: "OK",
          type: "object",
          properties: {
            code: { type: "number", example: 1 },
            message: { type: "string", example: "ok" },
            data: {
              type: "object",
              properties: {
                ok: { type: "boolean", example: true },
              },
            },
          },
        },
      },
    },
    handler: async () => success({ ok: true }),
  });
}

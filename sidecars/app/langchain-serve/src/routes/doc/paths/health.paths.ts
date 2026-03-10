/**
 * OpenAPI paths：健康检查
 * 对应路由 /health
 */
export const healthPaths = {
  "/health": {
    get: {
      tags: ["健康"],
      summary: "健康检查",
      responses: {
        "200": {
          description: "OK",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { ok: { type: "boolean" } },
              },
            },
          },
        },
      },
    },
  },
} as const;

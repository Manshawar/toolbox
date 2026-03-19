import type { FastifyInstance } from "fastify";
import { execFile } from "child_process";
import { getStoreConfig } from "../services/storeService";
import { listTest } from "../services/testService";
import { getApiPort, getHost } from "../config/env";
import { success } from "../utils/response";

/**
 * Test 路由：测试数据库、配置、子进程等功能
 * 使用 Express 风格的 shorthand declaration
 */
export async function registerTestRoutes(app: FastifyInstance): Promise<void> {
  // 使用 prefix 创建子路由实例，类似 Express Router
  await app.register(
    async (router) => {
      // GET /test/db - 查询 DB
      router.get("/db", {
        schema: {
          tags: ["Test"],
          summary: "查询 DB",
          description: "返回 test 表数据，需设置 DB_PATH",
     
          response: {
            200: {
              description: "统一返回结构",
              type: "object",
              properties: {
                code: { type: "number" },
                message: { type: "string" },
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "number" },
                      name: { type: "string", nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
        handler: async () => success(listTest()),
      });

      // GET /test/store - 查询 Store
      router.get("/store", {
        schema: {
          tags: ["Test"],
          summary: "查询 Store",
          description: "返回当前 store 配置，需设置 STORE_PATH",
          response: {
            200: {
              description: "统一返回结构",
              type: "object",
              properties: {
                code: { type: "number" },
                message: { type: "string" },
                data: { type: "object", nullable: true },
              },
            },
          },
        },
        handler: async () => success(getStoreConfig() ?? null),
      });

      // GET /test/child-process - 测试子进程
      router.get("/child-process", {
        schema: {
          tags: ["Test"],
          summary: "测试子进程",
          description: "测试子进程是否能正常运行",
          response: {
            200: {
              type: "object",
              properties: {
                code: { type: "number" },
                message: { type: "string" },
                data: {
                  description: "子进程运行结果",
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    startedAt: { type: "number" },
                    finishedAt: { type: "number" },
                    durationMs: { type: "number" },
                    node: { type: "string" },
                    execPath: { type: "string" },
                    stdout: { type: "string" },
                    stderr: { type: "string" },
                    code: { type: "number", nullable: true },
                    signal: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
        handler: async () => {
          const startedAt = Date.now();
          const output = await new Promise<{
            stdout: string;
            stderr: string;
            code: number | null;
            signal: NodeJS.Signals | null;
          }>((resolve) => {
            const child = execFile(
              process.execPath,
              ["-e", "console.log('[core route] child process ok')"],
              (error, stdout, stderr) => {
                if (error && error.code) {
                  resolve({
                    stdout: stdout.toString(),
                    stderr: (stderr || error.message).toString(),
                    code: typeof error.code === "number" ? error.code : null,
                    signal:
                      (error as NodeJS.ErrnoException & { signal?: NodeJS.Signals }).signal ??
                      null,
                  });
                } else {
                  resolve({
                    stdout: stdout.toString(),
                    stderr: stderr.toString(),
                    code: 0,
                    signal: null,
                  });
                }
              }
            );
            child.on("error", (err) => {
              resolve({
                stdout: "",
                stderr: err.message,
                code: null,
                signal: null,
              });
            });
          });

          return success({
            ok: true,
            startedAt,
            finishedAt: Date.now(),
            durationMs: Date.now() - startedAt,
            node: process.version,
            execPath: process.execPath,
            ...output,
          });
        },
      });

      // GET /test/swagger-url - 返回 swagger UI 地址
      router.get("/swagger-url", {
        schema: {
          tags: ["Test"],
          summary: "返回 swagger UI 地址",
          description: "返回 swagger UI 地址，供前端展示（点击可打开）",
          response: {
            200: {
              type: "object",
              properties: {
                code: { type: "number" },
                message: { type: "string" },
                data: {
                  description: "swagger UI 地址",
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    base: { type: "string" },
                  },
                },
              },
            },
          },
        },
        handler: async () => {
          const base = `http://${getHost()}:${getApiPort()}`;
          const data = { url: `${base}/ui`, base };
          const payload = success(data);
          return payload;
        },
      });
    },
    { prefix: "/test" }
  );
}

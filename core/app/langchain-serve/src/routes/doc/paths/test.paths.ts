/**
 * OpenAPI paths：Test 相关（/test/db, /test/store）
 */
export const testPaths = {
  "/test/db": {
    get: {
      tags: ["Test"],
      summary: "查询 DB",
      description: "返回 test 表数据，需设置 DB_PATH",
      responses: {
        "200": {
          description: "test 表数据列表",
          content: {
            "application/json": {
              schema: { type: "array" },
            },
          },
        },
      },
    },
  },
  "/test/store": {
    get: {
      tags: ["Test"],
      summary: "查询 Store",
      description:
        "返回当前 store 配置，需设置 STORE_PATH 并已 startWatchingStore",
      responses: {
        "200": {
          description: "store 配置或 null",
          content: {
            "application/json": {
              schema: {},
            },
          },
        },
      },
    },
  },
  "/test/child-process": {
    get: {
      tags: ["Test"],
      summary: "测试子进程",
      description: "测试子进程是否能正常运行",
      responses: {
        "200": {
          description: "子进程运行结果",
          content: {
            "application/json": {
              schema: { type: "string" },
            },
          },
        },
      },
    },
  },
  "/test/swagger-url": {
    get: {
      tags: ["Test"],
      summary: "返回 swagger UI 地址",
      description: "返回 swagger UI 地址，供前端展示（点击可打开）",
      responses: {
        "200": {
          description: "swagger UI 地址",
          content: {
            "application/json": {
              schema: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

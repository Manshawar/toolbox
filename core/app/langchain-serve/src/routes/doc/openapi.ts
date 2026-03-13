/**
 * 合并各路由的 OpenAPI paths，并定义 tags，供 Swagger UI 分区块展示
 */
import { healthPaths } from "./paths/health.paths";
import { testPaths } from "./paths/test.paths";

/** 文档顶部的 tag 说明，顺序即 Swagger UI 中分组的顺序 */
export const openApiTags = [
  { name: "健康", description: "健康检查" },
  { name: "Test", description: "DB / Store 等测试接口" },
] as const;

/** 完整 OpenAPI 3 文档：paths 由各路由模块合并，tags 控制 Swagger UI 分组顺序 */
export const openApiDoc = {
  openapi: "3.0.0",
  info: {
    title: "langchain-serve API",
    version: "1.0.0",
    description: "langchain-serve 侧车服务 API 文档",
  },
  tags: [...openApiTags],
  paths: {
    ...healthPaths,
    ...testPaths,
  },
};

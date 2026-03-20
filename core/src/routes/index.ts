import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health";
import { registerTestRoutes } from "./test";
import { registerWsRoutes } from "./ws";

/**
 * 注册所有路由
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerHealthRoutes(app);
  await registerTestRoutes(app);
  await registerWsRoutes(app);
}

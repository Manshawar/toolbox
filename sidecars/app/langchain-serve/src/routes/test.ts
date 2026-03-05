import type { Hono } from "hono";
import { listTest } from "../services/testService";

export function registerTestRoutes(app: Hono): void {
  /** 返回 test 表数据（需设置 DB_PATH） */
  app.get("/db", (c) => {
    const data = listTest();
    return c.json(data);
  });
}

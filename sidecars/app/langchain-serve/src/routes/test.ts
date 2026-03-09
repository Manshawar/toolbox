import { Hono } from "hono";
import { getStoreConfig } from "../services/storeService";
import { listTest } from "../services/testService";

const testApp = new Hono();

/** 查询 db：返回 test 表数据（需设置 DB_PATH） */
testApp.get("/db", (c) => {
  const data = listTest();
  return c.json(data);
});

/** 查询 store：返回当前 store 配置（需设置 STORE_PATH，并已 startWatchingStore） */
testApp.get("/store", (c) => {
  const data = getStoreConfig();
  return c.json(data ?? null);
});

export function registerTestRoutes(app: Hono): void {
  app.route("/test", testApp);
}

import { Hono } from "hono";
import { execFile } from "child_process";
import { getStoreConfig } from "../services/storeService";
import { listTest } from "../services/testService";
import { getApiPort, getHost } from "../config/env";

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

/** 测试 Node 子进程能力：执行 `node -e "console.log(...)"` 并返回输出 */
testApp.get("/child-process", async (c) => {
  const startedAt = Date.now();
  const output = await new Promise<{ stdout: string; stderr: string; code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    const child = execFile(
      process.execPath,
      ["-e", "console.log('[core route] child process ok')"],
      (error, stdout, stderr) => {
        if (error && (error as any).code !== 0) {
          resolve({
            stdout: stdout.toString(),
            stderr: (stderr || error.message).toString(),
            code: (error as any).code ?? null,
            signal: (error as any).signal ?? null,
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

  return c.json({
    ok: true,
    startedAt,
    finishedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    node: process.version,
    execPath: process.execPath,
    ...output,
  });
});

/** 返回 swagger UI 地址，供前端展示（点击可打开） */
testApp.get("/swagger-url", (c) => {
  try {
    const host = getHost();
    const port = getApiPort();
    const base = `http://${host}:${port}`;
    const url = `${base}/ui`;
    return c.json({ url, base });
  } catch (e) {
    return c.json({ error: String(e), hint: "API_PORT 或 env 异常" }, 500);
  }
});

export function registerTestRoutes(app: Hono): void {
  app.route("/test", testApp);
}

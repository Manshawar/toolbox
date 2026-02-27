/**
 * pty-host: PTY + WebSocket 服务
 * 导出 run() 供 core 或独立入口调用；不自动执行，避免被 core 并入时重复启动。
 */
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import * as pty from "node-pty";
import { consola } from "consola";

const log = consola.withTag("pty-host");
const HOST = "127.0.0.1";

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } else {
    res.writeHead(404).end();
  }
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
  const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "sh";
  const ptyProcess = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || process.cwd(),
    env: process.env as Record<string, string>,
  });

  ptyProcess.onData((data: string) => {
    if (ws.readyState === 1) ws.send(data);
  });

  ptyProcess.onExit(() => {
    ws.close();
  });

  ws.on("message", (data: Buffer | string | Buffer[]) => {
    const msg =
      typeof data === "string"
        ? data
        : Buffer.isBuffer(data)
          ? data.toString()
          : Buffer.concat(data).toString();
    if (msg.startsWith("resize:")) {
      const [, cols, rows] = msg.split(":").map(Number);
      if (cols && rows) ptyProcess.resize(cols, rows);
    } else {
      ptyProcess.write(msg);
    }
  });

  ws.on("close", () => {
    ptyProcess.kill();
  });
});

/** 供 core 或直接运行调用；port 优先 options，否则读 env VITE_PTY_PORT，为 0 时由系统分配 */
export async function run(options?: { port?: number }): Promise<void> {
  const port =
    options?.port ?? (Number(process.env.VITE_PTY_PORT) || 0);
  server.listen(port, HOST, () => {
    const addr = server.address();
    const p = typeof addr === "object" && addr ? addr.port : 0;
    const base = `http://${HOST}:${p}`;
    const wsBase = `ws://${HOST}:${p}`;
    log.info(`PTY_PORT=${p} | HTTP: ${base} | WebSocket: ${wsBase} | 健康检查: ${base}/health`);
  });
}

// 单二进制时由 core 调用 run()；独立运行需: node -e "import('./dist/index.js').then(m=>m.run())"

// 直接执行 dist/pty-host.js 时自动启动服务
// @ts-ignore
if (typeof require !== "undefined" && require.main === module) {
  run().catch((err) => {
    console.error("[pty-host] 启动失败:", err);
    process.exit(1);
  });
}

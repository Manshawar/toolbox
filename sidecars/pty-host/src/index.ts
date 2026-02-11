/**
 * pty-host: PTY + WebSocket 服务
 * 导出 run() 供 core 或独立入口调用；不自动执行，避免被 core 并入时重复启动。
 */
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import * as pty from "node-pty";

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

/** 供 core 或直接运行调用 */
export async function run(): Promise<void> {
  server.listen(0, HOST, () => {
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    console.log(`PTY_PORT=${port}`);
  });
}

// 单二进制时由 core 调用 run()；独立运行需: node -e "import('./dist/index.js').then(m=>m.run())"

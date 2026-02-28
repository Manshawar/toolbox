/**
 * pty-host: PTY + WebSocket 服务，直接启动。
 * 端口由运行时的环境变量 PTY_PORT 注入（与 settings.json 的 pty_port 一致）。
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

const port = Number(process.env.PTY_PORT) || 8265;
server.listen(port, HOST, () => {
  const addr = server.address();
  const p = typeof addr === "object" && addr ? addr.port : 0;
  const base = `http://${HOST}:${p}`;
  const wsBase = `ws://${HOST}:${p}`;
  log.info(`PTY_PORT=${p} | HTTP: ${base} | WebSocket: ${wsBase} | 健康检查: ${base}/health`);
});

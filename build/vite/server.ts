import type { ServerOptions } from "vite";

const DEFAULT_PORT = 1420;

export function createViteServer(env: Record<string, string> = {}): ServerOptions {
  const port = Number(env.VITE_DEV_PORT) || DEFAULT_PORT;
  const viteServer: ServerOptions = {
    host: "127.0.0.1",
    port,
    // 显式指定 origin，避免依赖重载时 resolveServerUrls 解析到 protocol 为 null 报错
    origin: `http://127.0.0.1:${port}`,
    // 端口已被占用时是否尝试使用下一个可用的端口 true：直接退出，而不是尝试下一个可用端口 false：尝试下一个可用端口
    strictPort: true,
    // 自定义响应头（与 tauri.conf.json 中 security.headers 保持一致）
    headers: {
      "Permissions-Policy": "unload=(self)",
    },
  };
  return viteServer;
}

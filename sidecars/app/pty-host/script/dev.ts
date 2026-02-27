/**
 * 开发入口：从 .env 读端口并注入环境变量，然后直接启动当前应用（不 spawn pnpm，避免 ENOENT）
 */
import path from "path";
import fs from "fs";

const DEFAULT_PTY_PORT = 8265;

function loadEnvPort(): number {
  const rootEnv = path.join(process.cwd(), "../../../.env");
  if (!fs.existsSync(rootEnv)) return DEFAULT_PTY_PORT;
  const content = fs.readFileSync(rootEnv, "utf-8");
  const m = content.match(/VITE_PTY_PORT\s*=\s*(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (n > 0 && n < 65536) return n;
  }
  return DEFAULT_PTY_PORT;
}

function parseDevPort(): number {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--port");
  if (i !== -1 && argv[i + 1] != null) {
    const n = Number(argv[i + 1]);
    if (Number.isInteger(n) && n > 0 && n < 65536) return n;
  }
  return loadEnvPort();
}

const devPort = parseDevPort();
process.env.VITE_PTY_PORT = String(devPort);
(async () => {
  await import("../src/index.ts");
})();

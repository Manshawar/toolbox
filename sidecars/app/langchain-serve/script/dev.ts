/**
 * 开发入口：优先 --port，否则从项目根目录 .env 的 VITE_API_PORT 读取
 * 用法: pnpm dev [--port 3000]
 */
import path from "path";
import fs from "fs";

const DEFAULT_API_PORT = 3000;

function loadEnvPort(): number {
  const rootEnv = path.join(process.cwd(), "../../../.env");
  if (!fs.existsSync(rootEnv)) return DEFAULT_API_PORT;
  const content = fs.readFileSync(rootEnv, "utf-8");
  const m = content.match(/VITE_API_PORT\s*=\s*(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (n > 0 && n < 65536) return n;
  }
  return DEFAULT_API_PORT;
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
const { run } = await import("../src/index.ts");
await run({ port: devPort });
export {};

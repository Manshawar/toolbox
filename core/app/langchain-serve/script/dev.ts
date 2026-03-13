/**
 * 开发启动脚本：用 dotenv 加载 sidecars/.env 后启动服务。
 * 与 Tauri 并发启动时，.env 可能稍后由 Rust 写入，故若未读到 DB 路径则短暂重试再启动。
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const sidecarsEnv = join(__dirname, "..", "..", "..", ".env");

function envHasDbPath(): boolean {
  const fromEnv = process.env.SQLITE_DB_PATH ?? process.env.DB_PATH;
  return Boolean(fromEnv?.trim());
}

config({ path: sidecarsEnv });

if (!envHasDbPath()) {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (existsSync(sidecarsEnv)) config({ path: sidecarsEnv, override: true });
    if (envHasDbPath()) break;
  }
}

await import("../src/index.ts");

/**
 * 环境变量：Tauri 侧车注入或 script/dev.ts 的 dotenv 加载
 */
const HOST = "127.0.0.1";
const DEFAULT_API_PORT = 8264;

export function getHost(): string {
  return HOST;
}

export function getApiPort(): number {
  const raw = process.env.API_PORT ?? process.env.VITE_API_PORT;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULT_API_PORT;
}

export function getDbPath(): string | undefined {
  return process.env.DB_PATH?.trim() || undefined;
}

export function getStorePath(): string | undefined {
  return process.env.STORE_PATH?.trim() || undefined;
}

export function logConfig(): void {
  const dbPath = getDbPath();
  const storePath = getStorePath();
  if (dbPath) console.log("DB_PATH:", dbPath);
  if (storePath) console.log("STORE_PATH", storePath);
}

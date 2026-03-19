/**
 * 环境变量：Tauri 侧车注入或 script/dev.ts 的 dotenv 加载
 */
import { getLogFilePath } from "../utils/logger";

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

/** 获取配置信息（供日志打印） */
export function getConfigInfo(): {
  dbPath?: string;
  storePath?: string;
  logFile?: string;
} {
  return {
    dbPath: getDbPath(),
    storePath: getStorePath(),
    logFile: getLogFilePath(),
  };
}

/** 打印配置（使用 console，在服务启动前调用） */
export function logConfig(): void {
  const { dbPath, storePath, logFile } = getConfigInfo();
  if (dbPath) console.log(`[config] DB_PATH: ${dbPath}`);
  if (storePath) console.log(`[config] STORE_PATH: ${storePath}`);
  if (logFile) console.log(`[config] LOG_FILE: ${logFile}`);
  if (!dbPath && !storePath) console.log("[config] no DB_PATH or STORE_PATH set");
}

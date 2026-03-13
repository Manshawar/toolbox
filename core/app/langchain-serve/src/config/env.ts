/**
 * 环境变量：Tauri 侧车注入或 script/dev.ts 的 dotenv 加载
 */
import { getLogFilePath, logger } from "../utils/logger";

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
  const logFile = getLogFilePath();
  if (dbPath) logger.info({ DB_PATH: dbPath }, "config: DB_PATH");
  if (storePath) logger.info({ STORE_PATH: storePath }, "config: STORE_PATH");
  if (logFile) logger.info({ LOG_FILE: logFile }, "config: log file");
  if (!dbPath && !storePath) logger.debug("config: no DB_PATH or STORE_PATH set");
}

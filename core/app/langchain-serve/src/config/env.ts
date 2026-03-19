/**
 * 环境变量读取约定：
 * - 侧车模式：由 Tauri Rust 注入（优先）
 * - tsx 本地模式：由 core/.env（dotenv）提供兜底
 */
import { getLogFilePath } from "../utils/logger";

const HOST = "127.0.0.1";
const DEFAULT_API_PORT = 8264;

function readEnvString(key: string): string | undefined {
  const v = process.env[key];
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

export type ToolboxEnv = "development" | "production";

/** 统一运行模式：仅支持 development / production，默认 production */
export function getToolboxEnv(): ToolboxEnv {
  const raw = readEnvString("TOOLBOX_ENV")?.toLowerCase();
  return raw === "development" ? "development" : "production";
}

export function getHost(): string {
  return HOST;
}

export function getApiPort(): number {
  // 侧车注入 API_PORT 优先；本地 tsx 允许用 VITE_API_PORT 兜底。
  const raw = readEnvString("API_PORT") ?? readEnvString("VITE_API_PORT");
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : DEFAULT_API_PORT;
}

export function getDbPath(): string | undefined {
  return readEnvString("DB_PATH");
}

export function getStorePath(): string | undefined {
  return readEnvString("STORE_PATH");
}

/** 侧车/tsx 统一开发模式开关 */
export function isToolboxDevMode(): boolean {
  return getToolboxEnv() === "development";
}

/** 获取配置信息（供日志打印） */
export function getConfigInfo(): {
  dbPath?: string;
  storePath?: string;
  logFile?: string;
  toolboxEnv: ToolboxEnv;
  devMode: boolean;
} {
  return {
    dbPath: getDbPath(),
    storePath: getStorePath(),
    logFile: getLogFilePath(),
    toolboxEnv: getToolboxEnv(),
    devMode: isToolboxDevMode(),
  };
}

/** 打印配置（使用 console，在服务启动前调用） */
export function logConfig(): void {
  const { dbPath, storePath, logFile, devMode, toolboxEnv } = getConfigInfo();
  console.log(`[config] TOOLBOX_ENV: ${toolboxEnv}`);
  console.log(`[config] DEV_MODE: ${devMode ? "1" : "0"}`);
  if (dbPath) console.log(`[config] DB_PATH: ${dbPath}`);
  if (storePath) console.log(`[config] STORE_PATH: ${storePath}`);
  if (logFile) console.log(`[config] LOG_FILE: ${logFile}`);
  if (!dbPath && !storePath) console.log("[config] no DB_PATH or STORE_PATH set");
}

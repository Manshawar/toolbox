import path from "node:path";

/**
 * 日志工具：获取日志文件路径
 * Fastify 使用自己的 pino 实例，这里只提供路径工具
 *
 * 控制台是否美化：见 index.ts 的 usePinoPretty（TOOLBOX_ENV）
 */

/** 当前日志文件路径（未写文件时为空） */
export function getLogFilePath(): string {
  const logPath = process.env.LOG_PATH?.trim();
  if (logPath) return logPath;
  const logDir = process.env.LOG_DIR?.trim();
  if (logDir) return `${logDir.replace(/\/$/, "")}/langchain-serve.log`;
  const appDataDir = process.env.APP_DATA_DIR?.trim();
  if (appDataDir) return `${appDataDir.replace(/\/$/, "")}/langchain-serve.log`;
  return "";
}

function getLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 获取“当天”日志文件路径：
 * - langchain-serve.log -> langchain-serve-YYYY-MM-DD.log
 */
export function getDailyLogFilePath(date = new Date()): string {
  const base = getLogFilePath();
  if (!base) return "";

  const dir = path.dirname(base);
  const ext = path.extname(base); // ".log"
  const baseName = path.basename(base, ext); // "langchain-serve"
  const ymd = getLocalYMD(date);
  return path.join(dir, `${baseName}-${ymd}${ext}`);
}

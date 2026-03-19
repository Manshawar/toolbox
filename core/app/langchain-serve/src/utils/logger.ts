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

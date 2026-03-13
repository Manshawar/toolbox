/**
 * 统一日志：pino 打日志，pino-pretty 美化终端输出（两者需同时安装）
 *
 * 安装：在 sidecars 根目录执行 pnpm add pino pino-pretty
 *
 * 日志位置：
 * - 标准输出：经 pino-pretty 可读格式
 * - 文件：优先 LOG_PATH > LOG_DIR > APP_DATA_DIR，写入 langchain-serve.log（JSON）
 * - 环境变量 LOG_LEVEL：trace | debug | info | warn | error，默认 info
 */
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import pino from "pino";
import pinoPretty from "pino-pretty";

const level = (process.env.LOG_LEVEL as pino.Level) || "info";
const stdoutStream = pinoPretty({ colorize: true, translateTime: "SYS:standard" });

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

function buildStreams(): pino.StreamEntry[] {
  const streams: pino.StreamEntry[] = [{ level, stream: stdoutStream }];

  const filePath = getLogFilePath();
  if (filePath) {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    streams.push({ level, stream: pino.destination({ dest: filePath, append: true }) });
  }

  return streams;
}

const streams = buildStreams();

export const logger =
  streams.length === 1
    ? pino({ level }, streams[0].stream as pino.DestinationStream)
    : pino({ level }, pino.multistream(streams));

export default logger;

import path from "node:path";
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { PassThrough } from "node:stream";
import pino from "pino";
import pinoPretty from "pino-pretty";
import { isToolboxDevMode } from "../config/env";

const LOG_LEVEL = (process.env.LOG_LEVEL || "info") as string;

let didCleanupOldLogs = false;

/** 当前日志文件路径（未写文件时为空） */
export function getLogFilePath(): string {
  const logPath = process.env.LOG_PATH?.trim();
  if (logPath) return logPath;
  const logDir = process.env.LOG_DIR?.trim();
  if (logDir) return `${logDir.replace(/\/$/, "")}/langchain-serve.log`;
  const appDataDir = process.env.APP_DATA_DIR?.trim();
  if (appDataDir)
    return `${appDataDir.replace(/\/$/, "")}/langchain-serve.log`;
  return "";
}

function getLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(ymd: string): number | null {
  // ymd: YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [, ys, ms, ds] = m;
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const t = dt.getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * pino-pretty 常用选项（与 Fastify 文档示例一致）
 */
export const prettyOptions = {
  colorize: true,
  translateTime: "HH:MM:ss Z",
  ignore: "pid,hostname",
};

/**
 * 控制台是否使用 pino-pretty：
 * - TOOLBOX_ENV=development：开启
 * - 其余情况（含未设置）：关闭
 */
export function usePinoPretty(): boolean {
  return isToolboxDevMode();
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

/**
 * 清理旧日志文件
 */
export function cleanupOldDailyLogs(
  baseLogPath: string,
  keepDays: number
): void {
  if (didCleanupOldLogs) return;
  didCleanupOldLogs = true;

  const dir = path.dirname(baseLogPath);
  const ext = path.extname(baseLogPath); // ".log"
  const baseName = path.basename(baseLogPath, ext); // "langchain-serve"

  const threshold = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const name of entries) {
    if (!name.startsWith(`${baseName}-`) || !name.endsWith(ext)) continue;
    const ymd = name.slice(baseName.length + 1, name.length - ext.length);
    const t = parseYMD(ymd);
    if (t === null) continue;
    if (t < threshold) {
      const p = path.join(dir, name);
      try {
        rmSync(p, { force: true });
      } catch {
        // ignore
      }
    }
  }
}

/**
 * 获取每日日志文件路径（自动清理旧日志）
 */
export function getDailyLogFilePathWithCleanup(keepDays = 7): string {
  const base = getLogFilePath();
  if (!base) return "";

  cleanupOldDailyLogs(base, keepDays);

  const dir = path.dirname(base);
  const ext = path.extname(base); // ".log"
  const baseName = path.basename(base, ext); // "langchain-serve"
  const ymd = getLocalYMD(new Date());

  return path.join(dir, `${baseName}-${ymd}${ext}`);
}

/**
 * 构建 Fastify logger 配置。
 * 使用 pino-pretty stream（非 transport），避免 thread-stream 在 bundle 后查找 lib/worker.js 失败。
 */
export function buildLoggerConfig() {
  const level = LOG_LEVEL;

  // 开发模式：控制台 pretty + 仍然落盘（通过 tee 分流）。
  if (usePinoPretty()) {
    const dailyFilePath = getDailyLogFilePathWithCleanup(7);
    if (dailyFilePath) {
      const dir = path.dirname(dailyFilePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      // 触碰一次当天文件，便于尽早暴露权限/路径问题。
      try {
        appendFileSync(dailyFilePath, "");
      } catch (err) {
        console.warn("[logger] touch daily log file failed", {
          dailyFilePath,
          err,
        });
      }

      const tee = new PassThrough();

      // 1) 控制台 pretty
      tee.pipe(pinoPretty(prettyOptions));

      // 2) 原样 JSON Lines 落盘
      const fileStream = createWriteStream(dailyFilePath, { flags: "a" });
      fileStream.on("error", (err) => {
        console.warn("[logger] log file write failed", { dailyFilePath, err });
      });
      tee.pipe(fileStream);

      return {
        level,
        stream: tee,
        timestamp: pino.stdTimeFunctions.isoTime,
      };
    }

    return {
      level,
      stream: pinoPretty(prettyOptions),
      timestamp: pino.stdTimeFunctions.isoTime,
    };
  }

  // 生产模式：尽量落盘到 langchain-serve.log，否则退回仅控制台输出。
  const dailyFilePath = getDailyLogFilePathWithCleanup(7);
  if (dailyFilePath) {
    // 用 ISO 时间字符串替代默认 epoch 时间；避免你们再做换算。
    return {
      level,
      file: dailyFilePath,
      timestamp: pino.stdTimeFunctions.isoTime,
    };
  }

  return { level };
}

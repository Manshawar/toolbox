/**
 * core 单二进制方案：子包并入 bundle，子进程用同一可执行文件 + 参数
 * - 不传参：启动全部（spawn serve-api + serve-pty）
 * - 传 serve-api | serve-pty：只启动对应子进程
 * - 子进程通过 CORE_WORKER=1 识别，在当前进程执行 module.run()
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODES = ["serve-api", "serve-pty"] as const;
type Mode = (typeof MODES)[number];

const MODULE_LOADERS: Record<Mode, () => Promise<{ run: () => Promise<void> }>> = {
  "serve-api": () => import("langchain-serve"),
  "serve-pty": () => import("pty-host"),
};

/** 当前是否在 pkg 打包后的单文件可执行环境中 */
function isPkg(): boolean {
  return !!(process as NodeJS.Process & { pkg?: unknown }).pkg;
}

/** 启动一个子进程运行指定 mode（同一可执行文件 + 参数，子进程内执行 module.run()） */
function spawnWorker(mode: Mode): void {
  const exec = process.execPath;
  const args = isPkg() ? [mode] : [path.join(__dirname, "index.js"), mode];
  const child = spawn(exec, args, {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, CORE_WORKER: "1" },
  });
  child.on("error", (err) => console.error(`[core] ${mode} 子进程错误:`, err));
  child.on("exit", (code, signal) => {
    if (code != null && code !== 0) {
      console.error(`[core] ${mode} 子进程退出 code=${code} signal=${signal}`);
    }
  });
}

/** 子进程内执行：加载对应包并执行 run() */
async function runInThisProcess(mode: Mode): Promise<void> {
  const load = MODULE_LOADERS[mode];
  const mod = await load();
  if (typeof mod?.run !== "function") {
    console.error(`[core] ${mode} 未导出 run()`);
    process.exit(1);
  }
  await mod.run();
}

// ---------------------------------------------------------------------------
// 入口：CORE_WORKER=1 时为子进程（执行 module.run()），否则为 launcher（spawn）
// ---------------------------------------------------------------------------

const cmd = process.argv[2] as Mode | undefined;
const isWorker = process.env.CORE_WORKER === "1";

if (isWorker && (cmd === "serve-api" || cmd === "serve-pty")) {
  runInThisProcess(cmd).catch((err) => {
    console.error(`[core] ${cmd} 运行失败:`, err);
    process.exit(1);
  });
} else if (!cmd) {
  for (const mode of MODES) spawnWorker(mode);
} else if (cmd === "serve-api" || cmd === "serve-pty") {
  spawnWorker(cmd);
} else {
  console.error("用法: core [serve-api | serve-pty]\n不传参则启动 serve-api 与 serve-pty。");
  process.exit(1);
}

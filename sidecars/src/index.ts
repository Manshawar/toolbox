/**
 * Core launcher - 启动 langchain-serve 和 pty-host 两个子进程
 *
 * 原理：
 * - 开发模式：从 dist/langchain-serve.js 和 dist/pty-host.js spawn
 * - pkg 模式：从可执行文件同目录加载 langchain-serve.js 和 pty-host.js
 *
 * 这两个 js 文件由 tsup 从 app/langchain-serve/src/index.ts 和 app/pty-host/src/index.ts 打包生成
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const MODES = ["langchain-serve", "pty-host"];

/** 检测是否在 pkg 打包的环境中运行 */
function isPkg(): boolean {
  return (
    typeof __dirname === "string" &&
    (__dirname.includes("/snapshot/") || __dirname.includes("\\snapshot\\"))
  );
}

/** 获取子进程脚本路径
 * 说明：
 * - 我们希望 **在 pkg snapshot 里** 访问 worker js
 * - dev 模式：__dirname 就是 sidecars/dist
 * - pkg 模式：__dirname 变成 /snapshot/langchainApp/sidecars/dist
 *   => 通过 __dirname + `${mode}.js`，无论 dev 还是 pkg 都统一在 dist 目录找
 */
function getWorkerScriptPath(mode: string): string {
  return path.join(__dirname, `${mode}.js`);
}

/** spawn 一个工作子进程 */
function spawnWorker(mode: string) {
  const scriptPath = getWorkerScriptPath(mode);

  // 检查脚本是否存在
  if (!fs.existsSync(scriptPath)) {
    console.error(`[core] 错误：找不到 ${mode} 脚本: ${scriptPath}`);
    console.error(`[core] 请先运行 pnpm run sidecar:build 生成 dist/ 文件`);
    process.exit(1);
  }

  console.log(`[core] 正在启动 ${mode}...`);
  console.log(`[core]   脚本路径: ${scriptPath}`);

  const env = {
    ...process.env,
    ...(process.env.VITE_API_PORT != null && { VITE_API_PORT: process.env.VITE_API_PORT }),
    ...(process.env.VITE_PTY_PORT != null && { VITE_PTY_PORT: process.env.VITE_PTY_PORT }),
  };

  const child = spawn(process.execPath, [scriptPath], {
    stdio: "inherit",
    cwd: isPkg() ? path.dirname(process.execPath) : __dirname,
    env,
  });
  child.unref();
  child.on("error", (err: Error) => {
    console.error(`[core] ${mode} 子进程错误:`, err);
  });

  child.on("exit", (code: number | null, signal: string | null) => {
    if (code != null && code !== 0) {
      console.error(`[core] ${mode} 子进程异常退出 code=${code} signal=${signal}`);
    } else {
      console.log(`[core] ${mode} 子进程已退出`);
    }
  });

  return child;
}

/** 主函数 */
function main() {
  // 调试：打印打包后二进制中的 __dirname 信息，确认 snapshot 路径
  try {
    const entries = fs.readdirSync(__dirname);
    console.log("[core] __dirname =", __dirname);
    console.log("[core] __dirname 列表 =", entries);
  } catch (e) {
    console.log("[core] 读取 __dirname 失败:", e);
  }

  const cmd = process.argv[2];

  if (!cmd) {
    // 启动所有服务
    console.log("[core] === Core Launcher ===");
    console.log(`[core] 运行模式: ${isPkg() ? "pkg 二进制" : "Node.js 脚本"}`);
    console.log(`[core] 工作目录: ${isPkg() ? path.dirname(process.execPath) : __dirname}`);
    console.log("[core] 正在启动 langchain-serve 与 pty-host...");

    for (const mode of MODES) {
      spawnWorker(mode);
    }

    console.log("[core] 所有服务已启动");
  } else if (MODES.includes(cmd)) {
    // 启动单个服务
    console.log(`[core] 正在启动单个服务: ${cmd}`);
    spawnWorker(cmd);
  } else {
    console.error(`[core] 未知命令: ${cmd}`);
    console.error(`[core] 用法: core [${MODES.join(" | ")}]`);
    console.error("[core] 不传参则启动所有服务");
    process.exit(1);
  }
}

main();

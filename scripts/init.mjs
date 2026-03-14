#!/usr/bin/env node

/**
 * 初始化 Node 侧车二进制（供 Tauri app.shell().sidecar("toolbox_node") 使用）
 *
 * - 从阿里云镜像下载 Node 24，解压后在目录中查找 node 可执行文件
 * - 按 Tauri 命名写入 src-tauri/binaries/toolbox_node-<target-triple>[.exe]（进程名显示为 toolbox_node）
 * - 缓存：scripts/version/（git 忽略），有 version 且包存在则跳过下载
 *
 * 用法：
 *   node scripts/init.mjs
 *   NODE_RUNTIME_TARGET=x86_64-unknown-linux-gnu node scripts/init.mjs
 *   node scripts/init.mjs --target=x86_64-unknown-linux-gnu
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFile, execSync } from "child_process";
import { promisify } from "util";
import unzipper from "unzipper";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const NODE_VERSION = process.env.NODE_RUNTIME_VERSION || "24.1.0";
const CONFIG = {
  cacheDir: path.join(ROOT_DIR, "scripts", "version"),
  binariesDir: path.join(ROOT_DIR, "src-tauri", "binaries"),
  nodeVersion: NODE_VERSION,
  baseUrl: `https://mirrors.aliyun.com/nodejs-release/v${NODE_VERSION}`,
};

/** Rust target → Node 发行版平台 id（用于下载文件名） */
const RUST_TARGET_TO_NODE_PLATFORM = {
  "aarch64-apple-darwin": "darwin-arm64",
  "x86_64-apple-darwin": "darwin-x64",
  "x86_64-pc-windows-msvc": "win-x64",
  "aarch64-pc-windows-msvc": "win-arm64",
  "x86_64-unknown-linux-gnu": "linux-x64",
  "aarch64-unknown-linux-gnu": "linux-arm64",
};

// ---------------------------------------------------------------------------
// 平台与 target
// ---------------------------------------------------------------------------

function getCliTarget() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--target="));
  return arg ? arg.split("=")[1] : undefined;
}

/** 解析当前需要下载的 Node 平台 id（darwin-arm64 / win-x64 / linux-x64 等） */
function resolveNodePlatformId() {
  const target = getCliTarget() || process.env.NODE_RUNTIME_TARGET || process.env.SIDECAR_TARGET || "";
  if (target && RUST_TARGET_TO_NODE_PLATFORM[target]) {
    return RUST_TARGET_TO_NODE_PLATFORM[target];
  }
  const { platform, arch } = process;
  const map = [
    ["darwin", "arm64", "darwin-arm64"],
    ["darwin", "x64", "darwin-x64"],
    ["linux", "x64", "linux-x64"],
    ["linux", "arm64", "linux-arm64"],
    ["win32", "x64", "win-x64"],
    ["win32", "arm64", "win-arm64"],
  ];
  const entry = map.find(([p, a]) => p === platform && a === arch);
  if (!entry) throw new Error(`不支持的平台: ${platform}/${arch}`);
  return entry[2];
}

/** 从 rustc -vV 解析 host 目标三元组（用于侧车文件名） */
function getRustTargetTriple() {
  const out = execSync("rustc -vV", { encoding: "utf8" });
  const m = /host:\s*(\S+)/.exec(out);
  if (!m?.[1]) throw new Error("[init] 无法从 rustc -vV 解析 host 目标三元组");
  return m[1];
}

// ---------------------------------------------------------------------------
// 下载与解压
// ---------------------------------------------------------------------------

function getArchiveFilename(platformId) {
  const ext = platformId.startsWith("win-") ? ".zip" : ".tar.xz";
  return `node-v${CONFIG.nodeVersion}-${platformId}${ext}`;
}

async function downloadWithProgress(url, destPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`[init] 下载失败: ${res.status} ${res.statusText} ${url}`);
  }
  const total = Number(res.headers.get("content-length") || 0);
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

  const file = fs.createWriteStream(destPath);
  const reader = res.body.getReader();
  let received = 0;
  const fmt = (n) => (n / 1024 / 1024).toFixed(1);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      file.write(value);
      received += value.length;
      const pct = total ? Math.min(100, (received / total) * 100) : 0;
      process.stdout.write(`\r[init] 下载 ${fmt(received)}${total ? ` / ${fmt(total)} MB (${pct.toFixed(0)}%)` : " MB"}`);
    }
  }
  await new Promise((resolve, reject) => {
    file.on("finish", resolve);
    file.on("error", reject);
    file.end();
  });
  process.stdout.write("\n");
}

async function extractArchive(archivePath, destDir, isZip) {
  await fs.promises.mkdir(destDir, { recursive: true });
  if (isZip) {
    const dir = await unzipper.Open.file(archivePath);
    await dir.extract({ path: destDir });
  } else {
    await execFileAsync("tar", ["-xJf", archivePath, "-C", destDir]);
  }
}

/** 解压后 node 可执行文件路径（各平台目录结构不同：Windows 根目录 node.exe，Unix 在 bin/node） */
function getNodeExecutablePathInExtractedDir(nodeDir, isWindows) {
  return isWindows ? path.join(nodeDir, "node.exe") : path.join(nodeDir, "bin", "node");
}

/** 在解压根目录下查找唯一的 node-v* 目录 */
function findNodeVersionDir(tmpRoot) {
  const entries = fs.readdirSync(tmpRoot, { withFileTypes: true });
  const dir = entries.find((e) => e.isDirectory() && e.name.startsWith("node-v"));
  if (!dir) throw new Error(`[init] 解压后未找到 node-v* 目录: ${tmpRoot}`);
  return path.join(tmpRoot, dir.name);
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const platformId = resolveNodePlatformId();
  const isWin = platformId.startsWith("win-");
  const versionFile = path.join(CONFIG.cacheDir, "version");
  const filename = getArchiveFilename(platformId);
  const archivePath = path.join(CONFIG.cacheDir, filename);

  console.log(`[init] Node ${CONFIG.nodeVersion}，平台 ${platformId}`);

  // 1. 按需下载
  const versionOk = fs.existsSync(versionFile) && (await fs.promises.readFile(versionFile, "utf8")).trim() === CONFIG.nodeVersion;
  const archiveExists = fs.existsSync(archivePath);
  if (!versionOk || !archiveExists) {
    await fs.promises.mkdir(CONFIG.cacheDir, { recursive: true });
    const url = `${CONFIG.baseUrl}/${filename}`;
    console.log(`[init] 下载: ${url}`);
    await downloadWithProgress(url, archivePath);
    await fs.promises.writeFile(versionFile, CONFIG.nodeVersion, "utf8");
  } else {
    console.log(`[init] 缓存有效，跳过下载`);
  }

  // 2. 解压到临时目录
  const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "node-runtime-"));
  try {
    await extractArchive(archivePath, tmpRoot, isWin);
    const nodeDir = findNodeVersionDir(tmpRoot);
    const nodeExePath = getNodeExecutablePathInExtractedDir(nodeDir, isWin);
    if (!fs.existsSync(nodeExePath)) {
      throw new Error(`[init] 解压目录中未找到 node: ${nodeExePath}`);
    }

    // 3. 写入侧车二进制 toolbox_node-<target-triple>[.exe]
    const targetTriple = getRustTargetTriple();
    const sidecarName = `toolbox_node-${targetTriple}${isWin ? ".exe" : ""}`;
    const sidecarPath = path.join(CONFIG.binariesDir, sidecarName);
    await fs.promises.mkdir(CONFIG.binariesDir, { recursive: true });
    await fs.promises.copyFile(nodeExePath, sidecarPath);
    console.log(`[init] 已写入侧车: ${sidecarPath}`);

    // 4. Windows：用 rcedit 改 exe 显示名与图标
    //    - 显示名：任务管理器读 FileDescription，否则会显示「Node.js JavaScript Runtime」
    //    - 图标：使用 src-tauri/icons/toolbox_node.ico（若无则用 icon.ico），任务栏/资源管理器中显示
    //    macOS/Linux：进程名由可执行文件名 toolbox_node-<target> 决定，无需处理
    if (isWin) {
      try {
        const { rcedit } = await import("rcedit");
        const iconsDir = path.join(ROOT_DIR, "src-tauri", "icons");
        const iconPath =
          fs.existsSync(path.join(iconsDir, "toolbox_node.ico"))
            ? path.join(iconsDir, "toolbox_node.ico")
            : fs.existsSync(path.join(iconsDir, "icon.ico"))
              ? path.join(iconsDir, "icon.ico")
              : null;
        const opts = {
          "version-string": {
            FileDescription: "Toolbox Node",
            ProductName: "Toolbox Node",
          },
        };
        if (iconPath) opts.icon = iconPath;
        await rcedit(sidecarPath, opts);
        console.log(`[init] 已设置 exe 显示名: Toolbox Node` + (iconPath ? `，图标: ${path.basename(iconPath)}` : ""));
      } catch (e) {
        console.warn("[init] 修改 exe 版本信息失败（任务管理器仍会显示 Node.js），可忽略:", e.message);
      }
    }

    console.log(`[init] 完成 | 侧车: ${sidecarName}`);
  } finally {
    await fs.promises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((err) => {
  console.error("[init] 失败:", err);
  process.exitCode = 1;
});

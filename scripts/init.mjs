#!/usr/bin/env node

/**
 * 初始化内置 Node Runtime：
 * - 从 https://nodejs.org/download/release/latest-v24.x/ 拉取对应平台的 Node 压缩包
 * - 解压到 src-tauri/help/nodeRuntime（包含 bin/node 与 npm）
 *
 * 使用方式：
 * - 当前平台：        ./scripts/init
 * - 指定分发 target： NODE_RUNTIME_TARGET=x86_64-unknown-linux-gnu ./scripts/init
 *   或：             ./scripts/init --target=x86_64-unknown-linux-gnu
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT_DIR, "src-tauri", "help", "nodeRuntime");
const NODE_BASE_URL = "https://nodejs.org/download/release/latest-v24.x";
const META_FILE = path.join(TARGET_DIR, ".runtime.json");

const RUST_TARGET_MAP = {
  "aarch64-apple-darwin": "darwin-arm64",
  "x86_64-apple-darwin": "darwin-x64",
  "x86_64-pc-windows-msvc": "win-x64",
  "aarch64-pc-windows-msvc": "win-arm64",
  "x86_64-unknown-linux-gnu": "linux-x64",
  "aarch64-unknown-linux-gnu": "linux-arm64",
};

function parseCliTarget() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--target="));
  return arg ? arg.split("=")[1] : undefined;
}

function resolveNodePlatformId() {
  const target =
    parseCliTarget() ||
    process.env.NODE_RUNTIME_TARGET ||
    process.env.SIDECAR_TARGET ||
    "";

  if (target && RUST_TARGET_MAP[target]) {
    return RUST_TARGET_MAP[target];
  }

  // 当前构建机平台
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  if (platform === "linux" && arch === "x64") return "linux-x64";
  if (platform === "linux" && arch === "arm64") return "linux-arm64";
  if (platform === "win32" && arch === "x64") return "win-x64";
  if (platform === "win32" && arch === "arm64") return "win-arm64";

  throw new Error(`不支持的平台: platform=${platform}, arch=${arch}`);
}

async function pickNodeFilename(platformId) {
  const shasumUrl = `${NODE_BASE_URL}/SHASUMS256.txt`;
  console.log(`[init] 获取 Node 清单: ${shasumUrl}`);

  const res = await fetch(shasumUrl);
  if (!res.ok) {
    throw new Error(`[init] 获取 SHASUMS256.txt 失败: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();

  const isWin = platformId.startsWith("win-");
  const ext = isWin ? ".zip" : ".tar.xz";
  const pattern = `${platformId}${ext}`;

  const line = text.split("\n").find((l) => l.includes(pattern));
  if (!line) {
    throw new Error(`[init] 未在 SHASUMS256.txt 中找到匹配平台的文件: ${platformId} (${ext})`);
  }

  const parts = line.trim().split(/\s+/);
  const filename = parts[1];
  if (!filename) {
    throw new Error(`[init] 解析文件名失败: ${line}`);
  }

  return { filename, isWin };
}

async function downloadFile(url, destPath) {
  console.log(`[init] 下载 Node: ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`[init] 下载失败: ${res.status} ${res.statusText}`);
  }

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });

  const fileStream = fs.createWriteStream(destPath);
  const reader = res.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) fileStream.write(value);
  }

  await new Promise((resolve, reject) => {
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
    fileStream.end();
  });

  console.log(`[init] 已下载到: ${destPath}`);
}

async function extractArchive(archivePath, destDir, isZip) {
  await fs.promises.mkdir(destDir, { recursive: true });

  if (isZip) {
    console.log(`[init] 解压 zip 到临时目录: ${destDir}`);
    await execFileAsync("unzip", ["-q", archivePath, "-d", destDir]);
  } else {
    console.log(`[init] 解压 tar.xz 到临时目录: ${destDir}`);
    await execFileAsync("tar", ["-xJf", archivePath, "-C", destDir]);
  }
}

async function main() {
  const platformId = resolveNodePlatformId();
  console.log(`[init] 目标平台: ${platformId}`);

  // 如果已有当前平台的 runtime，且元数据匹配，则跳过下载
  try {
    const existing = await fs.promises.readFile(META_FILE, "utf8");
    const meta = JSON.parse(existing);
    if (meta.platformId === platformId && meta.baseUrl === NODE_BASE_URL) {
      const nodePath = path.join(
        TARGET_DIR,
        "bin",
        process.platform === "win32" ? "node.exe" : "node"
      );
      if (fs.existsSync(nodePath)) {
        console.log(`[init] 已存在当前平台的 Node Runtime，跳过下载: ${nodePath}`);
        return;
      }
    }
  } catch {
    // ignore
  }

  const { filename, isWin } = await pickNodeFilename(platformId);
  const downloadUrl = `${NODE_BASE_URL}/${filename}`;

  const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "node-runtime-"));
  const archivePath = path.join(tmpRoot, filename);

  await downloadFile(downloadUrl, archivePath);
  await extractArchive(archivePath, tmpRoot, isWin);

  const entries = await fs.promises.readdir(tmpRoot, { withFileTypes: true });
  const nodeDirEntry =
    entries.find((e) => e.isDirectory() && e.name.startsWith("node-v")) ?? null;
  if (!nodeDirEntry) {
    throw new Error(`[init] 解压后未找到 node-v* 目录: ${tmpRoot}`);
  }

  const nodeDir = path.join(tmpRoot, nodeDirEntry.name);

  console.log(`[init] 拷贝 Node Runtime 到: ${TARGET_DIR}`);
  await fs.promises.rm(TARGET_DIR, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(TARGET_DIR), { recursive: true });
  // Node 18+ 支持 fs.cp
  await fs.promises.cp(nodeDir, TARGET_DIR, { recursive: true });

  await fs.promises.mkdir(TARGET_DIR, { recursive: true });
  await fs.promises.writeFile(
    META_FILE,
    JSON.stringify({ platformId, baseUrl: NODE_BASE_URL }, null, 2),
    "utf8"
  );

  console.log("[init] 完成，目录结构示例：");
  console.log(`- ${TARGET_DIR}/bin/node`);
  console.log(`- ${TARGET_DIR}/lib/node_modules/npm/...`);
}

main().catch((err) => {
  console.error("[init] 失败:", err);
  process.exitCode = 1;
});


/**
 * core 构建配置。
 * watch 时需在脚本里显式传子包路径，否则 tsup 不会监听 node_modules 内 symlink 的变更：

 */
import { defineConfig } from "tsup";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @yao-pkg/pkg 的 target 格式: node<version>-<os>-<arch>
// 注意：@yao-pkg/pkg 支持 Node 18, 20, 22 等版本，建议根据你的需求选择
const TARGET_MAP: Record<string, string> = {
  "aarch64-apple-darwin": "node20-macos-arm64", // 升级到 Node 20
  "x86_64-apple-darwin": "node20-macos-x64",
  "x86_64-pc-windows-msvc": "node20-win-x64",
  "x86_64-unknown-linux-gnu": "node20-linux-x64",
  "aarch64-unknown-linux-gnu": "node20-linux-arm64", // 新增 Linux ARM64 支持
};

/** 使用 @yao-pkg/pkg 将 bundle 打成单文件二进制 */
function pkgToBinaries() {
  // 检查 @yao-pkg/pkg 是否已安装
  try {
    execSync("pnpm list @yao-pkg/pkg", { cwd: __dirname, stdio: "pipe" });
  } catch {
    console.error("[core] @yao-pkg/pkg 未安装，请先安装: pnpm add -D @yao-pkg/pkg");
    process.exit(1);
  }

  const targetTriple =
    process.env.SIDECAR_TARGET ?? execSync("rustc --print host-tuple").toString().trim();

  if (!targetTriple) {
    console.warn("[core] 无法确定目标平台，跳过打包");
    return;
  }

  const pkgTarget = TARGET_MAP[targetTriple];
  if (!pkgTarget) {
    console.warn(`[core] 不支持的 target: ${targetTriple}，跳过 pkg 打包`);
    console.warn("[core] 支持的 targets:", Object.keys(TARGET_MAP).join(", "));
    return;
  }

  const ext = targetTriple.includes("windows") ? ".exe" : "";
  const binariesDir = path.join(__dirname, "..", "..", "src-tauri", "binaries");
  const bundlePath = path.join(__dirname, "dist", "index.js");
  const outputPath = path.join(binariesDir, `core-${targetTriple}${ext}`);

  if (!fs.existsSync(bundlePath)) {
    console.error(`[core] bundle 文件不存在: ${bundlePath}`);
    return;
  }

  // 确保输出目录存在
  fs.mkdirSync(binariesDir, { recursive: true });

  // 如果已存在旧二进制，先删除（避免 Windows 下的文件占用问题）
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
    console.log(`[core] 已删除旧二进制: ${outputPath}`);
  }

  try {
    // 使用 @yao-pkg/pkg 打包
    // 注意：@yao-pkg/pkg 的 CLI 命令仍然是 pkg
    execSync(
      `pnpm exec pkg "${bundlePath}" --target ${pkgTarget} --output "${outputPath}" --compress GZip`,
      {
        stdio: "inherit",
        cwd: __dirname,
        env: {
          ...process.env,
          // 确保使用 production 模式
          NODE_ENV: "production",
        },
      }
    );
    console.log(`[core] 二进制打包成功: ${outputPath}`);

    // 显示文件大小
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`[core] 文件大小: ${sizeMB} MB`);
  } catch (error) {
    console.error("[core] 打包失败:", error);
    process.exit(1);
  }
}

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm"],
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: true,
  platform: "node",
  target: "node20", // 与 pkg target 保持一致
  treeshake: true,
  external: ["node-pty"], // node-pty 是原生模块，需要 external
  noExternal: ["langchain-serve", "pty-host"],
  esbuildOptions(options) {
    // 确保 ESM 正确输出
    options.banner = {
      js: "#!/usr/bin/env node",
    };
  },
  onSuccess: async () => {
    // 延迟执行确保文件写入完成
    await new Promise((resolve) => setTimeout(resolve, 100));
    pkgToBinaries();
  },
});

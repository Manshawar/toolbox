/**
 * Sidecar 构建：仅依赖 tsup。
 * 执行 tsup 会：
 * 1. 打包 langchain-serve + pty-host 到 dist/
 * 2. 注入 launcher (build/index.js) 为 dist/index.js
 * 3. 调用 pkg 生成 src-tauri/binaries/core-<target>
 */
import { defineConfig } from "tsup";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @yao-pkg/pkg 的 target 格式: node<version>-<os>-<arch>
// 与本地开发 Node 版本一致，使用 Node 24
const TARGET_MAP: Record<string, string> = {
  "aarch64-apple-darwin": "node24-macos-arm64",
  "x86_64-apple-darwin": "node24-macos-x64",
  "x86_64-pc-windows-msvc": "node24-win-x64",
  "x86_64-unknown-linux-gnu": "node24-linux-x64",
  "aarch64-unknown-linux-gnu": "node24-linux-arm64",
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
  const binariesDir = path.join(__dirname, "..", "src-tauri", "binaries");
  const distDir = path.join(__dirname, "dist");
  const bundlePath = path.join(distDir, "index.js");
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

  const pkgConfigPath = path.join(__dirname, "package.json");

  try {
    // 使用 @yao-pkg/pkg 打包；--config 将 node-pty、ws 等 external 依赖打进快照，避免运行时 UNEXPECTED-20
    execSync(
      `pnpm exec pkg "${bundlePath}" --config "${pkgConfigPath}" --target ${pkgTarget} --output "${outputPath}" --compress GZip`,
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

    // 将两个服务 js 复制到 binaries，与 exe 同目录，launcher 按路径 spawn 时能找到
    // for (const name of ["langchain-serve.js", "pty-host.js", "langchain-serve.js.map", "pty-host.js.map"]) {
    //   const src = path.join(distDir, name);
    //   const dest = path.join(binariesDir, name);
    //   if (fs.existsSync(src)) {
    //     fs.copyFileSync(src, dest);
    //     console.log(`[core] 已复制 ${name} -> binaries/`);
    //   }
    // }
  } catch (error) {
    console.error("[core] 打包失败:", error);
    process.exit(1);
  }
}

/** 将 launcher 脚本（build/index.js）以写入文本形式塞入 dist，作为入口；不经过 tsup 打包 */
function injectLauncher() {
  const launcherPath = path.join(__dirname, "build", "index.js");
  const distPath = path.join(__dirname, "dist", "index.js");
  if (!fs.existsSync(launcherPath)) {
    console.error("[core] launcher 不存在: " + launcherPath);
    process.exit(1);
  }
  const content = "#!/usr/bin/env node\n" + fs.readFileSync(launcherPath, "utf8");
  fs.mkdirSync(path.dirname(distPath), { recursive: true });
  fs.writeFileSync(distPath, content, "utf8");
  console.log("[core] 已写入 dist/index.js (launcher)");
}

export default defineConfig({
  entry: {
    "langchain-serve": "app/langchain-serve/src/index.ts",
    "pty-host": "app/pty-host/src/index.ts",
  },
  outDir: "dist",
  format: ["cjs"],
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: true,
  platform: "node",
  target: "node24",
  treeshake: true,
  external: ["node-pty", "ws", "sql.js"],
  esbuildOptions(options) {
    options.banner = {
      js: "#!/usr/bin/env node",
    };
  },
  onSuccess: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    injectLauncher();
    pkgToBinaries();
  },
});

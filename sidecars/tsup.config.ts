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

const RESOURCES_CORE = path.join(__dirname, "..", "src-tauri", "resources", "core");

/** 将 launcher 脚本（build/index.js）写入 resources/core，作为入口 */
function injectLauncher() {
  const launcherPath = path.join(__dirname, "build", "index.js");
  const distPath = path.join(RESOURCES_CORE, "index.js");
  if (!fs.existsSync(launcherPath)) {
    console.error("[core] launcher 不存在: " + launcherPath);
    process.exit(1);
  }
  const content = "#!/usr/bin/env node\n" + fs.readFileSync(launcherPath, "utf8");
  fs.mkdirSync(RESOURCES_CORE, { recursive: true });
  fs.writeFileSync(distPath, content, "utf8");
  console.log("[core] 已写入 resources/core/index.js (launcher)");
}

/** 仅安装必须随包分发的原生依赖（better-sqlite3、node-pty），其余已由 tsup 打进 bundle */
const CORE_NATIVE_DEPS: Record<string, string> = {
  "better-sqlite3": "^12.6.2",
  "node-pty": "^1.0.0",
};

function installCoreNodeModules() {
  const pkgDest = path.join(RESOURCES_CORE, "package.json");
  const minimalPkg = {
    name: "core",
    version: "1.0.0",
    private: true,
    dependencies: CORE_NATIVE_DEPS,
  };
  fs.writeFileSync(pkgDest, JSON.stringify(minimalPkg, null, 2), "utf8");
  console.log("[core] 已写入 resources/core/package.json（仅原生依赖）");
  try {
    execSync("npm install --omit=dev --ignore-scripts --legacy-peer-deps", {
      cwd: RESOURCES_CORE,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
    console.log("[core] 已安装 resources/core/node_modules");
    pruneCoreNodeModules();
  } catch (e) {
    console.warn("[core] resources/core 下 npm install 失败，请在该目录手动执行: npm install --omit=dev --legacy-peer-deps", e);
  }
}

/** 裁剪 node_modules：只保留当前平台 node-pty prebuild（约省 45MB），并删除文档文件 */
function pruneCoreNodeModules() {
  const nm = path.join(RESOURCES_CORE, "node_modules");
  if (!fs.existsSync(nm)) return;

  const platform = process.platform;
  const arch = process.arch;
  const keepPrebuild = `${platform}-${arch === "x64" ? "x64" : arch === "arm64" ? "arm64" : arch}`;

  const ptyPrebuilds = path.join(nm, "node-pty", "prebuilds");
  if (fs.existsSync(ptyPrebuilds)) {
    const dirs = fs.readdirSync(ptyPrebuilds, { withFileTypes: true }).filter((d: fs.Dirent) => d.isDirectory());
    for (const d of dirs) {
      if (d.name !== keepPrebuild) {
        const full = path.join(ptyPrebuilds, d.name);
        fs.rmSync(full, { recursive: true });
        console.log("[core] 已删除 node-pty/prebuilds/" + d.name + "（非本机平台）");
      }
    }
  }

  function rmDocFiles(dir: string, depth: number) {
    if (depth > 6) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) rmDocFiles(full, depth + 1);
      else if (/\.(md|markdown)$/i.test(e.name) || /^(README|CHANGELOG|LICENSE|HISTORY)(\.(md|txt))?$/i.test(e.name))
        try {
          fs.unlinkSync(full);
        } catch {}
    }
  }
  rmDocFiles(nm, 0);

  try {
    const out = execSync(`du -sm "${nm}"`, { encoding: "utf8", cwd: RESOURCES_CORE });
    const sizeMB = out.split(/\s/)[0] ?? "?";
    console.log("[core] 裁剪后 node_modules 约 " + sizeMB + " MB");
  } catch {}
}

export default defineConfig({
  entry: {
    "langchain-serve": "app/langchain-serve/src/index.ts",
    "pty-host": "app/pty-host/src/index.ts",
  },
  outDir: "../src-tauri/resources/core",
  format: ["cjs"],
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: true,
  platform: "node",
  target: "node24",
  treeshake: true,
  noExternal: [
    'hono',
    'fs-extra',
    '@langchain/core', // 甚至是复杂的 langchain
    'zod',
    'dotenv',
    "@hono/node-server",
    "@hono/swagger-ui",
    "pino",
    "pino-pretty"
  ],
  // 仅保留无法打包的原生模块在 node_modules，其余打进 bundle
  external: ["better-sqlite3", "node-pty"],
  esbuildOptions(options, context) {
    // 从 sidecars 目录解析 node_modules，保证 monorepo 下能找到依赖
    options.absWorkingDir = __dirname;
    options.banner = {
      js: "#!/usr/bin/env node",
    };
  },
  onSuccess: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    injectLauncher();
    installCoreNodeModules();
    // pkgToBinaries();
  },
});

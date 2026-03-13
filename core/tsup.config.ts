/**
 * Core 侧车构建：仅依赖 tsup。
 * 1. 打包 langchain-serve + pty-host 到 src-tauri/resources/core/
 * 2. 注入 launcher (build/index.js) 为 resources/core/index.js
 * 3. 安装不可打包的原生依赖到 resources/core/node_modules
 * 启动由 Tauri 用内置 Node (help/nodeRuntime) 执行 index.js，不再使用 pkg 二进制。
 */
import { defineConfig } from "tsup";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

/** 必须随包分发的依赖：better-sqlite3（含 .node 原生）、node-pty、ws（pty-host 用，未打进 bundle） */
const CORE_NATIVE_DEPS: Record<string, string> = {
  "better-sqlite3": "^12.6.2",
  "node-pty": "^1.0.0",
  "ws": "^8.18.0",
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
    // 不加 --ignore-scripts，让 better-sqlite3 的 postinstall 执行，生成 build/*.node 原生二进制
    execSync("npm install --omit=dev --legacy-peer-deps", {
      cwd: RESOURCES_CORE,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });
    console.log("[core] 已安装 resources/core/node_modules（含 better-sqlite3 .node）");
    pruneCoreNodeModules();
  } catch (e) {
    console.warn("[core] resources/core 下 npm install 失败，请在该目录手动执行: npm install --omit=dev --legacy-peer-deps", e);
  }
}

/** 裁剪 node_modules：只保留当前平台 node-pty prebuild（约省 45MB），并删除文档文件 */
function pruneCoreNodeModules() {
  const nm = path.join(RESOURCES_CORE, "node_modules");
  if (!fs.existsSync(nm)) return;

  // 删除 .bin（npm 的符号链接），避免 Tauri 打包时报 "resource path .bin/semver doesn't exist"；运行时只需 require()，不需要 CLI
  const binDir = path.join(nm, ".bin");
  if (fs.existsSync(binDir)) {
    fs.rmSync(binDir, { recursive: true });
    console.log("[core] 已删除 node_modules/.bin（避免 Tauri 打包报错）");
  }

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
  },
});

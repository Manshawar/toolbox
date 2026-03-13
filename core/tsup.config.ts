/**
 * Core 构建：仅依赖 tsup。
 * 1. 直接将根目录下的 index.ts 打包为 src-tauri/resources/core/index.js
 * 2. 安装不可打包的原生依赖到 src-tauri/resources/core/node_modules
 * 由 Tauri 使用内置 Node (help/nodeRuntime) 执行 resources/core/index.js 作为唯一入口。
 */
import { defineConfig } from "tsup";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RESOURCES_CORE = path.join(__dirname, "..", "src-tauri", "resources", "core");

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

/** 解析要保留的 node-pty prebuild 目录名：优先环境变量，未指定则用本机 platform-arch */
function getKeepPrebuild(): string {
  if (process.env.CORE_PTY_PREBUILD) return process.env.CORE_PTY_PREBUILD;
  const t = process.env.SIDECAR_TARGET;
  if (t) {
    const map: Record<string, string> = {
      "aarch64-apple-darwin": "darwin-arm64",
      "x86_64-apple-darwin": "darwin-x64",
      "x86_64-pc-windows-msvc": "win32-x64",
      "aarch64-pc-windows-msvc": "win32-arm64",
      "x86_64-unknown-linux-gnu": "linux-x64",
      "aarch64-unknown-linux-gnu": "linux-arm64",
    };
    if (map[t]) return map[t];
  }
  const platform = process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : process.arch;
  return `${platform}-${arch}`;
}

/** 裁剪 node_modules：.bin 必删；node-pty 只保留 getKeepPrebuild() 对应平台（指定则用指定，否则本机） */
function pruneCoreNodeModules() {
  const nm = path.join(RESOURCES_CORE, "node_modules");
  if (!fs.existsSync(nm)) return;

  const binDir = path.join(nm, ".bin");
  if (fs.existsSync(binDir)) {
    fs.rmSync(binDir, { recursive: true });
    console.log("[core] 已删除 node_modules/.bin（避免 Tauri 打包报错）");
  }

  const keepPrebuild = getKeepPrebuild();
  const ptyPrebuilds = path.join(nm, "node-pty", "prebuilds");
  if (fs.existsSync(ptyPrebuilds)) {
    const dirs = fs.readdirSync(ptyPrebuilds, { withFileTypes: true }).filter((d: fs.Dirent) => d.isDirectory());
    for (const d of dirs) {
      if (d.name !== keepPrebuild) {
        const full = path.join(ptyPrebuilds, d.name);
        fs.rmSync(full, { recursive: true });
        console.log("[core] 已删除 node-pty/prebuilds/" + d.name + "（非本机/指定平台）");
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
  entry: ["index.ts"],
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
    // 从 core 目录解析 node_modules，保证 monorepo 下能找到依赖
    options.absWorkingDir = __dirname;
    options.banner = {
      js: "#!/usr/bin/env node",
    };
  },
  onSuccess: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    installCoreNodeModules();
  },
});

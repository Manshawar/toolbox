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

/** 递归计算目录大小（字节），跨平台替代 du */
function getDirSizeBytes(dir: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) total += getDirSizeBytes(full);
      else total += fs.statSync(full).size;
    }
  } catch {
    console.error(`[core] 计算目录大小失败: ${dir}`);
  }
  return total;
}

const RESOURCES_CORE = path.join(__dirname, "..", "src-tauri", "resources", "core");

/** 构建侧车时的运行模式（由 scripts/env 或交互方式提供） */
const TOOLBOX_ENV = (process.env.TOOLBOX_ENV || "").toLowerCase();
const IS_DEV_MODE = TOOLBOX_ENV === "development";

/** 必须随包分发的依赖：原生依赖 +（开发模式才需要的）swagger 相关依赖 */
const CORE_NATIVE_DEPS: Record<string, string> = {
  "better-sqlite3": "^12.6.2",
  ...(IS_DEV_MODE
    ? {
        "@fastify/swagger": "^9.7.0",
        "@fastify/swagger-ui": "^5.2.5",
      }
    : {}),
};

/** 当前要生成的 package.json 内容（用于与已有文件对比） */
function getMinimalPkg() {
  return {
    name: "core",
    version: "1.0.0",
    private: true,
    dependencies: { ...CORE_NATIVE_DEPS },
  };
}

/**
 * 验证 src-tauri/resources/core/package.json 的依赖是否与当前 CORE_NATIVE_DEPS 一致。
 * 一致则视为依赖未发生变化，可复用已有 node_modules。
 */
function dependenciesUnchanged(pkgPath: string): boolean {
  try {
    const raw = fs.readFileSync(pkgPath, "utf8");
    const existing = JSON.parse(raw) as Record<string, unknown>;
    const minimal = getMinimalPkg() as Record<string, unknown>;
    if (existing.name !== minimal.name || existing.version !== minimal.version || existing.private !== minimal.private) {
      return false;
    }
    const a = existing.dependencies as Record<string, string> | undefined;
    const b = minimal.dependencies as Record<string, string>;
    if (!a || Object.keys(a).length !== Object.keys(b).length) return false;
    for (const k of Object.keys(b)) {
      if (a[k] !== b[k]) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function installCoreNodeModules() {
  const pkgPath = path.join(RESOURCES_CORE, "package.json");
  const nodeModulesDir = path.join(RESOURCES_CORE, "node_modules");
  const minimalPkg = getMinimalPkg();

  // 在 src-tauri/resources/core 下做两重验证：① 依赖是否发生变化  ② node_modules 是否存在
  const depsUnchanged = fs.existsSync(pkgPath) && dependenciesUnchanged(pkgPath);
  const nodeModulesExists = fs.existsSync(nodeModulesDir);
  if (depsUnchanged && nodeModulesExists) {
    console.log("[core] 提示：resources/core 依赖未变化且 node_modules 已存在，跳过 npm install");
    pruneCoreNodeModules();
    return;
  }

  fs.writeFileSync(pkgPath, JSON.stringify(minimalPkg, null, 2), "utf8");
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

/** 裁剪 node_modules：.bin 必删（避免 Tauri 打包报错） */
function pruneCoreNodeModules() {
  const nm = path.join(RESOURCES_CORE, "node_modules");
  if (!fs.existsSync(nm)) return;

  const binDir = path.join(nm, ".bin");
  if (fs.existsSync(binDir)) {
    fs.rmSync(binDir, { recursive: true });
    console.log("[core] 已删除 node_modules/.bin（避免 Tauri 打包报错）");
  }

  // 暂时禁用 node-pty：从资源侧彻底移除（避免体积/原生依赖带来的兼容风险）。
  const ptyDir = path.join(nm, "node-pty");
  if (fs.existsSync(ptyDir)) {
    fs.rmSync(ptyDir, { recursive: true, force: true });
    console.log("[core] 已删除 node-pty（暂时不启用）");
  }

  // 非开发模式不需要 swagger 文档：删除以减少资源体积，并且配合动态 import 避免生产启动时加载依赖。
  if (!IS_DEV_MODE) {
    const swaggerDir = path.join(nm, "@fastify", "swagger");
    const swaggerUiDir = path.join(nm, "@fastify", "swagger-ui");
    for (const dir of [swaggerDir, swaggerUiDir]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log("[core] 已删除 swagger 相关依赖: " + dir);
      }
    }
  }

  function rmUnnecessaryFiles(dir: string, depth: number) {
    if (depth > 8) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const rmDirNames = new Set([
      "test",
      "tests",
      "__tests__",
      "examples",
      "docs",
      "doc",
      "bench",
      "benchmark",
      "coverage",
    ]);
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (rmDirNames.has(e.name)) {
          try {
            fs.rmSync(full, { recursive: true, force: true });
          } catch {
            console.error(`[core] 删除目录失败: ${full}`);
          }
        } else {
          rmUnnecessaryFiles(full, depth + 1);
        }
        continue;
      }

      // 文档/源码/调试映射（不会影响运行时行为）
      const isMd = /\.(md|markdown)$/i.test(e.name);
      const isReadmeLike = /^(README|CHANGELOG|LICENSE|HISTORY)(\.(md|txt))?$/i.test(e.name);
      const isMap = e.name.endsWith(".map");
      const isDts = e.name.endsWith(".d.ts");
      if (isMd || isReadmeLike || isMap || isDts) {
        try {
          fs.unlinkSync(full);
        } catch {
          console.error(`[core] 删除文件失败: ${full}`);
        }
      }
    }
  }
  rmUnnecessaryFiles(nm, 0);

  // @fastify/send 的测试夹具包含 snowman(☃) 路径名，
  // 在 WiX zh-CN(codepage 936) 下会导致 LGHT0311，运行时并不需要 test 目录。
  const fastifySendTestDir = path.join(nm, "@fastify", "send", "test");
  if (fs.existsSync(fastifySendTestDir)) {
    try {
      fs.rmSync(fastifySendTestDir, { recursive: true, force: true });
      console.log("[core] 已删除 @fastify/send/test（避免 WiX codepage 936 路径编码失败）");
    } catch {
      console.error(`[core] 删除目录失败: ${fastifySendTestDir}`);
    }
  }

  const sizeBytes = getDirSizeBytes(nm);
  const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
  console.log("[core] 裁剪后 node_modules 约 " + sizeMB + " MB");
}

export default defineConfig({
  entry: ["index.ts"],
  outDir: "../src-tauri/resources/core",
  format: ["cjs"],
  splitting: false,
  // 生成环境建议保留 sourcemap，开发模式关闭可显著降低产物分析/加载成本
  sourcemap: IS_DEV_MODE ? false : true,
  // 设为 false：clean 会清空整个 outDir，会删掉 package.json 与 node_modules，导致无法跳过安装
  clean: false,
  bundle: true,
  platform: "node",
  target: "node24",
  treeshake: true,
  // 产物体积更小，也能减少生成 JS 的行数，降低编辑器解析压力
  minify: true,
  noExternal: [
    'fastify',
    '@fastify/cors',
    '@fastify/multipart',
    'fs-extra',
    '@langchain/core',
    'zod',
    "pino",
    "pino-pretty",
    "@fastify/websocket",
  ],
  // 仅保留无法打包或需要运行时文件资源的模块在 node_modules，其余打进 bundle
  external: ["better-sqlite3", "@fastify/swagger", "@fastify/swagger-ui"],
  esbuildOptions(options: { absWorkingDir?: string; banner?: Record<string, string> }) {
    // 从 core 目录解析 node_modules，保证 monorepo 下能找到依赖
    options.absWorkingDir = __dirname;
    options.banner = {
      js: "#!/usr/bin/env node",
    };
  },
  onSuccess: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    // sourcemap 在开发模式关闭后，清理旧 map，避免编辑器继续分析旧文件
    if (IS_DEV_MODE) {
      const mapPath = path.join(RESOURCES_CORE, "index.js.map");
      if (fs.existsSync(mapPath)) {
        fs.rmSync(mapPath, { force: true });
      }
    }
    installCoreNodeModules();
  },
});

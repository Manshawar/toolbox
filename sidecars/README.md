# Sidecars 侧车服务

Tauri 应用的侧车集合：**core** 为入口二进制，内部根据参数加载 **langchain-serve**（Hono API + better-sqlite3）或 **pty-host**（node-pty + WebSocket 终端）。构建由 tsup 打包两个 worker 的 JS，再通过 @yao-pkg/pkg 将 launcher 与依赖打成单 exe（`src-tauri/binaries/core-*`）。

---

## 目录结构

```
sidecars/
├── package.json          # core 包（name: "core"），含 pkg 配置与依赖
├── tsup.config.ts        # 多入口打包 langchain-serve、pty-host → dist/*.js；onSuccess 注入 launcher + 调 pkg
├── build/
│   └── index.js         # Launcher：根据 argv[2]（langchain-serve | pty-host）require 对应 dist/*.js
├── app/
│   ├── langchain-serve/ # Hono API，端口 API_PORT；可选 DB_PATH + better-sqlite3
│   │   ├── src/index.ts
│   │   ├── script/dev.ts
│   │   └── package.json
│   └── pty-host/        # PTY + WebSocket，端口 PTY_PORT
│       ├── src/index.ts
│       ├── script/dev.ts
│       └── package.json
├── dist/                # 构建产出（tsup 生成，launcher 写入）
│   ├── index.js         # Launcher（来自 build/index.js，不经过 tsup 打包）
│   ├── langchain-serve.js
│   └── pty-host.js
└── README.md
```

- **无** `src/` 或 `src/entries/`：两服务入口直接指向 `app/*/src/index.ts`，launcher 为独立脚本 `build/index.js`，在 tsup 的 onSuccess 中写入 `dist/index.js`。

---

## 构建流程

1. **tsup**：根据 `tsup.config.ts` 的 `entry` 将 `app/langchain-serve/src/index.ts`、`app/pty-host/src/index.ts` 分别打包为 `dist/langchain-serve.js`、`dist/pty-host.js`（external：node-pty、ws、better-sqlite3，由 pkg 以 assets 形式打进二进制）。
2. **注入 Launcher**：把 `build/index.js` 内容写入 `dist/index.js`，作为 pkg 的入口。
3. **pkg**：以 `dist/index.js` 为入口、结合 `package.json` 的 `pkg.assets`，生成 `src-tauri/binaries/core-<target>.exe`（或当前平台无扩展名）。Launcher 运行时通过 `__dirname` 找同目录下的 `langchain-serve.js`、`pty-host.js`（pkg 会把它们打进快照，路径在 snapshot 内）。

---

## 运行模型

- **Launcher**（`build/index.js`）：读取 `process.argv[2]`，为 `langchain-serve` 时 `require('./langchain-serve.js')`，为 `pty-host` 时 `require('./pty-host.js')`；否则报错退出。
- **Tauri**：在 setup 中 spawn **core**，通过 `.args(["langchain-serve"])` 或 `.args(["pty-host"])` 传参，并注入环境变量（如 `API_PORT`、`PTY_PORT`、可选 `DB_PATH`）。当前实现中先 spawn 一次 core 跑 langchain-serve；pty-host 可按需再 spawn 一次 core 并传 `pty-host`。

---

## 命令说明

### 在 sidecars 目录下

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | 不打包：并行启动 `langchain-serve`、`pty-host` 的 dev（各自 `tsx script/dev.ts`），端口由 script 从根目录 `.env` 或 `--port` 解析。 |
| `pnpm run build` | 执行 tsup → 产出 `dist/`，并执行 onSuccess（注入 launcher + pkg），生成 `src-tauri/binaries/core-<当前平台>`。 |
| `pnpm run build:mac` / `build:win` / `build:linux` | 设置 `SIDECAR_TARGET` 后执行 tsup，用于跨平台打二进制（需在对应环境或 CI 中跑）。 |

### 在项目根目录

| 命令 | 说明 |
|------|------|
| `pnpm run build:sidecar` | 执行 `pnpm -C sidecars run build`，即上述 sidecars 的 build。 |
| `pnpm run build:sidecar:win` / `:mac` / `:linux` | 在根目录执行 sidecars 的 build:win / build:mac / build:linux。 |
| `pnpm run build:app` | 先 `build:sidecar`，再 `pnpm tauri build`，产出完整桌面安装包。 |

---

## 两个 App 说明

### langchain-serve

- **栈**：Hono、@hono/node-server，可选 better-sqlite3（需设置 `DB_PATH`）。
- **端口**：`API_PORT`（默认 8264）。
- **接口**：`GET /health`；可选 `GET /db`（需 DB_PATH）。
- **开发**：`pnpm --filter langchain-serve run dev`（tsx 跑 `script/dev.ts`，端口从 `.env` 或参数来）。

### pty-host

- **栈**：node-pty、ws。
- **端口**：`PTY_PORT`（默认 8265）。
- **开发**：`pnpm --filter pty-host run dev`。

---

## 依赖与 pkg 注意点

- **node-pty、ws、better-sqlite3** 在 tsup 中为 `external`，不打进 dist 的 bundle；pkg 通过 `package.json` 的 `pkg.assets` 将 `node_modules/node-pty/**`、`node_modules/ws/**`、`node_modules/better-sqlite3/**` 以及 `dist/*.js` 等打进二进制，运行时从 pkg 快照内解析。
- **Node 版本**：tsup 的 target 为 node24；pkg 使用 `@yao-pkg/pkg`，target 为 `node24-<os>-<arch>`，与当前开发环境一致即可。
- better-sqlite3 建议使用 **v12.x**（Node 24 有 prebuild，无需本机 Python/node-gyp）。详见根目录 `doc/sidecar-architecture.md` 中「better-sqlite3 rebuild 失败」一节。

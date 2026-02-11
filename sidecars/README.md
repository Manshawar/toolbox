# Sidecars 侧车服务

Tauri 应用的侧车服务集合，由 **core** 主运行时按参数用子进程启动 **langchain-serve**、**pty-host**（子包各自 esbuild 打包为 dist，core 通过 `node dist/run.js` 或 `dist/index.js` 启动）。

## 目录结构

```
sidecars/
├── core/              # 主运行时（launcher，可 pkg 为单二进制）
├── langchain-serve/   # Hono API，esbuild → dist/
├── pty-host/          # PTY + WebSocket，esbuild → dist/
└── README.md
```

## 启动方式

### 1. core 参数

- **不传参**：启动全部（serve-api + serve-pty 各一子进程）
- **传参**：只启动对应的一个
  - `core serve-api` → 只启动 langchain-serve
  - `core serve-pty` → 只启动 pty-host

### 2. 开发

在**项目根目录**先构建子包再跑 core：

```bash
pnpm --filter langchain-serve run sidecar:build
pnpm --filter pty-host run sidecar:build
node sidecars/core/dist/index.js
# 或指定： node sidecars/core/dist/index.js serve-api
```

### 3. 构建侧车

```bash
pnpm run build:sidecar
# 或按平台：build:sidecar:mac / build:sidecar:win / build:sidecar:linux
```

### 4. 完整应用构建

```bash
pnpm run build:app
```

## 构建顺序（`sidecar:build`）

1. `langchain-serve`、`pty-host` 先执行 sidecar:build（esbuild → dist/run.js 或 dist/index.js）
2. `core` sidecar:build（tsup → dist/index.js，可选 pkg → src-tauri/binaries/core-*）

## 进程模型

- Tauri 启动 `core`（无参数）
- core 不传参时 spawn 两个子进程：`node langchain-serve/dist/run.js`、`node pty-host/dist/run.js`（或 index.js）
- 传参时只 spawn 对应的一个
- 输出：`API_PORT=xxx`、`PTY_PORT=xxx`

## 单二进制与 pkg

当前为**单二进制**方案：tsup 将 `langchain-serve`、`pty-host` 并入 core 的 bundle（`noExternal`），pkg 打出**一个** exe 即包含全部逻辑。子进程通过 `spawn(process.execPath, [serve-api|serve-pty])` 再执行同一二进制，并用环境变量 `CORE_WORKER=1` 区分 launcher 与 worker，worker 内执行对应 `module.run()`。

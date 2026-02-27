# Sidecars 侧车服务

Tauri 应用的侧车服务集合。**core** 为 launcher，构建时产出三个 JS：`dist/index.js`（launcher）、`dist/langchain-serve.js`、`dist/pty-host.js`。launcher 按路径 spawn 后两个独立文件，避免打包后路径识别问题；pkg 只打 index.js 为单二进制，并把两个服务 js 复制到 `src-tauri/binaries/` 与 exe 同目录。

## 目录结构

```
sidecars/
├── package.json       # core 包（name: "core"）
├── tsup.config.ts     # 多入口：index + langchain-serve + pty-host → dist/*.js；pkg 仅 index → binaries/core-*
├── src/
│   ├── index.ts       # launcher：spawn dist/langchain-serve.js、dist/pty-host.js（或 exe 同目录）
│   └── entries/
│       ├── langchain-serve.ts   # 独立入口 → dist/langchain-serve.js
│       └── pty-host.ts          # 独立入口 → dist/pty-host.js
├── app/
│   ├── langchain-serve/   # Hono API，被 entries 打包进 dist/langchain-serve.js
│   └── pty-host/          # PTY + WebSocket，被 entries 打包进 dist/pty-host.js
└── README.md
```

## 项目根目录三条命令（推荐）

在**项目根目录**执行，一条命令同时起前端 + 后端：

| 命令 | 作用 |
|------|------|
| **`pnpm run dev:app`** | **前端 Tauri + 后端用 dev 起两个侧车（无子进程）**：并行跑「Tauri（不启 sidecar）」和「两 app 的 dev」（`turbo run dev`），前端走 Vite 代理到 `.env` 里配置的端口，不改 app 代码时用这条即可。 |
| **`pnpm run dev:tsup`** | **前端 Tauri + 后端用 tsup 打包、子进程启动，并监听 app 变化**：先执行一次 `build:sidecar`（esbuild 两 app → tsup core），再并行跑「tsup --watch（监听 `src/` 与 `app/*/src/`）」和「Tauri 带 sidecar」。app 里内容变了 tsup 会重新打 core，需**重启一次 Tauri 窗口**才能用上新 bundle。 |
| **`pnpm run build:app`** | **最终打包**：先 `turbo run sidecar:build`（按顺序：两 app esbuild → core tsup），再 `pnpm tauri build`（会执行 beforeBuildCommand 打前端）。产出桌面安装包与 `src-tauri/binaries/core-*`。 |

## 三种命令（在 sidecars 目录下执行）

| 命令 | 作用 |
|------|------|
| **`pnpm run dev`** | **不打包**：并行启动 `app/langchain-serve`、`app/pty-host` 的 dev 服务（各自 `tsx script/dev.ts`），不跑 tsup，适合改两个 app 源码时用。 |
| **`pnpm run dev:tsup`** | **tsup 打包 + 进程启动**：先按顺序执行 esbuild（两 app）→ tsup（core），再执行 `node dist/index.js`，由 core 用子进程拉起 langchain-serve、pty-host，行为接近 Tauri 里跑 sidecar。 |
| **`pnpm run build`** | **打包**：只做构建（不运行）。先对两 app 做 esbuild，再对 core 做 tsup，产出 `dist/` 与（若在根目录执行平台命令）`src-tauri/binaries/core-*`。打生产二进制需在根目录跑 `build:sidecar:mac` / `build:sidecar:win` / `build:sidecar:linux`。 |

## 开发阶段 app 变了，tsup 会监听到吗？要对 app 先打包吗？

- **会监听到**：`tauri:dev` 里 tsup 的 watch 包含 `app/langchain-serve/src/**/*.ts`、`app/pty-host/src/**/*.ts`，所以 **app 里内容变了，tsup 会重新打 core 的 bundle**（`dist/index.js` 会更新）。
- **不需要先对 app 做 esbuild**：core 用 `noExternal` 把两 app **从源码**打进一个 bundle，读的是 workspace 里 `langchain-serve`、`pty-host` 的入口（如 `src/index.ts`），**不读**它们的 `dist/`。所以开发时只要 tsup 在 watch，改 app 源码即可，**不用先跑两 app 的 esbuild**。只有在「最终打包」或「单独跑两 app 的 dist」时才需要先跑 app 的 sidecar:build。

## 为什么按这个顺序打包？

- **依赖关系**：core 的 `package.json` 里声明了 `"langchain-serve": "workspace:*"`、`"pty-host": "workspace:*"`，且 tsup 用 `noExternal` 把这两个包打进同一个 bundle，所以 **core 依赖这两个 app 包**。
- **Turbo 的 `^sidecar:build`**：根目录 `turbo.json` 里 `sidecar:build` 配了 `dependsOn: ["^sidecar:build"]`。`^` 表示「先跑**依赖包**的同名任务」。
- **执行顺序**：Turbo 会先对 langchain-serve、pty-host 跑 `sidecar:build`（二者无 workspace 依赖，可并行），等两者都完成后再对 core 跑 `sidecar:build`。所以顺序是：**① langchain-serve esbuild → dist/**，**② pty-host esbuild → dist/**（① ② 可并行），**③ core tsup → dist/index.js**（并可选 pkg → 二进制）。
- **为什么要先打两 app**：虽然 tsup 从源码 bundle 两 app（不直接读它们的 dist），但先跑 app 的 sidecar:build 能保证两包可安装、可解析，且 standalone 跑或调试时用的也是它们各自的 dist，顺序统一、缓存一致。

## 启动方式

### 0. 项目根目录 pnpm 命令（Tauri 应用）

在**项目根目录**可用两条命令启动 Tauri 开发：

- 日常开发用根目录 **`pnpm run dev:app`**（无子进程）或 **`pnpm run dev:tsup`**（子进程 + 监听 app）。

### 1. core 启动方式

- **无参**：launcher 在脚本目录（`__dirname` / exe 同目录 / `CORE_SCRIPTS_DIR`）下找 `langchain-serve.js`、`pty-host.js`，用当前 node 或 exe 各 spawn 一个子进程运行它们。
- **带 .js 路径**（内部用）：以 `exe path/to/xxx.js` 启动时，当前进程会动态 import 该脚本并执行 `run()`，用于子进程入口。

### 2. 开发（在 sidecars 目录下）

- 只起两 app、不打包：`pnpm run dev`
- 先打包再以进程方式起两包：`pnpm run dev:tsup`
- 或手动：`pnpm run build` 后 `node dist/index.js`（可加参数 `langchain-serve` / `pty-host` 只起一个）

### 3. 构建侧车

在 **sidecars 目录**执行 `pnpm run build`（或根目录 `pnpm run build:sidecar`）。打平台二进制在**根目录**执行：

```bash
pnpm run build:sidecar:mac   # 或 build:sidecar:win / build:sidecar:linux
```

### 4. 完整应用构建

```bash
pnpm run build:app
```

## 构建顺序（`sidecar:build`）

见上文「为什么按这个顺序打包？」：先两 app 的 esbuild，再 core 的 tsup。

## 进程模型

- Tauri 启动 `core`（无参数）
- core 不传参时 spawn 两个子进程（或单二进制下复用同一可执行文件 + 参数）
- 传参时只 spawn 对应的一个
- 输出：`API_PORT=xxx`、`PTY_PORT=xxx`

## 三分文件与 pkg

- **构建**：tsup 多入口产出 `dist/index.js`（launcher）、`dist/langchain-serve.js`、`dist/pty-host.js`。launcher 不打包两服务，只按路径 spawn。
- **pkg**：仅把 `index.js` 打成 exe（`binaries/core-<target>`），并把 `langchain-serve.js`、`pty-host.js` 复制到同目录，便于 exe 按路径启动。
- **脚本目录**：launcher 解析顺序为 `CORE_SCRIPTS_DIR`（Tauri 可设）→ pkg 下 exe 所在目录 → 开发时 `__dirname`（dist）。

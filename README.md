# Toolbox（Langchain App）

基于 **Vue 3** + **Tauri 2** 的桌面工具箱应用。  
前端使用 Vue 3 + Vite，后端能力通过 **内置 Node Runtime + core（langchain-serve）** 提供本地 API / 数据库 / 终端等能力。

---

## 1. 快速开始：项目怎么跑起来？

### 1.1 环境准备

- 必须安装：
  - Node.js ≥ 20（推荐 24，内置 Runtime 也是 24）
  - pnpm ≥ 8
  - Rust（用于构建 / 打包 Tauri）

### 1.2 克隆 & 安装依赖

```bash
git clone <this-repo-url>
cd langchainApp
pnpm install
```

> `pnpm install` 会自动安装根项目和 `core/` 子包的依赖。

### 1.3 准备内置 Node Runtime（首次或切换平台时）

```bash
pnpm run prepare
```

- 作用：下载对应平台的 Node 24 并解压到 `src-tauri/help/nodeRuntime`。
- 如果已经有可用的 Runtime，会走缓存并跳过下载。

### 1.4 启动开发

根据你的需求选择一种方式：

- 仅调前端（浏览器访问）：

  ```bash
  pnpm dev:web
  ```

- 启动 Tauri + 前端，但不跑 core（适合只看 UI、调前端逻辑）：

  ```bash
  pnpm dev
  ```

- **完整桌面应用开发（推荐）**：Tauri + 内置 Node + core 全部拉起

  ```bash
  pnpm dev:app
  ```

  等价流程：

  1. `pnpm run build:core`：打包 core 到 `src-tauri/resources/core/index.js`
  2. `pnpm tauri dev`：用 Tauri 启动桌面应用，并通过内置 Node Runtime 跑 core

---

## 2. 构建与打包

### 2.1 仅构建前端

```bash
pnpm run build
```

- 等价于：`vue-tsc --noEmit && vite build`。

### 2.2 仅构建 core（不下载 Node Runtime）

```bash
pnpm run build:core
pnpm run build:core:mac
pnpm run build:core:win
pnpm run build:core:linux
```

- 使用 tsup 将 `core/index.ts` 打包到 `src-tauri/resources/core/index.js`，并安装 core 所需原生依赖到 `resources/core/node_modules`。
- 不会自动执行 `prepare`，不会下载 Node Runtime，适合本地快速迭代 core 逻辑。

### 2.3 打桌面分发包（会自动准备 Node Runtime）

```bash
pnpm run build:app       # 当前平台
pnpm run build:app:mac   # 构建 macOS (aarch64-apple-darwin)
pnpm run build:app:win   # 构建 Windows (x86_64-pc-windows-msvc)
pnpm run build:app:linux # 构建 Linux (x86_64-unknown-linux-gnu)
```

核心脚本逻辑（简化）：

- `build:app*`：
  1. `pnpm run prepare`：下载 / 复用目标平台 Node Runtime
  2. `pnpm run build:core*`
  3. `pnpm tauri build [--target ...]`

---

## 3. 技术栈一览

| 类别       | 技术 |
| ---------- | ---- |
| 前端框架   | Vue 3、Vue Router |
| 状态管理   | Pinia（含 pinia-plugin-persistedstate） |
| 构建工具   | Vite 6、TypeScript |
| 样式       | Tailwind CSS 4 |
| 组件库     | Element Plus |
| 图标       | Element Plus Icons / Heroicons |
| 桌面壳     | Tauri 2（plugin-http、plugin-opener、plugin-shell、plugin-sql、plugin-store 等） |
| Core 服务  | `langchain-serve`（Hono + better-sqlite3） |
| Node Runtime | 内置 Node 24（二进制从 nodejs.org 下载，位于 `src-tauri/help/nodeRuntime`） |
| 仓库结构   | pnpm workspace（根应用 + `core/` 子包） |

---

## 4. 目录结构概览

```text
langchainApp/
├── src/                         # 前端（Vue 3 + Vite）
│   ├── views/                   # 页面
│   ├── layouts/                 # 布局与标题栏
│   ├── router/                  # 路由
│   ├── store/                   # Pinia
│   ├── config/                  # 与 Tauri / core 相关的配置封装
│   ├── utils/                   # 工具（tauriHttp、axios 封装、ptyWs 等）
│   └── sql/                     # 前端 SQL/schema 相关
├── src-tauri/
│   ├── help/nodeRuntime/        # 内置 Node Runtime（由 `pnpm run prepare` 下载）
│   │   ├── bin/node             # Node 可执行文件
│   │   └── lib/node_modules/npm # npm 等工具
│   ├── resources/core/          # core 打包产物（tsup 输出）
│   │   ├── index.js             # core 入口（require langchain-serve）
│   │   └── node_modules/        # 原生依赖（better-sqlite3、node-pty、ws）
│   ├── config/settings.json     # 应用配置（端口、DB 名、store 名等）
│   ├── tauri.conf.json          # Tauri 配置
│   └── src/
│       ├── core.rs              # 使用内置 Node 启动 core/index.js，管理端口与 .env 写入
│       ├── config.rs            # 读取 settings.json，提供 get_api_port / get_sqlite_db_name / get_store_name
│       ├── invoke/              # Tauri invoke 命令（run_node_runtime、run_npm_runtime、get_config 等）
│       └── lib.rs               # Tauri 入口，注册插件与 invoke_handler
├── core/                        # core（langchain-serve）源码与构建配置
│   ├── app/langchain-serve/     # Hono API 项目（/health /test /doc 等）
│   ├── index.ts                 # core 入口：调用 langchain-serve 的 run()
│   ├── tsup.config.ts           # 打包到 src-tauri/resources/core/index.js
│   ├── package.json             # core 子包配置（build / build:*）
│   └── tsconfig.json
├── scripts/
│   └── init.mjs                 # 下载 Node Runtime 的脚本（被 `pnpm run prepare` 调用）
├── package.json                 # 根包配置（前端 / core / Tauri 脚本）
├── pnpm-workspace.yaml          # workspace 配置
└── README.md
```

---

## 5. 运行时架构（简要）

### 5.1 Tauri + 内置 Node + core

Tauri 启动时，`src-tauri/src/core.rs` 会：

1. 使用 `portpicker` 选择一个空闲端口作为 `API_PORT`。
2. 根据应用数据目录生成：
   - `SQLITE_DB_PATH / DB_PATH`：数据库文件路径
   - `STORE_PATH`：Tauri Store 文件路径
3. 组合环境变量（`API_PORT`、`DB_PATH`、`STORE_PATH` 等），使用 **内置 Node Runtime** 执行：

   ```text
   <resource_dir>/core/index.js
   ```

4. `core/index.js` 会 `require` `langchain-serve` 入口并调用 `run()`，启动一个 Hono 服务：
   - 基础地址：`http://127.0.0.1:<API_PORT>`
   - Swagger：`/ui`
   - 健康检查：`/health`
   - 其他测试 / 调试接口：`/test/...`

### 5.2 前端如何访问 core

1. 前端通过 Tauri `invoke("get_config")` 拉取配置（`sqlite_db_name`、`api_port`、`store_name` 等）。
2. 若 core 已成功启动，实际分配的 `api_port` 会写回该配置。
3. 配置被写入 Pinia 的 `tauriConfig` store，前端统一从这里读取端口：
   - HTTP：`@/utils/axios/tauriHttp.ts` 的 `fetchApi`、`getApiBaseUrl`
   - WebSocket / 终端：`ptyWs` 等组件共用同一个 `api_port`

---

## 6. 常见问题（FAQ）

### Q1：如何验证内置 Node Runtime 是否正常？

1. 先执行：

   ```bash
   pnpm run prepare
   ```

2. 然后启动完整应用：

   ```bash
   pnpm run dev:app
   ```

3. 打开前端测试页（如 `nested/menu2`），可以看到：
   - Swagger 地址提示
   - 各类测试按钮（Node、npm、子进程测试等）

### Q2：还能像以前那样用 sidecar / pkg 吗？

当前版本已经移除 sidecar + pkg 二进制方案，统一改为：

- 内置 Node Runtime（`src-tauri/help/nodeRuntime`）
- core 以 JS 形式放在 `resources/core`
- Tauri 直接用内置 Node 执行 JS，不再通过 sidecar 启动外部 exe

如果需要旧方案，建议在独立分支维护，当前主线不再支持。

---

## 7. 推荐开发工具

- VS Code + 插件：
  - Vue - Official（Volar）
  - Tauri
  - TypeScript / ESLint
  - rust-analyzer

---

如果你只想「赶紧跑起来」，重点看 **第 1 章** 的命令即可；其余章节主要用于理解架构和排查问题。 
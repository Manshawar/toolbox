# Toolbox（Langchain App）

基于 **Vue 3** + **Tauri 2** 的桌面工具箱应用：前端 Vite 构建，侧车（Sidecar）提供本地 API 与终端能力，后续可接入 Langchain、Clawbot 等。

---

## 技术栈

| 类别       | 技术 |
| ---------- | ---- |
| 前端框架   | Vue 3、Vue Router |
| 状态管理   | Pinia（含 pinia-plugin-persistedstate） |
| 构建工具   | Vite 6、TypeScript |
| 样式       | Tailwind CSS 4 |
| 组件库     | [Element Plus](https://element-plus.org/) |
| 图标       | Element Plus Icons / Heroicons |
| 桌面壳     | Tauri 2（plugin-http、plugin-opener、plugin-shell、plugin-store 等） |
| 侧车服务   | **langchain-serve**（Hono API + better-sqlite3）、**pty-host**（node-pty 终端） |
| 侧车打包   | tsup + @yao-pkg/pkg → 单 exe（core） |
| 仓库结构   | pnpm workspace（根 + sidecars + sidecars/app/langchain-serve + sidecars/app/pty-host） |

---

## 环境要求

- **Node.js** 20+（推荐 24；better-sqlite3 需 12.x 以支持 Node 24 prebuild）
- **pnpm** 8+
- **Rust**（仅打包 Tauri 桌面应用时需要）

---

## 安装与启动

### 安装依赖

```bash
pnpm install
```

会安装根项目与 workspace 内所有子包（含 sidecars、langchain-serve、pty-host）。

### 开发

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 仅启动前端（Vite），浏览器访问，不启动 Tauri |
| `pnpm dev:app` | 启动完整桌面应用（Tauri 窗口 + 前端），侧车由 Tauri 按配置启动 core |
| `pnpm dev:app:manual` | 不启动侧车，仅 Tauri + 前端；同时单独起 langchain-serve（需手动在 sidecars 下起服务时用） |

侧车端口由 Tauri 或环境变量注入（如 `API_PORT`、`PTY_PORT`）；本地调试可在项目根建 `.env` 配置 `VITE_API_PORT`、`VITE_PTY_PORT` 等。

### 构建

| 命令 | 说明 |
|------|------|
| `pnpm build` | 仅构建前端（Vue），产出 `dist/` |
| `pnpm run build:sidecar` | 构建侧车：tsup 打包 langchain-serve、pty-host，再 pkg 生成 `src-tauri/binaries/core-<target>` |
| `pnpm run build:sidecar:win` / `:mac` / `:linux` | 按平台构建侧车二进制 |
| `pnpm run build:app` | 先 build:sidecar，再 `pnpm tauri build`，产出桌面安装包 |

---

## 项目结构

```
toolbox/
├── src/                    # 前端（Vue 3 + Vite）
│   ├── views/              # 页面（首页工具箱、Clawbot 等）
│   ├── layouts/            # 布局与标题栏
│   ├── router/             # 路由
│   ├── store/              # Pinia
│   ├── utils/              # 工具（含 tauriHttp 请求侧车 API）
│   └── sql/                # 前端 SQL/schema 相关
├── src-tauri/              # Tauri 2 配置与 Rust
│   ├── binaries/           # 侧车二进制 core-*（build:sidecar 产出）
│   ├── capabilities/       # 权限（含 http 本地、shell 执行 core 等）
│   └── src/                # Rust 侧车启动、invoke 等
├── sidecars/               # 侧车 monorepo
│   ├── app/
│   │   ├── langchain-serve/   # Hono API，可选 better-sqlite3（DB_PATH）
│   │   └── pty-host/          # node-pty + WebSocket 终端
│   ├── build/index.js         # core 入口：单进程 require 两 worker
│   ├── dist/                  # tsup 产出（供 pkg 打二进制）
│   └── tsup.config.ts
├── doc/                    # 架构与规划（sidecar 方案、Clawbot、Langchain 阶段）
└── package.json
```

- **侧车运行时**：Tauri 以 sidecar 方式启动 `binaries/core-<target>`，core 内顺序加载 `langchain-serve.js`、`pty-host.js`（单进程，无 spawn 子进程）。
- **前端连侧车**：通过 Tauri invoke 获取侧车端口，再用 `@tauri-apps/plugin-http` 或 WebSocket 访问 API / PTY。

---

## 侧车服务说明

### langchain-serve

- **技术**：Hono + @hono/node-server，可选 better-sqlite3（需设置 `DB_PATH`）。
- **端口**：环境变量 `API_PORT`（默认 8264）。
- **接口**：`GET /health`；`GET /db`（需配置 DB_PATH，返回表名与 test 表数据）。
- **开发**：在 sidecars 下 `pnpm --filter langchain-serve run dev`，或由根目录 `dev:app:manual` 配合启动。

### pty-host

- **技术**：node-pty + WebSocket，提供应用内终端。
- **端口**：环境变量 `PTY_PORT`（默认 8265）。
- **开发**：`pnpm --filter pty-host run dev`。

---

## 配置与文档

- **环境变量**：根目录 `.env` 可配置 `VITE_API_PORT`、`VITE_PTY_PORT`、`DB_PATH` 等；开发时由 dotenv 或 Tauri 注入。
- **架构与规划**：见 `doc/` 下 `sidecar-architecture.md`（侧车方案评分、Clawbot/Node 打包结论）、`phased-plan.md`（阶段计划）、`agent-env-dynamic-management.md`（Agent 环境与 Clawbot 安装）。

---

## 推荐 IDE

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

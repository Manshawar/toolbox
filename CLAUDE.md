```
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
```

## 项目概述

基于 **Vue 3** + **Tauri 2** 的桌面工具箱应用。前端使用 Vue 3 + Vite，后端能力通过 **Node 侧车 + core（langchain-serve）** 提供本地 API / 数据库 / 终端等能力。

## 开发命令

### 环境准备
```bash
# 首次克隆后安装依赖
pnpm install

# 准备 Node 侧车（首次或切换平台时）
pnpm run init:runtime
```

### 启动开发

| 命令 | 说明 |
|------|------|
| `pnpm dev:web` | 仅调前端（浏览器访问） |
| `pnpm dev` | 启动 Tauri + 前端，但不跑 core（适合只看 UI、调前端逻辑） |
| `pnpm dev:app` | 完整桌面应用开发（推荐）：Tauri + Node 侧车 + core 全部拉起 |
| `pnpm dev:core` | 仅 core 开发（热重载） |

### 构建命令

| 命令 | 说明 |
|------|------|
| `pnpm run build` | 仅构建前端 |
| `pnpm run build:core` | 仅构建 core（当前平台） |
| `pnpm run build:app` | 构建完整应用（当前平台） |
| `pnpm run build:app:mac` | 构建 macOS 应用（aarch64） |
| `pnpm run build:app:win` | 构建 Windows 应用（x86_64） |
| `pnpm run build:app:linux` | 构建 Linux 应用（x86_64） |

### 代码质量

```bash
# 检查类型
pnpm run lint

# 自动修复 ESLint 错误
pnpm run lint:eslint:fix
```

## 项目架构

### 目录结构

```text
langchainApp/
├── src/                         # 前端（Vue 3 + Vite）
│   ├── views/                   # 页面
│   ├── layouts/                 # 布局与标题栏
│   ├── router/                  # 路由
│   ├── store/                   # Pinia 状态管理
│   ├── config/                  # Tauri / core 配置封装
│   ├── utils/                   # 工具（HTTP、WebSocket 等）
│   └── sql/                     # 前端 SQL/schema 相关
├── src-tauri/
│   ├── binaries/                # Node 侧车二进制（init:runtime 生成）
│   ├── resources/core/          # core 打包产物
│   ├── config/settings.json     # 应用配置
│   ├── tauri.conf.json          # Tauri 配置
│   └── src/
│       ├── core.rs              # 启动 Node 侧车执行 core
│       ├── config.rs            # 读取应用配置
│       ├── invoke/              # Tauri invoke 命令
│       └── lib.rs               # Tauri 入口
├── core/                        # core（langchain-serve）源码
│   ├── index.ts                 # core 入口
│   ├── tsup.config.ts           # 打包配置
│   └── package.json             # core 子包配置
└── scripts/
    └── init.mjs                 # 下载 Node 侧车脚本
```

### 运行时架构

1. **Tauri** 启动时，`src-tauri/src/core.rs` 会：
   - 选择空闲端口作为 API 端口
   - 生成数据库和应用存储路径
   - 使用 Node 侧车执行 `src-tauri/resources/core/index.js`

2. **Core 服务** 启动 Hono 服务器，提供：
   - Swagger UI：`/ui`
   - 健康检查：`/health`
   - 其他 API：`/test/...`

3. **前端** 通过 Tauri invoke 获取配置，使用 axios 和 WebSocket 与 core 通信。

## 核心技术栈

| 类别       | 技术 |
| ---------- | ---- |
| 前端框架   | Vue 3、Vue Router |
| 状态管理   | Pinia（含 pinia-plugin-persistedstate） |
| 构建工具   | Vite 6、TypeScript |
| 样式       | Tailwind CSS 4 |
| 组件库     | Element Plus |
| 桌面壳     | Tauri 2 |
| Core 服务  | Hono + better-sqlite3 |
| Node 侧车 | Node 24（从 nodejs.org 下载） |
| 仓库结构   | pnpm workspace（根应用 + core 子包） |

## 重要文件

- `package.json` - 根项目配置和脚本
- `core/package.json` - core 子包配置
- `src-tauri/tauri.conf.json` - Tauri 配置
- `src/router/index.ts` - 前端路由
- `src/store/` - Pinia 状态管理
- `core/index.ts` - core 入口
- `src-tauri/src/core.rs` - Node 侧车启动逻辑
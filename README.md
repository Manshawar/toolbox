# Langchain App

基于 **Vue 3** + **Tauri 2** 的桌面应用，前端由 Vite 构建，侧载服务 `langchain-serve` 由 Hono 提供本地 API。

## 技术栈

| 类别     | 技术                                                                                         |
| -------- | -------------------------------------------------------------------------------------------- |
| 前端框架 | Vue 3、Vue Router                                                                            |
| 构建工具 | Vite 6、TypeScript                                                                           |
| 桌面壳   | Tauri 2（@tauri-apps/api、plugin-opener、plugin-shell）                                      |
| 样式     | Tailwind CSS 4、PostCSS、Autoprefixer                                                        |
| 组件库   | [Naive UI](https://www.naiveui.com/)                                                            |
| 图标     | [xicons](https://github.com/07akioni/xicons)（Vue3 使用 `@vicons/*`，配合 `@vicons/utils`） |
| 侧载服务 | `langchain-serve`（Hono、tsup）                                                            |
| monorepo | pnpm workspace、Turbo                                                                        |

### 图标库说明

- https://github.com/tailwindlabs/heroicons

https://heroicons.com/

### 组件库说明

- **Naive UI**：Vue 3 组件库，用于界面组件（按钮、输入框、布局等）。

---

## 环境要求

- **Node.js** 18+
- **pnpm** 8+
- **Rust**（用于 Tauri 桌面构建，仅打包桌面应用时需要）

---

## 安装与启动

### 1. 安装依赖

在项目根目录执行：

```bash
pnpm install
```

会安装根项目与 workspace 内 `langchain-serve` 的依赖。

### 2. 开发模式

**仅启动前端（浏览器）：**

```bash
pnpm dev
```

使用 Vite 开发服务器，在浏览器中访问即可，不启动 Tauri 窗口。

**启动完整 Tauri 桌面应用（含前端 + 桌面壳）：**

```bash
pnpm tauri dev
```

会编译并打开 Tauri 窗口，并监听前端与 Rust 代码变更。

### 3. 构建

**仅构建侧载二进制 `langchain-serve`：**

```bash
pnpm run build:sidecar
```

**构建完整桌面应用（前端 + 侧载 + Tauri 打包）：**

```bash
pnpm run build:app
```

会先通过 Turbo 执行各子项目 build，再执行 `pnpm tauri build` 产出桌面安装包。

**仅构建前端（不打包桌面）：**

```bash
pnpm run build
```

---

## 项目结构简述

- **根目录**：Vue 3 + Vite 前端源码（`src/`）、Tauri 配置（`src-tauri/`）。
- **langchain-serve/**：侧载服务，用 Hono 提供本地 API，由 Tauri 以 sidecar 形式启动；构建产物供 `src-tauri/binaries/` 使用。

---

## 推荐 IDE

- [VS Code](https://code.visualstudio.com/) + [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

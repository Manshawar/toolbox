# Sidecars

侧车运行时：tsup 打包 `langchain-serve`、`pty-host`，再由 pkg 生成单文件二进制，供 Tauri 主进程拉起。

## 依赖管理约定

- **所有运行时依赖写在 `sidecars/package.json`**（含 langchain-serve、pty-host 用到的包）。
- **`app/langchain-serve`、`app/pty-host` 的 package.json 不再写 dependencies**，避免重复且保证 tsup 从本目录打包时能解析到 `sidecars/node_modules`。
- 新增能力时：给 **langchain-serve** 用的依赖 → 加到 **sidecars** 的 `dependencies`；仅构建/类型用 → 加到 **devDependencies**。

## 常用命令（在仓库根目录执行）

| 命令 | 说明 |
|------|------|
| `pnpm build:sidecar` | 构建 sidecar 二进制（当前平台） |
| `pnpm build:sidecar:mac` / `:win` / `:linux` | 指定平台构建 |
| `pnpm -C sidecars/app/langchain-serve run dev` | 仅启动 langchain-serve API（不打包） |
| `pnpm -C sidecars run dev` | 在 sidecars 内用 turbo 跑各 app 的 dev |

## 目录结构

```
sidecars/
├── package.json       # 唯一依赖声明处
├── tsup.config.ts    # 打包配置，entry 指向 app/*/src
├── app/
│   ├── langchain-serve/   # Hono API，无 node_modules 依赖
│   └── pty-host/         # 另一 worker
├── build/            # launcher 等
└── dist/             # tsup 输出，供 pkg 打二进制
```

## 若 pkg 体积偏大（monorepo 导致）

当前 pkg 在 **sidecars** 目录执行，会从 `sidecars/node_modules` 解析；在 pnpm workspace 下可能链到根目录 store，导致打进二进制的内容偏多。

**可选：不用 monorepo 管理 sidecars**

- 在根目录 **pnpm-workspace.yaml** 里去掉 sidecars 相关包，只保留主应用需要的（或不再把 sidecars 当 workspace 包）。
- 之后在 **sidecars 目录内**单独执行一次 `pnpm install`，让 sidecars 拥有自己的 `node_modules`，不再和根目录混用。
- 再执行 `pnpm run build`（在 sidecars 下）或根目录 `pnpm run build:sidecar`（会 `-C sidecars` 执行），pkg 就只会解析 **sidecars 自己的 node_modules**，体积一般会正常不少。

这样 sidecars 相当于「独立项目」：依赖只在 sidecars 装、构建只在 sidecars 跑，不再受根目录 node_modules 影响。

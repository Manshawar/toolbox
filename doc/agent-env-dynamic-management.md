# 基于「运行时动态管理 + Sidecar」的 Agent 环境实施方案

本文档将 Gemini 推荐的**动态二进制/环境管理**方案落成与本项目（Tauri + node-pty + Claw/Clawbot）对应的**可行实施步骤**，便于按步实现。与 [phased-plan.md](./phased-plan.md) 中的阶段 2（Clawbot UI 封装）配合使用。

---

## 1. 方案总览

| 维度 | 做法 |
|------|------|
| **存储位置** | 应用私有目录（App Data），不放进只读安装包 Resources |
| **安装方式** | 在私有目录下 `npm install --prefix ./agent_env`，可选国内镜像 |
| **运行环境** | 通过 node-pty 启动，将 `agent_env/node_modules/.bin` 注入 PATH |
| **更新机制** | 检测版本 → 发现新版本后执行 `npm install @latest --prefix ./agent_env`，可配合镜像 |

这样做的原因：

- 打包目录通常只读，不适合直接 `npm install` 进包内。
- 全局安装会污染用户环境且权限复杂。
- 更新 CLI 时无需重新打包整个 Tauri 应用。

---

## 2. 实施步骤

### 步骤 1：确定应用数据目录与 agent_env 路径

**目标**：在 Rust 侧拿到「应用数据目录」，并约定其下的 `agent_env` 为 CLI 私有环境根目录。

**操作**：

1. 在 Tauri 2 中通过 `AppHandle` 获取应用数据目录。例如（以官方文档为准）：
   - 若使用 `tauri::Manager`，可通过 `app.path().app_data_dir()` 或当前版本提供的 path 接口得到 `PathBuf`。
   - 本项目的 `identifier` 为 `com.manshawar.langchainapp`，典型路径为：
     - **macOS**: `~/Library/Application Support/com.manshawar.langchainapp/`
     - **Windows**: `%APPDATA%\com.manshawar.langchainapp\`
     - **Linux**: `~/.local/share/com.manshawar.langchainapp/` 或 XDG 等价路径。
2. 在 Rust 中新增模块或扩展现有命令，对外提供：
   - `agent_env_root(): PathBuf` = `app_data_dir().join("agent_env")`
   - `agent_bin_path(): PathBuf` = `agent_env_root().join("node_modules").join(".bin")`
3. 首次使用前（安装/更新前）确保 `agent_env_root()` 目录存在（`std::fs::create_dir_all`）。

**产出**：后端可解析出 `agent_env` 根目录与 `node_modules/.bin` 路径，供后续安装与 PTY 使用。

---

### 步骤 2：环境引导（Bootstrap）— 检测 Node/npm

**目标**：在用户首次使用「安装 Claw/Clawbot」前，确认本机是否有可用的 Node.js 与 npm。

**操作**：

1. **Tauri 命令**：新增 `check_node_npm()`（或合并到现有「环境检测」命令中）：
   - 执行 `node --version` 与 `npm --version`（或 `node -v` / `npm -v`）。
   - 返回 `{ node: string | null, npm: string | null }`，前端据此展示「已就绪」或「需要安装 Node」。
2. **未安装时的策略（可选，分阶段实现）**：
   - **阶段 A**：仅提示用户自行安装 Node.js，并给出官网或镜像下载链接。
   - **阶段 B**：在应用数据目录下静默下载 Portable Node 二进制（需维护一份 Node 二进制下载 URL 与校验），解压到例如 `app_data_dir().join("node_runtime")`，后续安装与运行均使用该 runtime 的 `node`/`npm`。
3. 若采用阶段 B，则「安装/更新 agent」时使用的 `node`/`npm` 应指向该私有 runtime，而不是系统 PATH 中的版本。

**产出**：前端能展示 Node/npm 状态；若采用便携 Node，则后端具备私有 `node`/`npm` 路径。

---

### 步骤 3：在应用数据目录下安装 Claw/Clawbot（npm install）

**目标**：在 `agent_env` 下通过 npm 安装目标 CLI（如 `@anthropic-ai/claude-code` 或当前项目采用的 openclaw 对应包名），不污染全局。

**操作**：

1. **安装命令**（在 Tauri 中通过 `std::process::Command` 或由侧车 Node 脚本执行）：
   ```bash
   npm install <package_name>@latest --prefix ./agent_env --registry=https://registry.npmmirror.com
   ```
   - 将 `./agent_env` 替换为步骤 1 得到的 `agent_env_root()` 的绝对路径。
   - `<package_name>` 替换为实际包名（如 `@anthropic-ai/claude-code` 或 openclaw 的 npm 包名）。
2. **工作目录**：建议将「当前工作目录」设为 `agent_env_root()` 的父目录（即 `app_data_dir()`），这样 `--prefix ./agent_env` 即指向应用私有目录。
3. **环境变量**：若需走代理，可为该子进程设置 `HTTPS_PROXY`/`HTTP_PROXY`（从配置或环境读取，不写死密钥）。
4. **国内镜像**：默认使用 `--registry=https://registry.npmmirror.com`；可在设置中允许用户切换为官方源或其它镜像。

**产出**：`agent_env/node_modules/.bin` 下出现 CLI 可执行文件（如 `claude` / `openclaw`），且仅存在于应用私有目录。

---

### 步骤 4：node-pty 中注入私有 bin 路径（PATH）

**目标**：在 pty-host 启动的 PTY 进程中，优先使用 `agent_env/node_modules/.bin`，使用户在终端中直接输入 `claude` 或 `openclaw` 即可运行。

**操作**：

1. **路径来源**：Tauri 在启动侧车（core）或与 pty-host 通信时，将 `agent_bin_path()` 的字符串形式传给 Node 侧（例如通过环境变量 `AGENT_BIN_PATH`，或由 Node 在启动时向 Tauri 请求一次）。
2. **pty-host 修改**：在 `sidecars/pty-host/src/index.ts` 的 `pty.spawn` 处，构造 `env` 时把私有 bin 加入 PATH：
   - 取 `process.env` 的副本，设 `PATH = `${AGENT_BIN_PATH}:${process.env.PATH}``（Unix）或 Windows 下用 `;` 拼接）。
   - 若暂无 Tauri 传入的路径，则 `AGENT_BIN_PATH` 可为空，行为与当前一致（仅系统 PATH）。
3. **可选**：同时设置 `cwd` 为用户主目录或项目目录，便于 CLI 在「当前目录」下工作。

**产出**：在应用内终端中执行 `openclaw --version` 或 `claude --version` 时，使用的是 `agent_env` 内安装的版本。

---

### 步骤 5：一键更新机制（版本检测 + 静默覆盖安装）

**目标**：用户点击「更新」后，后端检测当前安装版本与最新版本，若有更新则执行覆盖安装并可选将进度反馈到前端。

**操作**：

1. **检测当前版本**：
   - 方式 A：在 Tauri 中执行 `agent_bin_path()/openclaw --version`（或对应 CLI 名），解析 stdout 得到当前版本。
   - 方式 B：读 `agent_env/package.json` 或 `agent_env/node_modules/<package_name>/package.json` 的 `version` 字段。
2. **检测最新版本**：
   - 请求 `https://registry.npmmirror.com/<package_name>/latest`（或官方 registry）得到 `version`。
   - 或使用 `npm view <package_name> version`，同样可加 `--registry=...`。
3. **比较与执行**：若远程版本大于当前版本（或用户强制「重新安装」），则执行与步骤 3 相同的安装命令（`npm install <package_name>@latest --prefix ...`）。
4. **进度与结果**：
   - **方式 A**：Tauri 通过 `Command::output()` 执行，完成后将 stdout/stderr 一次性返回前端。
   - **方式 B（推荐）**：Tauri 使用 `Command::spawn()` + 管道读取 stdout/stderr，通过 Tauri 的「事件」或「双向通道」流式推送到前端，前端展示为进度日志或滚动输出。
5. **镜像与代理**：与步骤 3 一致，使用配置的 registry；若 CLI 运行时还会从 GitHub 拉二进制，可对子进程设置 `HTTPS_PROXY` 等。

**产出**：前端「更新」按钮可触发检测与安装，用户能看到进度或完成/失败提示。

---

### 步骤 6：前端 UI 与 Tauri 命令对接

**目标**：前端具备「安装 / 更新 / 状态」入口，与后端逻辑一一对应。

**操作**：

1. **状态展示**：
   - 调用现有 `check_apps_installed(['clawbot'])` 时，需确保检测的是 `agent_env` 内的 CLI（见步骤 4 与 1）。若当前 `app_registry` 使用系统 PATH 的 `openclaw`，可新增一条「使用 agent_bin_path 检测」的路径，或先注入 PATH 再执行检测。
   - 展示：未安装 / 已安装（版本 xxx）/ 安装中 / 更新中 / 错误。
2. **安装按钮**：
   - 调用 Tauri 命令（如 `install_agent_env`），内部执行步骤 2 的 Node 检测与步骤 3 的 npm install；结果或进度通过事件/返回值给前端。
3. **更新按钮**：
   - 调用 Tauri 命令（如 `update_agent_env`），内部执行步骤 5；同样可流式输出进度。
4. **终端入口**：
   - 保持现有「打开终端」逻辑，终端内 PATH 已包含 `agent_env/node_modules/.bin`（步骤 4），用户可直接运行 claw/openclaw。

**产出**：与 [phased-plan.md](./phased-plan.md) 阶段 2 的「检测 → 安装/更新 → 状态与启停」一致，且安装/更新均走应用数据目录与镜像方案。

---

## 3. 与现有代码的对应关系

| 现有能力 | 本方案中的用法 |
|----------|----------------|
| `src-tauri/src/app_registry.rs` | 扩展为支持「从 agent_bin_path 检测」openclaw 版本，或先设置 PATH 再执行现有检测逻辑。 |
| `sidecars/pty-host` | 在 `pty.spawn` 的 `env` 中注入 `agent_env/node_modules/.bin` 到 PATH。 |
| Tauri 侧车管控（core + PTY_PORT） | 启动侧车时传入 `AGENT_BIN_PATH`（或由 Node 向 Tauri 请求），供 pty-host 使用。 |
| 阶段 2 的「一键安装/更新」 | 实现为「在 agent_env 内 npm install + 镜像 + 可选流式进度」。 |

---

## 4. 注意事项与避坑

1. **路径编码与空格**：Windows 下路径可能含空格，传给 Node 或 shell 时需正确转义或使用参数列表形式，避免用单行字符串拼接。
2. **并发**：安装/更新过程中应禁止重复点击「安装」或「更新」，后端可返回「正在安装中」状态。
3. **权限**：应用数据目录一般对当前用户可写，若遇权限错误，提示用户检查磁盘或杀毒/安全软件。
4. **镜像与 CLI 二次下载**：部分 CLI 安装后首次运行会从 GitHub 下载额外二进制，若网络受限，需在子进程环境里设置 `HTTPS_PROXY` 等，或文档中说明。
5. **包名**：文档中以「Claw/Clawbot」为例，实际包名以当前采用的 npm 包为准（如 `@anthropic-ai/claude-code` 或 openclaw 对应包名），在步骤 3、5 中替换为同一包名。

---

## 5. 建议实施顺序

1. **步骤 1**：先打通「应用数据目录 + agent_env 路径」并在 Rust 中暴露。
2. **步骤 2**：实现 Node/npm 检测，前端能展示状态（未安装时先提示用户安装 Node）。
3. **步骤 3**：实现首次安装（npm install --prefix agent_env + 镜像），并在本机验证 `agent_env/node_modules/.bin` 下是否有目标 CLI。
4. **步骤 4**：在 pty-host 中注入 PATH，在应用内终端验证能直接运行该 CLI。
5. **步骤 5**：实现版本检测与一键更新（含可选流式输出）。
6. **步骤 6**：前端对接安装/更新/状态，与阶段 2 的占位与布局整合。

完成以上步骤后，即形成「运行时动态管理 + Sidecar」的完整闭环，无需将 Claw/Clawbot 打进安装包，且支持一键更新与国内镜像加速。

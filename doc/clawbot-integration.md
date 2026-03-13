## 在 Tauri 客户端「潜入」 Clawbot 的整体思路

> 目标（第一阶段）：在 Toolbox 客户端里，**点击「下载 / 更新 Clawbot」→ 下载完成后可以在客户端里「启动 Clawbot」并使用它自己的服务**。  
> 后续再考虑更深的集成（配置、会话管理、UI 嵌入等）。

---

## 1. 角色与边界划分

- **Toolbox（当前这个 Tauri App）**
  - 负责：下载 / 更新 / 启动 / 停止 Clawbot，以及提供一个「入口 UI」。
  - 不负责：重写 Clawbot 的内部业务逻辑。
  - 尽量把 Clawbot 当作一个「托管的外部应用 / 服务」。

- **Clawbot**
  - 仍然使用它「自带的服务与配置方式」（比如它自己的 HTTP 服务、配置文件、插件机制）。
  - Toolbox 只需要知道：
    - 如何下载它的发行包（URL / 版本信息接口）。
    - 下载后它放在哪个目录。
    - 如何启动 / 关闭（命令行参数 / 可执行文件路径 / HTTP API）。

---

## 2. 目录与文件规划

结合目前 `core` 和 `store` 的做法，推荐在 **应用数据目录** 下为 Clawbot 单独划一个空间：

- 应用数据目录（Rust 中通过 `app.path().app_data_dir()` 获得）：

  ```text
  <APP_DATA_DIR>/
  ├── sqlite.db                # 现有 core 使用的 DB
  ├── store.bin                # 现有 Tauri Store
  ├── clawbot/
  │   ├── releases/            # 各版本压缩包（可选：下载后也可以删）
  │   ├── current/             # 当前生效版本的解压目录
  │   │   ├── bin/...          # Clawbot 可执行文件或脚本
  │   │   ├── config/...       # Clawbot 自己的配置（如果需要）
  │   └── state.json           # 由 Toolbox 维护的状态（当前版本、下载中状态、错误信息等）
  ```

这样可以保证：

- **多平台路径统一由 Tauri 管**，不用自己拼 `~/Library` / `%APPDATA%`。
- Clawbot 的版本、路径、当前状态，都可以被 Toolbox 管理而不影响其他功能。

---

## 3. 功能拆分（第一阶段）

第一阶段只做「下载 + 启动」，可以拆成三个核心功能：

1. **检查状态**
   - 读取 `<APP_DATA_DIR>/clawbot/state.json`：
     - 是否已下载某版本。
     - 是否有正在下载的任务（防止多次点击）。
   - UI 根据状态显示：
     - 「未安装 → 显示 下载 / 安装 按钮」
     - 「已安装 → 显示 启动 / 重新安装 / 更新 按钮」

2. **下载 / 更新 Clawbot**
   - 触发方式：前端点击「下载 / 更新」按钮 → 调用 Tauri `invoke("clawbot_download")`。
   - Tauri 侧（Rust）做的事情：
     1. 从配置中拿到 Clawbot 的下载 URL / 版本信息（写在 `settings.json` 或单独的 config）。
     2. 把压缩包下载到 `<APP_DATA_DIR>/clawbot/releases/<version>.zip` 或 `.tar.gz`。
     3. 解压到 `<APP_DATA_DIR>/clawbot/current/`。
     4. 写入 / 更新 `state.json`：
        - `currentVersion`
        - `installedAt`
        - `lastError`（如果有）
   - UI 侧：
     - 显示「下载中 / 百分比 / 成功 / 失败」。
     - 下载完成后按钮变为「启动 Clawbot」。

3. **启动 / 停止 Clawbot**
   - 触发方式：前端点击「启动 Clawbot」→ 调用 Tauri `invoke("clawbot_start")`。
   - Tauri 侧：
     - 根据 `state.json` 找到 `current` 目录下的可执行文件（例如 `bin/clawbot`）。
     - 使用 `std::process::Command` 启动子进程（可以是：
       - 本地 HTTP 服务，端口写回 `state.json`。
       - 直接打开一个窗口 / CLI（视 Clawbot 的形式而定）。
     - 用 `Mutex<Option<Child>>` 等方式在 Rust 侧保存进程句柄，后续实现 `clawbot_stop`。
   - UI 侧：
     - 「启动」后可以：
       - 打开 Clawbot 自带的 Web UI（如果有的话），比如用系统浏览器打开 `http://127.0.0.1:<port>`。
       - 或在 Toolbox 内嵌一个 `WebView` / iframe（后续阶段）。

---

## 4. 与现有架构如何接上

目前 core 的架构已经有一套「Tauri + 内置 Node + JS core」的模式，可以部分复用思路，但为了简化第一阶段，可以先 **不走 core，只让 Tauri 直接管理 Clawbot 下载与进程**：

- **Tauri 新增一组命令（invoke）**：
  - `clawbot_check_state`：返回 `state.json` 的内容 + 运行中状态。
  - `clawbot_download`：异步下载并解压，更新状态。
  - `clawbot_start`：根据当前版本启动子进程。
  - `clawbot_stop`：终止子进程（如果在运行）。

- **前端新增一个简单页面 / 面板**：
  - 显示版本、状态、日志片段。
  - 三个按钮：
    - 「下载 / 更新」
    - 「启动」
    - 「停止」

第二阶段如果你希望：

- 把 Clawbot 的 HTTP 接口代理到现有 core（`langchain-serve`）里。
- 把 Clawbot 的配置 / Session 存进现有 SQLite。

可以再在 `core` 里加一层「Clawbot 适配器」，但不影响第一阶段的下载 / 启动逻辑。

---

## 5. 升级与回滚策略（可选，后续阶段）

如果后面需要更完善的版本控制，可以在 `state.json` 中加上：

- `availableVersions`: 最近可用版本列表（从远端接口拿）。
- `history`: 安装 / 升级 / 启动的时间线。
- `rollbackTo`: 最近一个可回滚版本。

目录结构也可以扩展为：

```text
clawbot/
  ├── releases/
  │   ├── 1.0.0.zip
  │   ├── 1.1.0.zip
  ├── versions/
  │   ├── 1.0.0/
  │   └── 1.1.0/
  ├── current -> versions/1.1.0/   # 符号链接或用 state.json 记录
  └── state.json
```

这样可以：

- 做 A/B 测试或快速回滚；
- 在网络不稳定的情况下尽量重用已经下载好的版本。

---

## 6. 第一阶段建议的最小实现清单

时间有限的前提下，建议第一阶段先做完下面几件事：

1. **规划目录结构与 `state.json` 结构**  
   - 在 Rust 侧写一个 `ClawbotState` 结构体，对应 JSON。
   - 写好读 / 写 `state.json` 的工具函数。

2. **实现 `clawbot_check_state` 与一个最简单的前端面板**  
   - 能看到「已安装 / 未安装」、「当前版本」、「是否在运行」即可。

3. **实现 `clawbot_download`**  
   - 暂时可以写死一个下载 URL（之后再抽到配置）。
   - 下载到 `releases/`，解压到 `current/`。

4. **实现 `clawbot_start`（最简版本）**  
   - 从 `current/` 拉起 Clawbot 进程。
   - 成功后简单返回 `pid` 或 `port`，前端就先只弹个提示「启动成功」。

做到这一步后，你已经可以：

- 在 Toolbox 里点击「下载 Clawbot」；
- 下载完成后点击「启动 Clawbot」；
- 在本机使用 Clawbot（通过它自己的服务或 UI）。

更深入的集成（内嵌 UI、配置同步、日志聚合等），可以在有时间的时候，再在这份文档基础上拆分成更细的开发任务。 

# 分步实施计划：试验场 + 工具箱

本项目同时作为**个人试验场**（验证 Tauri、侧车、Langchain、Clawbot 等）和**日常工具箱**。以下按三个阶段分步推进，每步写清要做什么、产出是什么。

---

## 总览

| 阶段 | 名称 | 目标 |
|------|------|------|
| **1** | 接入命令行侧车 | 应用内能用终端（PTY），并能按需/随应用启动侧车，前端直连 Node 服务 |
| **2** | Clawbot 的 UI 封装 | 安装/更新 Clawbot、状态与启停、iframe 嵌入官方 UI、辅助层与动态按钮占位 |
| **3** | 接入 Langchain：commit + 本地 RAG | Langchain 服务可用；实现 commit 流程（提交/落盘）与本地 RAG（检索增强） |

---

## 阶段 1：接入命令行侧车

**目标**：在应用里能用「终端」，且侧车（core → pty-host + langchain-serve）的启动与连接方式确定、可复用在后续阶段。

### 1.1 侧车启动与管控（Tauri 侧）

- [ ] **在 Tauri 里做侧车唯一管控**  
  - 只在 Rust 里 spawn 一次 core 侧车（如 `setup` 或主窗口首次 Ready）。  
  - 用 `Option<Child>` + 端口缓存：若已有存活进程则返回缓存端口，否则 spawn、解析 stdout 得到 `API_PORT` / `PTY_PORT`，再返回给前端。  
  - 不在前端或 Node 里做「是否多开」判断（Node 侧可去掉锁文件逻辑，若之前有）。

- [ ] **端口如何给前端**  
  - 方案 A：Tauri 提供命令如 `get_sidecar_ports()`，前端在需要时 invoke 拿到 `{ apiPort, ptyPort }`。  
  - 方案 B：Tauri 在 spawn 后把端口写入固定路径的 JSON 文件，前端通过 Tauri 读文件或再暴露一个命令返回该路径/内容。  
  - 选定一种并实现，保证前端能稳定拿到 `apiPort`、`ptyPort`。

### 1.2 前端直连 Node 服务

- [ ] **前端状态与连接**  
  - 在 Pinia（或全局状态）里维护：`sidecarStatus`（idle / starting / ready / error）、`apiPort`、`ptyPort`。  
  - 进入「需要侧车」的页面时：若未就绪则调 Tauri 的「启动侧车」或「获取端口」；拿到端口后存起来，标记 ready。  
  - 所有对 langchain-serve 的 HTTP 请求使用 `http://127.0.0.1:${apiPort}`；PTY 使用 `ptyPort`（如 WebSocket 或现有 pty-host 约定）。

- [ ] **终端 UI（PTY）**  
  - 在需要命令行的页面接入 pty-host：用拿到的 `ptyPort` 建立连接（如 WebSocket），渲染终端输入/输出。  
  - 确保 PATH 或工作目录满足后续在终端里执行 `openclaw` 等命令的需求（阶段 2 会用到）。

### 1.3 验收

- 应用启动后（或进入某页后）侧车只起一次，前端能拿到端口并直连。  
- 终端页能正常输入输出，可执行常见命令。

---

## 阶段 2：实现 Clawbot 的 UI 封装

**目标**：不把 Clawbot 打进安装包，在应用内完成「检测 → 安装/更新 → 状态与启停 → 嵌入官方 UI」，辅助层提供入口与占位，为后续动态按钮留接口。

### 2.1 检测与安装 / 更新

- [ ] **检测本机是否已安装 Clawbot（openclaw）**  
  - 通过 Tauri 执行 `openclaw --version` 或检查固定路径；或由 pty-host 执行一次再回传结果。  
  - 前端根据结果展示「未安装」或「已安装（版本 xxx）」。

- [ ] **一键安装 / 更新**  
  - 未安装：提供「安装」按钮，Tauri 调起官方安装方式（如 `curl -fsSL ... | bash` 或 PowerShell 脚本），并在 UI 上提示用户知情。  
  - 已安装：提供「检查更新 / 更新」入口，再次执行官方脚本或 `npm install -g openclaw@latest`（若适用）。  
  - 安装中：展示 loading、禁止重复点击；失败时提示重试或查看终端。

### 2.2 状态与启停

- [ ] **Gateway 状态**  
  - 通过 PTY 执行 `openclaw status`（或官方提供的状态命令）解析是否在跑；或对 Gateway 的 Web 端口做一次健康请求。  
  - 前端状态：未安装 / 安装中 / Gateway 未起 / 就绪 / 错误。

- [ ] **一键启停**  
  - 「启动 Gateway」：Tauri 或侧车执行 `openclaw gateway` 或官方启动命令。  
  - 「停止」：若有官方停止方式则调用，否则提示在终端内操作。  
  - 启停后更新状态，必要时刷新 iframe 或提示用户刷新。

### 2.3 iframe 嵌入官方 UI

- [ ] **就绪时加载 iframe**  
  - 仅当状态为「就绪」时，将 Gateway 的 Web UI 地址（如 `http://127.0.0.1:<gateway_port>`）设为 iframe 的 `src`。  
  - 端口来源：从 `openclaw status` 输出或配置中解析，由 Tauri 或 langchain-serve 提供给前端。

- [ ] **未就绪时占位**  
  - 未安装：占位文案「请先安装 Clawbot」+ 安装按钮。  
  - Gateway 未起：占位「请先启动 Gateway」+ 启动按钮。  
  - 避免空白 iframe 或错误页。

- [ ] **若遇嵌入被禁**  
  - 若官方返回 `X-Frame-Options: DENY` 等，再考虑同源代理或 Tauri 新窗口打开；先以能嵌入为前提实现。

### 2.4 辅助层与动态按钮占位

- [ ] **辅助层布局**  
  - 同一页上：上方或侧边为「状态 + 安装/更新 + 启停 + 终端入口」；下方或主区域为 iframe（官方 UI）。  
  - 预留一块「动态按钮」区域：后续阶段 3 由 Langchain 返回列表，本阶段可放 1～2 个静态按钮（如「打开终端」「刷新」）或占位文案。

- [ ] **（可选）动态按钮接口契约**  
  - 若阶段 3 要接 Langchain，可在此阶段在 langchain-serve 加 `GET /api/actions` 的 mock：按当前状态返回固定列表，前端按动态按钮契约渲染，便于阶段 3 直接替换为真实 Langchain。

### 2.5 验收

- 能检测安装状态、一键安装/更新、看到 Gateway 状态并一键启停。  
- 就绪时 iframe 正常显示官方 UI，未就绪时显示占位与操作按钮。  
- 辅助层布局和动态按钮区域（或 mock）就绪，为阶段 3 留好接口。

---

## 阶段 3：接入 Langchain — commit + 本地 RAG

**目标**：Langchain 服务真正参与业务；实现「commit」流程（提交/落盘）和本地 RAG（检索增强），让工具箱可记忆、可检索。

### 3.1 Langchain 服务就绪

- [ ] **langchain-serve 可调**  
  - 确认阶段 1 的 `apiPort` 稳定可用，前端或 Tauri 能直连。  
  - 提供健康检查（如 `GET /health`），前端在「需要 AI 能力」的页可轮询或首次拉取时检查。

- [ ] **基础接口**  
  - 至少一个「对话/指令」类接口（如 POST 接收用户输入，返回文本或结构化结果）。  
  - 为 commit 和 RAG 预留扩展点（如传入 `context`、`mode`）。

### 3.2 实现「commit」

- [ ] **约定 commit 的含义**  
  - 选项 A：**知识/记忆落盘**——用户或系统将「当前对话摘要、关键结论、操作记录」提交为一条可被 RAG 检索的文档，写入本地知识库。  
  - 选项 B：**配置/状态提交**——将当前配置或状态快照「提交」为一个版本，便于回溯或对比。  
  - 选项 C：**与 Git 的 commit 类比**——对「本地知识库」或「操作日志」做一次快照提交，带 message。  
  - 选定一种或组合（例如：A + C），在文档中写清「commit 是什么、触发时机、存到哪里」。

- [ ] **实现步骤**  
  - 在 langchain-serve 或单独模块中实现：接收 commit 请求（内容 + 可选 message）→ 写入本地存储（如向量库的文档表、或 JSON/文件）。  
  - 前端或 Tauri 提供入口：如「提交到知识库」按钮、或某操作完成后自动弹「是否 commit 这次结果」。  
  - 若与 RAG 共用存储，需保证 commit 的内容可被 3.3 的检索读到。

### 3.3 本地 RAG

- [ ] **数据与索引**  
  - 确定 RAG 数据来源：commit 落盘的内容、本地文档（如 Markdown）、OpenClaw/Clawbot 文档等。  
  - 选型：embedding 模型（本地或 API）+ 向量存储（如本地 SQLite+向量扩展、或简单文件索引）。  
  - 建索引流程：扫描目录或读取 commit 存储，生成 embedding 并写入向量库；支持增量更新。

- [ ] **检索与回答**  
  - Langchain 链：用户提问 → 检索相关片段（top-k）→ 拼进 prompt → 生成回答。  
  - 接口：前端发问，langchain-serve 返回答案（可流式）；可选返回引用来源（哪些 commit/文档被引用）。

- [ ] **与 Clawbot/辅助层联动**  
  - 例如：用户问「怎么配置 Telegram」时，RAG 结合文档与 commit 内容回答，并可返回「打开配置」「执行 onboard」等动态按钮（复用阶段 2 的契约）。  
  - 将「RAG 结果 + 建议操作」纳入动态按钮数据源，实现「问答 + 快捷操作」一体。

### 3.4 动态按钮接 Langchain（可选但推荐）

- [ ] **用 Langchain 生成动态按钮**  
  - 将阶段 2 的 mock 替换为：根据当前状态、最近 commit、RAG 检索结果，由 Langchain 生成「当前建议操作」列表，返回符合契约的 `actions`。  
  - 前端无需改契约，只接新接口或同接口不同实现。

### 3.5 验收

- 能对 Langchain 发起对话/指令并得到回复。  
- commit 流程跑通：提交的内容落盘，并能在 RAG 检索或后续回答中被引用。  
- 本地 RAG：指定目录或 commit 数据可被索引，提问能返回基于本地内容的答案。  
- （可选）动态按钮由 Langchain 驱动，与 Clawbot 状态和 RAG 结果联动。

---

## 依赖关系小结

- **阶段 1** 是基础：没有稳定可用的侧车与终端，阶段 2、3 的安装、命令执行、API 调用都无从谈起。  
- **阶段 2** 依赖阶段 1 的 PTY 与端口获取；不依赖 Langchain。  
- **阶段 3** 依赖阶段 1 的 langchain-serve 端口与前端直连；动态按钮部分可依赖阶段 2 的契约与占位。

建议严格按 **1 → 2 → 3** 推进；每阶段验收通过后再进入下一阶段，便于把「试验场」和「工具箱」都控制在可维护状态。

---

## 文档索引

- 侧车启动与管控思路：见 `sidecar-startup.md`（若存在）或本计划阶段 1。  
- Clawbot 集成与 iframe：见 `openclaw-integration-idea.md`（若存在）或本计划阶段 2。  
- 动态按钮契约：见 `dynamic-buttons-contract.md`（若存在）。
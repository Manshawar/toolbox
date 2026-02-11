# OpenClaw 集成方案（iframe 嵌入官方 UI + 辅助层）

本文档规整「不随 Tauri 打包 OpenClaw、在应用内按需载入，**用 iframe 嵌入 OpenClaw 官方界面**，本应用仅做**辅助层**（安装/更新、终端、状态、Langchain 动态入口）」的总体思路与可行性评估。

---

## 1. 方案概述

| 维度 | 做法 |
|------|------|
| **安装方式** | 不把 OpenClaw 打进 Tauri 安装包；在应用内通过 OpenClaw 官方方式（安装脚本 / npm）按需拉取、安装与更新。 |
| **UI 策略** | **iframe 嵌入** OpenClaw 官方 Web UI（Dashboard / Control UI 等）；**本应用不重建配置页**，只提供「辅助壳」。 |
| **辅助层职责** | 安装/更新入口、应用内 PTY 终端、Gateway 状态检测与一键启停、由 Langchain 下发的**动态按钮/快捷操作**、统一状态与错误提示。 |
| **交互通道** | **辅助层界面**（上述能力）+ **iframe 内官方 UI**（完整配置与通道管理）+ **PTY 命令行**（`openclaw` 等）。 |

---

## 2. 可行性评估

**结论：具备可行性，建议在约定好契约与状态规范后再实施。**

- **技术面**：OpenClaw 提供安装脚本与 npm 安装方式，可在应用内触发；PTY 与 HTTP 侧车已存在，可支撑终端 + API；langchain 服务可设计为「返回操作列表」，前端按列表渲染按钮，均为成熟模式。
- **产品面**：双通道兼顾普通用户（界面）与进阶用户（终端）；动态按钮便于后续扩展能力而无需频繁发版。
- **风险与前提**：需统一「各状态的样式与交互」、与 langchain 约定清晰的接口契约、并处理好安装失败/网络/服务不可用等降级与提示。

---

## 3. 架构要点

### 3.1 安装与更新（不随 Tauri 打包）

- **首次 / 未安装**：应用检测本机是否已有 `openclaw`；若无，提供「安装」入口，触发官方方式之一：
  - macOS/Linux/WSL2：`curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard`
  - Windows (PowerShell)：官方提供的 `install.ps1`（带 `-NoOnboard` 等）
- **更新**：提供「检查更新 / 更新 OpenClaw」入口，再次执行安装脚本或 `npm install -g openclaw@latest`（若本机已有 Node）。
- **注意**：执行脚本可能为系统安装 Node/全局包，需在 UI 上明确提示用户知情后再执行。

### 3.2 双通道交互

- **辅助层可视化**：安装/更新入口、Gateway 状态与一键启停、由 Langchain 下发的**动态按钮**；**配置与通道管理交给 iframe 内官方 UI**，不再自建配置编辑页。
- **命令行**：应用内 PTY 连接 pty-host，用户可直接执行 `openclaw status`、`openclaw doctor`、`openclaw gateway` 等；PATH 需包含 OpenClaw 所在位置（由安装脚本或 npm 全局安装提供）。
- **一致性**：终端内执行的启停或配置变更，应在辅助层有状态反馈；辅助层操作（如「启动 Gateway」）后，iframe 可刷新或提示用户刷新以加载官方 UI。

### 3.3 iframe 嵌入官方 UI（适配「打辅助」的解法）

- **嵌什么**：OpenClaw Gateway 启动后的 Web UI 地址（如 `openclaw dashboard` 打开的 `http://localhost:<gateway_port>` 或 Control UI 等），作为 iframe 的 `src`。端口可从 `openclaw status`、配置或环境获取。
- **何时显示 iframe**：仅在「OpenClaw 已安装且 Gateway 已启动」时加载 iframe；未安装或 Gateway 未起时，iframe 区域显示**占位与引导**（如「请先安装 OpenClaw」「请先启动 Gateway」+ 一键操作），避免空白或报错。
- **被禁止嵌入时的处理**：若官方响应头含 `X-Frame-Options: DENY` 或 CSP `frame-ancestors 'none'`，可选：(1) 查 OpenClaw 是否支持配置/环境放宽；(2) 本机反向代理该页面并去掉限制后再嵌（同源代理）。
- **与辅助层联动**：辅助层按钮（如「打开 Dashboard」「重启后刷新」）可通过改变 iframe 的 URL（如加 query）或提示用户「若未自动刷新请手动刷新」实现；若官方页支持 `postMessage`，可后续做自动刷新等增强。

### 3.4 动态按钮（langchain 服务）

- **职责**：langchain 侧车/服务根据当前上下文（配置、状态、用户意图等）返回「当前可用操作列表」，在**辅助层**展示，用于快捷操作（如「启动 Gateway」「打开 Doctor」），与 iframe 内官方能力互补。
- **契约建议**：接口返回结构至少包含：操作 id、展示文案、类型（主/次/危险）、可选参数；前端仅负责渲染与点击上报，不写死业务含义。
- **样式**：所有动态按钮统一走「一版样式与交互」规范，与静态按钮一致。

### 3.5 状态与样式规范（建议先定一版）

建议在实现前约定以下状态及对应 UI/交互，并写入单独的状态规范文档或本段扩展：

| 状态 | 说明 | 界面/交互要点 |
|------|------|----------------|
| 未安装 | 未检测到 OpenClaw | 提示 + 「安装」入口；**iframe 区域不加载**，显示「请先安装 OpenClaw」占位 |
| 安装中 | 正在执行安装脚本或 npm | 进度/loading，禁止重复点击，失败可重试 |
| Gateway 未起 | 已安装但 Gateway 未运行 | 辅助层展示「启动 Gateway」；**iframe 区域不加载或显示占位**「请先启动 Gateway」+ 一键启动 |
| 就绪 | OpenClaw 已安装且 Gateway 运行 | **iframe 加载官方 UI**；辅助层：状态、快捷操作、动态按钮 |
| 错误 | 安装失败、gateway 异常、配置错误等 | 明确错误信息 + 建议操作（重试、打开终端、查看日志） |
| langchain 不可用 | 侧车未起或超时 | 降级：仅展示静态入口或提示「部分功能不可用」；iframe 仍可独立使用 |

---

## 4. 与现有组件的关系

- **Tauri 应用**：提供窗口、菜单、路由；**前端 = 辅助层（Vue 页） + iframe（官方 UI）**；不打包 OpenClaw 二进制。
- **core 侧车**：随应用启动一次（见 [侧车启动方案](./sidecar-startup.md)），内部拉起 langchain-serve 与 pty-host。
- **pty-host**：提供 PTY，终端内可执行 `openclaw`；可选在 spawn 时把 OpenClaw 所在路径加入 PATH（若为全局安装则通常已在 PATH）。
- **langchain-serve**：提供 API；其中一类接口返回「动态操作列表」，供**辅助层**渲染按钮；并可对接 OpenClaw 配置读取、执行 openclaw 子命令等。
- **OpenClaw**：由用户本机按官方方式安装与更新；Gateway 启动后提供 Web UI，**该 URL 作为 iframe src**；应用负责触发安装/更新、检测状态，并在就绪时嵌入官方 UI。

---

## 5. 风险与注意事项

- **安装环境**：官方脚本会检测/安装 Node；Windows 上文档推荐 WSL2，若在原生 Windows 执行 PowerShell 脚本需自行验证兼容性。
- **权限与安全**：安装脚本会修改系统/用户环境，需在 UI 明确告知用户并仅在用户确认后执行。
- **契约稳定性**：动态按钮的接口与 langchain 服务需约定版本与兼容策略，避免前端与后端不同步。
- **降级**：网络失败、安装失败、langchain 不可用时，界面应有明确状态与可操作路径，不出现空白或死循环。
- **iframe 限制**：若 OpenClaw 返回 `X-Frame-Options` 或 CSP 禁止被嵌，需代理或官方支持；Gateway 未起时禁止加载 iframe，改为占位与引导，避免报错或空白。

---

## 6. 建议实施顺序（适配 iframe + 辅助层）

1. **定稿状态与样式规范**：未安装 / 安装中 / Gateway 未起 / 就绪 / 错误 / langchain 不可用；**iframe 仅在就绪时加载，其余为占位与引导**。
2. **实现「检测 + 安装/更新」**：检测 openclaw 是否存在，提供安装与更新入口并调用官方方式。
3. **实现双通道**：确保 PTY 可执行 openclaw；辅助层展示状态并与终端一致。
4. **iframe 集成**：获取 Gateway Web UI 地址（如从 status/配置）；就绪时设置 iframe `src`，未就绪时显示占位（「请先安装」「请先启动 Gateway」+ 一键操作）；若遇禁止嵌入，再考虑代理或官方配置。
5. **约定 langchain 动态按钮接口**：字段、含义、扩展方式；可选先做 mock。
6. **辅助层接入动态按钮**：在辅助区按接口渲染按钮，统一走样式规范；再与 langchain 服务联调。

---

## 7. 小结

本方案通过「**iframe 嵌入 OpenClaw 官方 UI** + **本应用只做辅助层**」明确分工：配置与通道能力交给官方页面，应用提供安装/更新、终端、状态、Langchain 动态入口。不随 Tauri 打包、按需载入、双通道与统一状态规范不变；建议以状态规范与 iframe 就绪条件为先，再按 §6 顺序落地。

---

## 8. 应用目标（基于 iframe + 辅助层的三个目的）

在「**用 iframe 嵌入 OpenClaw 官方界面、本应用只做打辅助**」的前提下，三个目标可表述为：

| 目的 | 说明 |
|------|------|
| **1. 适合个人使用的 AI 工具** | 以自己为第一用户：**一个桌面入口**即可打开官方配置与通道能力（iframe），同时获得**辅助层**的安装/更新、终端、状态、快捷操作与 Langchain 动态入口；双通道（辅助层 + 终端）按个人习惯补足官方 UI 之外的动线。 |
| **2. 最大化 Clawbot 的本地能力** | **不重复造配置页**，用 iframe 直接复用官方 UI；本应用只做「**辅助壳**」：统一入口、按需安装/更新、Gateway 状态与一键启停、与 Langchain 联动的动态按钮，让 OpenClaw 在本地更好用、可扩展，而不替代其界面。 |
| **3. 个人 IP 工具 + 检验 Langchain 学习** | 将项目作为作品与练手场：辅助层中的**动态入口、Tool/Chain/Agent 与 OpenClaw 的联动**由 Langchain 实现，在实践中验证所学，并形成可展示的个人 IP（「为 OpenClaw 打辅助的智能壳」）。 |

---

## 9. 讨论汇总

- **为何采用 iframe + 辅助层**：官网已提供配置/Control UI，自建配置页性价比低；**用 iframe 嵌入官方 UI、本应用只打辅助**，职责清晰：官方做配置与通道，我们做入口、安装/更新、终端、状态与 Langchain 动态能力。
- **动态可视化入口是否有必要**：若仅做「配置 OpenClaw」，用官方 UI 即可。在辅助层做「随场景/能力变化的智能入口/按钮」由 Langchain 决策，才有差异化价值。
- **与官网配置页的关系**：不替代，而是**嵌入 + 增强**：一个桌面入口内既有官方页（iframe），又有辅助层（安装、终端、动态按钮、状态），兼顾个人定制与可更新性。
- **Clawbot + Langchain 分工**：OpenClaw（iframe 内 + CLI）负责多通道、多 Agent、与外界对接；Langchain 负责「辅助层该展示什么入口/按钮」并输出结构化列表；前端辅助区按列表渲染，形成「智能辅助层 + 官方执行层」。

---

## 10. Langchain 在此架构中还能做什么（除编排外）

除「编排」与「动态按钮决策」外，Langchain 在本架构中还可承担以下角色，按可行性排序供优先开发参考。

| 能力 | 说明 | 在本应用中的用法 |
|------|------|------------------|
| **工具 / Tool** | 将外部能力封装为 Langchain 可调用的 Tool。 | 把「读 OpenClaw 配置」「执行 openclaw 子命令」「启停 gateway」等封装为 Tool，由 Agent 或 Chain 按需调用。 |
| **Chain** | 多步推理或调用组合。 | 例如：用户说「帮我检查 OpenClaw 并打开 Dashboard」→ Chain：检查状态 → 执行 openclaw dashboard。 |
| **RAG（检索增强）** | 基于本地文档/知识库回答或做决策。 | 把你的笔记、OpenClaw 文档、个人 SOP 做成索引，Agent 回答「怎么配置某通道」或「推荐下一步操作」时引用本地知识。 |
| **Memory / 会话** | 维护对话或会话上下文。 | 在应用内对话或指令中记住「用户偏好」「上一步做了什么」，实现多轮对话或连续操作。 |
| **路由 / Router** | 根据输入选择不同 Chain 或 Agent。 | 用户意图识别后路由到「配置类」「执行类」「查询类」等不同处理分支，再决定展示什么按钮或执行什么命令。 |
| **Agent** | 自主选择调用哪些 Tool、何时结束。 | 用户用自然语言说「把 Telegram 通道打开并限制只允许某几人」→ Agent 调用配置读取、修改、重启等 Tool 完成。 |

---

## 11. Clawbot 与 Langchain 配合可实现的功能

| 功能 | 做法 | 依赖 |
|------|------|------|
| **动态入口/按钮** | Langchain 根据当前 OpenClaw 状态、配置、用户身份返回「可用操作列表」；前端渲染。 | Langchain 能读 OpenClaw 状态/配置；约定接口契约。 |
| **自然语言执行 OpenClaw** | 用户说「检查状态并重启 gateway」；Langchain 解析意图 → 调用封装好的 openclaw Tool（status、gateway restart）。 | openclaw 以 CLI 或 API 可调用；Langchain Tool 封装。 |
| **配置问答与建议** | 用户问「怎么开 Telegram」；Langchain 结合 RAG（OpenClaw 文档/你的笔记）生成回答，并可返回「打开配置」「执行 onboard」等按钮。 | RAG 数据 + Langchain；可选与 OpenClaw 配置读取联动。 |
| **多步工作流** | 用户点「一键配置新通道」；Langchain Chain：读配置 → 生成推荐配置片段 → 写回配置 → 调用 openclaw 重启。 | Chain + OpenClaw 配置读写 Tool + gateway 重启 Tool。 |
| **个人助手 Agent** | 用户与一个「助手」对话；助手可查 OpenClaw 状态、改配置、执行命令，并记住偏好（Memory）。 | Agent + Tools（OpenClaw 相关）+ Memory。 |

---

## 12. 可行性分析与开发优先级

**原则：优先开发可行性高、且直接支撑三个应用目的的功能。**

| 功能/模块 | 可行性 | 理由 | 建议优先级 |
|-----------|--------|------|------------|
| **OpenClaw 检测 + 安装/更新入口** | 高 | 官方脚本与 npm 方式明确；侧车或 Tauri 触发即可；无 Langchain 依赖。 | P0：先打通「能用上 OpenClaw」 |
| **双通道（PTY + 辅助层）** | 高 | pty-host 已有；前端已有框架；只需保证 PATH 与状态同步。 | P0 |
| **iframe 嵌入官方 UI** | 高 | 就绪时加载 Gateway Web UI 地址；未就绪时占位与引导；若遇 X-Frame-Options/CSP 再处理代理。 | P0：与「就绪」状态同步 |
| **Langchain 动态按钮（固定契约）** | 高 | 接口约定简单（返回操作列表）；前端只渲染；可先 mock 再接真实逻辑。 | P1：验证「AI 驱动入口」 |
| **OpenClaw 配置读/写 API** | 高 | 读/写 `~/.openclaw/openclaw.json`，Node 侧车即可实现；Langchain 或前端都可调。 | P1 |
| **Langchain Tool：执行 openclaw 子命令** | 高 | 侧车 spawn openclaw CLI；Langchain 把「执行某命令」封装为 Tool，技术成熟。 | P1 |
| **Langchain Chain：状态检查 + 简单执行** | 高 | 例如「检查 → 若未运行则启动」；Chain 调用上述 Tool 即可。 | P2 |
| **RAG + 配置/文档问答** | 中 | 需准备文档与索引、选 embedding/向量库；RAG 链与 OpenClaw 文档结合。 | P2 |
| **多轮 Memory / 会话** | 中 | Langchain Memory 组件存在，需与会话边界、前端状态对齐。 | P2 |
| **自然语言 Agent（多 Tool 自主选择）** | 中 | 依赖 LLM 与上述 Tool 稳定；调试成本较高，但能最大化「个人助手」体验。 | P3 |
| **与 OpenClaw Gateway API 深度联动** | 中 | 若 OpenClaw 暴露 HTTP API，可替代部分 CLI 调用；需查文档与版本。 | P2/P3 视 API 成熟度 |

**推荐开发顺序（高可行性优先，适配 iframe + 辅助层）**  
1. P0：检测 + 安装/更新 + 双通道（PTY + 辅助层）+ **iframe 集成**（就绪时加载官方 UI，未就绪时占位与引导）。  
2. P1：配置读/写 API（供 Langchain 或辅助层用）+ 动态按钮接口（先 mock）+ Langchain Tool（执行 openclaw）。  
3. P2：简单 Chain（检查+执行）+ RAG（可选）+ Memory（可选）。  
4. P3：自然语言 Agent + 与 Gateway API 深度联动（按需）。

---

## 13. 小结

- **定位**：**iframe 嵌入 OpenClaw 官方 UI，本应用只做辅助层**——不重建配置页，最大化官方能力，辅助层提供安装/更新、终端、状态、Langchain 动态入口。  
- **应用目标**：在以上定位下，(1) 个人 AI 工具：一个桌面入口 + 官方 UI + 辅助能力；(2) 最大化 Clawbot 本地能力：复用官方界面 + 辅助壳增强；(3) 个人 IP + Langchain 练手：辅助层中的动态能力与联动由 Langchain 实现。  
- **Langchain 除编排外**：可做 Tool、Chain、RAG、Memory、路由、Agent，与 OpenClaw 状态/配置/CLI 结合，在**辅助层**实现动态入口、自然语言执行、配置问答、多步工作流与个人助手。  
- **Clawbot + Langchain 配合**：Langchain 做「决策与调度」，Clawbot（iframe 内 + CLI）做「执行与通道」；通过 Tool/Chain/Agent 把两者打通。  
- **可行性**：优先做 P0（安装、双通道、**iframe 集成**），再 P1（配置 API、动态按钮、openclaw Tool），然后 Chain、RAG、Agent，既验证学习又控制风险。

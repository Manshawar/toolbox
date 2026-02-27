# Sidecar 架构方案评分

本文对比两种在 Tauri 中运行 Node 服务（langchain-serve、pty-host）的架构，并给出评分与推荐。

---

## 最终推荐架构（含 Clawbot 时）

**打包一份 Node 进安装包，在 Tauri 里通过 spawn 运行 resource 中的打包资源（JS），是更合理的方案。**

- 一份 Node 二进制：既可被 Rust spawn 去跑 resource 里的 langchain-serve.js、pty-host.js（两服务进程隔离），又可在「安装 Clawbot」时 spawn `node path/to/npm install ...`，用户无本机 Node 也能一键装 Clawbot。
- 不依赖 pkg、不依赖首次下载 Node，路径与生命周期统一由 Rust 管理，离线可用、实现一致。

下文为两种 Sidecar 方案与两种「自带 Node」方式的分别评分；若项目需集成 Clawbot 且希望用户无 Node 可用，以本段结论为准。

---

## 方案概览

### 方案 A：单 pkg exe + 进程内 require 两 worker（当前方案）

- **实现**：使用 pkg 将 Node 运行时与两份 JS（langchain-serve.js、pty-host.js）打成一个 `core.exe`。启动时在同一进程内顺序 `require('langchain-serve.js')`、`require('pty-host.js')`，不 spawn 子进程。
- **入口**：`sidecars/build/index.js` 被 tsup 注入到 dist，由 Tauri 以 sidecar 方式启动一次 core.exe，core 内部只做 require，无子进程。

### 方案 B：单独 Node 二进制 + resource 内 JS + Rust spawn 管理

- **实现**：随应用分发一份 Node 可执行文件（如 node.exe），将 langchain-serve.js、pty-host.js 放在 Tauri 的 resource 目录。Rust 侧用 `Command::new(node_path).arg(js_path).spawn()` 分别启动两个 Node 进程，并管理生命周期（启动、退出时 kill）。
- **入口**：Tauri 的 setup 或 command 中解析 resource 路径，spawn 两个子进程。

---

## 评分维度（满分 10 分）

| 维度 | 方案 A（单 exe require） | 方案 B（Node + resource + spawn） |
|------|-------------------------|-----------------------------------|
| **实现与构建复杂度** | 8：一个 pkg 构建、无 Rust 侧进程管理 | 6：需打包 Node、处理 dev/打包路径、Rust 管理子进程 |
| **分发体积** | 8：单 exe，无额外 Node | 5：多一份 Node 运行时（约 30–50MB/平台） |
| **进程隔离与可靠性** | 5：单进程，一崩可能全挂 | 9：两进程隔离，可单独重启 |
| **可维护性** | 8：逻辑集中在 JS、无 PATH/spawn 坑 | 6：要维护 Node 多平台、路径与 spawn 逻辑 |
| **兼容性 / 踩坑风险** | 9：无 spawn、无系统 Node 依赖 | 6：spawn、路径、杀进程需处理妥当 |
| **可控性（Rust 侧）** | 5：Rust 只起一个 core，内部由 JS 决定 | 9：Rust 完全控制启停与重启策略 |

---

## 综合评分（均以 10 分为满分）

- **方案 A**：**(8+8+5+8+9+5)/6 ≈ 7.2**
- **方案 B**：**(6+5+9+6+6+9)/6 ≈ 6.8**

（若更看重「体积与简单」：方案 A 更高；若更看重「隔离与可控」：方案 B 在对应维度上更强。）

---

## 推荐结论

- **更推荐方案 A（当前方案）**，在「体积小、实现简单、无 spawn/路径坑」上优势明显，适合优先保证交付稳定和包体可控的场景。
- **在以下情况可考虑方案 B**：
  - 必须进程隔离（一个服务崩了不能影响另一个）。
  - 需要由 Rust 统一做重启、限流、资源控制等策略。
  - 可以接受多一份 Node 体积和多平台 Node 打包与路径处理。

**总结**：默认选方案 A；仅在明确需要进程隔离或更强 Rust 侧管控时，再评估切换到方案 B。

---

## Clawbot 集成与 Node 依赖：是否单独打包 Node

### 项目背景

- 本项目的两个内置服务：**langchain-serve**（Langchain API）、**pty-host**（node-pty 终端）。
- 集成 **Clawbot**（如 openclaw）时，需要在用户环境里「安装并运行」Clawbot；Clawbot 本身是 npm 包，安装需执行 `npm install ...`，运行需要 Node。

### 关键点：Clawbot 不能用来装 Node

- **不能**通过 Clawbot 给用户“装 Node”：Clawbot 依赖 Node 才能安装和运行，顺序必须是「先有 Node → 再用 npm 装 Clawbot」。
- 若用户本机**没有 Node**，只有两条路：
  1. **让用户自己装 Node**（[agent-env-dynamic-management.md](./agent-env-dynamic-management.md) 中的「阶段 A」）：应用内提示「请安装 Node.js」并给链接。实现简单，但体验差。
  2. **应用自带 Node**：不依赖用户本机 Node，由应用提供运行时，用这份 Node 执行 `npm install` 把 Clawbot 装到 `agent_env`，并在 pty 里用同一份 Node 运行 Clawbot。

### 是否单独打包 Node 的两种「自带」方式

| 方式 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| **打包 Node 进安装包** | 随应用分发一份 Node 二进制（如方案 B 的 node.exe），放在 resource 或 binaries。用这份 Node：① 跑 langchain-serve / pty-host（可选）；② 跑 `node path/to/npm install ...` 在 agent_env 装 Clawbot。 | 用户无 Node 也能一键装 Clawbot；不依赖网络、不依赖系统环境。 | 安装包体积增加约 30–50MB/平台；需维护多平台 Node 二进制。 |
| **首次运行时下载 Portable Node** | 安装包不带 Node；首次使用「安装 Clawbot」时，从官方或镜像下载 Portable Node，解压到 `app_data_dir()/node_runtime`，后续用该路径的 node/npm 装 Clawbot（见 [agent-env-dynamic-management.md](./agent-env-dynamic-management.md) 步骤 2 阶段 B）。 | 安装包小；用户无 Node 仍可一键装 Clawbot。 | 需维护下载 URL、校验和、多平台；首次安装依赖网络与下载逻辑。 |

### 与当前 Sidecar 方案的关系

- **方案 A（当前）**：core.exe 里由 pkg 嵌入了 Node，但该 Node 主要用于跑 langchain-serve 与 pty-host，**一般不**直接用来在用户目录执行 `npm install`（pkg 内 Node 的 npm/路径不易控，且 sidecar 工作目录与 agent_env 分离）。因此方案 A 下，若要做「用户无 Node 也能装 Clawbot」，仍需**额外**提供 Node：
  - 要么在应用内**打包一份 Node**（等价于引入方案 B 的 Node 二进制，仅用于 npm + 可选地跑两服务），  
  - 要么采用**首次下载 Portable Node**，不增大安装包。
- **方案 B**：若已采用「单独 Node 二进制 + resource 内 JS」，这份 Node 既可跑两服务，也可在 Rust 里 spawn `node path/to/npm install --prefix agent_env ...` 装 Clawbot，**一份 Node 同时解决「跑服务」和「装 Clawbot」**，无需用户本机有 Node。

### 两种「自带 Node」方式评分（满分 10 分）

| 维度 | 打包 Node 进安装包 | 首次运行时下载 Portable Node |
|------|--------------------|------------------------------|
| **离线/弱网可用性** | 10：安装后无需网络即可装 Clawbot | 4：首次安装 Clawbot 必须能下载 Node，失败需重试与提示 |
| **安装包体积** | 4：多约 30–50MB/平台 | 9：安装包不增大 |
| **实现与维护成本** | 8：一次打包 Node、路径固定；需随 Node 大版本更新二进制 | 5：需维护多平台下载 URL、校验和、解压与错误处理 |
| **用户体验（无 Node 用户）** | 9：打开即用，点「安装 Clawbot」即可 | 7：首次要点安装并等待下载，可能失败需重试 |
| **多平台一致性** | 7：每平台一份二进制，构建时确定 | 5：每平台不同下载源与包格式，易漏或过期 |

**综合评分**（均以 10 分为满分，权重按「可靠性优先」略偏离线与实现简单）：

- **打包 Node 进安装包**：(10+4+8+9+7)/5 = **7.6**
- **首次运行时下载 Portable Node**：(4+9+5+7+5)/5 = **6.0**

（若把「安装包体积」权重提高，下载方案会接近或反超；若把「离线可用」和「实现简单」权重提高，打包方案更占优。）

---

### 建议结论（是否单独打包 Node）

- **更推荐：打包 Node 进安装包**。理由：离线可用、实现与排查简单、不依赖首次下载成功率；多出的 30–50MB 对桌面工具而言多数场景可接受，且与「方案 B（单独 Node + spawn）」可共用同一份二进制，既跑两服务又跑 npm 装 Clawbot。
- **若强约束安装包体积**（如必须 < 50MB 或优先应用商店上架），再选「首次运行时下载 Portable Node」，并做好重试、进度与失败提示（见 [agent-env-dynamic-management.md](./agent-env-dynamic-management.md) 阶段 B）。

**若目标包含「用户没有 Node 也能通过应用一键安装 Clawbot」**：  
- **必须**以某种形式「自带 Node」：**要么打包 Node 进安装包**（推荐），**要么首次运行时下载 Portable Node**。  
**若可接受「用户需自行安装 Node」**：可不打包、不下载 Node，仅做检测与提示（阶段 A）；继续用方案 A 跑两服务即可。

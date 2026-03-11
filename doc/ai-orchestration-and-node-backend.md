# AI 编排与 Node 后端设计思路

本文描述：前端 AI 设置、默认模型与编排的关系，以及 Node 后端如何配合支持「模型编排」与前端编排层。

---

## 1. 默认模型 vs 编排层

- **默认模型（defaultModelId）**  
  - 用于**简单单模型场景**（如：单轮对话、简单问答）。  
  - 在设置页选「默认模型」即可，无需配置编排。  
  - 前端/Node 在「未指定编排」时可直接使用 `defaultModelId` 对应的平台与密钥。

- **编排层**  
  - 用于**多步骤、多模型**流程：例如「第一步用 DeepSeek 做摘要 → 第二步用百炼做改写」。  
  - 每个环节**在编排里显式指定**：用哪个平台（provider）、哪个模型（modelId）、可选参数等。  
  - 编排确定后，**不再依赖「默认模型」**；默认模型仅作「无编排时的回退」或快捷入口。

**结论**：  
- 保留「默认模型」有利于简单场景和体验。  
- 编排层按步骤指定「某环节用某平台某模型」即可，无需再依赖默认模型名称；默认模型可与编排并存，由前端/后端在「无编排时」使用。

---

## 2. 前端数据结构（与 Node 共享）

设置页与 Store 中的结构建议与 Node 一致，便于序列化传递。当前约定如下（见 `src/store/modules/aiSettings.ts`）：

```ts
// 平台 id：deepseek | bailian（可扩展）
type AIProviderId = 'deepseek' | 'bailian';

// 单平台配置
interface AIProviderConfig {
  apiKey: string;
  baseURL?: string;  // 可选自定义 endpoint
}

// 完整 AI 配置（前端 Store + 可传给 Node）
interface AISettingsState {
  providers: Record<AIProviderId, AIProviderConfig>;
  defaultModelId: string;  // 简单场景默认用的模型标识
}
```

- **后续编排**可在此基础上扩展，例如：  
  - `orchestration?: { steps: Array<{ providerId, modelId, role?, params? }> }`  
  - 前端编排 UI 只读写该结构，Node 按同一结构执行。

---

## 3. 前端：编排层使用方式（设想）

- **设置页**：只负责「模型与 API Key」和「默认模型」；编排可放在「AI 应用」或「工作流」页面。  
- **编排层**：  
  - 每个步骤可配置：平台（DeepSeek / 百炼）、模型名、系统/用户角色、温度等。  
  - 前端把编排保存为上述 `orchestration` 结构（或等价 JSON）。  
  - 调用 Node 时：把「当前 AI 配置（providers + defaultModelId）」和「本次使用的编排」一起传给 Node（见下节）。

这样：  
- 默认模型 = 无编排时的单一入口。  
- 编排层 = 多步骤时每步用哪个平台、哪个模型，由编排完全确定，不依赖默认模型名称。

---

## 4. Node 后端设计思路

### 4.1 配置来源（与前端 Store 的衔接）

- **方式 A（推荐）**：前端在发起「运行编排」或「调用 AI」时，把当前配置与编排一并传给 Node。  
  - 请求体示例：`{ aiConfig: AISettingsState, orchestration?: OrchestrationDef, input: string }`  
  - Node 不持久化密钥，仅当次请求使用；密钥始终由前端 Store 管理并随请求下发。  

- **方式 B**：Tauri 将前端写入的 `ai_config` 存到 Store/文件，Node 通过 IPC 或读文件获取。  
  - 需要 Rust 侧提供 `get_ai_config` 等 IPC，并约定与前端同一 JSON 结构。  
  - 适合「Node 常驻、前端不每次带 body」的场景。

建议优先 **方式 A**，前端 Store 为唯一真相源，Node 无状态、易扩展。

### 4.2 编排执行

- Node 提供**单一编排执行入口**，例如：  
  `POST /api/orchestration/run`  
  请求体：`{ aiConfig, orchestration, input }`  

- **orchestration** 结构示例（与前端约定一致）：

```ts
interface OrchestrationStep {
  providerId: AIProviderId;   // 'deepseek' | 'bailian'
  modelId: string;           // 具体模型名
  role?: 'system' | 'user' | 'assistant';
  params?: Record<string, unknown>;  // temperature, max_tokens 等
}

interface OrchestrationDef {
  steps: OrchestrationStep[];
  // 可选：步骤间如何传递结果（如：上一步 output 作为下一步 input）
  passOutput?: 'replace_input' | 'append';
}
```

- Node 逻辑概要：  
  1. 校验 `aiConfig.providers[step.providerId]` 存在且 apiKey 非空。  
  2. 按 `steps` 顺序调用对应平台 API（DeepSeek / 百炼），使用该步骤的 `modelId`、`params`。  
  3. 将上一步输出作为下一步输入（按 `passOutput` 规则）。  
  4. 返回最后一步结果或中间结果列表。

### 4.3 简单单模型（无编排）

- 前端不传 `orchestration`，只传 `aiConfig` + `input`。  
- Node 使用 `aiConfig.defaultModelId` 解析出平台与模型（或约定 defaultModelId 即 providerId），用 `aiConfig.providers[providerId]` 调一次 API 即可。

---

## 5. 小结

| 项目         | 说明 |
|--------------|------|
| 默认模型     | 保留；用于简单单模型场景，与编排无关。 |
| 编排层       | 每步显式指定平台+模型，不依赖默认模型。 |
| 前端 Store   | `providers` + `defaultModelId`，后续可加 `orchestration`。 |
| Node 配置来源 | 建议请求体携带 `aiConfig`（+ 可选 `orchestration`）。 |
| Node 接口    | 单入口执行编排（带 steps 的 orchestration），无编排时用 defaultModelId 单步调用。 |

按此思路，前端设置页与编排层可共用一个 AI 配置结构，Node 后端只需实现「按步骤调用多平台 API」的执行器即可。

---

## 6. Ollama 与后续模型编排的补充思路

### 6.1 Ollama：默认模型与按次传参

Ollama 通常是「一个本地服务 + 多个模型」的形态，推荐做法：

- **设置页**：只配置 Ollama 服务地址（如 `http://127.0.0.1:11434`），以及可选的「默认模型名」字段。  
- **调用时**：在编排或高级调用里，**每一步都在 `modelId` 中显式写出要用的模型名**，而不是依赖默认模型。  
- **默认模型的作用**：仅在请求里**既没有编排、也没有显式指定 `modelId`** 时，用作兜底（例如一个简单的「快速对话」入口）。

简单对齐到当前约定，可以理解为：

- `aiConfig.providers.ollama.baseURL`：Ollama 服务地址；  
- `aiConfig.defaultModelId`：一个全局兜底模型标识（可以是某个平台的某个模型 ID）；  
- 编排里的 `step.modelId`：本次真正使用的模型名，**优先级高于默认模型**。

### 6.2 前端 AI 应用的「模型编排」数据结构

后续在具体 AI 应用（或工作流）中实现「模型编排」时，前端可以采用类似如下的数据结构：

```ts
type AIProviderId = 'deepseek' | 'bailian' | 'ollama';

interface OrchestrationStep {
  id: string;
  title: string;
  providerId: AIProviderId;  // 使用哪个平台
  modelId: string;           // 平台内部模型名，如 gpt-4o / qwen2.5 / llama3.1 等
  inputFrom?: 'user' | 'prev';
  params?: {
    temperature?: number;
    maxTokens?: number;
    // 其他通用或平台特定参数
  };
}

interface OrchestrationDef {
  id: string;
  name: string;
  steps: OrchestrationStep[];
}
```

- 每个 AI 应用可以绑定一个 `OrchestrationDef`，存放在 SQLite 或 tauriStore 的某个 key 下。  
- 前端编排 UI 只读写这份 JSON，不关心具体 SDK 调用细节。

### 6.3 前端到 Node（Sidecar）的数据共享方式

推荐沿用前文的 **方式 A**：前端在调用时一次性把配置与编排发给 Node：

```ts
interface RunOrchestrationRequest {
  aiConfig: AISettingsState;     // 当前启用的平台 + 地址/API Key
  orchestration: OrchestrationDef;
  input: string;                 // 初始用户输入
  context?: Record<string, any>; // 可选业务上下文
}
```

- `aiConfig` 可以来自 Pinia + tauriStore 的合并结果（即当前设置页保存的配置）。  
- `orchestration` 来自具体 AI 应用的「编排编辑器」。  
- Node Sidecar 收到这个请求后：
  1. 逐步读取 `steps`，根据 `providerId` 选择 DeepSeek / 百炼 / Ollama 客户端；  
  2. 使用 `modelId` 与 `params` 调用对应接口；  
  3. 根据 `inputFrom` 把每步输出串联起来；  
  4. 返回每一步的结果与最终结果。

这样设计的好处：

- **前端与 Node 共享的只是一个清晰的 JSON 结构**（`aiConfig + orchestration`），易于演进。  
- Node 不需要自己维护复杂状态，始终「按请求执行一遍编排」即可。  
- 对于 Ollama，只要 `aiConfig.providers.ollama.baseURL` 指向正确地址，编排里的 `providerId: 'ollama' + modelId` 就可以自由组合本地模型。

---

## 7. 三种数据方式：store / HTTP / SQLite 怎么选、怎么结合

用一句话区分：

| 方式 | 适合存什么 | 一句话 |
|------|------------|--------|
| **Store（store.json / Tauri Store）** | 少量配置、键值 | 「应用自己的设置，启动就要读到，不关心复杂查询。」 |
| **HTTP 请求体** | 不存，只传 | 「每次调用时，把「当前配置 + 这次要跑的编排」塞进请求体发给 Node。」 |
| **SQLite** | 列表、历史、要查要筛 | 「编排有多少条、对话记录、会话列表等，要按条件查、会越积越多。」 |

### 推荐结合方式（简单版）

1. **Store（或 store.json）**  
   - 存：**AI 配置**（API Key、Ollama 地址、模型开关、默认模型等）。  
   - 特点：键值、量小、前端和 Node 都能读（例如 Node 通过 IPC 或读同一份文件）。  
   - 谁写：设置页改完就写 Store。  
   - 谁用：前端启动时读；Node 需要时也可以读，但更推荐「前端在请求里带一份」见下条。

2. **HTTP 发送（请求体）**  
   - 不「存」数据，而是**每次运行编排时**，把当前要用的东西放进请求体。  
   - 请求体里至少包含：`aiConfig`（当前配置，可从 Store 读出来）+ `orchestration`（这次要跑的编排）+ `input`（用户输入）。  
   - 特点：Node 无状态、不存密钥，每次请求自带完整信息，简单可靠。  
   - 所以：**配置存在 Store，但「用」的时候是通过 HTTP 带过去。**

3. **SQLite**  
   - 存：**编排定义列表**（多个 OrchestrationDef）、**对话/会话历史**等需要「列表、查询、分页」的数据。  
   - 特点：结构化、可按条件查、数据量可以很大。  
   - 谁写：前端（或 Node 代写）在「保存编排」「保存对话」时写 SQLite。  
   - 谁用：前端要展示「我的编排列表」「某次对话记录」时查 SQLite；运行某条编排时，从 SQLite 取出那一条的 JSON，和 aiConfig 一起放进 HTTP 请求体发给 Node。

### 数据流小结（人话版）

- **设置页改 API Key / Ollama 地址** → 写入 **Store**（和现在一样）。  
- **用户保存一个编排** → 写入 **SQLite**（或先写内存再落库）。  
- **用户点击「运行编排」** → 前端从 Store 读 **aiConfig**，从 SQLite（或内存）读**当前选中的编排**，和 **input** 一起组成请求体，**HTTP 发给 Node**。  
- Node 只收请求体，不关心配置存在哪、编排存在哪，按请求体执行完返回结果即可。

这样：**Store = 配置的家，SQLite = 编排和业务数据的家，HTTP = 把「这次要用的配置 + 编排」一次性带给 Node 的传送带。**

---

## 8. Langchain Node 做编排时：前端与后端分别做什么

当由 **Langchain Node**（或任意 Node Sidecar）负责执行编排时，前后端可以这样分工：

### 前端

- **配置**：设置页维护 aiConfig（API Key、Ollama 地址 + 默认模型名等），写入 Store / tauriStore，不直接发给 Node 存。
- **编排编辑**：提供类似 Dify 的「步骤列表」：每一步选平台（如 DeepSeek / 百炼 / Ollama）、模型名、输入来源（用户 / 上一步）等；**步骤顺序即执行顺序**，可拖拽排序。
- **保存编排**：将当前编排存为一条记录（如 SQLite 或内存），不执行。
- **运行编排**：用户点击运行时，从 Store 取 **aiConfig**，从存储取**当前选中的编排 JSON**，加上 **input**（及可选 context），组成请求体 **HTTP POST 给 Node**。
- **结果展示**：接收 Node 返回的每一步结果或最终结果，做展示或再加工。

### 后端（Node / Langchain）

- **只收请求体**：不读 Store、不读 SQLite，只收 `{ aiConfig, orchestration, input, context? }`。
- **按顺序执行**：按 `orchestration.steps` 的**数组顺序**依次执行；每一步根据 `providerId` 选客户端（DeepSeek / 百炼 / Ollama），用该步的 `modelId` 和 `params` 调接口；`inputFrom === 'prev'` 时用上一步输出作为本步输入。
- **Ollama**：用 `aiConfig.providers.ollama.baseURL` 和该步的 `modelId`（若未传则用 `aiConfig.providers.ollama.defaultModel`），调 Ollama API。
- **返回**：把每步结果或最终结果返回给前端。

这样：**前端 = 配置 + 编排编辑 + 发起请求；Node = 无状态执行器，只认请求体里的编排顺序。**

---

## 9. 智能 Commit 等流程：是否需要像 Dify 一样可编排顺序？

**需要。** 像智能 Commit（先生成说明、再格式化、再提交等）这类流程，本质就是「多步顺序执行」，和 Dify 的编排一致：

- **顺序有意义**：先分析 diff → 再生成 commit message → 再执行 git commit，顺序不能乱。
- **建议**：编排的 `steps` 使用**有序数组**，前端用**拖拽排序**调整顺序（类似 Dify），保存后 Node 严格按数组顺序执行。
- **实现要点**：
  - 前端：步骤列表用数组存储，支持拖拽改变顺序；保存/请求时按当前顺序下发。
  - Node：不关心步骤 ID，只按 `steps[0], steps[1], ...` 依次执行，上一步输出作为下一步输入（按 `inputFrom` 约定）。

结论：**只要是多步流程（智能 Commit、多模型串联等），编排都应支持「可排序的顺序」，和 Dify 一样；前后端约定「steps 数组顺序 = 执行顺序」即可。**

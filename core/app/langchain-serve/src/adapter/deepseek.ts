import { ChatDeepSeek } from "@langchain/deepseek";

// ==================== 模型配置 ====================
const CONFIG = {
  llm: {
    model: "deepseek-chat",
    temperature: 0.3,
    maxTokens: 2000,
    apiKey: process.env.DEEPSEEK_API_KEY,
    streaming: false,
  },
} as const;

// ==================== 模型创建 ====================

/**
 * 创建模型实例
 */
export function createModel(temperature?: number) {
  return new ChatDeepSeek({
    ...CONFIG.llm,
    temperature: temperature ?? CONFIG.llm.temperature,
  });
}
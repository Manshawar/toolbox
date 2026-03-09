import { AlibabaTongyiEmbeddings } from "@langchain/community/embeddings/alibaba_tongyi";

// ==================== 配置 ====================

export type BailianEmbeddingsConfig = {
  /** 模型名，默认 text-embedding-v4 */
  modelName?: AlibabaTongyiEmbeddings["modelName"];
  /** API Key，默认从环境变量 DASHSCOPE_API_KEY 读取 */
  apiKey?: string;
  /** 单次请求最大文档数，默认 25，阿里上限 2048 */
  batchSize?: number;
  /** 是否去除换行，默认 true */
  stripNewLines?: boolean;
};

const DEFAULT_CONFIG = {
  modelName: "text-embedding-v4" as const,
  apiKey: process.env.DASHSCOPE_API_KEY,
  batchSize: 25,
  stripNewLines: true,
};

// ==================== 客户端 ====================

let _embeddings: AlibabaTongyiEmbeddings | null = null;

/**
 * 获取或创建百炼 Embeddings 单例（懒加载，避免未用时读 env）
 */
function getEmbeddings(config?: BailianEmbeddingsConfig): AlibabaTongyiEmbeddings {
  if (!_embeddings) {
    const apiKey = config?.apiKey ?? DEFAULT_CONFIG.apiKey;
    if (!apiKey) {
      throw new Error("Missing DASHSCOPE_API_KEY: set env or pass config.apiKey");
    }
    _embeddings = new AlibabaTongyiEmbeddings({
      modelName: config?.modelName ?? DEFAULT_CONFIG.modelName,
      apiKey,
      batchSize: config?.batchSize ?? DEFAULT_CONFIG.batchSize,
      stripNewLines: config?.stripNewLines ?? DEFAULT_CONFIG.stripNewLines,
    });
  }
  return _embeddings;
}

/**
 * 重置客户端（主要用于测试或切换配置）
 */
export function resetBailianEmbeddings(): void {
  _embeddings = null;
}

// ==================== 对外能力：向量化后存库 ====================

/**
 * 单条文本/代码向量化，用于写入向量库。
 * 使用 text_type: "document"，适合做检索底库。
 *
 * @param text 单条内容（如一段代码、一个文档块）
 * @param config 可选，覆盖默认 Embeddings 配置
 * @returns 向量数组，可直接写入 Milvus 等向量库
 */
export async function embedForStorage(
  text: string,
  config?: BailianEmbeddingsConfig
): Promise<number[]> {
  const client = getEmbeddings(config);
  const embeddings = await client.embedDocuments([text]);
  return embeddings[0]!;
}

/**
 * 批量文本/代码向量化，用于批量写入向量库。
 * 使用 text_type: "document"，适合建索引、批量导入。
 *
 * @param texts 多条内容（如多个代码片段、多个 chunk）
 * @param config 可选，覆盖默认 Embeddings 配置
 * @returns 与 texts 一一对应的向量数组
 */
export async function embedManyForStorage(
  texts: string[],
  config?: BailianEmbeddingsConfig
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = getEmbeddings(config);
  return client.embedDocuments(texts);
}

// ==================== 对外能力：检索用查询向量 ====================

/**
 * 将「用户查询」向量化，用于在向量库中做相似度检索。
 * 与存库时使用 document、检索时使用 query 搭配效果更好（非对称检索）。
 *
 * @param query 用户查询语句（如「年假怎么休」）
 * @param config 可选
 * @returns 查询向量，用于与库中 document 向量做相似度计算
 */
export async function embedForQuery(
  query: string,
  config?: BailianEmbeddingsConfig
): Promise<number[]> {
  const client = getEmbeddings(config);
  return client.embedQuery(query);
}

// ==================== 可选：直接暴露底层实例 ====================

/**
 * 获取底层 AlibabaTongyi Embeddings 实例（需要自己控制 text_type、batch 等时使用）
 */
export function getBailianEmbeddingsClient(
  config?: BailianEmbeddingsConfig
): AlibabaTongyiEmbeddings {
  return getEmbeddings(config);
}

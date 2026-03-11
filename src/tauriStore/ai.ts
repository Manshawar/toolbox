import { getStore } from './index';

/** 供后端取用：AI 配置结构，与 store/modules/aiSettings 的 payload 一致 */
export interface AIConfigPayload {
  models: { id: string; name: string; enabled: boolean }[];
  providers: Record<
    string,
    { apiKey?: string; enabled: boolean; baseURL?: string; defaultModel?: string }
  >;
  defaultModelId: string;
}

const AI_CONFIG_KEY = 'ai_config';

const ALL_PROVIDER_IDS = ['deepseek', 'bailian', 'ollama'] as const;
const DEFAULT_PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  bailian: '百炼',
  ollama: 'Ollama',
};

export async function setAiConfig(payload: AIConfigPayload): Promise<void> {
  const s = await getStore();
  if (s) await s.set(AI_CONFIG_KEY, payload as unknown as Record<string, unknown>);
}

export async function getAiConfig(): Promise<AIConfigPayload | null> {
  const s = await getStore();
  const raw = s ? await s.get<AIConfigPayload>(AI_CONFIG_KEY) : null;
  return raw ?? null;
}

/** Pinia persist 用的 storage 适配器：读写走 getAiConfig/setAiConfig，需在应用启动时先调用 init() */
export const aiPersistStorage = {
  cache: null as string | null,

  async init(): Promise<void> {
    const raw = await getAiConfig();
    if (!raw) {
      this.cache = null;
      return;
    }
    const existingModels = raw.models ?? [];
    const existingProviders = raw.providers ?? {};
    const models = ALL_PROVIDER_IDS.map((id) => {
      const m = existingModels.find((x) => x.id === id);
      return m ?? { id, name: DEFAULT_PROVIDER_NAMES[id] ?? id, enabled: false };
    });
    const providers: Record<string, { apiKey?: string; baseURL?: string; defaultModel?: string }> = {};
    for (const id of ALL_PROVIDER_IDS) {
      const p = existingProviders[id];
      if (id === 'ollama') {
        providers[id] = {
          baseURL: p?.baseURL ?? 'http://127.0.0.1:11434',
          defaultModel: p?.defaultModel ?? '',
        };
      } else {
        providers[id] = { apiKey: p?.apiKey ?? '' };
      }
    }
    const forStore = { models, providers, defaultModelId: raw.defaultModelId ?? 'deepseek' };
    this.cache = JSON.stringify(forStore);
  },

  getItem(_key: string): string | null {
    return this.cache;
  },

  setItem(_key: string, value: string): void {
    try {
      const parsed = JSON.parse(value) as {
        models: AIConfigPayload['models'];
        providers: Record<string, { apiKey?: string; baseURL?: string; defaultModel?: string }>;
        defaultModelId: string;
      };
      const payload: AIConfigPayload = {
        models: parsed.models,
        providers: Object.fromEntries(
          (parsed.models ?? []).map((m) => [
            m.id,
            {
              apiKey: parsed.providers?.[m.id]?.apiKey ?? '',
              enabled: m.enabled ?? false,
              baseURL: parsed.providers?.[m.id]?.baseURL,
              defaultModel: parsed.providers?.[m.id]?.defaultModel,
            },
          ])
        ),
        defaultModelId: parsed.defaultModelId ?? 'deepseek',
      };
      setAiConfig(payload);
    } finally {
      this.cache = value;
    }
  },
};

/** 应用启动时调用，在首次使用 aiSettings store 之前 */
export async function initAiPersistStorage(): Promise<void> {
  await aiPersistStorage.init();
}

import { defineStore } from 'pinia';
import { store } from '..';
import { aiPersistStorage, type AIConfigPayload } from '@/tauriStore';

/** 支持的 AI 平台 */
export type AIProviderId = 'deepseek' | 'bailian' | 'ollama';

/** 单模型项（列表展示与启用状态） */
export interface AIModelItem {
  id: AIProviderId;
  name: string;
  enabled: boolean;
}

/** 单平台配置。deepseek/bailian 用 apiKey；ollama 用 baseURL + defaultModel（无 key） */
export interface AIProviderConfig {
  apiKey?: string;
  /** Ollama 服务地址，如 http://127.0.0.1:11434 */
  baseURL?: string;
  /** Ollama 默认模型名，调用时未传 model 则用此值；编排或参数可覆盖 */
  defaultModel?: string;
}

/** 前端 AI 配置状态，与 AIConfigPayload 结构对应 */
export interface AISettingsState {
  models: AIModelItem[];
  providers: Record<AIProviderId, AIProviderConfig>;
  defaultModelId: string;
}

const PROVIDER_IDS: AIProviderId[] = ['deepseek', 'bailian', 'ollama'];

const DEFAULT_MODEL_NAMES: Record<AIProviderId, string> = {
  deepseek: 'DeepSeek',
  bailian: '百炼',
  ollama: 'Ollama',
};

function defaultProviderConfig(providerId?: AIProviderId): AIProviderConfig {
  if (providerId === 'ollama') {
    return { baseURL: 'http://127.0.0.1:11434', defaultModel: '' };
  }
  return { apiKey: '' };
}

function defaultModels(): AIModelItem[] {
  return PROVIDER_IDS.map((id) => ({
    id,
    name: DEFAULT_MODEL_NAMES[id],
    enabled: false,
  }));
}

function defaultState(): AISettingsState {
  const providers = {} as Record<AIProviderId, AIProviderConfig>;
  PROVIDER_IDS.forEach((id) => {
    providers[id] = defaultProviderConfig(id);
  });
  return {
    models: defaultModels(),
    providers,
    defaultModelId: 'deepseek',
  };
}

export const useAISettingsStore = defineStore('aiSettings', {
  state: (): AISettingsState => defaultState(),

  getters: {
    /** 供 Node/后端使用：与 tauriStore 一致的 payload。providers[id].enabled 与上方模型开关一致 */
    payload(state): AIConfigPayload {
      return {
        models: state.models.map((m) => ({ id: m.id, name: m.name, enabled: m.enabled })),
        providers: Object.fromEntries(
          PROVIDER_IDS.map((id) => [
            id,
            {
              apiKey: state.providers[id]?.apiKey ?? '',
              enabled: state.models.find((m) => m.id === id)?.enabled ?? false,
              baseURL: state.providers[id]?.baseURL,
              defaultModel: state.providers[id]?.defaultModel,
            },
          ])
        ) as AIConfigPayload['providers'],
        defaultModelId: state.defaultModelId,
      };
    },
    providerIds: () => PROVIDER_IDS,
  },

  actions: {
    setModelEnabled(id: AIProviderId, enabled: boolean) {
      const m = this.models.find((x) => x.id === id);
      if (m) m.enabled = enabled;
    },
    setProviderConfig(providerId: AIProviderId, config: Partial<AIProviderConfig>) {
      if (!this.providers[providerId]) this.providers[providerId] = defaultProviderConfig(providerId);
      Object.assign(this.providers[providerId], config);
    },
    setDefaultModelId(id: string) {
      this.defaultModelId = id;
    },
  },

  persist: {
    key: 'aiSettings',
    storage: aiPersistStorage,
    pick: ['models', 'providers', 'defaultModelId'],
  },
});

export function useAISettingsStoreHook() {
  return useAISettingsStore(store);
}

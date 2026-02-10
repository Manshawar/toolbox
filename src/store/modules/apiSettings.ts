import { defineStore } from 'pinia';
import { merge, pick } from 'lodash';
import { read, write } from '@/utils/tauri-store';
import { store } from '@/store';

const TAURI_STORE_PATH = 'api-settings.bin';
const STORE_KEY = 'apiSettings';

const API_SETTINGS_KEYS = ['apiProvider', 'apiModel', 'apiKey'] as const;

export type ApiProvider = 'deepseek' | 'bailian';

export interface ApiSettingsState {
  apiProvider: ApiProvider;
  apiModel: string;
  apiKey: string;
}

const defaultState: ApiSettingsState = {
  apiProvider: 'deepseek',
  apiModel: '',
  apiKey: '',
};

const VALID_PROVIDERS: ApiProvider[] = ['deepseek', 'bailian'];

function normalizeFromStore(raw: Record<string, unknown> | null): Partial<ApiSettingsState> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const picked = pick(raw, API_SETTINGS_KEYS) as Record<keyof ApiSettingsState, unknown>;
  const out: Partial<ApiSettingsState> = {};
  if (VALID_PROVIDERS.includes(picked.apiProvider as ApiProvider)) out.apiProvider = picked.apiProvider as ApiProvider;
  if (typeof picked.apiModel === 'string') out.apiModel = picked.apiModel;
  if (typeof picked.apiKey === 'string') out.apiKey = picked.apiKey;
  return out;
}

export const useApiSettingsStore = defineStore('apiSettings', {
  state: (): ApiSettingsState => ({ ...defaultState }),

  actions: {
    async loadFromTauriStore() {
      const raw = await read<Record<string, unknown>>(TAURI_STORE_PATH, STORE_KEY);
      const patch = normalizeFromStore(raw);
      Object.assign(this, merge({}, defaultState, patch));
    },

    async saveToTauriStore() {
      await write(TAURI_STORE_PATH, STORE_KEY, {
        apiProvider: this.apiProvider,
        apiModel: this.apiModel,
        apiKey: this.apiKey,
      });
    },
  },
});

export function useApiSettingsStoreHook() {
  return useApiSettingsStore(store);
}

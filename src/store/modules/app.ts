import { defineStore } from 'pinia';
import { store } from '@/store';
import { getDefaultAppConfig, type AppConfig, type AppState } from '../types';

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    appConfigMode: getDefaultAppConfig(),
  }),
  getters: {
    appConfig(): AppConfig {
      return this.appConfigMode;
    },
  },
  actions: {
    setAppConfigMode(data: Partial<AppConfig>): void {
      this.appConfigMode = { ...this.appConfigMode, ...data };
    },
  },
  persist: {
    key: 'app-config',
    storage: localStorage,
  },
});

export function useAppStoreHook() {
  return useAppStore(store);
}

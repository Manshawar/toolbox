import { defineStore } from 'pinia';
import { store } from '@/store';
import type { AppConfig, AppState } from '../types';

/** 从 public/serverConfig.json 拉取配置（Vite 下 public 静态资源在根路径） */
const SERVER_CONFIG_URL = '/serverConfig.json';

const useAppStore = defineStore('app', {
  state: (): AppState => ({
    appConfigMode: {} as AppConfig,
  }),
  getters: {
    getAppConfigMode(): AppConfig {
      return this.appConfigMode;
    },
    /** 是否已有持久化或已拉取过的配置（有 title 视为有效） */
    hasConfig(): boolean {
      return Boolean(this.appConfigMode?.title);
    },
  },
  actions: {
    setAppConfigMode(data: AppConfig): void {
      this.appConfigMode = data;
    },
    /** 从 public/serverConfig.json 拉取并写入 state，持久化由 persist 负责 */
    async loadServerConfig(): Promise<AppConfig> {
      const res = await fetch(SERVER_CONFIG_URL);
      if (!res.ok) {
        throw new Error(
          'public 文件夹下无法查找到 serverConfig 配置文件\nUnable to find serverConfig configuration file under public folder',
        );
      }
      const data = (await res.json()) as AppConfig;
      this.setAppConfigMode(data);
      return data;
    },
  },
  persist: {
    key: 'appConfigMode',
    storage: localStorage,
    pick: ['appConfigMode'],
  },
});

export function useAppStoreHook() {
  return useAppStore(store);
}

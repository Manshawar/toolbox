import type { App } from 'vue';
import { useApiSettingsStoreHook } from '@/store/modules/apiSettings';

let initPromise: Promise<void> | null = null;

/**
 * Vue 插件：在 install 时启动 Tauri Store 的初始化（如从磁盘恢复 API 配置到 Pinia）。
 * 不阻塞挂载，调用方可通过 whenTauriStoreReady() 在挂载前 await。
 */
export const tauriStoreInitPlugin = {
  install(_app: App) {
    if (!initPromise) {
      initPromise = useApiSettingsStoreHook().loadFromTauriStore();
    }
  },
};

/** 返回初始化完成的 Promise，挂载前 await 即可等待 Tauri Store 恢复完成。 */
export function whenTauriStoreReady(): Promise<void> {
  return initPromise ?? Promise.resolve();
}

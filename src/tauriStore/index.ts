import { LazyStore } from '@tauri-apps/plugin-store';
import { useTauriConfigStore } from '@/store/modules/tauriConfig';

/** Tauri 持久化键值存储，首次使用时懒加载。API：set/get 等均为 async */

export const store = async (): Promise<InstanceType<typeof LazyStore>> => {
  const storeName = useTauriConfigStore().store_name;
  if (!storeName) throw new Error('Store name is not set');
  return new LazyStore(storeName);
};

let storeInstance: InstanceType<typeof LazyStore> | null = null;

/** 供 ai.ts 等子模块使用，首次使用时懒加载 */
export async function getStore(): Promise<InstanceType<typeof LazyStore> | null> {
  if (storeInstance) return storeInstance;
  try {
    storeInstance = await store();
    return storeInstance;
  } catch {
    return null;
  }
}

export const setConfig = async (config: Record<string, unknown>) => {
  const s = await getStore();
  if (s) await s.set('config', config);
};

export const getConfig = async () => {
  const s = await getStore();
  return s ? await s.get('config') : null;
};

export {
  setAiConfig,
  getAiConfig,
  initAiPersistStorage,
  aiPersistStorage,
  type AIConfigPayload,
} from './ai';
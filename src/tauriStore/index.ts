import { LazyStore } from '@tauri-apps/plugin-store';
import { useTauriConfigStore } from '@/store/modules/tauriConfig';
/** Tauri 持久化键值存储，首次访问时自动加载。API：set/get/save 等均为 async */

export const store = async ()=>{
  try {
    const storeName = useTauriConfigStore().store_name;
    if (!storeName) {
      throw new Error('Store name is not set');
    }
    return new LazyStore(storeName);
  } catch (error) {
    throw new Error('Failed to create store: ' + error);
  }
}
const storeInstance = await store();
export const setConfig = async (config: Record<string, unknown>) => {
  return await storeInstance.set('config', config);
};

export const getConfig = async () => {
  return await storeInstance.get('config');
};
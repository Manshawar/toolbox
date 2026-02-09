import { defineStore } from 'pinia';
import { store } from '@/store';

export interface PermissionState {
  cachePageList: string[];
}

export const usePermissionStore = defineStore('permission', {
  state: (): PermissionState => ({
    cachePageList: [],
  }),
  actions: {
    cacheOperate(_: { mode: 'add' | 'delete' | 'sync'; name?: string }) {
      // no-op for local layout
    },
  },
});

export function usePermissionStoreHook() {
  return usePermissionStore(store);
}

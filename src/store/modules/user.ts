import { defineStore } from 'pinia';
import { store } from '@/store';

export interface UserState {
  userInfo: unknown;
  roles: unknown;
}

export const useUserInfoStore = defineStore('userInfo', {
  state: (): UserState => ({
    userInfo: null,
    roles: null,
  }),
  actions: {
    setUserInfo(_value: unknown) {},
    setRoles(_value: unknown) {},
    removeUserInfo() {
      this.userInfo = null;
      this.roles = null;
    },
  },
});

export function useUserInfoStoreHook() {
  return useUserInfoStore(store);
}

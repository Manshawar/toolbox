import { defineStore } from 'pinia';
import type { RoleEnum } from '@/enum/role';
import type { UseInfoType } from '@/server/useInfo';
import { store } from '..';

export interface UserState {
  userInfo: UseInfoType | null;
  roles: RoleEnum | null;
}

const useUserInfoStore = defineStore('userInfo', {
  state: (): UserState => ({
    userInfo: null,
    roles: null,
  }),
  actions: {
    setUserInfo(value: UseInfoType) {
      this.userInfo = value;
      this.roles = value.role;
    },
    setRoles(value: RoleEnum) {
      this.roles = value;
    },
    removeUserInfo() {
      this.userInfo = null;
      this.roles = null;
    },
  },
  persist: {
    key: 'userInfo',
    storage: localStorage,
    pick: ['userInfo', 'roles'],
  },
});

export const useUserInfoStoreHook = () => {
  return useUserInfoStore(store);
};

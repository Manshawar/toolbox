import { defineStore } from "pinia";
import { store } from "..";

/** 与 src-tauri resource/settings.json、config.rs get_config 返回结构一致 */
export interface TauriAppConfig {
  sqlite_db_name: string;
}

const DEFAULT_SQLITE_DB_NAME = "test.db";

const useTauriConfigStore = defineStore("tauriConfig", {
  state: (): TauriAppConfig => ({
    sqlite_db_name: DEFAULT_SQLITE_DB_NAME,
  }),
  getters: {
    /** 供 SQL adapter 使用：sqlite:${name} */
    sqliteDbName: (state): string => state.sqlite_db_name || DEFAULT_SQLITE_DB_NAME,
  },
  actions: {
    setFromIpc(payload: TauriAppConfig) {
      this.sqlite_db_name = payload.sqlite_db_name?.trim() || DEFAULT_SQLITE_DB_NAME;
    },
  },
});

export function useTauriConfigStoreHook() {
  return useTauriConfigStore(store);
}

export { useTauriConfigStore };

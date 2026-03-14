import { defineStore } from "pinia";
import { store } from "..";

/** 与 src-tauri resource/settings.json、get_config 返回的 JSON 一致 */
export interface TauriAppConfig {
  sqlite_db_name: string;
  api_port: number;
  store_name: string;
}

const DEFAULT_SQLITE_DB_NAME = "test.db";
const DEFAULT_API_PORT = 8264;
const DEFAULT_STORE_NAME = "";
const useTauriConfigStore = defineStore("tauriConfig", {
  state: (): TauriAppConfig => ({
    sqlite_db_name: DEFAULT_SQLITE_DB_NAME,
    api_port: DEFAULT_API_PORT,
    store_name: DEFAULT_STORE_NAME,
  }),
  getters: {
    /** 供 SQL adapter 使用：sqlite:${name} */
    sqliteDbName: (state): string => state.sqlite_db_name || DEFAULT_SQLITE_DB_NAME,
  },
  actions: {
    /** 解析 IPC 返回的 JSON（可能缺键），写入 state */
    setFromIpc(payload: Record<string, unknown>) {
      console.log("[tauriConfig] setFromIpc", payload);
     Object.assign(this, payload);
    },
  },
  persist: {
    key: "tauriConfig",
    storage: localStorage,
    pick: ["sqlite_db_name"],
  },
});

export function useTauriConfigStoreHook() {
  return useTauriConfigStore(store);
}

export { useTauriConfigStore };

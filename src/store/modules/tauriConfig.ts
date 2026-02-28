import { defineStore } from "pinia";
import { store } from "..";

/** 与 src-tauri resource/settings.json、get_config 返回的 JSON 一致 */
export interface TauriAppConfig {
  sqlite_db_name: string;
  api_port: number;
  pty_port: number;
}

const DEFAULT_SQLITE_DB_NAME = "test.db";
const DEFAULT_API_PORT = 8264;
const DEFAULT_PTY_PORT = 8265;

const useTauriConfigStore = defineStore("tauriConfig", {
  state: (): TauriAppConfig => ({
    sqlite_db_name: DEFAULT_SQLITE_DB_NAME,
    api_port: DEFAULT_API_PORT,
    pty_port: DEFAULT_PTY_PORT,
  }),
  getters: {
    /** 供 SQL adapter 使用：sqlite:${name} */
    sqliteDbName: (state): string => state.sqlite_db_name || DEFAULT_SQLITE_DB_NAME,
  },
  actions: {
    /** 解析 IPC 返回的 JSON（可能缺键），写入 state */
    setFromIpc(payload: Record<string, unknown>) {
      const s = payload.sqlite_db_name;
      this.sqlite_db_name =
        typeof s === "string" && s.trim() ? s.trim() : DEFAULT_SQLITE_DB_NAME;
      const a = payload.api_port;
      this.api_port =
        typeof a === "number" && a > 0 && a < 65536 ? a : DEFAULT_API_PORT;
      const p = payload.pty_port;
      this.pty_port =
        typeof p === "number" && p > 0 && p < 65536 ? p : DEFAULT_PTY_PORT;
    },
  },
  persist: {
    key: "tauriConfig",
    storage: localStorage,
    pick: ["sqlite_db_name", "api_port", "pty_port"],
  },
});

export function useTauriConfigStoreHook() {
  return useTauriConfigStore(store);
}

export { useTauriConfigStore };

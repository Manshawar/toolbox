import type { Pinia } from "pinia";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";

/** 与 src-tauri resource/settings.json、config.rs get_config 返回结构一致 */
export type TauriAppConfigPayload = { sqlite_db_name: string };

/**
 * 从 IPC get_config 读取 resource/settings.json，写入 Pinia。
 * 需在 Pinia 安装后调用；非 Tauri 或失败时保留 store 默认值。
 */
export async function initTauriConfig(pinia: Pinia): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const cfg = await invoke<TauriAppConfigPayload>("get_config");
    useTauriConfigStore(pinia).setFromIpc(cfg);
  } catch {
    // 非 Tauri 或未就绪，使用 store 默认值 test.db
  }
}

import type { Pinia } from "pinia";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";

/**
 * 从 IPC get_config 读取 settings.json（后端直接返回 JSON），解析后写入 Pinia。
 * 需在 Pinia 安装后调用；非 Tauri 或失败时保留 store 默认值。
 */
export async function initTauriConfig(pinia: Pinia): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const cfg = await invoke<Record<string, unknown>>("get_config");
    useTauriConfigStore(pinia).setFromIpc(cfg ?? {});
  } catch {
    // 非 Tauri 或未就绪，使用 store 默认值
  }
}

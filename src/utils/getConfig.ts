import type { Pinia } from "pinia";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";
import { setCoreReady } from "@/utils/axios/tauriHttp";
import { ElMessage } from "element-plus";

/**
 * 从 IPC get_config 读取 settings.json（后端直接返回 JSON），解析后写入 Pinia。
 * 需在 Pinia 安装后调用；非 Tauri 或失败时保留 store 默认值。
 * 同时监听 core-ready 事件，更新服务就绪状态。
 */
export async function initTauriConfig(pinia: Pinia): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const cfg = await invoke<Record<string, unknown>>("get_config");
    useTauriConfigStore(pinia).setFromIpc(cfg ?? {});

    // 监听 Core 服务就绪事件
    const { listen } = await import("@tauri-apps/api/event");
    await listen("core-ready", (event) => {
      const payload = event.payload as { ready: boolean; apiPort?: number };
      console.log("[getConfig] 收到 core-ready 事件:", payload);
      if (payload.ready) {
        setCoreReady(true);
        ElMessage.success("Core 服务已启动");
      }
    });
    console.log("[getConfig] 已监听 core-ready 事件");
  } catch {
    // 非 Tauri 或未就绪，使用 store 默认值
  }
}

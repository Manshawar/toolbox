/**
 * 用 config 端口覆盖 request / ptyWs 的 baseURL。
 * 端口来自 get_config（initTauriConfig 已拉取）：若 Tauri 已启动 sidecar 则已含分配端口，否则为 settings.json 端口。
 */
import { request, ptyWs } from "@/utils/axios";
import { store } from "@/store";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";

/** 应用启动时调用一次：从 tauriConfig（get_config 一次拉取，已含 sidecar 或文件端口）取端口 */
export function applySidecarPorts(): void {
  const { api_port, pty_port } = useTauriConfigStore(store);
  request.setBaseURL(`http://127.0.0.1:${api_port}`);
  ptyWs.setBaseURL(`http://127.0.0.1:${pty_port}`);
}

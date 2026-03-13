/**
 * 用 config 端口覆盖 request / ptyWs 的 baseURL。
 * 端口来自 get_config（initTauriConfig 已拉取）：统一使用 api_port（单项目端口）。
 */
import { request, ptyWs } from "@/utils/axios";
import { store } from "@/store";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";

/** 应用启动时调用一次：从 tauriConfig 取 api_port，API 与 PTY 共用同一端口 */
export function applySidecarPorts(): void {
  const { api_port } = useTauriConfigStore(store);
  const base = `http://127.0.0.1:${api_port}`;
  request.setBaseURL(base);
  ptyWs.setBaseURL(base);
}

/**
 * Tauri 下用 sidecar 端口覆盖 request / ptyWs 的 baseURL。
 * 端口配置由 Vite 负责默认值；此处仅在 Tauri 运行时根据 invoke 结果覆盖。
 */
import { invoke } from "@tauri-apps/api/core";
import { request, ptyWs } from "@/utils/axios";

type SidecarPortsPayload = { api_port: number; pty_port: number } | null;

async function getSidecarPorts(): Promise<SidecarPortsPayload> {
  try {
    const result = await invoke<SidecarPortsPayload>("get_sidecar_ports");
    return result ?? null;
  } catch {
    return null;
  }
}

/** 应用启动时调用一次：若在 Tauri 且 sidecar 已启动，则覆盖 axios baseURL */
export async function applySidecarPorts(): Promise<void> {
  const ports = await getSidecarPorts();
  if (!ports) return;
  request.setBaseURL(`http://127.0.0.1:${ports.api_port}`);
  ptyWs.setBaseURL(`http://127.0.0.1:${ports.pty_port}`);
}

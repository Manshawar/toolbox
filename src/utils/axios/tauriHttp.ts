/**
 * 基于 tauri-plugin-http 的请求封装，与 request/ptyWs 解耦。
 * - Tauri 起 sidecar：端口从 get_sidecar_ports 获取。
 * - 无 sidecar 时：端口从 Pinia tauriConfig 取（initTauriConfig 启动时已从 Tauri 拉取）。
 */
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { store } from "@/store";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";

type SidecarPortsPayload = { api_port: number; pty_port: number } | null;

async function getSidecarPorts(): Promise<SidecarPortsPayload> {
  try {
    const result = await invoke<SidecarPortsPayload>("get_sidecar_ports");
    return result ?? null;
  } catch {
    return null;
  }
}

/** 无 sidecar 时的端口：从 init 时已写入的 tauriConfig store 取 */
function getConfigPorts(): { api_port: number; pty_port: number } {
  const s = useTauriConfigStore(store);
  return { api_port: s.api_port, pty_port: s.pty_port };
}

function fallbackApiBase(): string {
  const { api_port } = getConfigPorts();
  return `http://127.0.0.1:${api_port}`;
}

function fallbackPtyBase(): string {
  const { pty_port } = getConfigPorts();
  return `http://127.0.0.1:${pty_port}`;
}

/** 获取 API baseURL：Tauri sidecar 端口优先，否则从 IPC get_config 取 api_port */
export async function getApiBaseUrl(): Promise<string> {
  const ports = await getSidecarPorts();
  if (ports) return `http://127.0.0.1:${ports.api_port}`;
  return fallbackApiBase();
}

/** 获取 PTY baseURL：Tauri sidecar 端口优先，否则从 IPC get_config 取 pty_port */
export async function getPtyBaseUrl(): Promise<string> {
  const ports = await getSidecarPorts();
  if (ports) return `http://127.0.0.1:${ports.pty_port}`;
  return fallbackPtyBase();
}

/** 使用 tauri-plugin-http 请求 API 侧车；path 为相对路径，如 "/health" */
export async function fetchApi(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = await getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  return fetch(url, init);
}

/** 使用 tauri-plugin-http 请求 PTY 侧车；path 为相对路径 */
export async function fetchPty(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = await getPtyBaseUrl();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  return fetch(url, init);
}

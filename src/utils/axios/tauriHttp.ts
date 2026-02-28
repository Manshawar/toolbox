/**
 * 基于 tauri-plugin-http 的请求封装，与 request/ptyWs 解耦。
 * 端口统一从 tauriConfig 取（get_config 一次拉取，已含 sidecar 分配端口或 settings.json 端口）。
 */
import { fetch } from "@tauri-apps/plugin-http";
import { store } from "@/store";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";

function getConfigPorts(): { api_port: number; pty_port: number } {
  const s = useTauriConfigStore(store);
  return { api_port: s.api_port, pty_port: s.pty_port };
}

/** 获取 API baseURL（来自 config，已含 sidecar 覆盖） */
export function getApiBaseUrl(): string {
  const { api_port } = getConfigPorts();
  return `http://127.0.0.1:${api_port}`;
}

/** 获取 PTY baseURL（来自 config，已含 sidecar 覆盖） */
export function getPtyBaseUrl(): string {
  const { pty_port } = getConfigPorts();
  return `http://127.0.0.1:${pty_port}`;
}

/** 使用 tauri-plugin-http 请求 API 侧车；path 为相对路径，如 "/health" */
export async function fetchApi(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  return fetch(url, init);
}

/** 使用 tauri-plugin-http 请求 PTY 侧车；path 为相对路径 */
export async function fetchPty(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getPtyBaseUrl();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  return fetch(url, init);
}

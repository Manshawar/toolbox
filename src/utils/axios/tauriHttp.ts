/**
 * 基于 tauri-plugin-http 的请求封装，与 request/ptyWs 解耦。
 * - Tauri 起 sidecar：端口从 get_sidecar_ports 获取。
 * - dev:app（TAURI_SKIP_SIDECAR=1，单独起 sidecars/app 的 langchain-serve、pty-host）：
 *   无 sidecar 端口时用 .env 固定端口，即 VITE_API_BASE_URL / VITE_PTY_BASE_URL（Vite 注入），
 *   或直接用 VITE_API_PORT / VITE_PTY_PORT 拼成 http://127.0.0.1:${port}。
 */
import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";

type SidecarPortsPayload = { api_port: number; pty_port: number } | null;

async function getSidecarPorts(): Promise<SidecarPortsPayload> {
  try {
    const result = await invoke<SidecarPortsPayload>("get_sidecar_ports");
    return result ?? null;
  } catch {
    return null;
  }
}

/** 无 sidecar 时的 API base：优先 Vite 注入的 baseURL，否则用 .env 的 VITE_API_PORT 拼 */
function fallbackApiBase(): string {
  const base = import.meta.env?.VITE_API_BASE_URL ?? "";
  if (base) return base;
  const port = import.meta.env?.VITE_API_PORT;
  if (port != null && String(port).trim() !== "") return `http://127.0.0.1:${port}`;
  return "";
}

/** 无 sidecar 时的 PTY base：优先 Vite 注入的 baseURL，否则用 .env 的 VITE_PTY_PORT 拼 */
function fallbackPtyBase(): string {
  const base = import.meta.env?.VITE_PTY_BASE_URL ?? "";
  if (base) return base;
  const port = import.meta.env?.VITE_PTY_PORT;
  if (port != null && String(port).trim() !== "") return `http://127.0.0.1:${port}`;
  return "";
}

/** 获取 API baseURL：Tauri sidecar 端口优先，否则走 dev:app 固定端口（.env） */
export async function getApiBaseUrl(): Promise<string> {
  const ports = await getSidecarPorts();
  if (ports) return `http://127.0.0.1:${ports.api_port}`;
  return fallbackApiBase();
}

/** 获取 PTY baseURL：Tauri sidecar 端口优先，否则走 dev:app 固定端口（.env） */
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

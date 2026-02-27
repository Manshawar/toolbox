/**
 * 基于 tauri-plugin-http 的请求封装，与 request/ptyWs 解耦。
 * 端口优先从 get_sidecar_ports 获取（Tauri 起 sidecar），否则用 Vite 注入的 baseURL（单独起后台开发）。
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

const envApiBase = () => import.meta.env?.VITE_API_BASE_URL ?? "";
const envPtyBase = () => import.meta.env?.VITE_PTY_BASE_URL ?? "";

/** 获取 API baseURL：Tauri sidecar 端口优先，否则用 Vite 环境变量 */
export async function getApiBaseUrl(): Promise<string> {
  const ports = await getSidecarPorts();
  if (ports) return `http://127.0.0.1:${ports.api_port}`;
  return envApiBase();
}

/** 获取 PTY baseURL：Tauri sidecar 端口优先，否则用 Vite 环境变量 */
export async function getPtyBaseUrl(): Promise<string> {
  const ports = await getSidecarPorts();
  if (ports) return `http://127.0.0.1:${ports.pty_port}`;
  return envPtyBase();
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

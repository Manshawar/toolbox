/**
 * 基于 tauri-plugin-http 的请求封装，与 request/ptyWs 解耦。
 * 端口统一从 tauriConfig 取（get_config 一次拉取，已含 sidecar 分配端口或 settings.json 端口）。
 *
 * 请求链路：Vue → fetch(url) → 插件 IPC (plugin:http|fetch_send) → Rust → HTTP 直连 127.0.0.1:api_port。
 * 若收到 502：多为 Rust 连不上 Node（端口未监听或不一致），或系统代理把 127.0.0.1 请求转发到代理导致 502。
 * 此处通过 proxy.noProxy 强制本机地址不走代理，避免 502。
 */
import { fetch } from "@tauri-apps/plugin-http";
import { store } from "@/store";
import { useTauriConfigStore } from "@/store/modules/tauriConfig";

function getApiPort(): number {
  return useTauriConfigStore(store).api_port;
}

/** 获取 API baseURL（来自 config，已含 sidecar 覆盖） */
export function getApiBaseUrl(): string {
  return `http://127.0.0.1:${getApiPort()}`;
}

/** 获取 PTY baseURL（与 API 共用同一端口） */
export function getPtyBaseUrl(): string {
  return getApiBaseUrl();
}

/**
 * 请求本机 API 时使用的 ClientOptions：让 127.0.0.1 / localhost 不走系统代理，
 * 避免在存在 HTTP 代理的环境下出现 502。
 */
const LOCAL_NO_PROXY_OPTIONS = {
  proxy: {
    all: {
      url: "http://127.0.0.1:1",
      noProxy: "127.0.0.1,localhost,::1",
    },
  },
} as const;

/** 使用 tauri-plugin-http 请求 API 侧车；path 为相对路径，如 "/health" */
export async function fetchApi(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const mergedInit = {
    ...init,
    ...LOCAL_NO_PROXY_OPTIONS,
  };
  return fetch(url, mergedInit);
}

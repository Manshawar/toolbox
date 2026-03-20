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
import { ElMessage } from "element-plus";

/** Core 服务就绪状态 */
let isCoreReady = false;
const coreReadyListeners: Array<(ready: boolean) => void> = [];

/** 标记 Core 服务已就绪 */
export function setCoreReady(ready: boolean): void {
  isCoreReady = ready;
  console.log(`[tauriHttp] Core 服务状态: ${ready ? "就绪" : "未就绪"}`);
  coreReadyListeners.forEach((cb) => cb(ready));
}

/** 获取 Core 服务就绪状态 */
export function getCoreReady(): boolean {
  return isCoreReady;
}

/** 监听 Core 服务状态变化 */
export function onCoreReadyChange(callback: (ready: boolean) => void): () => void {
  coreReadyListeners.push(callback);
  return () => {
    const index = coreReadyListeners.indexOf(callback);
    if (index > -1) coreReadyListeners.splice(index, 1);
  };
}

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
  // 检查服务是否已就绪
  if (!isCoreReady) {
    const msg = "Core 服务尚未就绪，请稍后再试";
    console.warn(`[fetchApi] ${msg}: ${path}`);
    ElMessage.warning(msg);
    // 返回一个模拟的 503 响应，避免调用方崩溃
    return new Response(
      JSON.stringify({ error: msg, code: "SERVICE_NOT_READY" }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const base = getApiBaseUrl();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const mergedInit = {
    ...init,
    ...LOCAL_NO_PROXY_OPTIONS,
  };

  try {
    const response = await fetch(url, mergedInit);
    // 处理 502 错误（服务未启动或端口不对）
    if (response.status === 502) {
      const msg = "Core 服务连接失败（502），服务可能未启动";
      console.error(`[fetchApi] ${msg}: ${url}`);
      ElMessage.error(msg);
    }
    return response;
  } catch (error) {
    const msg = `请求失败: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[fetchApi] ${msg}: ${url}`);
    ElMessage.error("Core 服务请求失败，请检查服务状态");
    throw error;
  }
}

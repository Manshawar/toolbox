/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_PORT: string;
  /** 后端 API 端口，开发时与 .env 的 VITE_API_PORT 一致 */
  readonly VITE_API_PORT: string;
  /** PTY WebSocket 端口，开发时与 .env 的 VITE_PTY_PORT 一致 */
  readonly VITE_PTY_PORT: string;
  /** API baseURL，由 vite.config 注入：开发为 http://127.0.0.1:VITE_API_PORT，打包为空（Tauri 由 applySidecarPorts 覆盖） */
  readonly VITE_API_BASE_URL: string;
  /** PTY baseURL，由 vite.config 注入：开发为 http://127.0.0.1:VITE_PTY_PORT，打包为空 */
  readonly VITE_PTY_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

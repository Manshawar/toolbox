/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_PORT: string;
  /** API baseURL，开发时默认 http://127.0.0.1:8264，打包后由 Tauri IPC get_sidecar_ports / get_config 提供 */
  readonly VITE_API_BASE_URL: string;
  /** PTY baseURL，开发时默认 http://127.0.0.1:8265，打包后由 Tauri IPC 提供 */
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

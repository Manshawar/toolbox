/// <reference types="vite/client" />

interface Window {
  __TAURI__?: unknown;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "pinia-plugin-persistedstate" {
  import type { PiniaPluginContext } from "pinia";
  const plugin: (context: PiniaPluginContext) => void;
  export default plugin;
}

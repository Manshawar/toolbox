import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import { createPinia } from "pinia";
import type { PiniaPlugin } from "pinia";
import type { App } from "vue";

const store = createPinia();
store.use(piniaPluginPersistedstate as unknown as PiniaPlugin);

export const configMainStore = (app: App<Element>) => {
  app.use(store);
};

export { store };

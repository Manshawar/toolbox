import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router";
import { store } from "@/store";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import { tauriStoreInitPlugin, whenTauriStoreReady } from "@/plugins/tauri-store-init";
import "@/style.css";

async function bootstrap() {
  const app = createApp(App);
  await whenTauriStoreReady();
  app.use(store).use(ElementPlus).use(router).use(tauriStoreInitPlugin);

  app.mount("#app");
}

bootstrap();

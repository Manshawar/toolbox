import { createApp } from "vue";
import App from "./App.vue";
import { getServerConfig } from "./config";
import { configMainI18n } from "./locales";
import { configMainRouter } from "./router";
import { configMainStore, store } from "./store";
import { configMainGlobalProperties } from "./utils";
import { initTauriConfig } from "./utils/getConfig";
import { useElementPlus } from "./utils/plugin/element";
import { applySidecarPorts } from "@/config/sidecarPorts";
import { initAiPersistStorage } from "@/tauriStore";

// tailwind css
import "@/styles/tailwind.css";
// element-plus dark style
import "element-plus/theme-chalk/src/dark/css-vars.scss";
// 公共样式
import "@/styles/index.scss";

const app = createApp(App);

// 先挂载 Pinia，getServerConfig 从 store 取/拉取配置（含持久化）

const init = async () => {
  await configMainStore(app);
  await initTauriConfig(store);
  await initAiPersistStorage();
  getServerConfig(app).then(async (config) => {
    // 路由
    await configMainRouter(app);

    // 全局钩子
    configMainGlobalProperties(app);

    // 用 config 端口（get_config 已含 sidecar 覆盖）覆盖 request / ptyWs 的 baseURL
    applySidecarPorts();

    // 国际化
    configMainI18n(app, config.locale);

    // ElementPlus
    useElementPlus(app);

    app.mount("#app");
  });
};
init();

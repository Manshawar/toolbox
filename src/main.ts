import { createApp } from 'vue';
import App from './App.vue';
import { getServerConfig } from './config';
import { configMainI18n } from './locales';
import { configMainRouter } from './router';
import { configMainStore, store } from './store';
import { configMainGlobalProperties } from './utils';
import { initTauriConfig } from './utils/getConfig';
import { useElementPlus } from './utils/plugin/element';
import { applySidecarPorts } from '@/config/sidecarPorts';

// tailwind css
import '@/styles/tailwind.css';
// element-plus dark style
import 'element-plus/theme-chalk/src/dark/css-vars.scss';
// 公共样式
import '@/styles/index.scss';

const app = createApp(App);

getServerConfig(app).then(async config => {
  // 路由
  await configMainRouter(app);

  // 全局钩子
  configMainGlobalProperties(app);

  // Pinia（先装再初始化 Tauri 配置，供 tauriHttp 等从 store 取端口）
  configMainStore(app);
  await initTauriConfig(store);

  // Tauri 下若有 sidecar 端口则覆盖 request / ptyWs 的 baseURL
  await applySidecarPorts();

  // 国际化
  configMainI18n(app, config.locale);

  // ElementPlus
  useElementPlus(app);

  app.mount('#app');
});

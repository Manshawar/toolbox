import type { App } from 'vue';
import { useAppStoreHook } from '@/store/modules/app';
import type { AppConfig } from '@/store/types';
import { configTheme } from '@/utils/theme/transformTheme';

let config: AppConfig = {} as AppConfig;

export function getConfig(): AppConfig {
  return config;
}

/** 延迟进入 Vue：从 Pinia app store 取配置（持久化），缺省时从 public/serverConfig.json 拉取 */
export async function getServerConfig(app: App): Promise<AppConfig> {
  const appStore = useAppStoreHook();
  if (!appStore.hasConfig) {
    await appStore.loadServerConfig();
  }
  config = appStore.getAppConfigMode;
  configTheme(config);
  app.config.globalProperties.$config = getConfig();
  return config;
}

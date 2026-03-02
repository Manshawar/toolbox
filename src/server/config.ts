import type { AppConfig } from '@/store/types';
import { request } from '@/utils/axios';

/** 通过 HTTP 获取 serverConfig（可选）。应用配置现由 Pinia app store 从 public/serverConfig.json 拉取并持久化。 */
enum Api {
  ROUTE_CONFIG_INFO = '/serverConfig.json',
}

export const getConfigInfo = () => request.get<AppConfig>({ url: Api.ROUTE_CONFIG_INFO });

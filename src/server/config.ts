import type { AppConfig } from '@/store/types';
import { request } from '@/utils/axios';

enum Api {
  ROUTE_CONFIG_INFO = '/serverConfig.json',
}

export const getConfigInfo = () => request.get<AppConfig>({ url: Api.ROUTE_CONFIG_INFO });

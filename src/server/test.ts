import { fetchApi } from '@/utils/axios';

export interface SwaggerUrlResult {
  url: string;
  base: string;
}

interface StandardResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** 请求 core /test/swagger-url；非 2xx 会抛错（如 502 表示 core 未就绪或端口不对） */
export const testLink = async (): Promise<SwaggerUrlResult> => {
  const response = await fetchApi('/test/swagger-url', { method: 'GET' });
  if (!response.ok) {
    const msg = `core 请求失败 ${response.status} ${response.statusText}，请确认 Node 侧车已启动且端口一致`;
    throw new Error(msg);
  }
  const json = (await response.json()) as StandardResponse<SwaggerUrlResult>;
  if (json?.code === -1) throw new Error(json.message || 'core 请求失败');
  return json.data;
};
import { fetchApi } from '@/utils/axios';

export const testLink = async () => {
  const response = await fetchApi('/test/swagger-url');
  return response.json() as Promise<{ url: string; base: string }>;
};
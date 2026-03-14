import { fetchApi } from '@/utils/axios';

export const testLink = async () => {
  const response = await fetchApi('/test/swagger-url');
  return response;
};
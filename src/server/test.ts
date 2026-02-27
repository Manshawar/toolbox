import { fetchApi } from '@/utils/axios';

export const testLink = async () => {
  const response = await fetchApi('/health');
  return response.json();
};
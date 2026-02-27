import {request} from '@/utils/axios';

export const testLink = () => {
 return request.get({ url: '/health' });
};
import { request } from '@/utils/axios';

enum Api {
  ROUTE_LIST = '/api/getRoute',
}

interface Param {
  name: string;
}

export interface RouteDataItemType {
  path: string;
  name: string;
  children: RouteDataItemType[];
}

export const getRouteApi = (data: Param) => request.post<RouteDataItemType[], Param>({ url: Api.ROUTE_LIST, data });

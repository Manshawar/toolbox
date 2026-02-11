import mitt from "mitt";
import type { Emitter } from "mitt";
import type { AppRouteRecordRaw } from "@/router/type";

interface Events {
  siteBarChange: {
    routeRaw: AppRouteRecordRaw;
  };
  [key: string | symbol]: any;
}

export const emitter: Emitter<Events> = mitt<Events>();

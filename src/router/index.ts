import { isUrl } from '@/utils/url';
import { createRouter, createWebHistory } from 'vue-router';
import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import { getConfig } from '@/config';
import { translateI18n } from '@/hooks/web/useI18n';
import { usePermissionStoreHook } from '@/store/modules/permission';
import NProgress from '@/utils/plugin/progress';
import { RoleEnum } from '@/enum/role';
import { configRouteList } from './modules';
import { handleAliveRoute, initRoute } from './utils';

const { whiteRouteModulesList, routeModulesList } = configRouteList();

// 在导航栏上的路由
export const sidebarRouteList = routeModulesList;

export const router = createRouter({
  history: createWebHistory(''),
  routes: whiteRouteModulesList as unknown as RouteRecordRaw[],
});

export const configMainRouter = async (app: App<Element>) => {
  app.use(router);
  await router.isReady();
};

// 路由守卫（暂关闭登录/权限校验，直接放行；有服务后再接入）
router.beforeEach((to, from, next) => {
  NProgress.start();
  if (to.meta?.keepAlive) {
    const newMatched = to.matched;
    handleAliveRoute(newMatched, 'add');
    if (from.name === undefined || from.name === 'Redirect') {
      handleAliveRoute(newMatched);
    }
  }

  if (!isUrl(to.path) && to.meta.title) {
    const Title = getConfig().title;
    if (Title) document.title = `${translateI18n(to.meta.title)} | ${Title}`;
    else document.title = translateI18n(to.meta.title);
  }

  const permissionStore = usePermissionStoreHook();
  if (!from.name && permissionStore.wholeMenus.length === 0) {
    // 首次进入时用默认角色初始化菜单，保证侧栏有数据（后端未就绪时也会放行）
    initRoute(RoleEnum.ADMIN)
      .then(() => {
        next({ path: to.path, query: to.query, replace: true });
      })
      .catch(() => {
        next();
      });
  } else {
    next();
  }
});

router.afterEach(() => {
  NProgress.done();
});

import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: () => import("@/layouts/page-layouts/index.vue"),
      children: [
        {
          path: "",
          redirect: "/toolbox",
        },
        {
          path: "toolbox",
          name: "Toolbox",
          component: () => import("@/views/Toolbox.vue"),
          meta: { title: "工具箱" },
        },
        {
          path: "settings",
          name: "Settings",
          component: () => import("@/views/Settings.vue"),
          meta: { title: "设置" },
        },
      ],
    },
  ],
});

export default router;

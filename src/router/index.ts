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
          redirect: "/commit",
        },
        {
          path: "clawbot",
          name: "Clawbot",
          component: () => import("@/views/app/clawbot/index.vue"),
          meta: { title: "clawbot工具" },
        },
        {
          path: "commit",
          name: "CommitTool",
          component: () => import("@/views/app/commit/index.vue"),
          meta: { title: "commit工具" },
        },
      ],
    },
  ],
});

export default router;

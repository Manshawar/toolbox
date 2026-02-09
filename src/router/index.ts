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
          path: "commit",
          name: "CommitTool",
          component: () => import("@/views/Toolbox.vue"),
          meta: { title: "commit工具" },
        },
      ],
    },
  ],
});

export default router;

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { Bars3Icon, Cog6ToothIcon, Squares2X2Icon } from '@heroicons/vue/24/outline';
import { useAppStoreHook } from '@/store/modules/app';

const appStore = useAppStoreHook();
const route = useRoute();

const collapse = computed(() => appStore.appConfig.collapseMenu);

const navs = [
  { path: '/toolbox', name: '工具箱', icon: Squares2X2Icon },
  { path: '/settings', name: '设置', icon: Cog6ToothIcon },
];

function toggleCollapse() {
  appStore.setAppConfigMode({ collapseMenu: !collapse.value });
}
</script>

<template>
  <aside
    class="sidebar flex flex-col border-r border-gray-200 bg-white shrink-0 overflow-hidden"
    :class="collapse ? 'sidebar--collapsed' : 'sidebar--expanded'"
  >
    <!-- Logo -->
    <div
      class="h-14 flex items-center border-b border-gray-100 shrink-0"
      :class="collapse ? 'justify-center px-0 w-14' : 'gap-2 px-3 min-w-[220px]'"
    >
      <img src="@/assets/vue.svg" class="w-9 h-9 shrink-0" alt="logo" />
      <span
        v-if="!collapse"
        class="text-lg font-medium text-gray-800 truncate whitespace-nowrap"
      >{{ appStore.appConfig.title }}</span>
    </div>
    <!-- Nav -->
    <nav class="flex-1 py-2 overflow-y-auto overflow-x-hidden min-w-0">
      <RouterLink
        v-for="item in navs"
        :key="item.path"
        :to="item.path"
        class="nav-link flex items-center rounded-lg text-gray-600 transition-colors"
        :class="[
          collapse ? 'justify-center p-2.5 mx-2 w-10' : 'gap-3 px-3 py-2.5 mx-2 min-w-0',
          route.path === item.path
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'hover:bg-gray-50 hover:text-gray-900',
        ]"
      >
        <component :is="item.icon" class="w-5 h-5 shrink-0 flex-shrink-0" />
        <span v-if="!collapse" class="truncate whitespace-nowrap">{{ item.name }}</span>
      </RouterLink>
    </nav>
    <!-- Collapse -->
    <div class="p-2 border-t border-gray-100 shrink-0" :class="collapse ? 'flex justify-center' : ''">
      <button
        type="button"
        class="flex items-center rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        :class="collapse ? 'justify-center p-2.5 w-10 mx-2' : 'gap-3 px-3 py-2 w-full'"
        @click="toggleCollapse"
      >
        <Bars3Icon class="w-5 h-5 shrink-0" />
        <span v-if="!collapse" class="whitespace-nowrap">收起</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  transition: width 0.25s ease-in-out;
}
.sidebar--expanded {
  width: 220px;
  min-width: 220px;
}
.sidebar--collapsed {
  width: 56px;
  min-width: 56px;
}
</style>

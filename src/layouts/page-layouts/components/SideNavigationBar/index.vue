<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ChevronLeftIcon, CommandLineIcon } from '@heroicons/vue/24/outline';
import { useAppStoreHook } from '@/store/modules/app';

const appStore = useAppStoreHook();
const route = useRoute();

const collapse = computed(() => appStore.appConfig.collapseMenu);

const navs = [
  { path: '/commit', name: 'commit工具', icon: CommandLineIcon },
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
      class="sidebar-logo h-14 flex items-center border-b border-gray-100 shrink-0"
      :class="collapse ? 'justify-center px-0 w-14' : 'gap-2 px-3 min-w-[220px]'"
    >
      <img src="@/assets/Capybara Wearing Sunglasses.png" class="w-9 h-9 shrink-0" alt="logo" />
      <Transition name="sidebar-text">
        <span
          v-if="!collapse"
          class="text-lg font-medium text-gray-800 truncate whitespace-nowrap"
        >{{ appStore.appConfig.title }}</span>
      </Transition>
    </div>
    <!-- Nav -->
    <nav class="flex-1 py-2 overflow-y-auto overflow-x-hidden min-w-0">
      <RouterLink
        v-for="item in navs"
        :key="item.path"
        :to="item.path"
        class="nav-link flex items-center rounded-lg text-gray-600 transition-colors duration-200"
        :class="[
          collapse ? 'justify-center p-2.5 mx-2 w-10' : 'gap-3 px-3 py-2.5 mx-2 min-w-0',
          route.path === item.path ? 'bg-gray-100 text-gray-900 font-medium' : 'hover:bg-gray-50 hover:text-gray-900',
        ]"
      >
        <component :is="item.icon" class="w-5 h-5 shrink-0 flex-shrink-0" />
        <Transition name="sidebar-text" mode="out-in">
          <span v-if="!collapse" class="truncate whitespace-nowrap">{{ item.name }}</span>
        </Transition>
      </RouterLink>
    </nav>
    <!-- Collapse -->
    <div class="sidebar-toggle-wrap p-2 border-t border-gray-100 shrink-0" :class="collapse ? 'flex justify-center' : ''">
      <button
        type="button"
        class="sidebar-toggle-btn flex items-center rounded-lg text-gray-600 hover:bg-gray-50 transition-colors duration-200 w-full"
        :class="collapse ? 'justify-center p-2.5 w-10 mx-2' : 'gap-3 px-3 py-2'"
        @click="toggleCollapse"
      >
        <span class="sidebar-toggle-icon inline-flex" :class="{ 'sidebar-toggle-icon--collapsed': collapse }">
          <ChevronLeftIcon class="w-5 h-5 shrink-0" :title="collapse ? '展开侧栏' : '收起侧栏'" />
        </span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar--expanded {
  width: 220px;
  min-width: 220px;
  transition-duration: 0.42s;
}
.sidebar--collapsed {
  width: 56px;
  min-width: 56px;
  transition-duration: 0.28s;
}

.sidebar-logo {
  transition: padding 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    gap 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    justify-content 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar--expanded .sidebar-logo {
  transition-duration: 0.42s;
}
.sidebar--collapsed .sidebar-logo {
  transition-duration: 0.28s;
}

.nav-link {
  transition: padding 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    gap 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    margin 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar--expanded .nav-link {
  transition-duration: 0.42s;
}
.sidebar--collapsed .nav-link {
  transition-duration: 0.28s;
}

.sidebar-toggle-wrap {
  transition: justify-content 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar--expanded .sidebar-toggle-wrap {
  transition-duration: 0.42s;
}
.sidebar--collapsed .sidebar-toggle-wrap {
  transition-duration: 0.28s;
}

.sidebar-toggle-btn {
  transition: padding 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    gap 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar--expanded .sidebar-toggle-btn {
  transition-duration: 0.42s;
}
.sidebar--collapsed .sidebar-toggle-btn {
  transition-duration: 0.28s;
}

.sidebar-toggle-icon {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.sidebar--expanded .sidebar-toggle-icon {
  transition-duration: 0.42s;
}
.sidebar--collapsed .sidebar-toggle-icon {
  transition-duration: 0.28s;
}
.sidebar-toggle-icon--collapsed {
  transform: rotate(180deg);
}

/* 侧栏文字：展开时淡入慢一点，收起时淡出保持较快 */
.sidebar-text-enter-active {
  transition: opacity 0.35s ease;
}
.sidebar-text-leave-active {
  transition: opacity 0.2s ease;
}
.sidebar-text-enter-from,
.sidebar-text-leave-to {
  opacity: 0;
}
</style>

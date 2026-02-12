<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import ToolboxAppCard from './components/ToolboxAppCard.vue';

defineOptions({
  name: 'RtWelcome',
});

/** 应用项 */
interface AppItem {
  id: string;
  name: string;
  path: string;
  installed: boolean;
  icon?: string;
  iconSrc?: string;
  installProgress?: number;
  /** 检测到的版本号 */
  version?: string | null;
}

/** Rust 端返回结构 */
interface AppInstallInfo {
  installed: boolean;
  version: string | null;
}

const activeTab = ref('tools');

/** 按分类的应用列表（reactive 以便异步更新） */
const appsByCategory = reactive<Record<string, AppItem[]>>({
  tools: [
    {
      id: 'clawbot',
      name: 'Clawbot',
      path: '/clawbot',
      installed: false,
      icon: 'app-openclaw-lobster',
    },
  ],
});

const categoryTabs = [
  { key: 'tools', label: '工具' },
];

/** 批量检测所有应用的安装状态 */
async function checkAllApps() {
  const allApps = Object.values(appsByCategory).flat();
  const appIds = allApps.map((a) => a.id);
  if (appIds.length === 0) return;

  try {
    const result = await invoke<Record<string, AppInstallInfo>>(
      'check_apps_installed',
      { appIds },
    );
    console.log('[checkAllApps] result:', result);
    for (const app of allApps) {
      const info = result[app.id];
      if (info) {
        app.installed = info.installed;
        app.version = info.version;
      }
    }
  } catch (err) {
    console.error('[checkAllApps] invoke failed:', err);
  }
}

onMounted(() => {
  checkAllApps();
});
</script>

<template>
  <div class="toolbox-page min-h-full flex flex-col bg-gray-50 dark:bg-gray-900/50">
    <!-- 标题栏 -->
    <header class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <span class="text-xl font-medium text-gray-700 dark:text-gray-200">应用程序</span>
      </div>
    </header>

    <!-- 分类 Tab -->
    <div class="px-6 pt-4">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="tab in categoryTabs"
          :key="tab.key"
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out cursor-pointer hover:scale-105 active:scale-95"
          :class="
            activeTab === tab.key
              ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-gray-600/80 hover:shadow-sm'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- 应用网格 -->
    <main class="flex-1 overflow-auto px-6 py-6">
      <div
        class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));"
      >
        <ToolboxAppCard
          v-for="app in appsByCategory[activeTab]"
          :key="app.id"
          :name="app.name"
          :path="app.path"
          :installed="app.installed"
          :icon="app.icon"
          :icon-src="app.iconSrc"
          :install-progress="app.installProgress ?? 0"
        />
      </div>
    </main>
  </div>
</template>

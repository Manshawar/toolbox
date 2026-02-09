<script setup lang="ts">
import { computed, ref } from 'vue';
import { KeyIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import ApiSettings from './panels/ApiSettings.vue';

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

type MenuKey = 'api';

const activeMenu = ref<MenuKey>('api');

const menuItems: { key: MenuKey; label: string; icon: typeof KeyIcon; component: typeof ApiSettings }[] = [
  { key: 'api', label: 'API 配置', icon: KeyIcon, component: ApiSettings },
];

const currentPanel = computed(() => {
  const item = menuItems.find((i) => i.key === activeMenu.value);
  return item?.component ?? null;
});

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-show="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        :aria-hidden="!modelValue"
      >
        <div
          class="absolute inset-0 bg-black/50"
          aria-hidden="true"
          @click="close"
        />
        <div
          class="relative flex w-full max-w-3xl rounded-xl bg-white shadow-xl overflow-hidden"
          style="min-height: 420px; max-height: 85vh"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-dialog-title"
        >
          <!-- 标题栏 -->
          <div
            class="absolute top-0 left-0 right-0 flex items-center justify-between border-b border-gray-200 px-5 py-4 bg-white z-10"
          >
            <h2 id="settings-dialog-title" class="text-lg font-semibold text-gray-900">
              设置
            </h2>
            <el-button type="primary" link circle title="关闭" @click="close">
              <XMarkIcon class="w-5 h-5" />
            </el-button>
          </div>

          <!-- 主体：左侧配置项 + 右侧动态组件 -->
          <div class="flex flex-1 min-h-0 pt-14">
            <!-- 左侧菜单 -->
            <aside class="w-48 shrink-0 border-r border-gray-200 bg-gray-50 py-2">
              <el-button
                v-for="item in menuItems"
                :key="item.key"
                :type="activeMenu === item.key ? 'primary' : 'default'"
                text
                class="settings-menu-item !justify-start !w-full gap-3 rounded-none border-l-2"
                :class="activeMenu === item.key ? '!border-l-primary' : '!border-l-transparent'"
                @click="activeMenu = item.key"
              >
                <component :is="item.icon" class="w-5 h-5 shrink-0" />
                <span>{{ item.label }}</span>
              </el-button>
            </aside>

            <!-- 右侧：动态组件切换 -->
            <main class="flex-1 min-w-0 overflow-auto p-6">
              <component :is="currentPanel" v-if="currentPanel" />
            </main>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
.dialog-enter-from :deep([role="dialog"]),
.dialog-leave-to :deep([role="dialog"]) {
  transform: scale(0.95);
  opacity: 0;
}
.dialog-enter-active :deep([role="dialog"]),
.dialog-leave-active :deep([role="dialog"]) {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
</style>

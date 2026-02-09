<script setup lang="ts">
import { ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  MinusIcon,
  Squares2X2Icon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';

const isMaximized = ref(false);

async function minimize() {
  try {
    await getCurrentWindow().minimize();
  } catch (_) {}
}

async function toggleMaximize() {
  try {
    const w = getCurrentWindow();
    await w.toggleMaximize();
    isMaximized.value = await w.isMaximized();
  } catch (_) {}
}

async function close() {
  try {
    await getCurrentWindow().close();
  } catch (_) {}
}

/** 手动拖拽：点击标题栏空白处（非按钮）时调用 */
function onDragRegionMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('.titlebar-actions')) return;
  try {
    getCurrentWindow().startDragging();
  } catch (_) {}
}
</script>

<template>
  <!-- 始终显示，便于在 Tauri 中拖拽与使用按钮；浏览器中操作会 no-op -->
  <header
    class="titlebar h-8 shrink-0 flex items-center justify-end gap-0 select-none bg-gray-50"
    data-tauri-drag-region
    @mousedown="onDragRegionMouseDown"
  >
    <span
      class="titlebar-drag flex-1 min-w-0 cursor-grab active:cursor-grabbing"
      data-tauri-drag-region
    />
    <div class="titlebar-actions flex items-stretch h-full">
      <button
        type="button"
        class="titlebar-btn w-11 h-full flex items-center justify-center hover:bg-black/10 transition-colors"
        title="最小化"
        @click="minimize"
      >
        <MinusIcon class="w-4 h-4" />
      </button>
      <button
        type="button"
        class="titlebar-btn w-11 h-full flex items-center justify-center hover:bg-black/10 transition-colors"
        :title="isMaximized ? '还原' : '最大化'"
        @click="toggleMaximize"
      >
        <Squares2X2Icon class="w-4 h-4" />
      </button>
      <button
        type="button"
        class="titlebar-btn w-11 h-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
        title="关闭"
        @click="close"
      >
        <XMarkIcon class="w-4 h-4" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  /* 与主背景 page-layouts 的 bg-gray-50 一致 */
  z-index: 9999;
  border-bottom: 1px solid rgb(229 231 235); /* gray-200，与主区边框协调 */
}

/* 按钮区域不参与拖拽，否则无法点击 */
.titlebar-actions,
.titlebar-btn {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}
</style>

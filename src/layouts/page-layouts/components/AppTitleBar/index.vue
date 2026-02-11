<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, FullScreen, CopyDocument, Close } from '@element-plus/icons-vue';

const isTauri = ref(false);
const isWindows = ref(false);
const isMaximized = ref(false);

const showTitleBar = computed(() => isTauri.value && isWindows.value);

const unlistenResized = ref<(() => void) | null>(null);

async function updateMaximized() {
  try {
    const appWindow = getCurrentWindow();
    isMaximized.value = await appWindow.isMaximized();
  } catch {
    // ignore
  }
}

onMounted(async () => {
  isTauri.value = typeof window !== 'undefined' && !!(window as Window & { __TAURI__?: unknown }).__TAURI__;
  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform || '';
  isWindows.value = platform === 'Win32' || platform === 'Win64' || ua.includes('windows');
  if (isTauri.value) {
    await updateMaximized();
    const appWindow = getCurrentWindow();
    const unlisten = await appWindow.onResized(() => updateMaximized());
    unlistenResized.value = unlisten;
  }
});

onUnmounted(() => {
  unlistenResized.value?.();
});

async function handleMinimize() {
  const appWindow = getCurrentWindow();
  await appWindow.minimize();
}

async function handleToggleMaximize() {
  const appWindow = getCurrentWindow();
  await appWindow.toggleMaximize();
}

async function handleClose() {
  const appWindow = getCurrentWindow();
  await appWindow.close();
}
</script>

<template>
  <header v-if="showTitleBar" class="app-title-bar" data-tauri-drag-region>
    <span class="title-bar-title" data-tauri-drag-region>langchainapp</span>
    <div class="title-bar-actions">
      <button type="button" class="title-bar-btn" aria-label="最小化" @click="handleMinimize">
        <el-icon :size="14">
          <Minus />
        </el-icon>
      </button>
      <button type="button" class="title-bar-btn" :aria-label="isMaximized ? '还原' : '最大化'"
        @click="handleToggleMaximize">
        <el-icon :size="14">
          <CopyDocument v-if="isMaximized" />
          <FullScreen v-else />
        </el-icon>
      </button>
      <button type="button" class="title-bar-btn btn-close" aria-label="关闭" @click="handleClose">
        <el-icon :size="14">
          <Close />
        </el-icon>
      </button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.app-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 32px;
  padding: 0 0 0 12px;
  user-select: none;
  background-color: var(--main-bg-color);
  border-bottom: 1px solid var(--nav-bar-border-bottom-color, transparent);
  flex-shrink: 0;

  .title-bar-title {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: var(--el-text-color-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-bar-actions {
    display: flex;
    height: 100%;
    flex-shrink: 0;
  }

  .title-bar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--el-text-color-primary);
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
      background-color: rgb(0 0 0 / 6%);
    }

    &.btn-close:hover {
      background-color: #e81123;
      color: #fff;
    }
  }
}

html.dark .app-title-bar .title-bar-btn:hover {
  background-color: rgb(255 255 255 / 8%);

  &.btn-close:hover {
    background-color: #e81123;
    color: #fff;
  }
}
</style>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { getCurrentWindow } from '@tauri-apps/api/window';

  const isTauri = ref(false);
  const isWindows = ref(false);

  const showTitleBar = computed(() => isTauri.value && isWindows.value);

  onMounted(() => {
    isTauri.value = typeof window !== 'undefined' && !!(window as Window & { __TAURI__?: unknown }).__TAURI__;
    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform || '';
    isWindows.value = platform === 'Win32' || platform === 'Win64' || ua.includes('windows');
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
        <span class="btn-icon btn-minimize" />
      </button>
      <button type="button" class="title-bar-btn" aria-label="最大化" @click="handleToggleMaximize">
        <span class="btn-icon btn-maximize" />
      </button>
      <button type="button" class="title-bar-btn btn-close" aria-label="关闭" @click="handleClose">
        <span class="btn-icon btn-close-icon" />
      </button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
  .app-title-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    padding: 0 0 0 12px;
    user-select: none;
    background-color: var(--nav-bar-color, #fff);
    border-bottom: 1px solid var(--border-color-light, #eee);

    .title-bar-title {
      font-size: 12px;
      color: var(--el-text-color-primary);
    }

    .title-bar-actions {
      display: flex;
      height: 100%;
    }

    .title-bar-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 46px;
      height: 100%;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: background-color 0.15s;

      &:hover {
        background-color: rgb(0 0 0 / 5%);
      }

      &.btn-close:hover {
        background-color: #e81123;
        color: #fff;
      }
    }

    .btn-icon {
      width: 10px;
      height: 10px;
      border: 1px solid currentColor;
      background: transparent;

      &.btn-minimize {
        width: 8px;
        height: 0;
        border-width: 1px 0 0;
        border-bottom: none;
      }

      &.btn-maximize {
        border-style: solid;
      }

      &.btn-close-icon {
        position: relative;
        width: 8px;
        height: 8px;
        border: none;
        background: transparent;

        &::before,
        &::after {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 10px;
          height: 1px;
          background: currentColor;
          content: '';
        }

        &::before {
          transform: translate(-50%, -50%) rotate(45deg);
        }

        &::after {
          transform: translate(-50%, -50%) rotate(-45deg);
        }
      }
    }
  }

  html.dark .app-title-bar .title-bar-btn:hover {
    background-color: rgb(255 255 255 / 8%);

    &.btn-close:hover {
      background-color: #e81123;
    }
  }
</style>

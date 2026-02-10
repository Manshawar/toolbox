<template>
  <div class="app-root flex flex-col h-screen">
    <TitleBar v-if="showCustomTitleBar" />
    <main class="flex-1 min-h-0">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import TitleBar from '@/components/TitleBar/index.vue';

const showCustomTitleBar = ref(true);

onMounted(async () => {
  try {
    const platform = await invoke<string>('get_platform');
    // 仅 Windows 显示自定义标题栏；macOS 使用原生标题栏
    showCustomTitleBar.value = platform === 'windows';
  } catch {
    showCustomTitleBar.value = true;
  }
});
</script>

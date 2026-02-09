<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { ArrowsPointingOutIcon } from '@heroicons/vue/24/outline';
import { useAppStoreHook } from '@/store/modules/app';

const appStore = useAppStoreHook();
const route = useRoute();

const show = computed(() => !appStore.appConfig.hideNavbart);
const title = computed(() => (route.meta?.title as string) ?? 'Langchain App');

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
}
</script>

<template>
  <header
    v-show="show"
    class="h-14 shrink-0 flex items-center justify-between px-4 border-b border-gray-200 bg-white"
  >
    <h1 class="text-lg font-medium text-gray-800 truncate">
      {{ title }}
    </h1>
    <button
      type="button"
      class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      title="全屏"
      @click="toggleFullscreen"
    >
      <ArrowsPointingOutIcon class="w-5 h-5" />
    </button>
  </header>
</template>

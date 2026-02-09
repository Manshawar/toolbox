<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';
import SettingsDialog from '@/components/SettingsDialog/index.vue';
import { useAppStoreHook } from '@/store/modules/app';

const appStore = useAppStoreHook();
const route = useRoute();

const show = computed(() => !appStore.appConfig.hideNavbart);
const title = computed(() => (route.meta?.title as string) ?? 'toolbox');

const dialogOpen = ref(false);
</script>

<template>
  <header
    v-show="show"
    class="h-14 shrink-0 flex items-center justify-between px-4 border-b border-gray-200 bg-white"
  >
    <h1 class="text-lg font-medium text-gray-800 truncate">
      {{ title }}
    </h1>
    <el-button type="primary" link circle title="设置" @click="dialogOpen = true">
      <Cog6ToothIcon class="w-5 h-5" />
    </el-button>
  </header>

  <SettingsDialog v-model="dialogOpen" />
</template>

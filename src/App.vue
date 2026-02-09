<template>
  <div class="app-root flex flex-col h-screen">
    <TitleBar />
    <main class="flex-1 min-h-0">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import TitleBar from '@/components/TitleBar/index.vue';
</script>

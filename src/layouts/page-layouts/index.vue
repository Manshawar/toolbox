<script setup lang="ts">
import AppMain from './components/AppMain/index.vue';
import NavBart from './components/Navbart/index.vue';
import SideNavigationBar from './components/SideNavigationBar/index.vue';
</script>

<template>
  <div class="app-wrapper flex h-full bg-gray-50">
    <SideNavigationBar />
    <div class="main-container flex flex-col flex-1 min-w-0">
      <NavBart />
      <AppMain />
    </div>
  </div>
</template>

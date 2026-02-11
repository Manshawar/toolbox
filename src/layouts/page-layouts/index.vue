<script setup lang="ts">
  import AppMain from './components/AppMain/index.vue';
  import AppTabs from './components/AppTabs/index.vue';
  import AppTitleBar from './components/AppTitleBar/index.vue';
  import NavBart from './components/Navbart/index.vue';
  import SideNavigationBar from './components/SideNavigationBar/index.vue';
</script>

<template>
  <div class="app-wrapper">
    <!-- Windows 下自定义标题栏：缩小 / 放大 / 关闭 -->
    <AppTitleBar />
    <!-- 标题栏下方：侧边栏 + 主内容 -->
    <div class="app-body">
      <!-- 侧边导航栏 -->
      <SideNavigationBar />
      <!-- 内容区 -->
      <div class="main-container">
      <!-- 顶部导航栏 -->
      <NavBart />
      <!-- 选项卡 -->
      <AppTabs />
      <!-- 内容区 -->
      <AppMain />
      </div>
    </div>
  </div>
</template>

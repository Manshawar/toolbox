<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AISettings from './components/AISettings.vue';

defineOptions({
  name: 'SettingPage',
});

const { t } = useI18n();
</script>

<template>
  <div class="setting-page">
    <header class="setting-page__header">
      <h1 class="setting-page__title">{{ t('settings.title') }}</h1>
    </header>
    <div class="setting-page__content">
      <AISettings />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.setting-page {
  min-height: 100%;
  padding: 24px 32px 48px;
  background: linear-gradient(180deg, var(--el-bg-color-page) 0%, var(--el-fill-color-light) 100%);

  &__header {
    margin-bottom: 28px;
  }

  &__title {
    margin: 0 0 20px;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--el-text-color-primary);
    letter-spacing: -0.02em;
  }
}

.setting-page__content {
  min-height: 320px;
}
</style>

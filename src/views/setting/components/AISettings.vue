<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AIProviderId, AIProviderConfig } from '@/store/modules/aiSettings';
import { useAISettingsStoreHook } from '@/store/modules/aiSettings';

const { t } = useI18n();
const aiStore = useAISettingsStoreHook();

const providerOptions = computed(() => [
  { value: 'deepseek', label: t('settings.ai.providerDeepseek') },
  { value: 'bailian', label: t('settings.ai.providerBailian') },
  { value: 'ollama', label: t('settings.ai.providerOllama') },
]);

const defaultModelId = computed({
  get: () => aiStore.defaultModelId,
  set: (v: string) => aiStore.setDefaultModelId(v),
});

function isModelEnabled(providerId: AIProviderId): boolean {
  return aiStore.models.find((m) => m.id === providerId)?.enabled ?? false;
}

function onModelToggle(id: AIProviderId, enabled: boolean) {
  aiStore.setModelEnabled(id, enabled);
}

function updateProvider(providerId: AIProviderId, patch: Partial<AIProviderConfig>) {
  aiStore.setProviderConfig(providerId, patch);
}

function onApiKeyBlur(providerId: AIProviderId, apiKey: string) {
  updateProvider(providerId, { apiKey });
}

function onOllamaBlur(field: 'baseURL' | 'defaultModel', value: string) {
  updateProvider('ollama', field === 'baseURL' ? { baseURL: value || undefined } : { defaultModel: value || undefined });
}

const providerMeta: { id: AIProviderId; nameKey: string }[] = [
  { id: 'deepseek', nameKey: 'settings.ai.providerDeepseek' },
  { id: 'bailian', nameKey: 'settings.ai.providerBailian' },
];
</script>

<template>
  <div class="ai-settings">
    <!-- 模型 -->
    <el-card class="ai-settings__card" shadow="never">
      <template #header>
        <span class="card-title">{{ t('settings.ai.models') }}</span>
      </template>
      <p class="card-hint">{{ t('settings.ai.modelsHint') }}</p>
      <div class="model-list">
        <div
          v-for="model in aiStore.models"
          :key="model.id"
          class="model-row"
        >
          <span class="model-name">{{ model.name }}</span>
          <el-switch
            :model-value="model.enabled"
            @update:model-value="(v: boolean) => onModelToggle(model.id, v)"
          />
        </div>
      </div>
      <div class="default-model-row">
        <span class="default-model-label">{{ t('settings.ai.defaultModel') }}</span>
        <el-select
          v-model="defaultModelId"
          class="default-model-select"
          :placeholder="t('settings.ai.defaultModelPlaceholder')"
        >
          <el-option
            v-for="opt in providerOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </div>
    </el-card>

    <!-- API 密钥：仅当上方对应模型开启时，该输入框可编辑 -->
    <el-card class="ai-settings__card" shadow="never">
      <template #header>
        <span class="card-title">{{ t('settings.ai.apiKeys') }}</span>
      </template>
      <p class="card-hint">{{ t('settings.ai.apiKeysHint') }}</p>

      <div
        v-for="meta in providerMeta"
        :key="meta.id"
        class="provider-block"
        :class="{ 'provider-block--disabled': !isModelEnabled(meta.id) }"
      >
        <label class="provider-block__label">{{ t(meta.nameKey) }} API Key</label>
        <el-input
          :model-value="aiStore.providers[meta.id]?.apiKey ?? ''"
          type="password"
          :placeholder="t('settings.ai.apiKeyPlaceholder')"
          show-password
          clearable
          :disabled="!isModelEnabled(meta.id)"
          class="provider-input"
          @update:model-value="(val: string) => updateProvider(meta.id, { apiKey: val ?? '' })"
          @blur="(e: FocusEvent) => onApiKeyBlur(meta.id, (e.target as HTMLInputElement)?.value ?? '')"
        />
      </div>

      <!-- Ollama：无 API Key，仅地址 + 默认模型名 -->
      <div
        class="provider-block"
        :class="{ 'provider-block--disabled': !isModelEnabled('ollama') }"
      >
        <label class="provider-block__label">{{ t('settings.ai.ollamaAddress') }}</label>
        <el-input
          :model-value="aiStore.providers.ollama?.baseURL ?? ''"
          :placeholder="t('settings.ai.ollamaAddressPlaceholder')"
          clearable
          :disabled="!isModelEnabled('ollama')"
          class="provider-input"
          @update:model-value="(val: string) => updateProvider('ollama', { baseURL: val || undefined })"
          @blur="(e: FocusEvent) => onOllamaBlur('baseURL', (e.target as HTMLInputElement)?.value ?? '')"
        />
        <label class="provider-block__label provider-block__label--sub">{{ t('settings.ai.ollamaDefaultModel') }}</label>
        <el-input
          :model-value="aiStore.providers.ollama?.defaultModel ?? ''"
          :placeholder="t('settings.ai.ollamaDefaultModelPlaceholder')"
          clearable
          :disabled="!isModelEnabled('ollama')"
          class="provider-input"
          @update:model-value="(val: string) => updateProvider('ollama', { defaultModel: val || undefined })"
          @blur="(e: FocusEvent) => onOllamaBlur('defaultModel', (e.target as HTMLInputElement)?.value ?? '')"
        />
      </div>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.ai-settings {
  max-width: 680px;
}

.ai-settings__card {
  margin-bottom: 20px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);

  :deep(.el-card__header) {
    padding: 18px 20px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-card__body) {
    padding: 20px;
  }
}

.card-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.card-hint {
  margin: 0 0 16px;
  font-size: 0.8125rem;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.model-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.model-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.default-model-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.default-model-label {
  flex-shrink: 0;
  font-size: 0.875rem;
  color: var(--el-text-color-regular);
}

.default-model-select {
  flex: 1;
  max-width: 220px;
}

.provider-block {
  padding: 14px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  &:not(:first-child) {
    padding-top: 18px;
  }

  &--disabled .provider-block__label {
    color: var(--el-text-color-placeholder);
  }
}

.provider-block__label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--el-text-color-primary);

  &--sub {
    margin-top: 12px;
  }
}

.provider-input {
  width: 100%;
}
</style>

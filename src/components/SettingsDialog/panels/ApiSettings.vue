<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useApiSettingsStoreHook } from '@/store/modules/apiSettings';

const apiStore = useApiSettingsStoreHook();
const { apiProvider, apiModel, apiKey } = storeToRefs(apiStore);

function save() {
  apiStore.saveToTauriStore();
}
</script>

<template>
  <el-form label-position="top" class="space-y-4">
    <el-form-item label="服务商">
      <el-select v-model="apiProvider" class="w-full" placeholder="请选择" @change="save">
        <el-option value="deepseek" label="DeepSeek" />
        <el-option value="bailian" label="百炼" />
      </el-select>
    </el-form-item>
    <el-form-item label="模型">
      <el-input
        v-model="apiModel"
        placeholder="如 deepseek-chat、qwen-turbo 等"
        clearable
        @blur="save"
      />
    </el-form-item>
    <el-form-item label="API Key">
      <el-input
        v-model="apiKey"
        type="password"
        placeholder="请输入 API Key"
        show-password
        autocomplete="off"
        @blur="save"
      />
    </el-form-item>
  </el-form>
</template>

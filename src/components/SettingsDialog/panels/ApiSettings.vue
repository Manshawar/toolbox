<script setup lang="ts">
import { ref } from 'vue';

const apiProvider = ref<'deepseek' | 'bailian'>('deepseek');
const apiModel = ref('');
const apiKey = ref('');
</script>

<template>
  <el-form label-position="top" class="space-y-4">
    <el-form-item label="服务商">
      <el-select v-model="apiProvider" class="w-full" placeholder="请选择">
        <el-option value="deepseek" label="DeepSeek" />
        <el-option value="bailian" label="百炼" />
      </el-select>
    </el-form-item>
    <el-form-item label="模型">
      <el-input
        v-model="apiModel"
        placeholder="如 deepseek-chat、qwen-turbo 等"
        clearable
      />
    </el-form-item>
    <el-form-item label="API Key">
      <el-input
        v-model="apiKey"
        type="password"
        placeholder="请输入 API Key"
        show-password
        autocomplete="off"
      />
    </el-form-item>
  </el-form>
</template>

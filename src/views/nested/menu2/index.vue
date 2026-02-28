<template>
  <el-card style="padding: 30px">
    <div class="mb-4 flex flex-wrap gap-2">
      <el-button @click="testHandler">测试链接</el-button>
      <el-button @click="insertDataHandler">插入数据</el-button>
      <el-button @click="queryDataHandler">查询数据</el-button>
    </div>
    <div v-if="resultLabel" class="mt-4">
      <div class="mb-1 text-sm text-gray-500">{{ resultLabel }}</div>
      <pre class="rounded bg-gray-100 p-4 text-left text-sm overflow-auto max-h-80">{{ result }}</pre>
    </div>
    <div v-else class="mt-4 text-gray-400 text-sm">点击上方按钮，结果将显示在此处</div>
  </el-card>
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import { testLink } from '@/server/test';
import { insertData, queryData } from '@/sql';

const resultLabel = ref('');
const result = ref('');

function setResult(label: string, data: unknown) {
  resultLabel.value = label;
  result.value = typeof data === 'object' && data !== null
    ? JSON.stringify(data, null, 2)
    : String(data);
}

const testHandler = async () => {
  try {
    const res = await testLink();
    setResult('测试链接', res);
  } catch (e) {
    setResult('测试链接', { error: String(e) });
  }
};
const insertDataHandler = async () => {
  try {
    const res = await insertData();
    setResult('插入数据', res);
  } catch (e) {
    setResult('插入数据', { error: String(e) });
  }
};
const queryDataHandler = async () => {
  try {
    const res = await queryData();
    setResult('查询数据', res);
  } catch (e) {
    setResult('查询数据', { error: String(e) });
  }
};
</script>
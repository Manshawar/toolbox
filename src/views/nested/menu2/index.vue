<template>
  <el-card style="padding: 30px">

    <el-button @click="testHandler">测试链接</el-button>

  </el-card>
</template>
<script lang="ts" setup>
import { testLink } from '@/server/test';

const testHandler = async () => {
  const res = await testLink();
  console.log(res);
};
</script>
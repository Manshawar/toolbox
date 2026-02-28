<template>
  <el-card style="padding: 30px">

    <el-button @click="testHandler">测试链接</el-button>
    <el-button @click="insertDataHandler">插入数据</el-button>
    <el-button @click="queryDataHandler">查询数据</el-button>
  </el-card>
</template>
<script lang="ts" setup>
import { testLink } from '@/server/test';
import { insertData, queryData } from '@/sql';
const testHandler = async () => {
  const res = await testLink();
  console.log(res);
};
const insertDataHandler = async () => {
  const res = await insertData();
  console.log(res);
};
const queryDataHandler = async () => {
  const res = await queryData();
  console.log(res);
};
</script>
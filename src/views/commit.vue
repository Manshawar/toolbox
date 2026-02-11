<template>
  <div class="commit-page flex flex-col h-full p-4">
    <el-tabs v-model="activeTab" class="mb-4">
      <el-tab-pane label="工作区" name="workspace" />
      <el-tab-pane label="提交说明" name="message" />
    </el-tabs>

    <div class="flex flex-1 min-h-0 gap-4">
      <!-- 左列：工作区 Card -->
      <el-card
        class="flex-1 min-w-0 flex flex-col overflow-hidden"
        shadow="hover"
        :body-style="{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }"
      >
        <template #header>
          <span class="font-medium">工作区</span>
        </template>
        <div class="flex flex-col flex-1 min-h-0">
          <!-- 上面：列表 -->
          <div class="border-b border-gray-200 shrink-0">
            <div class="px-4 py-2 text-sm text-gray-500 bg-gray-50">
              变更文件
            </div>
            <el-table
              :data="fileList"
              stripe
              size="default"
              max-height="200"
              class="workspace-table"
              @current-change="onFileSelect"
            >
              <el-table-column type="index" width="50" label="#" />
              <el-table-column prop="path" label="路径" min-width="180" show-overflow-tooltip />
              <el-table-column prop="status" label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <!-- 下面：diff -->
          <div class="flex-1 min-h-0 flex flex-col p-2">
            <div class="text-sm text-gray-500 mb-1">
              Diff
            </div>
            <el-scrollbar class="flex-1 diff-scroll">
              <pre class="diff-content text-xs font-mono p-3">{{ currentDiff }}</pre>
            </el-scrollbar>
          </div>
        </div>
      </el-card>

      <!-- 右列：提交说明 Card -->
      <el-card
        class="w-[380px] shrink-0 flex flex-col overflow-hidden"
        shadow="hover"
        :body-style="{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }"
      >
        <template #header>
          <span class="font-medium">提交说明</span>
        </template>
        <div class="flex flex-col flex-1 min-h-0">
          <el-input
            v-model="commitMessage"
            type="textarea"
            :rows="12"
            placeholder="请输入提交说明..."
            resize="none"
            class="flex-1"
          />
          <div class="mt-3 flex justify-end">
            <el-button type="primary">提交</el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const activeTab = ref('workspace');
const commitMessage = ref('');

const fileList = ref<{ path: string; status: string }[]>([
  { path: 'src/views/Toolbox.vue', status: 'modified' },
  { path: 'src/router/index.ts', status: 'modified' },
  { path: 'src/store/modules/app.ts', status: 'staged' },
]);

const selectedPath = ref<string | null>(null);

function statusType(status: string) {
  if (status === 'modified') return 'warning';
  if (status === 'staged') return 'success';
  if (status === 'untracked') return 'info';
  return '';
}

function onFileSelect(row: { path: string } | null) {
  selectedPath.value = row?.path ?? null;
}

const currentDiff = computed(() => {
  if (!selectedPath.value) return '选择左侧文件可查看 diff';
  return `--- a/${selectedPath.value}\n+++ b/${selectedPath.value}\n@@ -1,3 +1,4 @@\n ...\n+新行内容\n`;
});
</script>

<style scoped>
.commit-page :deep(.el-card__body) {
  height: 100%;
}
.diff-scroll {
  background: #f6f8fa;
  border-radius: 6px;
}
.diff-content {
  margin: 0;
  color: #24292f;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>

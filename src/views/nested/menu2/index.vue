<template>
  <el-card style="padding: 30px">
    <div v-if="swaggerUrl" class="mb-4">
      <el-alert type="info" :closable="false">
        <template #title>
          <span>Swagger 地址：</span>
          <a :href="swaggerUrl" target="_blank" class="text-blue-500 underline">
            {{ swaggerUrl }}
          </a>
        </template>
      </el-alert>
    </div>
    <div class="mb-4 flex flex-wrap gap-2">
      <el-button @click="testHandler">测试链接</el-button>
      <el-button @click="insertDataHandler">插入数据</el-button>
      <el-button @click="queryDataHandler">查询数据</el-button>
      <el-button @click="getAllStoreHandler">获取全部 Store</el-button>
      <el-button @click="testNodeHandler">测试 Node</el-button>
      <el-button @click="testHealthHandler">健康检查</el-button>
      <el-button
        :type="wsConnected ? 'danger' : 'primary'"
        @click="toggleWsHandler"
      >
        {{ wsConnected ? '断开 WebSocket' : '连接 WebSocket' }}
      </el-button>
    </div>
    <div v-if="wsConnected || wsMessages.length > 0" class="mt-4">
      <div class="mb-2 text-sm font-medium text-gray-700">WebSocket 测试</div>
      <div class="flex gap-2 mb-2">
        <el-input
          v-model="wsInput"
          placeholder="输入消息..."
          @keyup.enter="sendWsMessage"
          style="flex: 1"
        />
        <el-button type="primary" @click="sendWsMessage">发送</el-button>
      </div>
      <div class="rounded bg-gray-100 p-4 text-left text-sm overflow-auto max-h-60">
        <div
          v-for="(msg, idx) in wsMessages"
          :key="idx"
          :class="['mb-1', msg.type === 'sent' ? 'text-blue-600' : 'text-green-600']"
        >
          <span class="text-xs text-gray-400">{{ formatTime(msg.time) }}</span>
          <span class="ml-2">{{ msg.type === 'sent' ? '→' : '←' }} {{ msg.content }}</span>
        </div>
      </div>
    </div>
    <div v-if="resultLabel" class="mt-4">
      <div class="mb-1 text-sm text-gray-500">{{ resultLabel }}</div>
      <pre class="rounded bg-gray-100 p-4 text-left text-sm overflow-auto max-h-80">{{ result }}</pre>
    </div>
    <div v-else-if="!wsConnected && wsMessages.length === 0" class="mt-4 text-gray-400 text-sm">点击上方按钮，结果将显示在此处</div>
  </el-card>
</template>
<script lang="ts" setup>
import { onMounted, ref, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { testLink } from '@/server/test';
import { fetchApi } from '@/utils/axios';
import { insertData, queryData } from '@/sql';
import { getStore } from '@/tauriStore';
import { useTauriConfigStore } from '@/store/modules/tauriConfig';
import { store } from '@/store';

const resultLabel = ref('');
const result = ref('');
const swaggerUrl = ref('');

// WebSocket 状态
const wsConnected = ref(false);
const wsInput = ref('');
const wsMessages = ref<Array<{ type: 'sent' | 'received'; content: string; time: Date }>>([]);
let wsClient: WebSocket | null = null;

const tauriConfig = useTauriConfigStore(store);

onMounted(async () => {
  try {
    const res = await testLink();
    if (res?.url) swaggerUrl.value = res.url;
  } catch (e) {
    console.error('[menu2] 获取 swagger 地址失败', e);
  }
});
const testNodeHandler = async () => {
  try {
    const output = await invoke<{ stdout: string; stderr: string; success: boolean }>(
      'run_node_runtime',
      { args: ['-e', 'console.log("Hello, World!")'] }
    );
    setResult('测试 Node', output);
  } catch (e) {
    setResult('测试 Node', { error: String(e) });
  }
};
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
  } catch (e: unknown) {
    setResult('测试链接', { error: e instanceof Error ? e.message : String(e) });
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
const getAllStoreHandler = async () => {
  try {
    const store = await getStore();
    if (store) {
      const res = await store.entries();
      setResult('全部 Store', res);
    }
  } catch (e) {
    setResult('全部 Store', { error: String(e) });
  }
};
const testHealthHandler = async () => {
  try {
    const res = await fetchApi('/health', { method: 'GET' });
    setResult('健康检查', res);
  } catch (e) {
    setResult('健康检查', { error: String(e) });
  }
};

// WebSocket 处理
const toggleWsHandler = () => {
  if (wsConnected.value) {
    disconnectWs();
  } else {
    connectWs();
  }
};

const connectWs = () => {
  const port = tauriConfig.api_port;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  try {
    wsClient = new WebSocket(wsUrl);

    wsClient.onopen = () => {
      wsConnected.value = true;
      addWsMessage('received', 'WebSocket 已连接');
    };

    wsClient.onmessage = (event) => {
      addWsMessage('received', event.data);
    };

    wsClient.onclose = () => {
      wsConnected.value = false;
      addWsMessage('received', 'WebSocket 已断开');
      wsClient = null;
    };

    wsClient.onerror = (error) => {
      addWsMessage('received', `WebSocket 错误: ${error.type}`);
    };
  } catch (e) {
    addWsMessage('received', `连接失败: ${String(e)}`);
  }
};

const disconnectWs = () => {
  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }
  wsConnected.value = false;
};

const sendWsMessage = () => {
  if (!wsClient || !wsConnected.value || !wsInput.value) return;

  wsClient.send(wsInput.value);
  addWsMessage('sent', wsInput.value);
  wsInput.value = '';
};

const addWsMessage = (type: 'sent' | 'received', content: string) => {
  wsMessages.value.unshift({ type, content, time: new Date() });
  // 只保留最近 50 条消息
  if (wsMessages.value.length > 50) {
    wsMessages.value = wsMessages.value.slice(0, 50);
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', { hour12: false });
};

onUnmounted(() => {
  disconnectWs();
});
</script>
/**
 * core 入口：启动 langchain-serve 服务
 * 环境变量由开发脚本（dotenv）或 Rust 侧车注入
 */
const ENTRY_START_TIME = Date.now();
console.log(`[startup:entry] Node 进程启动，PID: ${process.pid}，时间戳: ${ENTRY_START_TIME}`);

import { run } from "./src/main";

console.log(`[startup:entry] 模块加载完成，耗时: ${Date.now() - ENTRY_START_TIME}ms`);
run();

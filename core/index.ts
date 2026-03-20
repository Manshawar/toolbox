/**
 * core 入口：启动 langchain-serve 服务
 * 环境变量由开发脚本（dotenv）或 Rust 侧车注入
 */
import { run } from "./src/main";

run();

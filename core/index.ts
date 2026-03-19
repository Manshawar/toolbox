/**
 * core 入口：启动 langchain-serve 服务
 */
import { config } from "dotenv";
import { run } from "./app/langchain-serve/src/index";

// tsx 本地启动时读取 core/.env（例如 TOOLBOX_ENV=development）。
// 侧车模式通常通过 Rust 注入环境变量，不依赖该文件。
config();

run();

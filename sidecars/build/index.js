/**
 * Core launcher - 由 Rust 分别启动两次，每次传入 command + 环境变量
 *
 * - 第一次: args = ['langchain-serve'], env = { VITE_API_PORT, VITE_PTY_PORT }
 * - 第二次: args = ['pty-host'],       env = { VITE_API_PORT, VITE_PTY_PORT }
 * 各 worker 只使用自己对应的端口（langchain-serve 用 VITE_API_PORT，pty-host 用 VITE_PTY_PORT）。
 */
const path = require('path');
const command = process.argv[2];

switch (command) {
  case 'langchain-serve':
    require(path.join(__dirname, 'langchain-serve.js'));
    break;
  case 'pty-host':
    require(path.join(__dirname, 'pty-host.js'));
    break;
  default:
    console.error(`[core] unknown command: ${command}`);
    process.exit(1);
}

